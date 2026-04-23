<script>
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { env } from '$env/dynamic/public';

	let loading = $state(true);
	let errorMessage = $state('');
	let chartContainer;
	const REQUEST_TIMEOUT_MS = 12000;
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

	function averageByYear(data, yearKey, valueKey) {
		/** @type {Record<string, { total: number; count: number }>} */
		const grouped = {};

		for (const row of data) {
			const year = String(row?.[yearKey] ?? '');
			const value = Number(row?.[valueKey]);
			if (!year || Number.isNaN(value)) continue;

			if (!grouped[year]) grouped[year] = { total: 0, count: 0 };
			grouped[year].total += value;
			grouped[year].count += 1;
		}

		/** @type {Record<string, number>} */
		const result = {};
		for (const year of Object.keys(grouped)) {
			const item = grouped[year];
			result[year] = item.total / item.count;
		}

		return result;
	}

	function intersectionYears(...maps) {
		if (maps.length === 0) return [];

		let years = new Set(Object.keys(maps[0]));
		for (let i = 1; i < maps.length; i += 1) {
			const nextYears = new Set(Object.keys(maps[i]));
			years = new Set([...years].filter((year) => nextYears.has(year)));
		}

		return [...years].sort((a, b) => Number(a) - Number(b));
	}

	function pointsFromYears(years, source) {
		return years.map((year) => [Number(year), Number(source[year])]);
	}

	async function loadDataset(apiBasePath) {
		const endpoint = toApiUrl(apiBasePath);
		const response = await fetchWithTimeout(endpoint);
		if (!response.ok) {
			throw new Error(`No se pudo cargar ${endpoint}.`);
		}

		const payload = await response.json();
		const collection = Array.isArray(payload) ? payload : [];
		console.log(`[analytics] ${endpoint} -> registros iniciales:`, collection.length);
		console.log(`[analytics] ${endpoint} muestra inicial:`, collection.slice(0, 5));
		if (collection.length > 0) return collection;

		// Solo se intenta cargar semilla si la colección está vacía.
		await fetchWithTimeout(`${endpoint}/loadInitialData`).catch(() => null);

		const seededResponse = await fetchWithTimeout(endpoint);
		if (!seededResponse.ok) {
			throw new Error(`No se pudo cargar ${endpoint} después de inicializar datos.`);
		}

		const seededPayload = await seededResponse.json();
		const seededCollection = Array.isArray(seededPayload) ? seededPayload : [];
		console.log(`[analytics] ${endpoint} -> registros tras loadInitialData:`, seededCollection.length);
		console.log(`[analytics] ${endpoint} muestra tras loadInitialData:`, seededCollection.slice(0, 5));
		return seededCollection;
	}

	function createChart(Highcharts, years, rankingsByYear, squadByYear, hdiByYear) {
		if (!chartContainer) {
			throw new Error('No se pudo inicializar el contenedor de la gráfica.');
		}

		Highcharts.chart(chartContainer, {
			chart: {
				type: 'scatter',
				zooming: { type: 'xy' }
			},
			title: {
				text: 'Comparativa integrada de APIs del grupo por año'
			},
			subtitle: {
				text: 'Gráfica simplificada con 3 series y eje Y único'
			},
			xAxis: {
				title: { text: 'Año' },
				allowDecimals: false,
				tickPositions: years.map((year) => Number(year))
			},
			yAxis: {
				title: { text: 'Valor promedio (escala original de cada API)' }
			},
			legend: {
				align: 'center',
				verticalAlign: 'bottom'
			},
			tooltip: {
				headerFormat: '<b>Año: {point.x}</b><br/>',
				pointFormat: '{series.name}: {point.y:.4f}'
			},
			series: [
				{
					name: 'Moises - Ranking FIFA',
					type: 'scatter',
					data: pointsFromYears(years, rankingsByYear)
				},
				{
					name: 'Ricardo - Valor plantilla',
					type: 'scatter',
					data: pointsFromYears(years, squadByYear)
				},
				{
					name: 'Sergio - IDH',
					type: 'scatter',
					data: pointsFromYears(years, hdiByYear)
				}
			],
			credits: { enabled: false }
		});
	}

	onMount(async () => {
		if (!browser) return;

		try {
			const { default: Highcharts } = await import('highcharts');

			const [rankingsRes, squadRes, hdiRes] = await Promise.all([
				loadDataset('/api/v2/national-team-rankings-per-years'),
				loadDataset('/api/v2/fifa-squad-value-per-years'),
				loadDataset('/api/v2/countries-idh-per-years')
			]);
			const rankingsData = rankingsRes;
			const squadData = squadRes;
			const hdiData = hdiRes;

			const rankingsByYear = averageByYear(rankingsData, 'year', 'score');
			const squadByYear = averageByYear(squadData, 'year', 'total_market_value');
			const hdiByYear = averageByYear(hdiData, 'year', 'hdi_value');
			const commonYears = intersectionYears(rankingsByYear, squadByYear, hdiByYear);
			console.log('[analytics] years en rankings:', Object.keys(rankingsByYear));
			console.log('[analytics] years en squad:', Object.keys(squadByYear));
			console.log('[analytics] years en hdi:', Object.keys(hdiByYear));
			console.log('[analytics] years comunes:', commonYears);

			if (commonYears.length === 0) {
				throw new Error('No hay años en común entre los tres conjuntos de datos.');
			}

			createChart(Highcharts, commonYears, rankingsByYear, squadByYear, hdiByYear);
		} catch (error) {
			console.error('[analytics] error al construir gráfica:', error);
			errorMessage = error instanceof Error ? error.message : 'Error desconocido al cargar la gráfica.';
		} finally {
			loading = false;
		}
	});
</script>

<main class="analytics-container">
	<h1>Visualización combinada de APIs del grupo</h1>
	<p>Widget de Highcharts tipo scatter con datos de los tres miembros para años en común.</p>
	<p>Dato común usado para integrar series: <b>year</b> (año).</p>

	<div bind:this={chartContainer} class="chart" aria-label="Gráfica integrada de APIs"></div>

	{#if loading}
		<p aria-live="polite">Cargando visualización...</p>
	{:else if errorMessage}
		<p class="error" role="alert">{errorMessage}</p>
	{/if}
</main>

<style>
	.analytics-container {
		max-width: 1100px;
		margin: 0 auto;
		padding: 20px;
		font-family: sans-serif;
	}

	h1 {
		color: #2c3e50;
		margin-bottom: 10px;
	}

	p {
		color: #4a5568;
	}

	.chart {
		width: 100%;
		min-height: 520px;
		margin-top: 20px;
		background: #fff;
		border-radius: 8px;
	}

	.error {
		color: #b00020;
		font-weight: 600;
	}
</style>
