import type { WsMessage } from '@/types'

type Handler = (msg: WsMessage) => void
type StateHandler = (state: 'connected' | 'connecting' | 'disconnected') => void

const RETRY_DELAYS = [1000, 2000, 4000, 8000, 15000]
const PING_INTERVAL = 25_000

class WsClient {
  private socket: WebSocket | null = null
  private handlers: Set<Handler> = new Set()
  private stateHandlers: Set<StateHandler> = new Set()
  private retryCount = 0
  private retryTimer?: ReturnType<typeof setTimeout>
  private pingTimer?: ReturnType<typeof setInterval>
  private url = ''

  connect(url: string) {
    this.url = url
    this.tryConnect()
  }

  private tryConnect() {
    this.setState('connecting')
    try {
      this.socket = new WebSocket(this.url)
    } catch {
      this.scheduleRetry()
      return
    }

    this.socket.onopen = () => {
      this.retryCount = 0
      this.setState('connected')
      this.startPing()
    }

    this.socket.onmessage = (e) => {
      try {
        const msg: WsMessage = JSON.parse(e.data)
        this.handlers.forEach(h => h(msg))
      } catch {/* ignore malformed */}
    }

    this.socket.onclose = () => {
      this.stopPing()
      this.setState('disconnected')
      this.scheduleRetry()
    }

    this.socket.onerror = () => {
      this.socket?.close()
    }
  }

  private scheduleRetry() {
    if (this.retryTimer) return
    const delay = RETRY_DELAYS[Math.min(this.retryCount, RETRY_DELAYS.length - 1)]
    this.retryCount++
    this.retryTimer = setTimeout(() => {
      this.retryTimer = undefined
      this.tryConnect()
    }, delay)
  }

  private startPing() {
    this.pingTimer = setInterval(() => {
      if (this.socket?.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({ type: 'ping' }))
      }
    }, PING_INTERVAL)
  }

  private stopPing() {
    if (this.pingTimer) { clearInterval(this.pingTimer); this.pingTimer = undefined }
  }

  private setState(state: 'connected' | 'connecting' | 'disconnected') {
    this.stateHandlers.forEach(h => h(state))
  }

  subscribe(handler: Handler)        { this.handlers.add(handler);      return () => this.handlers.delete(handler) }
  onStateChange(h: StateHandler)     { this.stateHandlers.add(h);       return () => this.stateHandlers.delete(h) }

  disconnect() {
    this.stopPing()
    clearTimeout(this.retryTimer)
    this.retryTimer = undefined
    this.socket?.close()
    this.socket = null
  }
}

export const wsClient = new WsClient()
