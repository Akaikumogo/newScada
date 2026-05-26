import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { LiveDeviceData, LiveDeviceSignals, DeviceStatusInfo, WsState, WsMessage } from '@/types'

// ──────────────────────────────────────────────────
//  Dispatcher Store — Performance-optimized
// ──────────────────────────────────────────────────
//
//  Key optimizations:
//  1. recentlyChanged → removed entirely (flash detection
//     moved to SignalRow via useRef diff)
//  2. batchApplyWsMessages → single Immer draft for N messages
//  3. Shallow selectors recommended for object slices
// ──────────────────────────────────────────────────

interface DispatcherStore {
  // ── Live data ──────────────────────────────────────────
  signals:   Record<number, LiveDeviceSignals>  // device_id → signal_name → value
  statuses:  Record<number, DeviceStatusInfo>   // device_id → status

  // ── Revision counter — bumps on any signal update for a device ──
  //    Components subscribe to `revisions[deviceId]` to know when to re-check
  revisions: Record<number, number>

  // ── WebSocket ──────────────────────────────────────────
  wsState: WsState

  // ── UI Selection ───────────────────────────────────────
  selectedBranchId:     number | null
  selectedSubstationId: number | null

  // ── Actions ────────────────────────────────────────────
  batchApplyWsMessages: (msgs: WsMessage[]) => void
  hydrateLiveSnapshot:  (items: LiveDeviceData[]) => void
  setWsState:           (state: WsState) => void
  selectBranch:         (id: number | null) => void
  selectSubstation:     (id: number | null) => void
}

export const useDispatcherStore = create<DispatcherStore>()(
  immer((set) => ({
    signals:    {},
    statuses:   {},
    revisions:  {},
    wsState:    'connecting',
    selectedBranchId:     null,
    selectedSubstationId: null,

    // ── Batch apply: ONE Immer draft for ALL messages in a frame ──
    batchApplyWsMessages: (msgs) => set(state => {
      for (const msg of msgs) {
        if (msg.type === 'signal_update') {
          const { device_id: id, signal_name, value, quality, ts } = msg
          if (!state.signals[id]) state.signals[id] = {}
          state.signals[id][signal_name] = { value, quality, ts }
          // Bump revision counter — lightweight change detection
          state.revisions[id] = (state.revisions[id] ?? 0) + 1
        }
        else if (msg.type === 'device_status') {
          const { device_id: id, online, last_seen } = msg
          state.statuses[id] = {
            status:     online ? 'online' : 'offline',
            message:    online ? 'Connected' : 'Disconnected',
            updated_at: last_seen ?? new Date().toISOString(),
          }
        }
        // 'ping' — no-op
      }
    }),

    hydrateLiveSnapshot: (items) => set(state => {
      for (const item of items) {
        if (!state.signals[item.device_id]) state.signals[item.device_id] = {}
        for (const signal of item.signals) {
          state.signals[item.device_id][signal.signal_name] = {
            value:   signal.value,
            quality: signal.quality,
            ts:      signal.ts,
          }
        }
        state.statuses[item.device_id] = {
          status:     item.online ? 'online' : 'offline',
          message:    item.online ? 'Redis live' : 'Redis stale',
          updated_at: item.last_seen ?? new Date().toISOString(),
        }
        state.revisions[item.device_id] = (state.revisions[item.device_id] ?? 0) + 1
      }
    }),

    setWsState:      (wsState) => set(state => { state.wsState = wsState }),
    selectBranch:    (id)      => set(state => { state.selectedBranchId = id }),
    selectSubstation:(id)      => set(state => { state.selectedSubstationId = id }),
  }))
)
