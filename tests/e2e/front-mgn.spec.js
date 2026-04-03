// @ts-check
import { test, expect } from '@playwright/test';

test.describe('Pruebas E2E - Recurso MGN (Rankings)', () => {

    test.beforeAll(async ({ request }) => {
        // Limpiamos y cargamos datos frescos antes de empezar
        await request.get('/api/v2/national-team-rankings-per-years/loadInitialData');
    });

    test.beforeEach(async ({ page }) => {
        await page.goto('/front-mgn?e2e=true');
        await page.waitForSelector('table thead');
    });

    test('Debe listar todos los recursos iniciales', async ({ page }) => {
        const tableRows = page.locator('table tbody tr');
        await expect(tableRows.first()).toBeVisible({ timeout: 10000 });
        const count = await tableRows.count();
        expect(count).toBeGreaterThan(0);
    });

    test('Debe permitir buscar por país', async ({ page }) => {
        // Usamos un país que SEGURO viene en loadInitialData (ej: 'Brazil' o 'Belgium')
        // Si no estás seguro, usa uno que veas en tu JSON inicial
        const paisABuscar = 'Brazil'; 

        await page.fill('#sCountry', paisABuscar);
        
        await Promise.all([
            page.waitForResponse(res => res.url().includes('national-team-rankings-per-years') && res.status() === 200),
            page.click('button:has-text("Buscar")')
        ]);

        // Esperamos a que la tabla se actualice. Buscamos el texto en CUALQUIER parte de la tabla filtrada
        await expect(page.locator('table tbody')).toContainText(paisABuscar, { timeout: 7000 });
    });

    test('Debe crear un nuevo recurso completo', async ({ page }) => {
        const countryName = "Narnia_" + Math.floor(Math.random() * 10000);
        await page.getByPlaceholder('País (ej: España)').fill(countryName);
        await page.getByPlaceholder('Año (ej: 2024)').fill('2026');
        await page.getByPlaceholder('Posición').fill('1');
        await page.getByPlaceholder('Puntos').fill('2000');
        await page.getByPlaceholder('Variación desde 2018').fill('10');
        
        await Promise.all([
            page.waitForResponse(res => res.request().method() === 'POST' && res.status() < 300),
            page.click('button:has-text("Añadir Registro")')
        ]);

        await expect(page.locator('table')).toContainText(countryName);
    });

    test('Debe borrar un recurso', async ({ page }) => {
        // Esperamos a que haya filas
        const rows = page.locator('table tbody tr');
        await expect(rows.first()).toBeVisible();
        const initialCount = await rows.count();
        
        // Identificamos el botón de la primera fila
        const firstRowDeleteBtn = rows.first().locator('button:has-text("Eliminar")');

        await Promise.all([
            page.waitForResponse(res => res.request().method() === 'DELETE' && res.status() === 200),
            firstRowDeleteBtn.click()
        ]);
        
        // Verificamos que el número de filas ha bajado
        await expect(rows).toHaveCount(initialCount - 1, { timeout: 7000 });
    });

    test('Debe editar la posición de un recurso', async ({ page }) => {
        // 1. Entrar en edición
        await page.locator('table tbody tr').first().locator('button:has-text("Editar")').click();
        
        // 2. Esperar a estar en la página de edición (comprobamos que el botón de guardar sea visible)
        const saveBtn = page.locator('button:has-text("Guardar cambios")');
        await expect(saveBtn).toBeVisible({ timeout: 10000 });

        // 3. Editar el primer input de número (Posición)
        const posInput = page.locator('input[type="number"]').first();
        await posInput.fill('7777'); 
        
        // 4. Guardar y esperar navegación de vuelta
        await Promise.all([
            page.waitForNavigation({ url: /.*front-mgn.*/ }), // Espera a que la URL cambie de vuelta
            saveBtn.click()
        ]);

        // 5. Confirmar que el dato se ve en la tabla principal
        await expect(page.locator('table')).toContainText('7777', { timeout: 10000 });
    });

    test('Debe editar los puntos de un recurso', async ({ page }) => {
        await page.locator('table tbody tr').first().locator('button:has-text("Editar")').click();
        
        const saveBtn = page.locator('button:has-text("Guardar cambios")');
        await expect(saveBtn).toBeVisible();

        // El segundo input numérico son los Puntos
        const pointsInput = page.locator('input[type="number"]').nth(1); 
        await pointsInput.fill('8888');
        
        await Promise.all([
            page.waitForNavigation({ url: /.*front-mgn.*/ }),
            saveBtn.click()
        ]);

        await expect(page.locator('table')).toContainText('8888', { timeout: 10000 });
    });
});