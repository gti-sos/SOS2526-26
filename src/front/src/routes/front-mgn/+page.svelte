<script>
    // @ts-nocheck
    import { dev } from '$app/environment';
    import { goto } from '$app/navigation';
    import { onMount } from 'svelte';
    import { PUBLIC_AUTH0_DOMAIN_MGN, PUBLIC_AUTH0_CLIENT_ID_MGN} from '$env/static/public';
    
    // --- NUEVO: Importación de Auth0 ---
    import { createAuth0Client } from '@auth0/auth0-spa-js';

    import { env } from '$env/dynamic/public'; // <--- Importa esto (SvelteKit)

    // Usamos la variable de entorno que pasaremos por Docker, 
    // o localhost si estamos trabajando en local sin Docker.
    const BASE_URL = env.PUBLIC_API_URL || "http://localhost:3000";
    let API = BASE_URL + '/api/v2/national-team-rankings-per-years';




    // Estados de datos
    let rankings = $state([]);
    let message = $state("");
    let messageColor = $state("black");
    
    // --- ESTADOS DE BÚSQUEDA ---
    let searchCountry = $state("");
    let searchYear = $state("");
    let searchFrom = $state("");
    let searchTo = $state("");

    // --- NUEVO: ESTADOS DE AUTH0 ---
    let auth0Client = $state(null);
    const isTestMode = typeof window !== 'undefined' && 
                   window.location.search.includes('e2e=true');

    let isAuthenticated = $state(isTestMode ? true : false);
    let user = $state(isTestMode ? { name: 'Test', email: 'test@test.com', picture: 'https://via.placeholder.com/40' } : null);

    // --- NUEVO: LÓGICA DE AUTH0 EN ONMOUNT ---
    onMount(async () => {

         if (isTestMode) {
        getData(); // Solo carga datos, sin auth
        return;    // Sale del onMount
    }


        console.log("1. Inicializando Auth0...");
        auth0Client = await createAuth0Client({
            domain: PUBLIC_AUTH0_DOMAIN_MGN, 
            clientId: PUBLIC_AUTH0_CLIENT_ID_MGN,         
            authorizationParams: {
                redirect_uri: window.location.origin + window.location.pathname
            },
            cacheLocation: 'localstorage' // <-- NUEVO: Guarda la sesión para que no se pierda al recargar
        });

        // 2. Comprobamos si venimos de Google con código de éxito
        if (window.location.search.includes('code=') && window.location.search.includes('state=')) {
            console.log("2. Detectados parámetros de Google, procesando login...");
            try {
                await auth0Client.handleRedirectCallback();
                window.history.replaceState({}, document.title, window.location.pathname); 
                console.log("3. Login procesado y URL limpiada.");
            } catch (error) {
                console.error("Error en el callback de Auth0:", error);
            }
        }

        // 3. Verificamos el estado final en una variable temporal
        let isAuth = await auth0Client.isAuthenticated();
        console.log("4. ¿Usuario logueado?:", isAuth);
        
        if (isAuth) {
            user = await auth0Client.getUser(); // PRIMERO descargamos los datos
            console.log("5. Datos del usuario:", user);
            
            isAuthenticated = true; // LUEGO le decimos a Svelte que dibuje la pantalla
            getData(); 
        }
    });

    // --- NUEVO: FUNCIONES DE LOGIN / LOGOUT ---
    async function login() {
        await auth0Client.loginWithRedirect();
    }

    async function logout() {
        await auth0Client.logout({
            logoutParams: {
                returnTo: window.location.origin + window.location.pathname
            }
        });
    }
    //Funcion de redireccionamiento
    function irAEditar(country, year) {
        const testParam = isTestMode ? '?e2e=true' : '';
        goto(`/front-mgn/${country}/${year}${testParam}`);
    }

    // --- FUNCIÓN DE BÚSQUEDA ---
    async function searchRankings() {
        // Construimos la URL con los parámetros dinámicamente
        let queryParams = new URLSearchParams();

        if (searchCountry) queryParams.append("country", searchCountry);
        if (searchYear) queryParams.append("year", searchYear);
        if (searchFrom) queryParams.append("from", searchFrom);
        if (searchTo) queryParams.append("to", searchTo);

        const queryString = queryParams.toString();
        // Si hay filtros, añadimos el ?, si no, llamamos a la API normal
        const url = queryString ? `${API}?${queryString}` : API;

        const res = await fetch(url);

        if (res.ok) {
            let data = await res.json();
            // Controlar si la API devuelve un array vacío (no hay resultados pero es 200 OK)
            if (data.length === 0) {
                rankings = [];
                showMessage("No se encontraron registros con esos filtros.", true);
            } else {
                // Si tu API devuelve un objeto cuando es un solo resultado, lo convertimos a array para la tabla
                rankings = Array.isArray(data) ? data : [data];
                showMessage(`Búsqueda completada: ${rankings.length} resultado(s).`);
            }
        } else if (res.status === 404) {
            rankings = [];
            showMessage("No se ha encontrado ningún registro con esos parámetros.", true);
        } else {
            showMessage("Error al realizar la búsqueda.", true);
        }
    }

    // Función para limpiar los filtros y volver a cargar todo
    function clearSearch() {
        searchCountry = "";
        searchYear = "";
        searchFrom = "";
        searchTo = "";
        // Llama a tu función original que carga todos los datos (supongo que se llama getData o getRankings)
        getData(); 
        showMessage("Filtros limpiados. Mostrando todos los registros.");
    }

    // Campos para el formulario (Incluimos la variación)
    let newRanking = $state({
        country: "",
        year: "",
        rank: "",
        score: "",
        rank_variation_from_two_thousand_eighteen: ""
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
            // Limpiamos el formulario
            newRanking = { country: "", year: "", rank: "", score: "", rank_variation_from_two_thousand_eighteen: "" };
            
            // RECARGA AUTOMÁTICA: Si había una búsqueda activa, refrescamos la búsqueda, si no, los datos normales.
            if (searchCountry || searchYear || searchFrom || searchTo) {
                await searchRankings(); 
            } else {
                await getData();
            }
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
            
            // RECARGA AUTOMÁTICA inteligente
            if (searchCountry || searchYear || searchFrom || searchTo) {
                await searchRankings(); 
            } else {
                await getData();
            }
        } else {
            showMessage("No se ha podido eliminar el registro.", true);
        }
    }

    async function deleteAll() {
        if (confirm("¿Seguro que quieres borrar TODOS los datos? Esta acción es irreversible.")) {
            const res = await fetch(API, { method: "DELETE" });
            if (res.ok) {
                showMessage("Base de datos vaciada con éxito.");
                searchCountry = ""; searchYear = ""; searchFrom = ""; searchTo = ""; // Limpiamos variables de búsqueda
                await getData(); // Recarga automática
            }
        }
    }

    async function loadInitialData() {
        // Llama a tu endpoint específico
        const res = await fetch(API + '/loadInitialData');
        
        if (res.ok) {
            // Si usas una función para mostrar mensajes, ponla aquí
            console.log("Datos iniciales cargados correctamente.");
            showMessage("Datos iniciales Cargados.", false);
            // Refrescamos la tabla para que se vean los datos nuevos
            getData(); 
        } else {
            console.error("Error: La base de datos ya tenía datos o hubo un fallo.");
        }
    }

    onMount(getData);
