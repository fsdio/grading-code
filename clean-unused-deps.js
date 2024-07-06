import depcheck from 'depcheck';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

// Menggunakan `import.meta.url` dan `path` untuk mendapatkan `__dirname`
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const options = {
	ignorePatterns: [
		'node_modules',
		'dist',
		'build',
	],
	ignoreMatches: [
		'eslint', // Ignore dev dependencies that you know you are using
	],
};

depcheck(__dirname, options, unused => {
	console.log('Unused dependencies');
	console.log(unused.dependencies);
	
	console.log('Unused devDependencies');
	console.log(unused.devDependencies);
	
	const allUnused = [...unused.dependencies, ...unused.devDependencies];
	
	if (allUnused.length > 0) {
		const uninstallCommand = `npm uninstall ${allUnused.join(' ')}`;
		console.log(`Running: ${uninstallCommand}`);
		exec(uninstallCommand, (err, stdout, stderr) => {
			if (err) {
				console.error(`Error: ${stderr}`);
				return;
			}
			console.log(stdout);
			console.log('Unused dependencies removed');
		});
	} else {
		console.log('No unused dependencies found');
	}
}).then();
