/**
 * @import {SassModule, Sass} from './types.ts'
 */

/**
 * @param   {() => Sass.CompileResult}    callback
 * @returns {Promise<Sass.CompileResult>}
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
 * @param {SassModule} sass Sass module reference. _Only Dart Sass is supported_.
 */
export default function (sass) {
	return {
		/**
		 * @param   {string}                      input
		 * @param   {Sass.Options<"sync">}        options
		 */
		compile: (input, options) => {
			return promisify(() => {
				return sass.compile(input, options);
			});
		},

		compileAsync: sass.compileAsync,

		/**
		 * @param   {string}                      input
		 * @param   {Sass.StringOptions<"sync">}  options
		 */
		compileString: (input, options) => {
			return promisify(() => {
				return sass.compileString(input, options);
			});
		},

		compileStringAsync: sass.compileStringAsync
	};
}
