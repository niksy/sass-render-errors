import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * @param {string}     cwd
 * @param {string|URL} file
 */
function resolvePath(cwd, file = 'stdin') {
	if (file instanceof URL) {
		file = fileURLToPath(file);
	}
	if (file === '' || file === '-' || file === 'stdin' || file.endsWith('stdin')) {
		return 'stdin';
	}
	return path.resolve(cwd, file);
}

/**
 * @param {string|URL} file
 */
function resolveStackPath(file = 'stdin') {
	if (file instanceof URL) {
		file = fileURLToPath(file);
	}
	if (file === '' || file === '-' || file === 'stdin' || file.endsWith('stdin')) {
		return 'stdin';
	}
	// sass-embedded is not consistent with sass so we normalize it
	if (file.startsWith('../')) {
		file = `./${file.replaceAll('../', '')}`;
	}
	return file.replace('./', '');
}

export { resolvePath, resolveStackPath };
