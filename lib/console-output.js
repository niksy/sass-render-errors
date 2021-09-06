import hookStd from 'hook-std';
import PQueue from 'p-queue';

/**
 * @typedef {import('sass').Result} SassResult
 */

let /** @type {PQueue} */ queue,
	/** @type {string[]} */ consoleOutput,
	/** @type {hookStd.HookPromise?} */ consoleOutputPromise;

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

			consoleOutputPromise?.unhook();

			consoleOutput = [''];

			await consoleOutputPromise;
			consoleOutputPromise = null;
		}
	};
}
