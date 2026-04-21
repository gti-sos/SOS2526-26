// @ts-check
import { test, expect } from '@playwright/test';

test.describe('Pruebas E2E - Recurso RFR', () => {

    test.beforeAll(async ({ request }) => {
        await request.get('/api/v2/fifa-squad-value-per-years/loadInitialData');
    });

    test.beforeEach(async ({ page }) => {
        await page.goto('/front-rfr');
        await page.waitForSelector('table tbody tr');
    });

    test('Debe listar todos los recursos iniciales', async ({ page }) => {
        const tableRows = page.locator('table tbody tr');
        await expect(tableRows.first()).toBeVisible();
        const count = await tableRows.count();
        expect(count).toBeGreaterThan(0);
    });

    test('Debe permitir filtrar por año', async ({ page }) => {
        await page.locator('input[name="filter-from"]').fill('2026');
        await page.locator('input[name="filter-to"]').fill('2027');
        
        const responsePromise = page.waitForResponse(res => 
            res.url().includes('fifa-squad-value-per-years') && res.status() === 200
        );
        await page.click('button[name="filter-button"]');
        await responsePromise;

        const yearCell = page.locator('table tbody tr td').nth(1);
        await expect(yearCell).toContainText('2026');
    });

    test('Debe crear un nuevo recurso completo', async ({ page }) => {
        await page.locator('input[name="country"]').fill('Narnia');
        await page.locator('input[name="year"]').fill('2030');
        await page.locator('input[name="squad_size"]').fill('25');
        await page.locator('input[name="total_market_value"]').fill('1000');
        await page.locator('input[name="average_market_value"]').fill('40');
        
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
        await page.click('table tbody tr:first-child button:has-text("Eliminar")');
        await deletePromise;
        
        await expect(page.locator('table tbody tr')).toHaveCount(initialCount - 1);
    });

    test('Debe editar un recurso existente', async ({ page }) => {
        await page.click('table tbody tr:first-child button:has-text("Editar")');
        
        await expect(page).toHaveURL(/\/front-rfr\/.+\/\d+/);

        const inputNum = page.locator('input[type="number"]').first();
        await inputNum.fill('99'); 
        
        await page.click('button:has-text("Guardar cambios")'); 

        await page.goto('/front-rfr');
        await expect(page.locator('table')).toContainText('99');
    });
});