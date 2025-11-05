import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    // Get active plans (public endpoint for checkout page)
    const plans = await prisma.plan.findMany({
      where: {
        isActive: true,
      },
      orderBy: {
        displayOrder: 'asc',
      },
    })

    return NextResponse.json({ plans })
  } catch (error) {
    console.error('Plans GET error:', error)
    return NextResponse.json({ plans: [] })
  }
}

