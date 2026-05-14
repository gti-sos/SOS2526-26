import Datastore from 'nedb';

/*
 * API REST v1 - Recurso "countries-idh-per-years" (Sergio Diaz Vazquez).
 *
 * Persistencia: NeDB embebido en fichero local (./data/idh1.db).
 * Cada documento representa el Indice de Desarrollo Humano (IDH) de un pais
 * en un anyo concreto. La clave logica del recurso es el par (country, year).
 */

const db = new Datastore({ filename: './data/idh1.db', autoload: true });

/*
 * NeDB anyade automaticamente un campo interno "_id" a cada documento.
 * Este campo es ruido para el cliente final, asi que se elimina antes
 * de devolver la respuesta para mantener el JSON limpio y estable.  
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

export default function(app) {
    const SDV_URL = "/api/v1/countries-idh-per-years";

    /* Redireccion a la documentacion publica de la API en Postman. */
    app.get("/api/v1/countries-idh-per-years/docs", (req, res) => {
        res.redirect("https://documenter.getpostman.com/view/52429610/2sBXietaKH");
    });

    /*
     * GET coleccion completa.
     * Soporta paginacion (offset/limit) y filtrado exacto por cualquier
     * combinacion de los campos del recurso.
     */
    app.get("/api/v1/countries-idh-per-years", (req, res) => {
        let offset = parseInt(req.query.offset) || 0;
        let limit = parseInt(req.query.limit) || 0;
        let query = {};

        if (req.query.country) query.country = req.query.country;
        if (req.query.year) query.year = parseInt(req.query.year);
        if (req.query.hdi_value) query.hdi_value = parseFloat(req.query.hdi_value);
        if (req.query.hdi_rank) query.hdi_rank = parseInt(req.query.hdi_rank);
        if (req.query.hdi_change) query.hdi_change = parseInt(req.query.hdi_change);

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
     * Carga inicial de datos de prueba.
     * Solo inserta si la coleccion esta vacia: evita duplicados al
     * llamar varias veces al endpoint y devuelve 400 si ya hay datos.
     */
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

    /*
     * POST a la coleccion: crea un nuevo recurso.
     * Devuelve 400 si faltan campos obligatorios y 409 si ya existe
     * un recurso con el mismo (country, year), garantizando unicidad.
     */
    app.post(SDV_URL, (req, res) => {
        const newData = req.body;
        if (!newData.country || !newData.year || newData.hdi_value === undefined ||
            newData.hdi_rank === undefined || newData.hdi_change === undefined) {
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

    /* DELETE coleccion completa: vacia la base de datos. */
    app.delete(SDV_URL, (req, res) => {
        db.remove({}, { multi: true }, (err, numRemoved) => {
            res.sendStatus(200);
        });
    });

    /*
     * DELETE de un recurso concreto. Distingue entre el recurso
     * encontrado (200) y no encontrado (404) usando el numero de
     * documentos que NeDB confirma haber borrado.
     */
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

    /*
     * PUT de un recurso concreto.
     * Se exige que el (country, year) de la URL coincida con el del
     * cuerpo para evitar que el cliente cambie la clave logica del
     * recurso por error (cambio de identidad encubierto).
     */
    app.put(SDV_URL + "/:country/:year", (req, res) => {
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

    /*
     * Metodos no permitidos por la guia REST.
     * POST sobre un recurso individual y PUT sobre la coleccion
     * carecen de sentido semantico, asi que devuelven 405.
     */
    app.post(SDV_URL + "/:country/:year", (req, res) => res.sendStatus(405));
    app.put(SDV_URL, (req, res) => res.sendStatus(405));
};
