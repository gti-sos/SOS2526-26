<script>
    // @ts-nocheck
    import { dev } from '$app/environment';
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    
    // Importamos todo lo necesario de Auth0
    import { isAuthenticated, user, login, logout } from '$lib/authService.js';

    import { env } from '$env/dynamic/public'; // <--- Importa esto (SvelteKit)

    // Usamos la variable de entorno que pasaremos por Docker, 
    // o localhost si estamos trabajando en local sin Docker.
    const BASE_URL = env.PUBLIC_API_URL || "http://localhost:3000";
    let API = BASE_URL + '/api/v2/countries-idh-per-years';


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
        if (!$isAuthenticated) return;
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
        if (!$isAuthenticated) return;
        const res = await fetch(`${API}/${country}/${year}`, { method: "DELETE" });
        if (res.ok) { showMessage("Eliminado correctamente"); getData(); }
    }

    async function deleteAll() {
        if (!$isAuthenticated) return;
        if (confirm("¿Borrar todo?")) {
            const res = await fetch(API, { method: "DELETE" });
            if (res.ok) { getData(); }
        }
    }

    async function loadInitialData() {
        if (!$isAuthenticated) return;
        const res = await fetch(`${API}/loadInitialData`);
        if (res.ok) { getData(); }
    }

    onMount(getData);

    // Búsqueda
    let search = $state({ from: "", to: "", country: "" });
    async function handleSearch() {
        const query = new URLSearchParams();
        if (search.from) query.append("from", search.from);
        if (search.to) query.append("to", search.to);
        if (search.country) query.append("country", search.country);
        const res = await fetch(`${API}?${query.toString()}`);
        if (res.ok) { idhs = await res.json(); }
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
        <input placeholder="País" bind:value={newIdh.country} disabled={!$isAuthenticated} />
        <input type="number" placeholder="Año" bind:value={newIdh.year} disabled={!$isAuthenticated} />
        <input type="number" step="0.001" placeholder="Valor IDH" bind:value={newIdh.hdi_value} disabled={!$isAuthenticated} />
        <input type="number" placeholder="Ranking" bind:value={newIdh.hdi_rank} disabled={!$isAuthenticated} />
        <input type="number" placeholder="Cambio" bind:value={newIdh.hdi_change} disabled={!$isAuthenticated} />
    </div>
    
    {#if $isAuthenticated}
        <button onclick={insertIdh} style="margin-top: 15px; background-color: #4CAF50; color: white; border: none; padding: 10px 20px; border-radius: 5px;">
            Añadir Registro
        </button>
    {:else}
        <p style="color: #e67e22; font-size: 0.9em; margin-top: 10px;">⚠️ Debes iniciar sesión para añadir datos.</p>
    {/if}

    <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #ddd;">
      <strong>Buscar: </strong>
      <input type="text" placeholder="País" bind:value={search.country} style="width: 120px;"/>
      <input type="number" placeholder="Desde" bind:value={search.from} style="width: 80px;"/>
      <input type="number" placeholder="Hasta" bind:value={search.to} style="width: 80px;"/>
      <button onclick={handleSearch}>Filtrar</button>
      <button onclick={() => { search = {from:"", to:"", country:""}; getData(); }}>Limpiar</button>
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
            {#if $isAuthenticated}
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
                {#if $isAuthenticated}
                    <td>
                        <button onclick={() => goto(`/front-sdv/${i.country}/${i.year}`)} class="btn-edit">Editar</button>
                        <button onclick={() => deleteIdh(i.country, i.year)} class="btn-delete">Eliminar</button>
                    </td>
                {/if}
            </tr>
        {/each}
    </tbody>
</table>

<div style="margin-top: 20px; display: flex; gap: 10px;">
    <button onclick={loadInitialData} style="background-color: #3498db; color: white; border: none; padding: 10px; border-radius: 4px;">Actualizar Lista</button>
    {#if $isAuthenticated}
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
</style>