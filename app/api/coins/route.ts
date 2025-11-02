import { NextRequest, NextResponse } from 'next/server'
import { getAllTickers } from '@/lib/binance'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get('search') || ''
    const sortBy = searchParams.get('sortBy') || 'volume'
    const sortOrder = searchParams.get('sortOrder') || 'desc'
    const limit = parseInt(searchParams.get('limit') || '100')

    // Get tickers from Binance
    const tickers = await getAllTickers()

    // Filter and sort
    let filtered = tickers
    if (search) {
      filtered = tickers.filter((t) =>
        t.symbol.toLowerCase().includes(search.toLowerCase())
      )
    }

    // Sort
    filtered.sort((a, b) => {
      let aVal: number
      let bVal: number

      switch (sortBy) {
        case 'price':
          aVal = parseFloat(a.price)
          bVal = parseFloat(b.price)
          break
        case 'change':
          aVal = parseFloat(a.priceChangePercent)
          bVal = parseFloat(b.priceChangePercent)
          break
        case 'volume':
        default:
          aVal = parseFloat(a.quoteVolume)
          bVal = parseFloat(b.quoteVolume)
          break
      }

      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal
    })

    // Apply limit
    const limited = filtered.slice(0, limit)

    return NextResponse.json({
      coins: limited,
      total: filtered.length,
    })
  } catch (error) {
    console.error('Coins API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

