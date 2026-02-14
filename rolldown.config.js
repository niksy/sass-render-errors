import { defineConfig } from 'rolldown';
import { dts } from 'rolldown-plugin-dts';

export default defineConfig([
	{
		input: ['index.js', 'lib/render-errors.js', 'lib/undefined-functions.js'],
		output: {
			cleanDir: true,
			dir: 'dist',
			format: 'esm',
			sourcemap: true
		},
		external: [/^[^./]/],
		transform: {
			target: ['node18']
		},
		plugins: [dts({ sourcemap: true })]
	}
]);
