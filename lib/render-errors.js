/* globals RegExpMatchArray */

/**
 * @typedef {import('sass')} Sass
 * @typedef {import('sass').SassException} SassException
 * @typedef {import('sass').Result} SassResult
 * @typedef {import('../types').Options} SassOptions
 * @typedef {import('../types').SassRenderError} SassRenderError
 * @typedef {import('./sass-render').SassRenderer} SassRenderer
 */

import path from 'path';
import matchAll from 'string-match-all';
import sassRenderer from './sass-render';
import consoleOutputFactory from './console-output';
import { resolvePath } from './util';

const outputRegexes = [
	/(?<type>Error|DEPRECATION WARNING):(?<message>.+?)(?<detail>\s*╷\s*?\d+\s*│(?<codeLine>\s*.+?)\n\s*│(?<codePositionMarker>\s*\^+?)\n\s*╵)(?<stack>.+?root stylesheet)/gs,
	/(?<type>Error):(?<message>.+?)(?<detail>\s*╷.+━ declaration.+?\d+\s*│(?<codeLine>\s*.+?)\n\s*│(?<codePositionMarker>\s*\^+?)\sinvocation\n\s*╵)(?<stack>.+?root stylesheet)/gs,
	/(?<type>Error):(?<message>.+?)(?<detail>\s*┌──>.+?\n\d+\s*│(?<codeLine>\s*.+?)\n\s*│(?<codePositionMarker>\s*\^+?)\sinvocation.+?━ declaration\n\s*╵)(?<stack>.+?root stylesheet)/gs,
	/(?<type>DEPRECATION WARNING) on line (?<line>\d+), column (?<column>\d+) of (?<file>.+?):(?<message>.+?)(?<detail>\s*╷\s*?\d+\s*│(?<codeLine>\s*.+?)\n\s*│(?<codePositionMarker>\s*\^+?)\n)/gs,
	/(?<type>Error): (?<file>.+?): (?<detail>\s*(?<message>.+$))/g
];
const stackRegex =
	/\s*(?<file>.+?)\s(?<line>\d+):(?<column>\d+)\s+(?<context>.+?)\n/gs;
const wordLike = /\w/;
const dotAtEnd = /\.$/;
const startsWithLowercase = /^[a-z]/;
/** @type {SassRenderError} */
const temporaryLintResult = {
	file: '',
	message: '',
	detail: '',
	stack: [],
	source: {
		start: {
			line: -1,
			column: -1
		},
		end: {
			line: -1,
			column: -1
		},
		pattern: ''
	},
	type: 'error'
};

/**
 * @param {SassRenderError[]} errors
 */
function unique(errors) {
	/* eslint-disable unicorn/prefer-spread */
	/** @type {[string, SassRenderError][]} */
	const collection = errors.map((entry) => [JSON.stringify(entry), entry]);
	const map = new Map(collection);
	return Array.from(map.values());
}

/**
 * @param {string} codeLine
 * @param {string} codePositionMarker
 */
function extractInformationWithPositionMarker(codeLine, codePositionMarker) {
	const firstIndex = codePositionMarker.indexOf('^');
	const code = codeLine.slice(firstIndex, codePositionMarker.length);
	const markerLength = codePositionMarker.trim().length;
	return {
		code,
		markerLength
	};
}

/**
 * @param {string} input
 */
function extractStack(input) {
	/** @type {RegExpMatchArray[]} */
	const matches = [];

	const results = matches
		.concat(...[[...(matchAll(`${input}\n`, stackRegex) ?? [])]])
		.map((result) => {
			const {
				file = '',
				line = '1',
				column = '1',
				context = ''
			} = result.groups ?? {};
			return {
				file,
				line,
				column,
				context
			};
		});

	return results;
}

/**
 * @param {string} input
 * @param {string} cwd
 */
