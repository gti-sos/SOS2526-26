import Datastore from 'nedb';
import express from 'express';
import cors from 'cors';
const app = express();


// 1. Inicialización de la base de datos
const db = new Datastore({ filename: './data/idh.db', autoload: true });

// Función auxiliar para eliminar el _id de NeDB (Requisito F06)
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

export default function (app) {
    const SDV_URL = "/api/v2/countries-idh-per-years";

    // --- RUTA DOCUMENTACIÓN (CORREGIDA: Se añade /docs para no pisar la ruta principal) ---
    app.get(SDV_URL + "/docs", (req, res) => {
        res.redirect("https://documenter.getpostman.com/view/52429610/2sBXinGqPs");
    });

    // --- 1. GET a la colección con búsquedas, filtros y paginación ---
    app.get(SDV_URL, (req, res) => {
        let offset = parseInt(req.query.offset) || 0;
        let limit = parseInt(req.query.limit) || 0;

        // Extraemos los posibles parámetros de búsqueda de req.query
        let { country, from, to, year, hdi_value, hdi_rank, hdi_change } = req.query;
        let query = {};

        // Filtro por país (Búsqueda insensible a mayúsculas/minúsculas)
        if (country) {
            query.country = { $regex: new RegExp("^" + country + "$", "i") };
        }

        // Filtro por rango de años (from y to)
        if (from || to) {
            query.year = {};
            if (from) query.year.$gte = Number(from);
            if (to) query.year.$lte = Number(to);
        }

        // Otros filtros exactos (si existen en la query)
        if (year && !query.year) query.year = Number(year);
        if (hdi_value) query.hdi_value = parseFloat(hdi_value);
        if (hdi_rank) query.hdi_rank = Number(hdi_rank);
        if (hdi_change) query.hdi_change = Number(hdi_change);

        db.find(query).skip(offset).limit(limit).exec((err, countries) => {
            if (err) {
                console.error("Error accediendo a la DB: " + err);
                res.sendStatus(500);
            } else {
                res.status(200).send(cleanResource(countries));
            }
        });
    });

    // --- 2. GET para cargar datos iniciales ---
    app.get(SDV_URL + "/loadInitialData", (req, res) => {
        const initialData = [
            // --- ESPAÑA (Muy Alto) ---
            { "year": 2023, "country": "españa", "hdi_value": 0.918, "hdi_rank": 28, "hdi_change": 0 },
            { "year": 2022, "country": "españa", "hdi_value": 0.911, "hdi_rank": 27, "hdi_change": 1 },
            { "year": 2021, "country": "españa", "hdi_value": 0.904, "hdi_rank": 27, "hdi_change": 0 },
            { "year": 2020, "country": "españa", "hdi_value": 0.899, "hdi_rank": 28, "hdi_change": -1 },
            { "year": 2018, "country": "españa", "hdi_value": 0.905, "hdi_rank": 26, "hdi_change": 0 },
            { "year": 2015, "country": "españa", "hdi_value": 0.895, "hdi_rank": 26, "hdi_change": 0 },

            // --- ESTADOS UNIDOS (Muy Alto) ---
            { "year": 2023, "country": "estados-unidos", "hdi_value": 0.938, "hdi_rank": 17, "hdi_change": 3 },
            { "year": 2022, "country": "estados-unidos", "hdi_value": 0.927, "hdi_rank": 20, "hdi_change": 1 },
            { "year": 2021, "country": "estados-unidos", "hdi_value": 0.921, "hdi_rank": 21, "hdi_change": 0 },
            { "year": 2020, "country": "estados-unidos", "hdi_value": 0.920, "hdi_rank": 21, "hdi_change": -1 },
            { "year": 2015, "country": "estados-unidos", "hdi_value": 0.912, "hdi_rank": 15, "hdi_change": 0 },

            // --- CHINA (Alto) ---
            { "year": 2023, "country": "china", "hdi_value": 0.797, "hdi_rank": 78, "hdi_change": -3 },
            { "year": 2022, "country": "china", "hdi_value": 0.788, "hdi_rank": 75, "hdi_change": 1 },
            { "year": 2021, "country": "china", "hdi_value": 0.768, "hdi_rank": 79, "hdi_change": 2 },
            { "year": 2018, "country": "china", "hdi_value": 0.755, "hdi_rank": 85, "hdi_change": 1 },
            { "year": 2015, "country": "china", "hdi_value": 0.733, "hdi_rank": 90, "hdi_change": 1 },

            // --- FRANCIA (Muy Alto) ---
            { "year": 2023, "country": "francia", "hdi_value": 0.920, "hdi_rank": 26, "hdi_change": 2 },
            { "year": 2022, "country": "francia", "hdi_value": 0.910, "hdi_rank": 28, "hdi_change": -1 },
            { "year": 2021, "country": "francia", "hdi_value": 0.903, "hdi_rank": 28, "hdi_change": 0 },
            { "year": 2015, "country": "francia", "hdi_value": 0.890, "hdi_rank": 22, "hdi_change": 0 },

            // --- JAPÓN (Muy Alto) ---
            { "year": 2023, "country": "japón", "hdi_value": 0.925, "hdi_rank": 23, "hdi_change": 1 },
            { "year": 2022, "country": "japón", "hdi_value": 0.920, "hdi_rank": 24, "hdi_change": -2 },
            { "year": 2021, "country": "japón", "hdi_value": 0.917, "hdi_rank": 22, "hdi_change": 1 },
            { "year": 2015, "country": "japón", "hdi_value": 0.905, "hdi_rank": 19, "hdi_change": 0 },

            // --- INDIA (Medio) ---
            { "year": 2023, "country": "india", "hdi_value": 0.685, "hdi_rank": 130, "hdi_change": 4 },
            { "year": 2022, "country": "india", "hdi_value": 0.644, "hdi_rank": 134, "hdi_change": 1 },
            { "year": 2021, "country": "india", "hdi_value": 0.633, "hdi_rank": 135, "hdi_change": -1 },
            { "year": 2015, "country": "india", "hdi_value": 0.627, "hdi_rank": 130, "hdi_change": 0 },

            // --- NORUEGA (Líder mundial - Muy Alto) ---
            { "year": 2023, "country": "noruega", "hdi_value": 0.970, "hdi_rank": 2, "hdi_change": 0 },
            { "year": 2022, "country": "noruega", "hdi_value": 0.967, "hdi_rank": 2, "hdi_change": 0 },
            { "year": 2021, "country": "noruega", "hdi_value": 0.969, "hdi_rank": 2, "hdi_change": -1 },
            { "year": 2015, "country": "noruega", "hdi_value": 0.959, "hdi_rank": 1, "hdi_change": 0 },

            // --- BRASIL (Desarrollo Alto) ---
            { "year": 2023, "country": "brasil", "hdi_value": 0.786, "hdi_rank": 84, "hdi_change": 3 },
            { "year": 2022, "country": "brasil", "hdi_value": 0.776, "hdi_rank": 87, "hdi_change": -1 },
            { "year": 2021, "country": "brasil", "hdi_value": 0.754, "hdi_rank": 87, "hdi_change": 0 },
            { "year": 2015, "country": "brasil", "hdi_value": 0.761, "hdi_rank": 75, "hdi_change": 0 },

            // --- NIGERIA (Desarrollo Bajo/Medio) ---
            { "year": 2023, "country": "nigeria", "hdi_value": 0.548, "hdi_rank": 161, "hdi_change": 2 },
            { "year": 2022, "country": "nigeria", "hdi_value": 0.540, "hdi_rank": 163, "hdi_change": 0 },
            { "year": 2021, "country": "nigeria", "hdi_value": 0.535, "hdi_rank": 163, "hdi_change": -2 },
            { "year": 2015, "country": "nigeria", "hdi_value": 0.523, "hdi_rank": 158, "hdi_change": 0 },

            // --- AUSTRALIA (Oceanía - Muy Alto) ---
            { "year": 2023, "country": "australia", "hdi_value": 0.958, "hdi_rank": 7, "hdi_change": 3 },
            { "year": 2022, "country": "australia", "hdi_value": 0.952, "hdi_rank": 10, "hdi_change": -5 },
            { "year": 2021, "country": "australia", "hdi_value": 0.954, "hdi_rank": 5, "hdi_change": 3 },
            { "year": 2015, "country": "australia", "hdi_value": 0.938, "hdi_rank": 8, "hdi_change": 0 }
        ];

        db.count({}, (err, count) => {
            if (count > 0) {
                res.status(400).send("Database already has data.");
            } else {
                db.insert(initialData, (err, newDocs) => {
                    if (err) return res.sendStatus(500);
                    res.status(201).json(cleanResource(newDocs));
                });
            }
        });
    });

    // --- 3. POST a la colección ---
    app.post(SDV_URL, (req, res) => {
        const newData = req.body;

        // Validación de campos requeridos
        if (!newData.country || !newData.year || newData.hdi_value === undefined ||
            newData.hdi_rank === undefined || newData.hdi_change === undefined) {
            return res.status(400).send("Faltan campos obligatorios");
        }

        db.find({ country: newData.country, year: Number(newData.year) }, (err, docs) => {
            if (docs.length > 0) {
                res.sendStatus(409); // Conflicto: Ya existe el recurso
            } else {
                db.insert(newData, (err, newDoc) => {
                    if (err) return res.sendStatus(500);
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
            if (err) return res.sendStatus(500);
            res.sendStatus(200);
        });
    });

    // --- 6. DELETE a un recurso específico ---
    app.delete(SDV_URL + "/:country/:year", (req, res) => {
        const { country, year } = req.params;
        db.remove({ country: country, year: Number(year) }, {}, (err, numRemoved) => {
            if (err) return res.sendStatus(500);
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

        // Comprobamos que el ID de la URL coincide con el del cuerpo
        if (country !== updatedData.country || Number(year) !== Number(updatedData.year)) {
            return res.status(400).send("El país o el año no coinciden con la URL.");
        }

        db.update({ country: country, year: Number(year) }, updatedData, {}, (err, numReplaced) => {
            if (err) return res.sendStatus(500);
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