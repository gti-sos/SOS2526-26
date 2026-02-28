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

// --- RECURSO: countries-idh-per-years ---

// 1. GET a la colección (Ya lo tenías, corregido para no enviar texto plano)
app.get(BASE_API_URL + "/countries-idh-per-years", (req, res) => {
    res.status(200).json(data); 
});

// 2. POST a la colección (Crear un nuevo recurso)
app.post(BASE_API_URL + "/countries-idh-per-years", (req, res) => {
    const newData = req.body;
    // Validar que el cuerpo contenga todos los campos necesarios
    if (!newData.country || !newData.year || !newData.hdi_value || !newData.hdi_rank || !newData.hdi_change) {
        return res.sendStatus(400); // Bad Request (Faltan campos)
    }
    // Comprobar si ya existe (Conflicto)
    const exists = data.some(d => d.country === newData.country && d.year === newData.year);
    if (exists) {
        return res.sendStatus(409); // Conflict
    }
    data.push(newData);
    res.sendStatus(201); // Created
});

// 3. GET a un recurso específico (por país y año)
app.get(BASE_API_URL + "/countries-idh-per-years/:country/:year", (req, res) => {
    const { country, year } = req.params;
    const resource = data.find(d => d.country === country && d.year == year);
    if (resource) {
        res.status(200).json(resource);
    } else {
        res.sendStatus(404); // Not Found
    }
});

// 4. DELETE a la colección completa
app.delete(BASE_API_URL + "/countries-idh-per-years", (req, res) => {
    data = [];
    res.sendStatus(200); // OK
});

// 5. DELETE a un recurso específico
app.delete(BASE_API_URL + "/countries-idh-per-years/:country/:year", (req, res) => {
    const { country, year } = req.params;
    const initialLength = data.length;
    data = data.filter(d => !(d.country === country && d.year == year));
    if (data.length < initialLength) {
        res.sendStatus(200);
    } else {
        res.sendStatus(404);
    }
});

// 6. PUT a un recurso específico (Actualizar)
app.put(BASE_API_URL + "/countries-idh-per-years/:country/:year", (req, res) => {
    const { country, year } = req.params;
    const updatedData = req.body;

    // El ID (país/año) del cuerpo debe coincidir con el de la URL
    if (country !== updatedData.country || year != updatedData.year) {
        return res.sendStatus(400); // Bad Request
    }

    const index = data.findIndex(d => d.country === country && d.year == year);
    if (index !== -1) {
        data[index] = updatedData;
        res.sendStatus(200);
    } else {
        res.sendStatus(404);
    }
});

// --- MÉTODOS NO PERMITIDOS (Regla de la Tabla Azul) ---

app.post(BASE_API_URL + "/countries-idh-per-years/:country/:year", (req, res) => {
    res.sendStatus(405); // Method Not Allowed
});

app.put(BASE_API_URL + "/countries-idh-per-years", (req, res) => {
    res.sendStatus(405); // Method Not Allowed
});

app.get(BASE_API_URL + "/countries-idh-per-years/loadInitialData", (req, res) => {
    if (data.length === 0) {
        // Usamos push para asegurar que modificamos el array original 'data'
        initialData.forEach(item => {
            data.push(item);
        });
        console.log("Datos cargados:", data.length);
        res.status(201).json(data); // Ahora verás los datos en pantalla al cargar
    } else {
        res.status(400).send("El array no está vacío.");
    }
});

// -----------------------------------------


app.get('/about', (req, res) => {
    // cool() devuelve una cadena de texto con una cara aleatoria
    res.send(`<html><body><h1>${cool()}</h1></body></html>`);
});
// -----------------------------

app.listen(process.env.PORT || 3000, () => {
    console.log('Server is running on http://localhost:3000');
}); 





