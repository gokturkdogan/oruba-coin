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

    return NextResponse.json({ alert, message: 'Alert oluşturuldu' }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Geçersiz veri formatı', details: error.errors },
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

