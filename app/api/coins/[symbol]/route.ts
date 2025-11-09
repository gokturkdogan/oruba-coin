import { NextRequest, NextResponse } from 'next/server'
import { getTicker, getKlines, getFuturesKlines } from '@/lib/binance'
import { getAuthUser } from '@/lib/middleware'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  try {
    const { symbol } = await params
    const user = await getAuthUser(request)
    const isUserPremium = user?.subscription?.status === 'active' && 
                         user.subscription.currentPeriodEnd > new Date()

    // Get time range from query params
    const searchParams = request.nextUrl.searchParams
    const timeRange = searchParams.get('range') || '1D'

    // Get basic ticker data
    const ticker = await getTicker(symbol.toUpperCase())
    if (!ticker) {
      return NextResponse.json(
        { error: 'Coin not found' },
        { status: 404 }
      )
    }

    // Fetch ticker with buy/sell volume data
    const [spotTickerRes, futuresTickerRes] = await Promise.allSettled([
      fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol.toUpperCase()}`),
      fetch(`https://fapi.binance.com/fapi/v1/ticker/24hr?symbol=${symbol.toUpperCase()}`),
    ])

    const spotTickerData = spotTickerRes.status === 'fulfilled' && spotTickerRes.value.ok
      ? await spotTickerRes.value.json()
      : null
    const futuresTickerData = futuresTickerRes.status === 'fulfilled' && futuresTickerRes.value.ok
      ? await futuresTickerRes.value.json()
      : null

    // For 1-hour data, we'll calculate from klines (last 1 hour)
    // But for initial response, use 24h ticker data
    // Calculate spot buy/sell volumes from 24h ticker
    const spotQuoteVolume = parseFloat(spotTickerData?.quoteVolume || ticker.quoteVolume || '0')
    let spotBuyVolume24h = parseFloat(spotTickerData?.takerBuyQuoteVolume || '0')
    // Use takerSellQuoteVolume if available, otherwise calculate from difference
    let spotSellVolume24h = spotTickerData?.takerSellQuoteVolume 
      ? parseFloat(spotTickerData.takerSellQuoteVolume)
      : spotQuoteVolume - spotBuyVolume24h
    
    // Debug: Log volume data to verify accuracy
    if (spotQuoteVolume > 1000) {
      const buyPercent = spotQuoteVolume > 0 ? (spotBuyVolume24h / spotQuoteVolume) * 100 : 0
      const sellPercent = spotQuoteVolume > 0 ? (spotSellVolume24h / spotQuoteVolume) * 100 : 0
      console.log(`[${symbol}] Spot 24h volumes: Total=${spotQuoteVolume.toFixed(2)}, Buy=${spotBuyVolume24h.toFixed(2)} (${buyPercent.toFixed(1)}%), Sell=${spotSellVolume24h.toFixed(2)} (${sellPercent.toFixed(1)}%)`)
    }

    // Calculate futures buy/sell volumes from 24h ticker
    const futuresQuoteVolume = parseFloat(futuresTickerData?.quoteVolume || ticker.futuresQuoteVolume || '0')
    const futuresBuyVolume24h = parseFloat(futuresTickerData?.takerBuyQuoteVolume || '0')
    // Use takerSellQuoteVolume if available, otherwise calculate from difference
    const futuresSellVolume24h = futuresTickerData?.takerSellQuoteVolume
      ? parseFloat(futuresTickerData.takerSellQuoteVolume)
      : futuresQuoteVolume - futuresBuyVolume24h
    
    // Debug: Log futures volume data
    if (futuresQuoteVolume > 1000) {
      const buyPercent = futuresQuoteVolume > 0 ? (futuresBuyVolume24h / futuresQuoteVolume) * 100 : 0
      const sellPercent = futuresQuoteVolume > 0 ? (futuresSellVolume24h / futuresQuoteVolume) * 100 : 0
      console.log(`[${symbol}] Futures 24h volumes: Total=${futuresQuoteVolume.toFixed(2)}, Buy=${futuresBuyVolume24h.toFixed(2)} (${buyPercent.toFixed(1)}%), Sell=${futuresSellVolume24h.toFixed(2)} (${sellPercent.toFixed(1)}%)`)
    }

    // Determine interval and limit based on time range
    let interval = '1h'
    let limit = 24
    
    switch (timeRange) {
      case '1M':
        interval = '1m'
        limit = 5 // Son 5 dakika için 1 dakikalık mumlar (5 data point)
        break
      case '5M':
        interval = '1m'
        limit = 5 // Son 5 dakika için 1 dakikalık mumlar (5 data point)
        break
      case '15M':
        interval = '1m'
        limit = 15 // Son 15 dakika için 1 dakikalık mumlar (15 data point)
        break
      case '30M':
        interval = '1m'
        limit = 30 // Son 30 dakika için 1 dakikalık mumlar (30 data point)
        break
      case '1D':
        interval = '1h'
        limit = 24 // 24 hours
        break
      case '7D':
        interval = '4h' // 4 saatlik mumlar kullanarak veri sayısını azaltıyoruz (168 -> 42)
        limit = 42 // 7 days * 24 hours / 4 hours = 42 mum
        break
      case '30D':
        interval = '4h'
        limit = 180 // 30 days * 6 (4-hour intervals per day)
        break
      case '90D':
        interval = '1d'
        limit = 90 // 90 days
        break
      case '1Y':
        interval = '1w'
        limit = 52 // 52 weeks
        break
      default:
        interval = '1h'
        limit = 24
    }

    // Get klines for chart - both spot and futures
    // Use Promise.allSettled for better error handling, especially for 7D which fetches 168 data points
    const [klinesResult, futuresKlinesResult, aggTradesResponse] = await Promise.allSettled([
      getKlines(symbol.toUpperCase(), interval, limit),
      getFuturesKlines(symbol.toUpperCase(), interval, limit),
      fetch(`https://api.binance.com/api/v3/aggTrades?symbol=${symbol.toUpperCase()}&limit=1000`).catch(() => null),
    ])
    
    const klines = klinesResult.status === 'fulfilled' ? klinesResult.value : []
    const futuresKlines = futuresKlinesResult.status === 'fulfilled' ? futuresKlinesResult.value : []
    const aggTradesFetch = aggTradesResponse.status === 'fulfilled' ? aggTradesResponse.value : null

    // If spotBuyVolume24h is 0 or very small compared to quoteVolume, try to calculate from klines
    // This handles cases where Binance API doesn't return takerBuyQuoteVolume
    if ((spotBuyVolume24h === 0 || (spotQuoteVolume > 0 && spotBuyVolume24h < spotQuoteVolume * 0.01)) && klines.length > 0) {
      // For 24h volume, we need to fetch 24h klines explicitly
      // But first, try to use existing klines if they cover 24h period
      const now = Date.now()
      const twentyFourHoursAgo = now - (24 * 60 * 60 * 1000)
      
      // Filter klines from last 24 hours
      const last24hKlines = klines.filter((k: any) => k.openTime >= twentyFourHoursAgo)
      
      if (last24hKlines.length > 0) {
        const calculatedBuy = last24hKlines.reduce((sum: number, k: any) => {
          return sum + parseFloat(k.takerBuyQuoteVolume || '0')
        }, 0)
        
        const calculatedSell = last24hKlines.reduce((sum: number, k: any) => {
          const quoteVol = parseFloat(k.quoteVolume || '0')
          const buyVol = parseFloat(k.takerBuyQuoteVolume || '0')
          return sum + (quoteVol - buyVol)
        }, 0)
        
        // Only use klines calculation if it gives meaningful results
        if (calculatedBuy > 0 || calculatedSell > 0) {
          spotBuyVolume24h = calculatedBuy
          spotSellVolume24h = calculatedSell
        }
      } else if (interval === '1h' && limit >= 24) {
        // If we have 24 hourly klines, use all of them (they should cover 24h)
        spotBuyVolume24h = klines.reduce((sum: number, k: any) => {
          return sum + parseFloat(k.takerBuyQuoteVolume || '0')
        }, 0)
        
        spotSellVolume24h = klines.reduce((sum: number, k: any) => {
          const quoteVol = parseFloat(k.quoteVolume || '0')
          const buyVol = parseFloat(k.takerBuyQuoteVolume || '0')
          return sum + (quoteVol - buyVol)
        }, 0)
      }
    }

    // Calculate trade statistics
    let tradeCount = ticker.count || 0
    let highestBuyPrice = '0'
    let highestSellPrice = '0'

    if (aggTradesFetch && aggTradesFetch.ok) {
      try {
        const aggTrades = await aggTradesFetch.json()
        let maxBuyPrice = 0
        let maxSellPrice = 0

        // aggTrades'de isBuyerMaker: true = satıcı, false = alıcı
        // Yani isBuyerMaker: false = alış (buy), true = satış (sell)
        for (const trade of aggTrades) {
          const price = parseFloat(trade.p || trade.price || '0')
          const isBuyerMaker = trade.m !== undefined ? trade.m : (trade.isBuyerMaker !== undefined ? trade.isBuyerMaker : false)
          
          if (price > 0) {
            if (!isBuyerMaker) {
              // Alış (buy) - buyer maker değil
              if (price > maxBuyPrice) {
                maxBuyPrice = price
              }
            } else {
              // Satış (sell) - buyer maker (yani satıcı)
              if (price > maxSellPrice) {
                maxSellPrice = price
              }
            }
          }
        }

        highestBuyPrice = maxBuyPrice > 0 ? maxBuyPrice.toString() : '0'
        highestSellPrice = maxSellPrice > 0 ? maxSellPrice.toString() : '0'
      } catch (error) {
        console.error('Error parsing aggTrades:', error)
      }
    }

    const response: any = {
      symbol: ticker.symbol,
      price: ticker.price,
      priceChangePercent: ticker.priceChangePercent,
      volume: ticker.volume,
      quoteVolume: ticker.quoteVolume,
      futuresVolume: ticker.futuresVolume || '0',
      futuresQuoteVolume: ticker.futuresQuoteVolume || '0',
      spotBuyVolume: spotBuyVolume24h > 0 ? spotBuyVolume24h.toString() : '0',
      spotSellVolume: spotSellVolume24h > 0 ? spotSellVolume24h.toString() : '0',
      futuresBuyVolume: futuresBuyVolume24h > 0 ? futuresBuyVolume24h.toString() : '0',
      futuresSellVolume: futuresSellVolume24h > 0 ? futuresSellVolume24h.toString() : '0',
      highPrice: ticker.highPrice,
      lowPrice: ticker.lowPrice,
      openPrice: ticker.openPrice,
      prevClosePrice: ticker.prevClosePrice,
      tradeCount: tradeCount,
      highestBuyPrice: highestBuyPrice,
      highestSellPrice: highestSellPrice,
      klines: klines.map((k: any) => {
        const quoteVolume = parseFloat(k.quoteVolume || '0')
        const buyVolume = parseFloat(k.takerBuyQuoteVolume || '0')
        // Calculate sell volume: quoteVolume should be sum of buy + sell
        // But if buyVolume is close to quoteVolume, it might indicate data issue
        const sellVolume = quoteVolume - buyVolume
        
        // Validate: buyVolume + sellVolume should be approximately equal to quoteVolume
        // If difference is too large, log for debugging
        const total = buyVolume + sellVolume
        const difference = Math.abs(quoteVolume - total)
        const percentDiff = quoteVolume > 0 ? (difference / quoteVolume) * 100 : 0
        
        if (percentDiff > 5 && quoteVolume > 1000) { // More than 5% difference and meaningful volume
          console.warn(`[${symbol}] Volume mismatch in kline: quoteVolume=${quoteVolume}, buy=${buyVolume}, sell=${sellVolume}, total=${total}, diff=${percentDiff.toFixed(2)}%`)
        }
        
        return {
          time: k.openTime,
          open: parseFloat(k.open),
          high: parseFloat(k.high),
          low: parseFloat(k.low),
          close: parseFloat(k.close),
          volume: quoteVolume, // USDT cinsinden toplam volume (quoteVolume)
          buyVolume: buyVolume, // Alış hacmi (takerBuyQuoteVolume)
          sellVolume: sellVolume > 0 ? sellVolume : 0, // Satış hacmi
        }
      }),
      // Calculate 1-hour buy/sell volumes from klines (sum of last hour)
      spotBuyVolume1h: klines.reduce((sum: number, k: any) => {
        return sum + parseFloat(k.takerBuyQuoteVolume || '0')
      }, 0).toString(),
      spotSellVolume1h: klines.reduce((sum: number, k: any) => {
        const quoteVolume = parseFloat(k.quoteVolume || '0')
        const buyVolume = parseFloat(k.takerBuyQuoteVolume || '0')
        return sum + (quoteVolume - buyVolume)
      }, 0).toString(),
      futuresKlines: futuresKlines.map((k: any) => {
        const quoteVolume = parseFloat(k.quoteVolume || '0')
        const buyVolume = parseFloat(k.takerBuyQuoteVolume || '0')
        const sellVolume = quoteVolume - buyVolume
        
        // Validate: buyVolume + sellVolume should be approximately equal to quoteVolume
        const total = buyVolume + sellVolume
        const difference = Math.abs(quoteVolume - total)
        const percentDiff = quoteVolume > 0 ? (difference / quoteVolume) * 100 : 0
        
        if (percentDiff > 5 && quoteVolume > 1000) { // More than 5% difference and meaningful volume
          console.warn(`[${symbol}] Futures volume mismatch in kline: quoteVolume=${quoteVolume}, buy=${buyVolume}, sell=${sellVolume}, total=${total}, diff=${percentDiff.toFixed(2)}%`)
        }
        
        return {
          time: k.openTime,
          open: parseFloat(k.open),
          high: parseFloat(k.high),
          low: parseFloat(k.low),
          close: parseFloat(k.close),
          volume: quoteVolume, // USDT cinsinden toplam volume (quoteVolume)
          buyVolume: buyVolume, // Alış hacmi
          sellVolume: sellVolume > 0 ? sellVolume : 0, // Satış hacmi
        }
      }),
      // Calculate 1-hour futures buy/sell volumes from futures klines
      futuresBuyVolume1h: futuresKlines.reduce((sum: number, k: any) => {
        return sum + parseFloat(k.takerBuyQuoteVolume || '0')
      }, 0).toString(),
      futuresSellVolume1h: futuresKlines.reduce((sum: number, k: any) => {
        const quoteVolume = parseFloat(k.quoteVolume || '0')
        const buyVolume = parseFloat(k.takerBuyQuoteVolume || '0')
        return sum + (quoteVolume - buyVolume)
      }, 0).toString(),
    }

    // Premium features
    if (isUserPremium) {
      // Add additional indicators and data
      const dailyKlines = await getKlines(symbol.toUpperCase(), '1d', 30)
      response.premium = {
        dailyChart: dailyKlines.map((k: any) => ({
          time: k.openTime,
          open: parseFloat(k.open),
          high: parseFloat(k.high),
          low: parseFloat(k.low),
          close: parseFloat(k.close),
          volume: parseFloat(k.quoteVolume), // USDT cinsinden volume (quoteVolume)
        })),
      }
    }

    return NextResponse.json(response)
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    console.error('Coin detail API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

