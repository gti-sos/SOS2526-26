<script>
	// @ts-nocheck

	/*
	 * Pagina principal del recurso "countries-idh-per-years" (Sergio Diaz Vazquez).
	 *
	 * Vista CRUD que consume la API REST v2 del backend:
	 *   - Listado completo con paginacion y filtros avanzados.
	 *   - Alta de nuevos registros (POST).
	 *   - Borrado individual y borrado masivo (DELETE).
	 *   - Carga de datos iniciales de prueba.
	 *   - Acceso a la pagina de edicion individual via /front-sdv/:country/:year.
	 *
	 * La autenticacion (Auth0) protege las acciones de escritura. Si no
	 * hay sesion, los formularios y botones de modificacion se desactivan,
	 * aunque la lectura (tabla) sigue siendo publica.
	 */

	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	import { isAuthenticated, user, login, logout } from '$lib/authService.js';

	import { env } from '$env/dynamic/public';

	/*
	 * Construimos la URL de la API a partir del origen actual del navegador.
	 * Asi en E2E, despliegues productivos y desarrollo local apuntamos
	 * automaticamente al backend que se esta sirviendo, sin hard-codear hosts.
	 */
	const BASE_URL = typeof window !== 'undefined' ? window.location.origin : '';
	let API = BASE_URL + '/api/v2/countries-idh-per-years';

	/*
	 * Modo test E2E: se activa con el query param ?e2e=true.
	 * Permite saltarse la autenticacion para que Playwright pueda
	 * ejecutar acciones de escritura sin pasar por Auth0.
	 */
	const isTestMode = typeof window !== 'undefined' && window.location.search.includes('e2e=true');

	let idhs = $state([]);
	let message = $state('');
	let messageColor = $state('black');

	let newIdh = $state({
		country: '',
		year: '',
		hdi_value: '',
		hdi_rank: '',
		hdi_change: ''
	});

	/*
	 * Notificacion temporal al usuario.
	 * Verde para exito, rojo para error. Se limpia automaticamente
	 * a los 4 segundos para no contaminar la interfaz.
	 */
	function showMessage(msg, isError = false) {
		message = msg;
		messageColor = isError ? 'red' : 'green';
		setTimeout(() => {
			message = '';
		}, 4000);
	}

	/* GET coleccion: refresca el array reactivo "idhs" que pinta la tabla. */
	async function getData() {
		const res = await fetch(API);
		if (res.ok) {
			idhs = await res.json();
		}
	}

	/*
	 * Crea un nuevo recurso via POST.
	 * Bloqueada para usuarios no autenticados (salvo en E2E).
	 * Tras un 201 limpia el formulario y recarga la tabla.
	 */
	async function insertIdh() {
		if (!$isAuthenticated && !isTestMode) return;
		const res = await fetch(API, {
			method: 'POST',
			body: JSON.stringify(newIdh),
			headers: { 'Content-Type': 'application/json' }
		});
		if (res.status === 201) {
			showMessage(`¡${newIdh.country} añadido!`);
			newIdh = { country: '', year: '', hdi_value: '', hdi_rank: '', hdi_change: '' };
			getData();
		} else {
			showMessage('Error al guardar', true);
		}
	}

	/* Borra un recurso concreto identificado por (country, year). */
	async function deleteIdh(country, year) {
		if (!$isAuthenticated && !isTestMode) return;
		const res = await fetch(`${API}/${country}/${year}`, { method: 'DELETE' });
		if (res.ok) {
			showMessage('Eliminado correctamente');
			getData();
		}
	}

	/*
	 * Borra la coleccion completa.
	 * Pide confirmacion explicita por nativo confirm() antes de
	 * lanzar la peticion: es una accion irreversible.
	 */
	async function deleteAll() {
		if (!$isAuthenticated && !isTestMode) return;
		if (confirm('¿Borrar todo?')) {
			const res = await fetch(API, { method: 'DELETE' });
			if (res.ok) {
				getData();
			}
		}
	}

	/*
	 * Carga los datos iniciales de prueba en el backend.
	 * El servidor solo aceptara la peticion si la coleccion esta vacia;
	 * en caso contrario respondera 400 y la tabla no cambiara.
	 */
	async function loadInitialData() {
		if (!$isAuthenticated && !isTestMode) return;
		const res = await fetch(`${API}/loadInitialData`);
		if (res.ok) {
			getData();
		}
	}

	onMount(getData);

	/*
	 * Estado del menu de busqueda avanzada.
	 *
	 * Cada filtro tiene un par "usarX / X": el checkbox controla si el
	 * filtro participa en la query (independiente de si su valor esta
	 * relleno o vacio). Esto permite al usuario tener valores escritos
	 * pero ignorados sin necesidad de borrarlos.
	 */
	let filtros = $state({
		usarPais: true,
		country: '',
		usarAnioExacto: false,
		year: '',
		usarRangoAnios: false,
		from: '',
		to: '',
		usarValorIdh: false,
		hdi_value: '',
		usarRanking: false,
		hdi_rank: '',
		usarCambio: false,
		hdi_change: '',
		usarPaginacion: false,
		offset: '',
		limit: ''
	});

	/*
	 * Anyade un parametro al URLSearchParams solo si el filtro esta
	 * activado y su valor no esta vacio (tras trim). Evita enviar al
	 * backend parametros con cadena vacia, que ensuciarian la query.
	 */
	function appendIfEnabled(query, enabled, key, value) {
		if (!enabled) return;
		const normalized = String(value ?? '').trim();
		if (normalized !== '') query.append(key, normalized);
	}

	/*
	 * Construye la URL con todos los filtros activos y dispara la
	 * busqueda. El resultado sustituye al listado actual de la tabla.
	 */
	async function handleSearch() {
		const query = new URLSearchParams();
		appendIfEnabled(query, filtros.usarPais, 'country', filtros.country);
		appendIfEnabled(query, filtros.usarAnioExacto, 'year', filtros.year);
		appendIfEnabled(query, filtros.usarRangoAnios, 'from', filtros.from);
		appendIfEnabled(query, filtros.usarRangoAnios, 'to', filtros.to);
		appendIfEnabled(query, filtros.usarValorIdh, 'hdi_value', filtros.hdi_value);
		appendIfEnabled(query, filtros.usarRanking, 'hdi_rank', filtros.hdi_rank);
		appendIfEnabled(query, filtros.usarCambio, 'hdi_change', filtros.hdi_change);
		appendIfEnabled(query, filtros.usarPaginacion, 'offset', filtros.offset);
		appendIfEnabled(query, filtros.usarPaginacion, 'limit', filtros.limit);

		const res = await fetch(`${API}?${query.toString()}`);
		if (res.ok) {
			idhs = await res.json();
		}
	}

	/* Restablece los filtros a su valor por defecto y recarga la coleccion completa. */
	function limpiarFiltros() {
		filtros = {
			usarPais: true,
			country: '',
			usarAnioExacto: false,
			year: '',
			usarRangoAnios: false,
			from: '',
			to: '',
			usarValorIdh: false,
			hdi_value: '',
			usarRanking: false,
			hdi_rank: '',
			usarCambio: false,
			hdi_change: '',
			usarPaginacion: false,
			offset: '',
			limit: ''
		};
		getData();
	}
