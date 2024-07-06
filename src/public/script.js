document.getElementById('uploadForm').addEventListener('submit', async (event) => {
	event.preventDefault();
	const formData = new FormData(event.target);
	try {
		const response = await fetch(event.target.action, {
			method: 'POST',
			body: formData
		});
		const result = await response.json();
		console.log('Upload result:', result);
		await fetchResults(result.problemKey);
	} catch (error) {
		console.error('Error uploading file:', error);
	}
});

async function fetchResults(problem) {
	try {
		const response = await fetch(`/penguji/${problem}`);
		const results = await response.json();
		displayResults(problem, results);
	} catch (error) {
		console.error('Error fetching results:', error);
	}
}

function displayResults(problem, results) {
	document.getElementById('problemTitle').innerText = `Results for Problem: ${problem}`;
	const resultsContainer = document.getElementById('resultsContainer');
	resultsContainer.innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>File Name</th>
                    <th>Functions</th>
                    <th>Classes</th>
                    <th>Variables</th>
                    <th>Points</th>
                    <th>Percentage</th>
                </tr>
            </thead>
            <tbody>
                ${results.map(result => `
                    <tr>
                        <td>${result.fileName}</td>
                        <td>${result.specProgrammers.functions.join(', ')}</td>
                        <td>${result.specProgrammers.classes.join(', ')}</td>
                        <td>${result.specProgrammers.variables.join(', ')}</td>
                        <td>
                            Function Points: ${result.specProgrammers.points.functionPoints}<br>
                            Class Points: ${result.specProgrammers.points.classPoints}<br>
                            Variable Points: ${result.specProgrammers.points.variablePoints}<br>
                            Equal Compile Points: ${result.specProgrammers.points.equalCompilePoints}<br>
                            Total Points: ${result.specProgrammers.points.totalPoints}
                        </td>
                        <td>${result.percentageActuals}%</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}
