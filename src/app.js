import express from 'express';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import multer from 'multer';
import os from 'os';
import {CodeEvaluator} from './code-evaluator.js';
import {Config, getConfig, setConfig} from './config.js';

const app = express();
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
		req.problemKey = problemKey; // Attach problemKey to the request object
		cb(null, problemDir);
	},
	filename: (req, file, cb) => cb(null, file.originalname)
});
const penilaiUpload = multer({ storage: penilaiStorage });
const programmerUpload = multer({ storage: multer.memoryStorage() });
const evaluateProgrammers = async (problemDir, penilaiPath, penilaiTotalPoints) => {
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
					percentageActuals: evaluatorProgrammer.calculatePercentage(penilaiTotalPoints, specProgrammers.points.totalPoints)
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
	try {
		const penilaiPath = path.join(problemDir, 'penilai', 'example.js');
		const evaluatorPenilai = new CodeEvaluator(penilaiPath, penilaiPath);
		
		const resultPenilai = await evaluatorPenilai.evaluatePenilai();
		const updatedResultPenilai = {
			...resultPenilai,
			POINT_FUNCTION: Config.POINT_FUNCTION,
			POINT_CLASS: Config.POINT_CLASS,
			POINT_VARIABLES: Config.POINT_VARIABLES,
			POINT_EQUAL_COMPILE: Config.POINT_EQUAL_COMPILE
		};
		
		const penilaiTotalPoints = resultPenilai.points.totalPoints;
		
		console.log('Penilai Evaluation Result:', JSON.stringify(resultPenilai, null, 2));
		
		// Cek apakah file spec.json sudah ada
		const specPath = path.join(problemDir, 'penilai', 'spec.json');
		if (!fs.existsSync(specPath)) {
			// Jika belum ada, simpan hasil evaluasi sebagai spec.json
			fs.writeFileSync(specPath, JSON.stringify(updatedResultPenilai, null, 2), 'utf8');
		} else {
			console.log('File spec.json sudah ada, tidak perlu membuat ulang.');
		}
		
		return await evaluateProgrammers(problemDir, penilaiPath, penilaiTotalPoints);
	} catch (err) {
		console.error('Error evaluating penilai:', err);
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

app.use(express.static(path.join(__dirname, 'public')));

app.post('/update-spec', (req, res) => {
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
app.get('/get-spec/:problem', (req, res) => {
	const { problem } = req.params;
	const problemDir = path.join(problemsDir, problem);
	const specPath = path.join(problemDir, 'penilai', 'spec.json');
	
	try {
		if (fs.existsSync(specPath)) {
			const specData = fs.readFileSync(specPath, 'utf8');
			res.status(200).json(JSON.parse(specData));
		} else {
			res.status(404).json({ error: 'spec.json not found' });
		}
	} catch (err) {
		console.error('Error reading spec.json:', err);
		res.status(500).json({ error: 'Error reading spec.json' });
	}
});

app.get('/penilai/:problem', async (req, res) => {
	const { problem } = req.params;
	const results = await evaluatePenilai(problem);
	res.json(results);
});
app.get('/problems', (req, res) => {
	const problemKeys = getAllProblemKeys();
	if (problemKeys.length > 0) {
		res.json(problemKeys);
	} else {
		res.status(404).json({ error: 'No problems found' });
	}
});
app.post('/upload/penilai', penilaiUpload.single('file'), (req, res) => {
	const { file } = req;
	if (!file) {
		return res.status(400).json({ error: 'Please upload a file' });
	}
	const problemKey = req.problemKey;
	const programmersDir = path.join(problemsDir, problemKey, 'programmers');
	fs.mkdirSync(programmersDir, { recursive: true });
	
	// Pastikan untuk mengembalikan respons setelah file berhasil diunggah
	res.json({ message: 'File uploaded successfully', file, problemKey });
});
app.post('/upload/programmer', programmerUpload.single('file'), async (req, res) => {
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
app.post('/config', (req, res) => {
	const newConfig = req.body;
	setConfig(newConfig);
	const updatedConfig = getConfig(); // Mengambil konfigurasi terbaru setelah diperbarui
	const totalPoints = parseInt(updatedConfig.POINT_FUNCTION) + parseInt(updatedConfig.POINT_CLASS) + parseInt(updatedConfig.POINT_VARIABLES) + parseInt(updatedConfig.POINT_EQUAL_COMPILE); // Menghitung total poin
	res.json({
		message: 'Configuration updated successfully',
		newConfig: updatedConfig,
		totalPoints: totalPoints
	});
});
app.get('/config', (req, res) => {
	res.json(getConfig());
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
app.listen(port, () => {
	console.log(`Server is running at http://${localIp}:${port}`);
});
