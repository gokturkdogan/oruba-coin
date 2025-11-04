import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/middleware'
import { z } from 'zod'

const updateAlertSchema = z.object({
  targetPrice: z.number().positive(),
  type: z.enum(['above', 'below']).optional(),
})

// PUT - Update a price alert
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ alertId: string }> }
) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { alertId } = await params
    const body = await request.json()
    const { targetPrice, type } = updateAlertSchema.parse(body)

    // Update alert
    const updateData: any = {
      targetPrice,
      triggeredAt: null,
    }
    if (type) {
      updateData.type = type
    }

    const updated = await prisma.priceAlert.update({
      where: {
        id: alertId,
        userId: user.id, // Ensure user owns this alert
      },
      data: updateData,
    })

    return NextResponse.json({
      message: 'Fiyat alarmı güncellendi',
      alert: updated,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Geçersiz veri formatı', details: error.errors },
        { status: 400 }
      )
    }
    console.error('Price alert PUT error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE - Delete a specific price alert
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ alertId: string }> }
) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { alertId } = await params

    // Deactivate the alert instead of deleting
    await prisma.priceAlert.update({
      where: {
        id: alertId,
        userId: user.id, // Ensure user owns this alert
      },
      data: {
        isActive: false,
      },
    })

    return NextResponse.json({
      message: 'Fiyat alarmı silindi',
    })
  } catch (error) {
    console.error('Price alert DELETE error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

