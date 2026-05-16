import { expect, test } from '@playwright/test'

test.describe('dashboard', () => {
  test('muestra la propuesta principal y acceso a carga de reportes', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
    await expect(
      page.getByText('Sistema de cashback automatizado para Banexcoin Bolivia'),
    ).toBeVisible()
    await expect(
      page.getByRole('link', { name: /Subir reporte mensual/ }),
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
