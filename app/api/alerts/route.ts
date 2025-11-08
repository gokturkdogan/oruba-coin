import { NextRequest, NextResponse } from 'next/server'
import { requirePremium } from '@/lib/middleware'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const createAlertSchema = z.object({
  symbol: z.string().min(1),
  market: z.enum(['spot', 'futures']),
  type: z.enum(['above', 'below']),
  targetPrice: z.number().positive(),
})

const DAILY_ALERT_LIMIT = 5
const ALERT_CREATION_EVENT = 'price_alert_created'

// GET /api/alerts?market=spot&symbol=ETHUSDT
export async function GET(request: NextRequest) {
  try {
    const user = await requirePremium(request)
    const { searchParams } = new URL(request.url)
    const market = searchParams.get('market')
    const symbol = searchParams.get('symbol')

    // Market parametresi zorunlu
    if (!market || !['spot', 'futures'].includes(market)) {
      return NextResponse.json(
        { error: 'Market parametresi gerekli (spot veya futures)' },
        { status: 400 }
      )
    }

    const where: any = {
      userId: user.id,
      market: market,
    }

    // Symbol varsa filtrele
    if (symbol) {
      where.symbol = symbol.toUpperCase()
    }

    const alerts = await prisma.priceAlert.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json({ alerts })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    if (error instanceof Error && error.message === 'Premium required') {
      return NextResponse.json(
        { error: 'Bu özellik premium üyelik gerektirir' },
        { status: 403 }
      )
    }
    console.error('Get alerts error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/alerts
export async function POST(request: NextRequest) {
  try {
    const user = await requirePremium(request)
    const body = await request.json()
    const { symbol, market, type, targetPrice } = createAlertSchema.parse(body)

    // Aynı coin için aynı type'ta alert var mı kontrol et
    const existingAlert = await prisma.priceAlert.findUnique({
      where: {
        userId_symbol_market_type: {
          userId: user.id,
          symbol: symbol.toUpperCase(),
          market: market,
          type: type,
        },
      },
    })

    if (existingAlert) {
      // Varsa güncelle
      const updated = await prisma.priceAlert.update({
        where: { id: existingAlert.id },
        data: {
          targetPrice: targetPrice,
          isActive: true,
          triggeredAt: null, // Yeni hedef fiyat, trigger'ı sıfırla
        },
      })

      return NextResponse.json({ alert: updated, message: 'Alert güncellendi' })
    }

    const now = new Date()
    const startOfDayUtc = new Date(now)
    startOfDayUtc.setUTCHours(0, 0, 0, 0)

    const alertsCreatedToday = await prisma.userEvent.count({
      where: {
        userId: user.id,
        eventType: ALERT_CREATION_EVENT,
        createdAt: {
          gte: startOfDayUtc,
        },
      },
    })

    if (alertsCreatedToday >= DAILY_ALERT_LIMIT) {
      return NextResponse.json(
        {
          error: `Günlük alarm limiti aşıldı. Bir kullanıcı günde en fazla ${DAILY_ALERT_LIMIT} yeni alarm oluşturabilir.`,
        },
        { status: 429 }
      )
    }

    // Yoksa yeni oluştur
    const alert = await prisma.priceAlert.create({
      data: {
        userId: user.id,
        symbol: symbol.toUpperCase(),
        market: market,
        type: type,
        targetPrice: targetPrice,
        isActive: true,
      },
    })

    await prisma.userEvent.create({
      data: {
        userId: user.id,
        eventType: ALERT_CREATION_EVENT,
        payload: {
          symbol: symbol.toUpperCase(),
          market,
          type,
          targetPrice,
        },
      },
    })

    return NextResponse.json({ alert, message: 'Alert oluşturuldu' }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Geçersiz veri formatı', details: error.issues },
        { status: 400 }
      )
    }
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    if (error instanceof Error && error.message === 'Premium required') {
      return NextResponse.json(
        { error: 'Bu özellik premium üyelik gerektirir' },
        { status: 403 }
      )
    }
    console.error('Create alert error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

