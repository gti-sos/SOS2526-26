<script>
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { env } from '$env/dynamic/public';
	import Highcharts from 'highcharts';
	import countries from 'i18n-iso-countries';
	import enLocale from 'i18n-iso-countries/langs/en.json';
	import esLocale from 'i18n-iso-countries/langs/es.json';

	countries.registerLocale(enLocale);
	countries.registerLocale(esLocale);

	/** -----------------------------
	 *  APIs
	 *  ----------------------------- */
	const MY_API_URL =
		'https://sos2526-26.onrender.com/api/v2/national-team-rankings-per-years/';

	const POP_DENSITIES_API = 'https://sos2526-15-1.onrender.com/api/v1/population-densities';
	const WINE_API = 'https://sos2526-29.onrender.com/api/v1/wine-stats';
	const PANDEMICS_API = 'https://sos2526-10.onrender.com/api/v2/pandemics';
	const METEORITES_API = 'https://meteorite-landings-tvcf.onrender.com/api/v2/meteorite-landings';
	const WATER_API = 'https://sos2526-27.onrender.com/api/v1/drinking-water-services';

	/** -----------------------------
	 *  UI state
	 *  ----------------------------- */
	let loading = $state(true);
	let errorMessage = $state('');
	let stats = $state({
		pop: { commonPairs: 0, yearRange: '' },
		wine: { commonPairs: 0, yearUsed: '' },
		pandemics: { commonPairs: 0, yearRange: '' },
		meteorites: { commonPairs: 0, yearUsed: '' },
		water: { commonPairs: 0, yearUsed: '' }
	});

	/** Índice país(año) para cruce robusto (nombre + año cercano) */
	let myRowsByCountryNorm = new Map();
	let myNormList = [];
	let myNormSet = new Set();
	let enNormToMyNorm = new Map();
	let iso3ToMyNorm = new Map();
	let iso2ToMyNorm = new Map();

	const YEAR_MATCH_STEPS = [0, 1, 2, 3, 5, 8, 12, 20, 30];

	/** -----------------------------
	 *  Helpers
	 *  ----------------------------- */
	const REQUEST_TIMEOUT_MS = 40000;
	const API_BASE_URL = (
		(env.PUBLIC_API_URL && env.PUBLIC_API_URL.trim()) ||
		(typeof window !== 'undefined' ? window.location.origin : '')
	).replace(/\/$/, '');

	function toApiUrl(path) {
		if (/^https?:\/\//.test(path)) return path;
		return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
	}

	function normalizeCountry(value = '') {
		return value
			.toString()
			.toLowerCase()
			.normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '')
			.replace(/[^a-z0-9]+/g, ' ')
			.trim();
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

	async function loadDataset(urlOrPath) {
		const endpoint = toApiUrl(urlOrPath);
		const res = await fetchWithTimeout(endpoint);
		if (!res.ok) throw new Error(`Error ${res.status} cargando ${endpoint}`);
		return await res.json();
	}

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

		/** Alias FIFA / dataset interno (clave: texto normalizado “externo”; valor: etiqueta canónica interna) */
		const manual = [
			['united states', 'EEUU'],
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

	function fuzzyMyNorm(externalNorm) {
		if (!externalNorm) return null;
		if (myNormSet.has(externalNorm)) return externalNorm;
		const candidates = myNormList.filter(
			(m) => m === externalNorm || m.startsWith(`${externalNorm} (`) || m.startsWith(`${externalNorm} `)
		);
		if (candidates.length === 1) return candidates[0];
		return null;
	}

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

	/** -----------------------------
	 *  Widget 1 (Population densities) -> Highcharts Heatmap
	 *  Integración: score FIFA vs density (bins) para país-año comunes
	 *  ----------------------------- */
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
	 *  Widget 2 (Wine) -> ApexCharts Treemap (CDN)
	 *  Integración: rank/score FIFA vs precio medio vino por país-año
	 *  ----------------------------- */
	function buildWineIntegration(wineData) {
		// agregamos vino por país-año (precio medio, abv medio)
		const agg = new Map();
		for (const w of wineData) {
			if (!w?.country || w?.year == null) continue;
			const price = Number(w.price);
			const abv = Number(w.abv);
			if (!Number.isFinite(price)) continue;
			const cNorm = resolveExternalCountryNorm(w.country, w);
			if (!cNorm) continue;
			const k = `${cNorm}_${Number(w.year)}`;
			if (!agg.has(k)) agg.set(k, { sumPrice: 0, n: 0, sumAbv: 0, nAbv: 0, year: Number(w.year) });
			const a = agg.get(k);
			a.sumPrice += price;
			a.n += 1;
			if (Number.isFinite(abv)) {
				a.sumAbv += abv;
				a.nAbv += 1;
			}
		}

		const pairs = [];
		for (const [k, a] of agg.entries()) {
			const parts = k.split('_');
			const yearFromKey = Number(parts.at(-1));
			const cNorm = parts.length > 1 ? parts.slice(0, -1).join('_') : '';
			if (!cNorm || !Number.isFinite(yearFromKey)) continue;
			const year = a.year;
			const mine = getMyRowNearest(cNorm, year);
			if (!mine || !Number.isFinite(mine.rank) || !Number.isFinite(mine.score)) continue;
			pairs.push({
				rank: mine.rank,
				score: mine.score,
				country: mine.country,
				avgPrice: a.sumPrice / a.n,
				avgAbv: a.nAbv ? a.sumAbv / a.nAbv : null,
				wines: a.n,
				year: a.year
			});
		}

		const yearUsed = pickMostCommonYear(pairs);
		const filtered = yearUsed == null ? pairs : pairs.filter((p) => p.year === yearUsed);

		// treemap por país: tamaño = precio medio, color = rank (mejor rank => más verde)
		const byCountry = new Map();
		for (const p of filtered) {
			const c = normalizeCountry(p.country);
			// Si se repite país en el mismo año por nombres, agregamos media simple
			if (!byCountry.has(c)) byCountry.set(c, { label: p.country, prices: [], ranks: [], scores: [], wines: 0 });
			const b = byCountry.get(c);
			b.label = p.country;
			b.prices.push(p.avgPrice);
			b.ranks.push(p.rank);
			b.scores.push(p.score);
			b.wines += p.wines;
		}

		const series = [
			{
				data: [...byCountry.values()]
					.map((b) => ({
						x: b.label,
						y: Number(mean(b.prices).toFixed(2)),
						rank: Number(mean(b.ranks).toFixed(1)),
						score: Number(mean(b.scores).toFixed(0)),
						wines: b.wines
					}))
					.sort((a, b) => b.y - a.y)
					.slice(0, 25)
			}
		];

		return { pairsCount: pairs.length, yearUsed, series };
	}

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

	/** -----------------------------
	 *  Widget 3 (Pandemics) -> ECharts Boxplot
	 *  Integración: distribución de “carga” (suma enfermedades) por grupos de rank FIFA
	 *  ----------------------------- */
	function buildPandemicsIntegration(pandemicsData) {
		const nonCountryLabels = new Set(
			[
				'world',
				'oecd countries',
				'europe',
				'asia',
				'africa',
				'americas',
				'oceania',
				'high income',
				'low income',
				'middle income',
				'european union',
				'g20',
				'g7'
			].map((s) => normalizeCountry(s))
		);

		const diseaseKeys = [
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

		const pairs = [];
		for (const p of pandemicsData) {
			const entity = p?.entity ?? p?.country ?? p?.name;
			if (!entity || p?.year == null) continue;
			const cNorm = resolveExternalCountryNorm(entity, p);
			if (!cNorm) continue;
			if (nonCountryLabels.has(normalizeCountry(entity))) continue;
			const mine = getMyRowNearest(cNorm, p.year);
			if (!mine || !Number.isFinite(mine.rank)) continue;
			let total = 0;
			for (const dk of diseaseKeys) {
				const v = Number(p?.[dk] ?? 0);
				total += Number.isFinite(v) ? v : 0;
			}
			pairs.push({ ...mine, total, year: Number(p.year) });
		}

		// bucket por rank (top/mid/low)
		const buckets = {
			'Rank 1–30': [],
			'Rank 31–80': [],
			'Rank 81+': []
		};
		for (const it of pairs) {
			if (it.rank <= 30) buckets['Rank 1–30'].push(it.total);
			else if (it.rank <= 80) buckets['Rank 31–80'].push(it.total);
			else buckets['Rank 81+'].push(it.total);
		}

		const yearMin = pairs.length ? Math.min(...pairs.map((p) => p.year)) : null;
		const yearMax = pairs.length ? Math.max(...pairs.map((p) => p.year)) : null;
		return {
			pairsCount: pairs.length,
			yearRange: yearMin != null && yearMax != null ? `${yearMin}–${yearMax}` : '',
			buckets
		};
	}

	function quantile(sorted, q) {
		if (!sorted.length) return NaN;
		const pos = (sorted.length - 1) * q;
		const base = Math.floor(pos);
		const rest = pos - base;
		if (sorted[base + 1] === undefined) return sorted[base];
		return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
	}

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

	function initEChartsBoxplot(containerId, buckets) {
		const el = document.getElementById(containerId);
		if (!el) return;
		if (!window.echarts) {
			el.innerHTML = '<div class="status">ECharts todavía no cargó.</div>';
			return;
		}

		const categories = Object.keys(buckets);
		const boxData = categories.map((k) => {
			const st = toBoxStats(buckets[k]);
			return st ? [st.low, st.q1, st.q2, st.q3, st.high] : [0, 0, 0, 0, 0];
		});

		const hasAny = categories.some((k) => (buckets[k] || []).length > 0);
		if (!hasAny) {
			el.innerHTML = '<div class="status">No hay cruces país-año suficientes.</div>';
			return;
		}

		const chart = window.echarts.init(el);
		chart.setOption({
			title: {
				text: 'Pandemias (suma) vs grupos de ranking FIFA',
				subtext: 'Boxplot: min “sin outliers”, Q1, mediana, Q3, max “sin outliers”',
				left: 'center'
			},
			tooltip: { trigger: 'item' },
			grid: { left: '8%', right: '5%', top: '18%', bottom: '12%' },
			xAxis: { type: 'category', data: categories, name: 'Grupo por rank FIFA' },
			yAxis: { type: 'value', name: 'Suma de enfermedades (0/1 por enfermedad)' },
			series: [
				{
					name: 'Distribución',
					type: 'boxplot',
					data: boxData,
					itemStyle: { color: '#6366f1', borderColor: '#312e81' }
				}
			]
		});
		const ro = new ResizeObserver(() => chart.resize());
		ro.observe(el);
	}

	/** -----------------------------
	 *  Widget 4 (Meteorites) -> Google Charts BubbleChart (CDN)
	 *  Integración: score FIFA vs masa media meteoritos por país-año, tamaño=conteo
	 *  ----------------------------- */
	function buildMeteoritesIntegration(meteoritesData) {
		const agg = new Map(); // key countryNorm-year -> {count,sumMass,year,cNorm}
		for (const m of meteoritesData) {
			const country = m?.country;
			if (!country || country.toLowerCase() === 'unknown' || m?.year == null) continue;
			const year = Number(m.year);
			const mass = Number(m.mass);
			if (!Number.isFinite(year) || !Number.isFinite(mass)) continue;
			const cNorm = resolveExternalCountryNorm(country, m);
			if (!cNorm) continue;
			const k = `${cNorm}_${year}`;
			if (!agg.has(k)) agg.set(k, { count: 0, sumMass: 0, year, cNorm });
			const a = agg.get(k);
			a.count += 1;
			a.sumMass += mass;
		}

		const pairs = [];
		for (const [k, a] of agg.entries()) {
			const parts = k.split('_');
			const yearFromKey = Number(parts.at(-1));
			const cNorm = parts.length > 1 ? parts.slice(0, -1).join('_') : '';
			if (!cNorm || !Number.isFinite(yearFromKey)) continue;
			const mine = getMyRowNearest(cNorm, a.year);
			if (!mine || !Number.isFinite(mine.score)) continue;
			pairs.push({
				country: mine.country,
				year: a.year,
				score: mine.score,
				count: a.count,
				avgMass: a.sumMass / a.count
			});
		}

		const yearUsed = pickMostCommonYear(pairs);
		const filtered = yearUsed == null ? pairs : pairs.filter((p) => p.year === yearUsed);

		// reducimos a top 30 por count para legibilidad
		const rows = filtered
			.sort((a, b) => b.count - a.count)
			.slice(0, 30)
			.map((p) => [p.country, p.avgMass, p.score, p.count, `${p.country} (${p.count})`]);

		return { pairsCount: pairs.length, yearUsed, rows };
	}

	function initGoogleBubble(containerId, rows, yearUsed) {
		const el = document.getElementById(containerId);
		if (!el) return;
		if (!window.google?.charts) {
			el.innerHTML = '<div class="status">Google Charts todavía no cargó.</div>';
			return;
		}
		if (!rows?.length) {
			el.innerHTML = '<div class="status">No hay cruces país-año suficientes.</div>';
			return;
		}

		window.google.charts.load('current', { packages: ['corechart'] });
		window.google.charts.setOnLoadCallback(() => {
			const data = new window.google.visualization.DataTable();
			data.addColumn('string', 'País');
			data.addColumn('number', 'Masa media meteoritos');
			data.addColumn('number', 'Score FIFA');
			data.addColumn('number', 'Conteo meteoritos');
			data.addColumn('string', 'Etiqueta');
			data.addRows(rows);

			const options = {
				title: `Score FIFA vs masa media de meteoritos${yearUsed ? ` (año ${yearUsed})` : ''}`,
				hAxis: { title: 'Masa media meteoritos (g)', logScale: true },
				vAxis: { title: 'Score FIFA' },
				bubble: { textStyle: { fontSize: 11 } },
				legend: { position: 'none' },
				chartArea: { left: '10%', top: '12%', width: '80%', height: '70%' }
			};

			const chart = new window.google.visualization.BubbleChart(el);
			chart.draw(data, options);
		});
	}

	/** -----------------------------
	 *  Widget 5 (Drinking water) -> c3.js Gauge (CDN)
	 *  Integración: correlación Pearson entre Score FIFA y log(pob. urbana con agua)
	 *  ----------------------------- */
	function buildWaterCorrelation(waterData) {
		const pairs = [];
		for (const w of waterData) {
			const entity = w?.entity ?? w?.country;
			if (!entity || w?.year == null) continue;
			const value = Number(w.wat_bas_pop_residence_urban);
			if (!Number.isFinite(value) || value <= 0) continue;
			const cNorm = resolveExternalCountryNorm(entity, w);
			if (!cNorm) continue;
			const mine = getMyRowNearest(cNorm, w.year);
			if (!mine || !Number.isFinite(mine.score)) continue;
			pairs.push({ score: mine.score, water: value, year: Number(w.year), country: mine.country });
		}

		const yearUsed = pickMostCommonYear(pairs);
		const filtered = yearUsed == null ? pairs : pairs.filter((p) => p.year === yearUsed);

		const xs = filtered.map((p) => p.score);
		const ys = filtered.map((p) => Math.log10(p.water)); // estabiliza escala (estadística pura)
		const r = pearson(xs, ys);

		return { pairsCount: pairs.length, yearUsed, r };
	}

	function initC3Gauge(containerId, r) {
		const el = document.getElementById(containerId);
		if (!el) return;
		if (!window.c3) {
			el.innerHTML = '<div class="status">c3.js todavía no cargó.</div>';
			return;
		}
		if (!Number.isFinite(r)) {
			el.innerHTML = '<div class="status">No hay cruces suficientes para calcular correlación.</div>';
			return;
		}

		// c3 gauge trabaja “cómodo” en 0..100
		const gaugeValue = ((r + 1) / 2) * 100;
		el.innerHTML = '';
		window.c3.generate({
			bindto: `#${containerId}`,
			data: {
				columns: [['Correlación (Pearson)', Number(gaugeValue.toFixed(2))]],
				type: 'gauge'
			},
			gauge: {
				label: {
					format: function (value) {
						return `r = ${r.toFixed(3)}`;
					}
				},
				min: 0,
				max: 100
			},
			color: {
				pattern: ['#dc2626', '#f59e0b', '#16a34a'],
				threshold: { values: [35, 65, 100] }
			},
			size: { height: 300 }
		});
	}

	/** -----------------------------
	 *  Main onMount
	 *  ----------------------------- */
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

			// ECharts en window para evitar SSR issues (pero viene como dep)
			// eslint-disable-next-line no-undef
			const echarts = await import('echarts');
			window.echarts = echarts;

			const [myRaw, popRaw, wineRaw, pandemicsRaw, meteoritesRaw, waterRaw] = await Promise.all([
				loadDataset(MY_API_URL),
				loadDataset(POP_DENSITIES_API),
				loadDataset(WINE_API),
				loadDataset(PANDEMICS_API),
				loadDataset(METEORITES_API),
				loadDataset(WATER_API)
			]);

			const myData = Array.isArray(myRaw) ? myRaw : myRaw?.data || [];
			const popData = Array.isArray(popRaw) ? popRaw : popRaw?.data || [];
			const wineData = Array.isArray(wineRaw) ? wineRaw : wineRaw?.data || [];
			const pandemicsData = Array.isArray(pandemicsRaw) ? pandemicsRaw : pandemicsRaw?.data || [];
			const meteoritesData = Array.isArray(meteoritesRaw) ? meteoritesRaw : meteoritesRaw?.data || [];
			const waterData = Array.isArray(waterRaw) ? waterRaw : waterRaw?.data || [];

			indexMyRankings(myData);
			rebuildCountryNameBridge();

			// Widget 1
			const popPairs = buildScoreDensityPairs(popData);
			const popYears = popPairs.map((p) => p.year);
			stats.pop.commonPairs = popPairs.length;
			stats.pop.yearRange = popYears.length ? `${Math.min(...popYears)}–${Math.max(...popYears)}` : '';
			initHighchartsHeatmap('mgn-chart-pop-heatmap', popPairs);

			// Widget 2
			const wine = buildWineIntegration(wineData);
			stats.wine.commonPairs = wine.pairsCount;
			stats.wine.yearUsed = wine.yearUsed ? String(wine.yearUsed) : '';
			initApexTreemap('mgn-chart-wine-treemap', wine.series, wine.yearUsed);

			// Widget 3
			const pan = buildPandemicsIntegration(pandemicsData);
			stats.pandemics.commonPairs = pan.pairsCount;
			stats.pandemics.yearRange = pan.yearRange;
			initEChartsBoxplot('mgn-chart-pandemics-boxplot', pan.buckets);

			// Widget 4
			const met = buildMeteoritesIntegration(meteoritesData);
			stats.meteorites.commonPairs = met.pairsCount;
			stats.meteorites.yearUsed = met.yearUsed ? String(met.yearUsed) : '';
			initGoogleBubble('mgn-chart-meteorites-bubble', met.rows, met.yearUsed);

			// Widget 5
			const water = buildWaterCorrelation(waterData);
			stats.water.commonPairs = water.pairsCount;
			stats.water.yearUsed = water.yearUsed ? String(water.yearUsed) : '';
			initC3Gauge('mgn-chart-water-gauge', water.r);
		} catch (e) {
			console.error(e);
			errorMessage = e?.message || 'Error cargando integraciones';
		} finally {
			loading = false;
		}
	});
