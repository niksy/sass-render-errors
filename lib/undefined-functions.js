/* eslint-disable no-undefined */

import { promises as fs } from 'node:fs';
import { pathToFileURL } from 'node:url';
import postcss from 'postcss';
import postcssScss from 'postcss-scss';
import parse from 'postcss-value-parser';
import { customAlphabet } from 'nanoid';
import cssFunctionsList from 'css-functions-list';
import jsonFns from 'node-sass-json-functions';
import pMemoize from 'p-memoize';
import sassRenderer from './sass-render.js';
import { resolvePath, resolveStackPath } from './util.js';

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

/**
 * @typedef {import('postcss').ChildNode} ChildNode
 */

/**
 * @typedef {object} ParseResult
 * @property {number}    line
 * @property {number}    column
 * @property {ChildNode} node
 * @property {string}    name
 * @property {string}    input
 */

const generateId = customAlphabet('xyzwqXYZWQ', 10);
const atRulesToCheck = /import|use|forward|return|debug|warn|error|at-root|if|else|media/;
const interpolationPrefix = /^#{\s*/m;

const getKnownCssFunctions = pMemoize(async (/** @type {string}*/ cssFunctionsList) => {
	return /** @type {string[]}*/ (JSON.parse(await fs.readFile(cssFunctionsList, 'utf8')));
});

const composeKnownCssFunctions = pMemoize(
	async (
		/** @type {Options["disallowedKnownCssFunctions"]}*/ disallowedKnownCssFunctions,
		/** @type {Options["additionalKnownCssFunctions"]}*/ additionalKnownCssFunctions
	) => {
		const knownCssFunctions = await getKnownCssFunctions(cssFunctionsList);
		return (
			[...knownCssFunctions, ...additionalKnownCssFunctions].filter(
				(knownCssFunction) => !disallowedKnownCssFunctions.includes(knownCssFunction)
			) ?? []
		);
	},
	{
		cacheKey: JSON.stringify
	}
);

const jsonEncodeFunctionKey = 'json-encode($data, $quotes: true)';

const noop = () => {
	return {
		postcssPlugin: 'noop'
	};
};
noop.postcss = true;

const cssProcessor = postcss([noop()]);

/**
 * @param {ChildNode} rootNode
 * @param {string[]}  knownCssFunctions
 */
function getParsedFunctionNodes(rootNode, knownCssFunctions) {
	const line = rootNode?.source?.start?.line ?? 1;
	const column = rootNode?.source?.start?.column ?? 1;
	/** @type {ParseResult[]} */
	const nodes = [];
	let valueToParse = '';

	if (rootNode.type === 'decl') {
		valueToParse = rootNode.value;
	}
	if (rootNode.type === 'atrule') {
		valueToParse = rootNode.params;
	}

	if (!valueToParse.includes('(')) {
		return nodes;
	}

	const parsedValue = parse(valueToParse);

	parsedValue.walk((node) => {
		if (node.type !== 'function' || node.value === '') {
			return;
		}
		if (knownCssFunctions.includes(node.value)) {
			return;
		}

		node.value = node.value.replace(interpolationPrefix, '');

		const input = parse.stringify(node);
		const name = node.value;

		const composedColumn = column + rootNode.toString().indexOf(name);

		const result = {
			line: line,
			column: composedColumn,
			node: rootNode,
			name: name,
			input: input
		};

		nodes.push(result);
	});

	return nodes;
}

/**
 * @param {string} before
 * @param {string} after
 */
function isUndefinedFunction(before, after) {
	const parsedBefore = parse(before || String(null));
	const parsedAfter = parse(after || String(null));

	/** @type {string[]} */
	const matchingPairs = [];

	[parsedBefore, parsedAfter].forEach((parsed) => {
		parsed.walk((node, index) => {
			if (index === 0) {
				matchingPairs.push(JSON.stringify([node.type, node.value]));
				return false;
			}
			// eslint-disable-next-line consistent-return, no-useless-return
			return;
		});
	});

	return new Set(matchingPairs).size === 1;
}

const outerRegex = /^'(.+)'$/;

/**
 * @param {string} value
 */
function stripOuter(value) {
	return value.replace(outerRegex, '$1');
}

