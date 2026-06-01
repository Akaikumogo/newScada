import type { Branch, Substation, Device, LiveDeviceData } from '@/types'
import type { HistoryRange } from './timeRange'

export type { HistoryRange } from './timeRange'

const BASE = '/api'

// ── Typed API Error ──────────────────────────────
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly detail: string,
    public readonly raw?: unknown,
  ) {
    super(detail)
    this.name = 'ApiError'
  }
}

// ── Core request ─────────────────────────────────
async function request<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new ApiError(res.status, body?.detail ?? `HTTP ${res.status}`, body)
  }
  return res.json()
}

/** Paginated response wrapper */
interface Paginated<T> { items: T[]; total: number }

// ── Branches ──────────────────────────────────────
export const branchApi = {
  list: (signal?: AbortSignal) =>
    request<Paginated<Branch>>('/branches', { signal }).then(r => r.items),
}

// ── Substations ───────────────────────────────────
export const substationApi = {
  list: (branchId?: number, signal?: AbortSignal) =>
    request<Paginated<Substation>>(
      `/substations${branchId ? `?branch_id=${branchId}` : ''}`,
      { signal },
    ).then(r => r.items),

  getById: (id: number, signal?: AbortSignal) =>
    request<Substation>(`/substations/${id}`, { signal }),

  getSchema: (id: number, signal?: AbortSignal) =>
    request<{ canvas_json: object } | null>(`/substations/${id}/schema`, { signal }),
}

// ── Devices ───────────────────────────────────────
export const deviceApi = {
  list: (substationId: number, signal?: AbortSignal) =>
    request<Paginated<Device>>(
      `/devices?substation_id=${substationId}`,
      { signal },
    ).then(r => r.items),

  listAll: (signal?: AbortSignal) =>
    request<Paginated<Device>>('/devices', { signal }).then(r => r.items),

  getById: (id: number, signal?: AbortSignal) =>
    request<Device>(`/devices/${id}`, { signal }),
}

// ── Telemetry ─────────────────────────────────────
export interface HistoryPoint {
  id:          number
  device_id:   number
  signal_name: string
  value:       number
  quality:     number
  captured_at: string
}

/** Aggregated OHLC-like bucket from /telemetry/range */
export interface RangePoint {
  ts:    string  // ISO timestamp
  open:  number
  high:  number
  low:   number
  close: number
  avg:   number
  count: number
}

export interface DeviceActivityBucket {
  ts: string
  active: boolean
  record_count: number
}

export interface DeviceActivityOutage {
  from_ts: string
  to_ts: string
  duration_sec: number
}

export interface DeviceActivityDevice {
  device_id: number
  name: string
  host: string
  port: number
  bucket_count: number
  active_buckets: number
  uptime_percent: number
  downtime_percent: number
  total_records: number
  first_seen: string | null
  last_seen: string | null
  outages: DeviceActivityOutage[]
  timeline: DeviceActivityBucket[]
}

export interface DeviceActivityResponse {
  from_ts: string
  to_ts: string
  bucket_sec: number
  devices: DeviceActivityDevice[]
}

