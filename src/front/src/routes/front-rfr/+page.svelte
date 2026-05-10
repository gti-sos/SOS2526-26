<script>
// @ts-nocheck

    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import { env } from '$env/dynamic/public'; // <--- Importa esto (SvelteKit)

    // Usamos el mismo origen donde se sirve la app para evitar
    // que E2E en build de producción apunte al backend remoto.
    const BASE_URL = typeof window !== 'undefined' ? window.location.origin : "";
    let API = BASE_URL + '/api/v2/fifa-squad-value-per-years';

    // 2. Estados (Svelte 5)
    let rankings = $state([]);
    let message = $state("");
    let messageColor = $state("black");
    let offset = $state(0); 
    const LIMIT = 10;

    // Campos para el formulario (Incluimos la variación)
    let newRanking = $state({
        country: "",
        year: "",
        squad_size: "",
        total_market_value: "",
        average_market_value: ""
    });

    // 3. Mensajes humanizados
    function showMessage(msg, isError = false) {
        message = msg;
        messageColor = isError ? "red" : "green";
        setTimeout(() => { message = ""; }, 4000);
    }

    // 4. Lógica CRUD
    async function getData(){
        const res = await fetch(API);
        if (res.ok) {
            rankings = await res.json();
        } else {
            showMessage("Error al cargar los datos del servidor", true);
        }
    }

    async function insertRanking() {
        const res = await fetch(API, {
            method: "POST",
            body: JSON.stringify(newRanking),
            headers: { "Content-Type": "application/json" }
        });

        if (res.status === 201) {
            showMessage(`¡${newRanking.country} (${newRanking.year}) añadido correctamente!`);
            // Limpiamos el formulario tras el éxito
            newRanking = { country: "", year: "", squad_size: "", total_market_value: "", average_market_value: "" };
            getData(); 
        } else if (res.status === 409) {
            showMessage(`Error: El ranking de ${newRanking.country} para el año ${newRanking.year} ya existe.`, true);
        } else if (res.status === 400) {
            showMessage("Error: Asegúrate de rellenar todos los campos correctamente.", true);
        } else {
            showMessage("Error inesperado al intentar guardar.", true);
        }
    }

    async function deleteRanking(country, year) {
        const res = await fetch(`${API}/${country}/${year}`, { method: "DELETE" });
        if (res.ok) {
            showMessage(`Se ha eliminado el registro de ${country}.`);
            getData();
        } else {
            showMessage("No se ha podido eliminar el registro.", true);
        }
    }

    async function deleteAll() {
        if (confirm("¿Seguro que quieres borrar TODOS los datos? Esta acción es irreversible.")) {
            const res = await fetch(API, { method: "DELETE" });
            if (res.ok) {
                showMessage("Base de datos vaciada con éxito.");
                getData();
            }
        }
    }
 async function loadInitialData() {
        const res = await fetch(`${API}/loadInitialData`);
        
        if (res.ok) {
            showMessage("Datos iniciales cargados correctamente.");
            // Una vez cargados en el servidor, refrescamos la lista local
            getData(); 
        } else {
            showMessage("Error al intentar cargar los datos iniciales.", true);
        }
    };

    onMount(getData);


    function resetSearch() {
        search = { from: "", to: "", country: "" };
        getData(); // Recarga la lista completa
    }


    let search = $state({
        from: "", to: "",
        country: "",
        squad_size_min: "", squad_size_max: "",
        total_value_min: "", total_value_max: "",
        avg_value_min: "", avg_value_max: ""
    });

    async function handleSearch() {
        const params = new URLSearchParams();
        
        // Solo añadimos a la URL lo que el usuario haya escrito
        Object.keys(search).forEach(key => {
            if (search[key] !== "") params.append(key, search[key]);
        });

        params.append("limit", 10);
        params.append("offset", offset);

        const res = await fetch(`${API}?${params.toString()}`);
        if (res.ok) rankings = await res.json();
    }


function nextPage() {
        offset += LIMIT;
        handleSearch();
    }

    function prevPage() {
        if (offset >= LIMIT) {
            offset -= LIMIT;
            handleSearch();
        }
    }

</script>

<h1>Gestión de Valor de Mercado de Selecciones Nacionales</h1>