/**
 * @callback SassRenderer
 * @param   {string}                                                                                                     input
 * @param   {{verbose: boolean, functions?: {[x: string]: (args: import('sass').Value[]) => import('sass').SassString}}} options
 * @returns {Promise<import('sass').CompileResult>}
 */

/**
 * @param {SassRenderer}                         renderer
 * @param {{type: "file"|"code", value: string}} input
 * @param {string[]}                             knownCssFunctions
 */
async function getRenderResults(renderer, input, knownCssFunctions) {
	/** @type {SassRenderError[]} */
	const errors = [];
	const cwd = process.cwd();

	try {
		const id = generateId();
		const nodeSelector = `lint-node-${id}`;
		const nodeSelectorRegex = new RegExp(nodeSelector);
		let entryUrl, inputCssString;
		if (input.type === 'code') {
			inputCssString = input.value;
			entryUrl = null;
		} else {
			inputCssString = await fs.readFile(input.value, 'utf8');
			entryUrl = pathToFileURL(input.value);
		}

		const initialParseResponse = await cssProcessor.process(inputCssString, {
			syntax: postcssScss,
			from: undefined
		});
		const initialParseRoot = initialParseResponse.root;

		if (typeof initialParseRoot === 'undefined') {
			return errors;
		}

		/** @type {ParseResult[]} */
		const functionNodes = [];

		initialParseRoot.walkAtRules(atRulesToCheck, (atRule) => {
			if (atRule.name === 'if') {
				atRule.params = 'true';
			} else if (atRule.name === 'else') {
				atRule.name = 'if';
				atRule.params = 'true';
			} else {
				const parsedFunctionNodes = getParsedFunctionNodes(atRule, knownCssFunctions);
				parsedFunctionNodes.forEach((functionNode) => {
					functionNodes.push(functionNode);
				});
			}
		});

		initialParseRoot.walkDecls((decl) => {
			const parsedFunctionNodes = getParsedFunctionNodes(decl, knownCssFunctions);
			parsedFunctionNodes.forEach((functionNode) => {
				functionNodes.push(functionNode);
			});
		});

		if (functionNodes.length === 0) {
			return errors;
		}

		functionNodes.forEach((functionNode) => {
			const properties = {
				selector: `.${nodeSelector}`,
				nodes: [
					{
						prop: '-lint-line',
						value: String(functionNode.line)
					},
					{
						prop: '-lint-column',
						value: String(functionNode.column)
					},
					{
						prop: '-lint-name',
						value: JSON.stringify(functionNode.name)
					},
					{
						prop: '-lint-before',
						value: JSON.stringify(functionNode.input)
					},
					{
						prop: '-lint-after',
						value: `${id}json-encode(${functionNode.input}, $quotes: false)`
					}
				]
			};
			functionNode.node.after(properties);
		});

		const defaultOptions = {
			functions: {
				[`${id}${jsonEncodeFunctionKey}`]: jsonFns[jsonEncodeFunctionKey]
			},
			verbose: true,
			...(entryUrl && {
				url: entryUrl
			})
		};

		const sassRenderResponse = await renderer(initialParseRoot.toString(), defaultOptions);

		const parseResponse = await cssProcessor.process(sassRenderResponse?.css.toString() ?? '', {
			from: undefined
		});
		const parseRoot = parseResponse.root;

		if (typeof parseRoot === 'undefined') {
			return errors;
		}

		parseRoot.walkRules(nodeSelectorRegex, (rule) => {
			const node = {
				'-lint-line': 1,
				'-lint-column': 1,
				'-lint-name': '',
				'-lint-before': '',
				'-lint-after': ''
			};

			rule.walkDecls((decl) => {
				if (decl.prop === '-lint-line' || decl.prop === '-lint-column') {
					node[decl.prop] = Number(decl.value);
				} else if (
					decl.prop === '-lint-before' ||
					decl.prop === '-lint-after' ||
					decl.prop === '-lint-name'
				) {
					node[decl.prop] = String(JSON.parse(stripOuter(decl.value)));
				}
			});

			if (isUndefinedFunction(node['-lint-before'], node['-lint-after'])) {
				const baseFile = input.type === 'file' ? input.value : 'stdin';
				const resolvedFile = resolvePath(cwd, baseFile);
				const stackFile = resolveStackPath(baseFile);
				errors.push({
					file: resolvedFile,
					message: 'Undefined function.',
					stack: [
						`at root stylesheet (${stackFile}:${node['-lint-line']}:${node['-lint-column']})`
					],
					source: {
						start: {
							line: node['-lint-line'],
							column: node['-lint-column']
						},
						end: {
							line: node['-lint-line'],
							column: node['-lint-column'] + node['-lint-name'].length
						},
						pattern: node['-lint-name']
					},
					type: 'error'
				});
			}
		});
	} catch {
		// Fallthrough
	}
	return errors;
}

