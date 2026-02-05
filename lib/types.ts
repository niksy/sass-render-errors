// @ts-ignore `sass` may not be installed
import * as sassClassic from "sass";
// @ts-ignore `sass-embedded` may not be installed
import * as sassEmbedded from "sass-embedded";
// @ts-ignore `sass` may not be installed
import type SassPackage from 'sass';
// @ts-ignore `sass-embedded` may not be installed
import type SassEmbeddedPackage from 'sass-embedded';

type IsAny<T> = boolean extends (T extends never ? true : false) ? true : false;

export namespace Sass {
	export type Exception =
		IsAny<SassEmbeddedPackage.Exception> extends false
			? SassEmbeddedPackage.Exception
			: SassPackage.Exception;
	export type Logger =
		IsAny<SassEmbeddedPackage.Logger> extends false
			? SassEmbeddedPackage.Logger
			: SassPackage.Logger;
	export type CompileResult =
		IsAny<SassEmbeddedPackage.CompileResult> extends false
			? SassEmbeddedPackage.CompileResult
			: SassPackage.CompileResult;
	export type Options<T extends 'sync' | 'async'> =
		IsAny<SassEmbeddedPackage.Options<T>> extends false
			? SassEmbeddedPackage.Options<T>
			: SassPackage.Options<T>;
	export type StringOptions<T extends 'sync' | 'async'> =
		IsAny<SassEmbeddedPackage.StringOptions<T>> extends false
			? SassEmbeddedPackage.StringOptions<T>
			: SassPackage.StringOptions<T>;
}

export type SassModule =
	IsAny<SassEmbeddedPackage.Value> extends false ? typeof sassEmbedded : typeof sassClassic;

export type SassRenderer<T extends 'sync' | 'async'> = (input: string, options: Sass.Options<T> | Sass.StringOptions<T>) => Promise<Sass.CompileResult>;

/**
 * Sass render error or deprecation.
 */
export type SassRenderError = {
	/**
	 * Full path to file or `stdin` with error or deprecation.
	 */
	file: string;
	/**
	 * Error or deprecation message.
	 */
	message: string;
	/**
	 * Stack trace of error or deprecation.
	 */
	stack: string[];
	/**
	 * Error or deprecation pattern source.
	 */
	source: {
		start: {
			column: number;
			line: number;
		};
		end: {
			column: number;
			line: number;
		};
		pattern: string;
	};
	/**
	 * Error or deprecation code or pattern of code.
	 */
	type: 'error' | 'deprecation';
};
