<script>
    import { onMount } from 'svelte';
    import { browser } from '$app/environment'; // Para evitar errores de servidor

    let rankings = [];
    let chartContainer;

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
                
                // Si la API está vacía, intentamos cargar los iniciales
                if (rankings.length === 0) {
                    await fetch("/api/v2/national-team-rankings-per-years/loadInitialData");
                    const retry = await fetch("/api/v2/national-team-rankings-per-years");
                    rankings = await retry.json();
                }

                if (rankings.length > 0) {
                    // Importamos Highcharts dinámicamente solo aquí para que no falle el servidor
                    const Highcharts = (await import('highcharts')).default;
                    loadChart(Highcharts);
                }
            }
        } catch (error) {
            console.error("Error de red:", error);
        }
    }

    function loadChart(Highcharts) {
        // Preparamos los datos con colores: Verde si sube o igual (>=0), Rojo si baja (<0)
        const processedData = rankings.map(r => ({
            name: `${r.country} (${r.year})`,
            y: r.score,
            rank: r.rank,
            variation: r.rank_variation_from_two_thousand_eighteen,
            color: r.rank_variation_from_two_thousand_eighteen >= 0 ? '#2ecc71' : '#e74c3c'
        }));

        Highcharts.chart(chartContainer, {
            chart: {
                type: 'column', // COLUMNAS VERTICALES (distinto a bar y line)
                backgroundColor: '#ffffff'
            },
            title: {
                text: '📊 Puntuaciones y Variación de Rankings FIFA'
            },
            xAxis: {
                categories: processedData.map(d => d.name),
                title: { text: 'País y Año' }
            },
            yAxis: {
                title: { text: 'Puntos (Score)' }
            },
            tooltip: {
                useHTML: true,
                pointFormat: `
                    <b>Puntos:</b> {point.y}<br/>
                    <b>Posición:</b> #{point.rank}<br/>
                    <b>Variación:</b> <span style="color:{point.color}"><b>{point.variation}</b></span> posiciones
                `
            },
            plotOptions: {
                column: {
                    dataLabels: {
                        enabled: true,
                        format: '{point.y}'
                    }
                }
            },
            series: [{
                name: 'Puntuación',
                data: processedData,
                showInLegend: false
            }],
            credits: { enabled: false }
        });
    }
</script>

<main>
    <div class="container">
        <h1>Visualización: Rankings Nacionales</h1>
        <p>Las columnas <b>Rojas</b> indican una bajada en el ranking desde 2018.</p>

        <div bind:this={chartContainer} class="chart-box"></div>

        <div style="margin-top: 20px; text-align: center;">
            <a href="/front-mgn" class="btn-back">← Volver al Listado</a>
        </div>
    </div>
</main>

<style>
    .container {
        max-width: 900px;
        margin: 30px auto;
        padding: 20px;
        background: white;
        border-radius: 10px;
        box-shadow: 0 4px 10px rgba(0,0,0,0.1);
        font-family: sans-serif;
    }
    h1 { text-align: center; color: #333; }
    p { text-align: center; color: #666; }
    .chart-box {
        width: 100%;
        height: 500px;
        margin-top: 20px;
    }
    .btn-back {
        display: inline-block;
        padding: 10px 20px;
        background: #34495e;
        color: white;
        text-decoration: none;
        border-radius: 5px;
    }
</style>