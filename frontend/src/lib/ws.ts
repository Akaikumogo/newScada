import type { WsMessage } from '@/types'

/**
 * Frame-batched WebSocket client.
 *
 * Instead of firing handlers on every incoming message (which causes
 * one React re-render per message), messages are buffered and flushed
 * once per requestAnimationFrame (~16ms). A single store update for
 * N messages = N× fewer re-renders.
 */

type BatchHandler = (msgs: WsMessage[]) => void
type StateHandler = (state: 'connected' | 'connecting' | 'disconnected') => void

const RETRY_DELAYS = [1000, 2000, 4000, 8000, 15000]

class WsClient {
  private socket: WebSocket | null = null
  private handlers: Set<BatchHandler> = new Set()
  private stateHandlers: Set<StateHandler> = new Set()
  private retryCount = 0
  private retryTimer?: ReturnType<typeof setTimeout>
  private url = ''

  // ── Frame batching ─────────────────────────────
  private buffer: WsMessage[] = []
  private rafId: number | null = null

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
    }

    this.socket.onmessage = (e) => {
      try {
        const msg: WsMessage = JSON.parse(e.data)
        this.buffer.push(msg)
        this.scheduleFlush()
      } catch {/* ignore malformed */}
    }

    this.socket.onclose = () => {
      this.flushNow() // deliver any remaining
      this.setState('disconnected')
      this.scheduleRetry()
    }

    this.socket.onerror = () => {
      this.socket?.close()
    }
  }

  /** Schedule a RAF flush (dedup — only one per frame) */
  private scheduleFlush() {
    if (this.rafId !== null) return
    this.rafId = requestAnimationFrame(() => {
      this.rafId = null
      this.flushNow()
    })
  }

  /** Deliver buffered messages to all handlers */
  private flushNow() {
    if (!this.buffer.length) return
    const batch = this.buffer
    this.buffer = []
    this.handlers.forEach(h => h(batch))
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

  private setState(state: 'connected' | 'connecting' | 'disconnected') {
    this.stateHandlers.forEach(h => h(state))
  }

  subscribe(handler: BatchHandler) {
    this.handlers.add(handler)
    return () => this.handlers.delete(handler)
  }

  onStateChange(h: StateHandler) {
    this.stateHandlers.add(h)
    return () => this.stateHandlers.delete(h)
  }

  disconnect() {
    if (this.rafId !== null) { cancelAnimationFrame(this.rafId); this.rafId = null }
    this.flushNow()
    clearTimeout(this.retryTimer)
    this.retryTimer = undefined
    this.socket?.close()
    this.socket = null
  }
}

export const wsClient = new WsClient()
