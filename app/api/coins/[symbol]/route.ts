import { NextRequest, NextResponse } from 'next/server'
import { getTicker, getKlines } from '@/lib/binance'
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

    // Determine interval and limit based on time range
    let interval = '1h'
    let limit = 24
    
    switch (timeRange) {
      case '1D':
        interval = '1h'
        limit = 24 // 24 hours
        break
      case '7D':
        interval = '1h'
        limit = 168 // 7 days * 24 hours
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

    // Get klines for chart
    const klines = await getKlines(symbol.toUpperCase(), interval, limit)

    const response: any = {
      symbol: ticker.symbol,
      price: ticker.price,
      priceChangePercent: ticker.priceChangePercent,
      volume: ticker.volume,
      quoteVolume: ticker.quoteVolume,
      futuresVolume: ticker.futuresVolume || '0',
      futuresQuoteVolume: ticker.futuresQuoteVolume || '0',
      highPrice: ticker.highPrice,
      lowPrice: ticker.lowPrice,
      openPrice: ticker.openPrice,
      prevClosePrice: ticker.prevClosePrice,
      klines: klines.map((k: any) => ({
        time: k.openTime,
        open: parseFloat(k.open),
        high: parseFloat(k.high),
        low: parseFloat(k.low),
        close: parseFloat(k.close),
        volume: parseFloat(k.volume),
      })),
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
          volume: parseFloat(k.volume),
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

