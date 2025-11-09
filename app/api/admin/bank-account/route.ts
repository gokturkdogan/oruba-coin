import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/middleware'
import { z } from 'zod'

const createBankAccountSchema = z.object({
  bankName: z.string().min(1, 'Banka adı gereklidir'),
  iban: z.string().min(1, 'IBAN gereklidir'),
  accountHolder: z.string().min(1, 'Hesap sahibi adı gereklidir'),
})

const updateBankAccountSchema = z.object({
  bankName: z.string().min(1, 'Banka adı gereklidir').optional(),
  iban: z.string().min(1, 'IBAN gereklidir').optional(),
  accountHolder: z.string().min(1, 'Hesap sahibi adı gereklidir').optional(),
  isActive: z.boolean().optional(),
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

    const bankAccounts = await prisma.bankAccount.findMany({
      where: whereClause,
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json({ bankAccounts })
  } catch (error) {
    if (error instanceof Error && error.message === 'Admin access required') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }
    console.error('Admin bank account GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request)

    const body = await request.json()
    const { bankName, iban, accountHolder } = createBankAccountSchema.parse(body)

    // Check if IBAN already exists
    const existing = await prisma.bankAccount.findUnique({
      where: { iban },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Bu IBAN zaten kayıtlı' },
        { status: 400 }
      )
    }

    const bankAccount = await prisma.bankAccount.create({
      data: {
        bankName,
        iban,
        accountHolder,
        isActive: true,
      },
    })

    return NextResponse.json({
      message: 'Banka hesabı başarıyla oluşturuldu',
      bankAccount,
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
    console.error('Admin bank account POST error:', error)
    return NextResponse.json(
      { error: 'Bir hata oluştu. Lütfen daha sonra tekrar deneyin.' },
      { status: 500 }
    )
  }
}

