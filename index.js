import express from 'express';
import cors from 'cors';
import { handler } from './src/front/build/handler.js';

// Importar los 6 módulos (usando import)
import mgn_api1 from './src/back/index-MGN.js';
import mgn_api2 from './src/back/index-MGN2.js';
import rfr_api1 from './src/back/index-RFR.js';
import rfr_api2 from './src/back/index-RFR2.js';
import sdv_api from './src/back/index-SDV.js';
import sdv_api2 from './src/back/index-SDV2.js';

const app = express();

var proxyPath = '/api/v1/proxy/education-spending';
const worldBankCountries = ['ESP', 'USA', 'CHN', 'FRA', 'JPN', 'IND', 'NOR', 'BRA', 'NGA', 'AUS'];
const worldBankIndicator = 'SE.XPD.TOTL.GD.ZS';
const worldBankBaseUrl = `https://api.worldbank.org/v2/country/all/indicator/${worldBankIndicator}`;
var foodProxyPath = '/api/v1/proxy/food-products';
const foodApiBaseUrl = 'https://world.openfoodfacts.org/cgi/search.pl';
var uniProxyPath = '/api/v1/proxy/uni';
const uniApiBaseUrl = 'https://universities.hipolabs.com/search';

app.get(proxyPath, async function(req, res) {
    try {
        const wantedCountries = new Set(worldBankCountries);
        const perPage = 20000;
        const firstUrl = `${worldBankBaseUrl}?format=json&per_page=${perPage}&page=1`;

        console.log('Petición redirigida vía Proxy a: ' + firstUrl);
        const firstResp = await fetch(firstUrl);
        if (!firstResp.ok) {
            return res.status(firstResp.status).send(`Error consultando World Bank: ${firstResp.status}`);
        }

        const firstPayload = await firstResp.json();
        const meta = firstPayload?.[0] || {};
        const totalPages = Number(meta.pages) || 1;
        let rows = Array.isArray(firstPayload?.[1]) ? firstPayload[1] : [];

        if (totalPages > 1) {
            for (let page = 2; page <= totalPages; page += 1) {
                const pageUrl = `${worldBankBaseUrl}?format=json&per_page=${perPage}&page=${page}`;
                const pageResp = await fetch(pageUrl);
                if (!pageResp.ok) continue;
                const pagePayload = await pageResp.json();
                const pageRows = Array.isArray(pagePayload?.[1]) ? pagePayload[1] : [];
                rows = rows.concat(pageRows);
            }
        }

        rows = rows.filter((row) => wantedCountries.has(String(row?.countryiso3code || '').toUpperCase()));

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

mgn_api1(app);
mgn_api2(app);
sdv_api(app);
sdv_api2(app);
rfr_api1(app);
rfr_api2(app);

app.use(handler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});