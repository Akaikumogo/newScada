import { useEffect } from 'react'
import { wsClient } from '@/lib/ws'
import { useDispatcherStore } from '@/store/dispatcher'

export function useWebSocket() {
  const batchApply = useDispatcherStore(s => s.batchApplyWsMessages)
  const setWsState = useDispatcherStore(s => s.setWsState)

  useEffect(() => {
    const WS_URL = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`
    wsClient.connect(WS_URL)

    // wsClient now delivers messages in RAF-batches
    // → single Zustand/Immer update for all messages in one animation frame
    const unsubMsg   = wsClient.subscribe(batchApply)
    const unsubState = wsClient.onStateChange(setWsState)

    return () => {
      unsubMsg()
      unsubState()
      wsClient.disconnect()
    }
  }, [batchApply, setWsState])
}
