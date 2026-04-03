// @ts-check
import { test, expect } from '@playwright/test';

// Al quitar el mode: 'serial', Playwright ejecutará esto en paralelo automáticamente.
test.describe('Pruebas E2E - Recurso MGN (Rankings)', () => {

    // Cargamos los datos iniciales
    test.beforeAll(async ({ request }) => {
        await request.get('/api/v2/national-team-rankings-per-years/loadInitialData');
    });

    test.beforeEach(async ({ page }) => {
        await page.goto('/front-mgn?e2e=true');
        await page.waitForSelector('table tbody tr');
    });

    test('Debe listar todos los recursos iniciales', async ({ page }) => {
        const tableRows = page.locator('table tbody tr');
        await expect(tableRows.first()).toBeVisible();
        // Solo comprobamos que haya algo, no el número exacto, porque otro test podría estar añadiendo datos
        expect(await tableRows.count()).toBeGreaterThan(0);
    });

    test('Debe permitir filtrar por rango de años', async ({ page }) => {
        await page.locator('#sFrom').fill('2020');
        await page.locator('#sTo').fill('2025');
        await page.click('button:has-text("Buscar")');

        const tableRows = page.locator('table tbody tr');
        await expect(tableRows).not.toHaveCount(0);
    });

    test('Debe crear un nuevo recurso completo', async ({ page }) => {
        // Usamos un nombre muy único para que no choque con los datos iniciales
        await page.getByPlaceholder('País (ej: España)').fill('Wakanda');
        await page.getByPlaceholder('Año (ej: 2024)').fill('3030'); 
        await page.getByPlaceholder('Posición').fill('1');
        await page.getByPlaceholder('Puntos').fill('2500');
        await page.getByPlaceholder('Variación desde 2018').fill('5');
        
        await page.click('button:has-text("Añadir Registro")');

        // Verificamos por texto, no por número de filas
        await expect(page.locator('table')).toContainText('Wakanda');
    });

    test('Debe borrar un recurso específico', async ({ page }) => {
        await page.getByPlaceholder('País (ej: España)').fill('Prueba');
        await page.getByPlaceholder('Año (ej: 2024)').fill('3030'); 
        await page.getByPlaceholder('Posición').fill('1');
        await page.getByPlaceholder('Puntos').fill('2500');
        await page.getByPlaceholder('Variación desde 2018').fill('5');
        
        await page.click('button:has-text("Añadir Registro")');

        
        const rowToDelete = page.locator('table tbody tr', { hasText: 'Prueba' }).first();
        await rowToDelete.waitFor({ state: 'visible', timeout: 5000 });

        await rowToDelete.locator('button:has-text("Eliminar")').click();

        
        await expect(page.locator('table')).not.toContainText('Prueba');
    });

    test('Debe editar un recurso específico', async ({ page }) => {
        // 1. Buscamos OTRO país distinto para editar, para que no coincida con el test de borrar
        // IMPORTANTE: Cambia 'Francia' por un país real de tu loadInitialData
        const rowToEdit = page.locator('table tbody tr', { hasText: 'Alemania' }).first();
        
        await expect(rowToEdit).toBeVisible();

        // 2. Le damos a editar a esa fila en concreto
        await rowToEdit.locator('button:has-text("Editar")').click();
        
        const inputPos = page.locator('input[type="number"]').first();
        
        // 3. Esperamos a que el input se rellene
        await expect(inputPos).not.toHaveValue('');
        
        // Escribimos el valor único y guardamos
        await inputPos.fill('888'); 
        await page.click('button:has-text("Guardar Cambios")');
        
        // 4. Verificamos que el 888 se ha guardado y aparece en la tabla
        await expect(page.locator('table')).toContainText('888');
    });
});