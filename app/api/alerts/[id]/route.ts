import { NextRequest, NextResponse } from 'next/server'
import { requirePremium } from '@/lib/middleware'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updateAlertSchema = z.object({
  targetPrice: z.number().positive().optional(),
  isActive: z.boolean().optional(),
})

// PUT /api/alerts/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePremium(request)
    const { id } = await params
    const body = await request.json()
    const data = updateAlertSchema.parse(body)

    // Alert'i bul ve kullanıcıya ait olduğunu kontrol et
    const alert = await prisma.priceAlert.findUnique({
      where: { id },
    })

    if (!alert) {
      return NextResponse.json(
        { error: 'Alert bulunamadı' },
        { status: 404 }
      )
    }

    if (alert.userId !== user.id) {
      return NextResponse.json(
        { error: 'Bu alert size ait değil' },
        { status: 403 }
      )
    }

    // Update data
    const updateData: any = {}
    if (data.targetPrice !== undefined) {
      updateData.targetPrice = data.targetPrice
      updateData.triggeredAt = null // Yeni hedef fiyat, trigger'ı sıfırla
    }
    if (data.isActive !== undefined) {
      updateData.isActive = data.isActive
    }

    const updated = await prisma.priceAlert.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({ alert: updated, message: 'Alert güncellendi' })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Geçersiz veri formatı', details: error.errors },
        { status: 400 }
      )
    }
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    if (error instanceof Error && error.message === 'Premium required') {
      return NextResponse.json(
        { error: 'Bu özellik premium üyelik gerektirir' },
        { status: 403 }
      )
    }
    console.error('Update alert error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/alerts/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePremium(request)
    const { id } = await params

    // Alert'i bul ve kullanıcıya ait olduğunu kontrol et
    const alert = await prisma.priceAlert.findUnique({
      where: { id },
    })

    if (!alert) {
      return NextResponse.json(
        { error: 'Alert bulunamadı' },
        { status: 404 }
      )
    }

    if (alert.userId !== user.id) {
      return NextResponse.json(
        { error: 'Bu alert size ait değil' },
        { status: 403 }
      )
    }

    await prisma.priceAlert.delete({
      where: { id },
    })

    return NextResponse.json({ message: 'Alert silindi' })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    if (error instanceof Error && error.message === 'Premium required') {
      return NextResponse.json(
        { error: 'Bu özellik premium üyelik gerektirir' },
        { status: 403 }
      )
    }
    console.error('Delete alert error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

