import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { LiveDeviceSignals, DeviceStatusInfo, WsState } from '@/types'

// ── WS message shapes from our backend ──────────────────────────
interface WsSignalUpdate {
  type:        'signal_update'
  device_id:   number
  signal_name: string
  value:       number
  quality:     number
  ts:          string
}

interface WsDeviceStatus {
  type:       'device_status'
  device_id:  number
  online:     boolean
  last_seen:  string
}

interface WsPing {
  type: 'ping'
}

type WsMessage = WsSignalUpdate | WsDeviceStatus | WsPing

interface DispatcherStore {
  // ── Live data ──────────────────────────────────────────
  signals:         Record<number, LiveDeviceSignals>   // device_id → signal_name → value info
  statuses:        Record<number, DeviceStatusInfo>    // device_id → status info
  recentlyChanged: Map<string, number>                 // "deviceId:signalName" → timestamp

  // ── WebSocket ──────────────────────────────────────────
  wsState: WsState

  // ── UI Selection ───────────────────────────────────────
  selectedBranchId:     number | null
  selectedSubstationId: number | null

  // ── Actions ────────────────────────────────────────────
  applyWsMessage:  (msg: WsMessage) => void
  setWsState:      (state: WsState) => void
  selectBranch:    (id: number | null) => void
  selectSubstation:(id: number | null) => void
  markStale:       (key: string) => void
}

export const useDispatcherStore = create<DispatcherStore>()(
  immer((set) => ({
    signals:         {},
    statuses:        {},
    recentlyChanged: new Map(),
    wsState:         'connecting',
    selectedBranchId:     null,
    selectedSubstationId: null,

    applyWsMessage: (msg) => set(state => {
      if (msg.type === 'signal_update') {
        const { device_id: id, signal_name, value, quality, ts } = msg
        if (!state.signals[id]) state.signals[id] = {}
        state.signals[id][signal_name] = { value, quality, ts }
        // Flash animation key
        const key = `${id}:${signal_name}`
        state.recentlyChanged.set(key, Date.now())
      }

      if (msg.type === 'device_status') {
        const { device_id: id, online, last_seen } = msg
        state.statuses[id] = {
          status:     online ? 'online' : 'offline',
          message:    online ? 'Connected' : 'Disconnected',
          updated_at: last_seen ?? new Date().toISOString(),
        }
      }
      // 'ping' — no-op
    }),

    setWsState: (wsState) => set(state => { state.wsState = wsState }),
    selectBranch:    (id) => set(state => { state.selectedBranchId = id }),
    selectSubstation:(id) => set(state => { state.selectedSubstationId = id }),
    markStale: (key) => set(state => { state.recentlyChanged.delete(key) }),
  }))
)
