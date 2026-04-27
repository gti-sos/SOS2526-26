import Datastore from 'nedb';
import path from 'path';

// 1. Inicialización de la base de datos
const db = new Datastore({ filename: './data/rankings1.db', autoload: true });

// Función auxiliar para limpiar el _id de NeDB
function cleanResource(resource) {
    if (Array.isArray(resource)) {
        return resource.map(r => {
            const newItem = { ...r };
            delete newItem._id;
            return newItem;
        });
    } else if (resource) {
        const newItem = { ...resource };
        delete newItem._id;
        return newItem;
    }
    return resource;
}

// Función auxiliar para validar la estructura del JSON
function isValidResource(body) {
    const validKeys = ["country", "year", "rank", "score", "rank_variation_from_two_thousand_eighteen"];
    const bodyKeys = Object.keys(body);

    if (bodyKeys.length !== validKeys.length) return false;

    const hasAllKeys = validKeys.every(key => bodyKeys.includes(key));
    if (!hasAllKeys) return false;

    if (typeof body.country !== 'string' || 
        typeof body.year !== 'number' || 
        typeof body.rank !== 'number' || 
        typeof body.score !== 'number' || 
        typeof body.rank_variation_from_two_thousand_eighteen !== 'number') {
        return false;
    }

    return true;
}

export default function(app) {
    const MGN_URL = "/api/v1/national-team-rankings-per-years";

    // --- RUTA DOCUMENTACIÓN ---
    app.get(MGN_URL + "/docs", (req, res) => {
        res.redirect("https://documenter.getpostman.com/view/53034281/2sBXigNZXJ");
    });

    // --- 1. GET a la colección (con Búsqueda y Paginación) ---
    app.get(MGN_URL, (req, res) => {
        let query = {};
        
        if (req.query.country) query.country = req.query.country;
        if (req.query.year) query.year = Number(req.query.year);
        if (req.query.rank) query.rank = Number(req.query.rank);
        if (req.query.score) query.score = Number(req.query.score);
        if (req.query.rank_variation_from_two_thousand_eighteen) {
            query.rank_variation_from_two_thousand_eighteen = Number(req.query.rank_variation_from_two_thousand_eighteen);
        }
        // .
        let offset = parseInt(req.query.offset) || 0;
        let limit = parseInt(req.query.limit) || 0;

        db.find(query).skip(offset).limit(limit).exec((err, docs) => {
            if (err) {
                res.sendStatus(500);
            } else {
                res.status(200).json(cleanResource(docs));
            }
        });
    });

    // --- 2. GET para cargar datos iniciales  ---
    app.get(MGN_URL + "/loadInitialData", (req, res) => {
        const initial_rankings = [
            { "country": "Alemania", "year": 2018, "rank": 1, "score": 1533, "rank_variation_from_two_thousand_eighteen": 0 },
            { "country": "Angola", "year": 2025, "rank": 87, "score": 1279.55, "rank_variation_from_two_thousand_eighteen": 1 },
            { "country": "Albania", "year": 2026, "rank": 63, "score": 1401.07, "rank_variation_from_two_thousand_eighteen": 2 },
            { "country": "Andorra", "year": 2020, "rank": 135, "score": 1082, "rank_variation_from_two_thousand_eighteen": 3 },
            { "country": "Afganistán", "year": 2024, "rank": 158, "score": 1017.68, "rank_variation_from_two_thousand_eighteen": 4 },
            { "country": "Anguila", "year": 2019, "rank": 208, "score": 864, "rank_variation_from_two_thousand_eighteen": 5 },
            { "country": "Antigua y Barbuda", "year": 2023, "rank": 133, "score": 1107.51, "rank_variation_from_two_thousand_eighteen": 6 },
            { "country": "Alemania", "year": 2026, "rank": 10, "score": 1724.15, "rank_variation_from_two_thousand_eighteen": 7 },
            { "country": "Albania", "year": 2018, "rank": 56, "score": 549, "rank_variation_from_two_thousand_eighteen": 8 },
            { "country": "Andorra", "year": 2026, "rank": 172, "score": 949.44, "rank_variation_from_two_thousand_eighteen": 9 }
        ];

        db.count({}, (err, count) => {
            if (count > 0) {
                res.status(400).send("La base de datos ya tiene datos. Carga abortada.");
            } else {
                db.insert(initial_rankings, (err, newDocs) => {
                    res.status(201).json(cleanResource(newDocs));
                });
            }
        });
    });

    // --- 3. POST a la colección ---
    app.post(MGN_URL, (req, res) => {
        const newData = req.body;
        if (!isValidResource(newData)) return res.sendStatus(400);

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

    // --- 7. PUT a un recurso específico ---
    app.put(MGN_URL + "/:country/:year", (req, res) => {
        const { country, year } = req.params;
        const updatedData = req.body;

        if (!isValidResource(updatedData)) return res.sendStatus(400);
        if (country !== updatedData.country || Number(year) !== updatedData.year) {
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
    app.post(MGN_URL + "/:country/:year", (req, res) => res.sendStatus(405));
    app.put(MGN_URL, (req, res) => res.sendStatus(405));
};