const express = require("express");
const app = express();
const port = process.env.PORT || 10000;

// 1. Configurar carpeta estática para la ruta /about (Punto 6 por grupo)
// Debes tener una carpeta llamada 'public' con un 'about.html'
app.use("/about", express.static("./public"));

// 2. Ruta dinámica /cool (Punto 5 por grupo)
app.get("/cool", (req, res) => {
    res.send(" (⌐■_■) ");
});

// 3. Tu algoritmo personal (Punto "Replicar algoritmo" por persona)
// Sustituye YYY por tus siglas (ej: MGN)
app.get("/samples/MGN", (req, res) => {
    // AQUÍ PEGA EL CÓDIGO DE TU ALGORITMO DEL F03
    let resultado = "Cálculo de tu algoritmo aquí"; 
    res.send(`Resultado: ${resultado}`);
});

// 4. Tu API REST (Punto "API funcional" por persona)
// Sustituye FFFFF por el nombre de tu recurso en minúsculas
app.get("/api/v1/FFFFF/loadInitialData", (req, res) => {
    // Lógica para cargar 10 datos si está vacío
    res.sendStatus(200); 
});

// Aquí tus compañeros deben añadir sus rutas /samples/ZZZ y sus /api/v1/AAAAA

app.listen(port, () => {
    console.log(`Servidor listo en puerto ${port}`);
});