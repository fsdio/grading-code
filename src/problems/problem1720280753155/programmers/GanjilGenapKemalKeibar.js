class GanjilGenap {
	constructor(angka) {
		this.angka = angka;
	}
	getHasil() {
		if (this.angka % 2 === 0) {
			return 'Genap';
		} else {
			return 'Ganjil';
		}
	}
}
const angka = 1;
const verifyAngka = new GanjilGenap(angka);
console.log(verifyAngka.getHasil());
