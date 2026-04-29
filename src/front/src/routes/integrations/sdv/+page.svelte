<script>
	// @ts-nocheck
	import { onMount } from 'svelte';

	let chartContainer;

	async function loadSpaceIntegration() {
		try {
			const resIDH = await fetch('/api/v2/countries-idh-per-years');
			const myData = await resIDH.json();
			const resSpace = await fetch(
				'https://space-launches-8cix.onrender.com/api/v2/space-launches'
			);
			const peerData = await resSpace.json();

			const integrationData = [];
			myData.forEach((myEntry) => {
				const matches = peerData.filter((p) => parseInt(p.year) === parseInt(myEntry.year));
				if (matches.length > 0) {
					integrationData.push({
						label: `${myEntry.country} (${myEntry.year})`,
						idh: myEntry.hdi_value,
						launches: matches.length
					});
				}
			});

			integrationData.sort((a, b) => {
				const yearA = parseInt(a.label.match(/\d+/));
				const yearB = parseInt(b.label.match(/\d+/));
				return yearA - yearB;
			});

			const categories = integrationData.map((d) => d.label);
			const idhSeries = integrationData.map((d) => d.idh);
			const launchesSeries = integrationData.map((d) => d.launches);

			const options = {
				series: [
					{ name: 'Valor IDH', data: idhSeries },
					{ name: 'Total Lanzamientos en ese año', data: launchesSeries }
				],
				chart: { height: 500, type: 'bar', toolbar: { show: true } },
				colors: ['#00E396', '#FEB019'],
				plotOptions: { bar: { columnWidth: '60%' } },
				xaxis: { categories: categories, labels: { rotate: -45 } },
				yaxis: [
					{ title: { text: 'IDH' }, min: 0, max: 1 },
					{ opposite: true, title: { text: 'Nº Lanzamientos Globales' }, forceNiceScale: true }
				]
			};

			if (chartContainer) {
				chartContainer.innerHTML = '';
				const chart = new ApexCharts(chartContainer, options);
				chart.render();
			}
		} catch (error) {
			console.error('Error en Space Integration:', error);
		}
	}

	async function loadSpiceIntegration() {
		try {
			const resIDH = await fetch('/api/v2/countries-idh-per-years');
			const myData = await resIDH.json();
			const resSpice = await fetch('https://sos2526-20.onrender.com/api/v2/spice-stats');
			const peerResponse = await resSpice.json();
			const peerData = peerResponse.data || [];

			const idhByYear = myData.reduce((acc, curr) => {
				const y = parseInt(curr.year);
				if (!acc[y]) acc[y] = { sum: 0, count: 0 };
				acc[y].sum += parseFloat(curr.hdi_value) || 0;
				acc[y].count += 1;
				return acc;
			}, {});

			const spiceByYear = peerData.reduce((acc, curr) => {
				const y = parseInt(curr.year);
				if (!acc[y]) acc[y] = { prod: 0, cons: 0, imp: 0, exp: 0 };
				acc[y].prod += parseFloat(curr.production) || 0;
				acc[y].cons += parseFloat(curr.consumption) || 0;
				acc[y].imp += parseFloat(curr.import) || 0;
				acc[y].exp += parseFloat(curr.export) || 0;
				return acc;
			}, {});

			const commonYears = Object.keys(idhByYear).filter((y) => spiceByYear[y]);

			let maxValues = { idh: 0, prod: 0, cons: 0, imp: 0, exp: 0 };
			commonYears.forEach((y) => {
				const idh = (idhByYear[y].sum / idhByYear[y].count) * 1000;
				if (idh > maxValues.idh) maxValues.idh = idh;
				if (spiceByYear[y].prod > maxValues.prod) maxValues.prod = spiceByYear[y].prod;
				if (spiceByYear[y].cons > maxValues.cons) maxValues.cons = spiceByYear[y].cons;
				if (spiceByYear[y].imp > maxValues.imp) maxValues.imp = spiceByYear[y].imp;
				if (spiceByYear[y].exp > maxValues.exp) maxValues.exp = spiceByYear[y].exp;
			});

			const columns = [['x', 'IDH', 'Producción', 'Consumo', 'Importación', 'Exportación']];

			commonYears
				.sort((a, b) => a - b)
				.forEach((year) => {
					const s = spiceByYear[year];
					const avgIDH = (idhByYear[year].sum / idhByYear[year].count) * 1000;
					columns.push([
						`Año ${year}`,
						(avgIDH / maxValues.idh) * 100,
						(s.prod / maxValues.prod) * 100,
						(s.cons / maxValues.cons) * 100,
						(s.imp / maxValues.imp) * 100,
						(s.exp / maxValues.exp) * 100
					]);
				});

			if (columns.length > 1) {
				bb.generate({
					data: { x: 'x', columns: columns, type: 'radar' },
					radar: {
						axis: { max: 115 }, // Un poco de margen para que el texto no se pise
						level: { depth: 4 },
						direction: { clockwise: true }
					},
					color: { pattern: ['#1f77b4', '#ff7f0e', '#2ca02c'] },
					tooltip: {
						format: { value: (v) => v.toFixed(1) + '% del máximo' }
					},
					bindto: '#chart-radar-spice'
				});
			}
		} catch (error) {
			console.error('Error en Spice Integration:', error);
		}
	}
	async function loadWaterIntegration() {
		try {
			// 1. PETICIONES
			const resIDH = await fetch('/api/v2/countries-idh-per-years');
			const myData = await resIDH.json();

			const resWater = await fetch(
				'https://sos2526-27.onrender.com/api/v1/drinking-water-services'
			);
			const peerData = await resWater.json();

			// 2. PROCESAMIENTO
			const scatterX = ['IDH'];
			const scatterY = ['Población Agua Urbana'];

			myData.forEach((myEntry) => {
				// Buscamos coincidencia por AÑO y PAÍS (entity)
				const matches = peerData.filter(
					(p) =>
						parseInt(p.year) === parseInt(myEntry.year) &&
						p.entity.toLowerCase().trim() === myEntry.country.toLowerCase().trim()
				);

				matches.forEach((match) => {
					scatterX.push(parseFloat(myEntry.hdi_value) || 0);
					scatterY.push(parseFloat(match.wat_bas_pop_residence_urban) || 0);
				});
			});

			// 3. RENDERIZADO CON BILLBOARD.JS
			if (scatterX.length > 1) {
				// @ts-ignore
				bb.generate({
					data: {
						xs: {
							'Población Agua Urbana': 'IDH'
						},
						columns: [scatterX, scatterY],
						type: 'scatter'
					},
					axis: {
						x: {
							label: 'Índice de Desarrollo Humano (IDH)',
							tick: { fit: false, format: (v) => v.toFixed(2) }
						},
						y: {
							label: 'Pob. Acceso Agua Urbana'
						}
					},
					point: {
						r: 6 // Puntos ligeramente más grandes para que destaquen
					},
					color: {
						pattern: ['#af4bce'] // Un color púrpura para diferenciarlo de los otros gráficos
					},
					bindto: '#chart-water-integration'
				});
			} else {
				console.warn('No se encontraron coincidencias para la gráfica de dispersión.');
			}
		} catch (error) {
			console.error('Error en la integración de Agua:', error);
		}
	}

	
	onMount(() => {
		loadSpaceIntegration();
		loadSpiceIntegration();
		loadWaterIntegration();
	});

	onMount(() => {
		loadSpaceIntegration();
		loadSpiceIntegration();
	});
