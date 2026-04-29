<script>
	// @ts-nocheck
	import { onMount } from 'svelte';

	let chartContainer;

	// INTEGRACIONES CON APIS DE OTROS COMPAÑEROS

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
						axis: { max: 115 },
						level: { depth: 4 },
						direction: { clockwise: true }
					},
					color: { pattern: ['#1f77b4', '#ff7f0e', '#2ca02c'] },
					tooltip: { format: { value: (v) => v.toFixed(1) + '% del máximo' } },
					bindto: '#chart-radar-spice'
				});
			}
		} catch (error) {
			console.error('Error en Spice Integration:', error);
		}
	}

	async function loadWaterIntegration() {
		try {
			const resIDH = await fetch('/api/v2/countries-idh-per-years');
			const myData = await resIDH.json();
			const resWater = await fetch(
				'https://sos2526-27.onrender.com/api/v1/drinking-water-services'
			);
			const peerData = await resWater.json();

			const idhByYear = myData.reduce((acc, curr) => {
				const y = parseInt(curr.year);
				if (!acc[y]) acc[y] = { sum: 0, count: 0 };
				acc[y].sum += parseFloat(curr.hdi_value) || 0;
				acc[y].count += 1;
				return acc;
			}, {});

			const waterByYear = peerData.reduce((acc, curr) => {
				const y = parseInt(curr.year);
				if (!acc[y]) acc[y] = { sum: 0, count: 0 };
				acc[y].sum += parseFloat(curr.wat_bas_pop_residence_urban) || 0;
				acc[y].count += 1;
				return acc;
			}, {});

			const scatterX = ['IDH'];
			const scatterY = ['Población Agua Urbana'];

			// Creamos un objeto para guardar la relación IDH -> Año
			const idhToYearMap = {};

			const commonYears = Object.keys(idhByYear).filter((y) => waterByYear[y]);

			commonYears.forEach((year) => {
				const avgIDH = idhByYear[year].sum / idhByYear[year].count;
				const avgWater = waterByYear[year].sum / waterByYear[year].count;

				if (avgWater > 0) {
					// Redondeamos a 3 decimales para asegurar que la búsqueda coincida
					const idhKey = avgIDH.toFixed(3);
					scatterX.push(avgIDH);
					scatterY.push(avgWater);

					// Guardamos: "Para este IDH, el año es tal"
					idhToYearMap[idhKey] = year;
				}
			});

			if (scatterX.length > 1) {
				bb.generate({
					data: {
						xs: { 'Población Agua Urbana': 'IDH' },
						columns: [scatterX, scatterY],
						type: 'scatter'
					},
					tooltip: {
						format: {
							// Aquí está el truco: buscamos en nuestro mapa usando el valor X
							title: (x) => 'Año seleccionado: ' + (idhToYearMap[x.toFixed(3)] || 'Desconocido')
						}
					},
					axis: {
						x: {
							label: 'IDH Promedio Anual',
							tick: { fit: false, format: (v) => v.toFixed(3) },
							padding: { left: 0.05, right: 0.05 }
						},
						y: {
							label: 'Media Acceso Agua Urbana',
							tick: {
								format: (v) => (v >= 1000000 ? (v / 1000000).toFixed(1) + 'M' : v)
							}
						}
					},
					grid: { x: { show: true }, y: { show: true } },
					point: { r: 8 },
					color: { pattern: ['#af4bce'] },
					bindto: '#chart-water-integration'
				});
			}
		} catch (error) {
			console.error('Error en la integración de Agua:', error);
		}
	}

	async function loadDisasterIntegration() {
		if (typeof google === 'undefined') {
			setTimeout(loadDisasterIntegration, 500);
			return;
		}

		try {
			const resIDH = await fetch('/api/v2/countries-idh-per-years');
			const myData = await resIDH.json();
			const resDisasters = await fetch('https://sos2526-29.onrender.com/api/v2/natural-disasters');
			const peerData = await resDisasters.json();

			// @ts-ignore
			google.charts.load('current', { packages: ['geochart'] });

			// @ts-ignore
			google.charts.setOnLoadCallback(() => {
				const chartData = [['País', 'Daño Económico Promedio (USD)']];

				// TRADUCTOR: Relaciona TUS nombres con los de la API de TUS COMPAÑEROS
				const countryMapper = {
					españa: 'spain',
					francia: 'france',
					japón: 'japan',
					china: 'china',
					india: 'india',
					'estados-unidos': 'united states',
					afganistán: 'afghanistan',
					italia: 'italy',
					alemania: 'germany'
				};

				const myCountries = [...new Set(myData.map((d) => d.country.toLowerCase().trim()))];

				myCountries.forEach((myCountry) => {
					const peerName = countryMapper[myCountry] || myCountry;

					const peerEntries = peerData.filter((p) => p.country.toLowerCase().trim() === peerName);

					if (peerEntries.length > 0) {
						const avgDamage =
							peerEntries.reduce((s, c) => s + (parseFloat(c.economic_damage_usd) || 0), 0) /
							peerEntries.length;

						// Extraemos los años únicos y los juntamos (ej: "2024" o "1990, 2010")
						const years = [...new Set(peerEntries.map((p) => p.year))].join(', ');

						// CAPITALIZAMOS el nombre para que Google lo reconozca bien
						const cleanName = peerName.charAt(0).toUpperCase() + peerName.slice(1);

						// USAMOS UN OBJETO DE VALOR FORMATEADO:
						// v: es el ID interno que Google usa para pintar (Spain)
						// f: es lo que el usuario ve en el cuadro de texto (Spain (Año: 2024))
						chartData.push([{ v: cleanName, f: `${cleanName} (Años: ${years})` }, avgDamage]);
					}
				});

				console.log('Países cruzados con éxito:', chartData.length - 1);

				if (chartData.length > 1) {
					// @ts-ignore
					const dataTable = google.visualization.arrayToDataTable(chartData);
					const options = {
						colorAxis: { colors: ['#ffecb3', '#ffa000', '#e65100'] },
						backgroundColor: '#f4f7f6',
						datalessRegionColor: '#e0e0e0', // Gris para países sin datos
						defaultColor: '#f5f5f5'
					};
					// @ts-ignore
					const chart = new google.visualization.GeoChart(
						document.getElementById('chart-map-disasters')
					);
					chart.draw(dataTable, options);
				} else {
					console.warn(
						'No se han encontrado coincidencias. Revisa los nombres de los países en la consola.'
					);
				}
			});
		} catch (error) {
			console.error('Error en el mapa:', error);
		}
	}

	async function loadFertilityIntegration() {
		try {
			const resIDH = await fetch('/api/v2/countries-idh-per-years');
			const myData = await resIDH.json();
			const resFert = await fetch(
				'https://sos2526-12.onrender.com/api/v2/age-specific-fertility-rates'
			);
			const peerData = await resFert.json();

			const seriesData = [];
			const countries = [...new Set(peerData.map((p) => p.country_name))];

			countries.forEach((cName) => {
				// 1. Normalización básica: todo a minúsculas y sin espacios extra
				const normalizedName = cName.toLowerCase().trim();

				// 2. Buscamos el IDH comparando de forma normalizada
				const idhEntry = myData.find((d) => d.country.toLowerCase().trim() === normalizedName);

				// 3. FILTRADO ESTRICTO: Si no hay coincidencia exacta, se ignora el país
				if (!idhEntry) {
					return;
				}

				// 4. Si hay coincidencia, procesamos los datos de fertilidad
				const fertEntries = peerData.filter((p) => p.country_name === cName);

				if (fertEntries.length > 0) {
					const latest = fertEntries[fertEntries.length - 1];
					seriesData.push({
						name: `${cName} (IDH: ${idhEntry.hdi_value})`,
						data: [
							{ name: 'Fertilidad 15-19', value: parseFloat(latest.fert_15_19) },
							{ name: 'Fertilidad 20-24', value: parseFloat(latest.fert_20_24) }
						]
					});
				}
			});

			// @ts-ignore
			Highcharts.chart('chart-fertility-bubbles', {
				chart: {
					type: 'packedbubble',
					height: '600px',
					backgroundColor: 'transparent'
				},
				title: { text: '' },
				tooltip: {
					useHTML: true,
					pointFormat: '<b>{point.name}:</b> {point.value}'
				},
				plotOptions: {
					packedbubble: {
						minSize: '30%',
						maxSize: '120%',
						layoutAlgorithm: {
							splitSeries: true,
							gravitationalConstant: 0.02,
							friction: 0.8
						},
						dataLabels: {
							enabled: true,
							format: '{point.name}',
							style: { color: '#333', textOutline: 'none', fontWeight: 'normal' }
						}
					}
				},
				series: seriesData
			});
		} catch (error) {
			console.error('Error en Fertilidad:', error);
		}
	}

	// INTEGRACIONES CON APIS EXTERNAS
	async function loadEducationIntegration() {
		try {
			const normalizeCountry = (value = '') =>
				value
					.toString()
					.toLowerCase()
					.normalize('NFD')
					.replace(/[\u0300-\u036f]/g, '')
					.replace(/[^a-z0-9]/g, '');

			// 1. Obtener datos internos de IDH
			const resIDH = await fetch('/api/v2/countries-idh-per-years');
			const myData = await resIDH.json();

			// 2. Obtener datos externos usando el proxy propio
			const resExt = await fetch('/api/v1/proxy/education-spending');
			const response = await resExt.json();
			const externalData = Array.isArray(response?.[1]) ? response[1] : [];

			// Relación país interno -> alias de nombre y código ISO3 del Banco Mundial.
			const countryMap = {
				espana: { name: 'spain', iso3: 'ESP' },
				estadosunidos: { name: 'unitedstates', iso3: 'USA' },
				china: { name: 'china', iso3: 'CHN' },
				francia: { name: 'france', iso3: 'FRA' },
				japon: { name: 'japan', iso3: 'JPN' },
				india: { name: 'india', iso3: 'IND' },
				noruega: { name: 'norway', iso3: 'NOR' },
				brasil: { name: 'brazil', iso3: 'BRA' },
				nigeria: { name: 'nigeria', iso3: 'NGA' },
				australia: { name: 'australia', iso3: 'AUS' }
			};

			// 3. Indexar API externa por clave pais+año para cruce O(1)
			const externalByCountryYear = new Map();
			const externalByCountry = new Map();
			externalData.forEach((ext) => {
				const extCountry = normalizeCountry(ext?.country?.value);
				const extIso3 = String(ext?.countryiso3code ?? '')
					.trim()
					.toUpperCase();
				const extYear = String(ext?.date ?? '').trim();
				const extYearNum = parseInt(extYear, 10);
				const extValue = parseFloat(ext?.value);

				if (!extCountry || !extYear || Number.isNaN(extValue)) return;
				externalByCountryYear.set(`${extCountry}_${extYear}`, extValue);
				if (extIso3) externalByCountryYear.set(`${extIso3}_${extYear}`, extValue);

				if (!externalByCountry.has(extCountry)) externalByCountry.set(extCountry, []);
				externalByCountry.get(extCountry).push({ year: extYearNum, value: extValue });
				if (extIso3) {
					if (!externalByCountry.has(extIso3)) externalByCountry.set(extIso3, []);
					externalByCountry.get(extIso3).push({ year: extYearNum, value: extValue });
				}
			});

			externalByCountry.forEach((items) => {
				items.sort((a, b) => a.year - b.year);
			});

			// 4. Cruce de datos internos con externos
			const finalData = [];
			myData.forEach((myEntry) => {
				const myCountry = normalizeCountry(myEntry?.country);
				const mapping = countryMap[myCountry] || {};
				const targetCountryByName = mapping.name || myCountry;
				const targetCountryByIso3 = mapping.iso3 || '';
				const myYear = parseInt(String(myEntry?.year).trim(), 10);
				const yearText = String(myEntry?.year).trim();
				const keyByName = `${targetCountryByName}_${yearText}`;
				const keyByIso3 = targetCountryByIso3 ? `${targetCountryByIso3}_${yearText}` : '';

				let educationValue =
					externalByCountryYear.get(keyByIso3) ?? externalByCountryYear.get(keyByName);
				let educationYear = myYear;

				// Fallback: si no hay ese año exacto, buscar por país el año más cercano con dato.
				if (educationValue === undefined) {
					const candidates =
						externalByCountry.get(targetCountryByIso3) ||
						externalByCountry.get(targetCountryByName);
					if (!candidates || candidates.length === 0) return;

					const nearest = candidates.reduce((best, current) => {
						if (!best) return current;
						const bestDiff = Math.abs(best.year - myYear);
						const currDiff = Math.abs(current.year - myYear);
						return currDiff < bestDiff ? current : best;
					}, null);
					if (nearest) {
						educationValue = nearest.value;
						educationYear = nearest.year;
					}
				}
				const idh = parseFloat(myEntry?.hdi_value);

				if (educationValue !== undefined && !Number.isNaN(idh)) {
					finalData.push({
						countryLabel: `${myEntry.country} (IDH ${myEntry.year} / Edu ${educationYear})`,
						idh,
						education: educationValue
					});
				}
			});

			finalData.sort((a, b) => a.idh - b.idh);
			console.info(
				`[education-integration] registros internos: ${myData.length}, externos validos: ${externalByCountryYear.size}, cruces: ${finalData.length}`
			);

			if (finalData.length > 0) {
				const options = {
					series: [
						{ name: 'Valor IDH', data: finalData.map((d) => d.idh) },
						{ name: 'Inversión Educación (% PIB)', data: finalData.map((d) => d.education) }
					],
					chart: {
						type: 'area',
						height: 450,
						toolbar: { show: true }
					},
					dataLabels: { enabled: false },
					stroke: { curve: 'smooth' },
					xaxis: {
						categories: finalData.map((d) => d.countryLabel),
						labels: { rotate: -45, style: { fontSize: '10px' } }
					},
					yaxis: {
						labels: {
							formatter: function (value) {
								return value.toFixed(2); // Esto dejará solo 2 decimales
							}
						},
						title: { text: 'Valor / Porcentaje' }
					},
					colors: ['#00E396', '#FF4560'],
					fill: {
						type: 'gradient',
						gradient: { shadeIntensity: 1, opacityFrom: 0.7, opacityTo: 0.3 }
					}
				};

				const educationContainer = document.querySelector('#chart-education');
				if (educationContainer) {
					educationContainer.innerHTML = '';
					const chart = new ApexCharts(educationContainer, options);
					chart.render();
				}
			} else {
				console.error('No se han podido cruzar los datos. Revisa país/año del proxy en consola.');
			}
		} catch (error) {
			console.error('Error cargando la integración de educación:', error);
		}
	}

	async function loadWeatherDonut() {
		try {
			// LLAMADA DIRECTA (Sin Proxy porque la API permite CORS)
			const response = await fetch(
				'https://api.open-meteo.com/v1/forecast?latitude=37.3828&longitude=-5.9731&current_weather=true'
			);
			const data = await response.json();
			const temp = data.current_weather.temperature;
			const wind = data.current_weather.windspeed;

			// Combinación Nueva: Billboard.js + Donut Chart
			bb.generate({
				data: {
					columns: [
						['Temperatura (ºC)', temp],
						['Viento (km/h)', wind]
					],
					type: 'donut', // Tipo de gráfica no repetido en Billboard
					onclick: function (d, i) {
						console.log('onclick', d, i);
					},
					onover: function (d, i) {
						console.log('onover', d, i);
					},
					onout: function (d, i) {
						console.log('onout', d, i);
					}
				},
				donut: {
					title: 'Clima en Sevilla'
				},
				bindto: '#chart-weather-donut'
			});
		} catch (error) {
			console.error('Error cargando la API de clima directa:', error);
		}
	}

	let countriesChartLoaded = false;
	async function loadCountriesPie() {
		try {
			const response = await fetch('https://restcountries.com/v3.1/all?fields=region');
			if (!response.ok) throw new Error('Error API');
			const countries = await response.json();

			// 1. Calculamos el total para sacar nosotros el porcentaje
			const totalCountries = countries.length;
			const stats = {};
			countries.forEach((c) => {
				const region = c.region || 'Otros';
				stats[region] = (stats[region] || 0) + 1;
			});

			// 2. Metemos el % en el texto de la etiqueta
			const dataForChart = [['Región', 'Nº de Países']];
			for (let region in stats) {
				const percentage = ((stats[region] / totalCountries) * 100).toFixed(1);
				// Esto hace que la etiqueta sea: "Europe (21.2%)"
				dataForChart.push([`${region} (${percentage}%)`, stats[region]]);
			}

			google.charts.load('current', { packages: ['corechart'] });
			google.charts.setOnLoadCallback(() => {
				const data = google.visualization.arrayToDataTable(dataForChart);

				const options = {
					title: 'Distribución Global de Países por Continente',
					is3D: false, // El 3D es el que causa el parpadeo en navegadores modernos
					pieSliceText: 'none', // Quitamos el texto de dentro para evitar que unos se vean y otros no
					sliceVisibilityThreshold: 0,
					legend: {
						position: 'labeled', // Esto saca las líneas hacia afuera
						textStyle: { fontSize: 11 }
					},
					// Damos más margen a los lados (80%) para que las etiquetas no se corten
					chartArea: { left: '10%', width: '80%', height: '80%' },
					tooltip: { trigger: 'focus' },
					// Colores limpios
					colors: ['#3366cc', '#dc3912', '#ff9900', '#109618', '#990099', '#0099c6']
				};

				const chart = new google.visualization.PieChart(
					document.getElementById('chart-countries-pie')
				);
				chart.draw(data, options);
			});
		} catch (error) {
			console.error('Error:', error);
		}
	}

	onMount(() => {
		loadSpaceIntegration();
		loadSpiceIntegration();
		loadWaterIntegration();
		loadDisasterIntegration();
		loadFertilityIntegration();
		loadEducationIntegration();
		loadWeatherDonut();
		loadCountriesPie();
	});
