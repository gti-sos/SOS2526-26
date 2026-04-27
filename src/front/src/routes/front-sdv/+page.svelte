<script>
    // @ts-nocheck
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    
    // Importamos todo lo necesario de Auth0
    import { isAuthenticated, user, login, logout } from '$lib/authService.js';

    import { env } from '$env/dynamic/public'; // <--- Importa esto (SvelteKit)

    // Usamos el mismo origen donde se sirve la app para evitar
    // que E2E en build de producción apunte al backend remoto.
    const BASE_URL = typeof window !== 'undefined' ? window.location.origin : "";
    let API = BASE_URL + '/api/v2/countries-idh-per-years';
    const isTestMode = typeof window !== 'undefined' && window.location.search.includes('e2e=true');


    let idhs = $state([]);
    let message = $state("");
    let messageColor = $state("black");

    let newIdh = $state({
        country: "", year: "", hdi_value: "", hdi_rank: "", hdi_change: ""
    });

    function showMessage(msg, isError = false) {
        message = msg;
        messageColor = isError ? "red" : "green";
        setTimeout(() => { message = ""; }, 4000);
    }

    async function getData(){
        const res = await fetch(API);
        if (res.ok) { idhs = await res.json(); }
    }

    async function insertIdh() {
        if (!$isAuthenticated && !isTestMode) return;
        const res = await fetch(API, {
            method: "POST",
            body: JSON.stringify(newIdh),
            headers: { "Content-Type": "application/json" }
        });
        if (res.status === 201) {
            showMessage(`¡${newIdh.country} añadido!`);
            newIdh = { country: "", year: "", hdi_value: "", hdi_rank: "", hdi_change: "" };
            getData(); 
        } else { showMessage("Error al guardar", true); }
    }

    async function deleteIdh(country, year) {
        if (!$isAuthenticated && !isTestMode) return;
        const res = await fetch(`${API}/${country}/${year}`, { method: "DELETE" });
        if (res.ok) { showMessage("Eliminado correctamente"); getData(); }
    }

    async function deleteAll() {
        if (!$isAuthenticated && !isTestMode) return;
        if (confirm("¿Borrar todo?")) {
            const res = await fetch(API, { method: "DELETE" });
            if (res.ok) { getData(); }
        }
    }

    async function loadInitialData() {
        if (!$isAuthenticated && !isTestMode) return;
        const res = await fetch(`${API}/loadInitialData`);
        if (res.ok) { getData(); }
    }

    onMount(getData);

    // Búsqueda avanzada (menú interactivo en español)
    let filtros = $state({
        usarPais: true,
        country: "",
        usarAnioExacto: false,
        year: "",
        usarRangoAnios: false,
        from: "",
        to: "",
        usarValorIdh: false,
        hdi_value: "",
        usarRanking: false,
        hdi_rank: "",
        usarCambio: false,
        hdi_change: "",
        usarPaginacion: false,
        offset: "",
        limit: ""
    });

    function appendIfEnabled(query, enabled, key, value) {
        if (!enabled) return;
        const normalized = String(value ?? "").trim();
        if (normalized !== "") query.append(key, normalized);
    }

    async function handleSearch() {
        const query = new URLSearchParams();
        appendIfEnabled(query, filtros.usarPais, "country", filtros.country);
        appendIfEnabled(query, filtros.usarAnioExacto, "year", filtros.year);
        appendIfEnabled(query, filtros.usarRangoAnios, "from", filtros.from);
        appendIfEnabled(query, filtros.usarRangoAnios, "to", filtros.to);
        appendIfEnabled(query, filtros.usarValorIdh, "hdi_value", filtros.hdi_value);
        appendIfEnabled(query, filtros.usarRanking, "hdi_rank", filtros.hdi_rank);
        appendIfEnabled(query, filtros.usarCambio, "hdi_change", filtros.hdi_change);
        appendIfEnabled(query, filtros.usarPaginacion, "offset", filtros.offset);
        appendIfEnabled(query, filtros.usarPaginacion, "limit", filtros.limit);

        const res = await fetch(`${API}?${query.toString()}`);
        if (res.ok) { idhs = await res.json(); }
    }

    function limpiarFiltros() {
        filtros = {
            usarPais: true,
            country: "",
            usarAnioExacto: false,
            year: "",
            usarRangoAnios: false,
            from: "",
            to: "",
            usarValorIdh: false,
            hdi_value: "",
            usarRanking: false,
            hdi_rank: "",
            usarCambio: false,
            hdi_change: "",
            usarPaginacion: false,
            offset: "",
            limit: ""
        };
        getData();
    }
</script>

