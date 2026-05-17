import { expect, test } from '@playwright/test'
import { fixtureData, mockApi, mockEmptyApi } from './api-fixtures'

test.describe('cobertura operativa de la web', () => {
  test('renderiza navegación y estados vacíos en todas las secciones principales', async ({ page }) => {
    await mockEmptyApi(page)

    const pages = [
      { path: '/', heading: 'Dashboard', empty: 'Todavía no hay uploads procesados' },
      { path: '/rebates', heading: 'Tabla de reintegros', empty: 'Procesa un Excel para ver la tabla de reintegros.' },
      { path: '/reconciliation', heading: 'Anomalías de conciliación', empty: 'Procesa un Excel para ver anomalías.' },
      { path: '/simulator', heading: 'Simulador de cashback', empty: 'Procesa un Excel para simular impacto.' },
      { path: '/tiers', heading: 'Configuración de niveles', empty: 'No hay niveles activos. Publica la primera configuracion.' },
      { path: '/uploads/new', heading: 'Cargar reporte mensual de pagos QR', empty: 'Arrastra el reporte mensual de pagos QR' },
    ]

    for (const current of pages) {
      await test.step(`pagina ${current.path}`, async () => {
        await page.goto(current.path)
        await expect(page.getByRole('heading', { name: current.heading })).toBeVisible()
        await expect(page.getByText(current.empty)).toBeVisible()
        await expect(page.getByRole('navigation', { name: /Navegación/ })).toBeVisible()
      })
    }
  })

  test('muestra skeletons mientras carga el dashboard y luego pinta KPIs', async ({ page }) => {
    let releaseUploads!: () => void
    const uploadsReady = new Promise<void>((resolve) => {
      releaseUploads = resolve
    })

    await page.route(/\/api\//, async (route) => {
      const url = new URL(route.request().url())
      if (url.pathname === '/api/uploads') {
        await uploadsReady
        await route.fulfill({ json: fixtureData.uploads })
        return
      }
      if (url.pathname.endsWith('/rebates')) {
        await route.fulfill({ json: fixtureData.rebates })
        return
      }
      if (url.pathname === '/api/reconciliation/anomalies') {
        await route.fulfill({ json: fixtureData.anomalies })
        return
      }
      if (url.pathname === '/api/reconciliation/stats') {
        await route.fulfill({ json: fixtureData.stats })
        return
      }
      await route.fulfill({ status: 404, json: { error: 'NOT_FOUND', message: 'Not found' } })
    })

    await page.goto('/')
    await expect(page.locator('[data-slot="skeleton"]').first()).toBeVisible()

    releaseUploads()

    await expect(page.getByText('Reintegrado', { exact: true })).toBeVisible()
    await expect(page.getByText('Usuarios beneficiados', { exact: true })).toBeVisible()
    await expect(page.getByText(fixtureData.upload.filename).first()).toBeVisible()
    await expect(page.getByText('Anomalías detectadas', { exact: true })).toBeVisible()
  })

  test('permite revisar reintegros, filtrar usuarios y abrir detalle auditable', async ({ page }) => {
    await mockApi(page)

    await page.goto('/rebates')

    await expect(page.getByRole('heading', { name: fixtureData.upload.filename })).toBeVisible()
    await expect(page.getByText('2 de 2 reintegros')).toBeVisible()

    await page.getByPlaceholder('Buscar usuario o cuenta').fill('Cristina')
    await expect(page.getByText('1 de 2 reintegros')).toBeVisible()
    await expect(page.locator('tbody tr').first()).toContainText('CristinaSuarez852025')

    await page.getByPlaceholder('Buscar usuario o cuenta').fill('Victor')
    await page.locator('tbody tr').first().click()

    await expect(page.getByText('Detalle de usuario', { exact: true })).toBeVisible()
    await expect(page.getByText('2 transacciones · período 2025-05')).toBeVisible()

    await page.locator('[role="dialog"] table tbody tr').first().click()
    await expect(page.getByRole('heading', { name: 'Transacción QR' })).toBeVisible()
    await expect(page.getByText('207681530')).toBeVisible()
    await expect(page.getByText('Conciliada')).toBeVisible()
  })

  test('cubre conciliación: filtros, resolución e IA con streaming mockeado', async ({ page }) => {
    await mockApi(page)

    await page.goto('/reconciliation')

    await expect(page.getByText(fixtureData.upload.filename, { exact: true })).toBeVisible()

    await page.getByRole('button', { name: 'Monto distinto 1' }).click()
    await expect(page.getByText('6846097010')).toBeVisible()

    await page.getByRole('button', { name: 'Explicar con IA' }).click()
    await expect(page.getByText('Anomalía concentrada en una transacción')).toBeVisible()

    await page.getByRole('button', { name: 'Marcar resuelta' }).click()
    await page.getByPlaceholder('Motivo (opcional)').fill('Validado en E2E')
    await page.getByRole('button', { name: 'Confirmar' }).click()

    await expect(page.getByText('Anomalía marcada como resuelta.')).toBeVisible()
    await expect(page.getByText('Resuelta', { exact: true })).toBeVisible()
  })

  test('cubre simulador y transferencia de propuesta hacia niveles', async ({ page }) => {
    await mockApi(page)

    await page.goto('/simulator')

    await expect(page.getByText('Parámetros', { exact: true })).toBeVisible()
    await expect(page.getByText('Sincronizado')).toBeVisible()

    const firstSlider = page.locator('input[type="range"]').first()
    await firstSlider.fill('2')

    await expect(page.getByText('Sin guardar')).toBeVisible()
    await page.getByRole('button', { name: /Guardar configuración/ }).click()

    await expect(page).toHaveURL(/\/tiers\?from=simulator$/)
    await expect(page.getByText('Configuracion propuesta desde el simulador')).toBeVisible()

    await page.getByRole('button', { name: 'Usar propuesta' }).click()
    await expect(page.getByRole('dialog', { name: 'Publicar configuracion de niveles' })).toBeVisible()
  })

  test('muestra errores recuperables cuando la API falla', async ({ page }) => {
    await page.route(/\/api\//, async (route) => {
      await route.fulfill({ status: 500, json: { error: 'TEST_ERROR', message: 'Fallo controlado' } })
    })

    await page.goto('/reconciliation')

    await expect(page.getByRole('alert')).toContainText('No se pudo cargar la conciliación')

    await page.goto('/rebates')
    await expect(page.getByRole('alert')).toContainText('No se pudieron cargar los reintegros.')
  })
})
