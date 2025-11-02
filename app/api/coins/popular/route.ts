import { NextResponse } from 'next/server'
import { getAllTickers } from '@/lib/binance'

export async function GET() {
  try {
    const tickers = await getAllTickers()
    // Get top 5 by volume
    const popular = tickers.slice(0, 5)

    return NextResponse.json({
      coins: popular,
    })
  } catch (error) {
    console.error('Popular coins API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

