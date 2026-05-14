<script>
	// @ts-nocheck

	/*
	 * Pagina de integraciones de Sergio Diaz Vazquez (SDV).
	 *
	 * Esta vista cruza el recurso propio "countries-idh-per-years" (Indice
	 * de Desarrollo Humano) con las APIs de otros companeros y con APIs
	 * publicas externas, generando 8 visualizaciones distintas:
	 *
	 *   INTEGRACIONES CON COMPANEROS (cruce de datos por anyo o por pais)
	 *     1. IDH vs Lanzamientos espaciales      (ApexCharts, barras)
	 *     2. IDH vs Estadisticas de especias     (Billboard.js, radar)
	 *     3. IDH vs Acceso a agua urbana         (Billboard.js, scatter)
	 *     4. IDH vs Danyos por desastres         (Google Charts, GeoChart)
	 *     5. IDH vs Distribucion por edades      (Highcharts, packed bubble)
	 *
	 *   INTEGRACION CON API EXTERNA (a traves del proxy del backend)
	 *     6. IDH vs Inversion en educacion       (ApexCharts, area)
	 *
	 *   USOS DIRECTOS DE APIs EXTERNAS (sin cruce con datos propios)
	 *     7. Clima actual en Sevilla             (Billboard.js, donut)
	 *     8. Distribucion de paises por region   (Google Charts, pie)
	 *
	 * Cada funcion load*() es autonoma: pide datos, los procesa y dibuja
	 * la grafica en su contenedor. Si una API externa falla, solo cae esa
	 * grafica: las demas siguen renderizando.
	 */

	import { onMount } from 'svelte';

	let chartContainer;

	/* Estado reactivo del proceso de "siembra" (loadInitialData):
	 *   - isSeeding:   true mientras estamos pidiendo /loadInitialData a las APIs.
	 *   - seedSummary: texto resumen (cuantas APIs respondieron OK / con error)
	 *                  que mostramos al usuario cuando termina el proceso. */
	let isSeeding = $state(true);
	let seedSummary = $state('');

	/* ============================================================
	 *   APIS QUE NECESITAN DATOS INICIALES (loadInitialData)
	 * ============================================================
	 *
	 * Cada integrante de la asignatura SOS expone en su API un endpoint
	 * /loadInitialData que crea (si no existen) los registros base de su
	 * recurso. Antes habia que llamar a cada uno MANUALMENTE desde Postman
	 * o el navegador para que las graficas tuvieran datos.
	 *
	 * Este array centraliza todas las APIs que usa esta pagina, incluida
	 * la mia (SDV), para poder dispararlas todas al cargar la ruta.
	 *
	 * IMPORTANTE: si alguna API esta caida o tarda mucho, no debe bloquear
	 * al resto. Por eso lanzamos las llamadas con Promise.allSettled. */
	const peerApis = [
		{
			name: 'SDV - countries-idh-per-years (propia)',
			url: '/api/v2/countries-idh-per-years/loadInitialData'
		},
		{
			name: 'Lanzamientos espaciales',
			url: 'https://space-launches-8cix.onrender.com/api/v2/space-launches/loadInitialData'
		},
		{
			name: 'Estadisticas de especias',
			url: 'https://sos2526-20.onrender.com/api/v2/spice-stats/loadInitialData'
		},
		{
			name: 'Acceso a agua urbana',
			url: 'https://sos2526-27.onrender.com/api/v1/drinking-water-services/loadInitialData'
		},
		{
			name: 'Desastres naturales',
			url: 'https://sos2526-29.onrender.com/api/v2/natural-disasters/loadInitialData'
		},
		{
			name: 'Distribucion por edades',
			url: 'https://sos2526-12.onrender.com/api/v2/mid-population-ages/loadInitialData'
		}
	];

	/* ============================================================
	 *   CARGA INICIAL DE DATOS EN TODAS LAS APIS
	 * ============================================================
	 *
	 * Llama en PARALELO al endpoint /loadInitialData de cada API.
	 * Usa Promise.allSettled para que un fallo (timeout, 5xx, CORS...)
	 * de una API no impida que las demas se sigan poblando.
	 *
	 * Devuelve cuando todas las llamadas han terminado (con exito o error)
	 * y publica un resumen en seedSummary para informar al usuario.
	 *
	 * Nota: muchos backends devuelven 200 incluso si los datos ya existian
	 * previamente, asi que llamar varias veces a /loadInitialData es seguro
	 * (idempotente) y simplemente no hace nada en esas llamadas extra. */
	async function loadAllInitialData() {
		isSeeding = true;

		/* Lanzamos todas las peticiones a la vez. Cada una se envuelve para
		 * capturar errores individuales y devolver siempre un objeto con el
		 * mismo formato, simplificando el procesado posterior. */
		const results = await Promise.allSettled(
			peerApis.map(({ name, url }) =>
				fetch(url).then((response) => ({
					name,
					ok: response.ok,
					status: response.status
				}))
			)
		);

		/* Contamos cuantas APIs respondieron correctamente para mostrar un
		 * resumen al usuario y dejar trazas en consola para depuracion. */
		let okCount = 0;
		let failCount = 0;
		results.forEach((res, i) => {
			const api = peerApis[i];

			/* Consideramos que ha ido BIEN si la respuesta es OK (200-299)
			 * o si devuelve un 400, 409 (Conflicto). El 409 solo nos avisa de que los datos
			 * ya se cargaron antes, así que para nosotros es un "éxito" porque
			 * los datos ya están listos para usarse. */
			const esExitoValido =
				res.status === 'fulfilled' && (res.value.ok || res.value.status === 409 || res.value.statucls === 400);

			if (esExitoValido) {
				okCount += 1;
				// Si es un 409, ponemos un mensaje más tranquilo en la consola
				const msg = res.value.status === 409 ? 'YA EXISTÍAN' : 'OK';
				console.log(`[loadInitialData] ${msg} -> ${api.name}`);
			} else {
				failCount += 1;
				const detalle =
					res.status === 'fulfilled' ? `HTTP ${res.value.status}` : `error de red (${res.reason})`;
				console.warn(`[loadInitialData] ERR -> ${api.name}: ${detalle}`);
			}
		});

		seedSummary = `APIs inicializadas: ${okCount} OK / ${failCount} con error (de ${peerApis.length}).`;
		isSeeding = false;
	}

	/* ============================================================
	 * 1. INTEGRACION: IDH vs LANZAMIENTOS ESPACIALES
	 * ============================================================
	 *
	 * Que muestra: para cada par (pais, anyo) de mi IDH, cuantos
	 * lanzamientos espaciales hubo en el mundo ese mismo anyo.
	 *
	 * Cruce de datos: por ANYO. Para cada entrada de IDH cuento
	 * cuantos registros de la API espacial comparten ese anyo.
	 *
	 * Tipo de grafica: barras dobles (ApexCharts) con dos ejes Y:
	 *   - Eje izquierdo: valor IDH (escala 0 a 1).
	 *   - Eje derecho: numero de lanzamientos globales en ese anyo.
	 *
	 * Lectura: cada barra agrupa pais+anyo, permitiendo ver visualmente
	 * si los anyos con muchos lanzamientos coinciden con paises de IDH alto.
	 */
	async function loadSpaceIntegration() {
		try {
			const resIDH = await fetch('/api/v2/countries-idh-per-years');
			const myData = await resIDH.json();
			const resSpace = await fetch(
				'https://space-launches-8cix.onrender.com/api/v2/space-launches'
			);
			const peerData = await resSpace.json();

			/* Para cada (pais, anyo) propio buscamos los lanzamientos del
			 * mismo anyo. Si hay al menos uno, generamos un punto. */
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

			/* Ordenamos por anyo extraido del label, para que el eje X
			 * progrese cronologicamente y la grafica sea legible. */
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

	/* ============================================================
	 * 2. INTEGRACION: IDH vs ESTADISTICAS DE ESPECIAS
	 * ============================================================
	 *
	 * Que muestra: para cada anyo en comun, una "huella" de cinco
	 * dimensiones que combina mi IDH promedio con las cifras de
	 * produccion, consumo, importacion y exportacion de especias.
	 *
	 * Cruce de datos: agrego mis IDH y las cifras de especias por
	 * ANYO (calculo media de IDH y suma de cada cifra) y solo me
	 * quedo con los anyos presentes en ambos datasets.
	 *
	 * Normalizacion: como las magnitudes son muy distintas (IDH va
	 * de 0 a 1, las cifras de especias son miles o millones), cada
	 * eje del radar se expresa como % del valor maximo encontrado
	 * en esa dimension. Asi todas las dimensiones caben en la misma
	 * escala (0% a 100%) sin aplastar visualmente unas contra otras.
	 *
	 * Tipo de grafica: radar (Billboard.js). Una "estrella" por anyo
	 * permite comparar a vista de pajaro la similitud entre periodos.
	 */
	async function loadSpiceIntegration() {
		try {
			const resIDH = await fetch('/api/v2/countries-idh-per-years');
			const myData = await resIDH.json();
			const resSpice = await fetch('https://sos2526-20.onrender.com/api/v2/spice-stats');
			const peerResponse = await resSpice.json();
			const peerData = peerResponse.data || [];

			/* Indice IDH por anyo: guardamos suma y count para luego
			 * calcular la media (anyo puede tener varios paises). */
			const idhByYear = myData.reduce((acc, curr) => {
				const y = parseInt(curr.year);
				if (!acc[y]) acc[y] = { sum: 0, count: 0 };
				acc[y].sum += parseFloat(curr.hdi_value) || 0;
				acc[y].count += 1;
				return acc;
			}, {});

			/* Indice especias por anyo: sumamos directamente cada
			 * indicador (produccion, consumo, importacion, exportacion). */
			const spiceByYear = peerData.reduce((acc, curr) => {
				const y = parseInt(curr.year);
				if (!acc[y]) acc[y] = { prod: 0, cons: 0, imp: 0, exp: 0 };
				acc[y].prod += parseFloat(curr.production) || 0;
				acc[y].cons += parseFloat(curr.consumption) || 0;
				acc[y].imp += parseFloat(curr.import) || 0;
				acc[y].exp += parseFloat(curr.export) || 0;
				return acc;
			}, {});

			/* Solo nos interesan los anyos presentes en ambos datasets. */
			const commonYears = Object.keys(idhByYear).filter((y) => spiceByYear[y]);

			/* Calculamos los maximos por dimension para poder normalizar
			 * todos los valores a porcentaje del maximo (escala unica). */
			let maxValues = { idh: 0, prod: 0, cons: 0, imp: 0, exp: 0 };
			commonYears.forEach((y) => {
				const idh = (idhByYear[y].sum / idhByYear[y].count) * 1000;
				if (idh > maxValues.idh) maxValues.idh = idh;
				if (spiceByYear[y].prod > maxValues.prod) maxValues.prod = spiceByYear[y].prod;
				if (spiceByYear[y].cons > maxValues.cons) maxValues.cons = spiceByYear[y].cons;
				if (spiceByYear[y].imp > maxValues.imp) maxValues.imp = spiceByYear[y].imp;
				if (spiceByYear[y].exp > maxValues.exp) maxValues.exp = spiceByYear[y].exp;
			});

			/* Construimos las "filas" del radar. Billboard espera el formato
			 * [['x', dim1, dim2, ...], ['etiqueta', v1, v2, ...]]. */
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

	/* ============================================================
	 * 3. INTEGRACION: IDH vs ACCESO A AGUA URBANA
	 * ============================================================
	 *
	 * Que muestra: relacion entre el IDH promedio anual y la media
	 * de poblacion con acceso a agua potable en zonas urbanas.
	 *
	 * Cruce de datos: por ANYO. Para cada anyo en comun calculo:
	 *   - X = IDH promedio (de mis paises ese anyo).
	 *   - Y = media del campo wat_bas_pop_residence_urban del companero.
	 *
	 * Tipo de grafica: scatter (Billboard.js). Cada punto es un anyo.
	 *
	 * Truco didactico: como Billboard usa el valor X como identificador
	 * del punto, mantenemos un mapa idhToYearMap[idhKey]=anyo para
	 * poder mostrar el anyo correspondiente en el tooltip al pasar
	 * el raton. La clave se redondea a 3 decimales para evitar errores
	 * de coma flotante al hacer el lookup.
	 *
	 * Lectura: si los puntos suben de izquierda a derecha hay correlacion
	 * positiva entre IDH y acceso a agua urbana.
	 */
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

			/* Mapa IDH redondeado -> anyo, para poder enriquecer el tooltip. */
			const idhToYearMap = {};

			const commonYears = Object.keys(idhByYear).filter((y) => waterByYear[y]);

			commonYears.forEach((year) => {
				const avgIDH = idhByYear[year].sum / idhByYear[year].count;
				const avgWater = waterByYear[year].sum / waterByYear[year].count;

				if (avgWater > 0) {
					/* Redondeo a 3 decimales: la clave del mapa debe coincidir
					 * con la version formateada que Billboard pasa al tooltip. */
					const idhKey = avgIDH.toFixed(3);
					scatterX.push(avgIDH);
					scatterY.push(avgWater);
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
							/* Buscamos en el mapa por valor X redondeado igual
							 * que al construirlo para encontrar el anyo asociado. */
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
								/* Si la cifra es de millones, la formateamos como "1.2M"
								 * para que el eje no se sature de digitos. */
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

	/* ============================================================
	 * 4. INTEGRACION: IDH vs DESASTRES NATURALES (MAPA)
	 * ============================================================
	 *
	 * Que muestra: mapa del mundo coloreado segun el danyo economico
	 * promedio (USD) que han sufrido los paises por desastres naturales
	 * recogidos en la API del companero.
	 *
	 * Cruce de datos: por PAIS (no por anyo). Para cada pais que aparece
	 * en mi IDH busco sus desastres y promedio el danyo economico.
	 *
	 * Tipo de grafica: GeoChart de Google Charts (mapa coronoplético).
	 *
	 * Detalle clave: las APIs de los companeros usan nombres de pais en
	 * INGLES (spain, france, japan...), pero los mios estan en ESPANOL
	 * (espanya, francia, japon...). Por eso usamos un diccionario
	 * countryMapper como traductor antes de cruzar.
	 *
	 * Tambien usamos el formato { v: 'Spain', f: 'Spain (Anyos: 2020, 2021)' }
	 * de Google Charts para mostrar al usuario informacion adicional en el
	 * tooltip sin romper el ID interno que el motor del mapa usa para
	 * dibujar las regiones.
	 *
	 * NOTA: la libreria Google Charts se carga de forma asincrona como
	 * <script src=...> en svelte:head; si aun no se ha resuelto cuando
	 * onMount() ejecuta esta funcion, esperamos 500 ms y reintentamos.
	 */
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

				/* Diccionario espanyol -> ingles que normaliza los nombres
				 * para que el cruce funcione con los datos del companero. */
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

				/* Listado unico de mis paises (Set elimina duplicados). */
				const myCountries = [...new Set(myData.map((d) => d.country.toLowerCase().trim()))];

				myCountries.forEach((myCountry) => {
					const peerName = countryMapper[myCountry] || myCountry;

					const peerEntries = peerData.filter((p) => p.country.toLowerCase().trim() === peerName);

					if (peerEntries.length > 0) {
						const avgDamage =
							peerEntries.reduce((s, c) => s + (parseFloat(c.economic_damage_usd) || 0), 0) /
							peerEntries.length;

						/* Lista de anyos unicos involucrados, separada por comas
						 * (ej: "2020, 2021, 2024") para enriquecer el tooltip. */
						const years = [...new Set(peerEntries.map((p) => p.year))].join(', ');

						/* Capitalizamos para que GeoChart reconozca el pais. */
						const cleanName = peerName.charAt(0).toUpperCase() + peerName.slice(1);

						/* Formato extendido de Google Charts:
						 *   v: identificador real que se usa para pintar la region.
						 *   f: texto que ve el usuario en el tooltip.
						 * Asi mostramos los anyos sin alterar el matching del mapa. */
						chartData.push([{ v: cleanName, f: `${cleanName} (Años: ${years})` }, avgDamage]);
					}
				});

				console.log('Países cruzados con éxito:', chartData.length - 1);

				if (chartData.length > 1) {
					// @ts-ignore
					const dataTable = google.visualization.arrayToDataTable(chartData);
					const options = {
						/* Escala de color de amarillo (poco danyo) a naranja oscuro (mucho). */
						colorAxis: { colors: ['#ffecb3', '#ffa000', '#e65100'] },
						backgroundColor: '#f4f7f6',
						datalessRegionColor: '#e0e0e0', // gris para paises sin datos
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

	/* ============================================================
	 * 5. INTEGRACION: IDH vs DISTRIBUCION POR EDADES
	 * ============================================================
	 *
	 * Que muestra: para cada pais en comun con la API del companero,
	 * un grupo de "burbujas" donde cada burbuja es un tramo de edad
	 * (0-24, 25-49, 50-74, 75-99, 100+ anyos). El tamanyo de la
	 * burbuja es proporcional al numero de personas en ese tramo.
	 *
	 * Cruce de datos: por PAIS (nombre normalizado a minusculas).
	 * Si el pais aparece en mi IDH, lo incluyo y le adjunto el valor
	 * de IDH al nombre del grupo (visible en la leyenda y tooltip).
	 * Solo se usa el registro mas reciente del companero para evitar
	 * mezclar varios anyos en la misma visualizacion.
	 *
	 * Tipo de grafica: packed bubble de Highcharts. Las burbujas del
	 * mismo pais se agrupan visualmente (splitSeries: true).
	 *
	 * Lectura: paises con burbujas grandes en tramos altos sugieren
	 * poblacion envejecida; paises con grandes burbujas en 0-24 son
	 * demograficamente jovenes.
	 */
	async function loadPopulationAgesIntegration() {
		try {
			const resIDH = await fetch('/api/v2/countries-idh-per-years');
			const myData = await resIDH.json();

			const resPop = await fetch('https://sos2526-12.onrender.com/api/v2/mid-population-ages');
			const peerData = await resPop.json();

			const seriesData = [];
			/* Lista unica de paises del companero para iterar sin duplicados. */
			const countries = [...new Set(peerData.map((p) => p.country_name))];

			countries.forEach((cName) => {
				const normalizedName = cName.toLowerCase().trim();

				/* Cruce: solo procesamos paises presentes tambien en mi IDH. */
				const idhEntry = myData.find((d) => d.country.toLowerCase().trim() === normalizedName);

				if (idhEntry) {
					const countryEntries = peerData.filter((p) => p.country_name === cName);

					if (countryEntries.length > 0) {
						/* Tomamos el ultimo registro como "el mas reciente"
						 * (la API devuelve los registros ya ordenados temporalmente). */
						const latest = countryEntries[countryEntries.length - 1];

						seriesData.push({
							/* Adjuntamos el IDH al nombre del grupo: queda visible
							 * en la leyenda y aporta valor cruzando ambos datasets. */
							name: `${cName} (IDH: ${idhEntry.hdi_value})`,
							data: [
								{ name: '0-24 años', value: latest.population_age_0 || 0 },
								{ name: '25-49 años', value: latest.population_age_25 || 0 },
								{ name: '50-74 años', value: latest.population_age_50 || 0 },
								{ name: '75-99 años', value: latest.population_age_75 || 0 },
								{ name: '100+ años', value: latest.population_age_100 || 0 }
							]
						});
					}
				}
			});

			// @ts-ignore
			if (typeof Highcharts !== 'undefined' && seriesData.length > 0) {
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
						pointFormat: '<b>{point.name}:</b> {point.value} personas'
					},
					plotOptions: {
						packedbubble: {
							minSize: '30%',
							maxSize: '120%',
							zMin: 0,
							/* Cota superior para que los tamanyos sean comparables
							 * sin que un valor extremo aplaste al resto. */
							zMax: 10000000,
							layoutAlgorithm: {
								splitSeries: true, // burbujas agrupadas por pais
								gravitationalConstant: 0.02,
								friction: 0.8
							},
							dataLabels: {
								enabled: true,
								format: '{point.name}',
								style: {
									color: '#333',
									textOutline: 'none',
									fontWeight: 'normal',
									fontSize: '10px'
								}
							}
						}
					},
					series: seriesData
				});
			}
		} catch (error) {
			console.error('Error cargando integración de población:', error);
		}
	}

	/* ============================================================
	 * 6. INTEGRACION CON API EXTERNA: IDH vs INVERSION EN EDUCACION
	 * ============================================================
	 *
	 * Que muestra: dos series superpuestas que comparan el valor de
	 * IDH con el porcentaje del PIB que cada pais invierte en educacion
	 * (datos del Banco Mundial).
	 *
	 * Origen: el dato externo viene del Banco Mundial pero se accede a
	 * traves de un PROXY propio del backend (/api/v1/proxy/education-spending).
	 * El proxy acumula todas las paginas de la API real y filtra solo
	 * los paises que nos interesan, devolviendo un payload listo para usar.
	 *
	 * Cruce de datos: por PAIS Y ANYO. Hago dos pasadas:
	 *   1. Indexo el dataset externo por (pais, anyo) en un Map para
	 *      poder hacer lookups O(1) en lugar de filtrar en cada iteracion.
	 *   2. Para cada entrada propia de IDH busco la clave exacta. Si no
	 *      existe ese anyo concreto, hago FALLBACK al anyo mas cercano
	 *      disponible para ese pais (idea: mejor un dato cercano que ningun
	 *      dato; perdemos precision temporal pero ganamos cobertura).
	 *
	 * Detalle: el cruce se hace tanto por nombre normalizado como por
	 * codigo ISO3 (ESP, USA, CHN...) para maximizar las coincidencias
	 * pase lo que pase con la grafia del nombre.
	 *
	 * Tipo de grafica: area chart suavizado (ApexCharts) con dos series.
	 */
	async function loadEducationIntegration() {
		try {
			/* Normaliza un texto: minusculas, sin acentos, solo letras y digitos.
			 * Sirve para comparar nombres de pais sin que la grafia los separe. */
			const normalizeCountry = (value = '') =>
				value
					.toString()
					.toLowerCase()
					.normalize('NFD')
					.replace(/[̀-ͯ]/g, '')
					.replace(/[^a-z0-9]/g, '');

			const resIDH = await fetch('/api/v2/countries-idh-per-years');
			const myData = await resIDH.json();

			/* Datos externos a traves del proxy del backend (no atacamos
			 * directamente a worldbank.org desde el front: evita CORS y
			 * permite filtrar/cachear en el servidor). */
			const resExt = await fetch('/api/v1/proxy/education-spending');
			const response = await resExt.json();
			const externalData = Array.isArray(response?.[1]) ? response[1] : [];

			/* Diccionario mis-paises -> nombre y codigo ISO3 del Banco Mundial.
			 * El ISO3 es el matching mas fiable; el nombre es el respaldo. */
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

			/* Indexamos el dataset externo en estructuras Map para que el cruce
			 * con O(N+M) registros sea O(N+M) y no O(N*M). */
			const externalByCountryYear = new Map(); // clave "pais_anyo" -> valor
			const externalByCountry = new Map(); // clave "pais" -> [{year, value}, ...]
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

			/* Ordenamos cada lista por anyo para que el fallback al "anyo
			 * mas cercano" sea determinista. */
			externalByCountry.forEach((items) => {
				items.sort((a, b) => a.year - b.year);
			});

			/* Cruzamos: para cada IDH propio, buscamos su valor de educacion. */
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

				/* Match exacto preferido: ISO3 + anyo. Si no, nombre + anyo. */
				let educationValue =
					externalByCountryYear.get(keyByIso3) ?? externalByCountryYear.get(keyByName);
				let educationYear = myYear;

				/* Fallback: si no hay dato para ese anyo concreto, usamos el
				 * anyo mas cercano disponible para ese pais en el dataset.
				 * El usuario vera ambas fechas en la etiqueta para que sepa
				 * que el dato de educacion no es exactamente del mismo anyo. */
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
						/* Etiqueta autoexplicativa: pais (anyo de IDH / anyo de Educacion). */
						countryLabel: `${myEntry.country} (IDH ${myEntry.year} / Edu ${educationYear})`,
						idh,
						education: educationValue
					});
				}
			});

			/* Ordenamos por IDH ascendente para que la curva sea legible. */
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
								return value.toFixed(2);
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

	/* ============================================================
	 * 7. USO DIRECTO DE API EXTERNA: CLIMA EN SEVILLA
	 * ============================================================
	 *
	 * Que muestra: dos rebanadas (donut) con la temperatura actual y
	 * la velocidad del viento en Sevilla.
	 *
	 * Origen: API publica Open-Meteo (gratuita, sin clave). Las
	 * coordenadas (37.38, -5.97) fijan Sevilla.
	 *
	 * Tipo de grafica: donut de Billboard.js. Aunque normalmente un
	 * donut representa porcentajes, aqui usamos un formatter custom
	 * para mostrar el VALOR REAL con sus unidades (ºC, km/h) en lugar
	 * del porcentaje, que en este caso no tendria sentido.
	 */
	async function loadWeatherDonut() {
		try {
			const response = await fetch(
				'https://api.open-meteo.com/v1/forecast?latitude=37.3828&longitude=-5.9731&current_weather=true'
			);
			const data = await response.json();
			const temp = data.current_weather.temperature;
			const wind = data.current_weather.windspeed;

			bb.generate({
				data: {
					columns: [
						['Temperatura (ºC)', temp],
						['Viento (km/h)', wind]
					],
					type: 'donut'
				},
				donut: {
					title: 'Clima en Sevilla',
					label: {
						/* Por defecto Billboard pinta porcentajes; aqui forzamos
						 * el valor real con las unidades que correspondan. */
						format: function (value, ratio, id) {
							if (id === 'Temperatura (ºC)') {
								return value + ' ºC';
							} else {
								return value + ' km/h';
							}
						}
					}
				},
				bindto: '#chart-weather-donut'
			});
		} catch (error) {
			console.error('Error cargando la API de clima directa:', error);
		}
	}

	/* ============================================================
	 * 8. USO DIRECTO DE API EXTERNA: PAISES POR CONTINENTE
	 * ============================================================
	 *
	 * Que muestra: un grafico circular con la cantidad de paises del
	 * mundo agrupados por continente / region.
	 *
	 * Origen: API publica REST Countries (restcountries.com), pidiendo
	 * solo el campo "region" para reducir el payload.
	 *
	 * Tipo de grafica: pie chart de Google Charts. La leyenda esta en
	 * modo "labeled": las etiquetas se sacan al exterior con lineas
	 * punteadas, y cada etiqueta lleva ya el porcentaje calculado por
	 * nosotros (ej: "Europe (21.2%)") para evitar problemas de
	 * recortado en regiones pequenyas.
	 *
	 * Detalle anti-flicker: desactivamos el modo 3D porque produce
	 * parpadeos en navegadores modernos al redibujar el chart.
	 */
	let countriesChartLoaded = false;
	async function loadCountriesPie() {
		try {
			const response = await fetch('https://restcountries.com/v3.1/all?fields=region');
			if (!response.ok) throw new Error('Error API');
			const countries = await response.json();

			/* Calculamos el total para poder anyadir el porcentaje al label. */
			const totalCountries = countries.length;
			const stats = {};
			countries.forEach((c) => {
				const region = c.region || 'Otros';
				stats[region] = (stats[region] || 0) + 1;
			});

			/* Etiqueta enriquecida: "Europe (21.2%)". Asi el usuario ve
			 * el porcentaje aunque la rebanada sea pequenya y no se
			 * pueda renderizar el % dentro. */
			const dataForChart = [['Región', 'Nº de Países']];
			for (let region in stats) {
				const percentage = ((stats[region] / totalCountries) * 100).toFixed(1);
				dataForChart.push([`${region} (${percentage}%)`, stats[region]]);
			}

			google.charts.load('current', { packages: ['corechart'] });
			google.charts.setOnLoadCallback(() => {
				const data = google.visualization.arrayToDataTable(dataForChart);

				const options = {
					title: 'Distribución Global de Países por Continente',
					is3D: false, // 3D produce flicker en navegadores modernos
					pieSliceText: 'none', // texto interior off para evitar inconsistencias
					sliceVisibilityThreshold: 0,
					legend: {
						position: 'labeled', // etiquetas externas con guia
						textStyle: { fontSize: 11 }
					},
					/* Margen amplio (80%) para que las etiquetas externas
					 * tengan sitio sin recortarse contra los bordes. */
					chartArea: { left: '10%', width: '80%', height: '80%' },
					tooltip: { trigger: 'focus' },
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

	/* Secuencia de arranque al montar la pagina:
	 *
	 *   1. Llamamos a /loadInitialData en TODAS las APIs (la propia y las
	 *      de los companeros) para garantizar que las bases de datos tienen
	 *      registros antes de pintar las graficas. Esto evita que el usuario
	 *      tenga que abrir cada API manualmente para sembrar los datos.
	 *
	 *   2. Cuando la siembra termina (con exito o error), disparamos las
	 *      8 cargas de graficas EN PARALELO. No las encadenamos con await
	 *      porque queremos que cada grafica avance a su propio ritmo: si una
	 *      API tarda mucho o falla, las demas siguen renderizando. */
	onMount(async () => {
		await loadAllInitialData();

		loadSpaceIntegration();
		loadSpiceIntegration();
		loadWaterIntegration();
		loadDisasterIntegration();
		loadPopulationAgesIntegration();
		loadEducationIntegration();
		loadWeatherDonut();
		loadCountriesPie();
	});
</script>

<svelte:head>
	<!--
		Librerias de visualizacion cargadas por CDN.
		Se incluyen aqui (en el <head>) para que esten disponibles antes
		de que onMount() ejecute las funciones load*().
		  - Billboard.js (CSS + JS): graficas radar, scatter, donut.
		  - ApexCharts: graficas de barras y area.
		  - Google Charts loader: pie chart y geochart.
		  - Highcharts (+more y exporting): packed bubble.
	-->
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

	<!--
		Banner de estado del proceso de inicializacion automatica.
		Mientras se llama a /loadInitialData en cada API mostramos un
		mensaje "Cargando..."; al terminar mostramos un resumen con el
		numero de APIs que respondieron OK / con error.
	-->
	{#if isSeeding}
		<p class="seed-status seed-loading" aria-live="polite">
			Inicializando datos en todas las APIs (loadInitialData)...
		</p>
	{:else if seedSummary}
		<p class="seed-status seed-done" aria-live="polite">{seedSummary}</p>
	{/if}

	<!-- 1. IDH vs Lanzamientos espaciales (cruce con companero por anyo) -->
	<section class="chart-section">
		<h3 class="chart-subtitle">
			Integración: IDH vs Lanzamientos Globales por Año (Highchart + Bar)
		</h3>
		<div id="chart-integration-space" bind:this={chartContainer}></div>
	</section>

	<!-- 2. IDH vs Especias (radar normalizado al maximo) -->
	<section class="chart-section">
		<h3 class="chart-subtitle">Integración: IDH vs Especias (Billboard + Radar)</h3>
		<div id="chart-radar-spice"></div>
	</section>

	<!-- 3. IDH vs Agua urbana (scatter con tooltip enriquecido por anyo) -->
	<section class="chart-section">
		<h3 class="chart-subtitle">Integración: IDH vs Acceso a Agua Urbana (Billboard + Scatter)</h3>
		<div id="chart-water-integration"></div>
	</section>

	<!-- 4. IDH vs Desastres naturales (mapa mundial con escala de color) -->
	<section class="chart-section">
		<h3 class="chart-subtitle">
			Integración: IDH vs Daños por desastres naturales (Google Charts + GeoChart)
		</h3>
		<div id="chart-map-disasters"></div>
	</section>

	<!-- 5. IDH vs Edad media (packed bubble agrupado por pais) -->
	<section class="chart-section">
		<h3 class="chart-subtitle">Integración: IDH vs Edad media (Highcharts + Packed Bubble)</h3>
		<div id="chart-fertility-bubbles"></div>
	</section>

	<!-- 6. IDH vs Inversion en educacion (cruce con Banco Mundial via proxy) -->
	<section class="chart-section">
		<h3 class="chart-subtitle">Integración: IDH vs Educacion (ApexCharts + Area Chart)</h3>
		<div id="chart-education"></div>
	</section>

	<!-- 7. Uso simple: clima de Sevilla (Open-Meteo) -->
	<section class="chart-section">
		<h3 class="chart-subtitle">Uso: Clima en Sevilla(Billboard + Donut Chart)</h3>
		<div id="chart-weather-donut"></div>
	</section>

	<!-- 8. Uso simple: distribucion de paises por continente (REST Countries) -->
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

	/* Banner que avisa del estado de la siembra de datos (loadInitialData). */
	.seed-status {
		max-width: 1100px;
		margin: 0 auto 25px;
		padding: 12px 18px;
		border-radius: 8px;
		font-weight: 600;
		text-align: center;
	}

	/* Estado "en curso": fondo amarillo suave para indicar accion en marcha. */
	.seed-loading {
		background: #fff8e1;
		color: #8a6d00;
		border: 1px solid #ffe082;
	}

	/* Estado "finalizado": fondo verde suave para indicar exito. */
	.seed-done {
		background: #e8f5e9;
		color: #1b5e20;
		border: 1px solid #a5d6a7;
	}
</style>
