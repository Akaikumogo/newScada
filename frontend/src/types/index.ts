// ══════════════════════════════════════════════════
//  Domain Types — newSCADA Dispatcher
// ══════════════════════════════════════════════════

export interface Branch {
  id: number
  name: string
  created_at: string
}

export interface Substation {
  id: number
  branch_id: number
  name: string
  created_at: string
}

export interface DeviceModel {
  id: number
  name: string
  manufacturer?: string
  created_at?: string
}

export type DeviceStatus = 'online' | 'offline' | 'warning' | 'unknown' | 'stale'

export interface Device {
  id: number
  substation_id: number
  model_id: number
  name: string
  protocol: string
  iec104_host: string
  iec104_port: number
  iec104_common_address: number
  poll_interval_seconds: number
  created_at: string
  signals: Signal[]    // always included from backend (selectinload)
}

export interface Signal {
  id: number
  device_id: number
  register_code: number
  signal_name: string
  signal_title?: string | null
  unit: string
  value_type: 'float' | 'status'
  active: boolean
  only_realtime: boolean
}

// ── Live / Real-time types ────────────────────────

export interface SignalValue {
  value:   number | null
  quality: number
  ts:      string | null
}

export type LiveDeviceSignals = Record<string, SignalValue>

export interface DeviceStatusInfo {
  status:     DeviceStatus
  message?:   string
  updated_at: string
}

export interface LiveDeviceData {
  device_id: number
  online: boolean
  last_seen: string | null
  signals: Array<{
    signal_name: string
    value: number | null
    quality: number
    ts: string | null
  }>
}

// ── WebSocket messages from backend ──────────────

export type WsMessage =
  | { type: 'signal_update'; device_id: number; signal_name: string; value: number; quality: number; ts: string }
  | { type: 'device_status'; device_id: number; online: boolean; last_seen: string }
  | { type: 'ping' }

// ── Store types ───────────────────────────────────

export type WsState = 'connected' | 'connecting' | 'disconnected'
