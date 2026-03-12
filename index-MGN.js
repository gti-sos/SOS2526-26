const Datastore = require('nedb');
const path = require('path');

// 1. Inicialización de la base de datos
// Se guardará en la carpeta /data/ del proyecto
const db = new Datastore({ filename: './data/rankings.db', autoload: true });

// Función auxiliar para limpiar el _id de NeDB antes de enviar la respuesta
// (Requisito obligatorio del Backlog)
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
    const MGN_URL = "/api/v1/national-team-rankings-per-years";

    // --- RUTA DOCUMENTACIÓN ---
    app.get(MGN_URL + "/docs", (req, res) => {
        res.redirect("TU_URL_DE_POSTMAN_AQUI");
    });

    // --- 1. GET a la colección (Listar todos los recursos) ---
    app.get(MGN_URL, (req, res) => {
        db.find({}, (err, docs) => {
            res.status(200).json(cleanResource(docs));
        });
    });

    // --- 2. GET para cargar datos iniciales ---
    app.get(MGN_URL + "/loadInitialData", (req, res) => {
        const initial_rankings = [
            { "country": "Alemania", "year": 2018, "rank": 1, "score": 1533 },
            { "country": "Angola", "year": 2025, "rank": 87, "score": 1279.55 },
            { "country": "Albania", "year": 2026, "rank": 63, "score": 1401.07 },
            { "country": "Andorra", "year": 2020, "rank": 135, "score": 1082 },
            { "country": "Afganistán", "year": 2024, "rank": 158, "score": 1017.68 },
            { "country": "Anguila", "year": 2019, "rank": 208, "score": 864 },
            { "country": "Antigua y Barbuda", "year": 2023, "rank": 133, "score": 1107.51 },
            { "country": "Alemania", "year": 2026, "rank": 10, "score": 1724.15 },
            { "country": "Albania", "year": 2018, "rank": 56, "score": 549 },
            { "country": "Andorra", "year": 2026, "rank": 172, "score": 949.44 }
        ];

        db.count({}, (err, count) => {
            if (count > 0) {
                res.status(400).send("Database already has data. Load aborted.");
            } else {
                db.insert(initial_rankings, (err, newDocs) => {
                    res.status(201).json(cleanResource(newDocs));
                });
            }
        });
    });

    // --- 3. POST a la colección (Crear recurso) ---
    app.post(MGN_URL, (req, res) => {
        const newData = req.body;

        // Validación: ¿Tiene todos los campos? (400)
        if (!newData.country || !newData.year || newData.rank === undefined || newData.score === undefined) {
            return res.sendStatus(400);
        }

        // Validación: ¿Ya existe? (409)
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

    // --- 4. GET a un recurso específico (Identificador compuesto: país/año) ---
    app.get(MGN_URL + "/:country/:year", (req, res) => {
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
    app.delete(MGN_URL, (req, res) => {
        db.remove({}, { multi: true }, (err, numRemoved) => {
            res.sendStatus(200);
        });
    });

    // --- 6. DELETE a un recurso específico ---
    app.delete(MGN_URL + "/:country/:year", (req, res) => {
        const { country, year } = req.params;
        db.remove({ country: country, year: Number(year) }, {}, (err, numRemoved) => {
            if (numRemoved > 0) {
                res.sendStatus(200);
            } else {
                res.sendStatus(404);
            }
        });
    });

    // --- 7. PUT a un recurso específico (Actualizar) ---
    app.put(MGN_URL + "/:country/:year", (req, res) => {
        const { country, year } = req.params;
        const updatedData = req.body;

        // El ID de la URL debe coincidir con el del cuerpo (400)
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

    // --- MÉTODOS NO PERMITIDOS (405) ---
    app.post(MGN_URL + "/:country/:year", (req, res) => res.sendStatus(405));
    app.put(MGN_URL, (req, res) => res.sendStatus(405));
};