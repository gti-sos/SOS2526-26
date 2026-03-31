<script>
    import { page } from '$app/stores';
    import { onMount } from 'svelte';
    import { dev } from '$app/environment';

    // Saca 'Narnia' y '2050' directamente de la URL
    let country = $page.params.country;
    let year = $page.params.year;
    
    let API = '/api/v1/national-team-rankings-per-years';
    if(dev) {
        API = "http://localhost:3000" + API;
    }

    let mensaje = $state("Buscando información...");
    let esError = $state(false);

    onMount(async () => {
        // Hacemos la petición a la API con los datos de la URL
        const res = await fetch(`${API}/${country}/${year}`);
        
        if (res.status === 404) {
            esError = true;
            // AQUÍ ESTÁ EL REQUISITO EXACTO DEL BACKLOG
            mensaje = `No existe ningún registro del país '${country}' para el año '${year}'.`;
        } else if (res.status === 200) {
            esError = false;
            mensaje = `✅ El registro de ${country} para el año ${year} existe correctamente.`;
        } else {
            esError = true;
            mensaje = "Error de conexión con el servidor.";
        }
    });
</script>

<div style="display: flex; justify-content: center; align-items: center; height: 60vh; font-family: sans-serif;">
    <div style="text-align: center; padding: 40px; border: 2px solid {esError ? '#e74c3c' : '#27ae60'}; border-radius: 10px; background-color: {esError ? '#fdf2f1' : '#eafaf1'};">
        
        <h2 style="color: {esError ? '#c0392b' : '#2ecc71'};">
            {mensaje}
        </h2>

        <br>
        <a href="/front-mgn" style="display: inline-block; padding: 10px 20px; background-color: #3498db; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; margin-top: 20px;">
            Volver a la tabla
        </a>
    </div>
</div>