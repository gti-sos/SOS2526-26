<script>
    // @ts-nocheck
    import { page } from '$app/stores';
    import { onMount } from 'svelte';
    
    // Importamos las herramientas de Auth0
    import { initAuth, login, logout, user, isAuthenticated } from '$lib/authService.js';

    let country = $page.params.country;
    let year = $page.params.year;

    const isTestMode = typeof window !== 'undefined' && window.location.search.includes('e2e=true');
    const API = (typeof window !== 'undefined' ? window.location.origin : "") + '/api/v2/countries-idh-per-years';

    let idh = $state({
        country: "",
        year: "",
        hdi_value: 0,
        hdi_rank: 0,
        hdi_change: 0
    });

    let mensaje = $state("Cargando sesión...");
    let esError = $state(false);

    onMount(async () => {
        if (isTestMode) {
            mensaje = "Buscando información de IDH...";
            const res = await fetch(`${API}/${country}/${year}`);
            if (res.ok) {
                idh = await res.json();
                mensaje = `Editando registro de ${country} (${year})`;
            } else {
                esError = true;
                mensaje = res.status === 404 ? "No existe el registro." : "Error de conexión.";
            }
            return;
        }

        // 1. Inicializar Auth0
        await initAuth();

        // 2. Si está autenticado, cargar los datos de la API
        if (localStorage.getItem('auth0spajs.s.v2.user') || $isAuthenticated) {
            mensaje = "Buscando información de IDH...";
            const res = await fetch(`${API}/${country}/${year}`);
            if (res.ok) {
                idh = await res.json();
                mensaje = `Editando registro de ${country} (${year})`;
            } else {
                esError = true;
                mensaje = res.status === 404 ? "No existe el registro." : "Error de conexión.";
            }
        } else {
            mensaje = "Debes iniciar sesión para editar este registro.";
        }
    });

    async function updateIdh() {
        const res = await fetch(`${API}/${country}/${year}`, {
            method: "PUT",
            body: JSON.stringify(idh),
            headers: { "Content-Type": "application/json" }
        });

        if (res.ok) {
            mensaje = "✅ ¡Registro actualizado con éxito!";
            esError = false;
            setTimeout(() => window.location.href = "/front-sdv", 2000);
        } else {
            esError = true;
            mensaje = "❌ Error al intentar actualizar el registro.";
        }
    }
</script>

<div style="display: flex; flex-direction: column; align-items: center; min-height: 80vh; font-family: sans-serif; padding: 20px;">
    
    <div style="width: 100%; max-width: 500px; display: flex; justify-content: space-between; margin-bottom: 20px; align-items: center; background: #f8f9fa; padding: 10px; border-radius: 8px;">
        {#if $isAuthenticated || isTestMode}
            <span style="font-size: 0.9em;">Hola, <strong>{$user?.nickname || $user?.name}</strong></span>
            <button onclick={logout} style="background: #e74c3c; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;">Cerrar Sesión</button>
        {:else}
            <span>No has iniciado sesión</span>
            <button onclick={login} style="background: #2ecc71; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;">Iniciar Sesión</button>
        {/if}
    </div>

    <div style="text-align: center; padding: 40px; border: 2px solid {esError ? '#e74c3c' : '#27ae60'}; border-radius: 10px; background-color: {esError ? '#fdf2f1' : '#eafaf1'}; width: 100%; max-width: 500px;">
        
        <h2 style="color: {esError ? '#c0392b' : '#2ecc71'}; margin-bottom: 20px;">
            {mensaje}
        </h2>

        {#if $isAuthenticated || isTestMode}
            {#if !esError && idh.country}
                <div style="display: flex; flex-direction: column; gap: 15px; text-align: left;">
                    <label>
                        <strong>Valor IDH:</strong>
                        <input type="number" bind:value={idh.hdi_value} style="width: 100%; padding: 8px; margin-top: 5px;" />
                    </label>
                    <label>
                        <strong>Ranking:</strong>
                        <input type="number" bind:value={idh.hdi_rank} style="width: 100%; padding: 8px; margin-top: 5px;" />
                    </label>
                    <label>
                        <strong>Cambio:</strong>
                        <input type="number" bind:value={idh.hdi_change} style="width: 100%; padding: 8px; margin-top: 5px;" />
                    </label>

                    <button onclick={updateIdh} style="padding: 12px; background-color: #27ae60; color: white; border: none; border-radius: 5px; font-weight: bold; cursor: pointer; margin-top: 10px;">
                        Guardar Cambios
                    </button>
                </div>
            {/if}
        {:else}
            <div style="margin-top: 20px;">
                <p>Por favor, haz login para acceder a la edición de datos.</p>
                <button onclick={login} style="padding: 15px 30px; font-size: 1.1em; background-color: #3498db; color: white; border: none; border-radius: 5px; cursor: pointer;">
                    Identificarse con Auth0
                </button>
            </div>
        {/if}

        <br>
        <a href="/front-sdv" style="display: inline-block; padding: 10px 20px; background-color: #95a5a6; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; margin-top: 20px;">
            Volver a la tabla
        </a>
    </div>
</div>