import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware'
import { prisma } from '@/lib/prisma'

// GET - Get current user's pending payment
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request)

    const pendingPayment = await prisma.pendingPayment.findFirst({
      where: {
        userId: user.id,
        status: 'pending',
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    if (!pendingPayment) {
      return NextResponse.json({
        pendingPayment: null,
      })
    }

    return NextResponse.json({
      pendingPayment: {
        id: pendingPayment.id,
        plan: pendingPayment.plan,
        amount: pendingPayment.amount,
        status: pendingPayment.status,
        createdAt: pendingPayment.createdAt,
      },
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    console.error('My pending payment GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

