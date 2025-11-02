'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { TrendingUp, TrendingDown, ArrowUpDown } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface Coin {
  symbol: string
  price: string
  priceChangePercent: string
  volume: string
  quoteVolume: string
}

type SortBy = 'symbol' | 'price' | 'change' | 'volume'
type SortOrder = 'asc' | 'desc'

export default function CoinsPage() {
  const router = useRouter()
  const [coins, setCoins] = useState<Coin[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortBy>('volume')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const wsRef = useRef<WebSocket | null>(null)
  const coinsMapRef = useRef<Map<string, Coin>>(new Map())
  const previousPricesRef = useRef<Map<string, number>>(new Map())
  const [flashAnimations, setFlashAnimations] = useState<Record<string, 'up' | 'down'>>({})

  // Initial fetch - only called once on mount
  const fetchCoins = async () => {
    try {
      // Fetch all coins without filters (we'll filter/sort client-side)
      const res = await fetch(`/api/coins?limit=100`)
      const data = await res.json()
      const coinsData = data.coins || []
      
      // Update map with all coins
      coinsMapRef.current.clear()
      previousPricesRef.current.clear()
      coinsData.forEach((coin: Coin) => {
        coinsMapRef.current.set(coin.symbol, coin)
        previousPricesRef.current.set(coin.symbol, parseFloat(coin.price))
      })
      
      // Initial sort and display
      const sorted = sortCoins(coinsData, sortBy, sortOrder)
      setCoins(sorted)
      setLoading(false)
      
      // Subscribe to WebSocket for these symbols
      if (coinsData.length > 0) {
        subscribeToWebSocket(coinsData.map((c: Coin) => c.symbol))
      }
    } catch (error) {
      console.error('Failed to fetch coins:', error)
      setLoading(false)
    }
  }

  const subscribeToWebSocket = (symbols: string[]) => {
    // Close existing connection
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.close()
      wsRef.current = null
    }

    if (symbols.length === 0) return

    // Binance allows up to 200 streams in a single connection
    // We'll subscribe to top 100 symbols for better coverage
    const limitedSymbols = symbols.slice(0, 100).map((s) => s.toUpperCase())
    const streams = limitedSymbols
      .map((s) => `${s.toLowerCase()}@ticker`)
      .join('/')

    const wsUrl = `wss://stream.binance.com:9443/stream?streams=${streams}`

    try {
      const ws = new WebSocket(wsUrl)

      ws.onopen = () => {
        console.log('WebSocket connected for coins')
      }

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          if (message.stream && message.data) {
            const stream = message.stream
            const data = message.data
            const symbol = stream.split('@')[0].toUpperCase()

            // Update coin data
            const updatedCoin: Coin = {
              symbol,
              price: data.c || data.lastPrice || '0',
              priceChangePercent: data.P || data.priceChangePercent || '0',
              volume: data.v || data.volume || '0',
              quoteVolume: data.q || data.quoteVolume || '0',
            }

            // Only update if this symbol is in our map
            if (coinsMapRef.current.has(symbol)) {
              const previousPrice = previousPricesRef.current.get(symbol)
              const currentPrice = parseFloat(updatedCoin.price)
              
              // Check if price changed and trigger flash animation
              if (previousPrice !== undefined && previousPrice !== 0 && currentPrice !== 0 && currentPrice !== previousPrice) {
                const priceDiff = Math.abs(currentPrice - previousPrice)
                const priceChangePercent = (priceDiff / previousPrice) * 100
                
                // Trigger animation for any price change (even very small ones)
                // But avoid if the change is extremely tiny (less than 0.001% which is noise)
                if (priceChangePercent >= 0.001 || priceDiff >= 0.00000001) {
                  const flashType = currentPrice > previousPrice ? 'up' : 'down'
                  
                  console.log(`💰 ${symbol}: ${previousPrice.toFixed(8)} → ${currentPrice.toFixed(8)} (${flashType}) [${priceChangePercent.toFixed(4)}%]`)
                  
                  // Trigger flash animation immediately
                  setFlashAnimations(prev => {
                    console.log('Flash animation triggered for:', symbol, flashType, 'Previous state:', prev)
                    return {
                      ...prev,
                      [symbol]: flashType
                    }
                  })
                  
                  // Remove flash animation after 1.2 seconds
                  setTimeout(() => {
                    setFlashAnimations(prev => {
                      const { [symbol]: _, ...rest } = prev
                      return rest
                    })
                  }, 1200)
                }
              }
              
              // Update previous price
              previousPricesRef.current.set(symbol, currentPrice)
              coinsMapRef.current.set(symbol, updatedCoin)

              // Update state with sorted and filtered coins
              const updatedCoins = Array.from(coinsMapRef.current.values())
              const sorted = sortCoins(updatedCoins, sortBy, sortOrder)
              const filtered = searchCoins(sorted, search)
              setCoins(filtered)
            }
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error)
        }
      }

      ws.onerror = (error) => {
        console.error('WebSocket error:', error)
      }

      ws.onclose = () => {
        console.log('WebSocket disconnected, reconnecting...')
        // Reconnect after 3 seconds
        setTimeout(() => {
          const currentSymbols = Array.from(coinsMapRef.current.keys())
          if (currentSymbols.length > 0) {
            subscribeToWebSocket(currentSymbols)
          }
        }, 3000)
      }

      wsRef.current = ws
    } catch (error) {
      console.error('Failed to create WebSocket:', error)
    }
  }

  const sortCoins = (coinList: Coin[], by: SortBy, order: SortOrder): Coin[] => {
    const sorted = [...coinList].sort((a, b) => {
      let aVal: number
      let bVal: number

      switch (by) {
        case 'symbol':
          return order === 'asc'
            ? a.symbol.localeCompare(b.symbol)
            : b.symbol.localeCompare(a.symbol)
        case 'price':
          aVal = parseFloat(a.price)
          bVal = parseFloat(b.price)
          break
        case 'change':
          aVal = parseFloat(a.priceChangePercent)
          bVal = parseFloat(b.priceChangePercent)
          break
        case 'volume':
        default:
          aVal = parseFloat(a.quoteVolume)
          bVal = parseFloat(b.quoteVolume)
          break
      }

      return order === 'asc' ? aVal - bVal : bVal - aVal
    })

    return sorted
  }

  const searchCoins = (coinList: Coin[], searchTerm: string): Coin[] => {
    if (!searchTerm) return coinList
    return coinList.filter((coin) =>
      coin.symbol.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }

  // Initial fetch - only once on mount
  useEffect(() => {
    fetchCoins()

    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Client-side filtering and sorting when search/sort changes
  useEffect(() => {
    if (coinsMapRef.current.size === 0) return

    const allCoins = Array.from(coinsMapRef.current.values())
    const sorted = sortCoins(allCoins, sortBy, sortOrder)
    const filtered = searchCoins(sorted, search)
    setCoins(filtered)
  }, [search, sortBy, sortOrder])

  const handleSort = (field: SortBy) => {
    if (sortBy === field) {
      const newOrder = sortOrder === 'asc' ? 'desc' : 'asc'
      setSortOrder(newOrder)
      const sorted = sortCoins(coins, field, newOrder)
      const filtered = searchCoins(sorted, search)
      setCoins(filtered)
    } else {
      setSortBy(field)
      setSortOrder('desc')
      const sorted = sortCoins(coins, field, 'desc')
      const filtered = searchCoins(sorted, search)
      setCoins(filtered)
    }
  }

  const formatPrice = (price: string) => {
    const num = parseFloat(price)
    if (num >= 1) {
      return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    }
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 })
  }

  return (
    <div className="w-full py-16">
      <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-16">
        <h1 className="text-5xl font-bold mb-4 gradient-text">Market Overview</h1>
        <p className="text-muted-foreground text-lg">Real-time cryptocurrency prices from Binance</p>
      </div>

      <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-10">
        <Card className="glass-effect border-white/10">
          <CardHeader>
            <CardTitle className="text-xl">Search & Filter</CardTitle>
            <CardDescription>Find coins and sort by different metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <Input
              placeholder="Search coins (e.g., BTC, ETH, BNB)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm glass-effect border-white/10 focus:border-primary/50"
            />
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <div className="text-center py-20 text-muted-foreground">
          <div className="animate-pulse text-lg">Loading market data...</div>
        </div>
      ) : (
      <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="glass-effect border border-white/10 rounded-xl overflow-hidden bg-card shadow-xl">
          <div className="overflow-x-auto">
            {/* Custom Table - Pixel Perfect */}
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '180px' }} />
                <col style={{ width: 'auto' }} />
                <col style={{ width: '180px' }} />
                <col style={{ width: 'auto' }} />
                <col style={{ width: '150px' }} />
              </colgroup>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', backgroundColor: 'rgba(255, 255, 255, 0.05)' }}>
                  <th style={{ 
                    textAlign: 'left', 
                    padding: '12px 16px', 
                    fontWeight: 600, 
                    color: 'var(--muted-foreground)',
                    width: '180px',
                    minWidth: '180px',
                    maxWidth: '180px'
                  }}>
                    <button
                      onClick={() => handleSort('symbol')}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        width: '100%',
                        textAlign: 'left',
                        background: 'transparent',
                        border: 'none',
                        padding: 0,
                        margin: 0,
                        cursor: 'pointer',
                        color: 'inherit'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.color = 'var(--primary)'}
                      onMouseOut={(e) => e.currentTarget.style.color = 'inherit'}
                    >
                      <span style={{ width: '16px', height: '16px', flexShrink: 0, opacity: 0 }}>
                        <TrendingUp style={{ width: '16px', height: '16px' }} />
                      </span>
                      <span>Symbol</span>
                      <ArrowUpDown style={{ width: '16px', height: '16px', flexShrink: 0, marginLeft: 'auto' }} />
                    </button>
                  </th>
                  <th style={{ 
                    textAlign: 'left', 
                    padding: '12px 16px', 
                    fontWeight: 600, 
                    color: 'var(--muted-foreground)'
                  }}>
                    <button
                      onClick={() => handleSort('price')}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        width: '100%',
                        textAlign: 'left',
                        background: 'transparent',
                        border: 'none',
                        padding: 0,
                        margin: 0,
                        cursor: 'pointer',
                        color: 'inherit'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.color = 'var(--primary)'}
                      onMouseOut={(e) => e.currentTarget.style.color = 'inherit'}
                    >
                      <span>Price</span>
                      <ArrowUpDown style={{ width: '16px', height: '16px', flexShrink: 0, marginLeft: 'auto' }} />
                    </button>
                  </th>
                  <th style={{ 
                    textAlign: 'left', 
                    padding: '12px 16px', 
                    fontWeight: 600, 
                    color: 'var(--muted-foreground)',
                    width: '180px',
                    minWidth: '180px',
                    maxWidth: '180px'
                  }}>
                    <button
                      onClick={() => handleSort('change')}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        width: '100%',
                        textAlign: 'left',
                        background: 'transparent',
                        border: 'none',
                        padding: 0,
                        margin: 0,
                        cursor: 'pointer',
                        color: 'inherit'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.color = 'var(--primary)'}
                      onMouseOut={(e) => e.currentTarget.style.color = 'inherit'}
                    >
                      <span>24h Change</span>
                      <ArrowUpDown style={{ width: '16px', height: '16px', flexShrink: 0, marginLeft: 'auto' }} />
                    </button>
                  </th>
                  <th style={{ 
                    textAlign: 'left', 
                    padding: '12px 16px', 
                    fontWeight: 600, 
                    color: 'var(--muted-foreground)'
                  }}>
                    <button
                      onClick={() => handleSort('volume')}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        width: '100%',
                        textAlign: 'left',
                        background: 'transparent',
                        border: 'none',
                        padding: 0,
                        margin: 0,
                        cursor: 'pointer',
                        color: 'inherit'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.color = 'var(--primary)'}
                      onMouseOut={(e) => e.currentTarget.style.color = 'inherit'}
                    >
                      <span>24h Volume</span>
                      <ArrowUpDown style={{ width: '16px', height: '16px', flexShrink: 0, marginLeft: 'auto' }} />
                    </button>
                  </th>
                  <th style={{ 
                    textAlign: 'left', 
                    padding: '12px 16px', 
                    fontWeight: 600, 
                    color: 'var(--muted-foreground)',
                    width: '150px',
                    minWidth: '150px',
                    maxWidth: '150px'
                  }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {coins.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '64px 16px', color: 'var(--muted-foreground)' }}>
                      No coins found
                    </td>
                  </tr>
                ) : (
                  coins.map((coin) => {
                    const change = parseFloat(coin.priceChangePercent)
                    const isPositive = change >= 0
                    const changePercent = Math.abs(change)
                    const flashType = flashAnimations[coin.symbol]
                    const flashClass = flashType === 'up' 
                      ? 'animate-flash-green' 
                      : flashType === 'down' 
                      ? 'animate-flash-red' 
                      : ''
                    
                    return (
                      <tr 
                        key={coin.symbol}
                        className={`group relative ${flashClass}`}
                        style={{
                          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                          transition: 'all 0.3s',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent'
                        }}
                      >
                        <td style={{ 
                          padding: '12px 16px', 
                          fontWeight: 700, 
                          fontSize: '18px',
                          width: '180px',
                          minWidth: '180px',
                          maxWidth: '180px'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              {isPositive ? (
                                <TrendingUp style={{ width: '16px', height: '16px', color: '#22c55e' }} />
                              ) : (
                                <TrendingDown style={{ width: '16px', height: '16px', color: '#ef4444' }} />
                              )}
                            </span>
                            <span>{coin.symbol}</span>
                          </div>
                        </td>
                        
                        <td style={{ padding: '12px 16px', fontWeight: 500 }}>
                          <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md transition-all duration-300 ${
                            isPositive 
                              ? 'text-green-400 bg-green-500/10 group-hover:bg-green-500/20 group-hover:shadow-lg group-hover:shadow-green-500/30' 
                              : 'text-red-400 bg-red-500/10 group-hover:bg-red-500/20 group-hover:shadow-lg group-hover:shadow-red-500/30'
                          }`}>
                            {isPositive ? (
                              <TrendingUp className="h-3.5 w-3.5 flex-shrink-0" />
                            ) : (
                              <TrendingDown className="h-3.5 w-3.5 flex-shrink-0" />
                            )}
                            <span className="font-semibold">${formatPrice(coin.price)}</span>
                          </div>
                        </td>
                        
                        <td style={{ 
                          padding: '12px 16px',
                          width: '180px',
                          minWidth: '180px',
                          maxWidth: '180px'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Badge
                              variant={isPositive ? 'default' : 'destructive'}
                              className={`${
                                isPositive
                                  ? 'bg-gradient-to-r from-green-500 via-emerald-500 to-green-400 text-white border-0 shadow-lg shadow-green-500/30 hover:shadow-green-500/50 transition-all duration-300'
                                  : 'bg-gradient-to-r from-red-500 via-rose-500 to-red-400 text-white border-0 shadow-lg shadow-red-500/30 hover:shadow-red-500/50 transition-all duration-300'
                              } font-semibold px-3 py-1 flex items-center gap-1.5 group-hover:scale-105`}
                            >
                              {isPositive ? (
                                <TrendingUp className="h-3.5 w-3.5 flex-shrink-0" />
                              ) : (
                                <TrendingDown className="h-3.5 w-3.5 flex-shrink-0" />
                              )}
                              <span>{isPositive ? '+' : '-'}</span>
                              <span>{changePercent.toFixed(2)}%</span>
                            </Badge>
                          </div>
                        </td>
                        
                        <td style={{ 
                          padding: '12px 16px', 
                          color: 'var(--muted-foreground)',
                          fontSize: '14px'
                        }}>
                          ${parseFloat(coin.quoteVolume).toLocaleString('en-US', {
                            maximumFractionDigits: 0,
                          })}
                        </td>
                        
                        <td style={{ 
                          padding: '12px 16px',
                          width: '150px',
                          minWidth: '150px',
                          maxWidth: '150px'
                        }}>
                          <Button
                            variant="outline"
                            size="sm"
                            asChild
                            className="border-primary/30 hover:bg-primary/10 hover:border-primary/50 transition-all duration-200"
                          >
                            <Link href={`/coins/${coin.symbol}`}>View Details</Link>
                          </Button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      )}
    </div>
  )
}

