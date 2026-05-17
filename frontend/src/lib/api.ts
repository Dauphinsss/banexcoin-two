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

export interface PublishTierConfigPayload {
  validFromPeriod: string
  validToPeriod?: string | null
  tiers: TierInput[]
}

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

const readErrorResponse = async (res: Response): Promise<never> => {
  let payload: ApiError
  try {
    payload = (await res.json()) as ApiError
  } catch {
    payload = { error: 'UNKNOWN', message: res.statusText || 'Error desconocido' }
  }

  throw new ApiCallError(res.status, payload)
}

export const api = {
  async createUpload(
    file: File,
    period?: string,
    allowDuplicate = false,
    onProgress?: (percent: number) => void,
  ): Promise<CreateUploadResponse> {
    const formData = new FormData()
    formData.append('file', file)
    if (period) formData.append('period', period)
    if (allowDuplicate) formData.append('allowDuplicate', 'true')

    // Usamos XMLHttpRequest (no fetch) porque solo XHR expone el progreso
    // real de subida del archivo vía `upload.onprogress`.
    return new Promise<CreateUploadResponse>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('POST', `${API_BASE}/api/uploads`)
      xhr.responseType = 'text'

      xhr.upload.onprogress = (event) => {
        if (!onProgress || !event.lengthComputable) return
        const percent = Math.round((event.loaded / event.total) * 100)
        onProgress(Math.min(99, percent))
      }

      const fail = (payload: ApiError, status = 0): void => {
        reject(new ApiCallError(status, payload))
      }

      xhr.onload = () => {
        let parsed: unknown
        try {
          parsed = xhr.responseText ? JSON.parse(xhr.responseText) : {}
        } catch {
          fail({ error: 'UNKNOWN', message: 'Respuesta inválida del servidor.' }, xhr.status)
          return
        }

        if (xhr.status >= 200 && xhr.status < 300) {
          onProgress?.(100)
          resolve(parsed as CreateUploadResponse)
        } else {
          const payload = (parsed ?? {}) as Partial<ApiError>
          fail(
            {
              ...payload,
              error: payload.error ?? 'UNKNOWN',
              message: payload.message ?? xhr.statusText ?? 'Error desconocido',
            },
            xhr.status,
          )
        }
      }

      xhr.onerror = () =>
        fail({ error: 'NETWORK', message: 'No se pudo conectar con el servidor.' })
      xhr.ontimeout = () =>
        fail({ error: 'TIMEOUT', message: 'La subida tardó demasiado. Inténtalo de nuevo.' })

      xhr.send(formData)
    })
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

  async publishTierConfiguration(payload: PublishTierConfigPayload): Promise<CashbackTierDTO[]> {
    const res = await fetch(`${API_BASE}/api/tiers/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    return handleResponse<CashbackTierDTO[]>(res)
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
    const res = await fetch(`${API_BASE}/api/reconciliation/explain`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uploadId }),
    })
    return handleResponse(res)
  },

  async explainAnomaliesStream(uploadId: string, onChunk: (chunk: string) => void): Promise<string> {
    const res = await fetch(`${API_BASE}/api/reconciliation/explain/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uploadId }),
    })

    if (!res.ok) {
      return readErrorResponse(res)
    }

    if (!res.body) {
      throw new Error('El navegador no soporta streaming para esta respuesta.')
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let fullText = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value, { stream: true })
      if (chunk === '') continue

      fullText += chunk
      onChunk(chunk)
    }

    const tail = decoder.decode()
    if (tail !== '') {
      fullText += tail
      onChunk(tail)
    }

    return fullText
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
