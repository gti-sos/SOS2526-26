import Datastore from 'nedb';
import express from 'express';
import cors from 'cors';
const app = express();

/*
 * API REST v2 - Recurso "countries-idh-per-years" (Sergio Diaz Vazquez).
 *
 * Esta version mejora la v1 anyadiendo:
 *   - Busqueda por pais insensible a mayusculas/minusculas (regex).
 *   - Filtrado por rango de anyos (parametros from y to).
 *   - Validacion mas robusta de los identificadores en el PUT.
 *   - Respuestas 500 explicitas ante errores de NeDB.
 *
 * Persistencia: NeDB embebido en fichero local (./data/idh.db).
 * La clave logica de cada documento sigue siendo el par (country, year).
 */

const db = new Datastore({ filename: './data/idh.db', autoload: true });

/*
 * Limpia el campo interno "_id" que NeDB anyade automaticamente.
 * Asi el cliente recibe siempre un JSON limpio y consistente.
 */
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

    /*
     * Documentacion publica en Postman.
     * Se monta bajo "/docs" para no chocar con la ruta de la coleccion,
     * que ocuparia el mismo prefijo si se sirviera en la raiz.
     */
    app.get(SDV_URL + "/docs", (req, res) => {
        res.redirect("https://documenter.getpostman.com/view/52429610/2sBXinGqPs");
    });

    /*
     * GET coleccion con busqueda, filtros y paginacion.
     *
     * Filtros soportados (todos opcionales y combinables):
     *   - country: coincidencia exacta pero case-insensitive (regex).
     *   - from / to: rango cerrado de anyos.
     *   - year, hdi_value, hdi_rank, hdi_change: coincidencia exacta.
     *   - offset / limit: paginacion estandar.
     *
     * Si se especifica un rango (from/to) Y un anyo exacto al mismo
     * tiempo, prevalece el rango: no sobreescribimos query.year.
     */
    app.get(SDV_URL, (req, res) => {
        let offset = parseInt(req.query.offset) || 0;
        let limit = parseInt(req.query.limit) || 0;

        let { country, from, to, year, hdi_value, hdi_rank, hdi_change } = req.query;
        let query = {};

        if (country) {
            query.country = { $regex: new RegExp("^" + country + "$", "i") };
        }

        if (from || to) {
            query.year = {};
            if (from) query.year.$gte = Number(from);
            if (to) query.year.$lte = Number(to);
        }

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

    /*
     * Carga de datos iniciales de prueba.
     * Solo se ejecuta si la base de datos esta vacia para evitar
     * duplicados al recargar el endpoint durante el desarrollo.
     * Incluye 10 paises representativos cubriendo distintos rangos
     * de IDH (alto, medio, bajo) y un rango temporal 2015-2026.
     */
    app.get(SDV_URL + "/loadInitialData", (req, res) => {
        const initialData = [
            { "year": 2026, "country": "españa", "hdi_value": 0.932, "hdi_rank": 26, "hdi_change": 1 },
            { "year": 2025, "country": "españa", "hdi_value": 0.925, "hdi_rank": 27, "hdi_change": 1 },
            { "year": 2023, "country": "españa", "hdi_value": 0.918, "hdi_rank": 28, "hdi_change": 0 },
            { "year": 2022, "country": "españa", "hdi_value": 0.911, "hdi_rank": 27, "hdi_change": 1 },
            { "year": 2021, "country": "españa", "hdi_value": 0.904, "hdi_rank": 27, "hdi_change": 0 },
            { "year": 2020, "country": "españa", "hdi_value": 0.899, "hdi_rank": 28, "hdi_change": -1 },
            { "year": 2018, "country": "españa", "hdi_value": 0.905, "hdi_rank": 26, "hdi_change": 0 },
            { "year": 2015, "country": "españa", "hdi_value": 0.895, "hdi_rank": 26, "hdi_change": 0 },

            { "year": 2026, "country": "estados-unidos", "hdi_value": 0.951, "hdi_rank": 16, "hdi_change": 1 },
            { "year": 2025, "country": "estados-unidos", "hdi_value": 0.946, "hdi_rank": 17, "hdi_change": 0 },
            { "year": 2023, "country": "estados-unidos", "hdi_value": 0.938, "hdi_rank": 17, "hdi_change": 3 },
            { "year": 2022, "country": "estados-unidos", "hdi_value": 0.927, "hdi_rank": 20, "hdi_change": 1 },
            { "year": 2021, "country": "estados-unidos", "hdi_value": 0.921, "hdi_rank": 21, "hdi_change": 0 },
            { "year": 2020, "country": "estados-unidos", "hdi_value": 0.920, "hdi_rank": 21, "hdi_change": -1 },
            { "year": 2015, "country": "estados-unidos", "hdi_value": 0.912, "hdi_rank": 15, "hdi_change": 0 },

            { "year": 2026, "country": "china", "hdi_value": 0.818, "hdi_rank": 72, "hdi_change": 3 },
            { "year": 2025, "country": "china", "hdi_value": 0.809, "hdi_rank": 75, "hdi_change": 3 },
            { "year": 2023, "country": "china", "hdi_value": 0.797, "hdi_rank": 78, "hdi_change": -3 },
            { "year": 2022, "country": "china", "hdi_value": 0.788, "hdi_rank": 75, "hdi_change": 1 },
            { "year": 2021, "country": "china", "hdi_value": 0.768, "hdi_rank": 79, "hdi_change": 2 },
            { "year": 2018, "country": "china", "hdi_value": 0.755, "hdi_rank": 85, "hdi_change": 1 },
            { "year": 2015, "country": "china", "hdi_value": 0.733, "hdi_rank": 90, "hdi_change": 1 },

            { "year": 2026, "country": "francia", "hdi_value": 0.930, "hdi_rank": 28, "hdi_change": -1 },
            { "year": 2025, "country": "francia", "hdi_value": 0.927, "hdi_rank": 27, "hdi_change": -1 },
            { "year": 2023, "country": "francia", "hdi_value": 0.920, "hdi_rank": 26, "hdi_change": 2 },
            { "year": 2022, "country": "francia", "hdi_value": 0.910, "hdi_rank": 28, "hdi_change": -1 },
            { "year": 2021, "country": "francia", "hdi_value": 0.903, "hdi_rank": 28, "hdi_change": 0 },
            { "year": 2015, "country": "francia", "hdi_value": 0.890, "hdi_rank": 22, "hdi_change": 0 },

            { "year": 2026, "country": "japón", "hdi_value": 0.938, "hdi_rank": 21, "hdi_change": 1 },
            { "year": 2025, "country": "japón", "hdi_value": 0.932, "hdi_rank": 22, "hdi_change": 1 },
            { "year": 2023, "country": "japón", "hdi_value": 0.925, "hdi_rank": 23, "hdi_change": 1 },
            { "year": 2022, "country": "japón", "hdi_value": 0.920, "hdi_rank": 24, "hdi_change": -2 },
            { "year": 2021, "country": "japón", "hdi_value": 0.917, "hdi_rank": 22, "hdi_change": 1 },
            { "year": 2015, "country": "japón", "hdi_value": 0.905, "hdi_rank": 19, "hdi_change": 0 },

            { "year": 2026, "country": "india", "hdi_value": 0.710, "hdi_rank": 122, "hdi_change": 4 },
            { "year": 2025, "country": "india", "hdi_value": 0.698, "hdi_rank": 126, "hdi_change": 4 },
            { "year": 2023, "country": "india", "hdi_value": 0.685, "hdi_rank": 130, "hdi_change": 4 },
            { "year": 2022, "country": "india", "hdi_value": 0.644, "hdi_rank": 134, "hdi_change": 1 },
            { "year": 2021, "country": "india", "hdi_value": 0.633, "hdi_rank": 135, "hdi_change": -1 },
            { "year": 2015, "country": "india", "hdi_value": 0.627, "hdi_rank": 130, "hdi_change": 0 },

            { "year": 2026, "country": "noruega", "hdi_value": 0.982, "hdi_rank": 1, "hdi_change": 1 },
            { "year": 2025, "country": "noruega", "hdi_value": 0.976, "hdi_rank": 2, "hdi_change": 0 },
            { "year": 2023, "country": "noruega", "hdi_value": 0.970, "hdi_rank": 2, "hdi_change": 0 },
            { "year": 2022, "country": "noruega", "hdi_value": 0.967, "hdi_rank": 2, "hdi_change": 0 },
            { "year": 2021, "country": "noruega", "hdi_value": 0.969, "hdi_rank": 2, "hdi_change": -1 },
            { "year": 2015, "country": "noruega", "hdi_value": 0.959, "hdi_rank": 1, "hdi_change": 0 },

            { "year": 2026, "country": "brasil", "hdi_value": 0.804, "hdi_rank": 79, "hdi_change": 2 },
            { "year": 2025, "country": "brasil", "hdi_value": 0.795, "hdi_rank": 81, "hdi_change": 3 },
            { "year": 2023, "country": "brasil", "hdi_value": 0.786, "hdi_rank": 84, "hdi_change": 3 },
            { "year": 2022, "country": "brasil", "hdi_value": 0.776, "hdi_rank": 87, "hdi_change": -1 },
            { "year": 2021, "country": "brasil", "hdi_value": 0.754, "hdi_rank": 87, "hdi_change": 0 },
            { "year": 2015, "country": "brasil", "hdi_value": 0.761, "hdi_rank": 75, "hdi_change": 0 },

            { "year": 2026, "country": "nigeria", "hdi_value": 0.565, "hdi_rank": 157, "hdi_change": 2 },
            { "year": 2025, "country": "nigeria", "hdi_value": 0.556, "hdi_rank": 159, "hdi_change": 2 },
            { "year": 2023, "country": "nigeria", "hdi_value": 0.548, "hdi_rank": 161, "hdi_change": 2 },
            { "year": 2022, "country": "nigeria", "hdi_value": 0.540, "hdi_rank": 163, "hdi_change": 0 },
            { "year": 2021, "country": "nigeria", "hdi_value": 0.535, "hdi_rank": 163, "hdi_change": -2 },
            { "year": 2015, "country": "nigeria", "hdi_value": 0.523, "hdi_rank": 158, "hdi_change": 0 },

            { "year": 2026, "country": "australia", "hdi_value": 0.968, "hdi_rank": 5, "hdi_change": 1 },
            { "year": 2025, "country": "australia", "hdi_value": 0.963, "hdi_rank": 6, "hdi_change": 1 },
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

    /*
     * POST a la coleccion: crea un nuevo recurso.
     *   - 400: faltan campos obligatorios.
     *   - 409: ya existe un recurso con la misma clave (country, year).
     *   - 201: creado correctamente.
     */
    app.post(SDV_URL, (req, res) => {
        const newData = req.body;

        if (!newData.country || !newData.year || newData.hdi_value === undefined ||
            newData.hdi_rank === undefined || newData.hdi_change === undefined) {
            return res.status(400).send("Faltan campos obligatorios");
        }

        db.find({ country: newData.country, year: Number(newData.year) }, (err, docs) => {
            if (docs.length > 0) {
                res.sendStatus(409);
            } else {
                db.insert(newData, (err, newDoc) => {
                    if (err) return res.sendStatus(500);
                    res.status(201).json(cleanResource(newDoc));
                });
            }
        });
    });

    /* GET de un recurso concreto identificado por (country, year). */
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

    /* DELETE coleccion completa: elimina todos los documentos. */
    app.delete(SDV_URL, (req, res) => {
        db.remove({}, { multi: true }, (err, numRemoved) => {
            if (err) return res.sendStatus(500);
            res.sendStatus(200);
        });
    });

    /*
     * DELETE de un recurso concreto.
     * NeDB devuelve el numero de documentos eliminados, lo que nos
     * permite distinguir entre "borrado" (200) y "no existia" (404).
     */
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

    /*
     * PUT de un recurso concreto.
     * Si el (country, year) del cuerpo no concuerda con el de la URL
     * se devuelve 400: lo contrario permitiria al cliente cambiar la
     * clave logica del recurso de forma encubierta.
     */
    app.put(SDV_URL + "/:country/:year", (req, res) => {
        const { country, year } = req.params;
        const updatedData = req.body;

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

    /*
     * Metodos no permitidos por la guia REST.
     * POST sobre un recurso individual y PUT sobre la coleccion no
     * tienen sentido semantico, asi que devuelven 405.
     */
    app.post(SDV_URL + "/:country/:year", (req, res) => res.sendStatus(405));
    app.put(SDV_URL, (req, res) => res.sendStatus(405));
};