export const telemetryApi = {
  /** Latest live values (REST fallback, WS is primary) */
  live: (substationId?: number, signal?: AbortSignal) =>
    request<LiveDeviceData[]>(
      `/telemetry/live${substationId ? `?substation_id=${substationId}` : ''}`,
      { signal },
    ),

  /** Historical records for a single signal */
  history: (
    params: { device_id: number; signal_name: string; range: HistoryRange },
    signal?: AbortSignal,
  ) =>
    request<HistoryPoint[]>(
      `/telemetry/history?device_id=${params.device_id}&signal_name=${encodeURIComponent(params.signal_name)}&range=${params.range}`,
      { signal },
    ),

  /** Custom-range query with adaptive bucketing — for trading-style charts */
  range: (
    params: {
      device_id:      number
      signal_name:    string
      from_ts:        Date | string
      to_ts:          Date | string
      target_points?: number
    },
    signal?: AbortSignal,
  ) => {
    const qs = new URLSearchParams({
      device_id:   String(params.device_id),
      signal_name: params.signal_name,
      from_ts:     params.from_ts instanceof Date ? params.from_ts.toISOString() : params.from_ts,
      to_ts:       params.to_ts   instanceof Date ? params.to_ts.toISOString()   : params.to_ts,
    })
    if (params.target_points) qs.set('target_points', String(params.target_points))
    return request<RangePoint[]>(`/telemetry/range?${qs}`, { signal })
  },

  /**
   * Diff — same signal_title across multiple devices.
   * Each device may have its own signal_name for that title — backend
   * resolves the mapping via device_signal table.
   *
   * Returns { device_id: RangePoint[] }
   */
  diff: (
    params: {
      signal_title:    string
      substation_id?:  number
      from_ts:         Date | string
      to_ts:           Date | string
      target_points?:  number
    },
    signal?: AbortSignal,
  ) => {
    const qs = new URLSearchParams()
    qs.set('signal_title', params.signal_title)
    qs.set('from_ts',      params.from_ts instanceof Date ? params.from_ts.toISOString() : params.from_ts)
    qs.set('to_ts',        params.to_ts   instanceof Date ? params.to_ts.toISOString()   : params.to_ts)
    if (params.substation_id != null) qs.set('substation_id', String(params.substation_id))
    if (params.target_points)         qs.set('target_points',  String(params.target_points))
    return request<Record<string, RangePoint[]>>(`/telemetry/diff?${qs}`, { signal })
  },

  /** List signal_titles available for diffing (present on >= min_devices) */
  diffSignals: (
    params?: { substation_id?: number; min_devices?: number },
    signal?: AbortSignal,
  ) => {
    const qs = new URLSearchParams()
    qs.set('min_devices', String(params?.min_devices ?? 2))
    if (params?.substation_id != null) qs.set('substation_id', String(params.substation_id))
    return request<Array<{
      signal_title:  string
      device_count:  number
      unit:          string | null
      sample_names:  string[]
    }>>(`/telemetry/diff/signals?${qs}`, { signal })
  },

  /**
   * Batch range — all (or subset of) signals for a device, in one request.
   *
   * If `signal_names` is omitted, the backend auto-resolves to all
   * active/realtime signals for the given device_id (saves URL space).
   */
  rangeMulti: (
    params: {
      device_id:      number
      signal_names?:  string[]
      from_ts:        Date | string
      to_ts:          Date | string
      target_points?: number
    },
    signal?: AbortSignal,
  ) => {
    const qs = new URLSearchParams()
    qs.set('device_id', String(params.device_id))
    qs.set('from_ts',   params.from_ts instanceof Date ? params.from_ts.toISOString() : params.from_ts)
    qs.set('to_ts',     params.to_ts   instanceof Date ? params.to_ts.toISOString()   : params.to_ts)
    if (params.target_points) qs.set('target_points', String(params.target_points))
    if (params.signal_names) {
      for (const name of params.signal_names) qs.append('signal_name', name)
    }
    return request<Record<string, RangePoint[]>>(`/telemetry/range/multi?${qs}`, { signal })
  },

  /** Cursor-based history page — infinite scroll */
  historyPage: (
    params: {
      device_id:   number
      signal_name: string
      range:       HistoryRange
      cursor?:     number
      limit?:      number
    },
    signal?: AbortSignal,
  ) => {
    const qs = new URLSearchParams({
      device_id:   String(params.device_id),
      signal_name: params.signal_name,
      range:       params.range,
    })
    if (params.cursor != null) qs.set('cursor', String(params.cursor))
    if (params.limit  != null) qs.set('limit',  String(params.limit))
    return request<HistoryPoint[]>(`/telemetry/history/page?${qs}`, { signal })
  },

  deviceActivity: (
    params: {
      from_ts: Date | string
      to_ts: Date | string
      substation_id?: number
      device_id?: number
      bucket_sec?: number
    },
    signal?: AbortSignal,
  ) => {
    const qs = new URLSearchParams()
    qs.set('from_ts', params.from_ts instanceof Date ? params.from_ts.toISOString() : params.from_ts)
    qs.set('to_ts', params.to_ts instanceof Date ? params.to_ts.toISOString() : params.to_ts)
    if (params.substation_id != null) qs.set('substation_id', String(params.substation_id))
    if (params.device_id != null) qs.set('device_id', String(params.device_id))
    if (params.bucket_sec != null) qs.set('bucket_sec', String(params.bucket_sec))
    return request<DeviceActivityResponse>(`/telemetry/device-activity?${qs}`, { signal })
  },
}
