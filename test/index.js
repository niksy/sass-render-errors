import path from 'path';
import assert from 'assert';
import sass from 'sass';
import renderErrors, { undefinedFunctions } from '../index';

/**
 * @typedef {import('../lib/render-errors').SassRenderError} SassRenderError
 */

/**
 * @param {SassRenderError[]} expected
 */
function resolveExpectedResults(expected) {
	return expected.map((entry) => {
		if (entry.file === 'stdin') {
			return entry;
		}
		return {
			...entry,
			file: path.resolve(__dirname, '..', entry.file),
			stack: entry.stack.map((string) =>
				string.replace(
					/\s\((.+?):/,
					(match, file) => ` (${path.resolve(__dirname, '..', file)}:`
				)
			)
		};
	});
}

describe('Render errors', function () {
	it('should handle errors', async function () {
		const renderer = renderErrors(sass);
		const [actualAsync, actualSync] = await Promise.all([
			renderer.render({
				file: './test/fixtures/errors.stylesheet-import.scss'
			}),
			renderer.renderSync({
				file: './test/fixtures/errors.stylesheet-import.scss'
			})
		]);
		const expected = resolveExpectedResults([
			{
				file: 'test/fixtures/errors.stylesheet-import.scss',
				message: "Can't find stylesheet to import.",
				stack: [
					'at root stylesheet (test/fixtures/errors.stylesheet-import.scss:2:1)'
				],
				source: {
					end: {
						column: 13,
						line: 2
					},
					pattern: "@use 'rocky'",
					start: {
						column: 1,
						line: 2
					}
				},
				type: 'error'
			}
		]);
		assert.deepEqual(actualAsync, expected);
		assert.deepEqual(actualSync, expected);
	});

	it('should handle errors for function declarations and invocations', async function () {
		const renderer = renderErrors(sass);
		const [actualAsync, actualSync] = await Promise.all([
			renderer.render({
				file: './test/fixtures/errors.function-declaration-invocation.scss'
			}),
			renderer.renderSync({
				file: './test/fixtures/errors.function-declaration-invocation.scss'
			})
		]);
		const expected = resolveExpectedResults([
			{
				file: 'test/fixtures/errors.function-declaration-invocation.scss',
				message: 'Only 0 arguments allowed, but 1 was passed.',
				stack: [
					'at nikki() (test/fixtures/errors.function-declaration-invocation.scss:6:9)',
					'at root stylesheet (test/fixtures/errors.function-declaration-invocation.scss:6:9)'
				],
				source: {
					end: {
						column: 17,
						line: 6
					},
					pattern: 'nikki(2)',
					start: {
						column: 9,
						line: 6
					}
				},
				type: 'error'
			}
		]);
		assert.deepEqual(actualAsync, expected);
		assert.deepEqual(actualSync, expected);
	});

	it('should handle partials', async function () {
		const renderer = renderErrors(sass);
		const [actualAsync, actualSync] = await Promise.all([
			renderer.render({
				file: './test/fixtures/_becky.scss'
			}),
			renderer.renderSync({
				file: './test/fixtures/_becky.scss'
			})
		]);
		const expected = resolveExpectedResults([
			{
				file: 'test/fixtures/_becky.scss',
				message:
					'Using / for division is deprecated and will be removed in Dart Sass 2.0.0. Recommendation: math.div(23, 43). More info and automated migrator: https://sass-lang.com/d/slash-div.',
				stack: ['at root stylesheet (test/fixtures/_becky.scss:2:20)'],
				source: {
					end: {
						column: 27,
						line: 2
					},
					pattern: '23 / 43',
					start: {
						column: 20,
						line: 2
					}
				},
				type: 'deprecation'
			}
		]);
		assert.deepEqual(actualAsync, expected);
		assert.deepEqual(actualSync, expected);
	});

	it('should handle errors from data string', async function () {
		const testCases = [
			{
				input: { data: '@use "rocky";' },
				/** @type {SassRenderError[]} */
				output: [
					{
						file: 'stdin',
						message: "Can't find stylesheet to import.",
						stack: ['at root stylesheet (stdin:1:1)'],
						source: {
							end: {
								column: 13,
								line: 1
							},
							pattern: '@use "rocky"',
							start: {
								column: 1,
								line: 1
							}
						},
						type: 'error'
					}
				]
			},
			{
				input: { data: 'body {color: color.invert(1);}' },
				/** @type {SassRenderError[]} */
				output: [
					{
						file: 'stdin',
						message:
							'There is no module with the namespace "color".',
						stack: ['at root stylesheet (stdin:1:14)'],
						source: {
							end: {
								column: 29,
								line: 1
							},
							pattern: 'color.invert(1)',
							start: {
								column: 14,
								line: 1
							}
						},
						type: 'error'
					}
				]
			}
		];

		await Promise.all(
			testCases.map(async (testCase) => {
				const renderer = renderErrors(sass);
				const [actualAsync, actualSync] = await Promise.all([
					renderer.render(testCase.input),
					renderer.renderSync(testCase.input)
				]);
				const expected = resolveExpectedResults(testCase.output);
				assert.deepEqual(actualAsync, expected);
				assert.deepEqual(actualSync, expected);
			})
		);
	});

	it('should handle deprecations', async function () {
		const renderer = renderErrors(sass);
		const [actualAsync, actualSync] = await Promise.all([
			renderer.render({
				file: './test/fixtures/deprecations.scss',
				includePaths: ['./test/fixtures/phoebe']
			}),
			renderer.renderSync({
				file: './test/fixtures/deprecations.scss',
				includePaths: ['./test/fixtures/phoebe']
			})
		]);
		const expected = resolveExpectedResults([
			{
				file: 'test/fixtures/_becky.scss',
				source: {
					start: { line: 2, column: 20 },
					end: { line: 2, column: 27 },
					pattern: '23 / 43'
				},
				message:
					'Using / for division is deprecated and will be removed in Dart Sass 2.0.0. Recommendation: math.div(23, 43). More info and automated migrator: https://sass-lang.com/d/slash-div.',
				type: 'deprecation',
				stack: [
					'at @use (test/fixtures/_becky.scss:2:20)',
					'at root stylesheet (test/fixtures/deprecations.scss:2:1)'
				]
			},
			{
				file: 'test/fixtures/phoebe/_tyson.scss',
				source: {
					start: { line: 2, column: 20 },
					end: { line: 2, column: 27 },
					pattern: '23 / 43'
				},
				message:
					'Using / for division is deprecated and will be removed in Dart Sass 2.0.0. Recommendation: math.div(23, 43). More info and automated migrator: https://sass-lang.com/d/slash-div.',
				type: 'deprecation',
				stack: [
					'at @use (test/fixtures/phoebe/_tyson.scss:2:20)',
					'at root stylesheet (test/fixtures/deprecations.scss:3:1)'
				]
			},
			{
				file: 'test/fixtures/deprecations.scss',
				source: {
					start: { line: 7, column: 1 },
					end: { line: 7, column: 24 },
					pattern: '$benny: winston !global'
				},
				message:
					"As of Dart Sass 2.0.0, !global assignments won't be able to declare new variables. Since this assignment is at the root of the stylesheet, the !global flag is. Unnecessary and can safely be removed.",
				type: 'deprecation',
				stack: [
					'at root stylesheet (test/fixtures/deprecations.scss:7:1)'
				]
			},
			{
				file: 'test/fixtures/deprecations.scss',
				source: {
					start: { line: 14, column: 20 },
					end: { line: 14, column: 25 },
					pattern: '1 / 2'
				},
				message:
					'Using / for division is deprecated and will be removed in Dart Sass 2.0.0. Recommendation: math.div(1, 2). More info and automated migrator: https://sass-lang.com/d/slash-div.',
				type: 'deprecation',
				stack: [
					'at root stylesheet (test/fixtures/deprecations.scss:14:20)'
				]
			},
			{
				file: 'test/fixtures/deprecations.scss',
				source: {
					start: { line: 15, column: 20 },
					end: { line: 15, column: 25 },
					pattern: '1 / 3'
				},
				message:
					'Using / for division is deprecated and will be removed in Dart Sass 2.0.0. Recommendation: math.div(1, 3). More info and automated migrator: https://sass-lang.com/d/slash-div.',
				type: 'deprecation',
				stack: [
					'at root stylesheet (test/fixtures/deprecations.scss:15:20)'
				]
			},
			{
				file: 'test/fixtures/deprecations.scss',
				source: {
					start: { line: 16, column: 20 },
					end: { line: 16, column: 25 },
					pattern: '1 / 4'
				},
				message:
					'Using / for division is deprecated and will be removed in Dart Sass 2.0.0. Recommendation: math.div(1, 4). More info and automated migrator: https://sass-lang.com/d/slash-div.',
				type: 'deprecation',
				stack: [
					'at root stylesheet (test/fixtures/deprecations.scss:16:20)'
				]
			},
			{
				file: 'test/fixtures/deprecations.scss',
				source: {
					start: { line: 17, column: 20 },
					end: { line: 17, column: 25 },
					pattern: '1 / 5'
				},
				message:
					'Using / for division is deprecated and will be removed in Dart Sass 2.0.0. Recommendation: math.div(1, 5). More info and automated migrator: https://sass-lang.com/d/slash-div.',
				type: 'deprecation',
				stack: [
					'at root stylesheet (test/fixtures/deprecations.scss:17:20)'
				]
			},
			{
				file: 'test/fixtures/deprecations.scss',
				source: {
					start: { line: 18, column: 20 },
					end: { line: 18, column: 25 },
					pattern: '1 / 6'
				},
				message:
					'Using / for division is deprecated and will be removed in Dart Sass 2.0.0. Recommendation: math.div(1, 6). More info and automated migrator: https://sass-lang.com/d/slash-div.',
				type: 'deprecation',
				stack: [
					'at root stylesheet (test/fixtures/deprecations.scss:18:20)'
				]
			},
			{
				file: 'test/fixtures/deprecations.scss',
				source: {
					start: { line: 19, column: 19 },
					end: { line: 19, column: 24 },
					pattern: '1 / 7'
				},
				message:
					'Using / for division is deprecated and will be removed in Dart Sass 2.0.0. Recommendation: math.div(1, 7). More info and automated migrator: https://sass-lang.com/d/slash-div.',
				type: 'deprecation',
				stack: [
					'at root stylesheet (test/fixtures/deprecations.scss:19:19)'
				]
			},
			{
				file: 'test/fixtures/deprecations.scss',
				source: {
					start: { line: 20, column: 20 },
					end: { line: 20, column: 25 },
					pattern: '1 / 8'
				},
				message:
					'Using / for division is deprecated and will be removed in Dart Sass 2.0.0. Recommendation: math.div(1, 8). More info and automated migrator: https://sass-lang.com/d/slash-div.',
				type: 'deprecation',
				stack: [
					'at root stylesheet (test/fixtures/deprecations.scss:20:20)'
				]
			},
			{
				file: 'test/fixtures/deprecations.scss',
				source: {
					start: { line: 21, column: 20 },
					end: { line: 21, column: 25 },
					pattern: '1 / 9'
				},
				message:
					'Using / for division is deprecated and will be removed in Dart Sass 2.0.0. Recommendation: math.div(1, 9). More info and automated migrator: https://sass-lang.com/d/slash-div.',
				type: 'deprecation',
				stack: [
					'at root stylesheet (test/fixtures/deprecations.scss:21:20)'
				]
			},
			{
				file: 'test/fixtures/deprecations.scss',
				source: {
					start: { line: 22, column: 20 },
					end: { line: 22, column: 26 },
					pattern: '1 / 10'
				},
				message:
					'Using / for division is deprecated and will be removed in Dart Sass 2.0.0. Recommendation: math.div(1, 10). More info and automated migrator: https://sass-lang.com/d/slash-div.',
				type: 'deprecation',
				stack: [
					'at root stylesheet (test/fixtures/deprecations.scss:22:20)'
				]
			},
			{
				file: 'test/fixtures/deprecations.scss',
				source: {
					start: { line: 23, column: 20 },
					end: { line: 23, column: 32 },
					pattern: '$riley / 999'
				},
				message:
					'Using / for division is deprecated and will be removed in Dart Sass 2.0.0. Recommendation: math.div($riley, 999). More info and automated migrator: https://sass-lang.com/d/slash-div.',
				type: 'deprecation',
				stack: [
					'at root stylesheet (test/fixtures/deprecations.scss:23:20)'
				]
			},
			{
				file: 'test/fixtures/deprecations.scss',
				source: {
					start: { line: 24, column: 9 },
					end: { line: 24, column: 24 },
					pattern: 'color.invert(1)'
				},
				message:
					'Passing a number (1) to color.invert() is deprecated. Recommendation: invert(1).',
				type: 'deprecation',
				stack: [
					'at root stylesheet (test/fixtures/deprecations.scss:24:9)'
				]
			},
			{
				file: 'test/fixtures/deprecations.scss',
				source: {
					start: { line: 25, column: 9 },
					end: { line: 25, column: 21 },
					pattern: 'call(willow)'
				},
				message:
					'Passing a string to call() is deprecated and will be illegal in Dart Sass 2.0.0. Recommendation: call(get-function(willow)).',
				type: 'deprecation',
				stack: [
					'at root stylesheet (test/fixtures/deprecations.scss:25:9)'
				]
			},
			{
				file: 'test/fixtures/deprecations.scss',
				source: {
					start: { line: 28, column: 4 },
					end: { line: 28, column: 11 },
					pattern: '@elseif'
				},
				message:
					'@elseif is deprecated and will not be supported in future Sass versions. Recommendation: @else if.',
				type: 'deprecation',
				stack: [
					'at root stylesheet (test/fixtures/deprecations.scss:28:4)'
				]
			}
		]);
		assert.deepEqual(actualAsync, expected);
		assert.deepEqual(actualSync, expected);
	});
});

describe('Undefined functions', function () {
	it('should handle errors', async function () {
		const renderer = undefinedFunctions(sass);
		const [actualAsync, actualSync] = await Promise.all([
			renderer.render({
				file: './test/fixtures/errors.undefined-functions.scss'
			}),
			renderer.renderSync({
				file: './test/fixtures/errors.undefined-functions.scss'
			})
		]);
		const expected = resolveExpectedResults([
			{
				file: 'test/fixtures/errors.undefined-functions.scss',
				message: 'Undefined function.',
				stack: [
					'at root stylesheet (test/fixtures/errors.undefined-functions.scss:11:9)'
				],
				source: {
					end: {
						column: 14,
						line: 11
					},
					pattern: 'becky',
					start: {
						column: 9,
						line: 11
					}
				},
				type: 'error'
			},
			{
				file: 'test/fixtures/errors.undefined-functions.scss',
				message: 'Undefined function.',
				stack: [
					'at root stylesheet (test/fixtures/errors.undefined-functions.scss:13:16)'
				],
				source: {
					end: {
						column: 22,
						line: 13
					},
					pattern: 'harley',
					start: {
						column: 16,
						line: 13
					}
				},
				type: 'error'
			},
			{
				file: 'test/fixtures/errors.undefined-functions.scss',
				message: 'Undefined function.',
				stack: [
					'at root stylesheet (test/fixtures/errors.undefined-functions.scss:16:11)'
				],
				source: {
					end: {
						column: 17,
						line: 16
					},
					pattern: 'harley',
					start: {
						column: 11,
						line: 16
					}
				},
				type: 'error'
			},
			{
				file: 'test/fixtures/errors.undefined-functions.scss',
				message: 'Undefined function.',
				stack: [
					'at root stylesheet (test/fixtures/errors.undefined-functions.scss:18:10)'
				],
				source: {
					end: {
						column: 14,
						line: 18
					},
					pattern: 'oreo',
					start: {
						column: 10,
						line: 18
					}
				},
				type: 'error'
			},
			{
				file: 'test/fixtures/errors.undefined-functions.scss',
				message: 'Undefined function.',
				stack: [
					'at root stylesheet (test/fixtures/errors.undefined-functions.scss:20:19)'
				],
				source: {
					end: {
						column: 23,
						line: 20
					},
					pattern: 'kona',
					start: {
						column: 19,
						line: 20
					}
				},
				type: 'error'
			}
		]);
		assert.deepEqual(actualAsync, expected);
		assert.deepEqual(actualSync, expected);
	});

	it('should handle errors from data string', async function () {
		const testCases = [
			{
				input: { data: 'body { color: becky(#f00); }' },
				/** @type {SassRenderError[]} */
				output: [
					{
						file: 'stdin',
						message: 'Undefined function.',
						stack: ['at root stylesheet (stdin:1:15)'],
						source: {
							end: {
								column: 20,
								line: 1
							},
							pattern: 'becky',
							start: {
								column: 15,
								line: 1
							}
						},
						type: 'error'
					}
				]
			}
		];

		await Promise.all(
			testCases.map(async (testCase) => {
				const renderer = undefinedFunctions(sass);
				const [actualAsync, actualSync] = await Promise.all([
					renderer.render(testCase.input),
					renderer.renderSync(testCase.input)
				]);
				const expected = resolveExpectedResults(testCase.output);
				assert.deepEqual(actualAsync, expected);
				assert.deepEqual(actualSync, expected);
			})
		);
	});
});

describe('All implementations', function () {
	it('should handle errors', async function () {
		const rendererErrors = renderErrors(sass);
		const rendererUndefinedFunctions = undefinedFunctions(sass);
		const actualAsync = await Promise.all([
			rendererUndefinedFunctions.render({
				file: './test/fixtures/deprecations.all.scss'
			}),
			rendererErrors.render({
				file: './test/fixtures/deprecations.all.scss'
			})
		]);
		const actualSync = await Promise.all([
			rendererUndefinedFunctions.renderSync({
				file: './test/fixtures/deprecations.all.scss'
			}),
			rendererErrors.renderSync({
				file: './test/fixtures/deprecations.all.scss'
			})
		]);
		const expected = resolveExpectedResults([
			{
				file: 'test/fixtures/deprecations.all.scss',
				message: 'Undefined function.',
				stack: [
					'at root stylesheet (test/fixtures/deprecations.all.scss:9:9)'
				],
				source: {
					end: {
						column: 14,
						line: 9
					},
					pattern: 'becky',
					start: {
						column: 9,
						line: 9
					}
				},
				type: 'error'
			},
			{
				file: 'test/fixtures/deprecations.all.scss',
				message: 'Undefined function.',
				stack: [
					'at root stylesheet (test/fixtures/deprecations.all.scss:14:11)'
				],
				source: {
					end: {
						column: 17,
						line: 14
					},
					pattern: 'harley',
					start: {
						column: 11,
						line: 14
					}
				},
				type: 'error'
			},
			{
				file: 'test/fixtures/deprecations.all.scss',
				message:
					'Using / for division is deprecated and will be removed in Dart Sass 2.0.0. Recommendation: math.div(100, 2). More info and automated migrator: https://sass-lang.com/d/slash-div.',
				stack: [
					'at root stylesheet (test/fixtures/deprecations.all.scss:12:24)'
				],
				source: {
					end: {
						column: 31,
						line: 12
					},
					pattern: '100 / 2',
					start: {
						column: 24,
						line: 12
					}
				},
				type: 'deprecation'
			}
		]);

		/** @type {SassRenderError[]} */
		const asyncResults = [];
		/** @type {SassRenderError[]} */
		const syncResults = [];

		assert.deepEqual(asyncResults.concat(...actualAsync), expected);
		assert.deepEqual(syncResults.concat(...actualSync), expected);
	});

	it('should handle errors from data string', async function () {
		const testCases = [
			{
				input: {
					data: 'body { color: becky(#f00); min-width: percentage(100 / 2); }'
				},
				/** @type {SassRenderError[]} */
				output: [
					{
						file: 'stdin',
						message: 'Undefined function.',
						stack: ['at root stylesheet (stdin:1:15)'],
						source: {
							end: {
								column: 20,
								line: 1
							},
							pattern: 'becky',
							start: {
								column: 15,
								line: 1
							}
						},
						type: 'error'
					},
					{
						file: 'stdin',
						message:
							'Using / for division is deprecated and will be removed in Dart Sass 2.0.0. Recommendation: math.div(100, 2). More info and automated migrator: https://sass-lang.com/d/slash-div.',
						stack: ['at root stylesheet (stdin:1:50)'],
						source: {
							end: {
								column: 57,
								line: 1
							},
							pattern: '100 / 2',
							start: {
								column: 50,
								line: 1
							}
						},
						type: 'deprecation'
					}
				]
			}
		];

		await Promise.all(
			testCases.map(async (testCase) => {
				const rendererErrors = renderErrors(sass);
				const rendererUndefinedFunctions = undefinedFunctions(sass);
				const actualAsync = await Promise.all([
					rendererUndefinedFunctions.render(testCase.input),
					rendererErrors.render(testCase.input)
				]);
				const actualSync = await Promise.all([
					rendererUndefinedFunctions.renderSync(testCase.input),
					rendererErrors.renderSync(testCase.input)
				]);
				const expected = resolveExpectedResults(testCase.output);

				/** @type {SassRenderError[]} */
				const asyncResults = [];
				/** @type {SassRenderError[]} */
				const syncResults = [];

				assert.deepEqual(asyncResults.concat(...actualAsync), expected);
				assert.deepEqual(syncResults.concat(...actualSync), expected);
			})
		);
	});
});
