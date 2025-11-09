import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/middleware'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)

    // Get statistics
    const [
      totalUsers,
      verifiedUsers,
      premiumUsers,
      totalWatchlists,
      recentUsers,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isVerified: true } }),
      prisma.user.count({
        where: {
          subscription: {
            status: 'active',
            currentPeriodEnd: { gt: new Date() },
          },
        },
      }),
      Promise.all([prisma.spotWatchlist.count(), prisma.futuresWatchlist.count()]).then(
        ([spotCount, futuresCount]) => spotCount + futuresCount
      ),
      prisma.user.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          name: true,
          createdAt: true,
          isVerified: true,
          subscription: {
            select: {
              status: true,
            },
          },
        },
      }),
    ])

    // Get user growth data (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    
    const userGrowth = await prisma.user.groupBy({
      by: ['createdAt'],
      where: {
        createdAt: {
          gte: thirtyDaysAgo,
        },
      },
      _count: {
        id: true,
      },
    })

    return NextResponse.json({
      stats: {
        totalUsers,
        verifiedUsers,
        premiumUsers,
        totalWatchlists,
        recentUsers,
        userGrowth: userGrowth.map((item) => ({
          date: item.createdAt,
          count: item._count.id,
        })),
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
    console.error('Admin stats error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}


