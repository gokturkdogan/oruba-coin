import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendBulkNotifications } from "@/lib/web-push"
import { z } from "zod"

export const runtime = "nodejs"

const ALERT_EVENT_TYPE = "price_alert_triggered"
const PRICE_PRECISION = 6
const CHUNK_SIZE = 100

const requestSchema = z
  .object({
    market: z.enum(["spot", "futures"]).optional(),
    symbols: z.array(z.string().min(1)).optional(),
  })
  .optional()

type Market = "spot" | "futures"

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

function chunkArray<T>(array: T[], size: number): T[][] {
  const result: T[][] = []
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size))
  }
  return result
}

async function fetchPrices(symbols: string[], market: Market): Promise<Record<string, number>> {
  const endpoint =
    market === "spot"
      ? "https://api.binance.com/api/v3/ticker/price"
      : "https://fapi.binance.com/fapi/v1/ticker/price"

  const prices: Record<string, number> = {}

  const batches = chunkArray(symbols, CHUNK_SIZE)

  await Promise.all(
    batches.map(async (batch) => {
      const batchSymbols = batch.map((s) => s.toUpperCase())
      const symbolsParam = encodeURIComponent(JSON.stringify(batchSymbols))

      try {
        let response = await fetch(`${endpoint}?symbols=${symbolsParam}`, {
          cache: "no-store",
        })

        if (!response.ok && batchSymbols.length === 1) {
          response = await fetch(`${endpoint}?symbol=${batchSymbols[0]}`, {
            cache: "no-store",
          })
        }

        if (!response.ok) {
          console.error(`[alerts/check] Failed to fetch prices: ${response.status} ${response.statusText}`)
          return
        }

        const data = await response.json()
        const items = Array.isArray(data) ? data : [data]

        for (const item of items) {
          const symbol = (item.symbol || item.s)?.toUpperCase()
          const priceValue = parseFloat(item.price || item.p || item.lastPrice || "")
          if (symbol && Number.isFinite(priceValue)) {
            prices[symbol] = priceValue
          }
        }
      } catch (error) {
        console.error("[alerts/check] Price fetch error:", error)
      }
    })
  )

  return prices
}

export async function POST(request: NextRequest) {
  const triggerToken = process.env.ALERT_TRIGGER_TOKEN
  if (!triggerToken) {
    return NextResponse.json({ error: "ALERT_TRIGGER_TOKEN is not configured" }, { status: 500 })
  }

  const headerToken = request.headers.get("x-alert-token")
  if (headerToken !== triggerToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let params: z.infer<typeof requestSchema> | undefined
  try {
    const bodyText = await request.text()
    params = bodyText ? requestSchema.parse(JSON.parse(bodyText)) : undefined
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request", details: error.issues }, { status: 400 })
    }
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const where: any = {
    isActive: true,
  }

  if (params?.market) {
    where.market = params.market
  }

  if (params?.symbols?.length) {
    where.symbol = { in: params.symbols.map((s) => s.toUpperCase()) }
  }

  const alerts = await prisma.priceAlert.findMany({
    where,
    orderBy: {
      createdAt: "asc",
    },
  })

  if (!alerts.length) {
    return NextResponse.json({ checked: 0, triggered: 0 })
  }

  const alertsByMarket = alerts.reduce(
    (acc, alert) => {
      acc[alert.market as Market] ??= []
      acc[alert.market as Market]!.push(alert)
      return acc
    },
    {} as Record<Market, typeof alerts>
  )

  const priceCache: Record<Market, Record<string, number>> = {
    spot: {},
    futures: {},
  }

  await Promise.all(
    (Object.keys(alertsByMarket) as Market[]).map(async (market) => {
      const marketAlerts = alertsByMarket[market]
      if (!marketAlerts?.length) return

      const symbols = Array.from(new Set(marketAlerts.map((alert) => alert.symbol.toUpperCase())))
      if (!symbols.length) return

      priceCache[market] = await fetchPrices(symbols, market)
    })
  )

  const triggeredAlerts: Array<{ alert: (typeof alerts)[number]; price: number }> = []

  for (const alert of alerts) {
    const market = alert.market as Market
    const price = priceCache[market]?.[alert.symbol.toUpperCase()]
    if (typeof price !== "number") {
      continue
    }

    if (alert.type === "above" && price >= alert.targetPrice) {
      triggeredAlerts.push({ alert, price })
    }
    if (alert.type === "below" && price <= alert.targetPrice) {
      triggeredAlerts.push({ alert, price })
    }
  }

  if (!triggeredAlerts.length) {
    return NextResponse.json({ checked: alerts.length, triggered: 0 })
  }

  const now = new Date()

  await prisma.$transaction([
    ...triggeredAlerts.map(({ alert }) =>
      prisma.priceAlert.update({
        where: { id: alert.id },
        data: {
          isActive: false,
          triggeredAt: now,
        },
      })
    ),
    prisma.userEvent.createMany({
      data: triggeredAlerts.map(({ alert, price }) => ({
        userId: alert.userId,
        eventType: ALERT_EVENT_TYPE,
        payload: {
          symbol: alert.symbol,
          market: alert.market,
          type: alert.type,
          targetPrice: alert.targetPrice,
          triggeredPrice: price,
          triggeredAt: now.toISOString(),
        },
      })),
    }),
  ])

  const userIds = Array.from(new Set(triggeredAlerts.map(({ alert }) => alert.userId)))
  const subscriptions = await prisma.pushSubscription.findMany({
    where: {
      userId: { in: userIds },
    },
  })

  const subscriptionsByUser = subscriptions.reduce((acc, subscription) => {
    if (!subscription.userId) {
      return acc
    }
    if (!acc.has(subscription.userId)) {
      acc.set(subscription.userId, [])
    }
    acc.get(subscription.userId)!.push(subscription)
    return acc
  }, new Map<string, typeof subscriptions>())

  const endpointsToRemove = new Set<string>()

  for (const { alert, price } of triggeredAlerts) {
    const userSubscriptions = subscriptionsByUser.get(alert.userId)
    if (!userSubscriptions?.length) continue

    const marketLabel = alert.market === "spot" ? "Spot" : "Vadeli"
    const marketBodyLabel = alert.market === "spot" ? "spot" : "vadeli"
    const directionLabel = alert.type === "above" ? "üstüne çıktı" : "altına düştü"

    const { failed } = await sendBulkNotifications(
      userSubscriptions.map((subscription) => ({
        endpoint: subscription.endpoint,
        keys: {
          auth: subscription.auth,
          p256dh: subscription.p256dh,
        },
      })),
      {
        title: `${marketLabel} fiyat alarmı tetiklendi`,
        body: `${alert.symbol} ${marketBodyLabel} piyasası fiyatı ${formatPrice(price)} ${directionLabel}. (Hedef: ${formatPrice(alert.targetPrice)})`,
        url: `/coins/${alert.symbol}`,
      }
    )

    for (const failedSubscription of failed) {
      endpointsToRemove.add(failedSubscription.endpoint)
    }
  }

  if (endpointsToRemove.size > 0) {
    await prisma.pushSubscription.deleteMany({
      where: {
        endpoint: {
          in: Array.from(endpointsToRemove),
        },
      },
    })
  }

  return NextResponse.json({
    checked: alerts.length,
    triggered: triggeredAlerts.length,
    notifiedUsers: Array.from(subscriptionsByUser.keys()).length,
  })
}
