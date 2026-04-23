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
        await request.get(`${API}/loadInitialData`);
    });

    test.beforeEach(async ({ page, request }) => {
        await request.post(API, { data: seeded });
        await page.goto('/front-rfr');
        await page.waitForSelector('table');
    });

    test('Debe listar todos los recursos iniciales', async ({ page }) => {
        const tableRows = page.locator('table tbody tr');
        await expect(page.locator('table')).toContainText(seeded.country);
        const count = await tableRows.count();
        expect(count).toBeGreaterThan(0);
    });

    test('Debe permitir filtrar por año', async ({ page }) => {
        await page.locator('input[name="filter-from"]').fill(String(seeded.year));
        await page.locator('input[name="filter-to"]').fill(String(seeded.year));
        
        const responsePromise = page.waitForResponse(res => 
            res.url().includes('fifa-squad-value-per-years') && res.status() === 200
        );
        await page.click('button[name="filter-button"]');
        await responsePromise;

        const yearCell = page.locator('table tbody tr td').nth(1);
        await expect(yearCell).toContainText(String(seeded.year));
    });

    test('Debe crear un nuevo recurso completo', async ({ page }) => {
        const uniqueCountry = `Narnia-${Date.now()}`;
        await page.locator('input[name="country"]').fill(uniqueCountry);
        await page.locator('input[name="year"]').fill('2030');
        await page.locator('input[name="squad_size"]').fill('25');
        await page.locator('input[name="total_market_value"]').fill('1000');
        await page.locator('input[name="average_market_value"]').fill('40');
        
        const postPromise = page.waitForResponse(res => 
            res.request().method() === 'POST' && (res.status() === 201 || res.status() === 200 || res.status() === 409)
        );
        await page.click('button[name="add-button"]');
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
        
        await expect(page).toHaveURL(/\/front-rfr\/.+\/\d+/);

        const inputNum = page.locator('input[type="number"]').first();
        await inputNum.fill('99'); 
        
        await page.click('button:has-text("Guardar cambios")'); 

        await page.goto('/front-rfr');
        await expect(page.locator('table')).toContainText('99');
    });
});