import type {
  AnomalyDTO,
  CashbackTierDTO,
  CreateUploadResponse,
  MonthlyRebateDTO,
  QRTransactionDTO,
  ReconciliationStats,
  UploadSummary,
} from '@banex/types'
import type { TierValidationOutput } from '@banex/utils'

export interface TierInput {
  id?: string
  level: number
  name: string
  minAmountBOB: string
  maxAmountBOB?: string | null
  rebatePercent: string
}

export interface CreateTierPayload extends TierInput {
  validFromPeriod: string
  validToPeriod?: string | null
  active?: boolean
}

export type UpdateTierPayload = Partial<CreateTierPayload>

const API_BASE = (import.meta.env.PUBLIC_API_URL ?? 'http://localhost:3000').replace(/\/$/, '')

export interface ApiError {
  error: string
  message: string
  [key: string]: unknown
}

export class ApiCallError extends Error {
  constructor(
    public readonly status: number,
    public readonly payload: ApiError,
  ) {
    super(payload.message)
    this.name = 'ApiCallError'
  }
}

const handleResponse = async <T>(res: Response): Promise<T> => {
  if (res.ok) return (await res.json()) as T

  let payload: ApiError
  try {
    payload = (await res.json()) as ApiError
  } catch {
    payload = { error: 'UNKNOWN', message: res.statusText || 'Error desconocido' }
  }
  throw new ApiCallError(res.status, payload)
}

export const api = {
  async createUpload(file: File, period?: string): Promise<CreateUploadResponse> {
    const formData = new FormData()
    formData.append('file', file)
    if (period) formData.append('period', period)

    const res = await fetch(`${API_BASE}/api/uploads`, {
      method: 'POST',
      body: formData,
    })
    return handleResponse<CreateUploadResponse>(res)
  },

  async getUpload(uploadId: string): Promise<UploadSummary> {
    const res = await fetch(`${API_BASE}/api/uploads/${uploadId}`)
    return handleResponse<UploadSummary>(res)
  },

  async listUploads(): Promise<UploadSummary[]> {
    const res = await fetch(`${API_BASE}/api/uploads`)
    return handleResponse<UploadSummary[]>(res)
  },

  async listRebates(uploadId: string): Promise<MonthlyRebateDTO[]> {
    const res = await fetch(`${API_BASE}/api/uploads/${uploadId}/rebates`)
    return handleResponse<MonthlyRebateDTO[]>(res)
  },

  async listMinimalTransactions(uploadId: string) {
    const res = await fetch(`${API_BASE}/api/uploads/${uploadId}/transactions-minimal`)
    return handleResponse<Array<{
      userId: number
      amountBOB: string
      amountUSDT: string
      exchangeRate: string
    }>>(res)
  },

  async listTiers(period?: string): Promise<CashbackTierDTO[]> {
    const query = period ? `?period=${encodeURIComponent(period)}` : ''
    const res = await fetch(`${API_BASE}/api/tiers${query}`)
    return handleResponse<CashbackTierDTO[]>(res)
  },

  async listTiersHistory(): Promise<CashbackTierDTO[]> {
    const res = await fetch(`${API_BASE}/api/tiers/history`)
    return handleResponse<CashbackTierDTO[]>(res)
  },

  async createTier(payload: CreateTierPayload): Promise<CashbackTierDTO> {
    const res = await fetch(`${API_BASE}/api/tiers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    return handleResponse<CashbackTierDTO>(res)
  },

  async updateTier(id: string, payload: UpdateTierPayload): Promise<CashbackTierDTO> {
    const res = await fetch(`${API_BASE}/api/tiers/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    return handleResponse<CashbackTierDTO>(res)
  },

  async deactivateTier(id: string): Promise<CashbackTierDTO> {
    const res = await fetch(`${API_BASE}/api/tiers/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    })
    return handleResponse<CashbackTierDTO>(res)
  },

  async validateTiers(tiers: TierInput[]): Promise<TierValidationOutput> {
    const res = await fetch(`${API_BASE}/api/tiers/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tiers }),
    })
    return handleResponse<TierValidationOutput>(res)
  },

  async reconciliationStats(uploadId: string): Promise<ReconciliationStats> {
    const res = await fetch(`${API_BASE}/api/reconciliation/stats?uploadId=${encodeURIComponent(uploadId)}`)
    return handleResponse<ReconciliationStats>(res)
  },

  async explainAnomalies(
    uploadId: string,
  ): Promise<{ available: boolean; cached: boolean; explanation: string }> {
    const res = await fetch(
      `${API_BASE}/api/reconciliation/explain?uploadId=${encodeURIComponent(uploadId)}`,
    )
    return handleResponse(res)
  },

  async listAnomalies(uploadId: string): Promise<AnomalyDTO[]> {
    const res = await fetch(`${API_BASE}/api/reconciliation/anomalies?uploadId=${encodeURIComponent(uploadId)}`)
    return handleResponse<AnomalyDTO[]>(res)
  },

  async resolveAnomaly(anomalyId: string, note?: string): Promise<AnomalyDTO> {
    const res = await fetch(`${API_BASE}/api/reconciliation/anomalies/${encodeURIComponent(anomalyId)}/resolve`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note }),
    })
    return handleResponse<AnomalyDTO>(res)
  },

  async listUserTransactions(uploadId: string, accountNumber: string | number): Promise<QRTransactionDTO[]> {
    const account = encodeURIComponent(String(accountNumber))
    const res = await fetch(`${API_BASE}/api/uploads/${uploadId}/users/${account}/transactions`)
    return handleResponse<QRTransactionDTO[]>(res)
  },

  reportUrl(uploadId: string): string {
    return `${API_BASE}/api/uploads/${encodeURIComponent(uploadId)}/report`
  },

  banexTransferUrl(uploadId: string): string {
    return `${API_BASE}/api/uploads/${encodeURIComponent(uploadId)}/banex-transfer`
  },

  balanceSheetUrl(uploadId: string): string {
    return `${API_BASE}/api/uploads/${encodeURIComponent(uploadId)}/balance-sheet`
  },
}
