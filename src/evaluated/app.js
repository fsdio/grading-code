import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import os from 'os';
import { CodeEvaluator } from './code-evaluator.js';
import { Config, setConfig, getConfig } from './config.js';

const app = express();
const port = 3000;

app.use(express.json());

// Menentukan direktori programmers
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const programmersDir = Config.programmersDir(__dirname);

// Setup multer untuk upload file
const storage = multer.diskStorage({
	destination: (req, file, cb) => cb(null, programmersDir),
	filename: (req, file, cb) => cb(null, file.originalname)
});
const upload = multer({ storage });

// Penyimpanan hasil evaluasi
let results = [];
let pengujiTotalPoints = 0;

// Fungsi evaluasi file programmers
const evaluateProgrammers = async (pengujiPath) => {
	try {
		const files = await fs.promises.readdir(programmersDir);
		const jsFiles = files.filter(file => path.extname(file) === '.js');
		
		for (const file of jsFiles) {
			try {
				const programmerPath = path.join(programmersDir, file);
				const evaluatorProgrammer = new CodeEvaluator(pengujiPath, programmerPath);
				
				const resultProgrammers = await evaluatorProgrammer.evaluateProgrammer();
				
				const specProgrammers = evaluatorProgrammer.createSpec(resultProgrammers);
				
				// Push result to array
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
};

// Fungsi evaluasi penguji
const evaluatePenguji = async () => {
	try {
		const pengujiPath = Config.pengujiPath(__dirname);
		const evaluatorPenguji = new CodeEvaluator(pengujiPath, pengujiPath);
		
		// Evaluate penguji file to get its total points
		const resultPenguji = await evaluatorPenguji.evaluatePenguji();
		pengujiTotalPoints = resultPenguji.points.totalPoints;
		
		// Log the penguji data for debugging
		console.log('Penguji Evaluation Result:', JSON.stringify(resultPenguji, null, 2));
		
		// Now evaluate programmers
		await evaluateProgrammers(pengujiPath);
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
app.get('/penguji', (req, res) => {
	res.json(results);
});

// Endpoint untuk mendapatkan hasil evaluasi berdasarkan nama file (programmers)
app.get('/programmers/:fileName', (req, res) => {
	const { fileName } = req.params;
	const result = results.find(r => r.fileName === fileName);
	if (result) {
		res.json(result);
	} else {
		res.status(404).json({ error: 'File not found' });
	}
});

// Endpoint untuk upload file JavaScript baru
app.post('/upload', upload.single('file'), (req, res) => {
	const file = req.file;
	if (!file) {
		return res.status(400).json({ error: 'Please upload a file' });
	}
	
	results = []; // Reset hasil evaluasi
	evaluatePenguji().then(); // Evaluasi ulang file setelah upload
	
	res.json({ message: 'File uploaded successfully', file });
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
	return '127.0.0.1'; // Fallback ke localhost jika tidak ada IP ditemukan
};

const localIp = getLocalIpAddress();
app.listen(port, () => {
	console.log(`Server is running at http://${localIp}:${port}`);
});

// Evaluasi awal saat server dimulai
evaluatePenguji().then();
