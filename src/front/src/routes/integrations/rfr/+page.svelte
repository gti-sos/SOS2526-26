<!-- 2 Integraciones de SOS, 2 usos de SOS, 2 usos de API normal -> 0,8 -->

<script>
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { env } from '$env/dynamic/public';

	let loading = $state(true);
	let errorMessage = $state('');
	let chartContainer;
	const REQUEST_TIMEOUT_MS = 15000; // Aumentado un poco para APIs externas
	const API_BASE_URL = (
		(env.PUBLIC_API_URL && env.PUBLIC_API_URL.trim()) ||
		(typeof window !== 'undefined' ? window.location.origin : '')
	).replace(/\/$/, '');

	// --- Funciones de Utilidad (Mantenidas) ---

	function toApiUrl(path) {
		if (/^https?:\/\//.test(path)) return path; // Si es URL completa, no tocar
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
		if (!response.ok) {
			throw new Error(`No se pudo cargar ${endpoint}. Estado: ${response.status}`);
		}
		const payload = await response.json();
		return Array.isArray(payload) ? payload : [];
	}

	// --- NUEVA Función de procesamiento para emparejar por País y Año ---

	function processAndMatchData(squadData, productivityData) {
		// 1. Crear mapas para búsqueda rápida usando clave "pais_año"
		const squadMap = new Map();
		squadData.forEach((item) => {
			if (item.country && item.year && item.total_market_value) {
				const key = `${item.country.trim()}_${item.year}`;
				// Usamos parseFloat por seguridad si viene como string
				squadMap.set(key, parseFloat(item.total_market_value));
			}
		});

		const prodMap = new Map();
		productivityData.forEach((item) => {
			const metricKey = 'productivity_hour'; // <--- REVISAR ESTE NOMBRE

			if (item.country && item.year && item[metricKey]) {
				const key = `${item.country.trim()}_${item.year}`;
				prodMap.set(key, parseFloat(item[metricKey]));
			}
		});

		// 2. Encontrar la intersección de claves (registros que están en AMBOS)
		const commonKeys = [...squadMap.keys()].filter((key) => prodMap.has(key));

		// 3. Ordenar las claves por País (alfabético) y luego Año (numérico)
		commonKeys.sort((a, b) => {
			const [countryA, yearA] = a.split('_');
			const [countryB, yearB] = b.split('_');

			// Comparar país primero
			const countryCmp = countryA.localeCompare(countryB);
			if (countryCmp !== 0) return countryCmp;

			// Si el país es igual, comparar año
			return Number(yearA) - Number(yearB);
		});

		// 4. Preparar los datos finales para Highcharts
		const categories = []; // Etiquetas del eje X (País Año)
		const squadSeriesData = [];
		const prodSeriesData = [];

		commonKeys.forEach((key) => {
			const [country, year] = key.split('_');
			categories.push(`${country} ${year}`);
			squadSeriesData.push(squadMap.get(key));
			prodSeriesData.push(prodMap.get(key));
		});

		return { categories, squadSeriesData, prodSeriesData };
	}

	// --- NUEVA Función para crear gráfica de barras agrupadas ---

	function createBarChart(Highcharts, processedData) {
		if (!chartContainer) return;

		Highcharts.chart(chartContainer, {
			chart: {
				type: 'bar', // Gráfica de barras horizontales
				backgroundColor: 'transparent'
			},
			title: {
				text: 'Comparativa: Valor de Plantilla vs Productividad Laboral',
				align: 'left'
			},
			subtitle: {
				text: 'Datos integrados por País y Año (Registros coincidentes)',
				align: 'left'
			},
			xAxis: {
				categories: processedData.categories, // Ej: ["Argentina 2025", "Argentina 2026", "Brazil 2026"...]
				title: { text: 'País y Año' },
				gridLineWidth: 1
			},
			yAxis: [
				{
					// Eje Y primario para Valor de Plantilla
					title: { text: 'Valor Total Plantilla (M€)' },
					labels: { format: '{value}M' }
				},
				{
					// Eje Y secundario para Productividad (opcional, si las escalas son muy distintas)
					title: { text: 'Productividad (Valor/Hora)' },
					opposite: true // Lo pone a la derecha
				}
			],
			tooltip: {
				shared: true, // Muestra ambos valores al pasar el ratón
				valueDecimals: 2
			},
			plotOptions: {
				bar: {
					dataLabels: { enabled: true },
					groupPadding: 0.1, // Espacio entre grupos de barras
					pointPadding: 0.05 // Espacio entre las barras del mismo grupo
				}
			},
			legend: {
				layout: 'vertical',
				align: 'right',
				verticalAlign: 'top',
				y: 50,
				floating: false,
				borderWidth: 1,
				backgroundColor: '#ffffff',
				shadow: true
			},
			credits: { enabled: false },
			series: [
				{
					name: 'Valor Plantilla (M€)',
					data: processedData.squadSeriesData,
					color: '#434348', // Color oscuro
					yAxis: 0 // Usa el eje izquierdo
				},
				{
					name: 'Productividad Laboral',
					data: processedData.prodSeriesData,
					color: '#7cb5ec', // Color azul claro
					yAxis: 1 // Usa el eje derecho
				}
			]
		});
	}

	// --- Lifecycle: onMount ---

	onMount(async () => {
		if (!browser) return;

		try {
			// Cargar Highcharts dinámicamente
			const { default: Highcharts } = await import('highcharts');

			// CARGA DE DATOS EN PARALELO
			console.log('[analytics] Iniciando carga de datos...');
			const [squadRes, productivityRes] = await Promise.all([
				// API Interna
				loadDataset('/api/v2/fifa-squad-value-per-years'),
				// API Pública Externa
				loadDataset('https://sos2526-19-integracion.onrender.com/api/v1/workers-productivity')
			]);

			console.log('[analytics] Datos recibidos. Plantillas:', squadRes.length, 'Productividad:', productivityRes.length);

			// PROCESAMIENTO Y EMPAREJAMIENTO (Nueva lógica)
			const processedData = processAndMatchData(squadRes, productivityRes);

			console.log('[analytics] Registros emparejados y ordenados:', processedData.categories.length);

			if (processedData.categories.length === 0) {
				throw new Error(
					'No se encontraron registros comunes que coincidan en País y Año entre ambas APIs.'
				);
			}

			// CREACIÓN DE LA GRÁFICA (Nueva función)
			createBarChart(Highcharts, processedData);

		} catch (error) {
			console.error('[analytics] error:', error);
			errorMessage = error instanceof Error ? error.message : 'Error desconocido.';
		} finally {
			loading = false;
		}
	});
</script>

<main class="analytics-container">
	<header>
		<h1>Integración de Valor de Mercado y Productividad</h1>
		<p>Visualización comparativa tipo 'bar' (barras agrupadas horizontales).</p>
		<p>
			Se comparan datos de la API interna de plantillas con la API externa de productividad
			<strong>SOS2526-19</strong>, emparejando por País y Año.
		</p>
	</header>

	{#if loading}
		<div class="loading-status" aria-live="polite">
			<p>Cargando y procesando datos de múltiples APIs...</p>
		</div>
	{:else if errorMessage}
		<div class="error-container" role="alert">
			<p class="error-title">Error al cargar la visualización</p>
			<p>{errorMessage}</p>
		</div>
	{/if}

	<div bind:this={chartContainer} id="chart-container" class="chart" class:hidden={loading || errorMessage}></div>
</main>

<style>
	:global(body) {
		background-color: #f4f7f6;
		margin: 0;
	}

	.analytics-container {
		max-width: 1200px;
		margin: 2rem auto;
		padding: 2rem;
		font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
		background: #fff;
		border-radius: 12px;
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
	}

	header {
		margin-bottom: 2rem;
		border-bottom: 2px solid #eee;
		padding-bottom: 1rem;
	}

	h1 {
		color: #2c3e50;
		margin: 0 0 0.5rem 0;
		font-size: 2rem;
	}

	p {
		color: #606f7b;
		margin: 0.2rem 0;
	}

	strong {
		color: #3490dc;
	}

	.chart {
		width: 100%;
		/* Altura dinámica sugerida según el número de barras, o fija */
		min-height: 600px; 
		margin-top: 1rem;
	}

	.hidden {
		display: none;
	}

	.loading-status, .error-container {
		text-align: center;
		padding: 3rem;
		background: #f8fafc;
		border-radius: 8px;
		border: 1px solid #e3e8ee;
	}

	.error-container {
		border-color: #f5c6cb;
		background-color: #f8d7da;
		color: #721c24;
	}

	.error-title {
		font-weight: bold;
		font-size: 1.2rem;
		margin-bottom: 0.5rem;
	}
</style>