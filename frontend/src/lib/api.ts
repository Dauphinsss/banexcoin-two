import type { CreateUploadResponse, UploadSummary } from '@banex/types'

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
}
