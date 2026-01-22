import { NextRequest, NextResponse } from 'next/server'
import { getAllTickers } from '@/lib/binance'

// Disable caching for this route
export const dynamic = 'force-dynamic'
export const revalidate = 0

// In-memory cache for price changes (5 minutes TTL)
const priceChangesCache = new Map<string, {
  data: Record<string, {
    '30min': number | null
    '1h': number | null
    '2h': number | null
    '4h': number | null
  }>
  timestamp: number
}>()

const CACHE_TTL = 5 * 60 * 1000 // 5 dakika

// Helper function to fetch price changes for multiple periods
// Optimized: Uses only 1 API call per coin (1m interval with limit=240 to get all periods)
// 240 dakika = 4 saat, bu tek istekle 30dk, 1h, 2h, 4h önceki fiyatları alabiliriz
async function getPriceChanges(symbol: string): Promise<{
  '30min': number | null
  '1h': number | null
  '2h': number | null
  '4h': number | null
} | null> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000) // 15 saniye timeout
    
    // Tek istek: 1m interval ile 240 mum al (4 saat = 240 dakika)
    // Bu tek istekle 30dk, 1h, 2h, 4h önceki fiyatları alabiliriz
    const response = await fetch(
      `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1m&limit=240`,
      { signal: controller.signal }
    )
    
    clearTimeout(timeoutId)
    
    if (!response.ok) {
      // Rate limit hatası durumunda exception fırlat
      if (response.status === 418 || response.status === 429) {
        throw new Error(`Rate limit: ${response.status}`)
      }
      return null
    }
    
    const klines = await response.json()
    if (!klines || klines.length === 0) {
      return null
    }
    
    // Binance klines API: klines[0] = en eski, klines[length-1] = en yeni
    // limit=240 ile: klines[0]=240dk (4h) önce, klines[210]=30dk önce, klines[180]=60dk (1h) önce, klines[120]=120dk (2h) önce
    let price30Min: number | null = null
    let price1H: number | null = null
    let price2H: number | null = null
    let price4H: number | null = null
    
    const totalKlines = klines.length
    
    // 4 saat önceki (en eski mum - index 0)
    if (totalKlines > 0) {
      price4H = parseFloat(klines[0][4]) // close price
    }
    
    // 2 saat önceki (120. mum - 120 dakika önce)
    if (totalKlines > 120) {
      price2H = parseFloat(klines[totalKlines - 120][4])
    }
    
    // 1 saat önceki (60. mum - 60 dakika önce)
    if (totalKlines > 60) {
      price1H = parseFloat(klines[totalKlines - 60][4])
    }
    
    // 30 dakika önceki (30. mum - 30 dakika önce)
    if (totalKlines > 30) {
      price30Min = parseFloat(klines[totalKlines - 30][4])
    }
    
    return {
      '30min': price30Min,
      '1h': price1H,
      '2h': price2H,
      '4h': price4H,
    }
  } catch (error) {
    console.error(`Error fetching price changes for ${symbol}:`, error)
    return null
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const prioritySymbolsParam = searchParams.get('prioritySymbols') // İlk yüklemede görünen coinler
    const prioritySymbols = prioritySymbolsParam ? prioritySymbolsParam.split(',').filter(s => s.trim()) : []
    
    // Get all tickers
    const tickers = await getAllTickers()
    const allSymbols = tickers.map(t => t.symbol)
    
    // Cache kontrolü
    const cacheKey = 'all'
    const cached = priceChangesCache.get(cacheKey)
    const now = Date.now()
    
    // Cache'den al (5 dakika içindeyse)
    let priceChangesMap: Record<string, {
      '30min': number | null
      '1h': number | null
      '2h': number | null
      '4h': number | null
    }> = {}
    
    if (cached && (now - cached.timestamp) < CACHE_TTL) {
      priceChangesMap = { ...cached.data }
    }
    
    // Priority symbols (ilk yüklemede görünen coinler) - cache'de yoksa veya eskiyse fetch et
    const symbolsToFetch: string[] = []
    
    if (prioritySymbols.length > 0) {
      for (const symbol of prioritySymbols) {
        const cachedSymbol = priceChangesMap[symbol]
        if (!cachedSymbol || !cachedSymbol['30min']) {
          symbolsToFetch.push(symbol)
        }
      }
    } else {
      // Priority yoksa, ilk 100 coin'i al (hızlı yükleme için)
      const first100Symbols = allSymbols.slice(0, 100)
      for (const symbol of first100Symbols) {
        const cachedSymbol = priceChangesMap[symbol]
        if (!cachedSymbol || !cachedSymbol['30min']) {
          symbolsToFetch.push(symbol)
        }
      }
    }
    
    // Sadece fetch edilmesi gereken coinler için istek at
    if (symbolsToFetch.length > 0) {
      // Optimize: Her coin için artık sadece 1 istek atıyoruz (önceden 2 istek)
      // Binance limit: 1200/dakika = 20/saniye
      // 4 saniyede maksimum 80 istek atabiliriz
      // Her coin 1 istek = 80 coin/batch (4 saniyede)
      const BATCH_SIZE = 80 // Optimize edilmiş batch size (her coin 1 istek)
      const DELAY_BETWEEN_BATCHES = 200 // Batch'ler arasında 200ms (rate limit için güvenli)
      
      // Symbol'leri batch'lere böl
      for (let i = 0; i < symbolsToFetch.length; i += BATCH_SIZE) {
        const batch = symbolsToFetch.slice(i, i + BATCH_SIZE)
        
        // Her batch için paralel istekler at
        const batchPromises = batch.map(async (symbol) => {
          try {
            const priceChanges = await getPriceChanges(symbol)
            if (priceChanges) {
              return { symbol, priceChanges }
            }
            return null
          } catch (error: any) {
            // Rate limit hatası durumunda bekle ve tekrar dene
            if (error.message?.includes('418') || error.message?.includes('429')) {
              console.warn(`Rate limit hit for ${symbol}, waiting 2 seconds...`)
              await new Promise(resolve => setTimeout(resolve, 2000))
              // Tekrar dene
              try {
                const priceChanges = await getPriceChanges(symbol)
                if (priceChanges) {
                  return { symbol, priceChanges }
                }
              } catch (retryError) {
                console.error(`Failed to fetch price changes for ${symbol} after retry:`, retryError)
              }
            } else {
              console.error(`Error fetching price changes for ${symbol}:`, error)
            }
            return null
          }
        })
        
        // Batch sonuçlarını bekle
        const batchResults = await Promise.allSettled(batchPromises)
        
        batchResults.forEach((result) => {
          if (result.status === 'fulfilled' && result.value) {
            priceChangesMap[result.value.symbol] = result.value.priceChanges
          }
        })
        
        // Rate limiting için batch'ler arasında kısa bekleme
        if (i + BATCH_SIZE < symbolsToFetch.length) {
          await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES))
        }
      }
      
      // Cache'i güncelle
      priceChangesCache.set(cacheKey, {
        data: priceChangesMap,
        timestamp: now
      })
    }
    
    return NextResponse.json({
      priceChanges: priceChangesMap,
      total: Object.keys(priceChangesMap).length,
      cached: cached ? (now - cached.timestamp) < CACHE_TTL : false
    })
  } catch (error) {
    console.error('Price changes API error:', error)
    return NextResponse.json(
      { error: 'Internal server error', priceChanges: {} },
      { status: 500 }
    )
  }
}
