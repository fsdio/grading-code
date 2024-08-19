import { CodeAnalyzer } from 'grading-genius';
import { Config } from './config.js';
import fs from 'fs';
import path from 'path';

class CodeEvaluator {
	constructor(filePathPenilai, filePathProgrammers) {
		this.analyzer = new CodeAnalyzer();
		this.filePathPenilai = filePathPenilai;
		this.filePathProgrammers = filePathProgrammers;
		this.evaluationResult = null;
	}
	
	async evaluateProgrammer() {
		return this.evaluate(this.filePathProgrammers, this.filePathPenilai, false);
	}
	
	async evaluatePenilai() {
		return this.evaluate(this.filePathPenilai, this.filePathPenilai, true);
	}
	
	async evaluate(filePathToEvaluate, referenceFilePath, isPenilai) {
		// Ambil spesifikasi dari file spec.json
		let specPath, specData;
		if(isPenilai){
			specData = this.analyzer.getSpecificationsFromCode(referenceFilePath);
		}else {
			specPath = path.join(path.dirname(this.filePathPenilai), 'spec.json');
			specData = JSON.parse(await fs.promises.readFile(specPath, 'utf-8'));
		}
		
		const spec = this.analyzer.getSpecificationsFromCode(filePathToEvaluate);
		const compileResult = this.analyzer.compareFileOutputs(referenceFilePath, filePathToEvaluate);
		
		const { functionNames = [], classNames = [], variableNames = [] } = spec;
		
		// Cek kesamaan dengan kode programmer lain
		const files = await fs.promises.readdir(Config.programmersDir(path.dirname(filePathToEvaluate)));
		for (const file of files) {
			if (file !== path.basename(filePathToEvaluate)) {
				const programmerPath = path.join(Config.programmersDir(path.dirname(filePathToEvaluate)), file);
				const checkEquals = this.analyzer.getCheckEqualCode(filePathToEvaluate, programmerPath);
				if (checkEquals) {
					console.log(`Kode sumber ${filePathToEvaluate} sama dengan ${programmerPath}. Nilai akan dikosongkan.`);
					return {
						functions: [],
						classes: [],
						variables: [],
						equalCompile: false,
						checkSpec: []
					};
				}
			}
		}
		
		// Cek spesifikasi dengan spec.json
		let checkSpec;
		if(isPenilai){
			checkSpec = {
				functions: this.checkSpecMatches(functionNames, functionNames),
				classes: this.checkSpecMatches(classNames, functionNames),
				variables: this.checkSpecMatches(variableNames, functionNames)
			};
		} else {
			checkSpec = {
				functions: this.checkSpecMatches(functionNames, specData.functions),
				classes: this.checkSpecMatches(classNames, specData.classes),
				variables: this.checkSpecMatches(variableNames, specData.variables)
			};
		}
		
		
		// Hasil evaluasi
		this.evaluationResult = {
			functions: functionNames,
			classes: classNames,
			variables: variableNames,
			equalCompile: compileResult.status,
			checkSpec: checkSpec
		};
		
		return this.evaluationResult;
	}
	
	// Fungsi untuk mengecek kesesuaian spesifikasi
	checkSpecMatches(foundItems, specItems) {
		const missingItems = specItems.filter(item => !foundItems.includes(item));
		return {
			missingItems,
			allMatch: missingItems.length === 0
		};
	}
	
	createSpec(result) {
		return {
			functions: result.functions,
			classes: result.classes,
			variables: result.variables,
			equalCompile: result.equalCompile,
			checkSpec: result.checkSpec
		};
	}
}

export { CodeEvaluator };
