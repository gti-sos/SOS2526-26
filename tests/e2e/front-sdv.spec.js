// @ts-check
import { test, expect } from '@playwright/test';

test.describe('Pruebas E2E - Recurso SDV', () => {
    const API = '/api/v2/countries-idh-per-years';
    const seeded = {
        country: 'Seedland',
        year: 2022,
        hdi_value: 0.777,
        hdi_rank: 77,
        hdi_change: 0.003
    };

    test.beforeAll(async ({ request }) => {
        await request.get(`${API}/loadInitialData`);
    });

    test.beforeEach(async ({ page, request }) => {
        await request.post(API, { data: seeded });
        await page.goto('/front-sdv?e2e=true');
        // Esperamos a que la página renderice la tabla, aunque no haya filas aún
        await page.waitForSelector('table');
    });

    test('Debe listar todos los recursos iniciales', async ({ page }) => {
        const tableRows = page.locator('table tbody tr');
        await expect(page.locator('table')).toContainText(seeded.country);
        const count = await tableRows.count();
        expect(count).toBeGreaterThan(0);
    });

    test('Debe permitir filtrar por año', async ({ page }) => {
        await page.getByPlaceholder('Desde').fill(String(seeded.year)); 
        await page.getByPlaceholder('Hasta').fill(String(seeded.year));
        
        const responsePromise = page.waitForResponse(res => 
            res.url().includes('countries-idh-per-years') && 
            res.request().method() === 'GET' &&
            res.status() === 200
        );
        await page.click('button:has-text("Filtrar")');
        await responsePromise;

        // Validate filtered data is rendered in the year column.
        const yearCell = page.locator('table tbody tr td').nth(1);
        await expect(yearCell).not.toBeEmpty(); 
    });

    test('Debe crear un nuevo recurso completo', async ({ page }) => {
        const uniqueCountry = `Narnia-${Date.now()}`;
        await page.getByPlaceholder('País').first().fill(uniqueCountry);
        await page.getByPlaceholder('Año').fill('2030');
        await page.getByPlaceholder('Valor IDH').fill('0.950');
        await page.getByPlaceholder('Ranking').fill('1');
        await page.getByPlaceholder('Cambio').fill('0.002');
        
        const postPromise = page.waitForResponse(res => 
            res.request().method() === 'POST' && (res.status() === 201 || res.status() === 200 || res.status() === 409)
        );
        await page.click('button:has-text("Añadir Registro")');
        await postPromise;

        await expect(page.locator('table')).toContainText(uniqueCountry);
    });

    test('Debe borrar un recurso', async ({ page }) => {
        const initialCount = await page.locator('table tbody tr').count();
        
        const deletePromise = page.waitForResponse(res => 
            res.request().method() === 'DELETE' && res.status() === 200
        );
        await page.locator('table tbody tr', { hasText: seeded.country }).first().locator('button:has-text("Eliminar")').click();
        await deletePromise;
        
        await expect(page.locator('table')).not.toContainText(seeded.country);
        expect(initialCount).toBeGreaterThan(0);
    });

    test('Debe editar un recurso existente', async ({ page }) => {
        await page.locator('table tbody tr', { hasText: seeded.country }).first().locator('button:has-text("Editar")').click();
        
        await page.waitForURL(/\/front-sdv\/.+\/\d+/);

        const inputNum = page.locator('input[type="number"]').first();
        await inputNum.waitFor({ state: 'visible' });
        await inputNum.fill('0.999'); 
        
        await page.click('button:has-text("Guardar cambios")'); 

        await page.goto('/front-sdv?e2e=true');
        await expect(page.locator('table')).toContainText('0.999');
    });
    test('Debe borrar todos los recursos existentes con confirmación', async ({ page }) => {
    const deleteAllPromise = page.waitForResponse(res =>
        res.url().includes('countries-idh-per-years') &&
        res.request().method() === 'DELETE' &&
        res.status() === 200
    );

    page.once('dialog', async dialog => {
        expect(dialog.message().toLowerCase()).toContain('borrar');
        await dialog.accept();
    });

    await page.click('button:has-text("BORRAR TODO")');

    await deleteAllPromise;

    const tableRows = page.locator('table tbody tr');
    const rowCount = await tableRows.count();
    expect(rowCount).toBeLessThanOrEqual(2);
});
});