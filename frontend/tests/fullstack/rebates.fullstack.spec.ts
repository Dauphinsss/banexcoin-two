import { expect, test } from '@playwright/test'

test.describe('rebates fullstack', () => {
  test('filters, sorts and opens the user drawer with real backend data', async ({ page }) => {
    await page.goto('/rebates')

    await expect(page.getByRole('heading', { name: 'Tabla de reintegros' })).toBeVisible()
    await expect(page.getByText('Reportes Banexcoin Bolivia Hackaton 2026.xlsx')).toBeVisible()
    await expect(page.getByText('2 de 2 reintegros')).toBeVisible()

    const search = page.getByPlaceholder('Buscar usuario o cuenta')
    await search.fill('Cristina')
    await expect(page.getByText('1 de 2 reintegros')).toBeVisible()
    await expect(page.locator('tbody tr').first()).toContainText('CristinaSuarez852025')

    await search.fill('')
    await page.getByRole('button', { name: 'Usuario' }).click()
    await expect(page.locator('tbody tr').first()).toContainText('CristinaSuarez852025')

    await page.getByRole('button', { name: 'Usuario' }).click()
    await expect(page.locator('tbody tr').first()).toContainText('VictorFernandez452024')

    await page.locator('tbody tr').first().click()
    await expect(page.getByText('Detalle de usuario')).toBeVisible()
    await expect(page.getByText('2 transacciones · período 2025-05')).toBeVisible()

    await page.locator('aside table tbody tr').first().click()
    await expect(page.getByRole('heading', { name: 'Transacción QR' })).toBeVisible()
    await expect(page.getByText('ID transacción')).toBeVisible()
    await expect(page.getByText('207681530')).toBeVisible()
  })
})
