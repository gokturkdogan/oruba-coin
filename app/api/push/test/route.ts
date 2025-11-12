import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { prisma } from "@/lib/prisma"
import { sendBulkNotifications } from "@/lib/web-push"

export const runtime = "nodejs"

const requestSchema = z.object({
  title: z.string().min(1).max(100).default("Oruba Coin"),
  body: z.string().max(280).optional(),
  url: z.string().url().optional(),
})

export async function POST(request: NextRequest) {
  const triggerToken = process.env.PUSH_TRIGGER_TOKEN
  if (!triggerToken) {
    return NextResponse.json({ error: "PUSH_TRIGGER_TOKEN env missing" }, { status: 500 })
  }

  const headerToken = request.headers.get("x-push-token")
  if (headerToken !== triggerToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const params = requestSchema.parse(body)

    const subscriptions = await prisma.pushSubscription.findMany()
    if (!subscriptions.length) {
      return NextResponse.json({ success: false, message: "No subscriptions registered" })
    }

    const formatted = subscriptions.map((sub) => ({
      endpoint: sub.endpoint,
      keys: {
        auth: sub.auth,
        p256dh: sub.p256dh,
      },
    }))

    const { failed } = await sendBulkNotifications(formatted, {
      title: params.title,
      body: params.body,
      url: params.url,
    })

    if (failed.length) {
      await prisma.pushSubscription.deleteMany({
        where: {
          endpoint: {
            in: failed.map((subscription) => subscription.endpoint),
          },
        },
      })
    }

    return NextResponse.json({ success: true, total: subscriptions.length, removed: failed.length })
  } catch (error) {
    console.error("[push] Failed to trigger notification", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed to trigger notification" }, { status: 500 })
  }
}
