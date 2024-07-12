import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Mengganti __dirname dengan teknik yang sesuai untuk modul ES
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configFilePath = path.join(__dirname, 'config.json');

let Config = {
	POINT_FUNCTION: 20,
	POINT_CLASS: 20,
	POINT_VARIABLES: 20,
	POINT_EQUAL_COMPILE: 20,
	programmersDir: (__dirname) => path.join(__dirname, '../programmers/'),
	problemsDir: (__dirname) => path.join(__dirname, '../problems/')
};

const loadConfig = () => {
	if (fs.existsSync(configFilePath)) {
		const configData = fs.readFileSync(configFilePath, 'utf-8');
		const parsedConfig = JSON.parse(configData);
		
		// Konversi nilai POINT_EQUAL_COMPILE ke tipe data number jika dibaca sebagai string
		if (typeof parsedConfig.POINT_EQUAL_COMPILE === 'string') {
			parsedConfig.POINT_EQUAL_COMPILE = parseInt(parsedConfig.POINT_EQUAL_COMPILE, 10);
		}
		
		Object.assign(Config, parsedConfig);
	}
};


const saveConfig = () => {
	const configData = JSON.stringify(Config, null, 2);
	fs.writeFileSync(configFilePath, configData);
};

// Fungsi untuk mengubah nilai point
const setConfig = (newConfig) => {
	if (newConfig.POINT_FUNCTION !== undefined) Config.POINT_FUNCTION = parseInt(newConfig.POINT_FUNCTION);
	if (newConfig.POINT_CLASS !== undefined) Config.POINT_CLASS = parseInt(newConfig.POINT_CLASS);
	if (newConfig.POINT_VARIABLES !== undefined) Config.POINT_VARIABLES = parseInt(newConfig.POINT_VARIABLES);
	if (newConfig.POINT_EQUAL_COMPILE !== undefined) Config.POINT_EQUAL_COMPILE = parseInt(newConfig.POINT_EQUAL_COMPILE);
	saveConfig();
};

// Fungsi untuk mendapatkan konfigurasi saat ini
const getConfig = () => Config;

loadConfig();

export { Config, setConfig, getConfig };
