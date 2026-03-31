<script>
    import { page } from '$app/stores';
    import { onMount } from 'svelte';
    import { dev } from '$app/environment';


    let country = $page.params.country;
    let year = $page.params.year;
    
    let API = '/api/v2/fifa-squad-value-per-years';
    if(dev) API = "http://localhost:3000" + API;

    // ESTADOS (Svelte 5)
    let ranking = $state({
        country: "",
        year: "",
        squad_size: 0,
        total_market_value: 0,
        average_market_value: 0
    });
    let mensaje = $state("Cargando datos...");
    let esError = $state(false);

    // 1. Cargar los datos al entrar
    onMount(async () => {
        const res = await fetch(`${API}/${country}/${year}`);
        if (res.ok) {
            ranking = await res.json();
            mensaje = `Editando registro de ${country} (${year})`;
            esError = false;
        } else {
            esError = true;
            mensaje = res.status === 404 
                ? `No existe el registro de '${country}' para '${year}'.` 
                : "Error de conexión con el servidor.";
        }
    });

    // 2. Función para guardar los cambios (PUT)
    async function updateRanking() {
        const res = await fetch(`${API}/${country}/${year}`, {
            method: "PUT",
            body: JSON.stringify(ranking),
            headers: { "Content-Type": "application/json" }
        });

        if (res.ok) {
            mensaje = "✅ ¡Registro actualizado con éxito!";
            esError = false;
            // Opcional: volver a la tabla después de 2 segundos
            setTimeout(() => window.location.href = "/front-rfr", 2000);
        } else {
            esError = true;
            mensaje = "❌ Error al intentar actualizar el registro.";
        }
    }
</script>

<div style="display: flex; justify-content: center; align-items: center; min-height: 80vh; font-family: sans-serif; padding: 20px;">
    <div style="text-align: center; padding: 40px; border: 2px solid {esError ? '#e74c3c' : '#27ae60'}; border-radius: 10px; background-color: {esError ? '#fdf2f1' : '#eafaf1'}; width: 100%; max-width: 500px;">
        
        <h2 style="color: {esError ? '#c0392b' : '#2ecc71'}; margin-bottom: 20px;">
            {mensaje}
        </h2>

        {#if !esError && ranking.country}
            <div style="display: flex; flex-direction: column; gap: 15px; text-align: left;">
                <label>
                    <strong>Tamaño de plantilla:</strong>
                    <input type="number" bind:value={ranking.squad_size} style="width: 100%; padding: 8px; margin-top: 5px;" />
                </label>
                <label>
                    <strong>Valor total mercado:</strong>
                    <input type="number" bind:value={ranking.total_market_value} style="width: 100%; padding: 8px; margin-top: 5px;" />
                </label>
                <label>
                    <strong>Valor medio plantilla:</strong>
                    <input type="number" bind:value={ranking.average_market_value} style="width: 100%; padding: 8px; margin-top: 5px;" />
                </label>

                <button onclick={updateRanking} style="padding: 12px; background-color: #27ae60; color: white; border: none; border-radius: 5px; font-weight: bold; cursor: pointer; margin-top: 10px;">
                    Guardar Cambios
                </button>
            </div>
        {/if}

        <br>
        <a href="/front-rfr" style="display: inline-block; padding: 10px 20px; background-color: #3498db; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; margin-top: 20px;">
            Volver a la tabla
        </a>
    </div>
</div>