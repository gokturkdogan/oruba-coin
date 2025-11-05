import { NextRequest, NextResponse } from 'next/server'

export interface SpotCoin {
  symbol: string
  price: string
  priceChangePercent: string
  volume: string
  quoteVolume: string
  hourlySpotVolume?: string
  hourlySpotBuyVolume?: string
  hourlySpotSellVolume?: string
  highPrice: string
  lowPrice: string
  openPrice: string
  prevClosePrice: string
  count: number
}

// Get spot klines from Binance
async function getSpotKlines(symbol: string, interval: string = '1h', limit: number = 24) {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 20000)
    const response = await fetch(
      `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`,
      { signal: controller.signal }
    )
    clearTimeout(timeoutId)
    if (!response.ok) {
      console.error(`Binance Spot API error for ${symbol}:`, response.status, response.statusText)
      return []
    }
    const data = await response.json()
    return data.map((k: any[]) => ({
      openTime: k[0], open: k[1], high: k[2], low: k[3], close: k[4], volume: k[5],
      closeTime: k[6], quoteVolume: k[7], trades: k[8], takerBuyBaseVolume: k[9],
      takerBuyQuoteVolume: k[10],
    }))
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.error(`Timeout fetching spot klines for ${symbol}`)
    } else {
      console.error(`Error fetching spot klines for ${symbol}:`, error)
    }
    return []
  }
}

export async function GET(request: NextRequest) {
  try {
    // Fetch spot tickers from Binance
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 saniye timeout
    
    const response = await fetch('https://api.binance.com/api/v3/ticker/24hr', {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
      },
    })
    
    clearTimeout(timeoutId)
    
    if (!response.ok) {
      console.error('Failed to fetch spot tickers:', response.status, response.statusText)
      return NextResponse.json(
        { error: 'Failed to fetch spot coins', coins: [] },
        { status: response.status }
      )
    }
    
    const spotTickers = await response.json()
    
    // Filter and map to our format
    const coins: SpotCoin[] = []
    
    for (const ticker of spotTickers) {
      // Only include USDT pairs
      if (ticker.symbol.endsWith('USDT')) {
        // Get price from multiple possible fields
        const price = ticker.lastPrice || ticker.price || ticker.closePrice || '0'
        const priceNum = parseFloat(price)
        
        // Filter out coins with zero or invalid price
        // Also filter out coins that haven't traded recently (volume is 0)
        if (priceNum > 0 && parseFloat(ticker.quoteVolume || '0') > 0) {
          coins.push({
            symbol: ticker.symbol,
            price: price,
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
    }
    
    // Sort by quote volume (descending)
    coins.sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
    
    // Calculate hourly volumes for top 200 coins (to avoid rate limiting)
    const topCoins = coins.slice(0, 200)
    const hourlyVolumePromises = topCoins.map(async (coin) => {
      try {
        // Get current time and 1 hour ago
        const now = Date.now()
        const oneHourAgo = now - (60 * 60 * 1000)
        
        // Fetch 1-minute klines for the last hour (60 minutes)
        // We'll fetch more than needed to ensure we cover the full hour
        const klines = await getSpotKlines(coin.symbol, '1m', 120)
        
        if (!klines || klines.length === 0) {
          return { 
            symbol: coin.symbol, 
            hourlyVolume: '0',
            hourlyBuyVolume: '0',
            hourlySellVolume: '0'
          }
        }
        
        // Filter klines that fall within the last hour
        const filteredKlines = klines.filter((kline: any) => {
          const klineTime = kline.openTime
          return klineTime >= oneHourAgo && klineTime <= now
        })
        
        // Sum up quote volumes and calculate buy/sell volumes
        let totalHourlyVolume = 0
        let totalBuyVolume = 0
        let totalSellVolume = 0
        
        for (const kline of filteredKlines) {
          const quoteVolume = parseFloat(kline.quoteVolume || '0')
          const takerBuyQuoteVolume = parseFloat(kline.takerBuyQuoteVolume || '0')
          const buyVolume = takerBuyQuoteVolume
          const sellVolume = quoteVolume - buyVolume
          
          totalHourlyVolume += quoteVolume
          totalBuyVolume += buyVolume
          totalSellVolume += sellVolume
        }
        
        return { 
          symbol: coin.symbol, 
          hourlyVolume: totalHourlyVolume.toString(),
          hourlyBuyVolume: totalBuyVolume.toString(),
          hourlySellVolume: totalSellVolume.toString()
        }
      } catch (error) {
        console.error(`Error fetching hourly volume for ${coin.symbol}:`, error)
        return { 
          symbol: coin.symbol, 
          hourlyVolume: '0',
          hourlyBuyVolume: '0',
          hourlySellVolume: '0'
        }
      }
    })
    
    // Process in batches to avoid rate limiting (10 coins per batch, 200ms delay)
    const hourlyVolumes: Record<string, { volume: string, buyVolume: string, sellVolume: string }> = {}
    const batchSize = 10
    const delayBetweenBatches = 200
    
    for (let i = 0; i < hourlyVolumePromises.length; i += batchSize) {
      const batch = hourlyVolumePromises.slice(i, i + batchSize)
      const batchResults = await Promise.all(batch)
      
      for (const result of batchResults) {
        hourlyVolumes[result.symbol] = {
          volume: result.hourlyVolume,
          buyVolume: result.hourlyBuyVolume,
          sellVolume: result.hourlySellVolume
        }
      }
      
      // Add delay between batches (except for the last batch)
      if (i + batchSize < hourlyVolumePromises.length) {
        await new Promise(resolve => setTimeout(resolve, delayBetweenBatches))
      }
    }
    
    // Add hourly volumes to coins
    for (const coin of coins) {
      const hourlyData = hourlyVolumes[coin.symbol]
      if (hourlyData) {
        coin.hourlySpotVolume = hourlyData.volume || '0'
        coin.hourlySpotBuyVolume = hourlyData.buyVolume || '0'
        coin.hourlySpotSellVolume = hourlyData.sellVolume || '0'
      } else {
        coin.hourlySpotVolume = '0'
        coin.hourlySpotBuyVolume = '0'
        coin.hourlySpotSellVolume = '0'
      }
    }
    
    return NextResponse.json({
      coins,
      count: coins.length,
    })
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.error('Timeout fetching spot tickers')
      return NextResponse.json(
        { error: 'Request timeout', coins: [] },
        { status: 504 }
      )
    }
    
    console.error('Error fetching spot coins:', error)
    return NextResponse.json(
      { error: 'Failed to fetch spot coins', coins: [] },
      { status: 500 }
    )
  }
}

