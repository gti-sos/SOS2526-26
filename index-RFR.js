
function cargaCalculaMediaRFR() {
    let datos = new Array();
datos[0] = [2026,"England",25,1300,56.90]
datos[1] = [2026,"France",25,1290,55.90]
datos[2] = [2026,"Brazil",26,932,46.30]
datos[3] = [2026,"Portugal",23,841,47.90]
datos[4] = [2026,"Spain",27,1150,41.50]
datos[5] = [2026,"Argentina",23,575,39.80]
datos[6] = [2026,"Germany",23,828,40.90]
datos[7] = [2026,"Netherlands",22,808,33.90]
datos[8] = [2026,"Italy",26,827,33.80]
datos[9] = [2026,"Belgium",24,442,34.40]
datos[10] = [2025,"England",25,1220,48.80]

// Calcular la media del valor total de las plantillas de la selección inglesa
let filtrado = datos.filter(dato => dato[1] === "England").map(dato => dato[3]);
let total = filtrado.reduce((a,n) => a + n);
let cont = filtrado.length;
console.log("La media del valor total de las plantillas de la selección inglesa es", total/cont);
return total/cont;
}
module.exports = { cargaCalculaMediaRFR };