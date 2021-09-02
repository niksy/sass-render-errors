import { promisify } from 'util';

/**
 * @typedef {import('sass')} Sass
 * @typedef {import('sass').SassException} SassException
 * @typedef {import('sass').Result} SassResult
 * @typedef {import('../types').Options} SassOptions
 */

/**
 * @callback SassRenderer
 * @param   {SassOptions}         options
 * @returns {Promise<SassResult>}
 * @throws {Promise<SassException>}
 */

/**
 * Create Promisified Sass render functions.
 *
 * @param {Sass} sass Sass module reference. _Only Dart Sass is supported_.
 */
export default function (sass) {
	/** @type {SassRenderer} */
	const asyncRenderer = promisify(sass.render);

	/** @type {SassRenderer} */
	const syncRenderer = (options) => {
		return new Promise((resolve, reject) => {
			try {
				const result = sass.renderSync(options);
				resolve(result);
			} catch (error) {
				reject(error);
			}
		});
	};

	return {
		/**
		 * Promisified version of `sass.render`.
		 *
		 * @param {SassOptions} options Sass options.
		 */
		render: asyncRenderer,

		/**
		 * Promisified version of `sass.renderSync`.
		 *
		 * @param {SassOptions} options Sass options.
		 */
		renderSync: syncRenderer
	};
}
