import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { LiveDeviceData, LiveDeviceSignals, DeviceStatusInfo, WsState, WsMessage } from '@/types'

type SignalUpdateMessage = Extract<WsMessage, { type: 'signal_update' }>

interface DispatcherStore {
  signals: Record<number, LiveDeviceSignals>
  statuses: Record<number, DeviceStatusInfo>
  revisions: Record<number, number>
  wsState: WsState

  selectedBranchId: number | null
  selectedSubstationId: number | null

  batchApplyWsMessages: (msgs: WsMessage[]) => void
  hydrateLiveSnapshot: (items: LiveDeviceData[]) => void
  setWsState: (state: WsState) => void
  selectBranch: (id: number | null) => void
  selectSubstation: (id: number | null) => void
}

export const useDispatcherStore = create<DispatcherStore>()(
  immer((set) => ({
    signals: {},
    statuses: {},
    revisions: {},
    wsState: 'connecting',
    selectedBranchId: null,
    selectedSubstationId: null,

    batchApplyWsMessages: (msgs) => set(state => {
      const touchedDevices = new Set<number>()

      const applySignalUpdate = (msg: SignalUpdateMessage) => {
        const { device_id: id, signal_name, value, quality, ts } = msg
        if (!state.signals[id]) state.signals[id] = {}
        state.signals[id][signal_name] = { value, quality, ts }
        touchedDevices.add(id)
      }

      for (const msg of msgs) {
        if (msg.type === 'signal_update') {
          applySignalUpdate(msg)
        } else if (msg.type === 'signal_batch') {
          for (const item of msg.items) {
            applySignalUpdate(item)
          }
        } else if (msg.type === 'device_status') {
          const { device_id: id, online, last_seen } = msg
          state.statuses[id] = {
            status: online ? 'online' : 'offline',
            message: online ? 'Connected' : 'Disconnected',
            updated_at: last_seen ?? new Date().toISOString(),
          }
        }
      }

      for (const id of touchedDevices) {
        state.revisions[id] = (state.revisions[id] ?? 0) + 1
      }
    }),

    hydrateLiveSnapshot: (items) => set(state => {
      for (const item of items) {
        if (!state.signals[item.device_id]) state.signals[item.device_id] = {}
        for (const signal of item.signals) {
          state.signals[item.device_id][signal.signal_name] = {
            value: signal.value,
            quality: signal.quality,
            ts: signal.ts,
          }
        }
        state.statuses[item.device_id] = {
          status: item.online ? 'online' : 'offline',
          message: item.online ? 'Redis live' : 'Redis stale',
          updated_at: item.last_seen ?? new Date().toISOString(),
        }
        state.revisions[item.device_id] = (state.revisions[item.device_id] ?? 0) + 1
      }
    }),

    setWsState: (wsState) => set(state => { state.wsState = wsState }),
    selectBranch: (id) => set(state => { state.selectedBranchId = id }),
    selectSubstation: (id) => set(state => { state.selectedSubstationId = id }),
  }))
)
