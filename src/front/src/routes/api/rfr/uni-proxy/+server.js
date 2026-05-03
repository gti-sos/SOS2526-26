
export async function GET({ url }) {
    const apiServerHost = 'https://universities.hipolabs.com/search';
    const targetUrl = apiServerHost + url.search;

    try {
        const response = await fetch(targetUrl, {
            // Añadimos esto para evitar el "fetch failed"
            headers: { 'User-Agent': 'Mozilla/5.0' } 
        });
        
        const data = await response.json();
        return new Response(JSON.stringify(data), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.log("Error en uni-proxy:", error.message);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}