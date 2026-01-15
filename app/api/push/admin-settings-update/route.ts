import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { prisma } from "@/lib/prisma"
import { sendBulkNotifications } from "@/lib/web-push"

export const runtime = "nodejs"

const requestSchema = z.object({
  spotThreshold: z.number().finite().nonnegative(),
  futuresThreshold: z.number().finite().nonnegative(),
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
  return value.toLocaleString("tr-TR", { maximumFractionDigits: 0 })
}

// POST /api/push/admin-settings-update
// Broadcasts a push notification to all users when admin updates volume thresholds
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

  const subscriptions = await prisma.pushSubscription.findMany({
    include: {
      user: {
        select: {
          email: true,
        },
      },
    },
  })
  if (!subscriptions.length) {
    return NextResponse.json({ success: false, message: "No subscriptions registered" })
  }

  console.log(`[admin-settings-update] Broadcasting to ${subscriptions.length} subscriptions`, {
    spotThreshold: params.spotThreshold,
    futuresThreshold: params.futuresThreshold,
  })

  const formatted = subscriptions.map((sub) => ({
    endpoint: sub.endpoint,
    keys: { auth: sub.auth, p256dh: sub.p256dh },
  }))
  
  // Map endpoint to email for tracking
  const endpointToEmail = new Map(
    subscriptions
      .filter((sub) => sub.user?.email)
      .map((sub) => [sub.endpoint, sub.user!.email])
  )

  const title = "Hacim Bildirim Limitleri Güncellendi"
  const body = `Spot: $${formatNumber(params.spotThreshold)} | Vadeli: $${formatNumber(params.futuresThreshold)}`

  const { failed, errors } = await sendBulkNotifications(formatted, {
    title,
    body,
    url: `/admin/settings`,
  })

  const successful = subscriptions.length - failed.length
  
  // Get successful subscription endpoints (not in failed list)
  const failedEndpoints = new Set(failed.map((f) => f.endpoint))
  const successfulSubscriptions = subscriptions.filter(
    (sub) => !failedEndpoints.has(sub.endpoint)
  )
  const successfulEmails = successfulSubscriptions
    .map((sub) => sub.user?.email)
    .filter((email): email is string => !!email)

  console.log(`[admin-settings-update] Push results`, {
    total: subscriptions.length,
    successful,
    failed: failed.length,
    errors: errors?.length || 0,
    successfulEmails,
  })

  if (failed.length) {
    const deleted = await prisma.pushSubscription.deleteMany({
      where: {
        endpoint: {
          in: failed.map((subscription) => subscription.endpoint),
        },
      },
    })
    console.log(`[admin-settings-update] Removed ${deleted.count} invalid subscriptions`)
  }

  return NextResponse.json({
    success: true,
    total: subscriptions.length,
    successful,
    failed: failed.length,
    removed: failed.length,
    successfulEmails,
  })
}
