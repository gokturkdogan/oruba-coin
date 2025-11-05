import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/middleware'
import { z } from 'zod'

const createPlanSchema = z.object({
  name: z.string().min(1, 'Plan adı gereklidir'),
  price: z.number().positive('Fiyat pozitif olmalıdır'),
  durationDays: z.number().int().positive('Süre pozitif bir tam sayı olmalıdır'),
  displayOrder: z.number().int().optional().default(0),
})

const updatePlanSchema = z.object({
  name: z.string().min(1, 'Plan adı gereklidir').optional(),
  price: z.number().positive('Fiyat pozitif olmalıdır').optional(),
  durationDays: z.number().int().positive('Süre pozitif bir tam sayı olmalıdır').optional(),
  isActive: z.boolean().optional(),
  displayOrder: z.number().int().optional(),
})

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)

    const searchParams = request.nextUrl.searchParams
    const activeOnly = searchParams.get('activeOnly') === 'true'

    const whereClause: any = {}
    if (activeOnly) {
      whereClause.isActive = true
    }

    const plans = await prisma.plan.findMany({
      where: whereClause,
      orderBy: {
        displayOrder: 'asc',
      },
    })

    return NextResponse.json({ plans })
  } catch (error) {
    if (error instanceof Error && error.message === 'Admin access required') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }
    console.error('Admin plans GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request)

    const body = await request.json()
    const { name, price, durationDays, displayOrder } = createPlanSchema.parse(body)

    // Check if plan name already exists
    const existing = await prisma.plan.findUnique({
      where: { name },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Bu plan adı zaten kayıtlı' },
        { status: 400 }
      )
    }

    const plan = await prisma.plan.create({
      data: {
        name,
        price,
        durationDays,
        displayOrder: displayOrder || 0,
        isActive: true,
      },
    })

    return NextResponse.json({
      message: 'Plan başarıyla oluşturuldu',
      plan,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Admin access required') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Geçersiz veri formatı', details: error.errors },
        { status: 400 }
      )
    }
    console.error('Admin plan POST error:', error)
    return NextResponse.json(
      { error: 'Bir hata oluştu. Lütfen daha sonra tekrar deneyin.' },
      { status: 500 }
    )
  }
}

