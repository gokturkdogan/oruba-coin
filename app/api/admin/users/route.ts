import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/middleware'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search') || ''
    const skip = (page - 1) * limit

    // Build where clause
    const where: any = {}
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          subscription: {
            select: {
              plan: true,
              status: true,
              currentPeriodEnd: true,
            },
          },
          _count: {
            select: {
              watchlist: true,
              priceAlerts: true,
            },
          },
        },
      }),
      prisma.user.count({ where }),
    ])

    return NextResponse.json({
      users: users.map((user) => ({
        id: user.id,
        email: user.email,
        name: user.name,
        isVerified: user.isVerified,
        isAdmin: user.isAdmin,
        createdAt: user.createdAt,
        subscription: user.subscription,
        watchlistCount: user._count.watchlist,
        priceAlertCount: user._count.priceAlerts,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Admin access required') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    console.error('Admin users error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}


