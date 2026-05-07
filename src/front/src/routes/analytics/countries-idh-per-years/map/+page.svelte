<!--
	============================================================================
	  Vista de mapa geoespacial: countries-idh-per-years
	----------------------------------------------------------------------------
	  Renderiza un mapa de Leaflet (sobre tiles de OpenStreetMap) con un marcador
	  circular por cada registro de IDH devuelto por la API. Cada marcador
	  muestra un popup con país, año, valor HDI, ranking y cambio.

	  Notas técnicas:
	    - Leaflet sólo se importa cuando estamos en el navegador (no en SSR).
	    - Si la API devuelve vacío, intentamos inicializarla automáticamente
	      llamando a /loadInitialData antes de mostrar un error.
	============================================================================
-->
<script>
	// @ts-nocheck
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import 'leaflet/dist/leaflet.css';

	// Estado reactivo de la vista (Svelte 5 runes).
	let loading = $state(true);          // Indica si el mapa aún se está cargando.
	let errorMessage = $state('');       // Mensaje de error a mostrar al usuario.
	let mapContainer;                    // Referencia al <div> donde se monta Leaflet.

	const API_ENDPOINT = '/api/v2/countries-idh-per-years';

	// Diccionario [clave-normalizada -> [lat, lng]] con las coordenadas de los
	// países soportados por esta visualización. Las claves se almacenan ya
	// normalizadas (sin tildes y en minúsculas) para poder buscar directamente.
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

	/**
	 * Normaliza el nombre de un país para que coincida con las claves del
	 * diccionario `countryCoordinates`: pasa a minúsculas y elimina las
	 * marcas diacríticas (tildes, diéresis, etc.).
	 */
	function normalizeCountryName(name) {
		return String(name ?? '')
			.toLowerCase()
			.normalize('NFD')                  // Separa cada carácter de su acento.
			// Elimina los acentos resultantes (rango Unicode de marcas combinantes).
			.replace(/[\u0300-\u036f]/g, '');
	}

	/**
	 * Recupera los datos de IDH desde el backend.
	 * Si la primera respuesta viene vacía, intenta poblar la BD con los datos
	 * iniciales mediante /loadInitialData y reintenta la consulta una vez más.
	 */
	async function fetchHdiData() {
		const response = await fetch(API_ENDPOINT);
		if (!response.ok) {
			throw new Error('No se pudieron cargar los datos de IDH.');
		}

		let data = await response.json();
		if (Array.isArray(data) && data.length > 0) {
			return data;
		}

		// Caso BD vacía: pedimos la inicialización y volvemos a consultar.
		// El catch silencioso evita romper el flujo si /loadInitialData falla.
		await fetch(`${API_ENDPOINT}/loadInitialData`).catch(() => null);
		const seededResponse = await fetch(API_ENDPOINT);
		if (!seededResponse.ok) {
			throw new Error('No se pudieron cargar los datos tras inicialización.');
		}

		data = await seededResponse.json();
		return Array.isArray(data) ? data : [];
	}

	/**
	 * Construye el HTML del popup que se mostrará al pulsar sobre un marcador.
	 */
	function buildPopup(row) {
		return `
			<strong>${row.country}</strong><br/>
			Año: ${row.year}<br/>
			HDI: ${row.hdi_value}<br/>
			Ranking: ${row.hdi_rank}<br/>
			Cambio: ${row.hdi_change}
		`;
	}

	// Toda la inicialización del mapa ocurre tras el montaje del componente
	// porque Leaflet necesita un contenedor real del DOM y el objeto window.
	onMount(async () => {
		// Guardia anti-SSR: si no hay navegador (build/SSR), no hacemos nada.
		if (!browser) return;

		try {
			// Import dinámico de Leaflet: evita que se incluya en el bundle
			// del servidor y permite usarlo sólo cuando ya estamos en cliente.
			const L = (await import('leaflet')).default;
			const data = await fetchHdiData();

			if (!mapContainer) {
				throw new Error('No se encontró el contenedor del mapa.');
			}

			// Creamos el mapa centrado en una vista global (lat 30, lng 10, zoom 2)
			// y le añadimos la capa de tiles de OpenStreetMap.
			const map = L.map(mapContainer).setView([30, 10], 2);
			L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
				attribution: '&copy; OpenStreetMap contributors'
			}).addTo(map);

			// Recorremos los registros y colocamos un marcador circular por
			// cada país del que tengamos coordenadas conocidas.
			let markersPlaced = 0;
			for (const row of data) {
				const key = normalizeCountryName(row.country);
				const coords = countryCoordinates[key];
				// Si el país no está en el diccionario, simplemente lo omitimos.
				if (!coords) continue;

				const marker = L.circleMarker(coords, {
					radius: 8,
					color: '#b00020',      // Color del borde (rojo oscuro).
					fillColor: '#ff5252',  // Color del relleno (rojo brillante).
					weight: 2,             // Grosor del borde en píxeles.
					fillOpacity: 0.9       // Opacidad del relleno (0-1).
				});
				marker.addTo(map);
				marker.bindPopup(buildPopup(row));
				markersPlaced += 1;
			}

			// Si ningún registro pudo geolocalizarse, avisamos al usuario en
			// lugar de mostrar un mapa vacío sin explicación.
			if (markersPlaced === 0) {
				throw new Error('No se pudieron geolocalizar registros con los países actuales.');
			}
		} catch (error) {
			errorMessage =
				error instanceof Error ? error.message : 'Se produjo un error al construir el mapa.';
		} finally {
			// Pase lo que pase, ocultamos el indicador de carga al terminar.
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
