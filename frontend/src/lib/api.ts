import type { Branch, Substation, Device } from '@/types'

const BASE = '/api'

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body?.detail ?? `HTTP ${res.status}`)
  }
  return res.json()
}

/** Paginated response wrapper */
interface Paginated<T> { items: T[]; total: number }

// ── Branches ──────────────────────────────────────
export const branchApi = {
  list: () => request<Paginated<Branch>>('/branches').then(r => r.items),
}

// ── Substations ───────────────────────────────────
export const substationApi = {
  list: (branchId?: number) =>
    request<Paginated<Substation>>(`/substations${branchId ? `?branch_id=${branchId}` : ''}`).then(r => r.items),
  getSchema: (id: number) =>
    request<{ canvas_json: object } | null>(`/substations/${id}/schema`),
}

// ── Devices ───────────────────────────────────────
export const deviceApi = {
  list:    (substationId: number) =>
    request<Paginated<Device>>(`/devices?substation_id=${substationId}`).then(r => r.items),
  listAll: () => request<Paginated<Device>>('/devices').then(r => r.items),
  getById: (id: number) => request<Device>(`/devices/${id}`),
}

// ── Telemetry ─────────────────────────────────────
export type HistoryRange = '1h' | '6h' | '24h' | '7d'

export interface HistoryPoint {
  id:          number
  device_id:   number
  signal_name: string
  value:       number
  quality:     number
  captured_at: string
}

export const telemetryApi = {
  /** Latest live values for a substation (REST fallback, WS is primary) */
  live: (substationId: number) =>
    request<Array<{
      device_id: number
      online:    boolean
      last_seen: string | null
      signals:   Array<{ signal_name: string; value: number | null; quality: number; ts: string | null }>
    }>>(`/telemetry/live?substation_id=${substationId}`),

  /** Historical records for a single signal */
  history: (params: {
    device_id:   number
    signal_name: string
    range:       HistoryRange
  }) =>
    request<HistoryPoint[]>(
      `/telemetry/history?device_id=${params.device_id}&signal_name=${encodeURIComponent(params.signal_name)}&range=${params.range}`
    ),

  /** Paginated history — infinite scroll uchun (yangi → eski) */
  historyPage: (params: {
    device_id:   number
    signal_name: string
    range:       HistoryRange
    cursor?:     number
    limit?:      number
  }) => {
    const qs = new URLSearchParams({
      device_id:   String(params.device_id),
      signal_name: params.signal_name,
      range:       params.range,
    })
    if (params.cursor != null) qs.set('cursor', String(params.cursor))
    if (params.limit  != null) qs.set('limit',  String(params.limit))
    return request<HistoryPoint[]>(`/telemetry/history/page?${qs}`)
  },
}
