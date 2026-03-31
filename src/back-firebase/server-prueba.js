import express from 'express';
import cors from 'cors';
import db from './db.js'; // ¡Imprescindible el .js aquí!

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 4000;

// RUTA DE PRUEBA: Obtener tareas
app.get('/api/tareas', async (req, res) => {
  try {
    const snapshot = await db.collection('tasks').get();
    const tareas = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(tareas);
  } catch (error) {
    res.status(500).send("Error al obtener datos: " + error.message);
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Backend con Firebase corriendo en http://localhost:${PORT}`);
});