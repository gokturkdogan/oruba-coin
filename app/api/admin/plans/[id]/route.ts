import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/middleware'
import { z } from 'zod'

const updatePlanSchema = z.object({
  name: z.string().min(1, 'Plan adı gereklidir').optional(),
  price: z.number().positive('Fiyat pozitif olmalıdır').optional(),
  durationDays: z.number().int().positive('Süre pozitif bir tam sayı olmalıdır').optional(),
  isActive: z.boolean().optional(),
  displayOrder: z.number().int().optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin(request)

    const { id } = await params

    const plan = await prisma.plan.findUnique({
      where: { id },
    })

    if (!plan) {
      return NextResponse.json({ error: 'Plan bulunamadı' }, { status: 404 })
    }

    return NextResponse.json({ plan })
  } catch (error) {
    if (error instanceof Error && error.message === 'Admin access required') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }
    console.error('Admin plan GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin(request)

    const { id } = await params
    const body = await request.json()
    const updateData = updatePlanSchema.parse(body)

    const plan = await prisma.plan.findUnique({
      where: { id },
    })

    if (!plan) {
      return NextResponse.json({ error: 'Plan bulunamadı' }, { status: 404 })
    }

    // If name is being updated, check if new name already exists
    if (updateData.name && updateData.name !== plan.name) {
      const existing = await prisma.plan.findUnique({
        where: { name: updateData.name },
      })

      if (existing) {
        return NextResponse.json(
          { error: 'Bu plan adı zaten başka bir planda kullanılıyor' },
          { status: 400 }
        )
      }
    }

    const updated = await prisma.plan.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({
      message: 'Plan başarıyla güncellendi',
      plan: updated,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Admin access required') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Geçersiz veri formatı', details: error.issues },
        { status: 400 }
      )
    }
    console.error('Admin plan PUT error:', error)
    return NextResponse.json(
      { error: 'Bir hata oluştu. Lütfen daha sonra tekrar deneyin.' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin(request)

    const { id } = await params

    const plan = await prisma.plan.findUnique({
      where: { id },
    })

    if (!plan) {
      return NextResponse.json({ error: 'Plan bulunamadı' }, { status: 404 })
    }

    await prisma.plan.delete({
      where: { id },
    })

    return NextResponse.json({ message: 'Plan başarıyla silindi' })
  } catch (error) {
    if (error instanceof Error && error.message === 'Admin access required') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }
    console.error('Admin plan DELETE error:', error)
    return NextResponse.json(
      { error: 'Bir hata oluştu. Lütfen daha sonra tekrar deneyin.' },
      { status: 500 }
    )
  }
}

