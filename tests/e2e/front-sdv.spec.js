// @ts-check
import { test, expect } from '@playwright/test';

test.describe('Pruebas E2E - Recurso SDV', () => {

    test.beforeAll(async ({ request }) => {
        // Asegúrate de que esta ruta sea la correcta para cargar tus datos de IDH
        await request.get('/api/v2/countries-idh-per-years/loadInitialData');
    });

    test.beforeEach(async ({ page }) => {
        await page.goto('/front-sdv');
        // Esperamos a que la tabla tenga contenido antes de empezar
        await page.waitForSelector('table tbody tr');
    });

    test('Debe listar todos los recursos iniciales', async ({ page }) => {
        const tableRows = page.locator('table tbody tr');
        await expect(tableRows.first()).toBeVisible();
        const count = await tableRows.count();
        expect(count).toBeGreaterThan(0);
    });

    test('Debe permitir filtrar por año', async ({ page }) => {
        // Asegúrate de que en tu frontend de SDV los filtros tengan estos nombres
        await page.locator('input[name="filter-from"]').fill('2021'); 
        await page.locator('input[name="filter-to"]').fill('2022');
        
        const responsePromise = page.waitForResponse(res => 
            res.url().includes('countries-idh-per-years') && 
            res.request().method() === 'GET' && // <-- Corrección añadida
            res.status() === 200
        );
        await page.click('button[name="filter-button"]');
        await responsePromise;

        // Comprobamos la celda del año (asumiendo que es la segunda columna: índice 1)
        const yearCell = page.locator('table tbody tr td').nth(1);
        await expect(yearCell).not.toBeEmpty(); 
    });

    test('Debe crear un nuevo recurso completo', async ({ page }) => {
        // REVISA: Estos nombres (country, year, hdi_value...) deben estar en tu <input name="...">
        await page.locator('input[name="country"]').fill('Narnia');
        await page.locator('input[name="year"]').fill('2030');
        await page.locator('input[name="hdi_value"]').fill('0.950');
        await page.locator('input[name="hdi_rank"]').fill('1');
        await page.locator('input[name="hdi_change"]').fill('0.002');
        
        const postPromise = page.waitForResponse(res => 
            res.request().method() === 'POST' && (res.status() === 201 || res.status() === 200)
        );
        await page.click('button[name="add-button"]');
        await postPromise;

        await expect(page.locator('table')).toContainText('Narnia');
    });

    test('Debe borrar un recurso', async ({ page }) => {
        const initialCount = await page.locator('table tbody tr').count();
        
        const deletePromise = page.waitForResponse(res => 
            res.request().method() === 'DELETE' && res.status() === 200
        );
        // Hacemos clic en el botón Eliminar de la primera fila
        await page.click('table tbody tr:first-child button:has-text("Eliminar")');
        await deletePromise;
        
        await expect(page.locator('table tbody tr')).toHaveCount(initialCount - 1);
    });

    test('Debe editar un recurso existente', async ({ page }) => {
        await page.click('table tbody tr:first-child button:has-text("Editar")');
        
        // Esperamos a que la URL cambie a la página de edición
        await page.waitForURL(/\/front-sdv\/.+\/\d+/);

        // Modificamos el primer valor numérico que encontremos (HDI Value)
        const inputNum = page.locator('input[type="number"]').first();
        await inputNum.waitFor({ state: 'visible' });
        await inputNum.fill('0.999'); 
        
        // REVISA: ¿Tu botón de la página de edición dice exactamente "Guardar cambios"?
        // Si no, cámbialo aquí o ponle un name="update-button"
        await page.click('button:has-text("Guardar cambios")'); 

        // Verificamos que volvemos a la lista y el cambio está ahí
        await page.goto('/front-sdv');
        await expect(page.locator('table')).toContainText('0.999');
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