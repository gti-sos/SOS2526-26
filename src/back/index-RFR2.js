import util from 'util';
import Datastore from 'nedb';

// Polyfills para util (manteniendo tu lógica original)
if (!util.isDate) {
    util.isDate = (obj) => Object.prototype.toString.call(obj) === '[object Date]';
}
if (!util.isRegExp) {
    util.isRegExp = (obj) => Object.prototype.toString.call(obj) === '[object RegExp]';
}

// 1. Inicialización de la base de datos para RFR
const db = new Datastore({ filename: './data/squads.db', autoload: true });

// Función auxiliar para eliminar el _id de NeDB
function cleanResource(resource) {
    if (Array.isArray(resource)) {
        return resource.map(r => {
            if (r) {
                const newItem = { ...r };
                delete newItem._id;
                return newItem;
            }
            return r;
        });
    } else if (resource) {
        const newItem = { ...resource };
        delete newItem._id;
        return newItem;
    }
    return resource;
}

export default function(app) {
    const RFR_URL = "/api/v2/fifa-squad-value-per-years";

    // --- RUTA DOCUMENTACIÓN ---
    app.get(RFR_URL + "/docs", (req, res) => {
        res.redirect("https://documenter.getpostman.com/view/52260149/2sBXinGW4o");
    });

    // 1 --- GET a la colección con búsqueda y filtros ---
    app.get(RFR_URL, (req, res) => {
    const { from, to, country, min_squad, max_value } = req.query;
    let query = {};

    // Filtro por país (exacto, ignorando mayúsculas/minúsculas)
    if (country) {
        query.country = { $regex: new RegExp("^" + country + "$", "i") };
    }

    // Filtro por rango de años (ej: ?from=2020&to=2026)
    if (from || to) {
        query.year = {};
        if (from) query.year.$gte = Number(from);
        if (to) query.year.$lte = Number(to);
    }

    db.find(query).exec((err, docs) => {
        if (err) return res.sendStatus(500);
        res.status(200).json(docs.map(d => cleanResource(d)));
    }); 
});
    // --- 2. GET para cargar datos iniciales ---
    app.get(RFR_URL + "/loadInitialData", (req, res) => {
        const initialTeams = [
            {"year":2026,"country":"England","squad_size":25,"total_market_value":1300,"average_market_value":56.9},
            {"year":2026,"country":"France","squad_size":25,"total_market_value":1290,"average_market_value":55.9},
            {"year":2026,"country":"Brazil","squad_size":26,"total_market_value":932,"average_market_value":46.3},
            {"year":2026,"country":"Portugal","squad_size":23,"total_market_value":841,"average_market_value":47.9},
            {"year":2026,"country":"Spain","squad_size":27,"total_market_value":1150,"average_market_value":41.5},
            {"year":2026,"country":"Argentina","squad_size":23,"total_market_value":575,"average_market_value":39.8},
            {"year":2026,"country":"Germany","squad_size":23,"total_market_value":828,"average_market_value":40.9},
            {"year":2026,"country":"Netherlands","squad_size":22,"total_market_value":808,"average_market_value":33.9},
            {"year":2026,"country":"Italy","squad_size":26,"total_market_value":827,"average_market_value":33.8},
            {"year":2026,"country":"Belgium","squad_size":24,"total_market_value":442,"average_market_value":34.4},
            {"year":2025,"country":"England","squad_size":25,"total_market_value":1220,"average_market_value":48.8}
        ];

        db.count({}, (err, count) => {
            if (count > 0) {
                res.status(400).send("Database already has data.");
            } else {
                db.insert(initialTeams, (err, newDocs) => {
                    res.status(201).json(cleanResource(newDocs));
                });
            }
        });
    });

    // --- 3. POST a la colección ---
    app.post(RFR_URL, (req, res) => {
        const newData = req.body;
        if (!newData.country || !newData.year || newData.squad_size === undefined || 
            newData.total_market_value === undefined || newData.average_market_value === undefined) {
            return res.sendStatus(400);
        }

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

    // --- 4. GET a un recurso específico (País y Año) ---
    app.get(RFR_URL + "/:country/:year", (req, res) => {
        const { country, year } = req.params;
        db.findOne({ country: country, year: Number(year) }, (err, doc) => {
            if (err) return res.sendStatus(500);
            if (doc) {
                res.status(200).json(cleanResource(doc));
            } else {
                res.sendStatus(404);
            }
        });
    });

    // --- 4.1 GET por país ---
    app.get(RFR_URL + "/:country", (req, res) => {
        const { country } = req.params;
        const limit = parseInt(req.query.limit) || 10;
        const offset = parseInt(req.query.offset) || 0;

        db.find({ country: country }).skip(offset).limit(limit).exec((err, docs) => {
            if (err) return res.sendStatus(500);
            if (docs && docs.length > 0) {
                res.status(200).json(docs.map(d => cleanResource(d)));
            } else {
                res.sendStatus(404);
            }
        });
    });

    // --- 4.2 GET por año ---
    app.get(RFR_URL + "/year/:year", (req, res) => { // Sugerencia: añadir prefijo para evitar colisiones
        const { year } = req.params;
        db.find({ year: Number(year) }).exec((err, docs) => {
            if (err) return res.sendStatus(500);
            if (docs.length > 0) {
                res.status(200).json(docs.map(d => cleanResource(d)));
            } else {
                res.sendStatus(404);
            }
        });
    });

    // --- 5. DELETE a la colección completa ---
    app.delete(RFR_URL, (req, res) => {
        db.remove({}, { multi: true }, (err, numRemoved) => {
            res.sendStatus(200);
        });
    });

    // --- 6. DELETE a un recurso específico ---
    app.delete(RFR_URL + "/:country/:year", (req, res) => {
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
    app.put(RFR_URL + "/:country/:year", (req, res) => {
        const { country, year } = req.params;
        const updatedData = req.body;

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
    app.post(RFR_URL + "/:country/:year", (req, res) => res.sendStatus(405));
    app.put(RFR_URL, (req, res) => res.sendStatus(405));
};