// @ts-check
import { test, expect } from '@playwright/test';

test.describe('Pruebas E2E - Recurso MGN (Rankings)', () => {

    test.beforeAll(async ({ request }) => {
        // Carga de datos iniciales igual que tu compi
        await request.get('/api/v2/national-team-rankings-per-years/loadInitialData');
    });

    test.beforeEach(async ({ page }) => {
    await page.goto('/front-mgn?e2e=true');
    await page.waitForSelector('table tbody tr');
});

    test('Debe listar todos los recursos iniciales', async ({ page }) => {
        const tableRows = page.locator('table tbody tr');
        await expect(tableRows.first()).toBeVisible();
        const count = await tableRows.count();
        expect(count).toBeGreaterThan(0);
    });

    test('Debe permitir buscar por país', async ({ page }) => {
        // Rellenamos el input de búsqueda por ID
        await page.locator('#sCountry').fill('Angola');
        
        // Estructura de promesas calcada a la de tu compi
        const responsePromise = page.waitForResponse(res => 
            res.url().includes('national-team-rankings-per-years') && 
            res.request().method() === 'GET' &&
            res.status() === 200
        );
        await page.click('button:has-text("Buscar")');
        await responsePromise;

        // Comprobamos la celda del país (primera columna: índice 0)
        const firstCell = page.locator('table tbody tr td').first();
        await expect(firstCell).toContainText('Angola'); 
    });

    test('Debe crear un nuevo recurso completo', async ({ page }) => {
        // Usamos los placeholders exactos de tu HTML (es más seguro que usar .nth)
        await page.getByPlaceholder('País (ej: España)').fill('Narnia');
        await page.getByPlaceholder('Año (ej: 2024)').fill('2026');
        await page.getByPlaceholder('Posición').fill('1');
        await page.getByPlaceholder('Puntos').fill('2000');
        await page.getByPlaceholder('Variación desde 2018').fill('10');
        
        // Estructura de promesas calcada a la de tu compi
        const postPromise = page.waitForResponse(res => 
            res.request().method() === 'POST' && (res.status() === 201 || res.status() === 200)
        );
        await page.click('button:has-text("Añadir Registro")');
        await postPromise;

        await expect(page.locator('table')).toContainText('Narnia');
    });

   test('Debe editar un recurso existente', async ({ page }) => {
        await page.click('table tbody tr:first-child button:has-text("Editar")');
        
        await page.waitForURL(/\/front-mgn\/.+\/\d+/);

        const inputNum = page.locator('input[type="number"]').first();
        await inputNum.waitFor({ state: 'visible' });
        await inputNum.fill('9999'); 
        
        // LA CLAVE: Esperamos a que el PUT termine CORRECTAMENTE antes de salir de la página
        const putPromise = page.waitForResponse(res => 
            res.request().method() === 'PUT' && res.status() === 200
        );
        await page.click('button:has-text("Guardar cambios")'); 
        await putPromise; // Esperamos la respuesta del backend

        // Ahora ya podemos forzar la vuelta sin miedo a cancelar el guardado 
        // (y nos saltamos tus 1.5s de espera para que el test vaya más rápido)
        await page.goto('/front-mgn');
        await expect(page.locator('table')).toContainText('9999');
    });

    


    test('Debe borrar un recurso 2', async ({ page }) => {
        const initialCount = await page.locator('table tbody tr').count();
        
        const deletePromise = page.waitForResponse(res => 
            res.request().method() === 'DELETE' && res.status() === 200
        );
        // Hacemos clic en el botón Eliminar de la primera fila
        await page.click('table tbody tr:first-child button:has-text("Eliminar")');
        await deletePromise;
        
        await expect(page.locator('table tbody tr')).toHaveCount(initialCount - 1);
    });

    test('Debe editar un recurso existente2 22', async ({ page }) => {
        await page.click('table tbody tr:first-child button:has-text("Editar")');
        
        // Esperamos a que la URL cambie a la página de edición
        await page.waitForURL(/\/front-mgn\/.+\/\d+/);

        // Modificamos el primer valor numérico que encontremos (HDI Value)
        const inputNum = page.locator('input[type="number"]').first();
        await inputNum.waitFor({ state: 'visible' });
        await inputNum.fill('3'); 
        
        // REVISA: ¿Tu botón de la página de edición dice exactamente "Guardar cambios"?
        // Si no, cámbialo aquí o ponle un name="update-button"
        await page.click('button:has-text("Guardar cambios")'); 

        // Verificamos que volvemos a la lista y el cambio está ahí
        await page.goto('/front-mgn');
        await expect(page.locator('table')).toContainText('3');
    });
});