<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
    <h1>Gestión de IDH (Sergio Díaz)</h1>
    
    {#if $isAuthenticated}
        <div style="display: flex; align-items: center; gap: 15px;">
            <span style="color: #666;">Hola, <strong>{$user?.nickname || $user?.name}</strong></span>
            <button onclick={logout} style="background-color: #e74c3c; color: white; border: none; padding: 8px 15px; border-radius: 5px; cursor: pointer;">
                Cerrar Sesión
            </button>
        </div>
    {:else}
        <button onclick={login} style="background-color: #3498db; color: white; border: none; padding: 8px 15px; border-radius: 5px; cursor: pointer;">
            Iniciar Sesión
        </button>
    {/if}
</div>

{#if message}
    <div style="color: {messageColor}; font-weight: bold; border: 2px solid {messageColor}; padding: 10px; margin-bottom: 20px; border-radius: 5px;">
        {message}
    </div>
{/if}

<section style="background: #f9f9f9; padding: 20px; border-radius: 8px; border: 1px solid #ccc; margin-bottom: 30px;">
    <h3>Añadir nuevo registro de IDH</h3>
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px;">
        <input placeholder="País" bind:value={newIdh.country} disabled={!$isAuthenticated && !isTestMode} />
        <input type="number" placeholder="Año" bind:value={newIdh.year} disabled={!$isAuthenticated && !isTestMode} />
        <input type="number" step="0.001" placeholder="Valor IDH" bind:value={newIdh.hdi_value} disabled={!$isAuthenticated && !isTestMode} />
        <input type="number" placeholder="Ranking" bind:value={newIdh.hdi_rank} disabled={!$isAuthenticated && !isTestMode} />
        <input type="number" placeholder="Cambio" bind:value={newIdh.hdi_change} disabled={!$isAuthenticated && !isTestMode} />
    </div>
    
    {#if $isAuthenticated || isTestMode}
        <button onclick={insertIdh} style="margin-top: 15px; background-color: #4CAF50; color: white; border: none; padding: 10px 20px; border-radius: 5px;">
            Añadir Registro
        </button>
    {:else}
        <p style="color: #e67e22; font-size: 0.9em; margin-top: 10px;">⚠️ Debes iniciar sesión para añadir datos.</p>
    {/if}

    <div class="filtros-panel">
        <h4>Menú interactivo de búsqueda</h4>
        <p class="hint">Activa solo los filtros que quieras aplicar.</p>

        <div class="filtros-grid">
            <label class="filtro-item">
                <input type="checkbox" bind:checked={filtros.usarPais} />
                País
                <input type="text" placeholder="Ej: españa" bind:value={filtros.country} disabled={!filtros.usarPais} />
            </label>

            <label class="filtro-item">
                <input type="checkbox" bind:checked={filtros.usarAnioExacto} />
                Año exacto
                <input type="number" placeholder="Ej: 2022" bind:value={filtros.year} disabled={!filtros.usarAnioExacto} />
            </label>

            <label class="filtro-item">
                <input type="checkbox" bind:checked={filtros.usarRangoAnios} />
                Rango de años
                <div class="filtro-inline">
                    <input type="number" placeholder="Desde" bind:value={filtros.from} disabled={!filtros.usarRangoAnios} />
                    <input type="number" placeholder="Hasta" bind:value={filtros.to} disabled={!filtros.usarRangoAnios} />
                </div>
            </label>

            <label class="filtro-item">
                <input type="checkbox" bind:checked={filtros.usarValorIdh} />
                Valor IDH
                <input type="number" step="0.001" placeholder="Ej: 0.911" bind:value={filtros.hdi_value} disabled={!filtros.usarValorIdh} />
            </label>

            <label class="filtro-item">
                <input type="checkbox" bind:checked={filtros.usarRanking} />
                Ranking IDH
                <input type="number" placeholder="Ej: 27" bind:value={filtros.hdi_rank} disabled={!filtros.usarRanking} />
            </label>

            <label class="filtro-item">
                <input type="checkbox" bind:checked={filtros.usarCambio} />
                Cambio IDH
                <input type="number" placeholder="Ej: 1" bind:value={filtros.hdi_change} disabled={!filtros.usarCambio} />
            </label>

            <label class="filtro-item">
                <input type="checkbox" bind:checked={filtros.usarPaginacion} />
                Paginación
                <div class="filtro-inline">
                    <input type="number" min="0" placeholder="Offset" bind:value={filtros.offset} disabled={!filtros.usarPaginacion} />
                    <input type="number" min="1" placeholder="Limit" bind:value={filtros.limit} disabled={!filtros.usarPaginacion} />
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
                        <button onclick={() => goto(`/front-sdv/${i.country}/${i.year}${isTestMode ? '?e2e=true' : ''}`)} class="btn-edit">Editar</button>
                        <button onclick={() => deleteIdh(i.country, i.year)} class="btn-delete">Eliminar</button>
                    </td>
                {/if}
            </tr>
        {/each}
    </tbody>
</table>

<div style="margin-top: 20px; display: flex; gap: 10px;">
    <button onclick={loadInitialData} style="background-color: #3498db; color: white; border: none; padding: 10px; border-radius: 4px;">Actualizar Lista</button>
    {#if $isAuthenticated || isTestMode}
        <button onclick={deleteAll} style="background-color: #c0392b; color: white; border: none; padding: 10px; border-radius: 4px;">BORRAR TODO</button>
    {/if}
</div>

<style>
    table { width: 100%; border-collapse: collapse; margin-top: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.2); }
    th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
    th { background-color: #2c3e50; color: white; font-weight: bold; }
    tr:nth-child(even) { background-color: #f9f9f9; }
    tr:hover { background-color: #f1f1f1; }

    .btn-edit { color: white; background-color: #f39c12; border: none; padding: 6px 12px; border-radius: 3px; cursor: pointer; margin-right: 5px; }
    .btn-delete { color: white; background-color: #e74c3c; border: none; padding: 6px 12px; border-radius: 3px; cursor: pointer; }
    button:hover { opacity: 0.8; }
    .filtros-panel {
        margin-top: 20px;
        padding-top: 15px;
        border-top: 1px solid #ddd;
    }
    .hint { margin: 6px 0 14px; color: #666; font-size: 0.92rem; }
    .filtros-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
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
    .filtro-item input[type="checkbox"] {
        width: 16px;
        height: 16px;
    }
    .filtro-inline {
        display: flex;
        gap: 8px;
    }
    .filtros-actions {
        margin-top: 12px;
        display: flex;
        gap: 10px;
    }
</style>