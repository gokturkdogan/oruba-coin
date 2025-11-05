import { NextRequest, NextResponse } from 'next/server'

export interface FuturesCoin {
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

export async function GET(request: NextRequest) {
  try {
    // Fetch futures tickers from Binance
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 saniye timeout
    
    const response = await fetch('https://fapi.binance.com/fapi/v1/ticker/24hr', {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
      },
    })
    
    clearTimeout(timeoutId)
    
    if (!response.ok) {
      console.error('Failed to fetch futures tickers:', response.status, response.statusText)
      return NextResponse.json(
        { error: 'Failed to fetch futures coins', coins: [] },
        { status: response.status }
      )
    }
    
    const futuresTickers = await response.json()
    
    // Filter and map to our format
    const coins: FuturesCoin[] = []
    
    for (const ticker of futuresTickers) {
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
    
    return NextResponse.json({
      coins,
      count: coins.length,
    })
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.error('Timeout fetching futures tickers')
      return NextResponse.json(
        { error: 'Request timeout', coins: [] },
        { status: 504 }
      )
    }
    
    console.error('Error fetching futures coins:', error)
    return NextResponse.json(
      { error: 'Failed to fetch futures coins', coins: [] },
      { status: 500 }
    )
  }
}

