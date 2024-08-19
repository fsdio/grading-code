import path from 'path';

let Config = {
	programmersDir: (__dirname) => path.join(__dirname, '../programmers/'),
	problemsDir: (__dirname) => path.join(__dirname, '../problems/')
};
export { Config };
