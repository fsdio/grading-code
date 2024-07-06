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
		const configData = fs.readFileSync(configFilePath, 'utf-8'); // Gunakan 'utf-8' sebagai opsi enkoding
		Object.assign(Config, JSON.parse(configData));
	}
};

const saveConfig = () => {
	const configData = JSON.stringify(Config, null, 2);
	fs.writeFileSync(configFilePath, configData);
};

// Fungsi untuk mengubah nilai point
const setConfig = (newConfig) => {
	if (newConfig.POINT_FUNCTION !== undefined) Config.POINT_FUNCTION = newConfig.POINT_FUNCTION;
	if (newConfig.POINT_CLASS !== undefined) Config.POINT_CLASS = newConfig.POINT_CLASS;
	if (newConfig.POINT_VARIABLES !== undefined) Config.POINT_VARIABLES = newConfig.POINT_VARIABLES;
	if (newConfig.POINT_EQUAL_COMPILE !== undefined) Config.POINT_EQUAL_COMPILE = newConfig.POINT_EQUAL_COMPILE;
	saveConfig();
};

// Fungsi untuk mendapatkan konfigurasi saat ini
const getConfig = () => Config;

loadConfig();

export { Config, setConfig, getConfig };
