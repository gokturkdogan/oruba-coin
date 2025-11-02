'use client'

export interface WebSocketMessage {
  type: 'price' | 'trade' | 'kline'
  symbol: string
  data: any
}

export class BinanceWebSocket {
  private ws: WebSocket | null = null
  private symbols: string[] = []
  private callbacks: Map<string, ((data: any) => void)[]> = new Map()
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5

  constructor(symbols: string[]) {
    this.symbols = symbols
  }

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return
    }

    // Binance WebSocket endpoint for ticker stream
    const streamNames = this.symbols
      .map((symbol) => `${symbol.toLowerCase()}@ticker`)
      .join('/')

    const wsUrl = `wss://stream.binance.com:9443/stream?streams=${streamNames}`

    try {
      this.ws = new WebSocket(wsUrl)

      this.ws.onopen = () => {
        console.log('WebSocket connected')
        this.reconnectAttempts = 0
      }

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          this.handleMessage(message)
        } catch (error) {
          console.error('Error parsing WebSocket message:', error)
        }
      }

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error)
      }

      this.ws.onclose = () => {
        console.log('WebSocket disconnected')
        this.reconnect()
      }
    } catch (error) {
      console.error('Failed to create WebSocket:', error)
    }
  }

  private handleMessage(message: any) {
    if (message.stream && message.data) {
      const stream = message.stream
      const data = message.data

      // Extract symbol from stream name (e.g., "btcusdt@ticker" -> "BTCUSDT")
      const symbol = stream.split('@')[0].toUpperCase()

      // Notify all callbacks for this symbol
      const callbacks = this.callbacks.get(symbol) || []
      callbacks.forEach((callback) => callback(data))
    }
  }

  subscribe(symbol: string, callback: (data: any) => void) {
    const normalizedSymbol = symbol.toUpperCase()
    const callbacks = this.callbacks.get(normalizedSymbol) || []
    callbacks.push(callback)
    this.callbacks.set(normalizedSymbol, callbacks)
  }

  unsubscribe(symbol: string, callback: (data: any) => void) {
    const normalizedSymbol = symbol.toUpperCase()
    const callbacks = this.callbacks.get(normalizedSymbol) || []
    const index = callbacks.indexOf(callback)
    if (index > -1) {
      callbacks.splice(index, 1)
      if (callbacks.length === 0) {
        this.callbacks.delete(normalizedSymbol)
      } else {
        this.callbacks.set(normalizedSymbol, callbacks)
      }
    }
  }

  private reconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached')
      return
    }

    this.reconnectAttempts++
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000)

    setTimeout(() => {
      console.log(`Reconnecting... (attempt ${this.reconnectAttempts})`)
      this.connect()
    }, delay)
  }

  disconnect() {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.callbacks.clear()
  }
}

// Singleton instance for common symbols
let globalWebSocket: BinanceWebSocket | null = null

export function getGlobalWebSocket(symbols: string[] = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'ADAUSDT', 'SOLUSDT']): BinanceWebSocket {
  if (!globalWebSocket) {
    globalWebSocket = new BinanceWebSocket(symbols)
    globalWebSocket.connect()
  }
  return globalWebSocket
}

