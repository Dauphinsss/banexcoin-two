import { expect, test } from '@playwright/test'

test.describe('upload de reportes', () => {
  test('muestra el formulario de carga mensual', async ({ page }) => {
    await page.goto('/uploads/new')

    await expect(
      page.getByRole('heading', { name: 'Subir Excel' }),
    ).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'Cargar reporte mensual de pagos QR' }),
    ).toBeVisible()
    await expect(
      page.getByText('Procesamiento independiente del core Banexcoin.'),
    ).toBeVisible()
  })

  test('configura el dropzone para seleccionar un Excel', async ({ page }) => {
    await page.goto('/uploads/new')

    await expect(page.getByRole('button', { name: 'Seleccionar archivo' })).toBeVisible()
    await expect(page.locator('input[type="file"]')).toHaveAttribute('accept', /\.xlsx/)
  })
})
