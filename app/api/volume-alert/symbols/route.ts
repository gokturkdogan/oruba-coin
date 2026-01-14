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

// GET /api/volume-alert/symbols
// Returns all active spot USDT trading pairs from Binance.
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
    // Fetch all spot tickers from Binance
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)

    const response = await fetch('https://api.binance.com/api/v3/ticker/24hr', {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
      },
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      console.error('Failed to fetch spot tickers:', response.status, response.statusText)
      return NextResponse.json(
        { error: 'Failed to fetch spot symbols', symbols: [] },
        { status: response.status }
      )
    }

    const spotTickers = await response.json()

    // Extract all USDT pairs that have active trading (volume > 0)
    const symbols = Array.from(
      new Set(
        spotTickers
          .filter((ticker: any) => {
            const symbol = ticker.symbol
            return (
              symbol &&
              symbol.endsWith('USDT') &&
              parseFloat(ticker.quoteVolume || '0') > 0
            )
          })
          .map((ticker: any) => ticker.symbol.toUpperCase())
      )
    ).sort()

    return NextResponse.json({ symbols })
  } catch (error) {
    console.error('Error fetching spot symbols:', error)
    return NextResponse.json(
      { error: 'Failed to fetch spot symbols', symbols: [] },
      { status: 500 }
    )
  }
}

