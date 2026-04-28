<script>
	// @ts-nocheck
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import 'leaflet/dist/leaflet.css';

	let loading = $state(true);
	let errorMessage = $state('');
	let mapContainer;

	const API_ENDPOINT = '/api/v2/countries-idh-per-years';

	const countryCoordinates = {
		espana: [40.4168, -3.7038],
		alemania: [52.52, 13.405],
		'reino-unido': [51.5074, -0.1278],
		francia: [48.8566, 2.3522],
		italia: [41.9028, 12.4964],
		portugal: [38.7223, -9.1393],
		'estados-unidos': [38.9072, -77.0369],
		japon: [35.6762, 139.6503],
		china: [39.9042, 116.4074]
	};

	function normalizeCountryName(name) {
		return String(name ?? '')
			.toLowerCase()
			.normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '');
	}

	async function fetchHdiData() {
		const response = await fetch(API_ENDPOINT);
		if (!response.ok) {
			throw new Error('No se pudieron cargar los datos de IDH.');
		}

		let data = await response.json();
		if (Array.isArray(data) && data.length > 0) {
			return data;
		}

		await fetch(`${API_ENDPOINT}/loadInitialData`).catch(() => null);
		const seededResponse = await fetch(API_ENDPOINT);
		if (!seededResponse.ok) {
			throw new Error('No se pudieron cargar los datos tras inicialización.');
		}

		data = await seededResponse.json();
		return Array.isArray(data) ? data : [];
	}

	function buildPopup(row) {
		return `
			<strong>${row.country}</strong><br/>
			Año: ${row.year}<br/>
			HDI: ${row.hdi_value}<br/>
			Ranking: ${row.hdi_rank}<br/>
			Cambio: ${row.hdi_change}
		`;
	}

	onMount(async () => {
		if (!browser) return;

		try {
			const L = (await import('leaflet')).default;
			const data = await fetchHdiData();

			if (!mapContainer) {
				throw new Error('No se encontró el contenedor del mapa.');
			}

			const map = L.map(mapContainer).setView([30, 10], 2);
			L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
				attribution: '&copy; OpenStreetMap contributors'
			}).addTo(map);

			let markersPlaced = 0;
			for (const row of data) {
				const key = normalizeCountryName(row.country);
				const coords = countryCoordinates[key];
				if (!coords) continue;

				const marker = L.circleMarker(coords, { 
					radius: 8, 
					color: '#b00020',      // Color del borde (Rojo oscuro)
					fillColor: '#ff5252',  // Color del relleno (Rojo brillante)
					weight: 2,             // Grosor del borde
					fillOpacity: 0.9       // Opacidad del relleno
				});
				marker.addTo(map);
				marker.bindPopup(buildPopup(row));
				markersPlaced += 1;
			}

			if (markersPlaced === 0) {
				throw new Error('No se pudieron geolocalizar registros con los países actuales.');
			}
		} catch (error) {
			errorMessage =
				error instanceof Error ? error.message : 'Se produjo un error al construir el mapa.';
		} finally {
			loading = false;
		}
	});
</script>

<main class="container">
	<h1>Mapa geoespacial de countries-idh-per-years</h1>
	<p>Visualización geolocalizada de algunos registros de la API (país, año y métricas de IDH).</p>

	<div bind:this={mapContainer} class="map" aria-label="Mapa de datos geolocalizados"></div>

	{#if loading}
		<p aria-live="polite">Cargando mapa...</p>
	{:else if errorMessage}
		<p class="error" role="alert">{errorMessage}</p>
	{/if}

	<p class="back-link">
		<a href="/analytics/countries-idh-per-years">Volver a analytics de countries-idh-per-years</a>
	</p>
</main>

<style>
	.container {
		max-width: 1100px;
		margin: 0 auto;
		padding: 20px;
		font-family: sans-serif;
	}

	.map {
		width: 100%;
		height: 560px;
		margin: 20px 0;
		border-radius: 8px;
		overflow: hidden;
	}

	.error {
		color: #b00020;
		font-weight: 600;
	}

	.back-link a {
		color: #1e5cb3;
		text-decoration: none;
		font-weight: 600;
	}
</style>
