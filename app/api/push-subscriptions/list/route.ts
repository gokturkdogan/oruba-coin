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

// GET /api/push-subscriptions/list
// Returns all push subscriptions for the worker to cache in memory.
// Requires WORKER_API_TOKEN.
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
    const rows = await prisma.pushSubscription.findMany({
      include: {
        user: {
          select: {
            email: true,
          },
        },
      },
    })

    const subscriptions = rows.map((sub) => ({
      endpoint: sub.endpoint,
      auth: sub.auth,
      p256dh: sub.p256dh,
      email: sub.user?.email ?? null,
    }))

    return NextResponse.json({ subscriptions })
  } catch (error) {
    console.error("[push-subscriptions/list] Error:", error)
    return NextResponse.json(
      { error: "Failed to fetch subscriptions" },
      { status: 500 }
    )
  }
}
