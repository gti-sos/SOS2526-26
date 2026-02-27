const { cargaCalculaMediaRFR, cargarDatosRFR } = require('./index-RFR.js');
const { average } = require('./index-MGN.js');
const { targetCountry } = require('./index-MGN.js');
const { dataClean, initial_rankings } = require("./index-MGN.js");
const { calcula_IDH } = require('./index-SDV.js');
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

let datos = cargarDatosRFR();

app.get(BASE_API_URL + '/fifa-squad-value-per-years/loadInitialData', (req, res) => {
    try {

        // 1. Verificamos si hay datos (404 si el array está vacío o no existe)
        if (!datos || datos.length === 0) {
            return res.status(404).json({
                status: 404,
                message: "No se encontraron datos en el sistema."
            });
        }

        // 200 → Éxito (OK)
        res.status(200).json(datos);

    } catch (error) {
        // 500 o 400 → Error interno o petición mal formulada
        res.status(400).json({
            status: 400,
            message: "Bad Request: Error al procesar la solicitud de datos."
        });
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








// IMPORTANTE: Para que tu API pueda recibir datos en el futuro (POST/PUT)

app.post(BASE_API_URL + '/fifa-squad-value-per-years', (req, res) => {
    const nuevoDato = req.body; // Aquí recibimos lo que el usuario envía

    // 1. Validación básica (Error 400 - Bad Request)
    if (!nuevoDato.country || !nuevoDato.year || !nuevoDato.value) {
        return res.status(400).json({
            status: 400,
            message: "Faltan campos obligatorios (country, year, value)."
        });
    }

    // 2. Simular un conflicto (Error 409 - Conflict)
    // Supongamos que ya existe un registro para ese país y año
    const existe = datos.find(d => d[1] === nuevoDato.country && d[0] === nuevoDato.year);
    
    if (existe) {
        return res.status(409).json({
            status: 409,
            message: "El registro para este país y año ya existe."
        });
    }

    // 3. Éxito (201 - Created)
    // Aquí iría la lógica para hacer un .push() a tu array o guardar en DB
    console.log("Guardando:", nuevoDato);

    // Transformamos el objeto JSON que recibimos en el formato de tu Array
    const formatoArray = [nuevoDato.year, nuevoDato.country, nuevoDato.age, nuevoDato.value, nuevoDato.percentage];
    
    // ¡AQUÍ es donde se añade, no se sustituye!
    datos.push(formatoArray);
    
    res.status(201).json({
        status: 201,
        message: "Registro creado con éxito",
        data: nuevoDato
    });
});

app.delete(BASE_API_URL + '/fifa-squad-value-per-years', (req, res) => {
    // 1. Verificamos si ya está vacío (para evitar borrar lo que ya no existe)
    if (datos.length === 0) {
        return res.status(404).json({
            status: 404,
            message: "No hay datos para borrar. La lista ya está vacía."
        });
    }

    // 2. Borramos el contenido del array
    // Usar datos.length = 0 es la forma más rápida y limpia de vaciarlo
    datos.length = 0; 

    // 3. Éxito → 200 OK
    res.status(200).json({
        status: 200,
        message: "Todos los registros han sido eliminados con éxito.",
        currentSize: datos.length
    });
});




