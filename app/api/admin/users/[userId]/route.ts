import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/middleware'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updateUserSchema = z.object({
  name: z.string().optional(),
  isVerified: z.boolean().optional(),
  isAdmin: z.boolean().optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    await requireAdmin(request)

    const user = await prisma.user.findUnique({
      where: { id: params.userId },
      include: {
        subscription: true,
        watchlist: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
        priceAlerts: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: {
            watchlist: true,
            priceAlerts: true,
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
  { params }: { params: { userId: string } }
) {
  try {
    await requireAdmin(request)

    const body = await request.json()
    const data = updateUserSchema.parse(body)

    const user = await prisma.user.update({
      where: { id: params.userId },
      data,
      include: {
        subscription: true,
        _count: {
          select: {
            watchlist: true,
            priceAlerts: true,
          },
        },
      },
    })

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isVerified: user.isVerified,
        isAdmin: user.isAdmin,
        createdAt: user.createdAt,
        subscription: user.subscription,
        watchlistCount: user._count.watchlist,
        priceAlertCount: user._count.priceAlerts,
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


