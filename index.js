const { cargaCalculaMediaRFR, router } = require('./index-RFR.js');
const { average } = require('./index-MGN.js');
const { targetCountry } = require('./index-MGN.js');
const { dataClean, initial_rankings } = require("./index-MGN.js");
const { calcula_IDH, initialData } = require('./index-SDV.js');
let data = []
let cool = require("cool-ascii-faces");
let express = require('express');
const app = express();
app.use(express.json()); 
app.use("/", express.static("./static"));
const BASE_API_URL = "/api/v1";

app.use('/api/v1/fifa-squad-value-per-years', router);


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

app.get('/samples/SDV', (req, res) => {
    // Ejecutamos la función que importamos
    const resultado = calcula_IDH(); 
    res.send(`<h1>La media de IDH en España es: ${resultado}</h1>`);
});

app.get(BASE_API_URL + "/national-team-rankings-per-years", (req, res) => {
    console.log("New GET request to /national-team-rankings-per-years");
    res.json(dataClean); 
});

app.get(BASE_API_URL + "/fifa-squad-value-per-years", (req, res) => {
    console.log("New GET request to /fifa-squad-value-per-years");
    datos = cargaCalculaMediaRFR();
    res.json(datos); 
});

app.get(BASE_API_URL + "/national-team-rankings-per-years/loadInitialData", (req, res) => {
    
    if (dataClean.length === 0) {
        // Si el array está vacío, usamos .push() para meter los datos uno a uno
        initial_rankings.forEach(data => {
            dataClean.push(data);
        });
        
        console.log(`Loaded ${initial_rankings.length} initial rankings.`);
        // Devolvemos un código 201 (Created) y los datos cargados
        res.status(201).json(dataClean);
    } else {
        // Si ya tenía datos, avisamos al usuario (error 400 - Bad Request)
        res.status(400).send("Array is not empty. Load aborted to avoid duplicates.");
    }
});

app.get("/api/v1/countries-idh-per-years", (req, res) => {
    res.json(data);
});

app.get("/api/v1/countries-idh-per-years/loadInitialData", (req, res) => {
    if (data.length === 0) {
        data = [...initialData];
        res.status(201).send("Data loaded successfully.");
    } else {
        res.status(400).send("Data array is not empty.");
    }
});





app.get('/about', (req, res) => {
    // cool() devuelve una cadena de texto con una cara aleatoria
    res.send(`<html><body><h1>${cool()}</h1></body></html>`);
});
// -----------------------------

app.listen(process.env.PORT || 3000, () => {
    console.log('Server is running on http://localhost:3000');
}); 





