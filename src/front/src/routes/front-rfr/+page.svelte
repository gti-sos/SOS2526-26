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

// ... tus otros estados ...
    let search = $state({
        from: "",
        to: "",
        country: ""
    });

    async function handleSearch() {
        const query = new URLSearchParams();
        if (search.from) query.append("from", search.from);
        if (search.to) query.append("to", search.to);
        if (search.country) query.append("country", search.country);

         try {
        const res = await fetch(`${API}?${query.toString()}`);

        if (res.status === 404) {
            // Manejo específico si el servidor devuelve 404
            rankings = []; // Limpiamos la tabla
            showMessage("No existe ningún recurso para esos filtros", true);
            return;
        }

        if (res.ok) {
            const data = await res.json();
            rankings = data;
            if (data.length === 0) {
                showMessage("No existe ningún recurso para esos filtros", true);
            }
        } else {
            showMessage("Error al realizar la búsqueda", true);
        }
    } catch (error) {
        console.error(error);
        showMessage("Error de conexión con el servidor", true);
    }
        
        }
        

    function resetSearch() {
        search = { from: "", to: "", country: "" };
        getData(); // Recarga la lista completa
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
    
    <div style="margin-bottom: 20px; padding: 15px; border: 1px solid #ddd; background: #f4f4f4;">
      <strong>Buscar: </strong>
      <input name="filter-country" type="text" placeholder="País" bind:value={search.country} />
      <input name="filter-from" type="number" placeholder="Desde (año)" bind:value={search.from} />
      <input name="filter-to" type="number" placeholder="Hasta (año)" bind:value={search.to} />
    
      <button name="filter-button" onclick={handleSearch}>Filtrar</button>
      <button onclick={resetSearch}>Limpiar</button>
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
</div>

<style>
    table { width: 100%; border-collapse: collapse; background: white; }
    th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
    th { background-color: #2c3e50; color: white; }
    tr:nth-child(even) { background-color: #f2f2f2; }
    button { cursor: pointer; transition: 0.3s; }
    button:hover { opacity: 0.8; }
</style>