const express = require('express');
const app = express();

app.use(express.json());
app.use("/", express.static("./static"));

// Importar los 3 módulos
const mgn_api = require('./index-MGN.js');
const sdv_api = require('./index-SDV.js');
const rfr_api = require('./index-RFR.js');

// Inicializar los 3 módulos pasándoles 'app'
mgn_api(app);
sdv_api(app);
rfr_api(app);

// Ruta /about (Asegúrate de tener static/about.html)
app.get('/about', (req, res) => {
    res.sendFile(__dirname + "/static/about.html");
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Servidor listo en puerto ${port}`);
});