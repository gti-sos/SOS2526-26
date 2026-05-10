// @ts-check
import { test, expect } from '@playwright/test';

test.describe('Pruebas E2E - Recurso RFR', () => {
    const API = '/api/v2/fifa-squad-value-per-years';
    const seeded = {
        country: 'Seedland',
        year: 2026,
        squad_size: 26,
        total_market_value: 1234,
        average_market_value: 47
    };

    test.beforeAll(async ({ request }) => {
        // Limpiamos y cargamos datos iniciales
        await request.delete(API);
        await request.get(`${API}/loadInitialData`);
    });

    test.beforeEach(async ({ page, request }) => {
        // Insertamos el recurso de prueba antes de cada test
        await request.post(API, { data: seeded });
        await page.goto('/front-rfr');
        await page.waitForSelector('table');
    });

    test('Debe listar todos los recursos iniciales', async ({ page }) => {
        // Forzamos un filtrado por el país "Seedland" para asegurar que aparece el primero (por la paginación)
        await page.locator('input[placeholder="País"]').fill(seeded.country);
        await page.click('button[name="filter-button"]');
        
        await expect(page.locator('table')).toContainText(seeded.country);
        const count = await page.locator('table tbody tr').count();
        expect(count).toBeGreaterThan(0);
    });

    test('Debe permitir filtrar por año', async ({ page }) => {
        // Asegúrate de que el input en Svelte tenga name="filter-from"
        await page.locator('input[name="filter-from"]').fill(String(seeded.year));
        await page.locator('input[name="filter-to"]').fill(String(seeded.year));
        
        // Esperamos a que la petición termine
        const responsePromise = page.waitForResponse(res => 
            res.url().includes('limit=') && res.status() === 200
        );
        
        await page.click('button[name="filter-button"]');
        await responsePromise;

        // Comprobamos que en la tabla aparece el año correcto
        await expect(page.locator('table tbody')).toContainText(String(seeded.year));
    });

    test('Debe borrar un recurso', async ({ page }) => {
        // 1. Filtramos para que aparezca el que queremos borrar (evita problemas de paginación)
        await page.locator('input[placeholder="País"]').fill(seeded.country);
        await page.click('button[name="filter-button"]');
        
        const deletePromise = page.waitForResponse(res => 
            res.request().method() === 'DELETE' && res.status() === 200
        );
        
        // 2. Click en eliminar del primero que coincida
        await page.locator('table tbody tr', { hasText: seeded.country }).first().locator('button:has-text("Eliminar")').click();
        await deletePromise;
        
        await expect(page.locator('table')).not.toContainText(seeded.country);
    });

    test('Debe editar un recurso existente', async ({ page }) => {
        // 1. Filtramos para encontrar el recurso
        await page.locator('input[placeholder="País"]').fill(seeded.country);
        await page.click('button[name="filter-button"]');

        await page.locator('table tbody tr', { hasText: seeded.country }).first().locator('button:has-text("Editar")').click();
        
        // Esperamos a estar en la página de edición
        await expect(page).toHaveURL(/\/front-rfr\/.+/);

        // Cambiamos el squad_size a 99 (buscando el input por su valor actual o nombre)
        const inputSquad = page.locator('input[name="squad_size"]');
        await inputSquad.fill('99'); 
        
        await page.click('button:has-text("Guardar")'); // Ajusta al texto real de tu botón

        // Volvemos y filtramos para ver el cambio
        await page.goto('/front-rfr');
        await page.locator('input[placeholder="País"]').fill(seeded.country);
        await page.click('button[name="filter-button"]');
        await expect(page.locator('table')).toContainText('99');
    });
});