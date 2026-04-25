<script>
	import { onMount } from 'svelte';
	import Highcharts from 'highcharts';

	/** @type {any[]} */
	let stats = [];

	async function loadChart() {
		const res = await fetch('/api/v2/countries-idh-per-years');
		if (res.ok) {
			const data = await res.json();

			// 1. ORDENAMOS los datos de mayor a menor hdi_value
			// Esto hace que el ranking sea visualmente perfecto
			// @ts-ignore
			stats = data.sort((a, b) => parseFloat(b.hdi_value) - parseFloat(a.hdi_value));

			// 2. PREPARAMOS los ejes
			const categories = stats.map((d) => `${d.country} (${d.year})`);
			const values = stats.map((d) => parseFloat(d.hdi_value));
			const minHDI = Math.min(...stats.map((d) => parseFloat(d.hdi_value)));

			Highcharts.chart('container', {
				chart: {
					type: 'bar',
					height: stats.length * 40
				},
				title: {
					text: 'Ranking de Índice de Desarrollo Humano (HDI)'
				},
				xAxis: {
					categories: categories,
					title: { text: 'País (Año)' }
				},
				yAxis: {
					// TRUCO: El eje empieza un poco por debajo del valor más pequeño
					min: minHDI - 0.02,
					title: { text: 'HDI Value (Escala ajustada)' },
					// Añadimos líneas de rejilla más finas para comparar mejor
					tickInterval: 0.01
				},
				plotOptions: {
					bar: {
						dataLabels: {
							enabled: true,
							format: '{y}' // Muestra el valor exacto al final
						},
						colorByPoint: true,
						// Hacemos las barras un poco más gruesas
						pointPadding: 0.1,
						groupPadding: 0
					}
				},
				series: [
					{
						name: 'HDI',
						data: values,
						// Añadimos un efecto de zona para resaltar los mejores
						zones: [
							{
								value: 0.85,
								color: '#ff4d4d' // Rojo para IDH más bajo
							},
							{
								value: 0.92,
								color: '#ffcc00' // Amarillo intermedio
							},
							{
								color: '#2ecc71' // Verde para los top
							}
						]
					}
				]
			});
		}
	}

	onMount(loadChart);
</script>

<main>
	<p class="map-link">
		<a href="/analytics/countries-idh-per-years/map">Ver mapa geoespacial de la API</a>
	</p>
	<div id="container"></div>
</main>

<style>
	#container {
		width: 100%;
		max-width: 900px;
		margin: 0 auto;
	}

	.map-link {
		text-align: center;
		margin: 10px 0 16px;
	}

	.map-link a {
		display: inline-block;
		padding: 10px 14px;
		background: #1e5cb3;
		color: #fff;
		text-decoration: none;
		border-radius: 6px;
		font-weight: 600;
	}
</style>
