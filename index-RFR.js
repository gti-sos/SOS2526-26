const util = require('util');
if (!util.isDate) {
    util.isDate = (obj) => Object.prototype.toString.call(obj) === '[object Date]';
}
if (!util.isRegExp) {
    util.isRegExp = (obj) => Object.prototype.toString.call(obj) === '[object RegExp]';
}

const Datastore = require('nedb');

// 1. Inicialización de la base de datos para RFR
const db = new Datastore({ filename: './data/squads.db', autoload: true });

// Función auxiliar para eliminar el _id de NeDB (Requisito F06)
function cleanResource(resource) {
    if (Array.isArray(resource)) {
        return resource.map(r => {
            if (r) delete r._id;
            return r;
        });
    } else if (resource) {
        delete resource._id;
    }
    return resource;
}

module.exports = function(app) {
    const RFR_URL = "/api/v1/fifa-squad-value-per-years";

    // --- RUTA DOCUMENTACIÓN (Requisito T5) ---
    app.get(RFR_URL + "/docs", (req, res) => {
        res.redirect("https://documenter.getpostman.com/view/52260149/2sBXigKYBt");
    });

    // --- 1. GET a la colección (Listar todos) ---
    app.get(RFR_URL, (req, res) => {
        db.find({}, (err, docs) => {
            res.status(200).json(cleanResource(docs));
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

    // --- 3. POST a la colección (Crear) ---
    app.post(RFR_URL, (req, res) => {
        const newData = req.body;

        // Validación 400: Campos obligatorios
        if (!newData.country || !newData.year || newData.squad_size === undefined || 
            newData.total_market_value === undefined || newData.average_market_value === undefined) {
            return res.sendStatus(400);
        }

        // Validación 409: Conflicto (País y Año duplicados)
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
// Se queda debajo de la de país/año
app.get(RFR_URL + "/:country", (req, res) => {
    const { country } = req.params;
    
    // Si por error entra un año aquí (porque no encontró la ruta de arriba)
    // este check ayuda a filtrar
    const limit = parseInt(req.query.limit) || 10;
    const offset = parseInt(req.query.offset) || 0;

    db.find({ country: country }).skip(offset).limit(limit).exec((err, docs) => {
        if (err) {
            console.error("Error accediendo a DB:", err);
            return res.sendStatus(500);
        }
        
        if (docs && docs.length > 0) {
            res.status(200).json(docs.map(d => cleanResource(d)));
        } else {
            res.sendStatus(404);
        }
    });
});
    
    // --- 4.2 GET por año
    app.get(RFR_URL + "/:year", (req, res) => {
        const { year } = req.params;
        const limit = parseInt(req.query.limit) || 10;
        const offset = parseInt(req.query.offset) || 0;
        db.find({ year: Number(year) }).skip(offset).limit(limit).exec((err, docs) => {
            if (err) {
              console.error("Error accediendo a DB:", err);
              res.sendStatus(500);
              return; // Detiene la ejecución para que no llegue al docs.length
    }
            if (docs.length > 0) {
                res.status(200).json(docs.map(d => cleanResource(d)));
            } else {
                res.sendStatus(404);
            }
        });
    }); 

    // --- 4.3 GET por tamaño de plantilla
    app.get(RFR_URL + "/:squad_size", (req, res) => {
        const { squad_size } = req.params;
        const limit = parseInt(req.query.limit) || 10;
        const offset = parseInt(req.query.offset) || 0;
        db.find({ squad_size: Number(squad_size) }).skip(offset).limit(limit).exec((err, docs) => {
            if (err) {
                console.error("Error accediendo a DB:", err);
                res.sendStatus(500);
                return; // Detiene la ejecución para que no llegue al docs.length
    }
            if (docs.length > 0) {
                res.status(200).json(docs.map(d => cleanResource(d)));
            } else {
                res.sendStatus(404);
            }
        });
    }); 
   
    // --- 4.4 GET por valor de plantilla
    app.get(RFR_URL + "/:total_market_value", (req, res) => {
        const { total_market_value } = req.params;
        const limit = parseInt(req.query.limit) || 10;
        const offset = parseInt(req.query.offset) || 0;
        db.find({ total_market_value: Number(total_market_value) }).skip(offset).limit(limit).exec((err, docs) => {
            if (err) {
               console.error("Error accediendo a DB:", err);
               res.sendStatus(500);
               return; // Detiene la ejecución para que no llegue al docs.length
    }
            if (docs.length > 0) {
                res.status(200).json(docs.map(d => cleanResource(d)));
            } else {
                res.sendStatus(404);
            }
        });
    }); 

    // --- 4.5 GET por valor medio de plantilla
    app.get(RFR_URL + "/:average_market_value", (req, res) => {
        const { average_market_value } = req.params;
        const limit = parseInt(req.query.limit) || 10;
        const offset = parseInt(req.query.offset) || 0;
        db.find({ average_market_value: Number(average_market_value) }).skip(offset).limit(limit).exec((err, docs) => {
           if (err) {
              console.error("Error accediendo a DB:", err);
              res.sendStatus(500);
              return; // Detiene la ejecución para que no llegue al docs.length
    }           
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

        // Validación 400: Coincidencia de ID
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
    app.post(RFR_URL + "/:country/:year", (req, res) => res.sendStatus(405));
    app.put(RFR_URL, (req, res) => res.sendStatus(405));
};