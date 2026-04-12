import Datastore from 'nedb';
import express from 'express';
import cors from 'cors';
const app = express();

app.use(cors({
    origin: [
        "https://SOS2526-26.onrender.com", // Producción
        "http://localhost:8080",            // Tu frontend local (ajusta el puerto si es otro)
        "http://localhost:5173"             // Puerto común de Svelte/Vite
    ]
}));

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

export default function(app) {
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