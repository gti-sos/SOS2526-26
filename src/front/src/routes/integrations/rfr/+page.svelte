<!-- 2/2 Integraciones de SOS, 2/2 usos de SOS, 2/3 usos de API normal -> 0,95 -->
 <!-- APIs usadas: workers-productivity, citys-stats, cholera-stats, hipolabs-universities, pokeapi, SIGUIENTE: OpenFoodFacts -->
<!-- Gráficas usadas: Bar-ECharts, Pie-ECharts, Scatter-ECharts, Tree-ECharts, Radar-ECharts, HeatMap-ECharts. SIGUIENTE: TreeMap-ECharts (PROXY)-->
<!-- Hacer el proxy con la API OpenFoodFacts -->

<script>
    import { onMount } from 'svelte';
    import { browser } from '$app/environment';
    import { env } from '$env/dynamic/public';

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
    let chartContainer5;
    let myChart5;
    let chartContainer6;
    let myChart6;
    let chartContainer7;
    let myChart7;

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

function processRickAndMortyTree(results) {
    const root = { name: "Multiverso", children: [] };
    const dimensionsMap = {};

    results.forEach(loc => {
        const dimName = loc.dimension || "Unknown Dimension";
        
        if (!dimensionsMap[dimName]) {
            dimensionsMap[dimName] = { name: dimName, children: [] };
            root.children.push(dimensionsMap[dimName]);
        }

        // Añadimos el planeta o lugar a la dimensión
        dimensionsMap[dimName].children.push({
            name: loc.name
        });
    });

    return root;
}

// Inicialización gráfica 4 (TREE - Rick and Morty dimensions)
    function initTreeChart(echarts, treeData) {
        if (!chartContainer4) return;
        myChart4 = echarts.init(chartContainer4);

        const option = {
            title: { 
                text: 'Jerarquía de Dimensiones y Lugares en Rick y Morty', 
                subtext: 'Fuente: API /proxy/dimensions',
                left: 'center',
                top: '2%'
            },
            tooltip: { 
                trigger: 'item', 
                triggerOn: 'mousemove',
                formatter: '{b}' // Muestra el nombre del nodo al pasar el ratón
            },
            series: [
                {
                    type: 'tree',
                    data: [treeData],
                    top: '8%',
                    left: '12%',   
                    bottom: '2%',
                    right: '25%',  
                    symbolSize: 10,
                    itemStyle: {
                        color: '#c23531', 
                        borderColor: '#911'
                    },
                    label: {
                        position: 'left',
                        verticalAlign: 'middle',
                        align: 'right',
                        fontSize: 11,
                        fontWeight: 'bold'
                    },
                    leaves: {
                        label: {
                            position: 'right',
                            verticalAlign: 'middle',
                            align: 'left',
                            fontWeight: 'normal'
                        }
                    },
                    emphasis: { 
                        focus: 'descendant',
                        itemStyle: {
                            color: '#ff4d4f',
                            shadowBlur: 10
                        }
                    },
                    
                    expandAndCollapse: true, 
                    initialTreeDepth: 1, 
                    animationDuration: 550,
                    animationDurationUpdate: 750
                }
            ]
        };

        myChart4.setOption(option);

        // Resize automático
        const ro = new ResizeObserver(() => {
            if (myChart4) myChart4.resize();
        });
        ro.observe(chartContainer4);
    }
 

