<script>
    // @ts-nocheck

    /*
     * Pagina de edicion individual de un recurso IDH (Sergio Diaz Vazquez).
     *
     * Esta vista se monta sobre la ruta dinamica /front-sdv/[country]/[year]
     * y permite modificar los campos hdi_value, hdi_rank y hdi_change de un
     * recurso ya existente. La clave logica del recurso (country, year) no
     * es editable: forma parte de la URL y es la identidad del documento
     * en la base de datos.
     *
     * Acceso restringido por Auth0: si el usuario no esta autenticado se
     * muestra una invitacion a iniciar sesion en lugar del formulario.
     * Solo el modo E2E (?e2e=true) puede saltarse esa restriccion.
     */

    import { page } from '$app/stores';
    import { onMount } from 'svelte';

    import { initAuth, login, logout, user, isAuthenticated } from '$lib/authService.js';

    /* Lectura de los parametros dinamicos de la URL: identifican el recurso. */
    let country = $page.params.country;
    let year = $page.params.year;

    /* Modo E2E para que Playwright pueda probar PUT sin pasar por Auth0. */
    const isTestMode = typeof window !== 'undefined' && window.location.search.includes('e2e=true');
    const API = (typeof window !== 'undefined' ? window.location.origin : "") + '/api/v2/countries-idh-per-years';

    /*
     * Estado reactivo del recurso que se esta editando.
     * Se inicializa vacio y se rellena con los datos reales tras el GET
     * en onMount(). De este modo el formulario se enlaza con bind:value.
     */
    let idh = $state({
        country: "",
        year: "",
        hdi_value: 0,
        hdi_rank: 0,
        hdi_change: 0
    });

    /*
     * Mensajes de estado para el usuario.
     *   - "mensaje": texto informativo o de error mostrado en cabecera.
     *   - "esError": controla los colores (verde exito / rojo error).
     */
    let mensaje = $state("Cargando sesión...");
    let esError = $state(false);

    onMount(async () => {
        /*
         * Camino rapido en E2E: cargar datos sin pasar por Auth0.
         * Se separa del flujo normal para que Playwright no tenga que
         * lidiar con un proveedor externo de identidad.
         */
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

        /* Inicializa Auth0: gestiona callback OAuth y restaura sesion. */
        await initAuth();

        /*
         * Solo si hay sesion validada (en el store o en localStorage)
         * pedimos los datos del recurso al backend. La comprobacion de
         * localStorage cubre el momento entre montaje y propagacion del
         * store reactivo, que puede ser asincrona.
         */
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

    /*
     * Persiste los cambios via PUT al backend.
     * Tras un guardado correcto, redirige al listado principal con un
     * pequeño retardo (2 s) para que el usuario alcance a leer el mensaje
     * de confirmacion antes del cambio de pagina.
     */
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

<div
	style="display: flex; flex-direction: column; align-items: center; min-height: 80vh; font-family: sans-serif; padding: 20px;"
>
	<div
		style="width: 100%; max-width: 500px; display: flex; justify-content: space-between; margin-bottom: 20px; align-items: center; background: #f8f9fa; padding: 10px; border-radius: 8px;"
	>
		{#if $isAuthenticated || isTestMode}
			<span style="font-size: 0.9em;">Hola, <strong>{$user?.nickname || $user?.name}</strong></span>
			<button
				onclick={logout}
				style="background: #e74c3c; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;"
				>Cerrar Sesión</button
			>
		{:else}
			<span>No has iniciado sesión</span>
			<button
				onclick={login}
				style="background: #2ecc71; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;"
				>Iniciar Sesión</button
			>
		{/if}
	</div>

	<div
		style="text-align: center; padding: 40px; border: 2px solid {esError
			? '#e74c3c'
			: '#27ae60'}; border-radius: 10px; background-color: {esError
			? '#fdf2f1'
			: '#eafaf1'}; width: 100%; max-width: 500px;"
	>
		<h2 style="color: {esError ? '#c0392b' : '#2ecc71'}; margin-bottom: 20px;">
			{mensaje}
		</h2>

		{#if $isAuthenticated || isTestMode}
			{#if !esError && idh.country}
				<div style="display: flex; flex-direction: column; gap: 15px; text-align: left;">
					<label>
						<strong>Valor IDH:</strong>
						<input
							type="number"
							bind:value={idh.hdi_value}
							style="width: 100%; padding: 8px; margin-top: 5px;"
						/>
					</label>
					<label>
						<strong>Ranking:</strong>
						<input
							type="number"
							bind:value={idh.hdi_rank}
							style="width: 100%; padding: 8px; margin-top: 5px;"
						/>
					</label>
					<label>
						<strong>Cambio:</strong>
						<input
							type="number"
							bind:value={idh.hdi_change}
							style="width: 100%; padding: 8px; margin-top: 5px;"
						/>
					</label>

					<button
						onclick={updateIdh}
						style="padding: 12px; background-color: #27ae60; color: white; border: none; border-radius: 5px; font-weight: bold; cursor: pointer; margin-top: 10px;"
					>
						Guardar Cambios
					</button>
				</div>
			{/if}
		{:else}
			<div style="margin-top: 20px;">
				<p>Por favor, haz login para acceder a la edición de datos.</p>
				<button
					onclick={login}
					style="padding: 15px 30px; font-size: 1.1em; background-color: #3498db; color: white; border: none; border-radius: 5px; cursor: pointer;"
				>
					Identificarse con Auth0
				</button>
			</div>
		{/if}

		<br />
		<a
			href="/front-sdv"
			style="display: inline-block; padding: 10px 20px; background-color: #95a5a6; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; margin-top: 20px;"
		>
			Volver a la tabla
		</a>
	</div>
</div>
