/* globals RegExpMatchArray */

/**
 * @typedef {import('sass')} Sass
 * @typedef {import('sass').LegacyException} SassException
 * @typedef {import('sass').LegacyResult} SassResult
 * @typedef {import('sass').LegacyOptions<"async">} SassAsyncOptions
 * @typedef {import('sass').LegacyOptions<"sync">} SassSyncOptions
 * @typedef {import('sass').Logger} SassLogger
 * @typedef {import('../lib/types.js').SassRenderError} SassRenderError
 * @typedef {import('./sass-render.js').SassRenderer} SassRenderer
 */

import { fileURLToPath } from 'node:url';
import sassRenderer from './sass-render.js';
import { resolvePath } from './util.js';

const outputRegexes = [
	/(?<type>Error|DEPRECATION WARNING|Deprecation Warning):(?<message>.+?)╷\s*?\d+\s*│(?<codeLine>\s*.+?)\n\s*│(?<codePositionMarker>\s*\^+?)\n\s*╵(?<stack>.+?root stylesheet)/gs,
	/(?<type>Error):(?<message>.+?)╷.+━ declaration.+?\d+\s*│(?<codeLine>\s*.+?)\n\s*│(?<codePositionMarker>\s*\^+?)\sinvocation\n\s*╵(?<stack>.+?root stylesheet)/gs,
	/(?<type>Error):(?<message>.+?)┌──>.+?\n\d+\s*│(?<codeLine>\s*.+?)\n\s*│(?<codePositionMarker>\s*\^+?)\sinvocation.+?━ declaration\n\s*╵(?<stack>.+?root stylesheet)/gs,
	/(?<type>DEPRECATION WARNING|Deprecation Warning) on line (?<line>\d+), column (?<column>\d+) of (?<file>.+?):(?<message>.+?)╷\s*?\d+\s*│(?<codeLine>\s*.+?)\n\s*│(?<codePositionMarker>\s*\^+?)\n/gs,
	/(?<type>Error): (?<file>.+?): (?<message>.+$)/g
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
		.concat([...(`${input}\n`.matchAll(stackRegex) ?? [])])
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
 */
function extractMessage(input) {
	return input
		.split('\n')
		.filter((input) => wordLike.test(input))
		.map((input) => {
			let output = input.trim();
			if (!dotAtEnd.test(output)) {
				output = `${output}.`;
			}
			if (startsWithLowercase.test(output)) {
				output = output.charAt(0).toUpperCase() + output.slice(1);
			}
			return output;
		})
		.join(' ');
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
				...(input.matchAll(outputRegex) ?? [])
			])
		)
		.map((result) => {
			const {
				message = '',
				codeLine = '',
				codePositionMarker = '',
				type = '',
				stack = ''
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
			const composedMessage = extractMessage(message);

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

			/** @type {SassRenderError} */
			const composedResult = {
				file: file,
				message: composedMessage,
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
 * @param {SassException}    input
 * @param {string|undefined} file
 * @param {string}           cwd
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
 * @param   {SassRenderError[]} errors
 * @param   {string}            cwd
 *
 * @returns {SassLogger}
 */
function parseLoggerOutput(errors, cwd) {
	return {
		warn: (message, options) => {
			const composedFile = resolvePath(cwd, options?.span?.url ?? '');
			const composedMessage = extractMessage(message);
			const composedSpan = options.span;
			const composedType = options.deprecation ? 'deprecation' : 'error';
			const extractedStack = extractStack(options?.stack?.trim?.() ?? '');
			const composedStack = extractedStack.map(
				({ file, line, column, context }) =>
					`at ${context} (${resolvePath(cwd, file)}:${line}:${column})`
			);

			/** @type {SassRenderError} */
			const result = {
				file: composedFile,
				message: composedMessage,
				stack: composedStack,
				source: {
					start: {
						line: (composedSpan?.start?.line ?? -1) + 1,
						column: (composedSpan?.start?.column ?? -1) + 1
					},
					end: {
						line: (composedSpan?.end?.line ?? -1) + 1,
						column: (composedSpan?.end?.column ?? -1) + 1
					},
					pattern: options?.span?.text ?? ''
				},
				type: composedType
			};
			errors.push(result);
		}
	};
}

/**
 * @param {SassRenderer}                     renderer
 * @param {SassAsyncOptions|SassSyncOptions} options  Sass options.
 */
async function getRenderResults(renderer, options) {
	/** @type {SassRenderError[]} */
	const errors = [];
	const cwd = process.cwd();

	try {
		/** @type {SassAsyncOptions|SassSyncOptions} */
		const renderOptions = {
			...options,
			logger: parseLoggerOutput(errors, cwd),
			verbose: true
		};
		if (renderOptions.data && !renderOptions.file) {
			renderOptions.file = 'stdin';
		}
		await renderer(renderOptions);
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
	}

	const resolvedFile = resolvePath(cwd, options.file);

	return errors.filter((error) => {
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
		 * @param {SassAsyncOptions} options Sass options.
		 */
		render: getRenderResults.bind(null, asyncRenderer),

		/**
		 * Returns `Promise` with array of errors and deprecations. If input contains multiple errors, only first one is shown. All deprecations are always visible.
		 *
		 * Uses `sass.renderSync` for rendering.
		 *
		 * @param {SassSyncOptions} options Sass options.
		 */
		renderSync: getRenderResults.bind(null, syncRenderer)
	};
}
