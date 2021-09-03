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
import hookStd from 'hook-std';
import matchAll from 'string-match-all';
import sassRenderer from './sass-render';

const outputRegexes = [
	/(?:Error|DEPRECATION WARNING):(?<message>.+?)╷\s*?\d+\s*│(?<codeLine>\s*.+?)\n\s*│(?<codePositionMarker>\s*\^+?)\n\s*╵\s*(?<file>.+?)\s(?<line>\d+):(?<column>\d+)/gs,
	/DEPRECATION WARNING on line (?<line>\d+), column (?<column>\d+) of (?<file>.+?):(?<message>.+?)╷\s*?\d+\s*│(?<codeLine>\s*.+?)\n\s*│(?<codePositionMarker>\s*\^+?)\n/gs,
	/Error: (?<file>.+?): (?<message>.+$)/g
];
const wordLike = /\w/;
const dotAtEnd = /\.$/;
const startsWithLowercase = /^[a-z]/;
const stdinSubpath = /\/stdin$/;

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
function parseStringOutput(input) {
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
				file = '',
				line = '1',
				column = '1'
			} = result.groups ?? {};

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
			const composedCodeLine = codeLine.trim();
			const { code, markerLength } = extractInformationWithPositionMarker(
				codeLine,
				codePositionMarker
			);

			/** @type {SassRenderError} */
			const composedResult = {
				type: null,
				file: file,
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
				message: composedMessage
			};

			return composedResult;
		});

	return results;
}

/**
 * @param {SassException} input
 * @param {string}        file
 * @param {string}        cwd
 */
function parseErrorOutput(input, file, cwd) {
	/** @type {SassRenderError[]} */
	const errors = [];
	const results = parseStringOutput(input.formatted);

	results.forEach((result) => {
		let composedFile = file ?? path.resolve(cwd, result.file);
		if (stdinSubpath.test(composedFile)) {
			composedFile = 'stdin';
		}
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
	const results = parseStringOutput(input);

	results.forEach((result) => {
		const { file } = result;
		let composedFile = path.resolve(cwd, file);
		if (stdinSubpath.test(composedFile)) {
			composedFile = 'stdin';
		}
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
	const consoleOutput = [''];
	/** @type {SassRenderError[]} */
	const errors = [];
	/** @type {SassRenderError[]} */
	const deprecations = [];
	const cwd = process.cwd();

	const consoleOutputPromise = hookStd.stderr((output) => {
		consoleOutput.push(output);
	});

	try {
		/** @type {SassOptions} */
		const renderOptions = {
			...options,
			verbose: true
		};
		await renderer(renderOptions);

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
		consoleOutputPromise.unhook();
	}

	try {
		await consoleOutputPromise;
	} catch {
		// Handled
	}

	return [...errors, ...deprecations];
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
