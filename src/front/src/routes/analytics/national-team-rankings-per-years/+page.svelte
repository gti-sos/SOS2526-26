<script>
    import { onMount } from 'svelte';
    import Highcharts from 'highcharts';

    let rankings = [];
    let chartContainer;

    onMount(async () => {
        try {
            const res = await fetch("http://localhost:3000/api/v2/national-team-rankings-per-years");
            if (res.ok) {
                rankings = await res.json();
                if (rankings.length > 0) {
                    loadChart();
                } else {
                    console.error("La API devolvió un array vacío.");
                }
            } else {
                console.error("Error al conectar con la API:", res.status);
            }
        } catch (error) {
            console.error("Error de red:", error);
        }
    });

    function loadChart() {
        // Formateamos los datos para que Highcharts los entienda perfectamente
        const processedData = rankings.map(r => ({
            name: `${r.country} (${r.year})`,
            y: r.score,
            rank: r.rank,
            variation: r.rank_variation_from_two_thousand_eighteen,
            // Color dinámico: verde si la variación es >= 0, rojo si es negativa
            color: r.rank_variation_from_two_thousand_eighteen >= 0 ? '#2ecc71' : '#e74c3c'
        }));

        Highcharts.chart(chartContainer, {
            chart: {
                type: 'bar', // Tipo barra (horizontal), distinto a "line" y muy claro para rankings
                backgroundColor: '#f8f9fa',
                borderRadius: 10
            },
            title: {
                text: '📊 Análisis Detallado de Rankings FIFA',
                style: { fontWeight: 'bold', color: '#2c3e50' }
            },
            subtitle: {
                text: 'Visualización individual: Puntos, Posición y Variación desde 2018'
            },
            xAxis: {
                categories: processedData.map(d => d.name),
                title: { text: null },
                labels: { style: { fontSize: '12px' } }
            },
            yAxis: {
                min: 0,
                title: {
                    text: 'Puntuación Total (Score)',
                    align: 'high'
                },
                labels: { overflow: 'justify' }
            },
            tooltip: {
                useHTML: true,
                headerFormat: '<span style="font-size: 12px"><b>{point.key}</b></span><br/>',
                pointFormat: `
                    <div style="margin-top: 5px;">
                        <span style="color:{point.color}">●</span> <b>Puntos:</b> {point.y}<br/>
                        <b>Posición Mundial:</b> #{point.rank}<br/>
                        <b>Var. desde 2018:</b> {point.variation} posiciones
                    </div>
                `
            },
            plotOptions: {
                bar: {
                    dataLabels: {
                        enabled: true,
                        format: 'Posición: #{point.rank}', // Mostramos el Rank directamente en la gráfica
                        style: { fontWeight: 'bold', color: '#333' }
                    },
                    borderWidth: 0,
                    borderRadius: 5
                }
            },
            series: [{
                name: 'Puntos FIFA',
                data: processedData,
                showInLegend: false
            }],
            credits: { enabled: false }
        });
    }
</script>

<main>
    <div class="container">
        <header>
            <h1>Analytics: National Team Rankings</h1>
            <p>Visualización de datos integrada mediante Highcharts</p>
        </header>

        <div bind:this={chartContainer} class="chart-box"></div>

        <footer style="margin-top: 30px; text-align: center;">
            <a href="/front-mgn" class="btn-back">← Volver a la gestión de datos</a>
        </footer>
    </div>
</main>

<style>
    :global(body) {
        background-color: #f0f2f5;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    }

    .container {
        max-width: 1000px;
        margin: 40px auto;
        padding: 20px;
        background: white;
        border-radius: 15px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.08);
    }

    header {
        text-align: center;
        margin-bottom: 30px;
    }

    h1 {
        color: #2c3e50;
        margin-bottom: 5px;
    }

    .chart-box {
        width: 100%;
        height: 600px; /* Un poco más alto para que quepan todos los países */
        border: 1px solid #eee;
        border-radius: 8px;
    }

    .btn-back {
        display: inline-block;
        padding: 10px 20px;
        background-color: #3498db;
        color: white;
        text-decoration: none;
        border-radius: 5px;
        transition: background 0.3s;
    }

    .btn-back:hover {
        background-color: #2980b9;
    }
</style>