function initPokemonRadar(echarts, stats) {
    if (!chartContainer5) return;
    myChart5 = echarts.init(chartContainer5);

    const option = {
        title: {
            text: 'Estadísticas Base: Garchomp',
            left: 'center',
            textStyle: { color: '#333' }
        },
        tooltip: { trigger: 'item' },
        radar: {
            indicator: [
                { name: 'Puntos de Vida (HP)', max: 150 },
                { name: 'Ataque', max: 150 },
                { name: 'Defensa', max: 150 },
                { name: 'At. Especial', max: 150 },
                { name: 'Def. Especial', max: 150 },
                { name: 'Velocidad', max: 150 }
            ],
            shape: 'polygon',
            splitNumber: 5,
            axisName: { color: '#2c3e50' },
            splitLine: { lineStyle: { color: 'rgba(0,0,0,0.1)' } },
            splitArea: { areaStyle: { color: ['#fff', '#f9f9f9'] } }
        },
        series: [{
            name: 'Garchomp Stats',
            type: 'radar', // TIPO EXCLUSIVO
            data: [{
                value: stats,
                name: 'Garchomp',
                itemStyle: { color: '#34495e' }, // Azul oscuro/grisáceo como Garchomp
                areaStyle: { color: 'rgba(52, 73, 94, 0.4)' },
                symbolSize: 8
            }]
        }]
    };

    myChart5.setOption(option);
    const ro = new ResizeObserver(() => myChart5 && myChart5.resize());
    ro.observe(chartContainer5);
}

// Procesar datos para TreeMap de Frutas
    function processFruitData(fruits) {
        return fruits.map(fruit => ({
          name: fruit.name, // Nombre de la fruta
          value: fruit.nutritions.sugar,
        }));
    }

    // Inicializar TreeMap de Frutas
    function initFruitTreeMap(echarts, data) {
        if (!chartContainer6) return;
        myChart6 = echarts.init(chartContainer6);
        const option = {
            title: { text: 'Concentración de Azúcar por Fruta', left: 'center' },
            tooltip: { 
            // 'info.name' es el nombre, 'info.value' son las calorías
            formatter: (info) => `<b>${info.name}</b><br/>Azúcar: ${info.value}g`
            },
            series: [{
                type: 'treemap',
                data: data,
                levels: [{
                    itemStyle: {
                        borderWidth: 2,
                        borderColor: '#fff',
                        gapWidth: 1
                    }
                }]
            }]
        };
        myChart6.setOption(option);
        const ro = new ResizeObserver(() => myChart6 && myChart6.resize());
        ro.observe(chartContainer6);
    }

function processHeatmapData(rawData) {
    // 1. Definimos los "cubos" o rangos
    const years = ['<1950', '1951-1975', '1976-2000', '2001-2025'];
    const capacities = ['0-50 MW', '51-200 MW', '201-1000 MW', '>1000 MW'];

    // 2. Inicializamos la matriz de datos con ceros [x, y, valor]
    // x: años, y: capacidad
    let matrix = [];
    for (let i = 0; i < years.length; i++) {
        for (let j = 0; j < capacities.length; j++) {
            matrix.push([i, j, 0]);
        }
    }

    // 3. Lógica de clasificación
    rawData.forEach(plant => {
        let xIndex = -1;
        let yIndex = -1;

        // Clasificar Año (X)
        if (plant.year <= 1950) xIndex = 0;
        else if (plant.year <= 1975) xIndex = 1;
        else if (plant.year <= 2000) xIndex = 2;
        else xIndex = 3;

        // Clasificar Capacidad (Y)
        if (plant.capacity_mw <= 50) yIndex = 0;
        else if (plant.capacity_mw <= 200) yIndex = 1;
        else if (plant.capacity_mw <= 1000) yIndex = 2;
        else yIndex = 3;

        // Buscamos la celda en nuestra matriz plana y sumamos 1
        // La fórmula para encontrar el índice en el array plano es (x * num_filas + y)
        const cellIndex = xIndex * capacities.length + yIndex;
        matrix[cellIndex][2]++;
    });

    return { matrix, years, capacities };
}

