import admin from 'firebase-admin';
import { createRequire } from 'module';

// Truco para poder importar archivos .json de forma segura en ES Modules
const require = createRequire(import.meta.url);
const serviceAccount = require('./firebase-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

console.log("✅ Conexión con Firebase establecida con éxito");

export default db;