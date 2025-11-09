import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/middleware'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updateUserSchema = z.object({
  name: z.string().optional(),
  isVerified: z.boolean().optional(),
  isAdmin: z.boolean().optional(),
  subscriptionCurrentPeriodEnd: z
    .union([z.string().datetime({ offset: true }), z.null()])
    .optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    await requireAdmin(request)

    const { userId } = await params

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        subscription: true,
        spotWatchlist: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
        futuresWatchlist: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: {
            spotWatchlist: true,
            futuresWatchlist: true,
            events: true,
          },
        },
      },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ user })
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
    console.error('Admin user detail error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    await requireAdmin(request)

    const { userId } = await params

    const body = await request.json()
    const data = updateUserSchema.parse(body)
    const { subscriptionCurrentPeriodEnd, ...userUpdateData } = data

    await prisma.user.update({
      where: { id: userId },
      data: userUpdateData,
    })

    if (subscriptionCurrentPeriodEnd !== undefined) {
      if (subscriptionCurrentPeriodEnd === null) {
        await prisma.subscription.deleteMany({
          where: { userId },
        })
      } else {
        const endDate = new Date(subscriptionCurrentPeriodEnd)
        if (Number.isNaN(endDate.getTime())) {
          return NextResponse.json(
            { error: 'Invalid subscription end date' },
            { status: 400 }
          )
        }
        const status = endDate > new Date() ? 'active' : 'expired'
        await prisma.subscription.upsert({
          where: { userId },
          update: {
            currentPeriodEnd: endDate,
            status,
          },
          create: {
            userId,
            plan: 'premium',
            status,
            currentPeriodEnd: endDate,
          },
        })
      }
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        subscription: true,
        _count: {
          select: {
            spotWatchlist: true,
            futuresWatchlist: true,
          },
        },
      },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found after update' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isVerified: user.isVerified,
        isAdmin: user.isAdmin,
        createdAt: user.createdAt,
        subscription: user.subscription,
        watchlistCount: (user._count.spotWatchlist || 0) + (user._count.futuresWatchlist || 0),
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      )
    }
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
    console.error('Admin user update error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}


