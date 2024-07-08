import { CodeAnalyzer } from 'grading-genius';
import { Config } from './config.js';
import fs from 'fs';
import path from 'path';

class CodeEvaluator {
	constructor(filePathPenguji, filePathProgrammers) {
		this.analyzer = new CodeAnalyzer();
		this.filePathPenguji = filePathPenguji;
		this.filePathProgrammers = filePathProgrammers;
		this.evaluationResult = null;
	}
	
	async evaluateProgrammer() {
		return this.evaluate(this.filePathProgrammers, this.filePathPenguji, false);
	}
	
	async evaluatePenguji() {
		return this.evaluate(this.filePathPenguji, this.filePathPenguji, true);
	}
	
	async evaluate(filePathToEvaluate, referenceFilePath, isPenguji) {
		const spec = this.analyzer.getSpecificationsFromCode(filePathToEvaluate);
		const compileResult = this.analyzer.compareFileOutputs(referenceFilePath, filePathToEvaluate);
		
		const referenceSpec = this.analyzer.getSpecificationsFromCode(referenceFilePath);
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
						points: {
							functionPoints: 0,
							classPoints: 0,
							variablePoints: 0,
							equalCompilePoints: 0,
							totalPoints: 0,
						}
					};
				}
			}
		}
		
		// Hitung kesamaan
		const functionMatches = this.countMatches(functionNames, referenceSpec.functionNames);
		const classMatches = this.countMatches(classNames, referenceSpec.classNames);
		const variableMatches = this.countMatches(variableNames, referenceSpec.variableNames);
		
		// Hitung point
		let functionPoints = functionMatches * Config.POINT_FUNCTION;
		let classPoints = classMatches * Config.POINT_CLASS;
		let variablePoints = variableMatches * Config.POINT_VARIABLES;
		let equalCompilePoints = isPenguji ? Config.POINT_EQUAL_COMPILE : (compileResult.status ? Config.POINT_EQUAL_COMPILE : 0); // Adjusted points based on status
		let totalPoints = functionPoints + classPoints + variablePoints + equalCompilePoints;
		
		this.evaluationResult = {
			functions: functionNames,
			classes: classNames,
			variables: variableNames,
			points: {
				functionPoints,
				classPoints,
				variablePoints,
				equalCompilePoints,
				totalPoints,
			}
		};
		
		return this.evaluationResult;
	}
	
	countMatches(arr1, arr2) {
		let matches = 0;
		const minLength = Math.min(arr1.length, arr2.length);
		for (let i = 0; i < minLength; i++) {
			if (arr1[i] === arr2[i]) {
				matches++;
			}
		}
		return matches;
	}
	
	createSpec(result) {
		return {
			functions: result.functions,
			classes: result.classes,
			variables: result.variables,
			points: result.points,
		};
	}
	
	calculatePercentage(totalPointsPenguji, totalPointsProgrammers) {
		if (totalPointsPenguji <= 0 || totalPointsProgrammers <= 0) {
			return 0;
		}
		
		let percentage = (totalPointsProgrammers / totalPointsPenguji) * 100;
		return Math.round(percentage);
	}
}

export { CodeEvaluator };
