<script>
    import { onMount } from 'svelte';
    import Highcharts from 'highcharts';

    onMount(async () => {
        const res = await fetch("/api/v2/fifa-squad-value-per-years");
        if (res.ok) {
            const data = await res.json();
            

            const chartData = data.map(item => {
        return {
            name: item.country, // Convertimos 'country' en 'name'
            y: parseFloat(item.total_market_value) // Convertimos el valor en el eje 'y'
        };
    });

Highcharts.chart('container', {
    chart: {
        type: 'pie',
        zooming: {
            type: 'xy'
        },
        panning: {
            enabled: true,
            type: 'xy'
        },
        panKey: 'shift'
    },
    title: {
        text: 'Valor de las selecciones nacionales'
    },
    tooltip: {
        valueSuffix: '%'
    },
    plotOptions: {
        pie: {
            allowPointSelect: true,
            cursor: 'pointer',
            dataLabels: [{
                enabled: true,
                distance: 20
            }, {
                enabled: true,
                distance: -40,
                format: '{point.percentage:.1f}%',
                style: {
                    fontSize: '1.2em',
                    textOutline: 'none',
                    opacity: 0.7
                },
                filter: {
                    operator: '>',
                    property: 'percentage',
                    value: 10
                }
            }]
        }
    },
                series: [{
                    name: 'Porcentaje sobre el valor total',
                    colorByPoint: true,
                    data: chartData,
                }]
            });
        }
    });
</script>

<div id="container"></div>

<style>
    #container {
        width: 100%;
        height: 400px; /* Importante: define una altura */
        background-color: #f4f4f4; /* Solo para verificar que el div existe */
    }
</style>