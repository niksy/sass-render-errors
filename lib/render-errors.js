/* globals RegExpMatchArray */

/**
 * @typedef {import('sass')} Sass
 * @typedef {import('sass').Exception} SassException
 * @typedef {import('sass').Options<"sync">} SassSyncOptions
 * @typedef {import('sass').Options<"async">} SassAsyncOptions
 * @typedef {import('sass').StringOptions<"sync">} SassStringSyncOptions
 * @typedef {import('sass').StringOptions<"async">} SassStringAsyncOptions
 * @typedef {import('sass').Logger} SassLogger
 * @typedef {import('../lib/types.js').SassRenderError} SassRenderError
 */

import sassRenderer from './sass-render.js';
import { resolvePath, resolveStackPath } from './util.js';

const stackRegex = /\s*(?<file>.+?)\s(?<line>\d+):(?<column>\d+)\s+(?<context>.+?)\n/gs;
const wordLike = /\w/;
const dotAtEnd = /\.$/;
const startsWithLowercase = /^[a-z]/;

/**
 * @param {string} input
 */
function extractStack(input) {
	/** @type {RegExpMatchArray[]} */
	const matches = [];

	const results = [...matches, ...(`${input}\n`.matchAll(stackRegex) ?? [])].map((result) => {
		const { file = '', line = '1', column = '1', context = '' } = result.groups ?? {};
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
 * @param {SassException}    input
 * @param {string|undefined} file
 * @param {string}           cwd
 */
function parseErrorOutput(input, file, cwd) {
	const composedFile = resolvePath(cwd, input?.span?.url ?? file ?? '');
	const composedMessage = extractMessage(input.sassMessage);
	const composedSpan = input.span;
	const composedType = 'error';
	const extractedStack = extractStack(input?.sassStack?.trim?.() ?? '');
	const composedStack = extractedStack.map(({ file, line, column, context }) => {
		return `at ${context} (${resolveStackPath(file)}:${line}:${column})`;
	});

	/** @type {SassRenderError[]} */
	const errors = [];

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
			pattern: input?.span?.text ?? ''
		},
		type: composedType
	};
	errors.push(result);

	return errors;
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
			const composedStack = extractedStack.map(({ file, line, column, context }) => {
				return `at ${context} (${resolveStackPath(file)}:${line}:${column})`;
			});

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
 * @typedef {(options: {verbose: boolean, logger: SassLogger}) => Promise<import('sass').CompileResult>} SassRenderer
 */

/**
 * @param {SassRenderer} renderer
 * @param {string}       input
 */
async function getRenderResults(renderer, input) {
	const cwd = process.cwd();
	/** @type {SassRenderError[]} */
	const errors = [];
	const defaultOptions = {
		verbose: true,
		logger: parseLoggerOutput(errors, cwd)
	};
	try {
		await renderer(defaultOptions);
	} catch (error) {
		errors.push(...parseErrorOutput(/** @type {SassException}*/ (error), input, cwd));
	}
	return errors;
}

/**
 * Create Sass render errors renderer.
 *
 * @param {Sass} sass Sass module reference. _Only Dart Sass is supported_.
 */
export default function (sass) {
	const renderer = sassRenderer(sass);

	return {
		/**
		 * Returns `Promise` with array of errors and deprecations. If input contains multiple errors,
		 * only first one is shown. All deprecations are always visible.
		 *
		 * Uses `sass.compile` for rendering.
		 *
		 * @param {string}           input
		 * @param {SassSyncOptions=} options
		 */
		compile: async (input, options) => {
			return getRenderResults((defaultOptions) => {
				return renderer.compile(input, {
					...defaultOptions,
					...options
				});
			}, input);
		},

		/**
		 * Returns `Promise` with array of errors and deprecations. If input contains multiple errors,
		 * only first one is shown. All deprecations are always visible.
		 *
		 * Uses `sass.compileAsync` for rendering.
		 *
		 * @param {string}            input
		 * @param {SassAsyncOptions=} options
		 */
		compileAsync: async (input, options) => {
			return getRenderResults((defaultOptions) => {
				return renderer.compileAsync(input, {
					...defaultOptions,
					...options
				});
			}, input);
		},

		/**
		 * Returns `Promise` with array of errors and deprecations. If input contains multiple errors,
		 * only first one is shown. All deprecations are always visible.
		 *
		 * Uses `sass.compileString` for rendering.
		 *
		 * @param {string}                 input
		 * @param {SassStringSyncOptions=} options
		 */
		compileString: async (input, options) => {
			return getRenderResults((defaultOptions) => {
				return renderer.compileString(input, {
					...defaultOptions,
					...options
				});
			}, 'stdin');
		},

		/**
		 * Returns `Promise` with array of errors and deprecations. If input contains multiple errors,
		 * only first one is shown. All deprecations are always visible.
		 *
		 * Uses `sass.compileStringAsync` for rendering.
		 *
		 * @param {string}                  input
		 * @param {SassStringAsyncOptions=} options
		 */
		compileStringAsync: async (input, options) => {
			return getRenderResults((defaultOptions) => {
				return renderer.compileStringAsync(input, {
					...defaultOptions,
					...options
				});
			}, 'stdin');
		}
	};
}
