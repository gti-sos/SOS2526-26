import express from 'express';
import cors from 'cors';
import db from './db.js';

const app = express();

// Middlewares básicos
app.use(cors());
app.use(express.json());

// Colección en Firebase
const COLLECTION_NAME = 'national_team_rankings';

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

const MGN_URL = "/api/v2/national-team-rankings-per-years";

// --- RUTA DOCUMENTACIÓN ---
app.get(MGN_URL + "/docs", (req, res) => {
    res.redirect("https://documenter.getpostman.com/view/53034281/2sBXigNZXJ");
});

// --- 1. GET a la colección ---
app.get(MGN_URL, async (req, res) => {
    try {
        let offset = parseInt(req.query.offset) || 0;
        let limit = parseInt(req.query.limit) || 0;
        let { country, from, to, year, rank, score, rank_variation_from_two_thousand_eighteen } = req.query;

        let queryRef = db.collection(COLLECTION_NAME);

        if (year) queryRef = queryRef.where('year', '==', Number(year));
        if (rank) queryRef = queryRef.where('rank', '==', Number(rank));
        if (score) queryRef = queryRef.where('score', '==', Number(score));
        if (rank_variation_from_two_thousand_eighteen) {
            queryRef = queryRef.where('rank_variation_from_two_thousand_eighteen', '==', Number(rank_variation_from_two_thousand_eighteen));
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
app.get(MGN_URL + "/loadInitialData", async (req, res) => {
    try {
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

        const snapshot = await db.collection(COLLECTION_NAME).limit(1).get();
        if (!snapshot.empty) {
            return res.status(400).send("La base de datos ya tiene datos. Carga abortada.");
        }

        const batch = db.batch();
        initial_rankings.forEach(item => {
            const docRef = db.collection(COLLECTION_NAME).doc();
            batch.set(docRef, item);
        });
        await batch.commit();

        res.status(201).json(initial_rankings);
    } catch (error) {
        console.error(error);
        res.sendStatus(500);
    }
});

// --- 3. POST a la colección ---
app.post(MGN_URL, async (req, res) => {
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
app.get(MGN_URL + "/:country/:year", async (req, res) => {
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
app.delete(MGN_URL, async (req, res) => {
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
app.delete(MGN_URL + "/:country/:year", async (req, res) => {
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
app.put(MGN_URL + "/:country/:year", async (req, res) => {
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
app.post(MGN_URL + "/:country/:year", (req, res) => res.sendStatus(405));
app.put(MGN_URL, (req, res) => res.sendStatus(405));

// --- ARRANCAR EL SERVIDOR ---
const PORT = process.env.PORT || 3005;
app.listen(PORT, () => {
    console.log(`\n✅ Servidor Firebase listo y escuchando en el puerto ${PORT}`);
    console.log(`👉 Carga inicial de datos: http://localhost:${PORT}${MGN_URL}/loadInitialData\n`);
});