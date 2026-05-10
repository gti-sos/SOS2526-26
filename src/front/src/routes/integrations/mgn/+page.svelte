<script>
	// @ts-nocheck
	/*
	 * Página de integraciones MGN.
	 *
	 * Esta ruta cruza el recurso propio de rankings FIFA por país+año con
	 * varias APIs externas y genera visualizaciones de integración y análisis.
	 *
	 * Visualizaciones principales:
	 *   1) Densidad de población vs Score FIFA (Highcharts heatmap)
	 *   2) Evolución anual: Ranking FIFA de España vs precio medio de vino (ApexCharts treemap)
	 *   3) Meteoritos por País (Google Charts bar chart)
	 *   4) Evolución anual de pandemias (ECharts theme river)
	 *   5) Cantidad de importación por item alimenticio (Chart.js bar chart)
	 *
	 * El cruce de datos se apoya en normalización de nombres de país,
	 * alias manuales, ISO2/ISO3 y búsqueda de año más cercano cuando no hay
	 * coincidencia exacta.
	 */
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { env } from '$env/dynamic/public';
	import Highcharts from 'highcharts';
	import countries from 'i18n-iso-countries';
	import enLocale from 'i18n-iso-countries/langs/en.json';
	import esLocale from 'i18n-iso-countries/langs/es.json';

	countries.registerLocale(enLocale);
	countries.registerLocale(esLocale);

	/*
	 * APIs y constantes externas.
	 *
	 * MY_API_URL: API propia con rankings FIFA por país y año.
	 * POP_DENSITIES_API: API externa de densidades de población.
	 * WINE_API: API externa de estadísticas de vino.
	 * METEORITES_API: API externa de meteoritos.
	 * PANDEMICS_API: API externa de datos epidemiológicos.
	 */
	const MY_API_URL =
		'https://sos2526-26.onrender.com/api/v2/national-team-rankings-per-years/';

	const POP_DENSITIES_API = 'https://sos2526-15-1.onrender.com/api/v1/population-densities';
	const WINE_API = 'https://sos2526-29.onrender.com/api/v1/wine-stats';
	const METEORITES_API = 'https://meteorite-landings-tvcf.onrender.com/api/v2/meteorite-landings';
	const PANDEMICS_API = 'https://sos2526-10.onrender.com/api/v2/pandemics';

	const FOOD_API = 'https://sos2526-18.onrender.com/api/v2/food-supply-utilization-accounts';
	const REST_COUNTRIES_API = 'https://restcountries.com/v3.1/name';
	const OPEN_METEO_API = 'https://api.open-meteo.com/v1/forecast';
	// Llamamos a nuestro propio backend, que hará de intermediario
    const CRYPTO_API = '/api/v1/proxy/crypto';
    const MAX_CRYPTO_ITEMS = 7;
	const DISEASE_KEYS = [
		'yaws',
		'polio',
		'guinea_worm',
		'rabies',
		'malaria',
		'hiv_aids',
		'tuberculosis',
		'smallpox',
		'cholera'
	];
	const DISEASE_LABELS = {
		yaws: 'Yaws',
		polio: 'Polio',
		guinea_worm: 'Guinea Worm',
		rabies: 'Rabies',
		malaria: 'Malaria',
		hiv_aids: 'HIV/AIDS',
		tuberculosis: 'Tuberculosis',
		smallpox: 'Smallpox',
		cholera: 'Cholera'
	};
	

	/** -----------------------------
	 *  UI state
	 *  ----------------------------- */
	let loading = $state(true);
	let summaryTitle = $state('');
	let summaryText = $state('');
	let topDiseases = $state([]);
	let countriesDataTable = $state([]);
	let stats = $state({
		pop: { commonPairs: 0, yearRange: '' },
		wine: { commonPairs: 0, yearUsed: '' },
	});

	/*
	 * Índices internos para cruzar paises del dataset externo con los datos
	 * propios de rankings FIFA.
	 *
	 * myRowsByCountryNorm: filas propio indexadas por país normalizado.
	 * myNormList / myNormSet: lista y conjunto de nombres normalizados.
	 * enNormToMyNorm: puente de nombres EN normalizados a nombres propios.
	 * iso3ToMyNorm / iso2ToMyNorm: puente de códigos ISO a nombres propios.
	 */
	let myRowsByCountryNorm = new Map();
	let myNormList = [];
	let myNormSet = new Set();
	let enNormToMyNorm = new Map();
	let iso3ToMyNorm = new Map();
	let iso2ToMyNorm = new Map();

	const YEAR_MATCH_STEPS = [0, 1, 2, 3, 5, 8, 12, 20, 30];

	/*
	 * Funciones auxiliares generales.
	 *
	 * Normalización, carga con timeout y generación de estructuras de datos.
	 */
	const REQUEST_TIMEOUT_MS = 35000;
	const API_BASE_URL = (
		(env.PUBLIC_API_URL && env.PUBLIC_API_URL.trim()) ||
		(typeof window !== 'undefined' ? window.location.origin : '')
	).replace(/\/$/, '');

	function toApiUrl(path) {
		if (/^https?:\/\//.test(path)) return path;
		return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
	}

	/* Normaliza nombres de pais convertidos a minúsculas, sin acentos ni
	 * caracteres especiales, y reemplaza secuencias no alfanuméricas por espacios.
	 */
	function normalizeCountry(value = '') {
		return value
			.toString()
			.toLowerCase()
			.normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '')
			.replace(/[^a-z0-9]+/g, ' ')
			.trim();
	}

	/* Fetch simple con timeout para evitar que una API externa quede colgando
	 * indefinidamente y bloquee el resto de la página.
	 */
	async function fetchWithTimeout(url) {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
		try {
			return await fetch(url, { signal: controller.signal });
		} finally {
			clearTimeout(timeoutId);
		}
	}

	/* Carga un dataset remoto y, si está vacío, intenta inicializarlo vía
	 * /loadInitialData para que la página pueda seguir funcionando.
	 */
	async function loadDataset(urlOrPath) {
		const endpoint = toApiUrl(urlOrPath);
		const res = await fetchWithTimeout(endpoint);
		if (!res.ok) throw new Error(`Error ${res.status} cargando ${endpoint}`);

		const data = await res.json();
		const hasData = Array.isArray(data)
			? data.length > 0
			: data && Array.isArray(data.data)
			? data.data.length > 0
			: Boolean(data && Object.keys(data).length);

		if (hasData) return data;

		const initEndpoint = `${endpoint.replace(/\/$/, '')}/loadInitialData`;
		const initRes = await fetchWithTimeout(initEndpoint);
		if (!initRes.ok)
			throw new Error(`Error ${initRes.status} inicializando datos en ${initEndpoint}`);

		const reloadRes = await fetchWithTimeout(endpoint);
		if (!reloadRes.ok) throw new Error(`Error ${reloadRes.status} cargando ${endpoint}`);
		return await reloadRes.json();
	}

	/* Indexa los rankings propios por país y año para poder hacer cruces
	 * robustos con datasets externos. Se normaliza el nombre del país y se
	 * ordenan los registros por año para poder buscar el valor más cercano.
	 */
	function indexMyRankings(myData) {
		myRowsByCountryNorm = new Map();
		myNormSet = new Set();
		for (const r of myData) {
			if (!r?.country || r?.year == null) continue;
			const cn = normalizeCountry(r.country);
			if (!cn) continue;
			myNormSet.add(cn);
			const y = Number(r.year);
			if (!Number.isFinite(y)) continue;
			const rank = Number(r.rank);
			const score = Number(r.score);
			if (!Number.isFinite(rank) && !Number.isFinite(score)) continue;
			if (!myRowsByCountryNorm.has(cn)) myRowsByCountryNorm.set(cn, []);
			myRowsByCountryNorm.get(cn).push({
				year: y,
				rank: Number.isFinite(rank) ? rank : null,
				score: Number.isFinite(score) ? score : null,
				country: r.country
			});
		}
		for (const rows of myRowsByCountryNorm.values()) rows.sort((a, b) => a.year - b.year);
		myNormList = [...myNormSet];
	}

	/* Reconstruye el puente entre nombres externos y los nombres propios del
	 * dataset. Usa la librería i18n-iso-countries para mapear EN/ES/ISO y añade
	 * un conjunto de alias manuales para casos comunes de FIFA/dataset externo.
	 */
	function rebuildCountryNameBridge() {
		enNormToMyNorm = new Map();
		iso3ToMyNorm = new Map();
		iso2ToMyNorm = new Map();

		const alpha2 = countries.getAlpha2Codes();
		for (const code of Object.keys(alpha2)) {
			const enName = countries.getName(code, 'en');
			const esName = countries.getName(code, 'es');
			if (!enName || !esName) continue;
			const enN = normalizeCountry(enName);
			const esN = normalizeCountry(esName);
			if (!myNormSet.has(esN)) continue;
			if (!enNormToMyNorm.has(enN)) enNormToMyNorm.set(enN, esN);
			else if (enNormToMyNorm.get(enN) !== esN) enNormToMyNorm.delete(enN);

			const a3 = countries.alpha2ToAlpha3(code);
			if (a3) iso3ToMyNorm.set(String(a3).toUpperCase(), esN);
			iso2ToMyNorm.set(String(code).toUpperCase(), esN);
		}

		/* Alias manuales para nombres externos frecuentes que no casan bien con
		 * la normalización automática o que usan denominaciones locales.
		 */
		const manual = [
			['united states', 'EEUU'],
			['spain', 'España'],
			['united states of america', 'EEUU'],
			['usa', 'EEUU'],
			['u s a', 'EEUU'],
			['u s', 'EEUU'],
			['korea republic of', 'Rep. de Corea'],
			['republic of korea', 'Rep. de Corea'],
			['south korea', 'Rep. de Corea'],
			['korea rep', 'Rep. de Corea'],
			['north korea', 'RDP de Corea'],
			["korea dem people's rep", 'RDP de Corea'],
			['democratic people s republic of korea', 'RDP de Corea'],
			['russian federation', 'Rusia'],
			['ivory coast', 'Costa de Marfil'],
			['cote d ivoire', 'Costa de Marfil'],
			['china', 'China (RP)'],
			['hong kong', 'Hong Kong, China'],
			['türkiye', 'Turquía'],
			['turkey', 'Turquía'],
			['czechia', 'Chequia'],
			['czech republic', 'Chequia']
		];
		for (const [alias, canon] of manual) {
			const target = normalizeCountry(canon);
			if (!myNormSet.has(target)) continue;
			enNormToMyNorm.set(normalizeCountry(alias), target);
		}
	}

	/* Busca una coincidencia floja entre el nombre externo normalizado y
	 * los nombres propios ya indexados. Esto ayuda con variantes como
	 * 'república de x' o sufijos entre paréntesis.
	 */
	function fuzzyMyNorm(externalNorm) {
		if (!externalNorm) return null;
		if (myNormSet.has(externalNorm)) return externalNorm;
		const candidates = myNormList.filter(
			(m) => m === externalNorm || m.startsWith(`${externalNorm} (`) || m.startsWith(`${externalNorm} `)
		);
		if (candidates.length === 1) return candidates[0];
		return null;
	}

	/* Resuelve un país externo a la forma canónica interna mediante:
	 *   1) normalización de nombre
	 *   2) coincidencia floja
	 *   3) código ISO3/ISO2
	 *   4) alias manual EN
	 */
	function resolveExternalCountryNorm(name, record) {
		const raw = name?.toString?.() ?? '';
		const extNorm = normalizeCountry(raw);
		if (!extNorm) return null;

		if (myNormSet.has(extNorm)) return extNorm;
		const fuzzy = fuzzyMyNorm(extNorm);
		if (fuzzy) return fuzzy;

		const codeRaw =
			record?.code ??
			record?.iso3 ??
			record?.country_code ??
			record?.countryCode ??
			record?.alpha3 ??
			record?.Alpha3 ??
			null;
		if (codeRaw) {
			const c = String(codeRaw).trim().toUpperCase();
			if (c.length === 3 && iso3ToMyNorm.has(c)) return iso3ToMyNorm.get(c);
			if (c.length === 2 && iso2ToMyNorm.has(c)) return iso2ToMyNorm.get(c);
		}

		if (enNormToMyNorm.has(extNorm)) return enNormToMyNorm.get(extNorm);
		return null;
	}

	/* Busca la fila propia de ranking más cercana por año para un país
	 * normalizado. Primero intenta match exacto y luego acepta años cercanos
	 * siguiendo la lista de pasos YEAR_MATCH_STEPS.
	 */
	function getMyRowNearest(countryNorm, year) {
		const y = Number(year);
		if (!countryNorm || !Number.isFinite(y)) return null;
		const rows = myRowsByCountryNorm.get(countryNorm);
		if (!rows?.length) return null;

		let best = null;
		let bestDiff = Infinity;
		for (const step of YEAR_MATCH_STEPS) {
			for (const r of rows) {
				const d = Math.abs(r.year - y);
				if (d <= step && d < bestDiff) {
					best = r;
					bestDiff = d;
				}
			}
			if (best) break;
		}
		return best ? { ...best, yearDiff: bestDiff } : null;
	}

	/* Funciones estadísticas de apoyo usadas por varias integraciones.
	 * mean, variance, covariance y pearson solo se usan en este archivo
	 * para comparar tendencias y construir métricas de correlación.
	 */
	function mean(nums) {
		if (!nums.length) return NaN;
		return nums.reduce((a, b) => a + b, 0) / nums.length;
	}

	function variance(nums) {
		if (nums.length < 2) return NaN;
		const m = mean(nums);
		return nums.reduce((acc, x) => acc + (x - m) ** 2, 0) / (nums.length - 1);
	}

	function covariance(xs, ys) {
		if (xs.length !== ys.length || xs.length < 2) return NaN;
		const mx = mean(xs);
		const my = mean(ys);
		let acc = 0;
		for (let i = 0; i < xs.length; i++) acc += (xs[i] - mx) * (ys[i] - my);
		return acc / (xs.length - 1);
	}

	function pearson(xs, ys) {
		const cov = covariance(xs, ys);
		const vx = variance(xs);
		const vy = variance(ys);
		if (!Number.isFinite(cov) || !Number.isFinite(vx) || !Number.isFinite(vy) || vx <= 0 || vy <= 0)
			return NaN;
		return cov / Math.sqrt(vx * vy);
	}

	/* Elige el año que aparece con más frecuencia en un conjunto de pares
	 * país-año. Se usa para seleccionar un año representativo cuando varias
	 * integraciones tienen múltiples años disponibles.
	 */
	function pickMostCommonYear(pairs) {
		// pairs: Array<{year:number}>
		const counts = new Map();
		for (const p of pairs) {
			const y = Number(p.year);
			if (!Number.isFinite(y)) continue;
			counts.set(y, (counts.get(y) || 0) + 1);
		}
		let best = null;
		for (const [y, c] of counts.entries()) {
			if (!best || c > best.count || (c === best.count && y > best.year)) best = { year: y, count: c };
		}
		return best?.year ?? null;
	}

	/** === Funciones para Visualización de Pandemics === */
	function getPrettyName(key) {
		return DISEASE_LABELS[key] || key;
	}

	function formatNumber(value) {
		return Number.isFinite(value) ? value.toFixed(1) : '0.0';
	}

	function computeAveragesByYear(records) {
		const yearMap = new Map();
		for (const record of records) {
			const year = Number(record?.year);
			if (!Number.isFinite(year)) continue;
			if (!yearMap.has(year)) {
				yearMap.set(year, {
					count: 0,
					sums: Object.fromEntries(DISEASE_KEYS.map((key) => [key, 0]))
				});
			}
			const yearEntry = yearMap.get(year);
			yearEntry.count += 1;
			for (const key of DISEASE_KEYS) {
				yearEntry.sums[key] += Number(record?.[key] ?? 0);
			}
		}
		for (const [year, entry] of yearMap.entries()) {
			entry.averages = Object.fromEntries(
				DISEASE_KEYS.map((key) => [key, entry.count ? entry.sums[key] / entry.count : 0])
			);
		}
		return yearMap;
	}

	/* Dibuja la gráfica de pandemics usando ECharts.
	 * Recibe los años ordenados y las series de datos con los valores
	 * promedio para cada enfermedad.
	 * Ahora usa un gráfico paralelo para no emplear tipo line.
	 */
	async function renderPandemicsChart(data, legendNames) {
    const el = document.getElementById('mgn-chart-pandemics-line');
    if (!el || !window.echarts) return;

    try {
        const chart = window.echarts.init(el);
        chart.setOption({
            title: {
                text: 'Evolución de Carga Pandémica (ThemeRiver)',
                left: 'center'
            },
            tooltip: {
                trigger: 'axis',
                formatter: params => {
                    let res = `${params[0].value[0]}<br/>`;
                    params.forEach(p => {
                        res += `${p.marker} ${p.value[2]}: <b>${p.value[1]}</b><br/>`;
                    });
                    return res;
                }
            },
            legend: {
                data: legendNames,
                top: 'bottom'
            },
            singleAxis: {
                top: 50,
                bottom: 80,
                type: 'time', // Maneja cronología automáticamente
                axisTick: {},
                axisLabel: {},
                axisPointer: { animation: true, label: { show: true } },
                splitLine: { show: true, lineStyle: { type: 'dashed' } }
            },
            series: [
                {
                    type: 'themeRiver',
                    emphasis: {
                        itemStyle: { shadowBlur: 20, shadowColor: 'rgba(0, 0, 0, 0.8)' }
                    },
                    data: data // Aquí pasamos la lista plana [año, valor, nombre]
                }
            ]
        });

        const ro = new ResizeObserver(() => chart.resize());
        ro.observe(el);
    } catch (e) {
        console.error('Error renderizando pandemics chart:', e);
    }
}

	/* Carga el dataset de pandemics a través de loadDataset(), calcula medias anuales y construye
	 * el resumen textual que se muestra en el panel de análisis.
	 * Ahora es más flexible y maneja mejor datos vacíos o incompletos.
	 */
	async function loadPandemicsVisualization() {
		try {
			const raw = await loadDataset(PANDEMICS_API);
			const data = Array.isArray(raw) ? raw : raw?.data || [];
			if (!Array.isArray(data) || !data.length) {
				throw new Error('La API de pandemics no devolvió datos válidos');
			}

			const yearMap = computeAveragesByYear(data);
			const sortedYears = [...yearMap.keys()].sort((a, b) => a - b);
			if (!sortedYears.length) {
				throw new Error('No hay años válidos en los datos de pandemics');
			}

			const diseaseStats = DISEASE_KEYS.map((key) => {
				const values = sortedYears.map((year) => yearMap.get(year).averages[key]);
				const mean = values.reduce((acc, x) => acc + x, 0) / values.length;
				const change = values[values.length - 1] - values[0];
				return { key, mean, values, change };
			});

			diseaseStats.sort((a, b) => b.mean - a.mean);
			topDiseases = diseaseStats.slice(0, 4).map((item) => item.key);

			summaryTitle = `Top 4 de enfermedades con mayor carga media: ${topDiseases
				.map(getPrettyName)
				.join(', ')}.`;

			const trendDisease = diseaseStats[0];
			const direction = trendDisease.change >= 0 ? 'en alza' : 'a la baja';
			summaryText = `${getPrettyName(trendDisease.key)} lidera el dataset con una carga media claramente superior y se encuentra ${direction} entre ${sortedYears[0]} y ${sortedYears[sortedYears.length - 1]}.`;

			const chartSeries = topDiseases.map((key) => ({
				name: getPrettyName(key),
				type: 'line',
				smooth: true,
				areaStyle: { opacity: 0.35 },
				data: sortedYears.map((year) => Number(yearMap.get(year).averages[key].toFixed(2)))
			}));
			const themeRiverData = [];
			for (const year of sortedYears) {
    			for (const key of topDiseases) {
        			const value = yearMap.get(year).averages[key];
        			// Formato: [Fecha/Año, Valor, Nombre de la enfermedad]
        			themeRiverData.push([String(year), Number(value.toFixed(2)), getPrettyName(key)]);
    }
}

		// Cambiar la llamada a la función de renderizado
		await renderPandemicsChart(themeRiverData, topDiseases.map(getPrettyName));

			
		} catch (e) {
			console.error('Error en loadPandemicsVisualization:', e);
			throw e;
		}
	}

	/** -----------------------------
	 *  Widget 5 (Food Supply) -> Chart.js Bar Chart
	 *  Visualización: suma de import quantity por item alimenticio
	 *  ----------------------------- */
	function buildFoodVisualization(foodData) {
		// Validar entrada
		if (!foodData) {
			console.warn('buildFoodVisualization: foodData es null/undefined');
			return { data: { labels: [], datasets: [] } };
		}

		let dataArray = foodData;
		if (!Array.isArray(foodData)) {
			if (foodData?.data && Array.isArray(foodData.data)) {
				dataArray = foodData.data;
			} else {
				console.warn('buildFoodVisualization: formato de datos inválido', typeof foodData);
				return { data: { labels: [], datasets: [] } };
			}
		}

		if (!dataArray.length) {
			console.warn('buildFoodVisualization: array vacío');
			return { data: { labels: [], datasets: [] } };
		}

		const agg = new Map(); // key item -> sumImport
		let processedCount = 0;
		let skippedCount = 0;

		for (const f of dataArray) {
			if (!f || typeof f !== 'object') {
				skippedCount++;
				continue;
			}

			const country = String(f.country_name_en || 'Desconocido').trim();
			

			const importQty = Number(f.import_quantity_tonnes);
			if (!Number.isFinite(importQty)) {
				skippedCount++;
				continue;
			}

			// Aceptar cero y positivos (no negatives)
			if (importQty < 0) {
				skippedCount++;
				continue;
			}

			if (!agg.has(country)) agg.set(country, 0);
				agg.set(country, agg.get(country) + importQty);
				processedCount++;
		}

		console.log(`buildFoodVisualization: procesados ${processedCount}, saltados ${skippedCount}, items únicos ${agg.size}`);

		if (agg.size === 0) {
			console.warn('buildFoodVisualization: no hay items con datos válidos después del filtrado');
			return { data: { labels: [], datasets: [] } };
		}

		const items = [...agg.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15); // top 15

		console.log('Top 15 countries:', items);

		const data = {
			labels: items.map(([country]) => country),
			datasets: [{
				label: 'Import Quantity (tonnes)',
				data: items.map(([, qty]) => Number(qty.toFixed(2))),
				backgroundColor: [
					'rgba(239, 68, 68, 0.7)',    // Rojo
					'rgba(249, 115, 22, 0.7)',   // Naranja
					'rgba(59, 130, 246, 0.7)',   // Azul
					'rgba(34, 197, 94, 0.7)',    // Verde
					'rgba(168, 85, 247, 0.7)',   // Púrpura
					'rgba(8, 145, 178, 0.7)',    // Cyan
					'rgba(236, 72, 153, 0.7)',   // Rosa
					'rgba(107, 114, 128, 0.7)',  // Gris
					'rgba(251, 146, 60, 0.7)',   // Naranja claro
					'rgba(14, 165, 233, 0.7)',   // Azul cielo
					'rgba(139, 92, 246, 0.7)',   // Púrpura claro
					'rgba(20, 184, 166, 0.7)',   // Turquesa
					'rgba(244, 114, 182, 0.7)',  // Rosa fuerte
					'rgba(100, 116, 139, 0.7)',  // Gris azulado
					'rgba(251, 191, 36, 0.7)'    // Amarillo
				],
				borderColor: [
					'rgba(239, 68, 68, 1)',
					'rgba(249, 115, 22, 1)',
					'rgba(59, 130, 246, 1)',
					'rgba(34, 197, 94, 1)',
					'rgba(168, 85, 247, 1)',
					'rgba(8, 145, 178, 1)',
					'rgba(236, 72, 153, 1)',
					'rgba(107, 114, 128, 1)',
					'rgba(251, 146, 60, 1)',
					'rgba(14, 165, 233, 1)',
					'rgba(139, 92, 246, 1)',
					'rgba(20, 184, 166, 1)',
					'rgba(244, 114, 182, 1)',
					'rgba(100, 116, 139, 1)',
					'rgba(251, 191, 36, 1)'
				],
				borderWidth: 2
			}]
		};

		return { data };
	}

	/* Inicializa el bar chart de Chart.js para visualizar suma de import quantity por item alimenticio.
	 * Ahora con mejor validación, logging y feedback visual en caso de error.
	 */
	function initChartJSBar(containerId, chartData) {
		const el = document.getElementById(containerId);
		if (!el) {
			console.error(`initChartJSBar: elemento con id '${containerId}' no encontrado`);
			return;
		}

		if (!window.Chart) {
			el.innerHTML = '<div class="status">Chart.js todavía no cargó.</div>';
			return;
		}

		if (!chartData) {
			el.innerHTML = '<div class="status error-msg">Error: chartData es null/undefined.</div>';
			console.error('initChartJSBar: chartData es null/undefined');
			return;
		}

		if (!chartData?.labels?.length || !chartData?.datasets?.[0]?.data?.length) {
			el.innerHTML = '<div class="status">No hay datos suficientes para la visualización de alimentos.</div>';
			console.warn('initChartJSBar: sin datos suficientes', { labels: chartData?.labels?.length, data: chartData?.datasets?.[0]?.data?.length });
			return;
		}

		console.log('initChartJSBar: inicializando con', { labelCount: chartData.labels.length, dataCount: chartData.datasets[0].data.length });

		try {
			// Limpiar el contenedor antes de crear el gráfico
			el.innerHTML = '<canvas></canvas>';
			const canvas = el.querySelector('canvas');

			new window.Chart(canvas, {
				type: 'bar',
				data: chartData,
				options: {
					indexAxis: 'y', // horizontal bar chart
					responsive: true,
					maintainAspectRatio: true,
					animation: {
						duration: 0 // Deshabilitar animación para carga más rápida
					},
					plugins: {
						title: {
							display: true,
							text: 'Top 15 Paises por Cantidad de Importación (tonnes) - Escala Logarítmica',
							font: { size: 14, weight: 'bold' }
						},
						legend: {
							display: false
						},
						tooltip: {
							callbacks: {
								label: function(context) {
									return `${context.raw.toFixed(2)} tonnes`;
								}
							}
						}
					},
					scales: {
						x: {
							type: 'logarithmic',
							title: {
								display: true,
								text: 'Import Quantity por pais(tonnes) - Escala Logarítmica',
								font: { size: 11 }
							},
							grid: {
								display: true,
								color: 'rgba(0,0,0,0.05)'
							}
						},
						y: {
							title: {
								display: true,
								text: 'Items Alimenticios',
								font: { size: 11 }
							}
						}
					}
				}
			});
			console.log('initChartJSBar: gráfico creado exitosamente');
		} catch (e) {
			console.error('Error renderizando Chart.js bar:', e);
			el.innerHTML = `<div class="status error-msg">Error renderizando gráfico: ${e.message}</div>`;
		}
	}

	/** =============================
	 *  Widget 6 (Rest Countries) -> HTML Table
	 *  Integración: bandera, población, región y ranking FIFA
	 *  ============================= */
	async function buildRestCountriesTable(myData) {
		const tableData = [];
		
		// Solo procesar los top 50 países ordenados por rank para que sea más rápido
		// Filtrar solo el año 2026 para evitar países duplicados y tomar el top 50
        const topCountries = myData
            .filter(item => Number(item.year) === 2026)
            .sort((a, b) => (a.rank || 999) - (b.rank || 999))
            .slice(0, 50);

		for (const my of topCountries) {
			if (!my?.country || !my?.rank) continue;

			try {
				const endpoint = `${REST_COUNTRIES_API}/${encodeURIComponent(my.country)}`;
				const res = await fetchWithTimeout(endpoint);
				if (!res.ok) continue;

				const countryList = await res.json();
				if (!Array.isArray(countryList) || !countryList.length) continue;

				const countryData = countryList[0];
				const flag = countryData?.flag || '🏳️';
				const population = countryData?.population || 'N/A';
				const region = countryData?.region || 'N/A';
				const name = countryData?.name?.common || my.country;

				tableData.push({
					country: my.country,
					name,
					flag,
					rank: my.rank,
					score: my.score,
					population,
					region
				});
			} catch (e) {
				console.warn(`Error fetching data for ${my.country}:`, e);
			}
		}

		return tableData;
	}

	function initRestCountriesTable(containerId, tableData) {
		const el = document.getElementById(containerId);
		if (!el) return;

		if (!tableData || tableData.length === 0) {
			el.innerHTML = '<div class="status">No hay datos disponibles.</div>';
			return;
		}

		let html = `
			<table class="countries-table">
				<thead>
					<tr>
						<th>Bandera</th>
						<th>País</th>
						<th>Rank FIFA</th>
						<th>Score FIFA</th>
						<th>Población</th>
						<th>Región</th>
					</tr>
				</thead>
				<tbody>
		`;

		for (const row of tableData) {
			html += `
				<tr>
					<td class="flag-cell">${row.flag}</td>
					<td>${row.name}</td>
					<td class="rank-cell">${row.rank}</td>
					<td class="score-cell">${row.score?.toFixed(2) || 'N/A'}</td>
					<td class="population-cell">${Number(row.population).toLocaleString()}</td>
					<td>${row.region}</td>
				</tr>
			`;
		}

		html += `
				</tbody>
			</table>
		`;

		el.innerHTML = html;
	}

	/** =============================
     *  Widget 7 (Weather) -> HTML Table
     *  Integración: Coordenadas de capital (RestCountries) + Temperatura (Open-Meteo) + FIFA Rank
     *  ============================= */
    async function buildWeatherTable(myData) {
        const tableData = [];
        
        // Tomamos el top 50 para no hacer demasiadas peticiones seguidas
        // Filtrar solo el año 2026 para evitar países duplicados y tomar el top 50	
        const topCountries = myData
            .filter(item => Number(item.year) === 2026)
            .sort((a, b) => (a.rank || 999) - (b.rank || 999))
            .slice(0, 50);

        for (const my of topCountries) {
            if (!my?.country || !my?.rank) continue;

            try {
                // 1. Obtener la capital y sus coordenadas desde Rest Countries
                const countryRes = await fetchWithTimeout(`${REST_COUNTRIES_API}/${encodeURIComponent(my.country)}`);
                if (!countryRes.ok) continue;

                const countryList = await countryRes.json();
                if (!Array.isArray(countryList) || !countryList.length) continue;

                const countryData = countryList[0];
                const capital = countryData?.capital?.[0] || 'N/A';
                const flag = countryData?.flag || '🏳️';
                
                // Usamos las coordenadas de la capital si existen, si no las del país
                const latlng = countryData?.capitalInfo?.latlng || countryData?.latlng;

                let temp = 'N/A';

                // 2. Si tenemos coordenadas, llamamos a Open-Meteo
                if (latlng && latlng.length === 2) {
                    const [lat, lon] = latlng;
                    const weatherRes = await fetchWithTimeout(`${OPEN_METEO_API}?latitude=${lat}&longitude=${lon}&current_weather=true`);
                    
                    if (weatherRes.ok) {
                        const weatherData = await weatherRes.json();
                        const t = weatherData.current_weather?.temperature;
                        let icon = '⛅'; // por defecto templado/nublado
                        if (t >= 25) icon = '☀️'; // calor
                        else if (t <= 10) icon = '❄️'; // frío
                        
                        temp = `${t}°C ${icon}`;
                    }
                }

                tableData.push({
                    country: my.country,
                    flag,
                    rank: my.rank,
                    capital,
                    temp: temp 
                });
            } catch (e) {
                console.warn(`Error fetching weather data for ${my.country}:`, e);
            }
        }

        return tableData;
    }

    function initWeatherTable(containerId, tableData) {
        const el = document.getElementById(containerId);
        if (!el) return;

        if (!tableData || tableData.length === 0) {
            el.innerHTML = '<div class="status">No hay datos de clima disponibles.</div>';
            return;
        }

        // Reutilizamos las clases CSS de la tabla anterior para que quede idéntica
        let html = `
            <table class="countries-table">
                <thead>
                    <tr>
                        <th>Bandera</th>
                        <th>País</th>
                        <th>Rank FIFA</th>
                        <th>Capital</th>
                        <th style="text-align: right;">Temperatura Actual</th>
                    </tr>
                </thead>
                <tbody>
        `;

        for (const row of tableData) {
            html += `
                <tr>
                    <td class="flag-cell">${row.flag}</td>
                    <td>${row.country}</td>
                    <td class="rank-cell">${row.rank}</td>
                    <td>${row.capital}</td>
                    <td class="score-cell">${row.temp}</td>
                </tr>
            `;
        }

        html += `
                </tbody>
            </table>
        `;

        el.innerHTML = html;
    }

	/** =============================
	 *  Widget 1 (Population densities) -> Highcharts Heatmap
	 *  Integración: score FIFA vs density (bins) para país-año comunes
	 *  ============================= */
	function buildScoreDensityPairs(popData) {
		const pairs = [];
		for (const p of popData) {
			if (!p?.country || p?.year == null) continue;
			const density = Number(p.density);
			if (!Number.isFinite(density)) continue;
			const cNorm = resolveExternalCountryNorm(p.country, p);
			if (!cNorm) continue;
			const mine = getMyRowNearest(cNorm, p.year);
			if (!mine || !Number.isFinite(mine.score)) continue;
			pairs.push({
				score: mine.score,
				year: Number(p.year),
				country: mine.country,
				density
			});
		}
		return pairs;
	}

	/* Inicializa el heatmap de Highcharts para visualizar la densidad de
	 * puntos en el plano score FIFA vs densidad de población.
	 */
	function initHighchartsHeatmap(containerId, pairs) {
		const el = document.getElementById(containerId);
		if (!el) return;

		if (!pairs.length) {
			el.innerHTML = '<div class="status">No hay cruces país-año suficientes.</div>';
			return;
		}

		const scores = pairs.map((p) => p.score);
		const densities = pairs.map((p) => p.density);
		const minS = Math.min(...scores);
		const maxS = Math.max(...scores);
		const minD = Math.min(...densities);
		const maxD = Math.max(...densities);

		// 8x8 bins (estadística “pura”: densidad de puntos en el plano score-densidad)
		const xBins = 8;
		const yBins = 8;
		const xStep = (maxS - minS) / xBins || 1;
		const yStep = (maxD - minD) / yBins || 1;

		const matrix = Array.from({ length: xBins }, () => Array.from({ length: yBins }, () => 0));
		for (const p of pairs) {
			let xi = Math.floor((p.score - minS) / xStep);
			let yi = Math.floor((p.density - minD) / yStep);
			if (xi === xBins) xi = xBins - 1;
			if (yi === yBins) yi = yBins - 1;
			matrix[xi][yi] += 1;
		}

		const xCats = Array.from({ length: xBins }, (_, i) => `${(minS + i * xStep).toFixed(0)}–${(
			minS +
			(i + 1) * xStep
		).toFixed(0)}`);
		const yCats = Array.from({ length: yBins }, (_, i) => `${(minD + i * yStep).toFixed(0)}–${(
			minD +
			(i + 1) * yStep
		).toFixed(0)}`);

		const data = [];
		let maxCount = 0;
		for (let x = 0; x < xBins; x++) {
			for (let y = 0; y < yBins; y++) {
				const v = matrix[x][y];
				if (v > maxCount) maxCount = v;
				data.push([x, y, v]);
			}
		}

		Highcharts.chart(containerId, {
			chart: { type: 'heatmap', height: 520, backgroundColor: 'transparent' },
			title: { text: 'Densidad de puntos: Score FIFA vs Densidad de población' },
			subtitle: {
				text:
					'Cruce país-año. Cada celda cuenta cuántos países caen en un rango de score y densidad.'
			},
			xAxis: { categories: xCats, title: { text: 'Score (rangos)' } },
			yAxis: { categories: yCats, title: { text: 'Densidad (hab/km², rangos)' }, reversed: false },
			colorAxis: {
				min: 0,
				max: Math.max(1, maxCount),
				stops: [
					[0, '#eef2ff'],
					[0.5, '#60a5fa'],
					[1, '#1e3a8a']
				]
			},
			legend: { align: 'right', layout: 'vertical', verticalAlign: 'middle' },
			tooltip: {
				formatter: function () {
					return `<b>Score</b>: ${xCats[this.point.x]}<br/><b>Densidad</b>: ${yCats[this.point.y]}<br/><b>País-año</b>: ${this.point.value}`;
				}
			},
			series: [
				{
					name: 'Conteo',
					borderWidth: 1,
					borderColor: 'rgba(0,0,0,0.08)',
					data,
					dataLabels: { enabled: true, color: '#0f172a' }
				}
			],
			credits: { enabled: false }
		});
	}

	/** -----------------------------
	 *  Widget 2 (Wine) -> ApexCharts Treemap (CDN) - Evolución por años
	 *  Integración: rank/score FIFA vs precio medio vino por país-año
	 *  ----------------------------- */
	/* Construye las métricas de vino por país+año y las cruza con el
	 * ranking FIFA propio. Calcula precio medio y ABV medio para luego
	 * renderizar una treemap con tamaño=precio y color=rank.
	 */
	function buildWineIntegration(wineData) {
    const targetCountry = 'España';
    const targetNorm = normalizeCountry(targetCountry); // "espana"
    
    // 1. Agrupamos vinos por año solo si corresponden a nuestro país objetivo
    const agg = new Map();
    for (const w of wineData) {
        if (w?.year == null) continue;
        
        // Resolvemos el país del vino ("spain" -> "espana")
        const wineCountryNorm = resolveExternalCountryNorm(w.country, w);
        if (wineCountryNorm !== targetNorm) continue; 

        const price = Number(w.price);
        if (!Number.isFinite(price)) continue;
        
        const year = Number(w.year);
        if (!agg.has(year)) agg.set(year, { sumPrice: 0, n: 0 });
        const a = agg.get(year);
        a.sumPrice += price;
        a.n += 1;
    }

    const pairs = [];
    for (const [year, a] of agg.entries()) {
        const avgPrice = a.sumPrice / a.n;
        
        // 2. Buscamos el ranking usando el nombre normalizado para evitar fallos de tildes
        const spainRow = getMyRowNearest(targetNorm, year);
        
        if (!spainRow || !Number.isFinite(spainRow.rank)) continue;
        
        pairs.push({
            year: year,
            avgPrice: avgPrice,
            rank: spainRow.rank,
            score: spainRow.score,
            wines: a.n
        });
    }

    const series = [{
        data: pairs
            .map((p) => ({
                x: `${p.year}`,
                y: Number(p.avgPrice.toFixed(2)),
                rank: p.rank,
                score: p.score,
                wines: p.wines
            }))
            .sort((a, b) => Number(a.x) - Number(b.x))
    }];

    return { pairsCount: pairs.length, yearUsed: null, series };
}

	/* Inicializa la treemap de ApexCharts con datos de precio medio del
	 * vino y ranking FIFA por país.
	 */
	function initApexTreemap(containerId, treemapSeries, yearUsed) {
		const el = document.getElementById(containerId);
		if (!el) return;
		if (!window.ApexCharts) {
			el.innerHTML = '<div class="status">ApexCharts todavía no cargó.</div>';
			return;
		}
		if (!treemapSeries?.[0]?.data?.length) {
			el.innerHTML = '<div class="status">No hay cruces país-año suficientes.</div>';
			return;
		}

		el.innerHTML = '';
		const chart = new window.ApexCharts(el, {
			series: treemapSeries,
			chart: { type: 'treemap', height: 520, toolbar: { show: true } },
			title: {
				text: `Precio medio del vino vs ranking FIFA${yearUsed ? ` (año ${yearUsed})` : ''}`
			},
			legend: { show: false },
			plotOptions: {
				treemap: {
					enableShades: true,
					shadeIntensity: 0.4,
					distributed: false,
					colorScale: {
						ranges: [
							{ from: 1, to: 30, color: '#16a34a' },
							{ from: 31, to: 80, color: '#f59e0b' },
							{ from: 81, to: 250, color: '#dc2626' }
						]
					}
				}
			},
			dataLabels: {
				enabled: true,
				style: { fontSize: '12px' },
				formatter: function (text, opts) {
					const d = opts.w.config.series[0].data[opts.dataPointIndex];
					return `${text}\n€${d.y}`;
				}
			},
			tooltip: {
				y: { formatter: (val) => `€${val}` },
				custom: function ({ seriesIndex, dataPointIndex, w }) {
					const d = w.config.series[seriesIndex].data[dataPointIndex];
					return `<div class="apex-tooltip">
						<div><b>${d.x}</b></div>
						<div>Precio medio vino: €${d.y}</div>
						<div>Ranking FIFA: ${d.rank}</div>
						<div>Score FIFA: ${d.score}</div>
						<div>Vinos en dataset: ${d.wines}</div>
					</div>`;
				}
			}
		});
		chart.render();
	}

	function quantile(sorted, q) {
		if (!sorted.length) return NaN;
		const pos = (sorted.length - 1) * q;
		const base = Math.floor(pos);
		const rest = pos - base;
		if (sorted[base + 1] === undefined) return sorted[base];
		return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
	}

	/* Calcula estadísticas de caja (boxplot) a partir de una lista de valores.
	 * Se usa para análisis estadístico interno cuando se procesan distribuciones.
	 */
	function toBoxStats(values) {
		const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
		if (!v.length) return null;
		const q1 = quantile(v, 0.25);
		const q2 = quantile(v, 0.5);
		const q3 = quantile(v, 0.75);
		const iqr = q3 - q1;
		const low = v.find((x) => x >= q1 - 1.5 * iqr) ?? v[0];
		const high = [...v].reverse().find((x) => x <= q3 + 1.5 * iqr) ?? v[v.length - 1];
		return { low, q1, q2, q3, high };
	}

	/** -----------------------------
	 *  Widget 4 (Meteorites) -> Google Charts Bar Chart (CDN)
	 *  Visualización: conteo de meteoritos por país para los primeros 100 registros
	 *  ----------------------------- */
	function buildMeteoritesIntegration(meteoritesData) {
    const first100 = meteoritesData.slice(0, 100);
    const countByCountry = new Map();
    for (const m of first100) {
        const country = m?.country;
        if (!country || country.toLowerCase() === 'unknown') continue;
        countByCountry.set(country, (countByCountry.get(country) || 0) + 1);
    }
    
    const sorted = [...countByCountry.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);

    // Aquí es donde sucede la magia: acortamos el nombre para el eje
    const rows = sorted.map(([country, count]) => {
        const shortName = country.length > 10 ? country.substring(0, 10) + '...' : country;
        return [shortName, count];
    });

    return { rows };
}

	/* Inicializa el bar chart de Google Charts para visualizar el conteo
	 * de meteoritos por país para los primeros 100 registros.
	 */
	function initGoogleBar(containerId, rows) {
		const el = document.getElementById(containerId);
		if (!el) return;
		if (!window.google?.charts) {
			el.innerHTML = '<div class="status">Google Charts todavía no cargó.</div>';
			return;
		}
		if (!rows?.length) {
			el.innerHTML = '<div class="status">No hay datos suficientes.</div>';
			return;
		}

		window.google.charts.load('current', { packages: ['corechart'] });
		window.google.charts.setOnLoadCallback(() => {
			const data = new window.google.visualization.DataTable();
			data.addColumn('string', 'País');
			data.addColumn('number', 'Conteo');
			data.addRows(rows);

			const options = {
				title: 'Conteo de meteoritos por país (primeros 100 registros)',
				height: 560,
				hAxis: { 
      			  	title: 'País',
        			slantedText: true,       // Fuerza el texto inclinado
       				slantedTextAngle: 45,    // Ángulo de inclinación
       				maxAlternation: 1        // Evita que los ponga en dos filas (lo que suele romper el layout)
    },
				vAxis: { title: 'Conteo' },
				legend: { position: 'none' },
				chartArea: { left: '10%', top: '8%', width: '84%', height: '78%' }
			};

			const chart = new window.google.visualization.ColumnChart(el);
			chart.draw(data, options);
		});
	}
	/** =============================
     *  Widget 8 (Crypto) -> Chart.js Polar Area
     *  Visualización: Precio de las 7 principales Criptomonedas (Independiente)
     *  ============================= */
   async function loadCryptoVisualization() {
        try {
            const res = await fetchWithTimeout(CRYPTO_API);
            if (res.status === 429) {
                throw new Error('CoinGecko rate limit alcanzado (429). Intenta de nuevo más tarde.');
            }
            if (!res.ok) throw new Error(`Error fetching crypto: ${res.status}`);

            const data = await res.json();
            const coins = Array.isArray(data) ? data.slice(0, MAX_CRYPTO_ITEMS) : [];
            if (!coins.length) throw new Error('No se recibieron datos de criptomonedas.');

            const totalMarketCap = coins.reduce((sum, coin) => sum + Number(coin.market_cap || 0), 0);
            const labels = coins.map(coin => coin.name || 'Desconocido');
            const percentages = coins.map(coin => {
                const marketCap = Number(coin.market_cap || 0);
                return totalMarketCap ? Number(((marketCap / totalMarketCap) * 100).toFixed(2)) : 0;
            });

            const chartData = {
                labels,
                datasets: [{
                    label: 'Dominancia en el Top 7 (%)',
                    data: percentages,
                    backgroundColor: [
                        'rgba(255, 99, 132, 0.6)',
                        'rgba(54, 162, 235, 0.6)',
                        'rgba(255, 206, 86, 0.6)',
                        'rgba(75, 192, 192, 0.6)',
                        'rgba(153, 102, 255, 0.6)',
                        'rgba(255, 159, 64, 0.6)',
                        'rgba(199, 199, 199, 0.6)'
                    ],
                    borderWidth: 1
                }]
            };

            initChartJSPolar('mgn-chart-crypto', chartData);
        } catch (e) {
            console.error('Error en Widget 8 (Crypto):', e);
            const el = document.getElementById('mgn-chart-crypto-container');
            if (el) el.innerHTML = `<div class="status">Error cargando datos de criptomonedas: ${e.message}</div>`;
        }
    }

    function initChartJSPolar(containerId, chartData) {
        const el = document.getElementById(containerId);
        if (!el) return;
        if (!window.Chart) {
            const container = document.getElementById('mgn-chart-crypto-container');
            if(container) container.innerHTML = '<div class="status">Chart.js todavía no cargó.</div>';
            return;
        }

        new window.Chart(el, {
            type: 'polarArea',
            data: chartData,
            options: {
                responsive: true,
                maintainAspectRatio: false, 
                animation: { duration: 0 },
                plugins: {
                    legend: { position: 'right' },
                    title: { 
                        display: true, 
                        text: 'Dominancia por Capitalización de Mercado (%) - Top 7' 
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return ` ${context.label}: ${context.raw}%`;
                            }
                        }
                    }
                }
            }
        });
    }
    

	/** -----------------------------
	 *  Main onMount
	 *  ----------------------------- */
	/* Montaje principal de la página. Solo se ejecuta en el browser
	 * porque algunas librerías de visualización no funcionan en SSR.
	 *
	 * 1) carga módulos de visualización necesarios.
	 * 2) descarga datasets en paralelo.
	 * 3) indexa y normaliza datos propios.
	 * 4) construye cada widget y monta la gráfica correspondiente.
	 */
	onMount(async () => {
		if (!browser) return;
		try {
			// Highcharts heatmap module debe cargarse solo en browser (SSR rompe si se evalúa en Node)
			const heatmapMod = await import('highcharts/modules/heatmap');
			const heatmapModule =
				(typeof heatmapMod === 'function' && heatmapMod) ||
				(typeof heatmapMod?.default === 'function' && heatmapMod.default) ||
				(typeof heatmapMod?.module === 'function' && heatmapMod.module);
			if (typeof heatmapModule === 'function') heatmapModule(Highcharts);
			else console.warn('[mgn] heatmap module no cargado (export inesperado)', heatmapMod);

			// ECharts para visualización de pandemics
			// eslint-disable-next-line no-undef
			const echarts = await import('echarts');
			window.echarts = echarts;

			// Cargar datasets en paralelo
			const [myRaw, popRaw, wineRaw, meteoritesRaw, foodRaw] = await Promise.all([
				loadDataset(MY_API_URL),
				loadDataset(POP_DENSITIES_API),
				loadDataset(WINE_API),
				loadDataset(METEORITES_API),
				loadDataset(FOOD_API)
			]);

			const myData = Array.isArray(myRaw) ? myRaw : myRaw?.data || [];
			const popData = Array.isArray(popRaw) ? popRaw : popRaw?.data || [];
			const wineData = Array.isArray(wineRaw) ? wineRaw : wineRaw?.data || [];
			const meteoritesData = Array.isArray(meteoritesRaw) ? meteoritesRaw : meteoritesRaw?.data || [];
			const foodData = Array.isArray(foodRaw) ? foodRaw : foodRaw?.data || [];

			indexMyRankings(myData);
			rebuildCountryNameBridge();

			// Widget 1
			try {
				const popPairs = buildScoreDensityPairs(popData);
				const popYears = popPairs.map((p) => p.year);
				stats.pop.commonPairs = popPairs.length;
				stats.pop.yearRange = popYears.length ? `${Math.min(...popYears)}–${Math.max(...popYears)}` : '';
				initHighchartsHeatmap('mgn-chart-pop-heatmap', popPairs);
			} catch (e) {
				console.error('Error en widget 1 (población):', e);
				document.getElementById('mgn-chart-pop-heatmap').innerHTML = '<div class="status">Error cargando datos de población.</div>';
			}

			// Widget 2
			try {
				const wine = buildWineIntegration(wineData);
				stats.wine.commonPairs = wine.pairsCount;
				stats.wine.yearUsed = wine.yearUsed ? String(wine.yearUsed) : '';
				initApexTreemap('mgn-chart-wine-treemap', wine.series, wine.yearUsed);
			} catch (e) {
				console.error('Error en widget 2 (vino):', e);
				document.getElementById('mgn-chart-wine-treemap').innerHTML = '<div class="status">Error cargando datos de vino.</div>';
			}

			// Widget 3
			try {
				const met = buildMeteoritesIntegration(meteoritesData);
				initGoogleBar('mgn-chart-meteorites-bubble', met.rows);
			} catch (e) {
				console.error('Error en widget 3 (meteoritos):', e);
				document.getElementById('mgn-chart-meteorites-bubble').innerHTML = '<div class="status">Error cargando datos de meteoritos.</div>';
			}

			// Widget 4 (Pandemics Visualization)
			try {
				await loadPandemicsVisualization();
			} catch (e) {
				console.error('Error cargando visualización de pandemics:', e);
				const el = document.getElementById('mgn-chart-pandemics-line');
				if (el) el.innerHTML = '<div class="status error-msg">Error cargando datos de pandemias. Intenta recargar la página.</div>';
			}

			// Widget 5 (Food Supply)
			try {
				const food = buildFoodVisualization(foodData);
				initChartJSBar('mgn-chart-food-bar', food.data);
			} catch (e) {
				console.error('Error cargando visualización de alimentos:', e);
				const el = document.getElementById('mgn-chart-food-bar');
				if (el) el.innerHTML = '<div class="status error-msg">Error cargando datos de alimentos. Intenta recargar la página.</div>';
			}

			// Widget 6 (Rest Countries)
			try {
				const tableData = await buildRestCountriesTable(myData);
				initRestCountriesTable('mgn-chart-rest-countries', tableData);
			} catch (e) {
				console.error('Error cargando tabla de países:', e);
				document.getElementById('mgn-chart-rest-countries').innerHTML = '<div class="status">Error cargando datos de países.</div>';
			}
			// Widget 7 (Weather)
            try {
                const weatherData = await buildWeatherTable(myData);
                initWeatherTable('mgn-chart-weather', weatherData);
            } catch (e) {
                console.error('Error cargando tabla de clima:', e);
                document.getElementById('mgn-chart-weather').innerHTML = '<div class="status">Error cargando datos de clima.</div>';
            }
			// Widget 8 (Crypto)
            try {
                await loadCryptoVisualization();
            } catch (e) {
                console.error('Error cargando visualización de criptomonedas:', e);
            }
		} catch (e) {
			console.error('Error general en carga de datos:', e);
		} finally {
			loading = false;
		}
	});
