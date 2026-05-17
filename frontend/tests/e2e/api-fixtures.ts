import type { Page, Route } from '@playwright/test'

const upload = {
  id: 'upload-demo',
  filename: 'Reportes Banexcoin Bolivia Hackaton 2026.xlsx',
  originalName: 'Reportes Banexcoin Bolivia Hackaton 2026.xlsx',
  period: '2025-05',
  status: 'DONE',
  rowCount: 18,
  transactionRowCount: 3,
  extractRowCount: 3,
  parseErrorCount: 0,
  anomalyCount: 1,
  processedAt: '2025-05-16T18:00:00.000Z',
  createdAt: '2025-05-16T18:00:00.000Z',
}

const rebates = [
  {
    id: 'rebate-victor',
    uploadId: upload.id,
    userId: 10001,
    username: 'VictorFernandez452024',
    period: '2025-05',
    totalSpentBOB: '10.00',
    totalSpentUSDT: '0.75600000',
    avgExchangeRate: '13.20650000',
    tierName: 'Basico',
    rebatePercent: '1.00',
    rebateBOB: '0.10',
    rebateUSDT: '0.00756000',
    transactionCount: 2,
    paidOut: false,
    paidOutAt: null,
  },
  {
    id: 'rebate-cristina',
    uploadId: upload.id,
    userId: 10003,
    username: 'CristinaSuarez852025',
    period: '2025-05',
    totalSpentBOB: '2.00',
    totalSpentUSDT: '0.15100000',
    avgExchangeRate: '13.20650000',
    tierName: 'Basico',
    rebatePercent: '1.00',
    rebateBOB: '0.02',
    rebateUSDT: '0.00151000',
    transactionCount: 1,
    paidOut: true,
    paidOutAt: '2025-05-17T12:00:00.000Z',
  },
]

const anomalies = [
  {
    id: 'anomaly-mismatch',
    uploadId: upload.id,
    transactionId: '6846097010',
    serviceCode: 'S-001',
    type: 'AMOUNT_MISMATCH',
    qrAmountBOB: '2.00',
    extractAmountBOB: '1.50',
    deltaBOB: '0.50',
    resolved: false,
    resolvedNote: null,
  },
]

const stats = {
  uploadId: upload.id,
  total: 1,
  noExtract: 0,
  noQr: 0,
  amountMismatch: 1,
  invalidRate: 0,
  resolved: 0,
  pending: 1,
  reconciliationRate: '66.67',
}

const tiers = [
  {
    id: 'tier-1',
    level: 1,
    name: 'Basico',
    minAmountBOB: '0',
    maxAmountBOB: '500',
    rebatePercent: '1.00',
    validFromPeriod: '2025-01',
    validToPeriod: null,
    active: true,
  },
  {
    id: 'tier-2',
    level: 2,
    name: 'Bronce',
    minAmountBOB: '500.01',
    maxAmountBOB: '1000',
    rebatePercent: '1.50',
    validFromPeriod: '2025-01',
    validToPeriod: null,
    active: true,
  },
]

const transactions = [
  {
    id: 'tx-1',
    transactionId: '207681530',
    transactedAt: '2025-04-15T13:02:17.000Z',
    status: 'Completed',
    amountBOB: '5.00',
    amountUSDT: '0.37800000',
    exchangeRate: '13.20650000',
    commission: '0.00',
    reconciledWithExtract: true,
    extractMismatch: null,
  },
  {
    id: 'tx-2',
    transactionId: '207692950',
    transactedAt: '2025-04-15T13:38:37.000Z',
    status: 'Completed',
    amountBOB: '5.00',
    amountUSDT: '0.37800000',
    exchangeRate: '13.20650000',
    commission: '0.00',
    reconciledWithExtract: true,
    extractMismatch: null,
  },
]

const minimalTransactions = transactions.map((tx) => ({
  userId: 10001,
  amountBOB: tx.amountBOB,
  amountUSDT: tx.amountUSDT,
  exchangeRate: tx.exchangeRate,
}))

export const fixtureData = {
  upload,
  uploads: [upload],
  rebates,
  anomalies,
  stats,
  tiers,
  transactions,
  minimalTransactions,
}

export async function mockApi(page: Page): Promise<void> {
  await page.context().route('**/api/**', async (route) => routeFromFixture(route))
}

export async function mockEmptyApi(page: Page): Promise<void> {
  await page.context().route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/uploads') {
      await route.fulfill({ json: [] })
      return
    }
    if (url.pathname === '/api/tiers' || url.pathname === '/api/tiers/history') {
      await route.fulfill({ json: [] })
      return
    }
    await route.fulfill({ status: 404, json: { error: 'NOT_FOUND', message: 'Not found' } })
  })
}

async function routeFromFixture(route: Route): Promise<void> {
  const request = route.request()
  const url = new URL(request.url())
  const path = url.pathname

  if (request.method() === 'GET' && path === '/api/uploads') {
    await route.fulfill({ json: fixtureData.uploads })
    return
  }

  if (request.method() === 'GET' && path === `/api/uploads/${upload.id}`) {
    await route.fulfill({ json: upload })
    return
  }

  if (request.method() === 'GET' && path === `/api/uploads/${upload.id}/rebates`) {
    await route.fulfill({ json: rebates })
    return
  }

  if (request.method() === 'GET' && path === `/api/uploads/${upload.id}/transactions-minimal`) {
    await route.fulfill({ json: minimalTransactions })
    return
  }

  if (request.method() === 'GET' && path === `/api/uploads/${upload.id}/users/10001/transactions`) {
    await route.fulfill({ json: transactions })
    return
  }

  if (request.method() === 'GET' && path === '/api/reconciliation/stats') {
    await route.fulfill({ json: stats })
    return
  }

  if (request.method() === 'GET' && path === '/api/reconciliation/anomalies') {
    await route.fulfill({ json: anomalies })
    return
  }

  if (request.method() === 'PATCH' && path === `/api/reconciliation/anomalies/${anomalies[0].id}/resolve`) {
    await route.fulfill({ json: { ...anomalies[0], resolved: true, resolvedNote: 'Validado en E2E' } })
    return
  }

  if (request.method() === 'POST' && path === '/api/reconciliation/explain/stream') {
    await route.fulfill({ body: 'Anomalía concentrada en una transacción con diferencia de Bs 0.50.' })
    return
  }

  if (request.method() === 'GET' && path === '/api/tiers') {
    await route.fulfill({ json: tiers })
    return
  }

  if (request.method() === 'GET' && path === '/api/tiers/history') {
    await route.fulfill({ json: tiers })
    return
  }

  await route.fulfill({ status: 404, json: { error: 'NOT_FOUND', message: `No fixture for ${path}` } })
}
