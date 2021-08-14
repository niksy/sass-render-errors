import { promisify } from 'util';
import path from 'path';
import hookStd from 'hook-std';
import matchAll from 'string-match-all';

const outputRegexes = [
	/(?:Error|DEPRECATION WARNING):(?<message>.+?)╷\s*?\d+\s*│(?<codeLine>\s*.+?)\n\s*│(?<codePositionMarker>\s*\^+?)\n\s*╵\s*(?<file>[\s\w./]+)\s(?<line>\d+):(?<column>\d+)/gs,
	/DEPRECATION WARNING on line (?<line>\d+), column (?<column>\d+) of (?<file>.+?):(?<message>.+?)╷\s*?\d+\s*│(?<codeLine>\s*.+?)\n\s*│(?<codePositionMarker>\s*\^+?)\n/gs,
	/Error: (?<file>.+?): (?<message>.+$)/g
];
const wordLike = /\w/;
const dotAtEnd = /\.$/;
const startsWithLowercase = /^[a-z]/;

function extractInformationWithPositionMarker(codeLine, codePositionMarker) {
	const firstIndex = codePositionMarker.indexOf('^');
	const code = codeLine.slice(firstIndex, codePositionMarker.length);
	const markerLength = codePositionMarker.trim().length;
	return {
		code,
		markerLength
	};
}

function parseStringOutput(input) {
	const results = []
		.concat(
			...outputRegexes.map((outputRegex) => [
				...(matchAll(input, outputRegex) ?? [])
			])
		)
		.map((result) => {
			const {
				message = '',
				codeLine = '',
				codePositionMarker = '',
				file = '',
				line = '0',
				column = '0'
			} = result.groups;

			const composedLine = Number(line);
			const composedColumn = Number(column);
			const composedMessage = message
				.split('\n')
				.filter((input) => wordLike.test(input))
				.map((input) => {
					let output = input.trim();
					if (!dotAtEnd.test(output)) {
						output = `${output}.`;
					}
					if (startsWithLowercase.test(output)) {
						output =
							output.charAt(0).toUpperCase() + output.slice(1);
					}
					return output;
				})
				.join(' ');
			const composedCodeLine = codeLine.trim();
			const { code, markerLength } = extractInformationWithPositionMarker(
				codeLine,
				codePositionMarker
			);

			return {
				file: file,
				source: {
					start: {
						line: composedLine,
						column: composedColumn
					},
					end: {
						line: composedLine,
						column: composedColumn + markerLength
					},
					pattern: code
				},
				message: composedMessage
			};
		});

	return results;
}

function parseErrorOutput(input, file, cwd) {
	const errors = [];
	const results = parseStringOutput(input.formatted);

	results.forEach((result) => {
		const composedFile = file ?? path.resolve(cwd, result.file);
		errors.push({
			...result,
			type: 'error',
			file: composedFile
		});
	});

	return {
		errors
	};
}

function parseConsoleOutput(input, cwd) {
	const deprecations = [];
	const results = parseStringOutput(input);

	results.forEach((result) => {
		const { file } = result;
		const composedFile = path.resolve(cwd, file);

		deprecations.push({
			...result,
			type: 'deprecation',
			file: composedFile
		});
	});

	return {
		deprecations
	};
}

export default async function (sass, options = {}) {
	const consoleOutput = [];
	const errors = [];
	const deprecations = [];
	const cwd = process.cwd();

	const consoleOutputPromise = hookStd.stderr((output) => {
		consoleOutput.push(output);
	});

	try {
		await promisify(sass.render)({
			...options,
			verbose: true
		});

		const { deprecations: deprecationsFromConsole } = parseConsoleOutput(
			consoleOutput.join(''),
			cwd
		);
		deprecationsFromConsole.forEach((deprecation) => {
			deprecations.push(deprecation);
		});
	} catch (error) {
		const { errors: errorsFromOutput } = parseErrorOutput(
			error,
			error.file,
			cwd
		);
		errorsFromOutput.forEach((error) => {
			errors.push(error);
		});
	} finally {
		consoleOutputPromise.unhook();
	}

	try {
		await consoleOutputPromise;
	} catch {
		// Handled
	}

	return [...errors, ...deprecations];
}
