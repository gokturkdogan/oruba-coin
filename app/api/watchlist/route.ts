import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

// GET - Get user's watchlist
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value

    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const payload = verifyToken(token)
    if (!payload) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      )
    }

    const watchlist = await prisma.spotWatchlist.findMany({
      where: {
        userId: payload.userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json({
      watchlist: watchlist.map((item) => item.symbol),
    })
  } catch (error) {
    console.error('Watchlist GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Add coin to watchlist
export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value

    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const payload = verifyToken(token)
    if (!payload) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { symbol } = body

    if (!symbol) {
      return NextResponse.json(
        { error: 'Symbol is required' },
        { status: 400 }
      )
    }

    // Check if already in watchlist
    const existing = await prisma.spotWatchlist.findUnique({
      where: {
        userId_symbol: {
          userId: payload.userId,
          symbol: symbol.toUpperCase(),
        },
      },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Bu coin zaten takip listenizde' },
        { status: 400 }
      )
    }

    // Check watchlist limit (10 coins)
    const watchlistCount = await prisma.spotWatchlist.count({
      where: {
        userId: payload.userId,
      },
    })

    if (watchlistCount >= 10) {
      return NextResponse.json(
        { error: 'Takip listenizde maksimum 10 coin bulunabilir. Lütfen önce bir coin çıkarın.' },
        { status: 400 }
      )
    }

    // Add to watchlist
    await prisma.spotWatchlist.create({
      data: {
        userId: payload.userId,
        symbol: symbol.toUpperCase(),
      },
    })

    return NextResponse.json({
      message: 'Coin added to watchlist',
    })
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Coin already in watchlist' },
        { status: 400 }
      )
    }
    console.error('Watchlist POST error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE - Remove coin from watchlist
export async function DELETE(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value

    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const payload = verifyToken(token)
    if (!payload) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const symbol = searchParams.get('symbol')

    if (!symbol) {
      return NextResponse.json(
        { error: 'Symbol is required' },
        { status: 400 }
      )
    }

    // Remove from watchlist
    await prisma.spotWatchlist.delete({
      where: {
        userId_symbol: {
          userId: payload.userId,
          symbol: symbol.toUpperCase(),
        },
      },
    })

    return NextResponse.json({
      message: 'Coin removed from watchlist',
    })
  } catch (error) {
    console.error('Watchlist DELETE error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

