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

    // Get basic ticker data
    const ticker = await getTicker(symbol.toUpperCase())
    if (!ticker) {
      return NextResponse.json(
        { error: 'Coin not found' },
        { status: 404 }
      )
    }

    // Get klines for chart
    const klines = await getKlines(symbol.toUpperCase(), '1h', 24)

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

