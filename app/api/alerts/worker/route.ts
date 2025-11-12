import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

export const runtime = "nodejs"

const querySchema = z.object({
  market: z.enum(["spot", "futures"]).optional(),
  symbols: z
    .string()
    .transform((value) =>
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    )
    .optional(),
  limit: z
    .string()
    .transform((value) => Number.parseInt(value, 10))
    .refine((value) => Number.isFinite(value) && value > 0, {
      message: "limit must be a positive number",
    })
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

  const { searchParams } = new URL(request.url)
  const parseResult = querySchema.safeParse({
    market: searchParams.get("market") ?? undefined,
    symbols: searchParams.get("symbols") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
  })

  if (!parseResult.success) {
    return NextResponse.json(
      {
        error: "Invalid query parameters",
        details: parseResult.error.flatten(),
      },
      { status: 400 }
    )
  }

  const { market, symbols, limit } = parseResult.data

  const where: Record<string, unknown> = {
    isActive: true,
  }

  if (market) {
    where.market = market
  }

  if (symbols?.length) {
    where.symbol = {
      in: symbols.map((symbol) => symbol.toUpperCase()),
    }
  }

  const alerts = await prisma.priceAlert.findMany({
    where,
    orderBy: {
      createdAt: "asc",
    },
    take: limit ?? undefined,
  })

  return NextResponse.json({ alerts })
}


