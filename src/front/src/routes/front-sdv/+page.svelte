<script>
    // @ts-nocheck
    import { dev } from '$app/environment';
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';

    // 1. Configuración de la API
    let API = '/api/v2/countries-idh-per-years';
    if(dev) {
        API = "http://localhost:3000" + API;
    }

    // 2. Estados (Svelte 5)
    let idhs = $state([]);
    let message = $state("");
    let messageColor = $state("black");

    // Campos exactos de tu lógica: country, year, hdi_value, hdi_rank, hdi_change
    let newIdh = $state({
        country: "",
        year: "",
        hdi_value: "",
        hdi_rank: "",
        hdi_change: ""
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
            idhs = await res.json();
        } else {
            showMessage("Error al cargar los datos del servidor", true);
        }
    }

    async function insertIdh() {
        const res = await fetch(API, {
            method: "POST",
            body: JSON.stringify(newIdh),
            headers: { "Content-Type": "application/json" }
        });

        if (res.status === 201) {
            showMessage(`¡${newIdh.country} (${newIdh.year}) añadido correctamente!`);
            // Limpiamos el formulario con tus campos exactos
            newIdh = { country: "", year: "", hdi_value: "", hdi_rank: "", hdi_change: "" };
            getData(); 
        } else if (res.status === 409) {
            showMessage(`Error: El registro de ${newIdh.country} para el año ${newIdh.year} ya existe.`, true);
        } else if (res.status === 400) {
            showMessage("Error: Asegúrate de rellenar todos los campos correctamente.", true);
        } else {
            showMessage("Error inesperado al intentar guardar.", true);
        }
    }

    async function deleteIdh(country, year) {
        const res = await fetch(`${API}/${country}/${year}`, { method: "DELETE" });
        if (res.ok) {
            showMessage(`Se ha eliminado el registro de ${country} (${year}).`);
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
    // Nueva función para cargar los datos iniciales
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
            idhs = []; // Limpiamos la tabla
            showMessage("No existe ningún recurso para esos filtros", true);
            return;
        }

        if (res.ok) {
            const data = await res.json();
            idhs = data;
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

<h1>Gestión de IDH (Sergio Díaz)</h1>

{#if message}
    <div style="color: {messageColor}; font-weight: bold; border: 2px solid {messageColor}; padding: 10px; margin-bottom: 20px; border-radius: 5px;">
        {message}
    </div>
{/if}

<section style="background: #f9f9f9; padding: 20px; border-radius: 8px; border: 1px solid #ccc;">
    <h3>Añadir nuevo registro de IDH</h3>
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px;">
        <input name = "country" placeholder="País (ej: España)" bind:value={newIdh.country} />
        <input type="number" name = "year" placeholder="Año (ej: 2024)" bind:value={newIdh.year} />
        <input type="number" name = "hdi_value" step="0.001" placeholder="Valor IDH (hdi_value)" bind:value={newIdh.hdi_value} />
        <input type="number" name = "hdi_rank" placeholder="Ranking (hdi_rank)" bind:value={newIdh.hdi_rank} />
        <input type="number" name = "hdi_change" placeholder="Cambio (hdi_change)" bind:value={newIdh.hdi_change} />
    </div>
    <button name = "add-button"onclick={insertIdh} style="margin-top: 15px; background-color: #4CAF50; color: white; border: none; padding: 10px 20px; border-radius: 5px;">
        Añadir Registro
    </button>
    <div style="margin-bottom: 20px; padding: 15px; border: 1px solid #ddd; background: #f4f4f4;">
      <strong>Buscar: </strong>
      <input name = "filter-country" type="text" placeholder="País" bind:value={search.country} />
      <input name = "filter-from" type="number" placeholder="Desde (año)" bind:value={search.from} />
      <input name = "filter-to" type="number" placeholder="Hasta (año)" bind:value={search.to} />
    
      <button name = "filter-button" onclick={handleSearch}>Filtrar</button>
      <button onclick={resetSearch}>Limpiar</button>
    </div>
</section>

<hr style="margin: 30px 0;" />

<table>
    <thead>
        <tr>
            <th>País</th>
            <th>Año</th>
            <th>Valor IDH</th>
            <th>Ranking</th>
            <th>Cambio</th>
            <th>Acciones</th>
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
                <td>
                    <button onclick={() => goto(`/front-sdv/${i.country}/${i.year}`)} style="color: white; background-color: #f39c12; border: none; padding: 5px 10px; border-radius: 3px; margin-right: 5px;">
                        Editar
                    </button>
                    <button onclick={() => deleteIdh(i.country, i.year)} style="color: white; background-color: #e74c3c; border: none; padding: 5px 10px; border-radius: 3px;">
                        EliminarHOLA
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