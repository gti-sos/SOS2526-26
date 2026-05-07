import express from 'express';
import cors from 'cors';
import db from './db.js';

/*
 * API REST v2 sobre Firebase Firestore - Recurso "countries-idh-per-years".
 *
 * Es una alternativa al backend NeDB que usa Cloud Firestore como
 * base de datos. Mantiene exactamente los mismos contratos REST que
 * la version local (rutas, codigos de estado y formato JSON), de
 * modo que el frontend funciona contra cualquiera de los dos sin
 * cambios. La eleccion del motor es transparente para el cliente.
 *
 * Las consultas se montan con filtros .where() de Firestore y, cuando
 * la operacion no se puede expresar (por ejemplo, regex case-insensitive
 * en country), se completa el filtrado en memoria sobre el resultado.
 */

const app = express();

app.use(cors());
app.use(express.json());

const COLLECTION_NAME = 'countries-idh-per-years';

/*
 * Validador estricto del cuerpo de la peticion.
 * Comprueba simultaneamente:
 *   - Que el numero de claves coincide (sin campos extra).
 *   - Que estan exactamente las claves esperadas.
 *   - Que los tipos de cada campo son los correctos.
 * De este modo se rechazan recursos malformados antes de tocar la BD.
 */
function isValidResource(body) {
    const validKeys = ["country", "year", "hdi_value", "hdi_rank", "hdi_change"];
    const bodyKeys = Object.keys(body);

    if (bodyKeys.length !== validKeys.length) return false;

    const hasAllKeys = validKeys.every(key => bodyKeys.includes(key));
    if (!hasAllKeys) return false;

    if (typeof body.country !== 'string' ||
        typeof body.year !== 'number' ||
        typeof body.hdi_value !== 'number' ||
        typeof body.hdi_rank !== 'number' ||
        typeof body.hdi_change !== 'number') {
        return false;
    }

    return true;
}

const SDV_URL = "/api/v2/countries-idh-per-years";

/* Redireccion a la documentacion Postman publica de la API. */
app.get(SDV_URL + "/docs", (req, res) => {
    res.redirect("https://documenter.getpostman.com/view/52429610/2sBXinGqPs");
});

/*
 * GET coleccion con filtros y paginacion.
 *
 * Los filtros que Firestore puede traducir directamente a su query
 * (year, hdi_value, hdi_rank, hdi_change, from, to) se aplican con
 * .where() para aprovechar los indices del servidor. El filtro por
 * country se hace en memoria con un regex case-insensitive porque
 * Firestore no admite busquedas insensibles a mayusculas nativamente.
 *
 * La paginacion (offset/limit) tambien se aplica en memoria con slice()
 * para mantener una semantica identica a la de la version NeDB.
 */
app.get(SDV_URL, async (req, res) => {
    try {
        let offset = parseInt(req.query.offset) || 0;
        let limit = parseInt(req.query.limit) || 0;
        let { country, from, to, year, hdi_value, hdi_rank, hdi_change } = req.query;

        let queryRef = db.collection(COLLECTION_NAME);

        if (year) queryRef = queryRef.where('year', '==', Number(year));
        if (hdi_value) queryRef = queryRef.where('hdi_value', '==', Number(hdi_value));
        if (hdi_rank) queryRef = queryRef.where('hdi_rank', '==', Number(hdi_rank));
        if (hdi_change) {
            queryRef = queryRef.where('hdi_change', '==', Number(hdi_change));
        }
        if (from) queryRef = queryRef.where('year', '>=', Number(from));
        if (to) queryRef = queryRef.where('year', '<=', Number(to));

        const snapshot = await queryRef.get();
        let docs = snapshot.docs.map(doc => doc.data());

        if (country) {
            const regex = new RegExp(country, "i");
            docs = docs.filter(item => regex.test(item.country));
        }

        if (offset > 0) docs = docs.slice(offset);
        if (limit > 0) docs = docs.slice(0, limit);

        res.status(200).json(docs);
    } catch (error) {
        console.error("Error en DB:", error);
        res.sendStatus(500);
    }
});

/*
 * Carga de datos iniciales de prueba.
 * Solo inserta si la coleccion esta vacia. Se usa una operacion
 * batch() de Firestore para que las 10 inserciones se confirmen
 * en una unica operacion atomica, evitando estados intermedios.
 */
