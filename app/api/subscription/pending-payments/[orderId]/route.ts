import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/middleware'
import { prisma } from '@/lib/prisma'
import { sendPremiumWelcomeEmail } from '@/lib/resend'
import { z } from 'zod'

const approvePaymentSchema = z.object({
  currentPeriodEnd: z.string().datetime(), // ISO 8601 datetime string
  adminNotes: z.string().optional(),
})

// PUT - Approve or reject pending payment
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    await requireAdmin(request)

    const { orderId } = await params
    const body = await request.json()
    const { action, currentPeriodEnd, adminNotes } = body

    if (action !== 'approve' && action !== 'reject') {
      return NextResponse.json(
        { error: 'Invalid action. Use "approve" or "reject"' },
        { status: 400 }
      )
    }

    // Find pending payment
    const pendingPayment = await prisma.pendingPayment.findUnique({
      where: { id: orderId },
      include: { user: true },
    })

    if (!pendingPayment) {
      return NextResponse.json(
        { error: 'Payment order not found' },
        { status: 404 }
      )
    }

    if (pendingPayment.status !== 'pending') {
      return NextResponse.json(
        { error: 'Payment order is already processed' },
        { status: 400 }
      )
    }

    if (action === 'approve') {
      // Validate currentPeriodEnd
      if (!currentPeriodEnd) {
        return NextResponse.json(
          { error: 'currentPeriodEnd is required for approval' },
          { status: 400 }
        )
      }

      const periodEndDate = new Date(currentPeriodEnd)

      // Update pending payment status
      await prisma.pendingPayment.update({
        where: { id: orderId },
        data: {
          status: 'approved',
          currentPeriodEnd: periodEndDate,
          adminNotes: adminNotes || null,
        },
      })

      // Create or update subscription
      await prisma.subscription.upsert({
        where: { userId: pendingPayment.userId },
        create: {
          userId: pendingPayment.userId,
          plan: 'premium',
          status: 'active',
          currentPeriodEnd: periodEndDate,
        },
        update: {
          plan: 'premium',
          status: 'active',
          currentPeriodEnd: periodEndDate,
        },
      })

      // Get plan name from pending payment or use default
      const planName = pendingPayment.plan || 'Premium Plan'

      // Send welcome email
      try {
        await sendPremiumWelcomeEmail(
          pendingPayment.user.email,
          pendingPayment.user.name,
          planName,
          periodEndDate
        )
        console.log('[Payment Approval] Welcome email sent to:', pendingPayment.user.email)
      } catch (emailError) {
        // Log error but don't fail the approval
        console.error('[Payment Approval] Failed to send welcome email:', emailError)
      }

      return NextResponse.json({
        message: 'Payment approved and subscription activated',
      })
    } else {
      // Reject payment
      await prisma.pendingPayment.update({
        where: { id: orderId },
        data: {
          status: 'rejected',
          adminNotes: adminNotes || null,
        },
      })

      return NextResponse.json({
        message: 'Payment rejected',
      })
    }
  } catch (error) {
    if (error instanceof Error && error.message === 'Admin access required') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }
    console.error('Approve payment error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

