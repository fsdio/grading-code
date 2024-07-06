import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import os from 'os';
import { CodeEvaluator } from './code-evaluator.js';
import { Config, getConfig, setConfig } from './config.js';

const app = express();
const port = 3000;

app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const problemsDir = Config.problemsDir(__dirname);

// Setup multer untuk upload file penguji
const pengujiStorage = multer.diskStorage({
	destination: (req, file, cb) => {
		const problemKey = `problem${Date.now()}`;
		const problemDir = path.join(problemsDir, problemKey, 'penguji');
		fs.mkdirSync(problemDir, { recursive: true });
		cb(null, problemDir);
	},
	filename: (req, file, cb) => cb(null, file.originalname)
});
const pengujiUpload = multer({ storage: pengujiStorage });

// Setup multer untuk upload file programmers
const programmersStorage = multer.diskStorage({
	destination: (req, file, cb) => {
		const { problem } = req.body;
		const programmersDir = path.join(problemsDir, problem, 'programmers');
		fs.mkdirSync(programmersDir, { recursive: true }); // Membuat direktori jika belum ada
		cb(null, programmersDir);
	},
	filename: (req, file, cb) => cb(null, file.originalname)
});
const programmerUpload = multer({ storage: programmersStorage });

// Fungsi evaluasi file programmers
const evaluateProgrammers = async (problemDir, pengujiPath, pengujiTotalPoints) => {
	const programmersDir = path.join(problemDir, 'programmers');
	let results = [];
	try {
		const files = await fs.promises.readdir(programmersDir);
		const jsFiles = files.filter(file => path.extname(file) === '.js');
		
		for (const file of jsFiles) {
			try {
				const programmerPath = path.join(programmersDir, file);
				const evaluatorProgrammer = new CodeEvaluator(pengujiPath, programmerPath);
				
				const resultProgrammers = await evaluatorProgrammer.evaluateProgrammer();
				const specProgrammers = evaluatorProgrammer.createSpec(resultProgrammers);
				
				results.push({
					fileName: file,
					specProgrammers,
					percentageActuals: evaluatorProgrammer.calculatePercentage(pengujiTotalPoints, specProgrammers.points.totalPoints)
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

// Fungsi evaluasi penguji
const evaluatePenguji = async (problem) => {
	const problemDir = path.join(problemsDir, problem);
	try {
		const pengujiPath = path.join(problemDir, 'penguji', 'example.js');
		const evaluatorPenguji = new CodeEvaluator(pengujiPath, pengujiPath);
		
		const resultPenguji = await evaluatorPenguji.evaluatePenguji();
		const pengujiTotalPoints = resultPenguji.points.totalPoints; // Definisi pengujiTotalPoints di sini
		
		console.log('Penguji Evaluation Result:', JSON.stringify(resultPenguji, null, 2));
		
		return await evaluateProgrammers(problemDir, pengujiPath, pengujiTotalPoints);
	} catch (err) {
		console.error('Error evaluating penguji:', err);
	}
};

// Middleware untuk logging request
app.use((req, res, next) => {
	console.log(`${req.method} request to ${req.path}`);
	next();
});

// Endpoint untuk mendapatkan semua hasil evaluasi (penguji)
app.get('/penguji/:problem', async (req, res) => {
	const { problem } = req.params;
	const results = await evaluatePenguji(problem);
	res.json(results);
});

// Endpoint untuk mendapatkan hasil evaluasi berdasarkan nama file (programmers)
app.get('/programmers/:problem/:fileName', async (req, res) => {
	const { problem, fileName } = req.params;
	const results = await evaluatePenguji(problem);
	const result = results.find(r => r.fileName === fileName);
	if (result) {
		res.json(result);
	} else {
		res.status(404).json({ error: 'File not found' });
	}
});

// Endpoint untuk upload file penguji
app.post('/upload/penguji', pengujiUpload.single('file'), (req, res) => {
	const { file } = req;
	if (!file) {
		return res.status(400).json({ error: 'Please upload a file' });
	}
	
	const problemKey = path.basename(path.dirname(file.path)); // Mendapatkan problemKey dari path direktori
	res.json({ message: 'File uploaded successfully', file, problemKey });
});

// Endpoint untuk upload file JavaScript baru (programmers)
app.post('/upload/programmer', programmerUpload.single('file'), (req, res) => {
	const { problem } = req.body;
	const file = req.file;
	if (!file) {
		return res.status(400).json({ error: 'Please upload a file' });
	}
	
	evaluatePenguji(problem).then(results => {
		res.json({ message: 'File uploaded successfully', file, results });
	});
});

// Endpoint untuk mengubah nilai point pada config.js
app.post('/config', (req, res) => {
	const newConfig = req.body;
	setConfig(newConfig);
	res.json({ message: 'Configuration updated successfully', newConfig: getConfig() });
});

// Endpoint untuk mendapatkan nilai point saat ini
app.get('/config', (req, res) => {
	res.json(getConfig());
});

// Fungsi untuk mendapatkan alamat IP lokal
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
app.listen(port, () => {
	console.log(`Server is running at http://${localIp}:${port}`);
});
