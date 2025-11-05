import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware'
import { prisma } from '@/lib/prisma'
import { sendOrderConfirmationEmail } from '@/lib/resend'
import { z } from 'zod'

// Helper function to format duration
function formatDuration(days: number): string {
  if (days === 30) return '1 Ay'
  if (days === 365) return '1 Yıl'
  if (days < 30) return `${days} Gün`
  if (days < 365) {
    const months = Math.floor(days / 30)
    const remainingDays = days % 30
    if (remainingDays === 0) return `${months} Ay`
    return `${months} Ay ${remainingDays} Gün`
  }
  const years = Math.floor(days / 365)
  const remainingDays = days % 365
  if (remainingDays === 0) return `${years} Yıl`
  const months = Math.floor(remainingDays / 30)
  if (months === 0) return `${years} Yıl ${remainingDays} Gün`
  return `${years} Yıl ${months} Ay`
}

const createOrderSchema = z.object({
  plan: z.string().min(1, 'Plan adı gereklidir'), // Plan name for backward compatibility
  planId: z.string().uuid().optional(), // Optional plan ID
  amount: z.number().positive('Fiyat pozitif olmalıdır'), // Plan price from frontend
})

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
    const { plan, amount } = createOrderSchema.parse(body)

    // Get plan details for email
    let planDetails = null
    let planDuration = 'Bilinmiyor'
    
    // Verify plan exists and is active (optional check)
    if (body.planId) {
      planDetails = await prisma.plan.findUnique({
        where: { id: body.planId },
      })
      if (!planDetails || !planDetails.isActive) {
        return NextResponse.json(
          { error: 'Seçilen plan bulunamadı veya aktif değil' },
          { status: 400 }
        )
      }
      // Verify amount matches plan price
      if (Math.abs(planDetails.price - amount) > 0.01) {
        return NextResponse.json(
          { error: 'Plan fiyatı uyuşmuyor' },
          { status: 400 }
        )
      }
      // Format plan duration
      planDuration = formatDuration(planDetails.durationDays)
    }

    // Get active bank account for email
    const bankAccount = await prisma.bankAccount.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    })

    const bankName = bankAccount?.bankName || process.env.NEXT_PUBLIC_BANK_NAME || 'Banka Adı'
    const iban = bankAccount?.iban || process.env.NEXT_PUBLIC_IBAN || 'TR00 0000 0000 0000 0000 0000 00'
    const accountHolder = bankAccount?.accountHolder || process.env.NEXT_PUBLIC_ACCOUNT_HOLDER || 'Oruba Coin'

    // Create pending payment
    const pendingPaymentOrder = await prisma.pendingPayment.create({
      data: {
        userId: user.id,
        plan,
        amount,
        status: 'pending',
      },
    })

    // Send confirmation email
    try {
      await sendOrderConfirmationEmail(
        user.email,
        user.name,
        planDetails?.name || plan,
        amount,
        planDuration,
        bankName,
        iban,
        accountHolder
      )
      console.log('[Order] Confirmation email sent to:', user.email)
    } catch (emailError) {
      // Log error but don't fail the order creation
      console.error('[Order] Failed to send confirmation email:', emailError)
    }

    return NextResponse.json({
      message: 'Sipariş oluşturuldu. Ödeme yaptıktan sonra admin onayı bekleniyor.',
      order: pendingPaymentOrder,
      pendingPayment: pendingPaymentOrder, // For backward compatibility
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

