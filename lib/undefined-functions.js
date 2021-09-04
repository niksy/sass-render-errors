/* eslint-disable no-undefined */

import { promises as fs } from 'fs';
import path from 'path';
import postcss from 'postcss';
import postcssScss from 'postcss-scss';
import parse from 'postcss-value-parser';
import { customAlphabet } from 'nanoid';
import cssFunctionsList from 'css-functions-list';
// @ts-ignore
import jsonFns from 'node-sass-json-functions';
import sassRenderer from './sass-render';
import consoleOutputFactory from './console-output';

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
const atRulesToCheck = /return|debug|warn|error|at-root|if|media/;

/** @type {string[]?} */
let knownCssFunctions = null;

const jsonEncodeFunctionKey = 'json-encode($value, $quotes: true)';
const sassFunctions = {
	[`__${jsonEncodeFunctionKey}`]: jsonFns[jsonEncodeFunctionKey]
};

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
		if (node.type !== 'function') {
			return;
		}
		if (knownCssFunctions?.includes(node.value)) {
			return;
		}

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
		const nodeSelector = `node_${id}`;
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

		functionNodes.forEach((functionNode) => {
			const properties = {
				selector: `.${nodeSelector}`,
				nodes: [
					{
						prop: 'line',
						value: String(functionNode.line)
					},
					{
						prop: 'column',
						value: String(functionNode.column)
					},
					{
						prop: 'name',
						value: JSON.stringify(functionNode.name)
					},
					{
						prop: 'input',
						value: `__json-encode(${functionNode.input}, $quotes: false)`
					},
					{
						prop: 'output',
						value: JSON.stringify(`${id}${functionNode.input}`)
					}
				]
			};
			functionNode.node.after(properties);
		});

		/** @type {SassOptions} */
		const renderOptions = {
			...options,
			data: initialParseRoot.toString(),
			functions: sassFunctions,
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
				line: 1,
				column: 1,
				name: '',
				input: '',
				output: ''
			};

			rule.walkDecls((decl) => {
				if (decl.prop === 'line' || decl.prop === 'column') {
					node[decl.prop] = Number(decl.value);
				} else if (decl.prop === 'output') {
					node.output = JSON.parse(decl.value).replace(id, '');
				} else if (decl.prop === 'input') {
					node.input = JSON.parse(decl.value);
				} else if (decl.prop === 'name') {
					node.name = JSON.parse(decl.value);
				}
			});

			if (node.input === node.output) {
				errors.push({
					file:
						baseFile !== '' ? path.resolve(cwd, baseFile) : 'stdin',
					message: 'Undefined function.',
					source: {
						start: {
							line: node.line,
							column: node.column
						},
						end: {
							line: node.line,
							column: node.column + node.name.length
						},
						pattern: node.name
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

	return errors;
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
