import { promisify } from 'util';

/**
 * @typedef {import('sass')} Sass
 * @typedef {import('sass').LegacyException} SassException
 * @typedef {import('sass').LegacyResult} SassResult
 * @typedef {import('sass').LegacyOptions<"async">} SassAsyncOptions
 * @typedef {import('sass').LegacyOptions<"sync">} SassSyncOptions
 */

/**
 * @callback SassRenderer
 * @param   {SassAsyncOptions|SassSyncOptions} options
 * @returns {Promise<SassResult|undefined>}
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
				// @ts-ignore
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
		 * @param {SassAsyncOptions} options Sass options.
		 */
		render: asyncRenderer,

		/**
		 * Promisified version of `sass.renderSync`.
		 *
		 * @param {SassSyncOptions} options Sass options.
		 */
		renderSync: syncRenderer
	};
}
