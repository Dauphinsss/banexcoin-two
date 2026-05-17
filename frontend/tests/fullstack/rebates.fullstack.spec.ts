import { expect, test } from '@playwright/test'

test.describe('rebates fullstack', () => {
  test('filters, sorts and opens the user drawer with real backend data', async ({ page }) => {
    await page.goto('/rebates')

    await expect(page.getByRole('heading', { name: 'Tabla de reintegros' })).toBeVisible()
    await expect(page.getByText('Reportes Banexcoin Bolivia Hackaton 2026.xlsx')).toBeVisible()
    await expect(page.getByText(/de \d+ reintegros/)).toBeVisible()

    const search = page.getByRole('searchbox', { name: 'Buscar usuario o cuenta' })
    await search.fill('Cristina')
    await expect(page.getByText(/1 de \d+ reintegros/)).toBeVisible()
    await expect(page.locator('tbody tr').first()).toContainText('CristinaSuarez852025')

    await search.fill('')
    await page.getByRole('button', { name: 'Usuario', exact: true }).click()
    await expect(page.locator('tbody tr').first()).toContainText('CristinaSuarez852025')

    await page.getByRole('button', { name: 'Usuario', exact: true }).click()
    await expect(page.locator('tbody tr').first()).toContainText('VictorFernandez452024')

    await page.locator('tbody tr').first().click()
    await expect(page.getByText('Detalle de usuario', { exact: true })).toBeVisible()
    await expect(page.getByText('2 transacciones · período 2025-05')).toBeVisible()

    const firstTransaction = page.locator('[role="dialog"] table tbody tr').first()
    await expect(firstTransaction).toBeVisible()
    await expect(firstTransaction).toContainText('Bs 5,00')
  })
})
