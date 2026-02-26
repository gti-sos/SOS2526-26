const { cargaCalculaMediaRFR } = require('./index-RFR.js');
const { average } = require('./index-MGN.js');
const { targetCountry } = require('./index-MGN.js');
const { dataClean } = require("./index-MGN.js");
let cool = require("cool-ascii-faces");
let express = require('express');
const app = express();
app.use(express.json()); 
app.use("/", express.static("./static"));
const BASE_API_URL = "/api/v1";


app.get('/cool', (req, res) => {
    // cool() devuelve una cadena de texto con una cara aleatoria
    res.send(`<html><body><h1>${cool()}</h1></body></html>`);
});

app.get('/samples/RFR', (req, res) => {
    const resultado = cargaCalculaMediaRFR();
    res.send(`<h1>Media del valor de la selección inglesa en los últimos años: ${resultado}</h1>`);
});

app.get('/samples/MGN', (req, res) => { 
    const result = average.toFixed(2);  
    const country = targetCountry;
    res.send(`<html><body><h2> Algoritmo de MGN: </h2><p> Target Country = ${country}</p><p> Average Score = ${result}</p></body></html>`);
});

app.get(BASE_API_URL + "/national-team-rankings-per-years", (req, res) => {
    console.log("New GET request to /national-team-rankings-per-years");
    res.json(dataClean); 
});





app.get('/about', (req, res) => {
    // cool() devuelve una cadena de texto con una cara aleatoria
    res.send(`<html><body><h1>${cool()}</h1></body></html>`);
});
// -----------------------------

app.listen(process.env.PORT || 3000, () => {
    console.log('Server is running on http://localhost:3000');
});








// IMPORTANTE: Para que tu API pueda recibir datos en el futuro (POST/PUT)




