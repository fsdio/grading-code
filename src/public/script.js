// script.js

// Fungsi untuk mengirimkan request ke server dengan method POST
async function postData(url, formData) {
	const response = await fetch(url, {
		method: 'POST',
		body: formData
	});
	return await response.json();
}

// Fungsi untuk menampilkan hasil evaluasi
function showResults(results) {
	const resultsList = document.getElementById('resultsList');
	resultsList.innerHTML = '';
	
	results.forEach(result => {
		const li = document.createElement('li');
		const h3 = document.createElement('h3');
		const p = document.createElement('p');
		
		h3.textContent = result.fileName;
		p.textContent = `Percentage Actuals: ${result.percentageActuals}%`;
		
		li.appendChild(h3);
		li.appendChild(p);
		resultsList.appendChild(li);
	});
}

// Event listener untuk form upload
const uploadForm = document.getElementById('uploadForm');
uploadForm.addEventListener('submit', async function(event) {
	event.preventDefault();
	const formData = new FormData(uploadForm);
	const response = await postData('/upload', formData);
	showResults(response.results);
});

// Fungsi untuk mengambil dan menampilkan hasil evaluasi saat halaman dimuat
async function fetchAndShowResults() {
	const response = await fetch('/programmers');
	const results = await response.json();
	showResults(results);
}

// Panggil fungsi fetchAndShowResults saat halaman dimuat
fetchAndShowResults().then();
