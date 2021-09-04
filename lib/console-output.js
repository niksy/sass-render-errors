import hookStd from 'hook-std';
import PQueue from 'p-queue';

let queue, consoleOutput, consoleOutputPromise;

export default function () {
	queue ??= new PQueue({ concurrency: 3 });
	consoleOutput ??= [''];

	return {
		add: (operation) => {
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

			consoleOutputPromise.unhook();

			consoleOutput = [''];

			await consoleOutputPromise;
			consoleOutputPromise = null;
		}
	};
}
