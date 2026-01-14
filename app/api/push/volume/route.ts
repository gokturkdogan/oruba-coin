import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { prisma } from "@/lib/prisma"
import { sendBulkNotifications } from "@/lib/web-push"

export const runtime = "nodejs"

const requestSchema = z.object({
  symbol: z.string().min(1),
  volumeUsd: z.number().finite().nonnegative(),
  windowMinutes: z.number().int().positive().default(15),
})

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

function formatNumber(value: number) {
  return value.toLocaleString("en-US", { maximumFractionDigits: 0 })
}

// POST /api/push/volume
// Broadcasts a push notification to all registered subscriptions when 15m volume threshold is crossed.
export async function POST(request: NextRequest) {
  const triggerToken = process.env.ALERT_TRIGGER_TOKEN
  if (!triggerToken) {
    return NextResponse.json(
      { error: "ALERT_TRIGGER_TOKEN is not configured" },
      { status: 500 }
    )
  }

  const token = extractBearerToken(request)
  if (token !== triggerToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let params: z.infer<typeof requestSchema>
  try {
    params = requestSchema.parse(await request.json())
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid payload", details: error.flatten() },
        { status: 400 }
      )
    }
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const subscriptions = await prisma.pushSubscription.findMany()
  if (!subscriptions.length) {
    return NextResponse.json({ success: false, message: "No subscriptions registered" })
  }

  console.log(`[volume-alert] Broadcasting to ${subscriptions.length} subscriptions`, {
    symbol: params.symbol,
    volumeUsd: params.volumeUsd,
  })

  const formatted = subscriptions.map((sub) => ({
    endpoint: sub.endpoint,
    keys: { auth: sub.auth, p256dh: sub.p256dh },
  }))

  const title = "Spot Volume Alert"
  const body = `${params.symbol.toUpperCase()} 15m spot volume: $${formatNumber(params.volumeUsd)}`

  const { failed, errors } = await sendBulkNotifications(formatted, {
    title,
    body,
    url: `/coins/${params.symbol.toUpperCase()}`,
  })

  const successful = subscriptions.length - failed.length

  console.log(`[volume-alert] Push results`, {
    symbol: params.symbol,
    total: subscriptions.length,
    successful,
    failed: failed.length,
    errors: errors?.length || 0,
    failedEndpoints: failed.map((f) => f.endpoint.substring(0, 50) + "..."),
  })

  if (failed.length) {
    const deleted = await prisma.pushSubscription.deleteMany({
      where: {
        endpoint: {
          in: failed.map((subscription) => subscription.endpoint),
        },
      },
    })
    console.log(`[volume-alert] Removed ${deleted.count} invalid subscriptions`)
  }

  return NextResponse.json({
    success: true,
    total: subscriptions.length,
    successful,
    failed: failed.length,
    removed: failed.length,
  })
}

