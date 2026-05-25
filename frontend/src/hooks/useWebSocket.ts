import { useEffect } from 'react'
import { wsClient } from '@/lib/ws'
import { useDispatcherStore } from '@/store/dispatcher'

export function useWebSocket() {
  const applyWsMessage = useDispatcherStore(s => s.applyWsMessage)
  const setWsState     = useDispatcherStore(s => s.setWsState)

  useEffect(() => {
    const WS_URL = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`
    wsClient.connect(WS_URL)

    const unsubMsg   = wsClient.subscribe(applyWsMessage)
    const unsubState = wsClient.onStateChange(setWsState)

    return () => {
      unsubMsg()
      unsubState()
      wsClient.disconnect()
    }
  }, [applyWsMessage, setWsState])
}
