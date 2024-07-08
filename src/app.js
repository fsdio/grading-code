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
	const problemDir = path.join(problemsDir, problemKey, 'penguji');
	fs.mkdirSync(problemDir, { recursive: true });
	return { problemKey, problemDir };
};

const pengujiStorage = multer.diskStorage({
	destination: (req, file, cb) => {
		const { problemKey, problemDir } = createProblemDirectory();
		req.problemKey = problemKey; // Attach problemKey to the request object
		cb(null, problemDir);
	},
	filename: (req, file, cb) => cb(null, file.originalname)
});

const pengujiUpload = multer({ storage: pengujiStorage });
const programmerUpload = multer({ storage: multer.memoryStorage() });

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

const evaluatePenguji = async (problem) => {
	const problemDir = path.join(problemsDir, problem);
	try {
		const pengujiPath = path.join(problemDir, 'penguji', 'example.js');
		const evaluatorPenguji = new CodeEvaluator(pengujiPath, pengujiPath);
		
		const resultPenguji = await evaluatorPenguji.evaluatePenguji();
		const pengujiTotalPoints = resultPenguji.points.totalPoints;
		
		console.log('Penguji Evaluation Result:', JSON.stringify(resultPenguji, null, 2));
		
		return await evaluateProgrammers(problemDir, pengujiPath, pengujiTotalPoints);
	} catch (err) {
		console.error('Error evaluating penguji:', err);
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

app.get('/penguji/:problem', async (req, res) => {
	const { problem } = req.params;
	const results = await evaluatePenguji(problem);
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

app.post('/upload/penguji', pengujiUpload.single('file'), (req, res) => {
	const { file } = req;
	if (!file) {
		return res.status(400).json({ error: 'Please upload a file' });
	}
	
	const problemKey = req.problemKey; // Retrieve problemKey from the request object
	res.json({ message: 'File uploaded successfully', file, problemKey });
});

app.post('/upload/programmer', programmerUpload.single('file'), (req, res) => {
	const { problem } = req.body;
	const file = req.file;
	if (!file) {
		return res.status(400).json({ error: 'Please upload a file' });
	}
	
	// Tentukan direktori tujuan setelah mendapatkan nilai problem
	const programmersDir = path.join(problemsDir, problem, 'programmers');
	fs.mkdirSync(programmersDir, { recursive: true });
	const filePath = path.join(programmersDir, file.originalname);
	
	// Pindahkan file dari memori ke disk
	fs.writeFile(filePath, file.buffer, async (err) => {
		if (err) {
			return res.status(500).json({ error: 'Failed to save file' });
		}
		
		// Lakukan evaluasi setelah file berhasil disimpan
		const results = await evaluatePenguji(problem);
		res.json({ message: 'File uploaded successfully', file, results });
	});
});

app.post('/config', (req, res) => {
	const newConfig = req.body;
	setConfig(newConfig);
	res.json({ message: 'Configuration updated successfully', newConfig: getConfig() });
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
