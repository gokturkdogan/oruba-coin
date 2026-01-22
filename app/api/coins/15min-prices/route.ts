import { NextRequest, NextResponse } from 'next/server'
import { getAllTickers } from '@/lib/binance'

// Disable caching for this route
export const dynamic = 'force-dynamic'
export const revalidate = 0

// Helper function to fetch 15min ago price for a symbol
async function get15MinAgoPrice(symbol: string): Promise<number | null> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 saniye timeout
    
    const response = await fetch(
      `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1m&limit=15`,
      { 
        signal: controller.signal
      }
    )
    
    clearTimeout(timeoutId)
    
    if (!response.ok) {
      return null
    }
    
    const klines = await response.json()
    if (klines && klines.length > 0) {
      // İlk mumun close price'ı 15dk önceki fiyat
      return parseFloat(klines[0][4])
    }
    return null
  } catch (error) {
    console.error(`Error fetching 15min price for ${symbol}:`, error)
    return null
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get all tickers
    const tickers = await getAllTickers()
    const symbols = tickers.map(t => t.symbol)
    
    // Batch olarak 15dk önceki fiyatları al (paralel istekler)
    // Binance rate limit'i için batch size'ı 50 yapıyoruz
    const BATCH_SIZE = 50
    const price15MinMap: Record<string, number> = {}
    
    // Symbol'leri batch'lere böl
    for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
      const batch = symbols.slice(i, i + BATCH_SIZE)
      
      // Her batch için paralel istekler at
      const batchPromises = batch.map(async (symbol) => {
        const price15Min = await get15MinAgoPrice(symbol)
        if (price15Min !== null) {
          return { symbol, price15Min }
        }
        return null
      })
      
      const batchResults = await Promise.allSettled(batchPromises)
      
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          price15MinMap[result.value.symbol] = result.value.price15Min
        }
      })
      
      // Rate limiting için batch'ler arasında kısa bir bekleme
      if (i + BATCH_SIZE < symbols.length) {
        await new Promise(resolve => setTimeout(resolve, 100)) // 100ms bekleme
      }
    }
    
    return NextResponse.json({
      prices15Min: price15MinMap,
      total: Object.keys(price15MinMap).length
    })
  } catch (error) {
    console.error('15min prices API error:', error)
    return NextResponse.json(
      { error: 'Internal server error', prices15Min: {} },
      { status: 500 }
    )
  }
}