function initHeatmap(echarts, data) {
    if (!chartContainer7) return;
    myChart7 = echarts.init(chartContainer7);

    const option = {
        title: { text: 'Densidad de Plantas: Antigüedad vs Potencia', left: 'center' },
        tooltip: { position: 'top' },
        grid: { height: '50%', top: '15%' },
        xAxis: { type: 'category', data: data.years, splitArea: { show: true } },
        yAxis: { type: 'category', data: data.capacities, splitArea: { show: true } },
        visualMap: {
            min: 0,
            max: 15, // Ajusta esto según cuántas plantas suelan caer en un rango
            calculable: true,
            orient: 'horizontal',
            left: 'center',
            bottom: '15%',
            inRange: { color: ['#e0f3f8', '#0868ac'] } // De azul claro a azul oscuro
        },
        series: [{
            name: 'Número de Plantas',
            type: 'heatmap',
            data: data.matrix,
            label: { show: true },
            emphasis: {
                itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0, 0, 0, 0.5)' }
            }
        }]
    };

    myChart7.setOption(option);
    const ro = new ResizeObserver(() => myChart6 && myChart7.resize());
    ro.observe(chartContainer7);
}

  onMount(async () => {
        if (!browser) return;
        try {
            const echarts = await import('echarts');
        
            await Promise.all([
            fetch('/api/v2/fifa-squad-value-per-years/loadInitialData', { method: 'POST' }).catch(() => {}),
            fetch('https://sos2526-19-integracion.onrender.com/api/v1/workers-productivity/loadInitialData').catch(() => {}),
            fetch('https://sos2526-29.onrender.com/api/v2/citys-stats/loadInitialData').catch(() => {}),
            fetch('https://soporte-sos.onrender.com/api/v1/cholera-stats/loadInitialData').catch(() => {}),
            fetch('https://sos2526-27.onrender.com/api/v1/world-hydroelectric-plants/loadInitialData').catch(() => {})
        ]);
            const [squadRes, productivityRes, citiesRes, choleraRes, dimensionsRes, pokeRes, fruitRes, hydroRes] = await Promise.all([
                loadDataset('/api/v2/fifa-squad-value-per-years'),
                loadDataset('https://sos2526-19-integracion.onrender.com/api/v1/workers-productivity'),
                loadDataset('https://sos2526-29.onrender.com/api/v2/citys-stats'),
                loadDataset('https://soporte-sos.onrender.com/api/v1/cholera-stats'),
                loadDataset('/api/v1/proxy/dimensions'),
                loadDataset('https://pokeapi.co/api/v2/pokemon/garchomp'),
                loadDataset('/api/v1/proxy/fruits'),
                loadDataset('https://sos2526-27.onrender.com/api/v1/world-hydroelectric-plants/')
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
            // 4. Procesar Gráfica 4 (Tree) - Usamos los datos de Hipolabs
            const treeData = processRickAndMortyTree(dimensionsRes); // dimensionsRes son los datos de las dimensiones y planetas
            initTreeChart(echarts, treeData);

            // 5. Procesar Radar (Garchomp) - Extraemos los stats aquí mismo
            const garchompStats = pokeRes.stats.map(s => s.base_stat);
            initPokemonRadar(echarts, garchompStats);
            
            const fruitData = processFruitData(fruitRes);
            initFruitTreeMap(echarts, fruitData);

            const heatmapData = processHeatmapData(hydroRes);
            initHeatmap(echarts, heatmapData);

            

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
        <h2>Uso API Externa: Jerarquía de Dimensiones de Rick y Morty</h2>
        <div bind:this={chartContainer4} class="tree-viewport"></div>
    </section>

    <hr class="separator" />

    <section class:hidden={loading || errorMessage}>
        <h2>Uso API Externa: Estadísticas Garchomp</h2>
        <div bind:this={chartContainer5} class="chart"></div>
    </section>

    <hr class="separator" />

    <section class:hidden={loading || errorMessage}>
        <h2>Uso API Externa: Azúcares en Frutas (TreeMap)</h2>
        <div bind:this={chartContainer6} class="chart"></div>
    </section>

    <hr class="separator" />

    <section class:hidden={loading || errorMessage}>
        <h2>Uso: Antiguedad vs Potencia en Plantas Hidroeléctricas</h2>
        <div bind:this={chartContainer7} class="chart"></div>
    </section>

    <hr class="separator" />
</main>

<style>
    
    .chart {
        width: 100%;
        height: 400px; 
        display: block;
        margin-bottom: 2rem;
    }
    .tree-viewport {
    width: 100% !important;
    height: 800px !important; 
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