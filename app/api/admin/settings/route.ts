import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/middleware'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)

    // Get or create settings (singleton pattern)
    let settings = await prisma.settings.findUnique({
      where: { id: 'singleton' },
    })

    if (!settings) {
      // Create default settings if they don't exist
      settings = await prisma.settings.create({
        data: {
          id: 'singleton',
          spotVolumeThreshold: 400000,
          futuresVolumeThreshold: 600000,
        },
      })
    }

    return NextResponse.json({ settings })
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
    console.error('Admin settings GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireAdmin(request)

    const body = await request.json()
    const { spotVolumeThreshold, futuresVolumeThreshold } = body

    // Validate inputs
    if (spotVolumeThreshold !== undefined && (typeof spotVolumeThreshold !== 'number' || spotVolumeThreshold < 0)) {
      return NextResponse.json(
        { error: 'Spot volume threshold must be a positive number' },
        { status: 400 }
      )
    }

    if (futuresVolumeThreshold !== undefined && (typeof futuresVolumeThreshold !== 'number' || futuresVolumeThreshold < 0)) {
      return NextResponse.json(
        { error: 'Futures volume threshold must be a positive number' },
        { status: 400 }
      )
    }

    // Update or create settings
    const settings = await prisma.settings.upsert({
      where: { id: 'singleton' },
      update: {
        ...(spotVolumeThreshold !== undefined && { spotVolumeThreshold }),
        ...(futuresVolumeThreshold !== undefined && { futuresVolumeThreshold }),
      },
      create: {
        id: 'singleton',
        spotVolumeThreshold: spotVolumeThreshold ?? 400000,
        futuresVolumeThreshold: futuresVolumeThreshold ?? 600000,
      },
    })

    return NextResponse.json({ settings })
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
    console.error('Admin settings PUT error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
