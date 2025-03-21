/* eslint-disable unicorn/prefer-spread, max-lines, n/no-sync */

import assert from 'node:assert';
import { fileURLToPath } from 'node:url';
import sass from 'sass';
import renderErrors, { undefinedFunctions } from '../index.js';

/**
 * @typedef {import('../lib/render-errors.js').SassRenderError} SassRenderError
 * @typedef {{input: string, output: SassRenderError[]}} StringTestCase
 */

/**
 * @param {SassRenderError[]} expected
 */
function resolveExpectedResults(expected) {
	return expected.map((entry) => {
		const file = entry.file;
		return {
			...entry,
			file: file === 'stdin' ? 'stdin' : fileURLToPath(new URL(`../${file}`, import.meta.url))
		};
	});
}

describe('Render errors', function () {
	it('should handle errors', async function () {
		const renderer = renderErrors(sass);
		const [actualAsync, actualSync] = await Promise.all([
			renderer.compileAsync('./test/fixtures/errors.stylesheet-import.scss'),
			renderer.compile('./test/fixtures/errors.stylesheet-import.scss')
		]);
		const expected = resolveExpectedResults([
			{
				file: 'test/fixtures/errors.stylesheet-import.scss',
				message:
					'@elseif is deprecated and will not be supported in future Sass versions. Recommendation: @else if.',
				source: {
					start: {
						column: 4,
						line: 27
					},
					end: {
						column: 11,
						line: 27
					},
					pattern: '@elseif'
				},
				stack: ['at root stylesheet (test/fixtures/errors.stylesheet-import.scss:27:4)'],
				type: 'deprecation'
			},
			{
				file: 'test/fixtures/errors.stylesheet-import.scss',
				message: "Can't find stylesheet to import.",
				stack: ['at root stylesheet (test/fixtures/errors.stylesheet-import.scss:2:1)'],
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
			renderer.compileAsync('./test/fixtures/errors.function-declaration-invocation.scss'),
			renderer.compile('./test/fixtures/errors.function-declaration-invocation.scss')
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

	it('should handle errors for function missing arguments', async function () {
		const renderer = renderErrors(sass);
		const [actualAsync, actualSync] = await Promise.all([
			renderer.compileAsync('./test/fixtures/errors.function-missing-arguments.scss'),
			renderer.compile('./test/fixtures/errors.function-missing-arguments.scss')
		]);
		const expected = resolveExpectedResults([
			{
				file: 'test/fixtures/errors.function-missing-arguments.scss',
				message: 'Missing argument $number2.',
				stack: [
					'at root stylesheet (test/fixtures/errors.function-missing-arguments.scss:4:9)'
				],
				source: {
					end: {
						column: 20,
						line: 4
					},
					pattern: 'math.div(2)',
					start: {
						column: 9,
						line: 4
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
			renderer.compileAsync('./test/fixtures/_becky.scss'),
			renderer.compile('./test/fixtures/_becky.scss')
		]);
		const expected = resolveExpectedResults([
			{
				file: 'test/fixtures/_becky.scss',
				message:
					'Using / for division is deprecated and will be removed in Dart Sass 2.0.0. Recommendation: math.div(23, 43). More info and automated migrator: https://sass-lang.com/d/slash-div.',
				stack: ['at root stylesheet (test/fixtures/_becky.scss:5:25)'],
				source: {
					end: {
						column: 32,
						line: 5
					},
					pattern: '23 / 43',
					start: {
						column: 25,
						line: 5
					}
				},
				type: 'deprecation'
			}
		]);
		assert.deepEqual(actualAsync, expected);
		assert.deepEqual(actualSync, expected);
	});

	it('should handle errors from data string', async function () {
		/** @type {StringTestCase[]} */
		const testCases = [
			{
				input: '@use "rocky";',
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
				input: 'body {color: color.invert(1);}',
				output: [
					{
						file: 'stdin',
						message: 'There is no module with the namespace "color".',
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
					renderer.compileStringAsync(testCase.input),
					renderer.compileString(testCase.input)
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
			renderer.compileAsync('./test/fixtures/deprecations.scss', {
				loadPaths: ['./test/fixtures/phoebe']
			}),
			renderer.compile('./test/fixtures/deprecations.scss', {
				loadPaths: ['./test/fixtures/phoebe']
			})
		]);
		const expected = resolveExpectedResults([
			{
				file: 'test/fixtures/deprecations.scss',
				message:
					'@elseif is deprecated and will not be supported in future Sass versions. Recommendation: @else if.',
				stack: ['at root stylesheet (test/fixtures/deprecations.scss:28:4)'],
				source: {
					start: {
						column: 4,
						line: 28
					},
					end: {
						column: 11,
						line: 28
					},
					pattern: '@elseif'
				},
				type: 'deprecation'
			},
			{
				file: 'test/fixtures/_becky.scss',
				message:
					'Using / for division is deprecated and will be removed in Dart Sass 2.0.0. Recommendation: math.div(23, 43). More info and automated migrator: https://sass-lang.com/d/slash-div.',
				stack: [
					'at @use (test/fixtures/_becky.scss:5:25)',
					'at root stylesheet (test/fixtures/deprecations.scss:2:1)'
				],
				source: {
					start: { line: 5, column: 25 },
					end: { line: 5, column: 32 },
					pattern: '23 / 43'
				},
				type: 'deprecation'
			},
			{
				file: 'test/fixtures/phoebe/_tyson.scss',
				message:
					'Using / for division is deprecated and will be removed in Dart Sass 2.0.0. Recommendation: math.div(23, 43). More info and automated migrator: https://sass-lang.com/d/slash-div.',
				stack: [
					'at @use (_tyson.scss:2:20)',
					'at root stylesheet (test/fixtures/deprecations.scss:3:1)'
				],
				source: {
					start: { line: 2, column: 20 },
					end: { line: 2, column: 27 },
					pattern: '23 / 43'
				},
				type: 'deprecation'
			},
			{
				file: 'test/fixtures/phoebe/_tyson.scss',
				message:
					'Global built-in functions are deprecated and will be removed in Dart Sass 3.0.0. Use math.percentage instead. More info and automated migrator: https://sass-lang.com/d/import.',
				stack: [
					'at @use (_tyson.scss:2:9)',
					'at root stylesheet (test/fixtures/deprecations.scss:3:1)'
				],
				source: {
					start: { line: 2, column: 9 },
					end: { line: 2, column: 28 },
					pattern: 'percentage(23 / 43)'
				},
				type: 'deprecation'
			},
			{
				file: 'test/fixtures/deprecations.scss',
				message:
					"As of Dart Sass 2.0.0, !global assignments won't be able to declare new variables. Since this assignment is at the root of the stylesheet, the !global flag is. Unnecessary and can safely be removed.",
				stack: ['at root stylesheet (test/fixtures/deprecations.scss:7:1)'],
				source: {
					start: { line: 7, column: 1 },
					end: { line: 7, column: 24 },
					pattern: '$benny: winston !global'
				},
				type: 'deprecation'
			},
			{
				file: 'test/fixtures/deprecations.scss',
				message:
					'Using / for division is deprecated and will be removed in Dart Sass 2.0.0. Recommendation: math.div(1, 2). More info and automated migrator: https://sass-lang.com/d/slash-div.',
				stack: ['at root stylesheet (test/fixtures/deprecations.scss:14:20)'],
				source: {
					start: { line: 14, column: 20 },
					end: { line: 14, column: 25 },
					pattern: '1 / 2'
				},
				type: 'deprecation'
			},
			{
				file: 'test/fixtures/deprecations.scss',
				message:
					'Global built-in functions are deprecated and will be removed in Dart Sass 3.0.0. Use math.percentage instead. More info and automated migrator: https://sass-lang.com/d/import.',
				stack: ['at root stylesheet (test/fixtures/deprecations.scss:14:9)'],
				source: {
					start: { line: 14, column: 9 },
					end: { line: 14, column: 26 },
					pattern: 'percentage(1 / 2)'
				},
				type: 'deprecation'
			},
			{
				file: 'test/fixtures/deprecations.scss',
				message:
					'Using / for division is deprecated and will be removed in Dart Sass 2.0.0. Recommendation: math.div(1, 3). More info and automated migrator: https://sass-lang.com/d/slash-div.',
				stack: ['at root stylesheet (test/fixtures/deprecations.scss:15:20)'],
				source: {
					start: { line: 15, column: 20 },
					end: { line: 15, column: 25 },
					pattern: '1 / 3'
				},
				type: 'deprecation'
			},
			{
				file: 'test/fixtures/deprecations.scss',
				message:
					'Global built-in functions are deprecated and will be removed in Dart Sass 3.0.0. Use math.percentage instead. More info and automated migrator: https://sass-lang.com/d/import.',
				stack: ['at root stylesheet (test/fixtures/deprecations.scss:15:9)'],
				source: {
					start: { line: 15, column: 9 },
					end: { line: 15, column: 26 },
					pattern: 'percentage(1 / 3)'
				},
				type: 'deprecation'
			},
			{
				file: 'test/fixtures/deprecations.scss',
				message:
					'Using / for division is deprecated and will be removed in Dart Sass 2.0.0. Recommendation: math.div(1, 4). More info and automated migrator: https://sass-lang.com/d/slash-div.',
				stack: ['at root stylesheet (test/fixtures/deprecations.scss:16:20)'],
				source: {
					start: { line: 16, column: 20 },
					end: { line: 16, column: 25 },
					pattern: '1 / 4'
				},
				type: 'deprecation'
			},
			{
				file: 'test/fixtures/deprecations.scss',
				message:
					'Global built-in functions are deprecated and will be removed in Dart Sass 3.0.0. Use math.percentage instead. More info and automated migrator: https://sass-lang.com/d/import.',
				stack: ['at root stylesheet (test/fixtures/deprecations.scss:16:9)'],
				source: {
					start: { line: 16, column: 9 },
					end: { line: 16, column: 26 },
					pattern: 'percentage(1 / 4)'
				},
				type: 'deprecation'
			},
			{
				file: 'test/fixtures/deprecations.scss',
				message:
					'Using / for division is deprecated and will be removed in Dart Sass 2.0.0. Recommendation: math.div(1, 5). More info and automated migrator: https://sass-lang.com/d/slash-div.',
				stack: ['at root stylesheet (test/fixtures/deprecations.scss:17:20)'],
				source: {
					start: { line: 17, column: 20 },
					end: { line: 17, column: 25 },
					pattern: '1 / 5'
				},
				type: 'deprecation'
			},
			{
				file: 'test/fixtures/deprecations.scss',
				message:
					'Global built-in functions are deprecated and will be removed in Dart Sass 3.0.0. Use math.percentage instead. More info and automated migrator: https://sass-lang.com/d/import.',
				stack: ['at root stylesheet (test/fixtures/deprecations.scss:17:9)'],
				source: {
					start: { line: 17, column: 9 },
					end: { line: 17, column: 26 },
					pattern: 'percentage(1 / 5)'
				},
				type: 'deprecation'
			},
			{
				file: 'test/fixtures/deprecations.scss',
				message:
					'Using / for division is deprecated and will be removed in Dart Sass 2.0.0. Recommendation: math.div(1, 6). More info and automated migrator: https://sass-lang.com/d/slash-div.',
				stack: ['at root stylesheet (test/fixtures/deprecations.scss:18:20)'],
				source: {
					start: { line: 18, column: 20 },
					end: { line: 18, column: 25 },
					pattern: '1 / 6'
				},
				type: 'deprecation'
			},
			{
				file: 'test/fixtures/deprecations.scss',
				message:
					'Global built-in functions are deprecated and will be removed in Dart Sass 3.0.0. Use math.percentage instead. More info and automated migrator: https://sass-lang.com/d/import.',
				stack: ['at root stylesheet (test/fixtures/deprecations.scss:18:9)'],
				source: {
					start: { line: 18, column: 9 },
					end: { line: 18, column: 26 },
					pattern: 'percentage(1 / 6)'
				},
				type: 'deprecation'
			},
			{
				file: 'test/fixtures/deprecations.scss',
				message:
					'Using / for division is deprecated and will be removed in Dart Sass 2.0.0. Recommendation: math.div(1, 7). More info and automated migrator: https://sass-lang.com/d/slash-div.',
				stack: ['at root stylesheet (test/fixtures/deprecations.scss:19:19)'],
				source: {
					start: { line: 19, column: 19 },
					end: { line: 19, column: 24 },
					pattern: '1 / 7'
				},
				type: 'deprecation'
			},
			{
				file: 'test/fixtures/deprecations.scss',
				message:
					'Global built-in functions are deprecated and will be removed in Dart Sass 3.0.0. Use math.percentage instead. More info and automated migrator: https://sass-lang.com/d/import.',
				stack: ['at root stylesheet (test/fixtures/deprecations.scss:19:8)'],
				source: {
					start: { line: 19, column: 8 },
					end: { line: 19, column: 25 },
					pattern: 'percentage(1 / 7)'
				},
				type: 'deprecation'
			},
			{
				file: 'test/fixtures/deprecations.scss',
				message:
					'Using / for division is deprecated and will be removed in Dart Sass 2.0.0. Recommendation: math.div(1, 8). More info and automated migrator: https://sass-lang.com/d/slash-div.',
				stack: ['at root stylesheet (test/fixtures/deprecations.scss:20:20)'],
				source: {
					start: { line: 20, column: 20 },
					end: { line: 20, column: 25 },
					pattern: '1 / 8'
				},
				type: 'deprecation'
			},
			{
				file: 'test/fixtures/deprecations.scss',
				message:
					'Global built-in functions are deprecated and will be removed in Dart Sass 3.0.0. Use math.percentage instead. More info and automated migrator: https://sass-lang.com/d/import.',
				stack: ['at root stylesheet (test/fixtures/deprecations.scss:20:9)'],
				source: {
					start: { line: 20, column: 9 },
					end: { line: 20, column: 26 },
					pattern: 'percentage(1 / 8)'
				},
				type: 'deprecation'
			},
			{
				file: 'test/fixtures/deprecations.scss',
				message:
					'Using / for division is deprecated and will be removed in Dart Sass 2.0.0. Recommendation: math.div(1, 9). More info and automated migrator: https://sass-lang.com/d/slash-div.',
				stack: ['at root stylesheet (test/fixtures/deprecations.scss:21:20)'],
				source: {
					start: { line: 21, column: 20 },
					end: { line: 21, column: 25 },
					pattern: '1 / 9'
				},
				type: 'deprecation'
			},
			{
				file: 'test/fixtures/deprecations.scss',
				message:
					'Global built-in functions are deprecated and will be removed in Dart Sass 3.0.0. Use math.percentage instead. More info and automated migrator: https://sass-lang.com/d/import.',
				stack: ['at root stylesheet (test/fixtures/deprecations.scss:21:9)'],
				source: {
					start: { line: 21, column: 9 },
					end: { line: 21, column: 26 },
					pattern: 'percentage(1 / 9)'
				},
				type: 'deprecation'
			},
			{
				file: 'test/fixtures/deprecations.scss',
				message:
					'Using / for division is deprecated and will be removed in Dart Sass 2.0.0. Recommendation: math.div(1, 10). More info and automated migrator: https://sass-lang.com/d/slash-div.',
				stack: ['at root stylesheet (test/fixtures/deprecations.scss:22:20)'],
				source: {
					start: { line: 22, column: 20 },
					end: { line: 22, column: 26 },
					pattern: '1 / 10'
				},
				type: 'deprecation'
			},
			{
				file: 'test/fixtures/deprecations.scss',
				message:
					'Global built-in functions are deprecated and will be removed in Dart Sass 3.0.0. Use math.percentage instead. More info and automated migrator: https://sass-lang.com/d/import.',
				stack: ['at root stylesheet (test/fixtures/deprecations.scss:22:9)'],
				source: {
					start: { line: 22, column: 9 },
					end: { line: 22, column: 27 },
					pattern: 'percentage(1 / 10)'
				},
				type: 'deprecation'
			},
			{
				file: 'test/fixtures/deprecations.scss',
				message:
					'Using / for division outside of calc() is deprecated and will be removed in Dart Sass 2.0.0. Recommendation: math.div($riley, 999) or calc($riley / 999). More info and automated migrator: https://sass-lang.com/d/slash-div.',
				stack: ['at root stylesheet (test/fixtures/deprecations.scss:23:20)'],
				source: {
					start: { line: 23, column: 20 },
					end: { line: 23, column: 32 },
					pattern: '$riley / 999'
				},
				type: 'deprecation'
			},
			{
				file: 'test/fixtures/deprecations.scss',
				message:
					'Global built-in functions are deprecated and will be removed in Dart Sass 3.0.0. Use math.percentage instead. More info and automated migrator: https://sass-lang.com/d/import.',
				stack: ['at root stylesheet (test/fixtures/deprecations.scss:23:9)'],
				source: {
					start: { line: 23, column: 9 },
					end: { line: 23, column: 33 },
					pattern: 'percentage($riley / 999)'
				},
				type: 'deprecation'
			},
			{
				file: 'test/fixtures/deprecations.scss',
				message:
					'Passing a number (1) to color.invert() is deprecated. Recommendation: invert(1).',
				stack: ['at root stylesheet (test/fixtures/deprecations.scss:24:9)'],
				source: {
					start: { line: 24, column: 9 },
					end: { line: 24, column: 24 },
					pattern: 'color.invert(1)'
				},
				type: 'deprecation'
			},
			{
				file: 'test/fixtures/deprecations.scss',
				message:
					'Global built-in functions are deprecated and will be removed in Dart Sass 3.0.0. Use meta.call instead. More info and automated migrator: https://sass-lang.com/d/import.',
				stack: ['at root stylesheet (test/fixtures/deprecations.scss:25:9)'],
				source: {
					start: { line: 25, column: 9 },
					end: { line: 25, column: 21 },
					pattern: 'call(willow)'
				},
				type: 'deprecation'
			},
			{
				file: 'test/fixtures/deprecations.scss',
				message:
					'Passing a string to call() is deprecated and will be illegal in Dart Sass 2.0.0. Recommendation: call(get-function(willow)).',
				stack: ['at root stylesheet (test/fixtures/deprecations.scss:25:9)'],
				source: {
					start: { line: 25, column: 9 },
					end: { line: 25, column: 21 },
					pattern: 'call(willow)'
				},
				type: 'deprecation'
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
			renderer.compileAsync('./test/fixtures/errors.undefined-functions.scss'),
			renderer.compile('./test/fixtures/errors.undefined-functions.scss')
		]);
		const expected = resolveExpectedResults([
			{
				file: 'test/fixtures/errors.undefined-functions.scss',
				message: 'Undefined function.',
				stack: ['at root stylesheet (test/fixtures/errors.undefined-functions.scss:12:9)'],
				source: {
					end: {
						column: 14,
						line: 12
					},
					pattern: 'becky',
					start: {
						column: 9,
						line: 12
					}
				},
				type: 'error'
			},
			{
				file: 'test/fixtures/errors.undefined-functions.scss',
				message: 'Undefined function.',
				stack: ['at root stylesheet (test/fixtures/errors.undefined-functions.scss:14:16)'],
				source: {
					end: {
						column: 22,
						line: 14
					},
					pattern: 'harley',
					start: {
						column: 16,
						line: 14
					}
				},
				type: 'error'
			},
			{
				file: 'test/fixtures/errors.undefined-functions.scss',
				message: 'Undefined function.',
				stack: ['at root stylesheet (test/fixtures/errors.undefined-functions.scss:17:11)'],
				source: {
					end: {
						column: 17,
						line: 17
					},
					pattern: 'harley',
					start: {
						column: 11,
						line: 17
					}
				},
				type: 'error'
			},
			{
				file: 'test/fixtures/errors.undefined-functions.scss',
				message: 'Undefined function.',
				stack: ['at root stylesheet (test/fixtures/errors.undefined-functions.scss:19:10)'],
				source: {
					end: {
						column: 14,
						line: 19
					},
					pattern: 'oreo',
					start: {
						column: 10,
						line: 19
					}
				},
				type: 'error'
			},
			{
				file: 'test/fixtures/errors.undefined-functions.scss',
				message: 'Undefined function.',
				stack: ['at root stylesheet (test/fixtures/errors.undefined-functions.scss:21:19)'],
				source: {
					end: {
						column: 23,
						line: 21
					},
					pattern: 'kona',
					start: {
						column: 19,
						line: 21
					}
				},
				type: 'error'
			}
		]);
		assert.deepEqual(actualAsync, expected);
		assert.deepEqual(actualSync, expected);
	});

	it('should handle errors, disallowed known and additional unknown CSS functions', async function () {
		const renderer = undefinedFunctions(sass, {
			disallowedKnownCssFunctions: ['rotate']
		});
		const [actualAsync, actualSync] = await Promise.all([
			// prettier-ignore
			renderer.compileAsync('./test/fixtures/errors.undefined-functions.disallowed-functions.scss'),
			renderer.compile('./test/fixtures/errors.undefined-functions.disallowed-functions.scss')
		]);
		const expected = resolveExpectedResults([
			{
				file: 'test/fixtures/errors.undefined-functions.disallowed-functions.scss',
				message: 'Undefined function.',
				stack: [
					'at root stylesheet (test/fixtures/errors.undefined-functions.disallowed-functions.scss:2:13)'
				],
				source: {
					end: {
						column: 19,
						line: 2
					},
					pattern: 'rotate',
					start: {
						column: 13,
						line: 2
					}
				},
				type: 'error'
			},
			{
				file: 'test/fixtures/errors.undefined-functions.disallowed-functions.scss',
				message: 'Undefined function.',
				stack: [
					'at root stylesheet (test/fixtures/errors.undefined-functions.disallowed-functions.scss:3:10)'
				],
				source: {
					end: {
						column: 16,
						line: 3
					},
					pattern: 'v-bind',
					start: {
						column: 10,
						line: 3
					}
				},
				type: 'error'
			}
		]);
		assert.deepEqual(actualAsync, expected);
		assert.deepEqual(actualSync, expected);
	});

	it('should handle errors, disallowed known and allowed additional known CSS functions', async function () {
		const renderer = undefinedFunctions(sass, {
			disallowedKnownCssFunctions: ['rotate'],
			additionalKnownCssFunctions: ['v-bind']
		});
		const [actualAsync, actualSync] = await Promise.all([
			// prettier-ignore
			renderer.compileAsync('./test/fixtures/errors.undefined-functions.disallowed-functions.scss'),
			renderer.compile('./test/fixtures/errors.undefined-functions.disallowed-functions.scss')
		]);
		const expected = resolveExpectedResults([
			{
				file: 'test/fixtures/errors.undefined-functions.disallowed-functions.scss',
				message: 'Undefined function.',
				stack: [
					'at root stylesheet (test/fixtures/errors.undefined-functions.disallowed-functions.scss:2:13)'
				],
				source: {
					end: {
						column: 19,
						line: 2
					},
					pattern: 'rotate',
					start: {
						column: 13,
						line: 2
					}
				},
				type: 'error'
			}
		]);
		assert.deepEqual(actualAsync, expected);
		assert.deepEqual(actualSync, expected);
	});

	it('should handle errors from data string', async function () {
		/** @type {StringTestCase[]} */
		const testCases = [
			{
				input: 'body { color: becky(#f00); }',
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
					renderer.compileStringAsync(testCase.input),
					renderer.compileString(testCase.input)
				]);
				const expected = resolveExpectedResults(testCase.output);
				assert.deepEqual(actualAsync, expected);
				assert.deepEqual(actualSync, expected);
			})
		);
	});

	it('should handle errors from data string, disallowed known and additional unknown CSS functions', async function () {
		/** @type {StringTestCase[]} */
		const testCases = [
			{
				input: 'body { transform: rotate(180deg); height: v-bind(height); }',
				output: [
					{
						file: 'stdin',
						message: 'Undefined function.',
						stack: ['at root stylesheet (stdin:1:19)'],
						source: {
							end: {
								column: 25,
								line: 1
							},
							pattern: 'rotate',
							start: {
								column: 19,
								line: 1
							}
						},
						type: 'error'
					},
					{
						file: 'stdin',
						message: 'Undefined function.',
						stack: ['at root stylesheet (stdin:1:43)'],
						source: {
							end: {
								column: 49,
								line: 1
							},
							pattern: 'v-bind',
							start: {
								column: 43,
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
				const renderer = undefinedFunctions(sass, {
					disallowedKnownCssFunctions: ['rotate']
				});
				const [actualAsync, actualSync] = await Promise.all([
					renderer.compileStringAsync(testCase.input),
					renderer.compileString(testCase.input)
				]);
				const expected = resolveExpectedResults(testCase.output);
				assert.deepEqual(actualAsync, expected);
				assert.deepEqual(actualSync, expected);
			})
		);
	});

	it('should handle errors from data string, disallowed known and allowed additional known CSS functions', async function () {
		/** @type {StringTestCase[]} */
		const testCases = [
			{
				input: 'body { transform: rotate(180deg); height: v-bind(height); }',
				output: [
					{
						file: 'stdin',
						message: 'Undefined function.',
						stack: ['at root stylesheet (stdin:1:19)'],
						source: {
							end: {
								column: 25,
								line: 1
							},
							pattern: 'rotate',
							start: {
								column: 19,
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
				const renderer = undefinedFunctions(sass, {
					disallowedKnownCssFunctions: ['rotate'],
					additionalKnownCssFunctions: ['v-bind']
				});
				const [actualAsync, actualSync] = await Promise.all([
					renderer.compileStringAsync(testCase.input),
					renderer.compileString(testCase.input)
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
			rendererUndefinedFunctions.compileAsync('./test/fixtures/deprecations.all.scss'),
			rendererErrors.compileAsync('./test/fixtures/deprecations.all.scss')
		]);
		const actualSync = await Promise.all([
			rendererUndefinedFunctions.compile('./test/fixtures/deprecations.all.scss'),
			rendererErrors.compile('./test/fixtures/deprecations.all.scss')
		]);
		const expected = resolveExpectedResults([
			{
				file: 'test/fixtures/deprecations.all.scss',
				message: 'Undefined function.',
				stack: ['at root stylesheet (test/fixtures/deprecations.all.scss:9:9)'],
				source: {
					start: {
						column: 9,
						line: 9
					},
					end: {
						column: 14,
						line: 9
					},
					pattern: 'becky'
				},
				type: 'error'
			},
			{
				file: 'test/fixtures/deprecations.all.scss',
				message: 'Undefined function.',
				stack: ['at root stylesheet (test/fixtures/deprecations.all.scss:14:11)'],
				source: {
					start: {
						column: 11,
						line: 14
					},
					end: {
						column: 17,
						line: 14
					},
					pattern: 'harley'
				},
				type: 'error'
			},
			{
				file: 'test/fixtures/deprecations.all.scss',
				message:
					'Using / for division is deprecated and will be removed in Dart Sass 2.0.0. Recommendation: math.div(100, 2). More info and automated migrator: https://sass-lang.com/d/slash-div.',
				stack: ['at root stylesheet (test/fixtures/deprecations.all.scss:12:24)'],
				source: {
					start: {
						column: 24,
						line: 12
					},
					end: {
						column: 31,
						line: 12
					},
					pattern: '100 / 2'
				},
				type: 'deprecation'
			},
			{
				file: 'test/fixtures/deprecations.all.scss',
				message:
					'Global built-in functions are deprecated and will be removed in Dart Sass 3.0.0. Use math.percentage instead. More info and automated migrator: https://sass-lang.com/d/import.',
				stack: ['at root stylesheet (test/fixtures/deprecations.all.scss:12:13)'],
				source: {
					start: {
						column: 13,
						line: 12
					},
					end: {
						column: 32,
						line: 12
					},
					pattern: 'percentage(100 / 2)'
				},
				type: 'deprecation'
			}
		]);

		assert.deepEqual(actualAsync.flat(), expected);
		assert.deepEqual(actualSync.flat(), expected);
	});

	it('should handle errors from data string', async function () {
		/** @type {StringTestCase[]} */
		const testCases = [
			{
				input: 'body { color: becky(#f00); min-width: percentage(100 / 2); }',
				output: [
					{
						file: 'stdin',
						message: 'Undefined function.',
						stack: ['at root stylesheet (stdin:1:15)'],
						source: {
							start: { line: 1, column: 15 },
							end: { line: 1, column: 20 },
							pattern: 'becky'
						},
						type: 'error'
					},
					{
						file: 'stdin',
						message:
							'Using / for division is deprecated and will be removed in Dart Sass 2.0.0. Recommendation: math.div(100, 2). More info and automated migrator: https://sass-lang.com/d/slash-div.',
						stack: ['at root stylesheet (stdin:1:50)'],
						source: {
							start: { line: 1, column: 50 },
							end: { line: 1, column: 57 },
							pattern: '100 / 2'
						},
						type: 'deprecation'
					},
					{
						file: 'stdin',
						message:
							'Global built-in functions are deprecated and will be removed in Dart Sass 3.0.0. Use math.percentage instead. More info and automated migrator: https://sass-lang.com/d/import.',
						stack: ['at root stylesheet (stdin:1:39)'],
						source: {
							start: { line: 1, column: 39 },
							end: { line: 1, column: 58 },
							pattern: 'percentage(100 / 2)'
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
					rendererUndefinedFunctions.compileStringAsync(testCase.input),
					rendererErrors.compileStringAsync(testCase.input)
				]);
				const actualSync = await Promise.all([
					rendererUndefinedFunctions.compileString(testCase.input),
					rendererErrors.compileString(testCase.input)
				]);
				const expected = resolveExpectedResults(testCase.output);

				assert.deepEqual(actualAsync.flat(), expected);
				assert.deepEqual(actualSync.flat(), expected);
			})
		);
	});
});
