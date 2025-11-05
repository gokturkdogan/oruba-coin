import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/middleware'
import { z } from 'zod'

const updateBankAccountSchema = z.object({
  bankName: z.string().min(1, 'Banka adı gereklidir').optional(),
  iban: z.string().min(1, 'IBAN gereklidir').optional(),
  accountHolder: z.string().min(1, 'Hesap sahibi adı gereklidir').optional(),
  isActive: z.boolean().optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin(request)

    const { id } = await params

    const bankAccount = await prisma.bankAccount.findUnique({
      where: { id },
    })

    if (!bankAccount) {
      return NextResponse.json({ error: 'Banka hesabı bulunamadı' }, { status: 404 })
    }

    return NextResponse.json({ bankAccount })
  } catch (error) {
    if (error instanceof Error && error.message === 'Admin access required') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }
    console.error('Admin bank account GET error:', error)
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
    const updateData = updateBankAccountSchema.parse(body)

    const bankAccount = await prisma.bankAccount.findUnique({
      where: { id },
    })

    if (!bankAccount) {
      return NextResponse.json({ error: 'Banka hesabı bulunamadı' }, { status: 404 })
    }

    // If IBAN is being updated, check if new IBAN already exists
    if (updateData.iban && updateData.iban !== bankAccount.iban) {
      const existing = await prisma.bankAccount.findUnique({
        where: { iban: updateData.iban },
      })

      if (existing) {
        return NextResponse.json(
          { error: 'Bu IBAN zaten başka bir hesapta kayıtlı' },
          { status: 400 }
        )
      }
    }

    const updated = await prisma.bankAccount.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({
      message: 'Banka hesabı başarıyla güncellendi',
      bankAccount: updated,
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
    console.error('Admin bank account PUT error:', error)
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

    const bankAccount = await prisma.bankAccount.findUnique({
      where: { id },
    })

    if (!bankAccount) {
      return NextResponse.json({ error: 'Banka hesabı bulunamadı' }, { status: 404 })
    }

    await prisma.bankAccount.delete({
      where: { id },
    })

    return NextResponse.json({ message: 'Banka hesabı başarıyla silindi' })
  } catch (error) {
    if (error instanceof Error && error.message === 'Admin access required') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }
    console.error('Admin bank account DELETE error:', error)
    return NextResponse.json(
      { error: 'Bir hata oluştu. Lütfen daha sonra tekrar deneyin.' },
      { status: 500 }
    )
  }
}

