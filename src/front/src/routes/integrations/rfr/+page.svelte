<!-- 2/2 Integraciones de SOS, 1/2 usos de SOS, 1/3 usos de API normal -> 0,8 -->
 <!-- APIs usadas: workers-productivity, citys-stats -->
<!-- Gráficas usadas: Bar-ECharts, Pie-ECharts, Scatter-ECharts-->

<script>
    import { onMount } from 'svelte';
    import { browser } from '$app/environment';
    import { env } from '$env/dynamic/public';
    import * as echarts from 'echarts';

    let loading = $state(true);
    let errorMessage = $state('');
    
    // Referencias para las cuatro gráficas
    let chartContainer;
    let myChart; 
    let chartContainer2;
    let myChart2;
    let chartContainer3;
    let myChart3;
    let chartContainer4;
    let myChart4;

    const REQUEST_TIMEOUT_MS = 40000;
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
    // Procesar datos para la Gráfica 3 (SCATTER)
function processScatterData(squadData, choleraData) {
    const countryStats = new Map();

    // 1. Procesar datos de Plantillas (Eje X)
    squadData.forEach(item => {
        if (item.country && item.total_market_value) {
            const country = item.country.trim();
            if (!countryStats.has(country)) {
                countryStats.set(country, { squadValues: [], choleraCases: [] });
            }
            countryStats.get(country).squadValues.push(parseFloat(item.total_market_value));
        }
    });

    // 2. Procesar datos de Cólera (Eje Y)
    choleraData.forEach(item => {
        if (item.country && item.reportedCases !== undefined) {
            const country = item.country.trim();
            if (countryStats.has(country)) {
                countryStats.get(country).choleraCases.push(parseFloat(item.reportedCases));
            }
        }
    });

    // 3. Calcular medias y filtrar países que no tengan ambos datos
    const finalData = [];
    countryStats.forEach((stats, country) => {
        if (stats.squadValues.length > 0 && stats.choleraCases.length > 0) {
            const avgSquad = stats.squadValues.reduce((a, b) => a + b, 0) / stats.squadValues.length;
            const avgCholera = stats.choleraCases.reduce((a, b) => a + b, 0) / stats.choleraCases.length;
            
            // ECharts Scatter necesita: [valorX, valorY, nombrePaís]
            finalData.push([avgSquad.toFixed(2), avgCholera.toFixed(2), country]);
        }
    });

    return finalData;
}
 // Grafica 3 (SCATTER)
function initScatterChart(echarts, data) {
    if (!chartContainer3) return;
    myChart3 = echarts.init(chartContainer3);

    const option = {
        title: {
            text: 'Correlación: Riqueza Futbolística vs Incidencia Cólera',
            subtext: 'Media histórica por país (Valores promedio)',
            left: 'center'
        },
        grid: { top: '15%', left: '10%', right: '10%', bottom: '15%', containLabel: true },
        tooltip: {
            trigger: 'item',
            formatter: function (params) {
                return `<b>${params.data[2]}</b><br/>Valor Mercado: ${params.data[0]} M€<br/>Casos Cólera: ${params.data[1]}`;
            }
        },
        xAxis: {
            name: 'Media Valor Plantilla (M€)',
            nameLocation: 'middle',
            nameGap: 30,
            type: 'value'
        },
        yAxis: {
            name: 'Media Casos Cólera Reportados',
            nameLocation: 'middle',
            nameGap: 50,
            type: 'value'
        },
        series: [{
            symbolSize: 20,
            data: data,
            type: 'scatter', // TIPO DISTINTO: SCATTER
            itemStyle: {
                color: '#e67e22',
                opacity: 0.8,
                borderColor: '#d35400',
                borderWidth: 1
            }
        }]
    };

    myChart3.setOption(option);
    const ro = new ResizeObserver(() => myChart3 && myChart3.resize());
    ro.observe(chartContainer3);
}
 // Procesar datos para la gráfica 4 (TREE)
