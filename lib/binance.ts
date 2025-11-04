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
  futuresVolume?: string
  futuresQuoteVolume?: string
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
    const exchangeInfo = await (binance as any).exchangeInfo()
    return exchangeInfo.symbols
      .filter((s: any) => s.status === 'TRADING' && s.quoteAsset === 'USDT')
      .map((s: any) => s.symbol)
  } catch (error) {
    console.error('Error fetching symbols:', error)
    return []
  }
}

export async function getTicker(symbol: string): Promise<BinanceTicker | null> {
  try {
    // Fetch both spot and futures tickers in parallel
    const [spotResponse, futuresResponse] = await Promise.all([
      fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`),
      fetch(`https://fapi.binance.com/fapi/v1/ticker/24hr?symbol=${symbol}`),
    ])
    
    if (!spotResponse.ok) {
      console.error(`Binance API error for ${symbol}: ${spotResponse.status}`)
      return null
    }
    
    const spotTicker = await spotResponse.json()
    let futuresTicker: any = null
    
    if (futuresResponse.ok) {
      futuresTicker = await futuresResponse.json()
    }
    
    // Get price from multiple possible fields (same as getAllTickers)
    const price = spotTicker.lastPrice || spotTicker.price || spotTicker.closePrice || '0'
    const priceNum = parseFloat(price)
    
    // Filter out coins with zero or invalid price
    if (priceNum <= 0) {
      return null
    }
    
    return {
      symbol: spotTicker.symbol,
      price: price,
      priceChangePercent: spotTicker.priceChangePercent || '0',
      volume: spotTicker.volume || '0',
      quoteVolume: spotTicker.quoteVolume || '0',
      futuresVolume: futuresTicker?.volume || '0',
      futuresQuoteVolume: futuresTicker?.quoteVolume || '0',
      highPrice: spotTicker.highPrice || '0',
      lowPrice: spotTicker.lowPrice || '0',
      openPrice: spotTicker.openPrice || '0',
      prevClosePrice: spotTicker.prevClosePrice || '0',
      count: spotTicker.count || 0,
    } as BinanceTicker
  } catch (error) {
    console.error(`Error fetching ticker for ${symbol}:`, error)
    return null
  }
}

export async function getAllTickers(): Promise<BinanceTicker[]> {
  try {
    // Fetch both spot and futures tickers in parallel with timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 saniye timeout (artırıldı)
    
    const [spotResult, futuresResult] = await Promise.allSettled([
      fetch('https://api.binance.com/api/v3/ticker/24hr', {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
        },
      }),
      fetch('https://fapi.binance.com/fapi/v1/ticker/24hr', {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
        },
      }),
    ])
    
    clearTimeout(timeoutId)
    
    // Handle spot response
    let spotResponse: Response | null = null
    if (spotResult.status === 'fulfilled') {
      spotResponse = spotResult.value
    } else {
      if (spotResult.reason?.name === 'AbortError') {
        console.error('Spot tickers fetch timeout')
      } else {
        console.error('Spot tickers fetch error:', spotResult.reason)
      }
    }
    
    // Handle futures response
    let futuresResponse: Response | null = null
    if (futuresResult.status === 'fulfilled') {
      futuresResponse = futuresResult.value
    } else {
      // Futures başarısız olursa devam et, sadece spot ile çalış
      if (futuresResult.reason?.name !== 'AbortError') {
        console.error('Futures tickers fetch error:', futuresResult.reason)
      }
    }
    
    if (!spotResponse || !spotResponse.ok) {
      console.error('Failed to fetch spot tickers:', spotResponse?.status, spotResponse?.statusText)
      // Hata durumunda boş array döndür, exception fırlatma
      return []
    }
    
    const spotTickers = await spotResponse.json()
    let futuresTickers: any[] = []
    
    if (futuresResponse && futuresResponse.ok) {
      futuresTickers = await futuresResponse.json()
    }
    
    // Create a map of futures data by symbol
    const futuresMap = new Map<string, any>()
    for (const ticker of futuresTickers) {
      if (ticker.symbol.endsWith('USDT')) {
        futuresMap.set(ticker.symbol, ticker)
      }
    }
    
    const result: BinanceTicker[] = []
    
    for (const ticker of spotTickers) {
      if (ticker.symbol.endsWith('USDT')) {
        // Get price from multiple possible fields
        const price = ticker.lastPrice || ticker.price || ticker.closePrice || '0'
        const priceNum = parseFloat(price)
        
        // Filter out coins with zero or invalid price
        // Also filter out coins that haven't traded recently (volume is 0)
        if (priceNum > 0 && parseFloat(ticker.quoteVolume || '0') > 0) {
          const futuresData = futuresMap.get(ticker.symbol)
          
          result.push({
            symbol: ticker.symbol,
            price: price,
            priceChangePercent: ticker.priceChangePercent || '0',
            volume: ticker.volume || '0',
            quoteVolume: ticker.quoteVolume || '0',
            futuresVolume: futuresData?.volume || '0',
            futuresQuoteVolume: futuresData?.quoteVolume || '0',
            highPrice: ticker.highPrice || '0',
            lowPrice: ticker.lowPrice || '0',
            openPrice: ticker.openPrice || '0',
            prevClosePrice: ticker.prevClosePrice || '0',
            count: ticker.count || 0,
          })
        }
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
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 20000) // 20 saniye timeout
    
    const response = await fetch(
      `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`,
      { signal: controller.signal }
    )
    
    clearTimeout(timeoutId)
    
    if (!response.ok) {
      console.error(`Binance API error for ${symbol}:`, response.status, response.statusText)
      return []
    }
    
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
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.error(`Timeout fetching klines for ${symbol}`)
    } else {
      console.error(`Error fetching klines for ${symbol}:`, error)
    }
    return []
  }
}

export async function getFuturesKlines(symbol: string, interval: string = '1h', limit: number = 24) {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 20000) // 20 saniye timeout
    
    const response = await fetch(
      `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`,
      { signal: controller.signal }
    )
    
    clearTimeout(timeoutId)
    
    if (!response.ok) {
      console.error(`Binance Futures API error for ${symbol}:`, response.status, response.statusText)
      return []
    }
    
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
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.error(`Timeout fetching futures klines for ${symbol}`)
    } else {
      console.error(`Error fetching futures klines for ${symbol}:`, error)
    }
    return []
  }
}

