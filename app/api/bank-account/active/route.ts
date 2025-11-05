import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    // Get the active bank account (public endpoint for checkout page)
    const bankAccount = await prisma.bankAccount.findFirst({
      where: {
        isActive: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    if (!bankAccount) {
      // Return default values if no active account found
      return NextResponse.json({
        bankName: process.env.NEXT_PUBLIC_BANK_NAME || 'Banka Adı',
        iban: process.env.NEXT_PUBLIC_IBAN || 'TR00 0000 0000 0000 0000 0000 00',
        accountHolder: process.env.NEXT_PUBLIC_ACCOUNT_HOLDER || 'Oruba Coin',
      })
    }

    return NextResponse.json({
      bankName: bankAccount.bankName,
      iban: bankAccount.iban,
      accountHolder: bankAccount.accountHolder,
    })
  } catch (error) {
    console.error('Bank account GET error:', error)
    // Return default values on error
    return NextResponse.json({
      bankName: process.env.NEXT_PUBLIC_BANK_NAME || 'Banka Adı',
      iban: process.env.NEXT_PUBLIC_IBAN || 'TR00 0000 0000 0000 0000 0000 00',
      accountHolder: process.env.NEXT_PUBLIC_ACCOUNT_HOLDER || 'Oruba Coin',
    })
  }
}