</script>

<svelte:head>
	<!-- CDNs usados solo en esta página (como hacen tus compañeros) -->
	<script src="https://cdn.jsdelivr.net/npm/apexcharts"></script>
	<script src="https://www.gstatic.com/charts/loader.js"></script>
	<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</svelte:head>

<main class="page">
	<h1>Integraciones MGN (8 Apis Externas)</h1>

	{#if loading}
		<div class="status">Cargando datasets y calculando integraciones...</div>
	{/if}

	<section class:hidden={loading} class="card">
		<h2>1) Densidad de población vs Score FIFA (Highcharts + Heatmap)</h2>
		<p class="desc">
			Integración por <b>país</b> alineando nombres (ES/EN + ISO cuando existe) y por <b>año</b> (match exacto
			o el más cercano dentro de tu serie). Construyo pares <b>(score, densidad)</b> y los discretizo en bins
			para pintar una <b>heatmap</b> de frecuencias.
		</p>
		<p class="meta">Cruces: {stats.pop.commonPairs} · Rango años: {stats.pop.yearRange}</p>
		<div id="mgn-chart-pop-heatmap" class="chart"></div>
	</section>

	<section class:hidden={loading} class="card">
		<h2>2) Evolución anual: Ranking FIFA de España vs precio medio de vino (ApexCharts + Treemap)</h2>
		<p>Visualización de la evolución anual del ranking FIFA de España y el precio medio de los vinos españoles. Cada cuadro representa un año, con el tamaño proporcional al precio medio del vino y el color indicando el ranking FIFA (verde = mejor ranking).</p>
		<p class="desc">
			Agrego la API de vino a <b>precio medio por país+año</b> (y nº de vinos) y lo cruzo con tu
			<b>rank/score</b> usando el mismo alineado de país/año. La <b>treemap</b> muestra tamaño por precio medio
			y color por rango de ranking.
		</p>
		<p class="meta">Años con datos: {stats.wine.commonPairs}</p>
		<div id="mgn-chart-wine-treemap" class="chart"></div>
	</section>

	<section class:hidden={loading} class="card">
		<h2>3) Meteoritos por País (Google Charts + BarChart)</h2>
		<p class="desc">
			Visualización del conteo de meteoritos por país, tomando los primeros 100 registros de la API externa.
			Se muestra un gráfico de barras con los países y su cantidad de meteoritos.
		</p>
		<div id="mgn-chart-meteorites-bubble" class="chart"></div>
	</section>

	<section class:hidden={loading} class="card">
		<h2>4) Evolución Anual de Pandemias (ECharts + Theme River)</h2>
		<p class="desc">
			Visualización independiente de la API de pandemias. Muestra la evolución anual de casos reportados para las principales enfermedades infecciosas.
		</p>
		<div id="mgn-chart-pandemics-line" class="chart"></div>
	</section>

	<section class:hidden={loading} class="card">
		<h2>5) Cantidad de Importación por Item Alimenticio (Chart.js + Bar Chart)</h2>
		<p class="desc">
			Visualización independiente de la API de suministro de alimentos. Muestra la suma de cantidad de importación por item alimenticio, ordenado de mayor a menor, para los top 10 items.
		</p>
		<div id="mgn-chart-food-bar" class="chart"></div>
	</section>

	<section class:hidden={loading} class="card">
		<h2>6) Información de Países (Rest Countries API)</h2>
		<p class="desc">
			Datos geográficos y demográficos de cada país: bandera, población, región y su ranking actual en la FIFA.
		</p>
		<div id="mgn-chart-rest-countries" class="table-container"></div>
	</section>

	<section class:hidden={loading} class="card">
        <h2>7) Clima actual en la Capital vs Ranking FIFA (Open-Meteo API)</h2>
        <p class="desc">
            Doble integración externa: cruzamos el top 20 de nuestro ranking FIFA con la API de <b>Rest Countries</b> para obtener la capital y sus coordenadas, y consultamos la API de <b>Open-Meteo</b> para mostrar la temperatura en tiempo real.
        </p>
        <div id="mgn-chart-weather" class="table-container"></div>
    </section>
	<section class:hidden={loading} class="card">
        <h2>8) Top 7 Criptomonedas (Chart.js + Polar Area)</h2>
        <p class="desc">
            Visualización de datos 100% independiente usando la API pública de <b>CoinCap</b>. Se extraen las 7 criptomonedas con mayor capitalización de mercado y se grafica su precio en tiempo real (USD) utilizando un formato <b>Polar Area</b>.
        </p>
        <div id="mgn-chart-crypto-container" style="position: relative; height: 450px; width: 100%;">
            <canvas id="mgn-chart-crypto"></canvas>
        </div>
    </section>

