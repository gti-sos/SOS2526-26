const express = require('express');
const router = express.Router(); // Esto es como una "miniapp" específica para tus rutas
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
  { "year": 2026, "country": "England", "squad_size": 25, "total_market_value": 1300, "average_market_value": 56.9 },
  { "year": 2026, "country": "France", "squad_size": 25, "total_market_value": 1290, "average_market_value": 55.9 },
  { "year": 2026, "country": "Brazil", "squad_size": 26, "total_market_value": 932, "average_market_value": 46.3 },
  { "year": 2026, "country": "Portugal", "squad_size": 23, "total_market_value": 841, "average_market_value": 47.9 },
  { "year": 2026, "country": "Spain", "squad_size": 27, "total_market_value": 1150, "average_market_value": 41.5 },
  { "year": 2026, "country": "Argentina", "squad_size": 23, "total_market_value": 575, "average_market_value": 39.8 },
  { "year": 2026, "country": "Germany", "squad_size": 23, "total_market_value": 828, "average_market_value": 40.9 },
  { "year": 2026, "country": "Netherlands", "squad_size": 22, "total_market_value": 808, "average_market_value": 33.9 },
  { "year": 2026, "country": "Italy", "squad_size": 26, "total_market_value": 827, "average_market_value": 33.8 },
  { "year": 2026, "country": "Belgium", "squad_size": 24, "total_market_value": 442, "average_market_value": 34.4 },
  { "year": 2025, "country": "England", "squad_size": 25, "total_market_value": 1220, "average_market_value": 48.8 }
]
return teams;
}

let datos = cargarDatosRFR();

router.get('/loadInitialData', (req, res) => {
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

// Si intentan hacer POST, PUT o DELETE a /loadInitialData
router.all('/loadInitialData', (req, res) => {
    res.status(405).json({
        status: 405,
        message: `Metodo ${req.method} no permitido en esta ruta.`
    });
});

router.get('/', (req, res) => {
    const { country } = req.params;
    try {
        let filtrado = datos.filter(dato => dato.country === country);
        // 1. Verificamos si hay datos (404 si el array está vacío o no existe)
        if (!filtrado || filtrado.length === 0) {
            return res.status(404).json({
                filtrado
            });
        }

        // 200 → Éxito (OK)
        res.status(200).json(filtrado);

    } catch (error) {
        // 500 o 400 → Error interno o petición mal formulada
        res.status(400).json({
            status: 400,
            message: "Bad Request: Error al procesar la solicitud de datos."
        });
    }
});

router.get('/:country', (req, res) => {
    const { country } = req.params;
    try {
        let filtrado = datos.filter(dato => dato.country === country);
        // 1. Verificamos si hay datos (404 si el array está vacío o no existe)
        if (!filtrado || filtrado.length === 0) {
            return res.status(404).json({
              filtrado
            });
        }

        // 200 → Éxito (OK)
        res.status(200).json(filtrado);

    } catch (error) {
        // 500 o 400 → Error interno o petición mal formulada
        res.status(400).json({
            status: 400,
            message: "Bad Request: Error al procesar la solicitud de datos."
        });
    }
});

router.post('/', (req, res) => {
    const nuevoDato = req.body; // Aquí recibimos lo que el usuario envía

    // 1. Validación básica (Error 400 - Bad Request)
    if (!nuevoDato.country || !nuevoDato.year) {
        return res.status(400).json({
            status: 400,
            message: "Faltan campos obligatorios (country, year)."
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
        message: "CREATED",
        data: nuevoDato
    });
});

router.put('/:country/:year', (req, res) => {
    const { country, year } = req.params;
    const updateData = req.body;
    // 1. [400] Bad Request: El ID de la URL no coincide con el del cuerpo
    // Es una regla de oro: si la URL dice 'Spain' pero el JSON dice 'Italy', está mal.
    if (country !== updateData.country || parseInt(year) !== updateData.year) {
        return res.status(400).json({
            status: 400,
            message: "Bad Request: El país o año de la URL no coinciden con los datos del cuerpo."
        });
    }

    // Buscamos el registro original
    const index = teams.findIndex(t => t.country === country && t.year === parseInt(year));

    // 3. [404] Not Found: Si intentas actualizar algo que no existe
    if (index === -1) {
        return res.status(404).json({
            status: 404,
            message: `Not Found: No existe ningún registro para ${country} en ${year}.`
        });
    }

    // 5. [200] OK: Todo correcto, actualizamos
    teams[index] = updateData;
    res.status(200).json({
        status: 200,
        data: teams[index]
    });
});

// 6. [405] Method Not Allowed: 
// Si alguien intenta hacer PUT a la lista completa (sin país/año)
router.put('/', (req, res) => {
    res.set('Allow', 'GET, POST, DELETE');
    res.status(405).json({
        status: 405,
        message: "Method Not Allowed: No se permite actualizar la colección entera (PUT)."
    });
});

router.delete('/', (req, res) => {
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

router.delete('/:year', (req, res) => {
    const { year } = req.params;
    let filtrado = datos.filter(dato => dato.year === year);
    // 1. Verificamos si ya está vacío (para evitar borrar lo que ya no existe)
    if (filtrado.length === 0) {
        return res.status(404).json({
            status: 404,
            message: "No hay datos para borrar. La lista ya está vacía."
        });
    }

    // 2. Borramos el contenido del array
    // Usar datos.length = 0 es la forma más rápida y limpia de vaciarlo
    filtrado.length = 0; 

    // 3. Éxito → 200 OK
    res.status(200).json({
        status: 200,
        message: "Todos los registros han sido eliminados con éxito.",
        currentSize: datos.length
    });
});

// ¡IMPORTANTE! Exporta el router al final
module.exports = { cargaCalculaMediaRFR, router };