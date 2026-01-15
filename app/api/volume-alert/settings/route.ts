import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

function extractBearerToken(request: NextRequest) {
  const header =
    request.headers.get("authorization") ?? request.headers.get("Authorization")
  if (!header) return null

  const [type, token] = header.split(" ")
  if (type?.toLowerCase() !== "bearer" || !token) {
    return null
  }

  return token.trim()
}

// GET /api/volume-alert/settings
// Returns volume thresholds for worker (requires WORKER_API_TOKEN)
export async function GET(request: NextRequest) {
  const workerToken = process.env.WORKER_API_TOKEN

  if (!workerToken) {
    return NextResponse.json(
      { error: "WORKER_API_TOKEN is not configured" },
      { status: 500 }
    )
  }

  const token = extractBearerToken(request)
  if (token !== workerToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
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

    return NextResponse.json({
      spotVolumeThreshold: settings.spotVolumeThreshold,
      futuresVolumeThreshold: settings.futuresVolumeThreshold,
    })
  } catch (error) {
    console.error('Error fetching volume alert settings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    )
  }
}
