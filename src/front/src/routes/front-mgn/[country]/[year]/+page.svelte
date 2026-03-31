<script>
    import { page } from '$app/stores';
    import { onMount } from 'svelte';
    import { dev } from '$app/environment';
    import { goto } from '$app/navigation';

    let country = $page.params.country;
    let year = $page.params.year;

    let API = '/api/v2/national-team-rankings-per-years';
    if(dev) {
        API = "http://localhost:3000" + API;
    }

    let ranking = $state({ rank: "", score: "", rank_variation_from_two_thousand_eighteen: "" });
    let mensaje = $state("");
    let esError = $state(false);

    const isTestMode = typeof window !== 'undefined' && 
                       window.location.search.includes('e2e=true');

    onMount(async () => {
        const res = await fetch(`${API}/${country}/${year}`);
        if (res.ok) {
            ranking = await res.json();
        } else {
            esError = true;
            mensaje = `No existe ningún registro de '${country}' para ${year}.`;
        }
    });

    async function guardar() {
        const res = await fetch(`${API}/${country}/${year}`, {
            method: "PUT",
            body: JSON.stringify(ranking),
            headers: { "Content-Type": "application/json" }
        });

        if (res.ok) {
            const testParam = isTestMode ? '?e2e=true' : '';
            goto(`/front-mgn${testParam}`);
        } else {
            esError = true;
            mensaje = "Error al guardar los cambios.";
        }
    }
</script>

<div style="max-width: 500px; margin: 40px auto; font-family: sans-serif;">
    <h2>Editar: {country} ({year})</h2>

    {#if mensaje}
        <p style="color: {esError ? 'red' : 'green'}">{mensaje}</p>
    {/if}

    <label>Posición:</label>
    <input type="number" bind:value={ranking.rank} /><br><br>

    <label>Puntos:</label>
    <input type="number" bind:value={ranking.score} /><br><br>

    <label>Variación desde 2018:</label>
    <input type="number" bind:value={ranking.rank_variation_from_two_thousand_eighteen} /><br><br>

    <button onclick={guardar}>Guardar cambios</button>
    <a href="/front-mgn">Volver</a>
</div>