</script>

<div
	style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;"
>
	<h1>Gestión de IDH (Sergio Díaz)</h1>

	{#if $isAuthenticated}
		<div style="display: flex; align-items: center; gap: 15px;">
			<span style="color: #666;">Hola, <strong>{$user?.nickname || $user?.name}</strong></span>
			<button
				onclick={logout}
				style="background-color: #e74c3c; color: white; border: none; padding: 8px 15px; border-radius: 5px; cursor: pointer;"
			>
				Cerrar Sesión
			</button>
		</div>
	{:else}
		<button
			onclick={login}
			style="background-color: #3498db; color: white; border: none; padding: 8px 15px; border-radius: 5px; cursor: pointer;"
		>
			Iniciar Sesión
		</button>
	{/if}
</div>

{#if message}
	<div
		style="color: {messageColor}; font-weight: bold; border: 2px solid {messageColor}; padding: 10px; margin-bottom: 20px; border-radius: 5px;"
	>
		{message}
	</div>
{/if}

<section
	style="background: #f9f9f9; padding: 20px; border-radius: 8px; border: 1px solid #ccc; margin-bottom: 30px;"
>
	<h3>Añadir nuevo registro de IDH</h3>
	<div
		style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px;"
	>
		<input
			placeholder="País"
			bind:value={newIdh.country}
			disabled={!$isAuthenticated && !isTestMode}
		/>
		<input
			type="number"
			placeholder="Año"
			bind:value={newIdh.year}
			disabled={!$isAuthenticated && !isTestMode}
		/>
		<input
			type="number"
			step="0.001"
			placeholder="Valor IDH"
			bind:value={newIdh.hdi_value}
			disabled={!$isAuthenticated && !isTestMode}
		/>
		<input
			type="number"
			placeholder="Ranking"
			bind:value={newIdh.hdi_rank}
			disabled={!$isAuthenticated && !isTestMode}
		/>
		<input
			type="number"
			placeholder="Cambio"
			bind:value={newIdh.hdi_change}
			disabled={!$isAuthenticated && !isTestMode}
		/>
	</div>

	{#if $isAuthenticated || isTestMode}
		<button
			onclick={insertIdh}
			style="margin-top: 15px; background-color: #4CAF50; color: white; border: none; padding: 10px 20px; border-radius: 5px;"
		>
			Añadir Registro
		</button>
	{:else}
		<p style="color: #e67e22; font-size: 0.9em; margin-top: 10px;">
			⚠️ Debes iniciar sesión para añadir datos.
		</p>
	{/if}

	<div class="filtros-panel">
		<h4>Menú interactivo de búsqueda</h4>
		<p class="hint">Activa solo los filtros que quieras aplicar.</p>

		<div class="filtros-grid">
			<label class="filtro-item">
				<input type="checkbox" bind:checked={filtros.usarPais} />
				País
				<input
					type="text"
					placeholder="Ej: españa"
					bind:value={filtros.country}
					disabled={!filtros.usarPais}
				/>
			</label>

			<label class="filtro-item">
				<input type="checkbox" bind:checked={filtros.usarAnioExacto} />
				Año exacto
				<input
					type="number"
					placeholder="Ej: 2022"
					bind:value={filtros.year}
					disabled={!filtros.usarAnioExacto}
				/>
			</label>

			<label class="filtro-item">
				<input type="checkbox" bind:checked={filtros.usarRangoAnios} />
				Rango de años
				<div class="filtro-inline">
					<input
						type="number"
						placeholder="Desde"
						bind:value={filtros.from}
						disabled={!filtros.usarRangoAnios}
					/>
					<input
						type="number"
						placeholder="Hasta"
						bind:value={filtros.to}
						disabled={!filtros.usarRangoAnios}
					/>
				</div>
			</label>

			<label class="filtro-item">
				<input type="checkbox" bind:checked={filtros.usarValorIdh} />
				Valor IDH
				<input
					type="number"
					step="0.001"
					placeholder="Ej: 0.911"
					bind:value={filtros.hdi_value}
					disabled={!filtros.usarValorIdh}
				/>
			</label>

			<label class="filtro-item">
				<input type="checkbox" bind:checked={filtros.usarRanking} />
				Ranking IDH
				<input
					type="number"
					placeholder="Ej: 27"
					bind:value={filtros.hdi_rank}
					disabled={!filtros.usarRanking}
				/>
			</label>

			<label class="filtro-item">
				<input type="checkbox" bind:checked={filtros.usarCambio} />
				Cambio IDH
				<input
					type="number"
					placeholder="Ej: 1"
					bind:value={filtros.hdi_change}
					disabled={!filtros.usarCambio}
				/>
			</label>

			<label class="filtro-item">
				<input type="checkbox" bind:checked={filtros.usarPaginacion} />
				Paginación
				<div class="filtro-inline">
					<input
						type="number"
						min="0"
						placeholder="Offset"
						bind:value={filtros.offset}
						disabled={!filtros.usarPaginacion}
					/>
					<input
						type="number"
						min="1"
						placeholder="Limit"
						bind:value={filtros.limit}
						disabled={!filtros.usarPaginacion}
					/>
				</div>
			</label>
		</div>

		<div class="filtros-actions">
			<button onclick={handleSearch}>Buscar</button>
			<button onclick={limpiarFiltros}>Limpiar filtros</button>
		</div>
	</div>
</section>

<table>
	<thead>
		<tr>
			<th>País</th>
			<th>Año</th>
			<th>Valor IDH</th>
			<th>Ranking</th>
			<th>Cambio</th>
			{#if $isAuthenticated || isTestMode}
				<th>Acciones</th>
			{/if}
		</tr>
	</thead>
	<tbody>
		{#each idhs as i}
			<tr>
				<td>{i.country}</td>
				<td>{i.year}</td>
				<td>{i.hdi_value}</td>
				<td>{i.hdi_rank}</td>
				<td>{i.hdi_change}</td>
				{#if $isAuthenticated || isTestMode}
					<td>
						<button
							onclick={() =>
								goto(`/front-sdv/${i.country}/${i.year}${isTestMode ? '?e2e=true' : ''}`)}
							class="btn-edit">Editar</button
						>
						<button onclick={() => deleteIdh(i.country, i.year)} class="btn-delete">Eliminar</button
						>
					</td>
				{/if}
			</tr>
		{/each}
	</tbody>
</table>

<div style="margin-top: 20px; display: flex; gap: 10px;">
	<button
		onclick={loadInitialData}
		style="background-color: #3498db; color: white; border: none; padding: 10px; border-radius: 4px;"
		>Actualizar Lista</button
	>
	{#if $isAuthenticated || isTestMode}
		<button
			onclick={deleteAll}
			style="background-color: #c0392b; color: white; border: none; padding: 10px; border-radius: 4px;"
			>BORRAR TODO</button
		>
	{/if}
</div>

<style>
	table {
		width: 100%;
		border-collapse: collapse;
		margin-top: 10px;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
	}
	th,
	td {
		border: 1px solid #ddd;
		padding: 12px;
		text-align: left;
	}
	th {
		background-color: #2c3e50;
		color: white;
		font-weight: bold;
	}
	tr:nth-child(even) {
		background-color: #f9f9f9;
	}
	tr:hover {
		background-color: #f1f1f1;
	}

	.btn-edit {
		color: white;
		background-color: #f39c12;
		border: none;
		padding: 6px 12px;
		border-radius: 3px;
		cursor: pointer;
		margin-right: 5px;
	}
	.btn-delete {
		color: white;
		background-color: #e74c3c;
		border: none;
		padding: 6px 12px;
		border-radius: 3px;
		cursor: pointer;
	}
	button:hover {
		opacity: 0.8;
	}
	.filtros-panel {
		margin-top: 20px;
		padding-top: 15px;
		border-top: 1px solid #ddd;
	}
	.hint {
		margin: 6px 0 14px;
		color: #666;
		font-size: 0.92rem;
	}
	.filtros-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
		gap: 12px;
	}
	.filtro-item {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 10px;
		border: 1px solid #ddd;
		border-radius: 6px;
		background: white;
		font-weight: 600;
		color: #2c3e50;
	}
	.filtro-item input[type='checkbox'] {
		width: 16px;
		height: 16px;
	}
	.filtro-inline {
		display: flex;
		gap: 8px;
		width: 100%;
	}
	.filtro-inline input {
		flex: 1;
		min-width: 0;
	}
	.filtros-actions {
		margin-top: 12px;
		display: flex;
		gap: 10px;
	}
</style>
