import { getStudentId, getAuthToken } from '../lib/auth'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

interface ApiOptions {
  method?: string
  body?: unknown
  headers?: Record<string, string>
}

export async function apiCall<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { method = 'GET', body, headers = {} } = options

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAuthToken()}`,
      'X-Student-Id': getStudentId(),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`)
  }

  return res.json() as Promise<T>
}

export async function uploadFile(file: File): Promise<{ uploadId: string; extractedData: unknown }> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('studentId', getStudentId())

  const res = await fetch(`${API_BASE}/ingest/upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${getAuthToken()}`,
      'X-Student-Id': getStudentId(),
    },
    body: formData,
  })

  if (!res.ok) {
    throw new Error(`Upload error: ${res.status} ${res.statusText}`)
  }

  return res.json()
}
