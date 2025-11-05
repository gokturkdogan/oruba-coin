import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/middleware'
import { prisma } from '@/lib/prisma'

// GET - Fetch pending payments (admin only)
export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)

    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status') || 'pending'

    const pendingPayments = await prisma.pendingPayment.findMany({
      where: {
        status: status === 'all' ? undefined : status,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json({
      payments: pendingPayments.map((payment) => ({
        id: payment.id,
        userId: payment.userId,
        userEmail: payment.user.email,
        userName: payment.user.name,
        plan: payment.plan,
        amount: payment.amount,
        status: payment.status,
        currentPeriodEnd: payment.currentPeriodEnd,
        adminNotes: payment.adminNotes,
        createdAt: payment.createdAt,
        updatedAt: payment.updatedAt,
      })),
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Admin access required') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }
    console.error('Pending payments GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