app.get(SDV_URL + "/loadInitialData", async (req, res) => {
    try {
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

        const snapshot = await db.collection(COLLECTION_NAME).limit(1).get();
        if (!snapshot.empty) {
            return res.status(400).send("La base de datos ya tiene datos. Carga abortada.");
        }

        const batch = db.batch();
        initialData.forEach(item => {
            const docRef = db.collection(COLLECTION_NAME).doc();
            batch.set(docRef, item);
        });
        await batch.commit();

        res.status(201).json(initialData);
    } catch (error) {
        console.error(error);
        res.sendStatus(500);
    }
});

/*
 * POST a la coleccion: crea un nuevo recurso.
 * Antes de insertar se comprueba que no exista ya otro documento con
 * el mismo (country, year) para garantizar la unicidad de la clave.
 */
app.post(SDV_URL, async (req, res) => {
    try {
        const newData = req.body;
        if (!isValidResource(newData)) return res.sendStatus(400);

        const snapshot = await db.collection(COLLECTION_NAME)
            .where('country', '==', newData.country)
            .where('year', '==', Number(newData.year))
            .get();

        if (!snapshot.empty) return res.sendStatus(409);

        await db.collection(COLLECTION_NAME).add(newData);
        res.status(201).json(newData);
    } catch (error) {
        res.sendStatus(500);
    }
});

/* GET de un recurso concreto identificado por (country, year). */
app.get(SDV_URL + "/:country/:year", async (req, res) => {
    try {
        const { country, year } = req.params;
        const snapshot = await db.collection(COLLECTION_NAME)
            .where('country', '==', country)
            .where('year', '==', Number(year))
            .get();

        if (snapshot.empty) return res.sendStatus(404);
        res.status(200).json(snapshot.docs[0].data());
    } catch (error) {
        res.sendStatus(500);
    }
});

/*
 * DELETE coleccion completa.
 * Firestore no ofrece "borra todo en un comando", asi que se itera
 * el snapshot y se eliminan los documentos en un unico batch atomico.
 */
app.delete(SDV_URL, async (req, res) => {
    try {
        const snapshot = await db.collection(COLLECTION_NAME).get();
        const batch = db.batch();
        snapshot.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        res.sendStatus(200);
    } catch (error) {
        res.sendStatus(500);
    }
});

/*
 * DELETE de un recurso concreto.
 * Se localiza por (country, year) y, si existe, se borra (puede haber
 * un solo documento por la unicidad garantizada en POST/PUT).
 */
app.delete(SDV_URL + "/:country/:year", async (req, res) => {
    try {
        const { country, year } = req.params;
        const snapshot = await db.collection(COLLECTION_NAME)
            .where('country', '==', country)
            .where('year', '==', Number(year))
            .get();

        if (snapshot.empty) return res.sendStatus(404);

        const batch = db.batch();
        snapshot.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        res.sendStatus(200);
    } catch (error) {
        res.sendStatus(500);
    }
});

/*
 * PUT de un recurso concreto.
 * Se valida la estructura del cuerpo y se exige que el (country, year)
 * de la URL coincida con el del payload. Si existe el documento se
 * sobrescribe con set(); si no, devuelve 404.
 */
app.put(SDV_URL + "/:country/:year", async (req, res) => {
    try {
        const { country, year } = req.params;
        const updatedData = req.body;

        if (!isValidResource(updatedData)) return res.sendStatus(400);
        if (country !== updatedData.country || Number(year) !== updatedData.year) {
            return res.sendStatus(400);
        }

        const snapshot = await db.collection(COLLECTION_NAME)
            .where('country', '==', country)
            .where('year', '==', Number(year))
            .get();

        if (snapshot.empty) return res.sendStatus(404);

        const docId = snapshot.docs[0].id;
        await db.collection(COLLECTION_NAME).doc(docId).set(updatedData);
        res.sendStatus(200);
    } catch (error) {
        res.sendStatus(500);
    }
});

/*
 * Metodos no permitidos por la guia REST.
 * POST sobre un recurso individual y PUT sobre la coleccion no tienen
 * sentido semantico y devuelven 405.
 */
app.post(SDV_URL + "/:country/:year", (req, res) => res.sendStatus(405));
app.put(SDV_URL, (req, res) => res.sendStatus(405));

/*
 * Arranque del servidor independiente.
 * Este modulo se ejecuta como microservicio separado del backend
 * principal NeDB, escuchando en su propio puerto (3005 por defecto).
 */
const PORT = process.env.PORT || 3005;
app.listen(PORT, () => {
    console.log(`\n✅ Servidor Firebase listo y escuchando en el puerto ${PORT}`);
    console.log(`👉 Carga inicial de datos: http://localhost:${PORT}${SDV_URL}/loadInitialData\n`);
});
