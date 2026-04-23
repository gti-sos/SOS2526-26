// @ts-check
import { test, expect } from '@playwright/test';
test.describe('Pruebas E2E - Recurso MGN (Rankings)', () => {
    const API = '/api/v2/national-team-rankings-per-years';
    const seeded = {
        country: 'Seedland',
        year: 2024
        rank: 10,
        score: 1500,
        rank_variation_from_two_thousand_eighteen: 2
    };


    test.beforeAll(async ({ request }) => {
        await request.get(`${API}/loadInitialData?e2e=true`);
    });

    test.beforeEach(async ({ page, request }) => {
        await request.post(API, { data: seeded });
        await page.goto('/front-mgn?e2e=true');
        await page.waitForSelector('table');
    });

    test('Debe listar todos los recursos iniciales', async ({ page }) => {
        const tableRows = page.locator('table tbody tr');
        await expect(page.locator('table')).toContainText(seeded.country);
   
        expect(await tableRows.count()).toBeGreaterThan(0);
    });

    test('Debe permitir filtrar por rango de años', async ({ page }) => {
        await page.locator('#sFrom').fill(String(seeded.year));
        await page.locator('#sTo').fill(String(seeded.year));
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
       
        const rowToEdit = page.locator('table tbody tr', { hasText: seeded.country }).first();
        
        await expect(rowToEdit).toBeVisible();

       
        await rowToEdit.locator('button:has-text("Editar")').click();
        
        const inputPos = page.locator('input[type="number"]').first();
        
       
        await expect(inputPos).not.toHaveValue('');
        
       
        await inputPos.fill('888'); 
        await page.click('button:has-text("Guardar Cambios")');
        
       
        await expect(page.locator('table')).toContainText('888');
    });

   test('Debe borrar todos los recursos existentes con confirmación', async ({ page }) => {
    const initialCount = await page.locator('table tbody tr').count();
    const deleteAllPromise = page.waitForResponse(res =>
        res.url().includes('national-team-rankings-per-years') &&
        res.request().method() === 'DELETE' &&
        res.status() === 200
    );

    page.once('dialog', async dialog => {
        expect(dialog.message()).toContain('borrar');
        await dialog.accept();
    });

    await page.click('button:has-text("BORRAR TODO")');

    await deleteAllPromise;

    const tableRows = page.locator('table tbody tr');
    const rowCount = await tableRows.count();
    expect(rowCount).toBeLessThan(initialCount);
});
});
