import { Options as OriginalOptions } from 'sass';

export interface Options extends OriginalOptions {
	/**
	 * By default, `renderSync()` is more than twice as fast as `render()` due to the overhead of asynchronous callbacks. To avoid this performance hit, `render()` can use the fibers package to call asynchronous importers from the synchronous code path. To enable this, pass the `Fiber` class to the `fiber` option.
	 *
	 * @default undefined
	 */
	fiber?: unknown;

	/**
	 * Print all deprecation warnings even when they're repetitive. By default, once a deprecation warning for a given feature is printed five times, further warnings for that feature are silenced.
	 *
	 * @default false
	 */
	verbose?: boolean | undefined;

	/**
	 * Don't print compiler warnings from dependencies. Stylesheets imported through importers or load paths count as dependencies.
	 *
	 * @default false
	 */
	quietDeps?: boolean | undefined;
}
