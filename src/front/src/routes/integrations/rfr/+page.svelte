<!-- 1/2 Integraciones de SOS, 0/2 usos de SOS, 0/3 usos de API normal -> 0,8 -->

<script>
    import { onMount } from 'svelte';
    import { browser } from '$app/environment';
    import { env } from '$env/dynamic/public';

    let loading = $state(true);
    let errorMessage = $state('');
    let chartContainer;
    let myChart; // Referencia para el objeto echarts

    const REQUEST_TIMEOUT_MS = 15000;
    const API_BASE_URL = (
        (env.PUBLIC_API_URL && env.PUBLIC_API_URL.trim()) ||
        (typeof window !== 'undefined' ? window.location.origin : '')
    ).replace(/\/$/, '');

    function toApiUrl(path) {
        if (/^https?:\/\//.test(path)) return path;
        return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
    }

    async function fetchWithTimeout(url) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
        try {
            return await fetch(url, { signal: controller.signal });
        } finally {
            clearTimeout(timeoutId);
        }
    }

    async function loadDataset(apiBasePath) {
        const endpoint = toApiUrl(apiBasePath);
        const response = await fetchWithTimeout(endpoint);
        if (!response.ok) throw new Error(`Error: ${response.status}`);
        return await response.json();
    }

    function processAndMatchData(squadData, productivityData) {
        const squadMap = new Map();
        squadData.forEach((item) => {
            if (item.country && item.year && item.total_market_value) {
                const key = `${item.country.trim()}_${item.year}`;
                squadMap.set(key, parseFloat(item.total_market_value));
            }
        });

        const prodMap = new Map();
        productivityData.forEach((item) => {
            const metricKey = 'productivity_hour'; 
            if (item.country && item.year && item[metricKey]) {
                const key = `${item.country.trim()}_${item.year}`;
                prodMap.set(key, parseFloat(item[metricKey]));
            }
        });

        const commonKeys = [...squadMap.keys()].filter((key) => prodMap.has(key));
        commonKeys.sort((a, b) => {
            const [countryA, yearA] = a.split('_');
            const [countryB, yearB] = b.split('_');
            return countryA.localeCompare(countryB) || Number(yearA) - Number(yearB);
        });

        return {
            categories: commonKeys.map(k => k.replace('_', ' ')),
            squadSeriesData: commonKeys.map(k => squadMap.get(k)),
            prodSeriesData: commonKeys.map(k => prodMap.get(k))
        };
    }

    function initChart(echarts, data) {
        if (!chartContainer) return;

        myChart = echarts.init(chartContainer);

        const option = {
            title: {
                text: 'Valor de Mercado vs Productividad',
                left: 'center',
                top: '2%'
            },
            tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
            legend: { bottom: '2%' },
            grid: {
                left: '180',   // Espacio fijo para que "Spain 1996" no se corte
                right: '10%',
                top: '15%',
                bottom: '15%',
                containLabel: false // Usamos margen fijo para control total
            },
            xAxis: {
                type: 'value',
                name: 'M€ / Valor',
                nameLocation: 'middle',
                nameGap: 40,
                axisLabel: { hideOverlap: true }
            },
            yAxis: {
                type: 'category',
                data: data.categories,
                axisLabel: {
                    fontSize: 12,
                    margin: 20
                }
            },
            series: [
                {
                    name: 'Valor Plantilla (M€)',
                    type: 'bar',
                    data: data.squadSeriesData,
                    itemStyle: { color: '#2c3e50' },
                    barMaxWidth: 40
                },
                {
                    name: 'Productividad Laboral',
                    type: 'bar',
                    data: data.prodSeriesData,
                    itemStyle: { color: '#3490dc' },
                    barMaxWidth: 40
                }
            ]
        };

        myChart.setOption(option);

        // --- SOLUCIÓN AL PROBLEMA DE COMPRESIÓN (Captura SOS23.PNG) ---
        // Observamos cambios en el tamaño del div para redibujar la gráfica
        const resizeObserver = new ResizeObserver(() => {
            if (myChart) myChart.resize();
        });
        resizeObserver.observe(chartContainer);

        // Forzado extra tras medio segundo
        setTimeout(() => myChart.resize(), 500);
    }

    onMount(async () => {
        if (!browser) return;
        try {
            const echarts = await import('echarts');
            const [squadRes, productivityRes] = await Promise.all([
                loadDataset('/api/v2/fifa-squad-value-per-years'),
                loadDataset('https://sos2526-19-integracion.onrender.com/api/v1/workers-productivity')
            ]);

            const processedData = processAndMatchData(squadRes, productivityRes);
            if (processedData.categories.length === 0) throw new Error('Sin datos comunes.');

            initChart(echarts, processedData);
        } catch (error) {
            console.error(error);
            errorMessage = error.message;
        } finally {
            loading = false;
        }
    });
</script>

<main class="analytics-page">
    <header>
        <h1>Integración de Datos</h1>
        <p>Visualización con <strong>Apache ECharts</strong> (Tipo: Bar).</p>
    </header>

    {#if loading}
        <div class="status">Cargando y procesando...</div>
    {:else if errorMessage}
        <div class="error">{errorMessage}</div>
    {/if}

    <!-- Contenedor con altura forzada para evitar el colapso de SOS23.PNG -->
    <div 
        bind:this={chartContainer} 
        class="chart-viewport" 
        class:hidden={loading || errorMessage}>
    </div>
</main>

<style>
    .analytics-page {
        max-width: 1200px;
        margin: 2rem auto;
        padding: 2rem;
        background: white;
        border-radius: 8px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }

    /* ESTO SOLUCIONA EL TAMAÑO */
    .chart-viewport {
        width: 100% !important;
        height: 650px !important; /* Altura generosa */
        min-height: 600px;
        margin-top: 2rem;
        display: block;
    }

    .hidden { display: none; }
    .error { color: #721c24; background: #f8d7da; padding: 1rem; border-radius: 4px; }
    .status { padding: 2rem; text-align: center; color: #666; }
    
    h1 { color: #2c3e50; border-bottom: 2px solid #eee; padding-bottom: 0.5rem; }
</style>