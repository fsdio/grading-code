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
		const spec = this.analyzer.getSpecificationsFromCode(filePathToEvaluate);
		const compileResult = this.analyzer.compareFileOutputs(referenceFilePath, filePathToEvaluate);
		
		// Ambil spesifikasi referensi berdasarkan isPenilai
		const referenceSpec = isPenilai
			? this.analyzer.getSpecificationsFromCode(referenceFilePath)
			: JSON.parse(await fs.promises.readFile(path.join(path.dirname(referenceFilePath), 'spec.json'), 'utf8'));
		
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
		const functionMatches = this.countMatches(functionNames, referenceSpec.functionNames || referenceSpec.functions);
		const classMatches = this.countMatches(classNames, referenceSpec.classNames || referenceSpec.classes);
		const variableMatches = this.countMatches(variableNames, referenceSpec.variableNames || referenceSpec.variables);
		
		// Hitung poin berdasarkan isPenilai
		const configPoints = isPenilai ? Config : referenceSpec;
		const functionPoints = functionMatches * configPoints.POINT_FUNCTION;
		const classPoints = classMatches * configPoints.POINT_CLASS;
		const variablePoints = variableMatches * configPoints.POINT_VARIABLES;
		const equalCompilePoints = compileResult.status ? configPoints.POINT_EQUAL_COMPILE : 0;
		const totalPoints = functionPoints + classPoints + variablePoints + equalCompilePoints;
		
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
	calculatePercentage(totalPointsPenilai, totalPointsProgrammers) {
		if (totalPointsPenilai <= 0 || totalPointsProgrammers <= 0) {
			return 0;
		}
		
		let percentage = (totalPointsProgrammers / totalPointsPenilai) * 100;
		return Math.round(percentage);
	}
}
export { CodeEvaluator };
