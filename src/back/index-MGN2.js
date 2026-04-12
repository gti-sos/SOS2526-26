import Datastore from 'nedb';
// Para la autenticación JWT///////////////////////////////
import jwt from 'jsonwebtoken';
///////////////////////////////////////////////////////////
/////Autenticación con Google (OAuth 2.0)////////////////////////
import passport from 'passport';

import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import session from 'express-session';
import dotenv from 'dotenv';
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
dotenv.config();
/////////////////////////////////////////////////////////////////
const CLIENT_ID = process.env.CLIENT_ID_MGN || "generico_client_id";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET_MGN || "secreto_por_defecto";
const JWT_SECRET = process.env.JWT_SECRET_MGN || "super_secret_fallback";
//console.log("CLIENT_ID:", CLIENT_ID);
;
const SECRET_KEY = JWT_SECRET 
// 1. Inicialización de la base de datos
const db = new Datastore({ filename: './data/rankings.db', autoload: true });

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

// Middleware para verificar el token JWT
function verifyToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    // El token suele venir como "Bearer <token>"
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).send("Acceso denegado: Se requiere un token de autenticación.");
    }

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) {
            return res.status(403).send("Token no válido o expirado.");
        }
        req.user = user; // Guardamos los datos del usuario en la petición
        next(); // Continuamos al siguiente paso
    });
}

export default function (app) {
    const MGN_URL = "/api/v2/national-team-rankings-per-years";

    /////Autenticación con Google (OAuth 2.0)////////////////////////
    // 1. Configurar la sesión (necesaria para que Passport "recuerde" al usuario)
    app.use(session({
        secret: 'secreto_para_sesion_oauth',
        resave: false,
        saveUninitialized: true
    }));

    // 2. Inicializar Passport
    app.use(passport.initialize());
    app.use(passport.session());

    // 3. Configurar la estrategia de Google
    passport.use(new GoogleStrategy({
        clientID: CLIENT_ID, // Se obtiene en Google Cloud Console
        clientSecret: GOOGLE_CLIENT_SECRET, // Se obtiene en Google Cloud Console
        callbackURL: `http://localhost:3000${MGN_URL}/auth/google/callback`
    },
        (accessToken, refreshToken, profile, done) => {
            // Aquí es donde recibes los datos de Google (profile.id, profile.displayName, etc.)
            // Normalmente aquí guardarías al usuario en tu DB o simplemente dirías "ok"
            return done(null, profile);
        }
    ));

    // Serialización (obligatorio para sesiones)
    passport.serializeUser((user, done) => done(null, user));
    passport.deserializeUser((obj, done) => done(null, obj));

    /////////////////////////////////////////////////////////////////////////////////////////


    // --- ENDPOINT DE LOGIN (Genera el Token) ---
    app.post(MGN_URL + "/login", (req, res) => {
        console.log("¡He recibido un intento de login!"); // <--- Añade esto
        const { username, password } = req.body;

        // Usuario de prueba (en el futuro esto miraría una DB de usuarios)
        if (username === "admin" && password === "1234") {
            const user = { name: username };
            // El token expirará en 2 horas
            const token = jwt.sign(user, SECRET_KEY, { expiresIn: '2h' });
            res.json({ token });
        } else {
            res.status(401).send("Usuario o contraseña incorrectos.");
        }
    });


    // A. Ruta para iniciar el proceso (redirige a Google)
    app.get(MGN_URL + '/auth/google',
        passport.authenticate('google', { scope: ['profile', 'email'] })
    );

    // B. Ruta de retorno (Google devuelve al usuario aquí con el éxito/fallo)
    app.get(MGN_URL + '/auth/google/callback',
        passport.authenticate('google', { failureRedirect: MGN_URL + '/login' }),
        (req, res) => {
            // ¡Éxito! El usuario ya está autenticado.
            // Aquí podrías generar un JWT para el front o redirigir directamente.
            res.send(`Bienvenido ${req.user.displayName}, te has logueado con Google.`);
        }
    );





    // --- RUTA DOCUMENTACIÓN ---
    app.get(MGN_URL + "/docs", (req, res) => {
        res.redirect("https://documenter.getpostman.com/view/53034281/2sBXionVrX");
    });

    // --- 1. GET a la colección (con Búsquedas Avanzadas y Paginación) ---
    app.get(MGN_URL, (req, res) => {
        let offset = parseInt(req.query.offset) || 0;
        let limit = parseInt(req.query.limit) || 0;

        let { country, from, to, year, rank, score, rank_variation_from_two_thousand_eighteen } = req.query;
        let query = {};

        // Filtro por país (Búsqueda parcial e insensible a mayúsculas/minúsculas)
        if (country) {
            query.country = { $regex: new RegExp(country, "i") };
        }

        // Filtro por rango de años
        if (from || to) {
            query.year = {};
            if (from) query.year.$gte = Number(from);
            if (to) query.year.$lte = Number(to);
        }

        // Otros filtros exactos
        if (year && !query.year) query.year = Number(year);
        if (rank) query.rank = Number(rank);
        if (score) query.score = Number(score);
        if (rank_variation_from_two_thousand_eighteen) {
            query.rank_variation_from_two_thousand_eighteen = Number(rank_variation_from_two_thousand_eighteen);
        }

        db.find(query).skip(offset).limit(limit).exec((err, docs) => {
            if (err) {
                console.error("Error en DB:", err);
                res.sendStatus(500);
            } else {
                res.status(200).json(cleanResource(docs));
            }
        });
    });

    // --- 2. GET para cargar datos iniciales ---
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
            if (err) return res.sendStatus(500);
            if (count > 0) {
                res.status(400).send("La base de datos ya tiene datos. Carga abortada.");
            } else {
                db.insert(initial_rankings, (err, newDocs) => {
                    if (err) return res.sendStatus(500);
                    res.status(201).json(cleanResource(newDocs));
                });
            }
        });
    });

    // --- 3. POST a la colección ---
    app.post(MGN_URL,  (req, res) => { //  verifyToken,
        const newData = req.body;
        if (!isValidResource(newData)) return res.sendStatus(400);

        db.find({ country: newData.country, year: Number(newData.year) }, (err, docs) => {
            if (err) return res.sendStatus(500);
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

    // --- 4. GET a un recurso específico ---
    app.get(MGN_URL + "/:country/:year", (req, res) => {
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

    // --- 5. DELETE a la colección completa ---
    app.delete(MGN_URL,  (req, res) => {  //  verifyToken,
        db.remove({}, { multi: true }, (err, numRemoved) => {
            if (err) return res.sendStatus(500);
            res.sendStatus(200);
        });
    });

    // --- 6. DELETE a un recurso específico ---
    app.delete(MGN_URL + "/:country/:year", (req, res) => {   //  verifyToken,
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
    app.put(MGN_URL + "/:country/:year",  (req, res) => { // verifyToken,
        const { country, year } = req.params;
        const updatedData = req.body;

        if (!isValidResource(updatedData)) return res.sendStatus(400);
        if (country !== updatedData.country || Number(year) !== updatedData.year) {
            return res.sendStatus(400);
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
    app.post(MGN_URL + "/:country/:year", (req, res) => res.sendStatus(405));
    app.put(MGN_URL, (req, res) => res.sendStatus(405));
};