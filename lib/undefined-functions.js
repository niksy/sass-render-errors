/* eslint-disable no-undefined */

import { promises as fs } from 'fs';
import path from 'path';
import postcss from 'postcss';
import postcssScss from 'postcss-scss';
import parse from 'postcss-value-parser';
import hookStd from 'hook-std';
import { customAlphabet } from 'nanoid';
import cssFunctionsList from 'css-functions-list';
import sassRenderer from './sass-render';

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
 * @typedef {import('postcss').ChildProps} ChildProps
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

/** @type {string[]?} */
let knownCssFunctions = null;

const noop = () => ({
	postcssPlugin: '_noop'
});

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
	const consoleOutput = [''];
	/** @type {SassRenderError[]} */
	const errors = [];
	const cwd = process.cwd();

	const consoleOutputPromise = hookStd.stderr((output) => {
		consoleOutput.push(output);
	});

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
				syntax: postcssScss,
				from: undefined
			}
		);
		const initialParseRoot = initialParseResponse.root;

		/** @type {ParseResult[]} */
		const functionNodes = [];

		initialParseRoot.walkAtRules(/return|debug/, (atRule) => {
			const parsedFunctionNodes = getParsedFunctionNodes(atRule);
			parsedFunctionNodes.forEach((functionNode) => {
				functionNodes.push(functionNode);
			});
		});

		initialParseRoot.walkDecls((decl) => {
			const parsedFunctionNodes = getParsedFunctionNodes(decl);
			parsedFunctionNodes.forEach((functionNode) => {
				functionNodes.push(functionNode);
			});
		});

		functionNodes.forEach((functionNode) => {
			/** @type {ChildProps} */
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
						value: functionNode.name
					},
					{
						prop: 'input',
						value: functionNode.input
					},
					{
						prop: 'output',
						value: `${id}${functionNode.input}`
					}
				]
			};
			functionNode.node.after(properties);
		});

		/** @type {SassOptions} */
		const renderOptions = {
			...options,
			data: initialParseRoot.toString(),
			verbose: true
		};

		const sassRenderResponse = await renderer(renderOptions);

		const parseResponse = await cssProcessor.process(
			sassRenderResponse.css.toString(),
			{
				from: undefined
			}
		);
		const parseRoot = parseResponse.root;

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
					node[decl.prop] = decl.value.replace(id, '');
				} else if (decl.prop === 'input' || decl.prop === 'name') {
					node[decl.prop] = decl.value;
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
	} finally {
		consoleOutputPromise.unhook();
	}

	try {
		await consoleOutputPromise;
	} catch {
		// Handled
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
