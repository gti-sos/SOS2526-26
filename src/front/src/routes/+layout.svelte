<script>
    import { onMount } from 'svelte';
    import { initAuth } from '$lib/authService.js';

    onMount(async () => {
        await initAuth();
    });
</script>

<slot />