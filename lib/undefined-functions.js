/* eslint-disable no-undefined */

import { promises as fs } from 'fs';
import postcss from 'postcss';
import postcssScss from 'postcss-scss';
import parse from 'postcss-value-parser';
import { customAlphabet } from 'nanoid';
import cssFunctionsList from 'css-functions-list';
// @ts-ignore
import jsonFns from 'node-sass-json-functions';
import sassRenderer from './sass-render';
import consoleOutputFactory from './console-output';
import { resolvePath } from './util';

/**
 * @typedef {import('sass')} Sass
 * @typedef {import('sass').SassException} SassException
 * @typedef {import('sass').Result} SassResult
 * @typedef {import('../types').Options} SassOptions
 * @typedef {import('../types').SassRenderError} SassRenderError
 * @typedef {import('./sass-render').SassRenderer} SassRenderer
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
const atRulesToCheck =
	/import|use|forward|return|debug|warn|error|at-root|if|else|media/;
const interpolationPrefix = /^#{\s*/m;

/** @type {string[]?} */
let knownCssFunctions = null;

const jsonEncodeFunctionKey = 'json-encode($value, $quotes: true)';

const noop = postcss.plugin('noop', () => () => {});

const cssProcessor = postcss([noop()]);

/**
 * @param {ChildNode} rootNode
 */
function getParsedFunctionNodes(rootNode) {
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
		if (knownCssFunctions?.includes(node.value)) {
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
		});
	});

	return [...new Set(matchingPairs)].length === 1;
}

/**
 * @param {SassRenderer} renderer
 * @param {SassOptions}  options  Sass options.
 */
async function getRenderResults(renderer, options) {
	/** @type {SassRenderError[]} */
	const errors = [];
	const cwd = process.cwd();

	const consoleOutputQueue = consoleOutputFactory();

	try {
		const id = generateId();
		const nodeSelector = `lint-node-${id}`;
		const nodeSelectorRegex = new RegExp(nodeSelector);

		const { file: baseFile = '', data: baseData = '' } = options;

		let inputCssString;
		if (baseFile !== '') {
			inputCssString = await fs.readFile(baseFile, 'utf8');
		} else {
			inputCssString = baseData;
		}

		if (knownCssFunctions === null) {
			knownCssFunctions = JSON.parse(
				await fs.readFile(cssFunctionsList, 'utf8')
			);
		}

		const initialParseResponse = await cssProcessor.process(
			inputCssString,
			{
				/*
				 * Incompatible types fixed in PostCSS 8
				 */
				// @ts-ignore
				syntax: postcssScss,
				from: undefined
			}
		);
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
				const parsedFunctionNodes = getParsedFunctionNodes(atRule);
				parsedFunctionNodes.forEach((functionNode) => {
					functionNodes.push(functionNode);
				});
			}
		});

		initialParseRoot.walkDecls((decl) => {
			const parsedFunctionNodes = getParsedFunctionNodes(decl);
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

		/** @type {SassOptions} */
		const renderOptions = {
			...options,
			data: initialParseRoot.toString(),
			functions: {
				...(options.functions ?? {}),
				[`${id}${jsonEncodeFunctionKey}`]:
					jsonFns[jsonEncodeFunctionKey]
			},
			verbose: true
		};

		const sassRenderResponse = await consoleOutputQueue.add(() =>
			renderer(renderOptions)
		);

		await consoleOutputQueue.value();

		const parseResponse = await cssProcessor.process(
			sassRenderResponse.css.toString(),
			{
				from: undefined
			}
		);
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
				if (
					decl.prop === '-lint-line' ||
					decl.prop === '-lint-column'
				) {
					node[decl.prop] = Number(decl.value);
				} else if (
					decl.prop === '-lint-before' ||
					decl.prop === '-lint-after' ||
					decl.prop === '-lint-name'
				) {
					node[decl.prop] = String(JSON.parse(decl.value));
				}
			});

			if (
				isUndefinedFunction(node['-lint-before'], node['-lint-after'])
			) {
				const resolvedFile = resolvePath(cwd, baseFile);
				errors.push({
					file: resolvedFile,
					message: 'Undefined function.',
					detail: node['-lint-before'],
					stack: [
						`at root stylesheet (${resolvedFile}:${node['-lint-line']}:${node['-lint-column']})`
					],
					source: {
						start: {
							line: node['-lint-line'],
							column: node['-lint-column']
						},
						end: {
							line: node['-lint-line'],
							column:
								node['-lint-column'] + node['-lint-name'].length
						},
						pattern: node['-lint-name']
					},
					type: 'error'
				});
			}
		});
	} catch {
		// Fallthrough
	} finally {
		await consoleOutputQueue.completed();
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
 * Create Sass undefined functions error renderer.
 *
 * @param {Sass} sass Sass module reference. _Only Dart Sass is supported_.
 */
export default function (sass) {
	const { render: asyncRenderer, renderSync: syncRenderer } =
		sassRenderer(sass);

	return {
		/**
		 * Returns `Promise` with array of undefined functions.
		 *
		 * Uses `sass.render` for rendering.
		 *
		 * @param {SassOptions} options Sass options.
		 */
		render: getRenderResults.bind(null, asyncRenderer),

		/**
		 * Returns `Promise` with array of undefined functions.
		 *
		 * Uses `sass.renderSync` for rendering.
		 *
		 * @param {SassOptions} options Sass options.
		 */
		renderSync: getRenderResults.bind(null, syncRenderer)
	};
}
