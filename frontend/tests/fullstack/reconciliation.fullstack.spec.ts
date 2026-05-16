import { expect, test } from '@playwright/test'

test.describe('reconciliation fullstack', () => {
  test('filters anomalies and resolves the seeded mismatch', async ({ page }) => {
    await page.goto('/reconciliation')

    await expect(page.getByRole('heading', { name: 'Anomalías de conciliación' })).toBeVisible()
    await expect(page.getByText('Reportes Banexcoin Bolivia Hackaton 2026.xlsx')).toBeVisible()

    await page.getByRole('button', { name: 'Monto distinto 1' }).click()
    await expect(page.getByText('6846097010')).toBeVisible()

    const resolveButton = page.getByRole('button', { name: 'Marcar resuelta' })
    const isResolvable = await resolveButton.isVisible().catch(() => false)

    if (isResolvable) {
      await resolveButton.click()
      await page.getByPlaceholder('Motivo (opcional)').fill('Validated in fullstack test')
      await page.getByRole('button', { name: 'Confirmar' }).click()
      await expect(page.getByText('Anomalía marcada como resuelta.')).toBeVisible()
    }

    await expect(page.getByText('Resuelta')).toBeVisible()
  })
})
