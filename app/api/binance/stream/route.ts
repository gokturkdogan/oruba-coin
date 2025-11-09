import { NextRequest } from 'next/server'
import WebSocket from 'ws'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function createBinanceWsUrl(streams: string, market: 'spot' | 'futures', endpoint?: 'ticker' | 'trade') {
  const baseStreams = streams.trim()
  if (!baseStreams) {
    throw new Error('Streams parameter cannot be empty')
  }

  const normalizedStreams = baseStreams
    .split('/')
    .map((stream) => stream.trim())
    .filter(Boolean)
    .join('/')

  // Binance spot endpoints sometimes require explicit port 9443 for ticker streams
  if (market === 'futures') {
    return `wss://fstream.binance.com/stream?streams=${normalizedStreams}`
  }

  if (endpoint === 'trade') {
    return `wss://stream.binance.com/stream?streams=${normalizedStreams}`
  }

  return `wss://stream.binance.com:9443/stream?streams=${normalizedStreams}`
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const streamsParam = url.searchParams.get('streams')
  const marketParam = url.searchParams.get('market')
  const endpointParam = url.searchParams.get('endpoint')

  if (!streamsParam) {
    return new Response(JSON.stringify({ error: 'streams query parameter is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const market = marketParam === 'futures' ? 'futures' : 'spot'
  const endpoint = endpointParam === 'trade' ? 'trade' : 'ticker'

  let binanceUrl: string
  try {
    binanceUrl = createBinanceWsUrl(streamsParam, market, endpoint)
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error?.message || 'Invalid streams parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let cleanupFn: (() => void) | null = null

  return new Response(
    new ReadableStream({
      start(controller) {
        let isClosed = false

        const send = (data: any) => {
          if (isClosed) return
          controller.enqueue(`data: ${JSON.stringify(data)}\n\n`)
        }

        const sendComment = (comment: string) => {
          if (isClosed) return
          controller.enqueue(`: ${comment}\n\n`)
        }

        const ws = new WebSocket(binanceUrl)

        const keepAlive = setInterval(() => {
          sendComment('keep-alive')
        }, 15000)

        ws.on('open', () => {
          send({ type: 'status', message: 'connected', market, endpoint })
        })

        ws.on('message', (message) => {
          try {
            const parsed = JSON.parse(message.toString())
            send(parsed)
          } catch (error: any) {
            send({ type: 'error', message: error?.message || 'Failed to parse message' })
          }
        })

        ws.on('error', (error) => {
          send({ type: 'error', message: error?.message || 'WebSocket error' })
        })

        ws.on('close', (code, reason) => {
          send({ type: 'status', message: 'binance_connection_closed', code, reason: reason.toString() })
          cleanup()
        })

        const cleanup = () => {
          if (isClosed) return
          isClosed = true
          clearInterval(keepAlive)
          try {
            ws.terminate()
          } catch {
            // ignore
          }
          controller.close()
        }

        cleanupFn = cleanup

        request.signal.addEventListener('abort', () => {
          send({ type: 'status', message: 'client_disconnected' })
          cleanup()
        })
      },
      cancel() {
        if (typeof cleanupFn === 'function') {
          cleanupFn()
        }
      },
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'Transfer-Encoding': 'chunked',
        'X-Accel-Buffering': 'no',
      },
    }
  )
}