</script>

<h1>Gestión de Rankings de Selecciones Nacionales</h1>

{#if !isAuthenticated}
    <div style="text-align: center; padding: 50px; background: #f9f9f9; border-radius: 8px; border: 1px solid #ccc;">
        <h2>🔐 Acceso Restringido</h2>
        <p>Inicia sesión con tu cuenta social para ver y gestionar los rankings.</p>
        <button onclick={login} style="background-color: #e67e22; color: white; border: none; padding: 15px 30px; font-size: 1.1rem; border-radius: 5px; cursor: pointer; font-weight: bold;">
            Iniciar Sesión
        </button>
    </div>
{:else}
    <div style="display: flex; justify-content: space-between; align-items: center; background: #e8f4f8; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
        <div>
            <img src={user.picture} alt="Perfil" style="width: 40px; border-radius: 50%; vertical-align: middle; margin-right: 10px;" />
            <strong>Bienvenido/a, {user.name}</strong> ({user.email})
        </div>
        <button onclick={logout} style="background-color: #7f8c8d; color: white; border: none; padding: 8px 15px; border-radius: 4px; cursor: pointer;">
            Cerrar Sesión
        </button>
    </div>

    {#if message}
        <div style="color: {messageColor}; font-weight: bold; border: 2px solid {messageColor}; padding: 10px; margin-bottom: 20px; border-radius: 5px;">
            {message}
        </div>
    {/if}

    <section style="background: #f9f9f9; padding: 20px; border-radius: 8px; border: 1px solid #ccc;">
        <h3>Añadir nuevo registro</h3>
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px;">
        <input placeholder="País (ej: España)" bind:value={newRanking.country} />
        <input type="number" placeholder="Año (ej: 2024)" bind:value={newRanking.year} />
        <input type="number" placeholder="Posición" bind:value={newRanking.rank} />
        <input type="number" placeholder="Puntos" bind:value={newRanking.score} />
        <input type="number" placeholder="Variación desde 2018" bind:value={newRanking.rank_variation_from_two_thousand_eighteen} />
    </div>
    <button onclick={insertRanking} style="margin-top: 15px; background-color: #4CAF50; color: white; border: none; padding: 10px 20px; border-radius: 5px;">
        Añadir Registro
    </button>
</section>

<hr style="margin: 30px 0;" />



<table>
    <thead>
        <tr>
            <th>País</th>
            <th>Año</th>
            <th>Posición</th>
            <th>Puntos</th>
            <th>Var. desde 2018</th>
            <th>Acciones</th>
        </tr>
    </thead>
    <tbody>
        {#each rankings as r}
            <tr>
                <td>{r.country}</td>
                <td>{r.year}</td>
                <td>{r.rank}</td>
                <td>{r.score}</td>
                <td>{r.rank_variation_from_two_thousand_eighteen}</td>
                <td>
                <button onclick={() => irAEditar(r.country, r.year)} style="color: white; background-color: #f39c12; border: none; padding: 5px 10px; border-radius: 3px; margin-right: 5px;">
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

<fieldset style="border: 1px solid #bdc3c7; padding: 15px; margin-bottom: 25px; border-radius: 8px; background-color: #f8f9fa;">
    <legend style="font-weight: bold; color: #2c3e50; padding: 0 10px;">🔍 Buscar y Filtrar</legend>
    
    <div style="display: flex; gap: 15px; flex-wrap: wrap; align-items: flex-end;">
        <div style="display: flex; flex-direction: column; gap: 5px;">
            <label for="sCountry" style="font-size: 0.9rem; font-weight: bold;">País:</label>
            <input id="sCountry" type="text" bind:value={searchCountry} placeholder="Ej: España" style="padding: 8px; border: 1px solid #ccc; border-radius: 4px;" />
        </div>

        <div style="display: flex; flex-direction: column; gap: 5px;">
            <label for="sYear" style="font-size: 0.9rem; font-weight: bold;">Año (Exacto):</label>
            <input id="sYear" type="number" bind:value={searchYear} placeholder="Ej: 2024" style="padding: 8px; border: 1px solid #ccc; border-radius: 4px; width: 100px;" />
        </div>

        <div style="display: flex; flex-direction: column; gap: 5px;">
            <label for="sFrom" style="font-size: 0.9rem; font-weight: bold;">Desde (Año):</label>
            <input id="sFrom" type="number" bind:value={searchFrom} placeholder="Ej: 2010" style="padding: 8px; border: 1px solid #ccc; border-radius: 4px; width: 100px;" />
        </div>

        <div style="display: flex; flex-direction: column; gap: 5px;">
            <label for="sTo" style="font-size: 0.9rem; font-weight: bold;">Hasta (Año):</label>
            <input id="sTo" type="number" bind:value={searchTo} placeholder="Ej: 2020" style="padding: 8px; border: 1px solid #ccc; border-radius: 4px; width: 100px;" />
        </div>

        <div style="display: flex; gap: 10px; margin-bottom: 2px;">
            <button onclick={searchRankings} style="background-color: #3498db; color: white; border: none; padding: 8px 15px; border-radius: 4px; cursor: pointer; font-weight: bold;">
                Buscar
            </button>
            <button onclick={clearSearch} style="background-color: #95a5a6; color: white; border: none; padding: 8px 15px; border-radius: 4px; cursor: pointer; font-weight: bold;">
                Limpiar
            </button>
        </div>
    </div>
</fieldset>
{/if}
<style>
    table { width: 100%; border-collapse: collapse; background: white; }
    th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
    th { background-color: #2c3e50; color: white; }
    tr:nth-child(even) { background-color: #f2f2f2; }
    button { cursor: pointer; transition: 0.3s; }
    button:hover { opacity: 0.8; }
</style>
