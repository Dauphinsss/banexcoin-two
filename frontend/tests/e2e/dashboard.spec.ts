import { expect, test } from '@playwright/test'

test.describe('dashboard', () => {
  test('muestra la propuesta principal y acceso a carga de reportes', async ({ page }) => {
    await page.route('**/api/uploads', async (route) => {
      await route.fulfill({ json: [] })
    })

    await page.goto('/')

    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'Resultados del cashback mensual' }),
    ).toBeVisible()
    await expect(
      page.getByRole('link', { name: 'Subir Excel' }).first(),
    ).toHaveAttribute('href', '/uploads/new')
  })

  test('expone la navegacion operativa principal', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Subir Excel' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Reintegros' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Conciliación' })).toBeVisible()
  })
})
