'use client'

import { useEffect } from 'react'
import { createBinanceEventSource } from '@/lib/binance-stream'

type ExtendedWindow = Window & {
  __BINANCE_PROXY_INSTALLED__?: boolean
}

type BinanceProxyOptions = {
  streams: string
  market: 'spot' | 'futures'
  endpoint: 'ticker' | 'trade'
}

function parseBinanceUrl(url: string): BinanceProxyOptions | null {
  try {
    const parsed = new URL(url)
    const streams = parsed.searchParams.get('streams') || ''
    if (!streams) return null

    const host = parsed.hostname.toLowerCase()
    const market: 'spot' | 'futures' = host.includes('fstream') ? 'futures' : 'spot'
    const endpoint: 'ticker' | 'trade' = streams.includes('@trade') ? 'trade' : 'ticker'

    return { streams, market, endpoint }
  } catch {
    return null
  }
}

class BinanceProxyWebSocket {
  static readonly CONNECTING = WebSocket.CONNECTING
  static readonly OPEN = WebSocket.OPEN
  static readonly CLOSING = WebSocket.CLOSING
  static readonly CLOSED = WebSocket.CLOSED

  readonly CONNECTING = BinanceProxyWebSocket.CONNECTING
  readonly OPEN = BinanceProxyWebSocket.OPEN
  readonly CLOSING = BinanceProxyWebSocket.CLOSING
  readonly CLOSED = BinanceProxyWebSocket.CLOSED

  readyState: number = BinanceProxyWebSocket.CONNECTING
  binaryType: BinaryType = 'blob'
  bufferedAmount = 0
  extensions = ''
  protocol = ''
  url: string

  onopen: ((this: BinanceProxyWebSocket, ev: Event) => any) | null = null
  onmessage: ((this: BinanceProxyWebSocket, ev: MessageEvent<any>) => any) | null = null
  onerror: ((this: BinanceProxyWebSocket, ev: Event) => any) | null = null
  onclose: ((this: BinanceProxyWebSocket, ev: CloseEvent) => any) | null = null

  private eventSource: EventSource

  constructor(url: string, _protocols?: string | string[]) {
    this.url = url

    const parsed = parseBinanceUrl(url)
    if (!parsed) {
      throw new Error('Invalid Binance WebSocket URL')
    }

    this.eventSource = createBinanceEventSource(parsed.streams, {
      market: parsed.market,
      endpoint: parsed.endpoint,
    })

    this.eventSource.onopen = () => {
      this.readyState = BinanceProxyWebSocket.OPEN
      this.onopen?.(new Event('open'))
    }

    this.eventSource.onmessage = (event: MessageEvent<string>) => {
      this.onmessage?.(
        new MessageEvent('message', {
          data: event.data,
          origin: this.url,
        })
      )
    }

    this.eventSource.onerror = () => {
      // EventSource automatically retries; mark as connecting and notify listeners
      if (this.readyState !== BinanceProxyWebSocket.CLOSED) {
        this.readyState = BinanceProxyWebSocket.CONNECTING
      }
      this.onerror?.(new Event('error'))
    }
  }

  close(code?: number, reason?: string) {
    if (this.readyState === BinanceProxyWebSocket.CLOSED) return
    this.readyState = BinanceProxyWebSocket.CLOSING
    this.eventSource.close()
    this.readyState = BinanceProxyWebSocket.CLOSED

    try {
      // CloseEvent may not be constructable in all environments
      const closeEvent = new CloseEvent('close', {
        code: code ?? 1000,
        reason: reason ?? 'Normal closure',
        wasClean: true,
      })
      this.onclose?.(closeEvent)
    } catch {
      this.onclose?.({
        code: code ?? 1000,
        reason: reason ?? 'Normal closure',
        wasClean: true,
      } as CloseEvent)
    }
  }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions) {
    this.eventSource.addEventListener(type, listener as EventListener, options as any)
  }

  removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions) {
    this.eventSource.removeEventListener(type, listener as EventListener, options as any)
  }

  dispatchEvent(event: Event): boolean {
    return this.eventSource.dispatchEvent(event)
  }

  send(): never {
    throw new Error('BinanceProxyWebSocket does not support sending data')
  }
}

function installBinanceProxy() {
  if (typeof window === 'undefined') return

  const globalWindow = window as ExtendedWindow
  if (globalWindow.__BINANCE_PROXY_INSTALLED__) {
    return
  }

  const OriginalWebSocket = window.WebSocket

  const isBinanceUrl = (url: unknown): url is string => {
    return (
      typeof url === 'string' &&
      (url.startsWith('wss://stream.binance.com') || url.startsWith('wss://fstream.binance.com'))
    )
  }

  const WebSocketProxy = new Proxy(OriginalWebSocket as any, {
    construct(target, args) {
      const [url, protocols] = args
      if (isBinanceUrl(url)) {
        try {
          const proxy = new BinanceProxyWebSocket(url, protocols)
          return proxy
        } catch (error) {
          console.error('Failed to create Binance proxy websocket:', error)
        }
      }
      return new target(...args)
    },
  })

  window.WebSocket = WebSocketProxy as unknown as typeof WebSocket
  globalWindow.__BINANCE_PROXY_INSTALLED__ = true
}

if (typeof window !== 'undefined') {
  installBinanceProxy()
}

export function Providers() {
  useEffect(() => {
    installBinanceProxy()

    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
      const isSecureContext = window.location.protocol === "https:" || isLocalhost

      if (isSecureContext) {
        navigator.serviceWorker
          .register("/sw.js")
          .catch((error) => {
            console.error("Service worker registration failed", error)
          })
      }
    }
  }, [])

  return null
}