function processTreeData(universities) {
    // Creamos la raíz
    const root = {
        name: "World Universities",
        children: []
    };

    const countriesMap = new Map();

    universities.forEach(uni => {
        const countryName = uni.country;
        if (!countriesMap.has(countryName)) {
            countriesMap.set(countryName, {
                name: countryName,
                children: []
            });
            root.children.push(countriesMap.get(countryName));
        }
        
        // Añadimos la universidad al país correspondiente
        countriesMap.get(countryName).children.push({
            name: uni.name
        });
    });

    return root;
}
 // Inicialización gráfica 4 (TREE)
function initTreeChart(echarts, treeData) {
    if (!chartContainer4) return;
    myChart4 = echarts.init(chartContainer4);

    const option = {
        title: { text: 'Jerarquía de Universidades por País', left: 'center' },
        tooltip: { trigger: 'item', triggerOn: 'mousemove' },
        series: [
            {
                type: 'tree',
                data: [treeData],
                top: '5%',
                left: '15%',
                bottom: '2%',
                right: '20%',
                symbolSize: 7,
                label: {
                    position: 'left',
                    verticalAlign: 'middle',
                    align: 'right',
                    fontSize: 10
                },
                leaves: {
                    label: {
                        position: 'right',
                        verticalAlign: 'middle',
                        align: 'left'
                    }
                },
                emphasis: { focus: 'descendant' },
                expandAndCollapse: true, // Permite clicar para cerrar/abrir ramas
                animationDuration: 550,
                animationDurationUpdate: 750
            }
        ]
    };

    myChart4.setOption(option);
    const ro = new ResizeObserver(() => myChart4 && myChart4.resize());
    ro.observe(chartContainer4);
}

  onMount(async () => {
        if (!browser) return;
        try {
            const echarts = await import('echarts');
            
            const [squadRes, productivityRes, citiesRes, choleraRes, uniRes] = await Promise.all([
                loadDataset('/api/v2/fifa-squad-value-per-years'),
                loadDataset('https://sos2526-19-integracion.onrender.com/api/v1/workers-productivity'),
                loadDataset('https://sos2526-29.onrender.com/api/v2/citys-stats'),
                loadDataset('https://soporte-sos.onrender.com/api/v1/cholera-stats'),
                loadDataset('http://universities.hipolabs.com/search?country=Spain')
            ]);

            // 1. Procesar Gráfica 1 (Barras)
            const processedDataBar = processAndMatchData(squadRes, productivityRes);
            initChart(echarts, processedDataBar);

            // 2. Procesar Gráfica 2 (Pie) 
            initPieChart(echarts, citiesRes);

            // 3. Procesar Gráfica 3 (Scatter) 
            // Usamos la función correcta y guardamos en una variable con distinto nombre
            const scatterPoints = processScatterData(squadRes, choleraRes);
            
            // Pasamos los puntos procesados, NO el choleraRes original
            initScatterChart(echarts, scatterPoints);

            const treeData = processTreeData(uniRes); // uniRes son los datos de Hipolabs
            initTreeChart(echarts, treeData);

        } catch (error) {
            console.error("Error en la carga:", error);
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
        <h2>Integración: Valor de plantilla FIFA vs Productividad</h2>
        <div bind:this={chartContainer} class="chart-viewport"></div>
    </section>

    <hr class="separator" />

    <section class:hidden={loading || errorMessage}>
        <h2>Uso: Población Urbana 2025</h2>
        <div bind:this={chartContainer2} class="chart-viewport"></div>
    </section>

    <hr class="separator" />

    <section class:hidden={loading || errorMessage}>
        <h2>Integración: Valor de plantilla FIFA vs Incidencia Cólera</h2>
        <div bind:this={chartContainer3} class="chart-viewport"></div>
    </section>

    <hr class="separator" />

    <section class:hidden={loading || errorMessage}>
        <h2>Uso: Universidades por País</h2>
        <div bind:this={chartContainer4} class="tree-viewport"></div>
    </section>
</main>

<style>

    .tree-viewport {
    width: 100% !important;
    height: 800px !important; /* Más espacio para las ramas */
    margin-top: 1rem;
    display: block;
    }
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