// ============================================================================
//  Servidor principal de la aplicación SOS2526-26
// ----------------------------------------------------------------------------
//  Este archivo arranca un servidor Express que cumple tres funciones:
//    1. Sirve el frontend de SvelteKit ya compilado (./src/front/build).
//    2. Expone las APIs REST de los tres integrantes del equipo (MGN, RFR, SDV),
//       cada uno con dos recursos distintos (de ahí los seis módulos).
//    3. Actúa como proxy hacia la API pública del Banco Mundial para evitar
//       problemas de CORS desde el navegador y filtrar la respuesta.
// ============================================================================

import express from 'express';
import cors from 'cors';
import { handler } from './src/front/build/handler.js';

// Importación de los 6 módulos backend (2 recursos por integrante del equipo).
// Cada módulo exporta una función que recibe la instancia de Express y le
// registra sus propias rutas (patrón "plug-in").
import mgn_api1 from './src/back/index-MGN.js';
import mgn_api2 from './src/back/index-MGN2.js';
import rfr_api1 from './src/back/index-RFR.js';
import rfr_api2 from './src/back/index-RFR2.js';
import sdv_api from './src/back/index-SDV.js';
import sdv_api2 from './src/back/index-SDV2.js';

const app = express();

// ---------------------------------------------------------------------------
//  Configuración del proxy hacia la API del Banco Mundial
// ---------------------------------------------------------------------------
//  Indicador consultado: SE.XPD.TOTL.GD.ZS = "Gasto público en educación
//  como porcentaje del PIB". Se filtra por un subconjunto de 10 países para
//  reducir el volumen de datos devueltos al cliente.
// ---------------------------------------------------------------------------
var proxyPath = '/api/v1/proxy/education-spending';
const worldBankCountries = ['ESP', 'USA', 'CHN', 'FRA', 'JPN', 'IND', 'NOR', 'BRA', 'NGA', 'AUS'];
const worldBankIndicator = 'SE.XPD.TOTL.GD.ZS';
const worldBankBaseUrl = `https://api.worldbank.org/v2/country/all/indicator/${worldBankIndicator}`;
var foodProxyPath = '/api/v1/proxy/food-products';
const foodApiBaseUrl = 'https://world.openfoodfacts.org/cgi/search.pl';
var uniProxyPath = '/api/v1/proxy/uni';
const uniApiBaseUrl = 'https://universities.hipolabs.com/search';

// Endpoint proxy: el frontend llama aquí en lugar de a la API del Banco Mundial
// directamente, lo cual evita restricciones CORS y permite cachear/filtrar la
// respuesta antes de devolverla.
app.get(proxyPath, async function(req, res) {
    try {
        // Set para hacer comprobaciones O(1) al filtrar países más adelante.
        const wantedCountries = new Set(worldBankCountries);

        // Pedimos un tamaño de página grande para minimizar el número de
        // llamadas necesarias para descargar el conjunto completo.
        const perPage = 20000;
        const firstUrl = `${worldBankBaseUrl}?format=json&per_page=${perPage}&page=1`;

        console.log('Petición redirigida vía Proxy a: ' + firstUrl);

        // Primera llamada: necesaria para conocer el número total de páginas
        // que ofrece la API y poder iterar el resto si fuera necesario.
        const firstResp = await fetch(firstUrl);
        if (!firstResp.ok) {
            return res.status(firstResp.status).send(`Error consultando World Bank: ${firstResp.status}`);
        }

        // La API del Banco Mundial devuelve un array con dos posiciones:
        //   [0] -> metadatos (página actual, total de páginas, etc.)
        //   [1] -> array con los registros de datos
        const firstPayload = await firstResp.json();
        const meta = firstPayload?.[0] || {};
        const totalPages = Number(meta.pages) || 1;
        let rows = Array.isArray(firstPayload?.[1]) ? firstPayload[1] : [];

        // Si hay más de una página, las recorremos todas y vamos acumulando
        // los registros en el array `rows`.
        if (totalPages > 1) {
            for (let page = 2; page <= totalPages; page += 1) {
                const pageUrl = `${worldBankBaseUrl}?format=json&per_page=${perPage}&page=${page}`;
                const pageResp = await fetch(pageUrl);
                // Si una página concreta falla, la saltamos para no abortar
                // toda la respuesta por un error puntual.
                if (!pageResp.ok) continue;
                const pagePayload = await pageResp.json();
                const pageRows = Array.isArray(pagePayload?.[1]) ? pagePayload[1] : [];
                rows = rows.concat(pageRows);
            }
        }

        // Filtramos para devolver únicamente los países que nos interesan.
        rows = rows.filter((row) => wantedCountries.has(String(row?.countryiso3code || '').toUpperCase()));

        // Reconstruimos los metadatos para reflejar que ahora todo viene en
        // una sola página (la respuesta filtrada cabe entera en un único bloque).
        return res.status(200).json([{ ...meta, pages: 1, page: 1, per_page: String(rows.length), total: rows.length }, rows]);
    } catch (error) {
        console.error('Error en proxy de educación:', error);
        return res.status(500).json({ error: 'Error en proxy de educación' });
    }
});