function parseStringOutput(input, cwd) {
	/** @type {RegExpMatchArray[]} */
	const matches = [];

	const results = matches
		.concat(
			...outputRegexes.map((outputRegex) => [
				...(matchAll(input, outputRegex) ?? [])
			])
		)
		.map((result) => {
			const {
				message = '',
				codeLine = '',
				codePositionMarker = '',
				type = '',
				stack = '',
				detail = ''
			} = result.groups ?? {};

			const extractedStack = extractStack(stack.trim());
			const firstStackEntry = extractedStack[0];

			let { file = '', line = '1', column = '1' } = result.groups ?? {};

			if (typeof firstStackEntry !== 'undefined') {
				file = firstStackEntry.file;
				line = firstStackEntry.line;
				column = firstStackEntry.column;
			}

			/** @type {string[]} */
			let composedStack = [];
			if (extractedStack.length !== 0) {
				composedStack = composedStack.concat(
					...extractedStack.map(
						({ file, line, column, context }) =>
							`at ${context} (${resolvePath(
								cwd,
								file
							)}:${line}:${column})`
					)
				);
			} else {
				composedStack.push(
					`at root stylesheet (${resolvePath(
						cwd,
						file
					)}:${line}:${column})`
				);
			}

			const composedCodeLine = codeLine.trim();

			if (composedCodeLine.includes('-lint-')) {
				return temporaryLintResult;
			}

			const composedLine = Number(line);
			const composedColumn = Number(column);
			const composedMessage = message
				.split('\n')
				.filter((input) => wordLike.test(input))
				.map((input) => {
					let output = input.trim();
					if (!dotAtEnd.test(output)) {
						output = `${output}.`;
					}
					if (startsWithLowercase.test(output)) {
						output =
							output.charAt(0).toUpperCase() + output.slice(1);
					}
					return output;
				})
				.join(' ');

			const [splittedType] = type.toLowerCase().split(' ');
			/** @type {"error"|"deprecation"} */
			let composedType = 'error';
			if (splittedType === 'error' || splittedType === 'deprecation') {
				composedType = splittedType;
			}

			const { code, markerLength } = extractInformationWithPositionMarker(
				codeLine,
				codePositionMarker
			);

			const composedDetail = detail.trimEnd();

			/** @type {SassRenderError} */
			const composedResult = {
				file: file,
				message: composedMessage,
				detail: composedDetail,
				stack: composedStack,
				source: {
					start: {
						line: composedLine,
						column: composedColumn
					},
					end: {
						line: composedLine,
						column: composedColumn + markerLength
					},
					pattern: code
				},
				type: composedType
			};

			return composedResult;
		})
		.filter((result) => {
			return (
				result.source.start.line !== -1 &&
				result.source.start.column !== -1
			);
		});

	return unique(results);
}

/**
 * @param {SassException} input
 * @param {string}        file
 * @param {string}        cwd
 */
function parseErrorOutput(input, file, cwd) {
	/** @type {SassRenderError[]} */
	const errors = [];
	const results = parseStringOutput(input.formatted, cwd);

	results.forEach((result) => {
		const composedFile = resolvePath(cwd, file ?? result.file);
		errors.push({
			...result,
			type: 'error',
			file: composedFile
		});
	});

	return {
		errors
	};
}

/**
 * @param {string} input
 * @param {string} cwd
 */
function parseConsoleOutput(input, cwd) {
	/** @type {SassRenderError[]} */
	const deprecations = [];
	const results = parseStringOutput(input, cwd);

	results.forEach((result) => {
		const composedFile = resolvePath(cwd, result.file);
		deprecations.push({
			...result,
			type: 'deprecation',
			file: composedFile
		});
	});

	return {
		deprecations
	};
}

/**
 * @param {SassRenderer} renderer
 * @param {SassOptions}  options  Sass options.
 */
async function getRenderResults(renderer, options) {
	/** @type {SassRenderError[]} */
	const errors = [];
	/** @type {SassRenderError[]} */
	const deprecations = [];
	const cwd = process.cwd();

	const consoleOutputQueue = consoleOutputFactory();

	try {
		/** @type {SassOptions} */
		const renderOptions = {
			...options,
			verbose: true
		};

		await consoleOutputQueue.add(() => renderer(renderOptions));

		const consoleOutput = await consoleOutputQueue.value();

		const { deprecations: deprecationsFromConsole } = parseConsoleOutput(
			consoleOutput.join(''),
			cwd
		);
		deprecationsFromConsole.forEach((deprecation) => {
			deprecations.push(deprecation);
		});
	} catch (/** @type {any} */ error_) {
		/** @type {SassException} */
		const error = error_;
		const { errors: errorsFromOutput } = parseErrorOutput(
			error,
			error.file,
			cwd
		);
		errorsFromOutput.forEach((error) => {
			errors.push(error);
		});
	} finally {
		await consoleOutputQueue.completed();
	}

	const resolvedFile = resolvePath(cwd, options.file);

	return [...errors, ...deprecations].filter((error) => {
		return (
			error.file === resolvedFile ||
			error.stack.some((stackEntry) => stackEntry.includes(resolvedFile))
		);
	});
}

/**
 * Create Sass render errors renderer.
 *
 * @param {Sass} sass Sass module reference. _Only Dart Sass is supported_.
 */
export default function (sass) {
	const { render: asyncRenderer, renderSync: syncRenderer } =
		sassRenderer(sass);

	return {
		/**
		 * Returns `Promise` with array of errors and deprecations. If input contains multiple errors, only first one is shown. All deprecations are always visible.
		 *
		 * Uses `sass.render` for rendering.
		 *
		 * @param {SassOptions} options Sass options.
		 */
		render: getRenderResults.bind(null, asyncRenderer),

		/**
		 * Returns `Promise` with array of errors and deprecations. If input contains multiple errors, only first one is shown. All deprecations are always visible.
		 *
		 * Uses `sass.renderSync` for rendering.
		 *
		 * @param {SassOptions} options Sass options.
		 */
		renderSync: getRenderResults.bind(null, syncRenderer)
	};
}
