import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware'

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    
    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isVerified: user.isVerified,
        isAdmin: user.isAdmin,
        isPremium: user.subscription?.status === 'active' && 
                   user.subscription.currentPeriodEnd > new Date(),
        subscription: user.subscription ? {
          plan: user.subscription.plan,
          status: user.subscription.status,
          currentPeriodEnd: user.subscription.currentPeriodEnd,
        } : null,
      },
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    console.error('Profile error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

