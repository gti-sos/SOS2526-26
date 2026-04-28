<script>
	// @ts-nocheck
	import { onMount } from 'svelte';

	let chartContainer;

	async function loadSpaceIntegration() {
		try {
			// 1. PETICIONES
			const resIDH = await fetch('/api/v2/countries-idh-per-years');
			const myData = await resIDH.json();

			const resSpace = await fetch(
				'https://space-launches-8cix.onrender.com/api/v2/space-launches'
			);
			const peerData = await resSpace.json();

			// 2. PROCESAMIENTO
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

			// 3. RENDERIZADO
			const options = {
				series: [
					{ name: 'Valor IDH', data: idhSeries },
					{ name: 'Total Lanzamientos en ese año', data: launchesSeries }
				],
				chart: {
					height: 500,
					type: 'bar',
					toolbar: { show: true }
				},
				colors: ['#00E396', '#FEB019'],
				plotOptions: {
					bar: { columnWidth: '60%' }
				},
				xaxis: {
					categories: categories,
					labels: { rotate: -45 }
				},
				yaxis: [
					{
						title: { text: 'IDH' },
						min: 0,
						max: 1
					},
					{
						opposite: true,
						title: { text: 'Nº Lanzamientos Globales' },
						forceNiceScale: true
					}
				],
				title: {
					text: 'Integración: IDH vs Lanzamientos Globales por Año',
					align: 'center'
				}
			};

			if (chartContainer) {
				chartContainer.innerHTML = '';
				// @ts-ignore
				const chart = new ApexCharts(chartContainer, options);
				chart.render();
			}
		} catch (error) {
			console.error('Error en la integración:', error);
		}
	}

	onMount(() => {
		loadSpaceIntegration();
	});
</script>

<svelte:head>
	<script src="https://cdn.jsdelivr.net/npm/apexcharts"></script>
</svelte:head>

<main>
	<h2>Visualización de Datos</h2>
	<div id="chart-integration-space" bind:this={chartContainer}></div>
</main>

<style>
	main {
		padding: 20px;
	}
	#chart-integration-space {
		background: white;
		padding: 15px;
		border-radius: 8px;
		min-height: 500px;
	}
</style>
