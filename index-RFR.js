
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

function cargarDatosRFR() {
let teams = [
  { "year": 2026, "country": "England", "age": 25, "value": 1300, "percentage": 56.9 },
  { "year": 2026, "country": "France", "age": 25, "value": 1290, "percentage": 55.9 },
  { "year": 2026, "country": "Brazil", "age": 26, "value": 932, "percentage": 46.3 },
  { "year": 2026, "country": "Portugal", "age": 23, "value": 841, "percentage": 47.9 },
  { "year": 2026, "country": "Spain", "age": 27, "value": 1150, "percentage": 41.5 },
  { "year": 2026, "country": "Argentina", "age": 23, "value": 575, "percentage": 39.8 },
  { "year": 2026, "country": "Germany", "age": 23, "value": 828, "percentage": 40.9 },
  { "year": 2026, "country": "Netherlands", "age": 22, "value": 808, "percentage": 33.9 },
  { "year": 2026, "country": "Italy", "age": 26, "value": 827, "percentage": 33.8 },
  { "year": 2026, "country": "Belgium", "age": 24, "value": 442, "percentage": 34.4 },
  { "year": 2025, "country": "England", "age": 25, "value": 1220, "percentage": 48.8 }
]
return teams;
}
module.exports = { cargarDatosRFR, cargaCalculaMediaRFR };