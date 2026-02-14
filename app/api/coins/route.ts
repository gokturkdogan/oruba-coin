import { NextRequest, NextResponse } from 'next/server'
import { getAllTickers } from '@/lib/binance'

// Disable caching for this route (data is too large for Next.js cache)
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get('search') || ''
    const sortBy = searchParams.get('sortBy') || 'volume'
    const sortOrder = searchParams.get('sortOrder') || 'desc'
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : null

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

    // Apply limit if provided
    const limited = limit ? filtered.slice(0, limit) : filtered

    const response = NextResponse.json({
      coins: limited,
      total: filtered.length,
    })
    
    // Cache-Control header'ı ekle (tarayıcı cache'ini önle)
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
    
    return response
  } catch (error) {
    console.error('Coins API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

