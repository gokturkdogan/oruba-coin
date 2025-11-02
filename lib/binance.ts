import Binance from 'binance-api-node'

export const binance = Binance({
  apiKey: process.env.BINANCE_API_KEY,
  apiSecret: process.env.BINANCE_API_SECRET,
})

export interface BinanceTicker {
  symbol: string
  price: string
  priceChangePercent: string
  volume: string
  quoteVolume: string
  highPrice: string
  lowPrice: string
  openPrice: string
  prevClosePrice: string
  count: number
}

export interface BinanceAggTrade {
  symbol: string
  price: string
  quantity: string
  isBuyerMaker: boolean
  time: number
}

export async function getAllSymbols(): Promise<string[]> {
  try {
    const exchangeInfo = await binance.exchangeInfo()
    return exchangeInfo.symbols
      .filter((s) => s.status === 'TRADING' && s.quoteAsset === 'USDT')
      .map((s) => s.symbol)
  } catch (error) {
    console.error('Error fetching symbols:', error)
    return []
  }
}

export async function getTicker(symbol: string): Promise<BinanceTicker | null> {
  try {
    // Use REST API directly
    const response = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`)
    if (!response.ok) return null
    
    const ticker = await response.json()
    
    return {
      symbol: ticker.symbol,
      price: ticker.lastPrice || '0',
      priceChangePercent: ticker.priceChangePercent || '0',
      volume: ticker.volume || '0',
      quoteVolume: ticker.quoteVolume || '0',
      highPrice: ticker.highPrice || '0',
      lowPrice: ticker.lowPrice || '0',
      openPrice: ticker.openPrice || '0',
      prevClosePrice: ticker.prevClosePrice || '0',
      count: ticker.count || 0,
    } as BinanceTicker
  } catch (error) {
    console.error(`Error fetching ticker for ${symbol}:`, error)
    return null
  }
}

export async function getAllTickers(): Promise<BinanceTicker[]> {
  try {
    // Use REST API directly for better compatibility
    const response = await fetch('https://api.binance.com/api/v3/ticker/24hr')
    if (!response.ok) throw new Error('Failed to fetch tickers')
    
    const tickers24hr = await response.json()
    
    const result: BinanceTicker[] = []
    
    for (const ticker of tickers24hr) {
      if (ticker.symbol.endsWith('USDT')) {
        result.push({
          symbol: ticker.symbol,
          price: ticker.lastPrice || '0',
          priceChangePercent: ticker.priceChangePercent || '0',
          volume: ticker.volume || '0',
          quoteVolume: ticker.quoteVolume || '0',
          highPrice: ticker.highPrice || '0',
          lowPrice: ticker.lowPrice || '0',
          openPrice: ticker.openPrice || '0',
          prevClosePrice: ticker.prevClosePrice || '0',
          count: ticker.count || 0,
        })
      }
    }
    
    return result.sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
  } catch (error) {
    console.error('Error fetching all tickers:', error)
    return []
  }
}

export async function getKlines(symbol: string, interval: string = '1h', limit: number = 24) {
  try {
    const response = await fetch(
      `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`
    )
    if (!response.ok) return []
    
    const data = await response.json()
    return data.map((k: any[]) => ({
      openTime: k[0],
      open: k[1],
      high: k[2],
      low: k[3],
      close: k[4],
      volume: k[5],
      closeTime: k[6],
      quoteVolume: k[7],
      trades: k[8],
      takerBuyBaseVolume: k[9],
      takerBuyQuoteVolume: k[10],
    }))
  } catch (error) {
    console.error(`Error fetching klines for ${symbol}:`, error)
    return []
  }
}