{#if message}
    <div style="color: {messageColor}; font-weight: bold; border: 2px solid {messageColor}; padding: 10px; margin-bottom: 20px; border-radius: 5px;">
        {message}
    </div>
{/if}

<section style="background: #f9f9f9; padding: 20px; border-radius: 8px; border: 1px solid #ccc;">
    <h3>Añadir nuevo registro</h3>
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px;">
        <input name="country" placeholder="País (ej: España)" bind:value={newRanking.country} />
        <input name="year" type="number" placeholder="Año (ej: 2024)" bind:value={newRanking.year} />
        <input name="squad_size" type="number" placeholder="Tamaño de plantilla" bind:value={newRanking.squad_size} />
        <input name="total_market_value" type="number" placeholder="Valor total de mercado" bind:value={newRanking.total_market_value} />
        <input name="average_market_value" type="number" placeholder="Valor medio de plantilla" bind:value={newRanking.average_market_value} />
    </div>
    <button name="add-button" onclick={insertRanking} style="margin-top: 15px; background-color: #4CAF50; color: white; border: none; padding: 10px 20px; border-radius: 5px;">
        Añadir Registro
    </button>
    
    <div class="filter-grid">
    <div class="filter-group">
        <input type="text" placeholder="País" bind:value={search.country} />
        <input type="number" name="filter-from" placeholder="Año desde" bind:value={search.from} />
        <input type="number" name="filter-to" placeholder="Año hasta" bind:value={search.to} />
    </div>

    <div class="filter-group">
        <label>Plantilla:</label>
        <input type="number" placeholder="Min" bind:value={search.squad_size_min} />
        <input type="number" placeholder="Max" bind:value={search.squad_size_max} />
    </div>

    <div class="filter-group">
        <label>Valor Total:</label>
        <input type="number" placeholder="Min M€" bind:value={search.total_value_min} />
        <input type="number" placeholder="Max M€" bind:value={search.total_value_max} />
    </div>

    <div class="filter-group">
       <label>Valor Promedio:</label>
       <input type="number" step="0.1" placeholder="Min M€" bind:value={search.avg_value_min} />
       <input type="number" step="0.1" placeholder="Max M€" bind:value={search.avg_value_max} />
    </div>

    <button name="filter-button" onclick={() => { offset = 0; handleSearch(); }}>🔍 Aplicar Filtros Avanzados</button>
</div>
</section>

<hr style="margin: 30px 0;" />

<table>
    <thead>
        <tr>
            <th>País</th>
            <th>Año</th>
            <th>Tamaño de plantilla</th>
            <th>Valor total de mercado</th>
            <th>Valor medio de plantilla</th>
            <th>Acciones</th>
        </tr>
    </thead>
    <tbody>
        {#each rankings as r}
            <tr>
                <td>{r.country}</td>
                <td>{r.year}</td>
                <td>{r.squad_size}</td>
                <td>{r.total_market_value}</td>
                <td>{r.average_market_value}</td>
                <td>
                    <button onclick={() => goto(`/front-rfr/${r.country}/${r.year}`)} style="color: white; background-color: #f39c12; border: none; padding: 5px 10px; border-radius: 3px; margin-right: 5px;">
                        Editar
                    </button>
                    <button onclick={() => deleteRanking(r.country, r.year)} style="color: white; background-color: #e74c3c; border: none; padding: 5px 10px; border-radius: 3px;">
                        Eliminar
                    </button>
                </td>
            </tr>
        {/each}
    </tbody>
</table>

<div style="margin-top: 20px; display: flex; gap: 10px;">
    <button onclick={loadInitialData} style="background-color: #3498db; color: white; border: none; padding: 10px;">Actualizar Lista</button>
    <button onclick={deleteAll} style="background-color: #c0392b; color: white; border: none; padding: 10px;">BORRAR TODO</button>
    <div class="pagination">
    <button onclick={prevPage} disabled={offset === 0}>Anterior</button>
    <span>Página actual: {(offset / LIMIT) + 1}</span>
    <button onclick={nextPage} disabled={rankings.length < LIMIT}>Siguiente</button>
</div>
</div>

<style>
    table { width: 100%; border-collapse: collapse; background: white; }
    th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
    th { background-color: #2c3e50; color: white; }
    tr:nth-child(even) { background-color: #f2f2f2; }
    button { cursor: pointer; transition: 0.3s; }
    button:hover { opacity: 0.8; }
    
</style>