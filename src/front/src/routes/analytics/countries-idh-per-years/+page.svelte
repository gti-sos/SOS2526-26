<!--
	============================================================================
	  Vista de analytics: Ranking de IDH (Índice de Desarrollo Humano)
	----------------------------------------------------------------------------
	  Esta página consume el recurso /api/v2/countries-idh-per-years y muestra
	  un gráfico de barras horizontales (Highcharts) con el ranking de los
	  países según su HDI. También enlaza a la vista de mapa geoespacial.
	============================================================================
-->
<script>
	import { onMount } from 'svelte';
	import Highcharts from 'highcharts';

	// Array reactivo donde guardamos los registros recibidos de la API.
	/** @type {any[]} */
	let stats = [];

	/**
	 * Descarga los datos de IDH desde la API del backend y construye con ellos
	 * un gráfico de barras de Highcharts dentro del <div id="container">.
	 */
	async function loadChart() {
		const res = await fetch('/api/v2/countries-idh-per-years');
		if (res.ok) {
			const data = await res.json();

			// 1. Ordenamos los registros de MAYOR a MENOR según hdi_value para
			//    que el ranking se vea visualmente correcto (los mejores arriba).
			// @ts-ignore
			stats = data.sort((a, b) => parseFloat(b.hdi_value) - parseFloat(a.hdi_value));

			// 2. Preparamos los ejes a partir de los datos ya ordenados:
			//    - categories: etiqueta legible "País (Año)" para el eje X.
			//    - values:     valores numéricos del HDI para el eje Y.
			//    - minHDI:     valor mínimo, usado para ajustar la escala.
			const categories = stats.map((d) => `${d.country} (${d.year})`);
			const values = stats.map((d) => parseFloat(d.hdi_value));
			const minHDI = Math.min(...stats.map((d) => parseFloat(d.hdi_value)));

			// 3. Renderizamos el gráfico con Highcharts.
			Highcharts.chart('container', {
				chart: {
					type: 'bar',
					// Altura dinámica: 40px por barra para que no se solapen
					// aunque haya muchos registros.
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
					// El eje arranca ligeramente por debajo del mínimo para
					// que las diferencias entre valores cercanos se aprecien.
					min: minHDI - 0.02,
					title: { text: 'HDI Value (Escala ajustada)' },
					// Líneas de rejilla finas (cada 0.01) para facilitar la
					// comparación visual entre barras de valor similar.
					tickInterval: 0.01
				},
				plotOptions: {
					bar: {
						dataLabels: {
							enabled: true,
							format: '{y}' // Muestra el valor exacto al final de cada barra.
						},
						// Cada barra tiene un color distinto para distinguirlas mejor.
						colorByPoint: true,
						// Ajustes de espaciado para que las barras sean más gruesas.
						pointPadding: 0.1,
						groupPadding: 0
					}
				},
				series: [
					{
						name: 'HDI',
						data: values,
						// Zonas de color por umbrales de HDI: ofrecen una lectura
						// rápida del nivel de desarrollo (rojo = bajo, verde = alto).
						zones: [
							{
								value: 0.85,
								color: '#ff4d4d' // IDH bajo.
							},
							{
								value: 0.92,
								color: '#ffcc00' // IDH intermedio.
							},
							{
								color: '#2ecc71' // IDH alto (top del ranking).
							}
						]
					}
				]
			});
		}
	}

	// Cargamos el gráfico una vez que el componente se monta en el DOM.
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
