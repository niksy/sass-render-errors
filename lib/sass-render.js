/**
 * @typedef {import('sass')} Sass
 */

/**
 * @param   {() => import('sass').CompileResult}    callback
 * @returns {Promise<import('sass').CompileResult>}
 */
function promisify(callback) {
	return new Promise((resolve, reject) => {
		try {
			const result = callback();
			resolve(result);
		} catch (error) {
			reject(error);
		}
	});
}

/**
 * @param {Sass} sass Sass module reference. _Only Dart Sass is supported_.
 */
export default function (sass) {
	return {
		/**
		 * @param   {string}                                input
		 * @param   {import('sass').Options<"sync">}        options
		 *
		 * @returns {Promise<import('sass').CompileResult>}
		 */
		compile: (input, options) => {
			return promisify(() => {
				return sass.compile(input, options);
			});
		},

		compileAsync: sass.compileAsync,

		/**
		 * @param   {string}                                input
		 * @param   {import('sass').StringOptions<"sync">}  options
		 *
		 * @returns {Promise<import('sass').CompileResult>}
		 */
		compileString: (input, options) => {
			return promisify(() => {
				return sass.compileString(input, options);
			});
		},

		compileStringAsync: sass.compileStringAsync
	};
}
