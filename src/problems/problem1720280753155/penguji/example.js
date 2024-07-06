class GanjilGenap {
	constructor(angka) {
		this.angka = angka;
	}
	getHasil() {
		return ['Genap', 'Ganjil'][this.angka % 2];
	}
}

const angka = 1;
const verifyAngka = new GanjilGenap(angka);
console.log(verifyAngka.getHasil());