</script>

<svelte:head>
	<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/billboard.js/dist/billboard.min.css" />

	<script src="https://cdn.jsdelivr.net/npm/d3/dist/d3.min.js"></script>
	<script src="https://cdn.jsdelivr.net/npm/billboard.js/dist/billboard.min.js"></script>
	<script src="https://cdn.jsdelivr.net/npm/apexcharts"></script>
	<script src="https://www.gstatic.com/charts/loader.js"></script>

	<script src="https://code.highcharts.com/highcharts.js"></script>
	<script src="https://code.highcharts.com/highcharts-more.js"></script>
	<script src="https://code.highcharts.com/modules/exporting.js"></script>
</svelte:head>

<main>
	<h2 class="chart-main-title">Visualización de Datos</h2>

	<section class="chart-section">
		<h3 class="chart-subtitle">
			Integración: IDH vs Lanzamientos Globales por Año (Highchart + Bar)
		</h3>
		<div id="chart-integration-space" bind:this={chartContainer}></div>
	</section>

	<section class="chart-section">
		<h3 class="chart-subtitle">Integración: IDH vs Especias (Billboard + Radar)</h3>
		<div id="chart-radar-spice"></div>
	</section>

	<section class="chart-section">
		<h3 class="chart-subtitle">Integración: IDH vs Acceso a Agua Urbana (Billboard + Scatter)</h3>
		<div id="chart-water-integration"></div>
	</section>

	<section class="chart-section">
		<h3 class="chart-subtitle">
			Integración: IDH vs Daños por desastres naturales (Google Charts + GeoChart)
		</h3>
		<div id="chart-map-disasters"></div>
	</section>

	<section class="chart-section">
		<h3 class="chart-subtitle">Integración: IDH vs Fertilidad (Highcharts + Packed Bubble)</h3>
		<div id="chart-fertility-bubbles"></div>
	</section>

	<section class="chart-section">
		<h3 class="chart-subtitle">Integración: IDH vs Educacion (ApexCharts + Area Chart)</h3>
		<div id="chart-education"></div>
	</section>

	<section class="chart-section">
		<h3 class="chart-subtitle">Uso: Clima en Sevilla(Billboard + Donut Chart)</h3>
		<div id="chart-weather-donut"></div>
	</section>

	<section class="chart-section">
		<h3 class="chart-subtitle">
			Uso: Distribución de países por continentes(Google charts + Pie Chart)
		</h3>
		<div id="chart-countries-pie"></div>
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
