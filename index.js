import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { handler } from './src/front/build/handler.js';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Importar los 3 módulos (usando import)
import mgn_api2 from './src/back/index-MGN2.js';
import rfr_api1 from './src/back/index-RFR.js';
import rfr_api2 from './src/back/index-RFR2.js';
//import sdv_api from './src/back/index-SDV.js';
import sdv_api2 from './src/back/index-SDV2.js';

const app = express();

app.use(express.json());
app.use("/", express.static("./static"));
app.use(cors());

// Inicializar los 4 módulos pasándoles 'app'
//mgn_api2(app);
sdv_api2(app);
rfr_api1(app);
rfr_api2(app);

// Ruta /about 
app.get('/about', (req, res) => {
    res.sendFile(path.join(__dirname, "static", "about.html"));
});

app.use(handler);

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Servidor listo en puerto ${port}`);
}); //proof2