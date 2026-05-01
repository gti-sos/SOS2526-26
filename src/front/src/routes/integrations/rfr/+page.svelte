<!-- 1/2 Integraciones de SOS, 0/2 usos de SOS, 0/3 usos de API normal -> 0,8 -->
 <!-- workers-productivity -->

<script>
    import { onMount } from 'svelte';
    import { browser } from '$app/environment';
    import { env } from '$env/dynamic/public';

    let loading = $state(true);
    let errorMessage = $state('');
    
    // Referencias para las dos gráficas
    let chartContainer;
    let myChart; 
    let chartContainer2;
    let myChart2;

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

    // Lógica de matching para la Gráfica 1
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

    // Inicialización Gráfica 1 (BAR)
    function initChart(echarts, data) {
        if (!chartContainer) return;
        myChart = echarts.init(chartContainer);
        const option = {
            title: { text: 'Valor de Mercado vs Productividad', left: 'center', top: '2%' },
            tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
            legend: { bottom: '2%' },
            grid: { left: '180', right: '10%', top: '15%', bottom: '15%', containLabel: false },
            xAxis: { type: 'value', name: 'M€ / Valor', nameLocation: 'middle', nameGap: 40 },
            yAxis: { type: 'category', data: data.categories, axisLabel: { fontSize: 12, margin: 20 } },
            series: [
                { name: 'Valor Plantilla (M€)', type: 'bar', data: data.squadSeriesData, itemStyle: { color: '#2c3e50' }, barMaxWidth: 40 },
                { name: 'Productividad Laboral', type: 'bar', data: data.prodSeriesData, itemStyle: { color: '#3490dc' }, barMaxWidth: 40 }
            ]
        };
        myChart.setOption(option);
        const ro = new ResizeObserver(() => myChart && myChart.resize());
        ro.observe(chartContainer);
    }

    // Inicialización Gráfica 2 (PIE)
    function initPieChart(echarts, rawData) {
        if (!chartContainer2) return;
        myChart2 = echarts.init(chartContainer2);
        const pieData = rawData.map(item => ({
            value: item.un_2025_population,
            name: item.city
        }));
        const option = {
            title: { text: 'Distribución de Población Urbana (2025)', subtext: 'Fuente: API /citys-stats', left: 'center' },
            tooltip: { trigger: 'item', formatter: '{a} <br/>{b}: {c} ({d}%)' },
            legend: { orient: 'vertical', left: 'left', type: 'scroll' },
            series: [{
                name: 'Población UN',
                type: 'pie',
                radius: '50%',
                data: pieData,
                emphasis: { itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0, 0, 0, 0.5)' } }
            }]
        };
        myChart2.setOption(option);
        const ro = new ResizeObserver(() => myChart2 && myChart2.resize());
        ro.observe(chartContainer2);
    }

    onMount(async () => {
        if (!browser) return;
        try {
            const echarts = await import('echarts');
            // IMPORTANTE: Se añade citiesRes a la desestructuración
            const [squadRes, productivityRes, citiesRes] = await Promise.all([
                loadDataset('/api/v2/fifa-squad-value-per-years'),
                loadDataset('https://sos2526-19-integracion.onrender.com/api/v1/workers-productivity'),
                loadDataset('https://sos2526-29.onrender.com/api/v2/citys-stats')
            ]);

            const processedData = processAndMatchData(squadRes, productivityRes);
            
            initChart(echarts, processedData);
            initPieChart(echarts, citiesRes);
        } catch (error) {
            console.error(error);
            errorMessage = error.message;
        } finally {
            loading = false;
        }
    });
</script>

<main class="analytics-page">
    <h1>Panel de Visualización de Datos</h1>

    {#if loading}
        <div class="status">Cargando y procesando datos de múltiples APIs...</div>
    {:else if errorMessage}
        <div class="error">{errorMessage}</div>
    {/if}

    <section class:hidden={loading || errorMessage}>
        <h2>Integración: Mercado vs Productividad</h2>
        <div bind:this={chartContainer} class="chart-viewport"></div>
    </section>

    <hr class="separator" />

    <section class:hidden={loading || errorMessage}>
        <h2>Uso: Población Urbana 2025</h2>
        <div bind:this={chartContainer2} class="chart-viewport"></div>
    </section>
</main>

<style>
    .analytics-page {
        max-width: 1200px;
        margin: 2rem auto;
        padding: 2rem;
        background: white;
        border-radius: 8px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        font-family: sans-serif;
    }

    .chart-viewport {
        width: 100% !important;
        height: 600px !important;
        margin-top: 1rem;
        display: block;
    }

    .separator {
        margin: 4rem 0;
        border: 0;
        border-top: 1px solid #eee;
    }

    section h2 {
        color: #34495e;
        text-align: center;
        margin-top: 2rem;
    }

    .hidden { display: none; }
    .error { color: #721c24; background: #f8d7da; padding: 1rem; border-radius: 4px; margin: 1rem 0; }
    .status { padding: 2rem; text-align: center; color: #666; font-style: italic; }
    h1 { text-align: center; color: #2c3e50; border-bottom: 2px solid #eee; padding-bottom: 1rem; }
</style>