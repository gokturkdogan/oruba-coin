import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/middleware'
import { z } from 'zod'

const priceAlertSchema = z.object({
  symbol: z.string().min(1),
  targetPrice: z.number().positive(),
  type: z.enum(['above', 'below']),
})

// GET - Fetch user's price alerts
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    const userId = user.id

    const alerts = await prisma.priceAlert.findMany({
      where: {
        userId,
        isActive: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json({ alerts })
  } catch (error) {
    console.error('Price alert GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Create a new price alert
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    const userId = user.id

    const body = await request.json()
    const { symbol, targetPrice, type } = priceAlertSchema.parse(body)

    // Check if user has this coin in watchlist
    const watchlistItem = await prisma.watchlist.findUnique({
      where: {
        userId_symbol: {
          userId,
          symbol: symbol.toUpperCase(),
        },
      },
    })

    if (!watchlistItem) {
      return NextResponse.json(
        { error: 'Bu coin takip listenizde bulunmuyor. Önce takip listenize ekleyin.' },
        { status: 400 }
      )
    }

    // Check alert count for this coin (max 5)
    const alertCount = await prisma.priceAlert.count({
      where: {
        userId,
        symbol: symbol.toUpperCase(),
        isActive: true,
      },
    })

    if (alertCount >= 5) {
      return NextResponse.json(
        { error: 'Bu coin için maksimum 5 alarm ekleyebilirsiniz. Lütfen önce mevcut alarmlardan birini silin.' },
        { status: 400 }
      )
    }

    // Create new alert
    const alert = await prisma.priceAlert.create({
      data: {
        userId,
        symbol: symbol.toUpperCase(),
        targetPrice,
        type,
        isActive: true,
      },
    })

    return NextResponse.json({
      message: 'Fiyat alarmı oluşturuldu',
      alert,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Geçersiz veri formatı', details: error.errors },
        { status: 400 }
      )
    }
    console.error('Price alert POST error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE - Delete a price alert
export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    const userId = user.id

    const searchParams = request.nextUrl.searchParams
    const alertId = searchParams.get('alertId')

    if (!alertId) {
      return NextResponse.json(
        { error: 'AlertId parametresi gerekli' },
        { status: 400 }
      )
    }

    // Deactivate the alert instead of deleting
    await prisma.priceAlert.update({
      where: {
        id: alertId,
        userId, // Ensure user owns this alert
      },
      data: {
        isActive: false,
      },
    })

    return NextResponse.json({
      message: 'Fiyat alarmı silindi',
    })
  } catch (error) {
    console.error('Price alert DELETE error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

