import hookStd from 'hook-std';
import PQueue from 'p-queue';
import pDebounce from 'p-debounce';

/**
 * @typedef {import('sass').Result} SassResult
 */

let /** @type {PQueue} */ queue,
	/** @type {string[]} */ consoleOutput,
	/** @type {hookStd.HookPromise?} */ consoleOutputPromise;

const discardConsoleOutputHook = pDebounce(async () => {
	consoleOutputPromise?.unhook();
	consoleOutput = [''];
}, 10);

export default function () {
	queue ??= new PQueue({ concurrency: 3 });
	consoleOutput ??= [''];

	return {
		add: (/** @type {() => Promise<SassResult>} */ operation) => {
			consoleOutputPromise ??= hookStd.stderr((output) => {
				consoleOutput.push(output);
			});

			return queue.add(operation);
		},
		value: async () => {
			await queue.onIdle();

			return consoleOutput;
		},
		completed: async () => {
			await queue.onIdle();

			await discardConsoleOutputHook();

			await consoleOutputPromise;
			consoleOutputPromise = null;
		}
	};
}
