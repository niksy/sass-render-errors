import path from 'path';

/**
 * @param {string} cwd
 * @param {string} file
 */
function resolvePath(cwd, file = 'stdin') {
	if (file === '') {
		return 'stdin';
	}
	if (file === 'stdin') {
		return file;
	}
	return path.resolve(cwd, file);
}

export { resolvePath };
