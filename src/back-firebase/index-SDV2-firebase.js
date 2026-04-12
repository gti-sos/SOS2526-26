import express from 'express';
import cors from 'cors';
import db from './db.js';

const app = express();

// Middlewares básicos
app.use(cors());
app.use(express.json());

// Colección en Firebase
const COLLECTION_NAME = 'countries-idh-per-years';

// Función auxiliar para validar la estructura del JSON
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

// --- RUTA DOCUMENTACIÓN ---
app.get(SDV_URL + "/docs", (req, res) => {
    res.redirect("https://documenter.getpostman.com/view/52429610/2sBXinGqPs");
});

// --- 1. GET a la colección ---
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

// --- 2. GET para cargar datos iniciales ---
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

// --- 3. POST a la colección ---
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

// --- 4. GET a un recurso específico ---
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

// --- 5. DELETE a la colección completa ---
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

// --- 6. DELETE a un recurso específico ---
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

// --- 7. PUT a un recurso específico ---
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

// --- MÉTODOS NO PERMITIDOS ---
app.post(SDV_URL + "/:country/:year", (req, res) => res.sendStatus(405));
app.put(SDV_URL, (req, res) => res.sendStatus(405));

// --- ARRANCAR EL SERVIDOR ---
const PORT = process.env.PORT || 3005;
app.listen(PORT, () => {
    console.log(`\n✅ Servidor Firebase listo y escuchando en el puerto ${PORT}`);
    console.log(`👉 Carga inicial de datos: http://localhost:${PORT}${SDV_URL}/loadInitialData\n`);
});