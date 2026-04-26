<script>
    import { onMount } from 'svelte';
    import { browser } from '$app/environment';
    import 'leaflet/dist/leaflet.css';

    let loading = $state(true);
    let errorMessage = $state('');
    let mapContainer;

    // Tu endpoint
    const API_ENDPOINT = '/api/v2/national-team-rankings-per-years';

    // Diccionario de coordenadas (puedes ampliarlo)
    const countryCoordinates = {
        'alemania': [51.1657, 10.4515],
        'espana': [40.4637, -3.7492],
        'francia': [46.2276, 2.2137],
        'italia': [41.8719, 12.5674],
        'brasil': [-14.2350, -51.9253],
        'argentina': [-38.4161, -63.6167],
        'belgica': [50.5039, 4.4699],
        'inglaterra': [52.3555, -1.1743],
        'portugal': [39.3999, -8.2245],
        'mexico': [23.6345, -102.5528]
    };

    function normalizeCountryName(name) {
        return String(name ?? '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, '-');
    }

    // Lógica de color según el RANK (Puesto en el mundial/FIFA)
    function getColorByRank(rank) {
        if (rank <= 5) return '#27ae60'; // Top 5: Verde
        if (rank <= 20) return '#2ecc71'; // Top 20: Verde claro
        if (rank <= 50) return '#f1c40f'; // Top 50: Amarillo
        return '#e67e22'; // Otros: Naranja
    }

    async function fetchRankingsData() {
        const response = await fetch(API_ENDPOINT);
        if (!response.ok) throw new Error('Error al conectar con la API.');

        let data = await response.json();
        if (Array.isArray(data) && data.length > 0) return data;

        // Si está vacío, intentamos cargar datos iniciales
        await fetch(`${API_ENDPOINT}/loadInitialData`).catch(() => null);
        const seeded = await fetch(API_ENDPOINT);
        data = await seeded.json();
        return Array.isArray(data) ? data : [];
    }

    function buildPopup(row) {
        return `
            <div style="text-align: center;">
                <h3 style="margin: 0; color: #2c3e50;">${row.country.toUpperCase()}</h3>
                <hr/>
                <p><b>Puesto:</b> #${row.rank}</p>
                <p><b>Puntos FIFA:</b> ${row.score}</p>
                <p><b>Año:</b> ${row.year}</p>
                <small>Var. desde 2018: ${row.rank_variation_from_two_thousand_eighteen}</small>
            </div>
        `;
    }

    onMount(async () => {
        if (!browser) return;

        try {
            const L = (await import('leaflet')).default;
            const data = await fetchRankingsData();

            const map = L.map(mapContainer).setView([20, 0], 2);
            
            
            L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; OpenStreetMap &copy; CARTO'
            }).addTo(map);

            data.forEach(row => {
                const key = normalizeCountryName(row.country);
                const coords = countryCoordinates[key];

                if (coords) {
                    // Calculamos el radio proporcional al SCORE (normalizado)
                    // Ajustamos el valor para que no cubra todo el mapa
                    const radiusValue = Math.sqrt(row.score) / 1.5; 

                    const marker = L.circleMarker(coords, {
                        radius: radiusValue,
                        fillColor: getColorByRank(row.rank),
                        color: "#fff",
                        weight: 2,
                        opacity: 1,
                        fillOpacity: 0.7
                    }).addTo(map);

                    marker.bindPopup(buildPopup(row));
                }
            });

        } catch (error) {
            errorMessage = error.message;
        } finally {
            loading = false;
        }
    });
</script>

<main class="container">
    <header>
        <h1>🌍 Mapa de Potencial Futbolístico</h1>
        <p>Visualización del ranking FIFA y puntuación por países.</p>
    </header>

    <div bind:this={mapContainer} class="map-frame"></div>

    {#if loading}
        <div class="status">Cargando datos geoespaciales...</div>
    {:else if errorMessage}
        <div class="status error">{errorMessage}</div>
    {/if}

    <footer class="back-link">
        <a href="/analytics">← Volver al Panel General</a>
    </footer>
</main>

<style>
    :global(body) { background-color: #f4f7f6; }
    
    .container {
        max-width: 1200px;
        margin: 0 auto;
        padding: 40px 20px;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    }

    header { text-align: center; margin-bottom: 30px; }
    h1 { color: #2c3e50; margin: 0; font-size: 2.5rem; }
    
    .map-frame {
        width: 100%;
        height: 600px;
        border-radius: 15px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.1);
        border: 4px solid white;
    }

    .status {
        text-align: center;
        padding: 20px;
        font-weight: bold;
    }

    .error { color: #e74c3c; }

    .back-link { margin-top: 30px; text-align: center; }
    .back-link a {
        color: #3498db;
        text-decoration: none;
        font-weight: bold;
        transition: 0.3s;
    }
    .back-link a:hover { color: #2980b9; }
</style>