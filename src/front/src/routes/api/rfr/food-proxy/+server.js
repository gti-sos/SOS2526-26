
export async function GET({ url }) {
    const apiServerHost = 'https://world.openfoodfacts.org/cgi/search.pl';
    
    // IMPORTANTE: Asegúrate de que url.search no esté vacío
    const targetUrl = apiServerHost + url.search;

    try {
        const response = await fetch(targetUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const data = await response.json();
        return new Response(JSON.stringify(data), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.log("Error en food-proxy:", error.message);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}