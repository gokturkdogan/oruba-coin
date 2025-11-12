import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { prisma } from "@/lib/prisma"
import { getUserIdFromToken } from "@/lib/auth"

export const runtime = "nodejs"

const subscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
})

const requestSchema = z.object({
  subscription: subscriptionSchema,
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = requestSchema.parse(body)
    const userId = (await getUserIdFromToken(request)) ?? null

    const { subscription } = parsed
    await prisma.pushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      update: {
        auth: subscription.keys.auth,
        p256dh: subscription.keys.p256dh,
        userId,
      },
      create: {
        endpoint: subscription.endpoint,
        auth: subscription.keys.auth,
        p256dh: subscription.keys.p256dh,
        userId,
      },
    })

    return NextResponse.json({ ok: true, userId })
  } catch (error) {
    console.error("[push] Failed to save subscription", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid subscription payload" }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed to save subscription" }, { status: 500 })
  }
}

const deleteSchema = z.object({
  endpoint: z.string().url(),
})

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = deleteSchema.parse(body)

    await prisma.pushSubscription.delete({
      where: { endpoint: parsed.endpoint },
    }).catch((error) => {
      if (error?.code === "P2025") {
        return
      }
      throw error
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 })
    }
    console.error("[push] Failed to delete subscription", error)
    return NextResponse.json({ error: "Failed to delete subscription" }, { status: 500 })
  }
}
