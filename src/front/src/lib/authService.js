// authService.js
import { createAuth0Client } from '@auth0/auth0-spa-js';
import { writable } from 'svelte/store';

export const user = writable(null);
export const isAuthenticated = writable(false);
/** @type {any} */
export let auth0Client;

export async function initAuth() {
    auth0Client = await createAuth0Client({
        domain: 'dev-1gogye5lzvh8sgh7.us.auth0.com',
        clientId: 'aqaWTLIbRpGCRi6TrVxi5DI48aG87uMW',
        authorizationParams: {
            redirect_uri: window.location.origin
        },
        cacheLocation: 'localstorage',
        useRefreshTokens: true
    });

    const query = window.location.search;
    if (query.includes("code=") && query.includes("state=")) {
        const result = await auth0Client.handleRedirectCallback();
        
        // Obtenemos la ruta a la que queríamos ir
        const target = result?.appState?.target || window.location.pathname;
        
        // --- LÍNEA CLAVE PARA EL REFRESCO REAL ---
        // En lugar de history.replaceState, usamos esto para que el navegador recargue
        window.location.href = target; 
        return; // Cortamos la ejecución aquí porque la página va a recargar
    }

    const authStatus = await auth0Client.isAuthenticated();
    isAuthenticated.set(authStatus);
    if (authStatus) {
        user.set(await auth0Client.getUser());
    }
}

export async function login() {
    await auth0Client.loginWithRedirect({
        appState: { target: window.location.pathname }
    });
}

export async function logout() {
    await auth0Client.logout({ logoutParams: { returnTo: window.location.origin } });
}