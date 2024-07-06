class GanjilGenap {
	constructor(angka) {
		this.angka = angka;
	}
	getHasil() {
		return (this.angka % 2 === 0) ? 'Genap' : 'Ganjil';
	}
}

const angka = 1;
const verifyAngka = new GanjilGenap(angka);
console.log(verifyAngka.getHasil());
