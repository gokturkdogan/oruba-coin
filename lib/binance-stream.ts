export type BinanceStreamOptions = {
  market?: 'spot' | 'futures'
  endpoint?: 'ticker' | 'trade'
  withCredentials?: boolean
}

export function createBinanceEventSource(streams: string, options: BinanceStreamOptions = {}) {
  if (typeof window === 'undefined') {
    throw new Error('createBinanceEventSource can only be used in the browser')
  }

  const params = new URLSearchParams()
  params.set('streams', streams)

  if (options.market) {
    params.set('market', options.market)
  }

  if (options.endpoint) {
    params.set('endpoint', options.endpoint)
  }

  const url = `/api/binance/stream?${params.toString()}`
  const eventSource = new EventSource(url, { withCredentials: options.withCredentials ?? false })
  return eventSource
}
