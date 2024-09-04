import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import os from 'os';
import { CodeEvaluator } from './code-evaluator.js';
import { Config } from './config.js';
import cors from 'cors';

const app = express();
app.use(cors());
const port = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const problemsDir = Config.problemsDir(__dirname);

// Middleware untuk logging request
app.use((req, res, next) => {
	console.log(`${req.method} request to ${req.path}`);
	next();
});

const createProblemDirectory = () => {
	const problemKey = `problem${Date.now()}`;
	const problemDir = path.join(problemsDir, problemKey, 'penilai');
	fs.mkdirSync(problemDir, { recursive: true });
	return { problemKey, problemDir };
};

const penilaiStorage = multer.diskStorage({
	destination: (req, file, cb) => {
		const { problemKey, problemDir } = createProblemDirectory();
		req.problemKey = problemKey;
		cb(null, problemDir);
	},
	filename: (req, file, cb) => cb(null, file.originalname)
});

const penilaiUpload = multer({ storage: penilaiStorage });

const programmerUpload = multer({ storage: multer.memoryStorage() });

const evaluateProgrammers = async (problemDir, penilaiPath) => {
	const programmersDir = path.join(problemDir, 'programmers');
	let results = [];
	try {
		const files = await fs.promises.readdir(programmersDir);
		const jsFiles = files.filter(file => path.extname(file) === '.js');
		
		for (const file of jsFiles) {
			try {
				const programmerPath = path.join(programmersDir, file);
				const evaluatorProgrammer = new CodeEvaluator(penilaiPath, programmerPath);
				
				const resultProgrammers = await evaluatorProgrammer.evaluateProgrammer();
				const specProgrammers = evaluatorProgrammer.createSpec(resultProgrammers);
				
				results.push({
					fileName: file,
					specProgrammers,
				});
			} catch (error) {
				console.error(`Error during evaluation of ${file}:`, error);
			}
		}
	} catch (err) {
		console.error('Error reading the programmers directory:', err);
	}
	return results;
};

const evaluatePenilai = async (problem) => {
	const problemDir = path.join(problemsDir, problem);
	const penilaiDir = path.join(problemDir, 'penilai', 'example.js');
	const specPath = path.join(problemDir, 'penilai', 'spec.json');
	
	try {
		// Buat file spec.json jika belum ada
		if (!fs.existsSync(specPath)) {
			const evaluatorPenilai = new CodeEvaluator(penilaiDir, penilaiDir);
			const resultPenilai = await evaluatorPenilai.evaluatePenilai();
			const specPenilai = evaluatorPenilai.createSpec(resultPenilai);
			fs.writeFileSync(specPath, JSON.stringify(specPenilai, null, 2));
			console.log(JSON.stringify(specPenilai, null, 2));
			console.log(`File '${specPath}' berhasil dibuat.`);
		} else {
			console.log(`File '${specPath}' sudah ada.`);
		}
		
		return await evaluateProgrammers(problemDir, penilaiDir);
	} catch (err) {
		console.error('Error evaluating penilai:', err);
	}
};

const deleteFolderRecursive = (folderPath) => {
	if (fs.existsSync(folderPath)) {
		fs.readdirSync(folderPath).forEach((file) => {
			const currentPath = path.join(folderPath, file);
			if (fs.lstatSync(currentPath).isDirectory()) {
				// Hapus folder secara rekursif
				deleteFolderRecursive(currentPath);
			} else {
				// Hapus file
				fs.unlinkSync(currentPath);
			}
		});
		// Hapus folder itu sendiri
		fs.rmdirSync(folderPath);
	}
};

const getAllProblemKeys = () => {
	try {
		return fs.readdirSync(problemsDir).filter(file => fs.statSync(path.join(problemsDir, file)).isDirectory());
	} catch (err) {
		console.error('Error reading the problems directory:', err);
		return [];
	}
};

// Middleware untuk membatasi akses berdasarkan IP dan halaman yang diminta
const restrictAccess = (req, res, next) => {
	const clientIp = req.ip === '::1' ? '127.0.0.1' : req.ip;
	const localIp = getLocalIpAddress();
	const requestedPage = req.path;
	
	if (requestedPage === '/upload/programmer') {
		// Izinkan akses ke /upload/programmer dari IP lain
		return next();
	}
	
	if (clientIp === '127.0.0.1' || clientIp === localIp) {
		// Penilai (localhost) dapat mengakses semua halaman
		return next();
	} else if (requestedPage === '/programmers.html') {
		// Programmer hanya dapat mengakses programmers.html
		return next();
	} else {
		// Pengguna lain tidak diizinkan mengakses halaman lain
		return res.status(403).json({ error: 'Access forbidden: You do not have permission to access this page.' });
	}
};