</script>

<svelte:head>
	<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/billboard.js/dist/billboard.min.css" />
	<script src="https://cdn.jsdelivr.net/npm/d3/dist/d3.min.js"></script>
	<script src="https://cdn.jsdelivr.net/npm/billboard.js/dist/billboard.min.js"></script>
	<script src="https://cdn.jsdelivr.net/npm/apexcharts"></script>
</svelte:head>

<main>
	<h2 class="chart-main-title">Visualización de Datos</h2>

	<section class="chart-section">
		<h3 class="chart-subtitle">
			Integración: IDH vs Lanzamientos Globales por Año (Highchart + bar)
		</h3>
		<div id="chart-integration-space" bind:this={chartContainer}></div>
	</section>

	<section class="chart-section">
		<h3 class="chart-subtitle">Integración: IDH vs Especias (Billboard + radar)</h3>
		<div id="chart-radar-spice"></div>
	</section>

	<section class="chart-section">
    <h3 class="chart-subtitle">Integración: IDH vs Acceso a Agua Urbana (Billboard + scatter)</h3>
    <div id="chart-water-integration"></div>
</section>
</main>

<style>
	main {
		padding: 40px;
		background-color: #f4f7f6;
		min-height: 100vh;
		font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
	}

	.chart-main-title {
		text-align: center;
		font-size: 2.2rem;
		color: #2c3e50;
		margin-bottom: 40px;
		text-transform: uppercase;
		letter-spacing: 2px;
		font-weight: 700;
	}

	.chart-subtitle {
		text-align: center;
		font-size: 1.5rem;
		color: #34495e;
		margin-bottom: 25px;
		font-weight: 600;
		border-bottom: 2px solid #ecf0f1;
		padding-bottom: 10px;
	}

	.chart-section {
		background: white;
		padding: 30px;
		border-radius: 15px;
		box-shadow: 0 8px 20px rgba(0, 0, 0, 0.08);
		margin-bottom: 50px;
		max-width: 1100px;
		margin-left: auto;
		margin-right: auto;
	}

	#chart-integration-space,
	#chart-radar-spice {
		width: 100%;
		min-height: 500px;
	}
</style>
