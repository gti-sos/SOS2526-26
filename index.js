import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { handler } from './src/front/build/handler.js';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Importar los 6 módulos (usando import)
import mgn_api1 from './src/back/index-MGN.js';
import mgn_api2 from './src/back/index-MGN2.js';
import rfr_api1 from './src/back/index-RFR.js';
import rfr_api2 from './src/back/index-RFR2.js';
import sdv_api from './src/back/index-SDV.js';
import sdv_api2 from './src/back/index-SDV2.js';
import request from 'request';

const app = express();

var proxyPath = '/api/v1/proxy/education-spending';
// URL de la API externa (Banco Mundial - Gasto en educación) 
var remoteUrl = 'https://api.worldbank.org/v2/country/all/indicator/SE.XPD.TOTL.GD.ZS?format=json&per_page=1000';

app.use(proxyPath, function(req, res) {
    console.log('Petición redirigida vía Proxy a: ' + remoteUrl);
    req.pipe(request(remoteUrl)).pipe(res); 
});

app.use(cors());
app.use(express.json());
app.use("/", express.static("./static"));



mgn_api1(app);
mgn_api2(app);
sdv_api(app);
sdv_api2(app);
rfr_api1(app);
rfr_api2(app);

// Ruta /about 
app.get('/about', (req, res) => {
    res.sendFile(path.join(__dirname, "static", "about.html"));
});

app.use(handler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});