app.use(restrictAccess);

// Sajikan file statis dari folder public
app.use(express.static(path.join(__dirname, 'public')));

app.delete('/problems/:problemKey', restrictAccess, (req, res) => {
	const { problemKey } = req.params;
	const folderPath = path.join(problemsDir, problemKey);
	
	if (fs.existsSync(folderPath)) {
		try {
			// Hapus folder beserta isinya
			deleteFolderRecursive(folderPath);
			res.status(200).json({ message: `Folder for problemKey '${problemKey}' has been deleted successfully.` });
		} catch (err) {
			console.error('Error deleting folder:', err);
			res.status(500).json({ error: 'Error deleting folder' });
		}
	} else {
		res.status(404).json({ error: `Folder for problemKey '${problemKey}' not found.` });
	}
});

app.post('/update-spec', restrictAccess, (req, res) => {
	const { problem, resultPenilai } = req.body;
	if (!problem || !resultPenilai) {
		return res.status(400).json({ error: 'Problem and resultPenilai are required' });
	}
	
	const problemDir = path.join(problemsDir, problem);
	const specPath = path.join(problemDir, 'penilai', 'spec.json');
	
	try {
		fs.writeFileSync(specPath, JSON.stringify(resultPenilai, null, 2), 'utf8');
		res.status(200).json({ message: 'spec.json updated successfully' });
	} catch (err) {
		console.error('Error updating spec.json:', err);
		res.status(500).json({ error: 'Error updating spec.json' });
	}
});

app.get('/get-spec/:problem', restrictAccess, (req, res) => {
	const { problem } = req.params;
	const specPath = path.join(problemsDir, problem, 'penilai', 'spec.json');
	
	try {
		if (fs.existsSync(specPath)) {
			const specData = fs.readFileSync(specPath, 'utf8');
			res.status(200).json(JSON.parse(specData));
		} else {
			console.warn(`spec.json not found for problem ${problem}`);
			res.status(404).json({ error: `spec.json not found for problem ${problem}` });
		}
	} catch (err) {
		console.error(`Error reading spec.json for problem ${problem}:`, err);
		res.status(500).json({ error: `Error reading spec.json for problem ${problem}` });
	}
});

app.get('/penilai/:problem', restrictAccess, async (req, res) => {
	const { problem } = req.params;
	const results = await evaluatePenilai(problem);
	res.json(results);
});

app.get('/problems', restrictAccess, (req, res) => {
	const problemKeys = getAllProblemKeys();
	if (problemKeys.length > 0) {
		res.json(problemKeys);
	} else {
		res.status(404).json({ error: 'No problems found' });
	}
});

app.post('/upload/penilai', restrictAccess, penilaiUpload.single('file'), (req, res) => {
	const { file } = req;
	if (!file) {
		return res.status(400).json({ error: 'Please upload a file' });
	}
	const problemKey = req.problemKey;
	const programmersDir = path.join(problemsDir, problemKey, 'programmers');
	fs.mkdirSync(programmersDir, { recursive: true });
	
	res.json({ message: 'File uploaded successfully', file, problemKey });
});

app.post('/upload/programmer', (req, res, next) => {
	res.header('Access-Control-Allow-Origin', '*');
	next();
}, programmerUpload.single('file'), async (req, res) => {
	const { problem } = req.body;
	const file = req.file;
	if (!file) {
		return res.status(400).json({ error: 'Please upload a file' });
	}
	const programmersDir = path.join(problemsDir, problem, 'programmers');
	fs.mkdirSync(programmersDir, { recursive: true });
	const filePath = path.join(programmersDir, file.originalname);
	fs.writeFile(filePath, file.buffer, async (err) => {
		if (err) {
			console.error('Failed to save file:', err);
			return res.status(500).json({ error: 'Failed to save file' });
		}
		try {
			const results = await evaluatePenilai(problem);
			res.json({ message: 'File uploaded successfully', file, results });
		} catch (error) {
			console.error('Error evaluating penilai after upload:', error);
			res.status(500).json({ error: 'Error evaluating penilai after upload' });
		}
	});
});


const getLocalIpAddress = () => {
	const interfaces = os.networkInterfaces();
	for (const interfaceName of Object.keys(interfaces)) {
		for (const iface of interfaces[interfaceName]) {
			if (iface.family === 'IPv4' && !iface.internal) {
				return iface.address;
			}
		}
	}
	return '127.0.0.1';
};

const localIp = getLocalIpAddress();
app.listen(port, '0.0.0.0',() => {
	console.log(`Server Is Running At Address = http://localhost:${port}/penilai.html`);
	console.log(`Acces Insert Answer With Address = http://${localIp}:${port}/programmers.html`);
});