</script>

<svelte:head>
	<!-- CDNs usados solo en esta página (como hacen tus compañeros) -->
	<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/c3/c3.min.css" />
	<script src="https://cdn.jsdelivr.net/npm/d3@5/dist/d3.min.js"></script>
	<script src="https://cdn.jsdelivr.net/npm/c3/c3.min.js"></script>

	<script src="https://cdn.jsdelivr.net/npm/apexcharts"></script>
	<script src="https://www.gstatic.com/charts/loader.js"></script>
</svelte:head>

<main class="page">
	<h1>Integraciones MGN (estadística + 5 APIs externas)</h1>

	{#if loading}
		<div class="status">Cargando datasets y calculando integraciones...</div>
	{:else if errorMessage}
		<div class="error">{errorMessage}</div>
	{/if}

	<section class:hidden={loading || errorMessage} class="card">
		<h2>1) Densidad de población vs Score FIFA (Highcharts + Heatmap)</h2>
		<p class="desc">
			Integración por <b>país</b> alineando nombres (ES/EN + ISO cuando existe) y por <b>año</b> (match exacto
			o el más cercano dentro de tu serie). Construyo pares <b>(score, densidad)</b> y los discretizo en bins
			para pintar una <b>heatmap</b> de frecuencias.
		</p>
		<p class="meta">Cruces: {stats.pop.commonPairs} · Rango años: {stats.pop.yearRange}</p>
		<div id="mgn-chart-pop-heatmap" class="chart"></div>
	</section>

	<section class:hidden={loading || errorMessage} class="card">
		<h2>2) Ranking FIFA vs precio medio de vino (ApexCharts + Treemap)</h2>
		<p class="desc">
			Agrego la API de vino a <b>precio medio por país+año</b> (y nº de vinos) y lo cruzo con tu
			<b>rank/score</b> usando el mismo alineado de país/año. La <b>treemap</b> muestra tamaño por precio medio
			y color por rango de ranking.
		</p>
		<p class="meta">Cruces: {stats.wine.commonPairs} · Año usado: {stats.wine.yearUsed}</p>
		<div id="mgn-chart-wine-treemap" class="chart"></div>
	</section>

	<section class:hidden={loading || errorMessage} class="card">
		<h2>3) “Carga” de pandemias vs grupos de ranking (ECharts + Boxplot)</h2>
		<p class="desc">
			Cruce por <b>país</b> (ISO + traducción EN→ES cuando hace falta) y <b>año</b> (exacto o cercano). Para cada
			registro sumo los indicadores por enfermedad (la API devuelve magnitudes; aquí la suma sirve como “carga”
			agregada) y agrupo por ranking FIFA (1–30, 31–80, 81+). El <b>boxplot</b> muestra dispersión entre países.
		</p>
		<p class="meta">Cruces: {stats.pandemics.commonPairs} · Rango años: {stats.pandemics.yearRange}</p>
		<div id="mgn-chart-pandemics-boxplot" class="chart"></div>
	</section>

	<section class:hidden={loading || errorMessage} class="card">
		<h2>4) Score FIFA vs meteoritos (Google Charts + BubbleChart)</h2>
		<p class="desc">
			Agrego meteoritos por <b>país+año</b>: conteo y masa media, alineando país (EN/ES) y año (exacto o cercano).
			Cruzo con tu <b>score</b> y pinto una <b>bubble chart</b> (x=masa media, y=score, tamaño=conteo).
		</p>
		<p class="meta">Cruces: {stats.meteorites.commonPairs} · Año usado: {stats.meteorites.yearUsed}</p>
		<div id="mgn-chart-meteorites-bubble" class="chart"></div>
	</section>

	<section class:hidden={loading || errorMessage} class="card">
		<h2>5) Correlación score vs agua urbana (c3.js + Gauge)</h2>
		<p class="desc">
			Cruce por <b>país</b> (traducción + ISO) y <b>año</b> (exacto o cercano). Calculo la
			<b>correlación de Pearson</b> entre score FIFA y <b>log10(población urbana con agua)</b> para el año con
			más cruces. Se muestra en un <b>gauge</b>.
		</p>
		<p class="meta">Cruces: {stats.water.commonPairs} · Año usado: {stats.water.yearUsed}</p>
		<div id="mgn-chart-water-gauge" class="chart gauge"></div>
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

	.meta {
		margin: 0 0 12px;
		color: #64748b;
		font-size: 0.95rem;
	}

	.chart {
		width: 100%;
		min-height: 520px;
	}

	.gauge {
		min-height: 320px;
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

	.hidden {
		display: none;
	}

	:global(.apex-tooltip) {
		padding: 10px 12px;
	}
</style>
