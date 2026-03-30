import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { prisma } from "@/lib/prisma"
import { sendBulkNotifications } from "@/lib/web-push"

export const runtime = "nodejs"

const subscriptionItemSchema = z.object({
  endpoint: z.string(),
  auth: z.string(),
  p256dh: z.string(),
  email: z.string().nullable().optional(),
})

const requestSchema = z.object({
  symbol: z.string().min(1),
  volumeUsd: z.number().finite().nonnegative(),
  windowMinutes: z.number().int().positive().default(15),
  subscriptions: z.array(subscriptionItemSchema).optional(),
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

  // Use worker-provided subscriptions if available, otherwise fall back to DB
  let formatted: Array<{ endpoint: string; keys: { auth: string; p256dh: string } }>
  let emailByEndpoint: Map<string, string>

  if (params.subscriptions?.length) {
    formatted = params.subscriptions.map((sub) => ({
      endpoint: sub.endpoint,
      keys: { auth: sub.auth, p256dh: sub.p256dh },
    }))
    emailByEndpoint = new Map(
      params.subscriptions
        .filter((sub) => sub.email)
        .map((sub) => [sub.endpoint, sub.email!])
    )
    console.log(`[volume-alert] Using ${formatted.length} worker-cached subscriptions (no DB query)`)
  } else {
    const dbSubs = await prisma.pushSubscription.findMany({
      include: { user: { select: { email: true } } },
    })
    formatted = dbSubs.map((sub) => ({
      endpoint: sub.endpoint,
      keys: { auth: sub.auth, p256dh: sub.p256dh },
    }))
    emailByEndpoint = new Map(
      dbSubs
        .filter((sub) => sub.user?.email)
        .map((sub) => [sub.endpoint, sub.user!.email])
    )
    console.log(`[volume-alert] Fetched ${formatted.length} subscriptions from DB (no cache provided)`)
  }

  if (!formatted.length) {
    return NextResponse.json({ success: false, message: "No subscriptions registered" })
  }

  console.log(`[volume-alert] Broadcasting to ${formatted.length} subscriptions`, {
    symbol: params.symbol,
    volumeUsd: params.volumeUsd,
  })

  const title = "Spot Hacim Uyarısı"
  const body = `${params.symbol.toUpperCase()} 15dk spot hacim: $${formatNumber(params.volumeUsd)}`

  const { failed, errors } = await sendBulkNotifications(formatted, {
    title,
    body,
    url: `/coins/${params.symbol.toUpperCase()}`,
  })

  const successful = formatted.length - failed.length
  
  const failedEndpointSet = new Set(failed.map((f) => f.endpoint))
  const successfulEmails = formatted
    .filter((sub) => !failedEndpointSet.has(sub.endpoint))
    .map((sub) => emailByEndpoint.get(sub.endpoint))
    .filter((email): email is string => !!email)

  const failedEndpointList = failed.map((f) => f.endpoint)

  console.log(`[volume-alert] Push results`, {
    symbol: params.symbol,
    total: formatted.length,
    successful,
    failed: failed.length,
    errors: errors?.length || 0,
    failedEndpoints: failedEndpointList.map((e) => e.substring(0, 50) + "..."),
    successfulEmails,
  })

  // Only clean up DB if subscriptions came from DB (no worker cache)
  if (!params.subscriptions?.length && failed.length) {
    const deleted = await prisma.pushSubscription.deleteMany({
      where: {
        endpoint: { in: failedEndpointList },
      },
    })
    console.log(`[volume-alert] Removed ${deleted.count} invalid subscriptions from DB`)
  }

  return NextResponse.json({
    success: true,
    total: formatted.length,
    successful,
    failed: failed.length,
    failedEndpoints: failedEndpointList,
    successfulEmails,
  })
}

