import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const createOrderSchema = z.object({
  plan: z.enum(['monthly', 'yearly']),
})

// Plan fiyatları (env'den alınabilir)
const PLAN_PRICES = {
  monthly: 99,
  yearly: 899,
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request)

    // Check if user already has active subscription
    const existingSubscription = await prisma.subscription.findUnique({
      where: { userId: user.id },
    })

    if (existingSubscription && existingSubscription.status === 'active') {
      const isExpired = existingSubscription.currentPeriodEnd < new Date()
      if (!isExpired) {
        return NextResponse.json(
          { error: 'Zaten aktif bir aboneliğiniz var' },
          { status: 400 }
        )
      }
    }

    // Check if user has pending payment
    const pendingPayment = await prisma.pendingPayment.findFirst({
      where: {
        userId: user.id,
        status: 'pending',
      },
    })

    if (pendingPayment) {
      return NextResponse.json(
        { error: 'Zaten bekleyen bir ödeme talebiniz var. Lütfen önce onu tamamlayın veya iptal edin.' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { plan } = createOrderSchema.parse(body)

    const amount = PLAN_PRICES[plan]

    // Create pending payment
    const pendingPaymentOrder = await prisma.pendingPayment.create({
      data: {
        userId: user.id,
        plan,
        amount,
        status: 'pending',
      },
    })

    return NextResponse.json({
      message: 'Sipariş oluşturuldu. Ödeme yaptıktan sonra admin onayı bekleniyor.',
      order: {
        id: pendingPaymentOrder.id,
        plan,
        amount,
        status: pendingPaymentOrder.status,
      },
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Geçersiz plan seçimi' },
        { status: 400 }
      )
    }
    console.error('Create order error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

