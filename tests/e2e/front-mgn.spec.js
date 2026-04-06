// @ts-check
import { test, expect } from '@playwright/test';
test.describe('Pruebas E2E - Recurso MGN (Rankings)', () => {


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
       
        const rowToEdit = page.locator('table tbody tr', { hasText: 'Alemania' }).first();
        
        await expect(rowToEdit).toBeVisible();

       
        await rowToEdit.locator('button:has-text("Editar")').click();
        
        const inputPos = page.locator('input[type="number"]').first();
        
       
        await expect(inputPos).not.toHaveValue('');
        
       
        await inputPos.fill('888'); 
        await page.click('button:has-text("Guardar Cambios")');
        
       
        await expect(page.locator('table')).toContainText('888');
    });

   test('Debe borrar todos los recursos existentes con confirmación', async ({ page }) => {
    // 1. Preparamos la espera de la respuesta DELETE ANTES de cualquier acción
    const deleteAllPromise = page.waitForResponse(res =>
        res.url().includes('national-team-rankings-per-years') &&
        res.request().method() === 'DELETE' &&
        res.status() === 200
    );

    // 2. Registramos el handler del diálogo de confirmación ANTES del clic
    page.once('dialog', async dialog => {
        // Puedes verificar el mensaje si quieres
        expect(dialog.message()).toContain('borrar'); // opcional
        await dialog.accept();
    });

    // 3. Hacemos clic en el botón (dispara el confirm())
    await page.click('button:has-text("BORRAR TODO")');

    // 4. Esperamos a que la API responda tras la confirmación
    await deleteAllPromise;

    // 5. Verificamos que la tabla ya no tenga filas de datos
    const tableRows = page.locator('table tbody tr');
    const rowCount = await tableRows.count();
    expect(rowCount).toBeLessThanOrEqual(2);
});
});