</main>

<style>
	.page {
		max-width: 1100px;
		margin: 24px auto;
		padding: 24px;
		font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
	}

	h1 {
		text-align: center;
		color: #0f172a;
		margin: 8px 0 24px;
	}

	.card {
		background: white;
		border-radius: 14px;
		padding: 18px 18px 10px;
		margin: 18px 0;
		box-shadow: 0 10px 26px rgba(15, 23, 42, 0.08);
		border: 1px solid rgba(15, 23, 42, 0.06);
	}

	h2 {
		margin: 0 0 8px;
		color: #1f2937;
		font-size: 1.2rem;
	}

	.desc {
		margin: 0 0 8px;
		color: #334155;
		line-height: 1.35;
	}

	#mgn-chart-pandemics-line {
    width: 100%;
    height: 500px; /* Altura mínima para que sea visible */
}
	#mgn-chart-meteorites-bubble {
		min-height: 580px;
		height: 580px;
	}
	.meta {
		margin: 0 0 12px;
		color: #64748b;
		font-size: 0.95rem;
	}

	.chart {
		width: 100%;
		min-height: 520px;
	}

	.status {
		padding: 18px;
		text-align: center;
		color: #475569;
	}

	.error {
		padding: 14px 16px;
		border-radius: 10px;
		background: #fee2e2;
		color: #7f1d1d;
		border: 1px solid #fecaca;
	}

	.error-msg {
		padding: 18px;
		text-align: center;
		color: #7f1d1d;
		background: #fee2e2;
		border: 1px solid #fecaca;
		border-radius: 10px;
	}

	.table-container {
		width: 100%;
		overflow-x: auto;
	}

	.countries-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.95rem;
	}

	.countries-table thead {
		background: #f1f5f9;
		font-weight: 600;
		color: #1f2937;
	}

	.countries-table th {
		padding: 12px 8px;
		text-align: left;
		border-bottom: 2px solid #cbd5e1;
	}

	.countries-table td {
		padding: 10px 8px;
		border-bottom: 1px solid #e2e8f0;
	}

	.countries-table tbody tr:hover {
		background: #f8fafc;
	}

	.flag-cell {
		font-size: 1.5rem;
		text-align: center;
	}

	.rank-cell,
	.score-cell,
	.population-cell {
		text-align: right;
		font-family: 'Courier New', monospace;
	}

	.rank-cell {
		color: #0f766e;
		font-weight: 500;
	}

	.score-cell {
		color: #1e40af;
		font-weight: 500;
	}

	.population-cell {
		color: #64748b;
	}

	.hidden {
		display: none;
	}

	.panel {
		margin-top: 20px;
		padding: 16px;
		background: #f8fafc;
		border: 1px solid #e2e8f0;
		border-radius: 12px;
	}

	.panel p {
		margin: 8px 0;
		color: #475569;
		line-height: 1.5;
	}

	:global(.apex-tooltip) {
		padding: 10px 12px;
	}
</style>