app.get(foodProxyPath, async function(req, res) {
    try {
       
        const queryString = req.url.split('?')[1] || '';
        const targetUrl = `${foodApiBaseUrl}?${queryString}`;

        console.log('Petición redirigida vía Proxy a: ' + targetUrl);

      
        const resp = await fetch(targetUrl);
        
        if (!resp.ok) {
            return res.status(resp.status).send(`Error consultando Open Food Facts: ${resp.status}`);
        }

       
        const payload = await resp.json();
        
       
        let products = Array.isArray(payload?.products) ? payload.products : [];

        
        return res.status(200).json({
            count: products.length,
            page: payload.page || 1,
            products: products
        });

    } catch (error) {
        console.error('Error en proxy de comida:', error);
        return res.status(500).json({ error: 'Error en proxy de comida' });
    }
});

// --- PROXY UNIVERSIDADES (Estilo Banco Mundial) ---
app.get('/api/v1/proxy/universities', async (req, res) => {
    try {
        const country = req.query.country || 'Spain';
        const url = `https://universities.hipolabs.com/search?country=${country}`;
        
        const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
        if (!response.ok) throw new Error('API Externa Saturada');
        
        const data = await response.json();
        res.json(data);
    } catch (e) {
        // Si la API falla, devolvemos un array vacío en lugar de un error 500/503
        // Así tu gráfica no se rompe, simplemente sale vacía.
        console.log("Fallo en Uni-Proxy, devolviendo vacío para evitar error 503");
        res.status(200).json([]); 
    }
});
// ---------------------------------------------------------------------------
//  Middlewares globales
// ---------------------------------------------------------------------------
app.use(cors());                              // Habilita CORS para cualquier origen.
app.use(express.json());                      // Parseo automático de bodies JSON.
app.use("/", express.static("./static"));     // Sirve archivos estáticos públicos.



// ---------------------------------------------------------------------------
//  Registro de las rutas de cada integrante del equipo
// ---------------------------------------------------------------------------
//  Cada función recibe la instancia de Express y "engancha" sus endpoints
//  bajo su propio prefijo (p. ej. /api/v1/... o /api/v2/...).
// ---------------------------------------------------------------------------
mgn_api1(app);
mgn_api2(app);
sdv_api(app);
sdv_api2(app);
rfr_api1(app);
rfr_api2(app);

// Handler de SvelteKit: debe ir DESPUÉS de las rutas de la API para que
// Express atienda primero los endpoints REST y delegue el resto al frontend.
app.use(handler);

// ---------------------------------------------------------------------------
//  Arranque del servidor
// ---------------------------------------------------------------------------
//  Se enlaza a 0.0.0.0 para que sea accesible desde fuera del contenedor
//  (necesario al desplegar con Docker).
// ---------------------------------------------------------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});