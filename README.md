# sass-render-errors

[![Build Status][ci-img]][ci]

Get [Sass][dart-sass] render errors and deprecations.

Currently there’s no Sass API which reports errors and deprecations in machine
readable format (e.g. JSON-like data). This module parses Sass render output and
provides render information for easier usage in linters and similar tools.

## Install

```sh
npm install sass-render-errors --save
```

## Usage

```js
import sassRenderErrors from 'sass-render-errors';
import sass from 'sass';

(async () => {
	const result = await sassRenderErrors(sass, { file: './index.scss' });
	console.log(result);
	/*[
		{
			file: '<full path>/index.scss',
			message: 'Passing a number (1) to color.invert() is deprecated. Recommendation: invert(1).',
			source: {
				end: {
					column: 24,
					line: 4
				},
				pattern: 'color.invert(1)',
				start: {
					column: 9,
					line: 4
				}
			},
			type: 'deprecation'
		}
	]*/
})();
```

### `index.scss`

```scss
@use 'sass:color';

.becky {
	color: color.invert(1);
}
```

## API

### sassRenderErrors(sass, [options])

Returns: `Promise<object[]>`

Promise with array of errors and deprecations.

If file contains multiple errors, only first one is shown. All deprecations are
always visible.

Each array entry is object which contains following properties:

| Property              | Type     | Description                                   |
| --------------------- | -------- | --------------------------------------------- |
| `file`                | `string` | Full path to file with error or deprecation.  |
| `message`             | `string` | Error or deprecation message.                 |
| `source.start.column` | `number` | Pattern start column.                         |
| `source.start.line`   | `number` | Pattern start line.                           |
| `source.end.column`   | `number` | Pattern end column.                           |
| `source.end.line`     | `number` | Pattern end line.                             |
| `source.pattern`      | `string` | Error or deprecation code or pattern of code. |
| `type`                | `string` | Can be either `error` or `deprecation`.       |

#### sass

[Sass][dart-sass] module reference. _Only Dart Sass is supported._

Sass is injected as dependancy because each version has different set of errors
and deprecations and you should get results for Sass version your application
uses.

#### options

Type: `object`

[Sass options](https://github.com/sass/dart-sass#javascript-api). For detailed
explanation see
[node-sass options reference](https://github.com/sass/node-sass#options).

## License

MIT © [Ivan Nikolić](http://ivannikolic.com)

<!-- prettier-ignore-start -->

[ci]: https://travis-ci.com/niksy/sass-render-errors
[ci-img]: https://travis-ci.com/niksy/sass-render-errors.svg?branch=master
[dart-sass]: https://github.com/sass/dart-sass

<!-- prettier-ignore-end -->
