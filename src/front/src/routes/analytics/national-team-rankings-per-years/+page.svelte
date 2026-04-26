<script>
    import { onMount } from 'svelte';
    import { browser } from '$app/environment';

    let chartContainer;
    let rankings = [];

    onMount(async () => {
        if (browser) {
            await fetchData();
        }
    });

    async function fetchData() {
        try {
            const res = await fetch("/api/v2/national-team-rankings-per-years");
            if (res.ok) {
                rankings = await res.json();
                
                if (rankings.length === 0) {
                    await fetch("/api/v2/national-team-rankings-per-years/loadInitialData");
                    const retry = await fetch("/api/v2/national-team-rankings-per-years");
                    rankings = await retry.json();
                }

                if (rankings.length > 0) {
                    // --- CARGA SEGURA DE MÓDULOS ---
                    const Highcharts = (await import('highcharts')).default;
                    
                    // Importamos el módulo y verificamos si la función está en .default o es el módulo en sí
                    const stockModule = await import('highcharts/modules/stock');
                    const Stock = stockModule.default || stockModule; 
                    
                    // Verificamos que sea una función antes de llamarla
                    if (typeof Stock === 'function') {
                        Stock(Highcharts);
                    }

                    loadChart(Highcharts);
                }
            }
        } catch (error) {
            console.error("Error cargando la gráfica:", error);
        }
    }

    function loadChart(Highcharts) {
        // 1. PROCESAMIENTO: Solo el año más reciente por país
        const latestRankingsMap = {};
        rankings.forEach(r => {
            if (!latestRankingsMap[r.country] || r.year > latestRankingsMap[r.country].year) {
                latestRankingsMap[r.country] = r;
            }
        });

        const dataForChart = Object.values(latestRankingsMap)
            .sort((a, b) => b.score - a.score); // Ordenados de mejor a peor

        Highcharts.chart(chartContainer, {
            chart: {
                type: 'column',
                backgroundColor: '#ffffff'
            },
            title: { text: '📊 Ranking FIFA: Puntuación Actual' },
            subtitle: { text: 'Desliza la barra inferior para ver todos los países' },
            xAxis: {
                categories: dataForChart.map(d => d.country),
                min: 0,
                max: 10, // Muestra solo 11 columnas a la vez para evitar el efecto "peine"
                scrollbar: {
                    enabled: true // Requiere el módulo Stock cargado arriba
                },
                labels: {
                    style: { fontSize: '12px' }
                }
            },
            yAxis: {
                title: { text: 'Puntos (Score)' },
                min: 0
            },
            tooltip: {
                useHTML: true,
                pointFormat: `
                    <b>País:</b> {point.category}<br/>
                    <b>Puntos:</b> {point.y}<br/>
                    <b>Puesto:</b> #{point.rank}<br/>
                    <b>Año del dato:</b> {point.year}
                `
            },
            plotOptions: {
                column: {
                    borderRadius: 5,
                    colorByPoint: true,
                    dataLabels: {
                        enabled: true,
                        format: '{point.y}'
                    }
                }
            },
            series: [{
                name: 'Puntuación',
                // Pasamos los datos como objetos para que el tooltip tenga acceso a "rank" y "year"
                data: dataForChart.map(d => ({
                    y: d.score,
                    rank: d.rank,
                    year: d.year
                })),
                showInLegend: false
            }],
            colors: ['#2c3e50', '#2980b9', '#27ae60', '#f1c40f', '#e67e22', '#e74c3c'],
            credits: { enabled: false }
        });
    }
</script>

<main>
    <div class="card">
        <div bind:this={chartContainer}></div>
        
        <div class="info">
            <p>Se muestra únicamente el registro más reciente de cada selección para facilitar la comparativa.</p>
            <a href="/front-mgn" class="btn">Volver a la tabla</a>
        </div>
    </div>
</main>

<style>
    .card {
        max-width: 1000px;
        margin: 40px auto;
        padding: 20px;
        background: white;
        border-radius: 15px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.1);
    }
    .info {
        text-align: center;
        margin-top: 20px;
    }
    .btn {
        display: inline-block;
        margin-top: 15px;
        padding: 10px 25px;
        background: #2c3e50;
        color: white;
        text-decoration: none;
        border-radius: 5px;
    }
</style>