/**
 * @typedef {object} Options
 * @property {string[]} disallowedKnownCssFunctions Disallowed known CSS functions.
 * @property {string[]} additionalKnownCssFunctions Additional known CSS functions.
 */

/**
 * Create Sass undefined functions error renderer.
 *
 * @param {Sass}             sass      Sass module reference. _Only Dart Sass is supported_.
 * @param {Partial<Options>} [options] Additional options.
 */
export default function (sass, options) {
	const renderer = sassRenderer(sass);

	const { disallowedKnownCssFunctions = [], additionalKnownCssFunctions = [] } =
		/** @type {Options} */ (options ?? {});

	return {
		/**
		 * Returns `Promise` with array of undefined functions.
		 *
		 * Uses `sass.compile` for rendering.
		 *
		 * @param {string}           input   File to process.
		 * @param {SassSyncOptions=} options Sass options.
		 */
		compile: async (input, options) => {
			const knownCssFunctions = await composeKnownCssFunctions(
				disallowedKnownCssFunctions,
				additionalKnownCssFunctions
			);
			return getRenderResults(
				(input, defaultOptions) => {
					return renderer.compileString(input, {
						...defaultOptions,
						...options,
						functions: {
							...defaultOptions?.functions,
							...options?.functions
						},
						logger: sass.Logger.silent
					});
				},
				{ type: 'file', value: input },
				knownCssFunctions
			);
		},

		/**
		 * Returns `Promise` with array of undefined functions.
		 *
		 * Uses `sass.compileAsync` for rendering.
		 *
		 * @param {string}            input   File to process.
		 * @param {SassAsyncOptions=} options Sass options.
		 */
		compileAsync: async (input, options) => {
			const knownCssFunctions = await composeKnownCssFunctions(
				disallowedKnownCssFunctions,
				additionalKnownCssFunctions
			);
			return getRenderResults(
				(input, defaultOptions) => {
					return renderer.compileStringAsync(input, {
						...defaultOptions,
						...options,
						functions: {
							...defaultOptions?.functions,
							...options?.functions
						},
						logger: sass.Logger.silent
					});
				},
				{ type: 'file', value: input },
				knownCssFunctions
			);
		},

		/**
		 * Returns `Promise` with array of undefined functions.
		 *
		 * Uses `sass.compileString` for rendering.
		 *
		 * @param {string}                 input   String to process.
		 * @param {SassStringSyncOptions=} options Sass options.
		 */
		compileString: async (input, options) => {
			const knownCssFunctions = await composeKnownCssFunctions(
				disallowedKnownCssFunctions,
				additionalKnownCssFunctions
			);
			return getRenderResults(
				(input, defaultOptions) => {
					return renderer.compileString(input, {
						...defaultOptions,
						...options,
						functions: {
							...defaultOptions?.functions,
							...options?.functions
						},
						logger: sass.Logger.silent
					});
				},
				{ type: 'code', value: input },
				knownCssFunctions
			);
		},

		/**
		 * Returns `Promise` with array of undefined functions.
		 *
		 * Uses `sass.compileStringAsync` for rendering.
		 *
		 * @param {string}                  input   String to process.
		 * @param {SassStringAsyncOptions=} options Sass options.
		 */
		compileStringAsync: async (input, options) => {
			const knownCssFunctions = await composeKnownCssFunctions(
				disallowedKnownCssFunctions,
				additionalKnownCssFunctions
			);
			return getRenderResults(
				(input, defaultOptions) => {
					return renderer.compileStringAsync(input, {
						...defaultOptions,
						...options,
						functions: {
							...defaultOptions?.functions,
							...options?.functions
						},
						logger: sass.Logger.silent
					});
				},
				{ type: 'code', value: input },
				knownCssFunctions
			);
		}
	};
}
