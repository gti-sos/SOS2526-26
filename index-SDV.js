const Datastore = require('nedb');

// 1. Inicialización de la base de datos para Sergio
const db = new Datastore({ filename: './data/idh.db', autoload: true });

// Función auxiliar para eliminar el _id de NeDB (Requisito F06)
function cleanResource(resource) {
    if (Array.isArray(resource)) {
        return resource.map(r => {
            delete r._id;
            return r;
        });
    } else if (resource) {
        delete resource._id;
    }
    return resource;
}

module.exports = function(app) {
    const SDV_URL = "/api/v1/countries-idh-per-years";

    // --- RUTA DOCUMENTACIÓN ---
    app.get("/api/v1/countries-idh-per-years/docs", (req, res) => {
    res.redirect("https://documenter.getpostman.com/view/52429610/2sBXietaKH");
    });

    // --- 1. GET a la colección ---
    // GET de la colección (con Búsquedas, Paginación y Limpieza de _id)
    app.get("/api/v1/countries-idh-per-years", (req, res) => {
        // 1. Extraemos parámetros de paginación
        let offset = parseInt(req.query.offset) || 0;
        let limit = parseInt(req.query.limit) || 0;

        // 2. Construimos el objeto de búsqueda dinámico (Query)
        let query = {};

        // Filtros de texto
        if (req.query.country) query.country = req.query.country;
        
        // Filtros numéricos (convertimos a número para que NeDB los encuentre)
        if (req.query.year) query.year = parseInt(req.query.year);
        if (req.query.hdi_value) query.hdi_value = parseFloat(req.query.hdi_value);
        if (req.query.hdi_rank) query.hdi_rank = parseInt(req.query.hdi_rank);
        if (req.query.hdi_change) query.hdi_change = parseInt(req.query.hdi_change);

        // 3. Ejecutamos la consulta en NeDB
        db.find(query).skip(offset).limit(limit).exec((err, countries) => {
            if (err) {
                console.error("Error accediendo a la DB: " + err);
                res.sendStatus(500);
            } else {
                // 4. Limpieza: Quitamos el campo _id de cada objeto antes de enviarlo
                const countriesClean = countries.map((c) => {
                    delete c._id;
                    return c;
                });
                res.status(200).send(countriesClean);
            }
        });
    });

    // borrar

    // --- 2. GET para cargar datos iniciales ---
    app.get(SDV_URL + "/loadInitialData", (req, res) => {
        const initialData = [
            {"year":2022,"country":"españa","hdi_value":0.911,"hdi_rank":27,"hdi_change":1},
            {"year":2022,"country":"alemania","hdi_value":0.95,"hdi_rank":7,"hdi_change":0},
            {"year":2022,"country":"reino-unido","hdi_value":0.94,"hdi_rank":15,"hdi_change":2},
            {"year":2022,"country":"francia","hdi_value":0.91,"hdi_rank":28,"hdi_change":-1},
            {"year":2022,"country":"italia","hdi_value":0.906,"hdi_rank":30,"hdi_change":0},
            {"year":2022,"country":"portugal","hdi_value":0.874,"hdi_rank":42,"hdi_change":-3},
            {"year":2022,"country":"estados-unidos","hdi_value":0.927,"hdi_rank":20,"hdi_change":1},
            {"year":2022,"country":"japón","hdi_value":0.92,"hdi_rank":24,"hdi_change":-2},
            {"year":2022,"country":"china","hdi_value":0.788,"hdi_rank":75,"hdi_change":-1},
            {"year":2021,"country":"españa","hdi_value":0.904,"hdi_rank":28,"hdi_change":1}
        ];

        db.count({}, (err, count) => {
            if (count > 0) {
                res.status(400).send("Database already has data.");
            } else {
                db.insert(initialData, (err, newDocs) => {
                    res.status(201).json(cleanResource(newDocs));
                });
            }
        });
    });

    // --- 3. POST a la colección ---
    app.post(SDV_URL, (req, res) => {
        const newData = req.body;

        // Validación 400: ¿Están todos los campos?
        if (!newData.country || !newData.year || newData.hdi_value === undefined || 
            newData.hdi_rank === undefined || newData.hdi_change === undefined) {
            return res.sendStatus(400);
        }

        // Validación 409: ¿Ya existe?
        db.find({ country: newData.country, year: Number(newData.year) }, (err, docs) => {
            if (docs.length > 0) {
                res.sendStatus(409);
            } else {
                db.insert(newData, (err, newDoc) => {
                    res.status(201).json(cleanResource(newDoc));
                });
            }
        });
    });

    // --- 4. GET a un recurso específico ---
    app.get(SDV_URL + "/:country/:year", (req, res) => {
        const { country, year } = req.params;
        db.findOne({ country: country, year: Number(year) }, (err, doc) => {
            if (doc) {
                res.status(200).json(cleanResource(doc));
            } else {
                res.sendStatus(404);
            }
        });
    });

    // --- 5. DELETE a la colección completa ---
    app.delete(SDV_URL, (req, res) => {
        db.remove({}, { multi: true }, (err, numRemoved) => {
            res.sendStatus(200);
        });
    });

    // --- 6. DELETE a un recurso específico ---
    app.delete(SDV_URL + "/:country/:year", (req, res) => {
        const { country, year } = req.params;
        db.remove({ country: country, year: Number(year) }, {}, (err, numRemoved) => {
            if (numRemoved > 0) {
                res.sendStatus(200);
            } else {
                res.sendStatus(404);
            }
        });
    });

    // --- 7. PUT a un recurso específico ---
    app.put(SDV_URL + "/:country/:year", (req, res) => {
        const { country, year } = req.params;
        const updatedData = req.body;

        // Validación 400: El ID de la URL y el cuerpo deben coincidir
        if (country !== updatedData.country || year != updatedData.year) {
            return res.sendStatus(400);
        }

        db.update({ country: country, year: Number(year) }, updatedData, {}, (err, numReplaced) => {
            if (numReplaced > 0) {
                res.sendStatus(200);
            } else {
                res.sendStatus(404);
            }
        });
    });

    // --- MÉTODOS NO PERMITIDOS ---
    app.post(SDV_URL + "/:country/:year", (req, res) => res.sendStatus(405));
    app.put(SDV_URL, (req, res) => res.sendStatus(405));
};