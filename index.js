const { cargaCalculaMediaRFR } = require('./index-RFR.js');
let cool = require("cool-ascii-faces");
let express = require('express');

const app = express();

app.use("/", express.static("./static"));

app.get('/cool', (req, res) => {
    // cool() devuelve una cadena de texto con una cara aleatoria
    res.send(`<html><body><h1>${cool()}</h1></body></html>`);
});

app.get('/samples/RFR', (req, res) => {
    const resultado = cargaCalculaMediaRFR();
    res.send(`<h1>Media del valor de la selección inglesa en los últimos años: ${resultado}</h1>`);
});


app.get('/about', (req, res) => {
    // cool() devuelve una cadena de texto con una cara aleatoria
    res.send(`<html><body><h1>${cool()}</h1></body></html>`);
});
// -----------------------------

app.listen(process.env.PORT || 3000, () => {
    console.log('Server is running on http://localhost:3000');
});