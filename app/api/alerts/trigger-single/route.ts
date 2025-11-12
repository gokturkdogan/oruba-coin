import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendBulkNotifications } from "@/lib/web-push"
import { z } from "zod"

export const runtime = "nodejs"

const ALERT_EVENT_TYPE = "price_alert_triggered"
const PRICE_PRECISION = 6

const requestSchema = z.object({
  alertId: z.string().min(1),
  symbol: z.string().min(1).optional(),
  price: z.number(),
  triggeredAt: z.string().optional(),
  alert: z
    .object({
      symbol: z.string().optional(),
      market: z.string().optional(),
      type: z.string().optional(),
      targetPrice: z.number().optional(),
    })
    .passthrough()
    .optional(),
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

function formatPrice(value: number): string {
  if (!Number.isFinite(value)) return value.toString()
  if (Math.abs(value) >= 1) {
    return value.toLocaleString("tr-TR", {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    })
  }
  return value.toLocaleString("tr-TR", {
    maximumFractionDigits: PRICE_PRECISION,
    minimumFractionDigits: 2,
  })
}

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

  let body: z.infer<typeof requestSchema>

  try {
    body = requestSchema.parse(await request.json())
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid payload", details: error.flatten() },
        { status: 400 }
      )
    }

    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const alertRecord = await prisma.priceAlert.findUnique({
    where: { id: body.alertId },
  })

  if (!alertRecord) {
    return NextResponse.json(
      { error: `Alert ${body.alertId} not found` },
      { status: 404 }
    )
  }

  const triggeredAt = body.triggeredAt
    ? new Date(body.triggeredAt)
    : new Date()

  if (Number.isNaN(triggeredAt.getTime())) {
    return NextResponse.json(
      { error: "Invalid triggeredAt value" },
      { status: 400 }
    )
  }

  if (!alertRecord.isActive) {
    return NextResponse.json(
      {
        message: "Alert already inactive",
        alertId: alertRecord.id,
      },
      { status: 200 }
    )
  }

  const price = body.price
  if (!Number.isFinite(price)) {
    return NextResponse.json({ error: "Invalid price value" }, { status: 400 })
  }

  const updatedAlert = await prisma.priceAlert.update({
    where: { id: alertRecord.id },
    data: {
      isActive: false,
      triggeredAt,
    },
  })

  await prisma.userEvent.create({
    data: {
      userId: alertRecord.userId,
      eventType: ALERT_EVENT_TYPE,
      payload: {
        symbol: updatedAlert.symbol,
        market: updatedAlert.market,
        type: updatedAlert.type,
        targetPrice: updatedAlert.targetPrice,
        triggeredPrice: price,
        triggeredAt: triggeredAt.toISOString(),
      },
    },
  })

  const subscriptions = await prisma.pushSubscription.findMany({
    where: {
      userId: alertRecord.userId,
    },
  })

  if (subscriptions.length > 0) {
    const marketLabel = updatedAlert.market === "spot" ? "spot" : "vadeli"
    const directionLabel =
      updatedAlert.type === "above" ? "üstüne çıktı" : "altına düştü"

    try {
      const { failed } = await sendBulkNotifications(
        subscriptions.map((subscription) => ({
          endpoint: subscription.endpoint,
          keys: {
            auth: subscription.auth,
            p256dh: subscription.p256dh,
          },
        })),
        {
          title: "Fiyat alarmı tetiklendi",
          body: `${updatedAlert.symbol} ${marketLabel} fiyatı ${formatPrice(price)} ${directionLabel}. (Hedef: ${formatPrice(
            updatedAlert.targetPrice
          )})`,
          url: `/coins/${updatedAlert.symbol}`,
        }
      )

      if (failed.length > 0) {
        await prisma.pushSubscription.deleteMany({
          where: {
            endpoint: {
              in: failed.map((subscription) => subscription.endpoint),
            },
          },
        })
      }
    } catch (error) {
      console.error("[alerts/trigger-single] Failed to send notifications", error)
    }
  }

  return NextResponse.json({
    success: true,
    alertId: updatedAlert.id,
    triggeredAt: triggeredAt.toISOString(),
  })
}


