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
			file: path.resolve(__dirname, '..', entry.file)
		};
	});
}

describe('Render errors', function () {
	it('should handle errors', async function () {
		const renderer = renderErrors(sass);
		const [actualAsync, actualSync] = await Promise.all([
			renderer.render({
				file: './test/fixtures/errors.scss'
			}),
			renderer.renderSync({
				file: './test/fixtures/errors.scss'
			})
		]);
		const expected = resolveExpectedResults([
			{
				file: 'test/fixtures/errors.scss',
				message: "Can't find stylesheet to import.",
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
				type: 'deprecation'
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
				type: 'deprecation'
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
				type: 'deprecation'
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
				type: 'deprecation'
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
				type: 'deprecation'
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
				type: 'deprecation'
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
				type: 'deprecation'
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
				type: 'deprecation'
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
				type: 'deprecation'
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
				type: 'deprecation'
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
				type: 'deprecation'
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
				type: 'deprecation'
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
				type: 'deprecation'
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
				type: 'deprecation'
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
				type: 'deprecation'
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
			renderer.render({
				file: './test/fixtures/undefined-functions.scss'
			}),
			renderer.renderSync({
				file: './test/fixtures/undefined-functions.scss'
			})
		]);
		const expected = resolveExpectedResults([
			{
				file: 'test/fixtures/undefined-functions.scss',
				message: 'Undefined function.',
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
				file: 'test/fixtures/undefined-functions.scss',
				message: 'Undefined function.',
				source: {
					end: {
						column: 17,
						line: 13
					},
					pattern: 'harley',
					start: {
						column: 11,
						line: 13
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
