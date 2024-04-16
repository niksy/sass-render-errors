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
	if (file === '') {
		return 'stdin';
	}
	if (file === 'stdin') {
		return file;
	}
	if (file.endsWith('stdin')) {
		return 'stdin';
	}
	return path.resolve(cwd, file);
}

export { resolvePath };
