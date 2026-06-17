// Shared with frontend — keep in sync
export interface Branch       { id: number; name: string; created_at: string }
export interface Substation   { id: number; branch_id: number; name: string; created_at: string }
export interface DeviceModel  { id: number; name: string; manufacturer?: string; created_at: string; signal_count: number }

export interface ModelSignal {
  id:            number
  model_id:      number
  register_code: number
  signal_name:   string
  signal_title?: string
  unit:          string
  value_type:    'float' | 'status' | 'counter'
}

export interface ApplyResult {
  applied:  number
  skipped:  number
  devices:  number
}

export interface Device {
  id: number
  substation_id: number
  model_id: number
  model?: DeviceModel
  name: string
  protocol: string
  iec104_host: string
  iec104_port: number
  iec104_common_address: number
  active: boolean
  created_at: string
  signals?: Signal[]
}

export interface Signal {
  id: number
  device_id: number
  register_code: number
  signal_name: string
  signal_title?: string
  unit: string
  value_type: 'float' | 'status' | 'counter'
  active: boolean
  only_realtime: boolean
}

export interface SchemaCanvas {
  canvas_json: object
  updated_at:  string
}

export interface RegisterLog {
  type: 'signal_log'
  device_id: number
  register_code: number
  signal_name: string
  signal_title?: string | null
  value: number
  quality: number
  asdu_type?: string
  cot?: number
  common_address?: number
  ts: string
}
