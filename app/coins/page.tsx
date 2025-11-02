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

  // Initial fetch
  const fetchCoins = async () => {
    try {
      const params = new URLSearchParams({
        search,
        sortBy,
        sortOrder,
        limit: '100',
      })
      const res = await fetch(`/api/coins?${params}`)
      const data = await res.json()
      const coinsData = data.coins || []
      
      // Update map
      coinsMapRef.current.clear()
      coinsData.forEach((coin: Coin) => {
        coinsMapRef.current.set(coin.symbol, coin)
      })
      
      setCoins(coinsData)
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
    if (wsRef.current) {
      wsRef.current.close()
    }

    // Limit to top 50 symbols for WebSocket (Binance limit)
    const limitedSymbols = symbols.slice(0, 50)
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

            coinsMapRef.current.set(symbol, updatedCoin)

            // Update state with sorted coins
            const updatedCoins = Array.from(coinsMapRef.current.values())
            const sorted = sortCoins(updatedCoins, sortBy, sortOrder)
            const filtered = searchCoins(sorted, search)
            setCoins(filtered)
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
          if (coins.length > 0) {
            subscribeToWebSocket(coins.map((c) => c.symbol))
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

  useEffect(() => {
    fetchCoins()

    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
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
    <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-12">
        <h1 className="text-5xl font-bold mb-4 gradient-text">Market Overview</h1>
        <p className="text-muted-foreground text-lg">Real-time cryptocurrency prices from Binance</p>
      </div>

      <Card className="mb-8 glass-effect border-white/10">
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

      {loading ? (
        <div className="text-center py-20 text-muted-foreground">
          <div className="animate-pulse text-lg">Loading market data...</div>
        </div>
      ) : (
        <Card className="glass-effect border-white/10 overflow-hidden">
          <div className="overflow-x-auto -mx-1 px-1">
            <Table className="w-full">
              <TableHeader>
                <TableRow className="border-white/10 hover:bg-white/5 bg-white/5">
                  <TableHead className="text-muted-foreground font-semibold whitespace-nowrap text-left align-middle" style={{ width: '150px', minWidth: '150px', verticalAlign: 'middle' }}>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSort('symbol')}
                      className="flex items-center gap-2 hover:text-primary transition-colors h-auto py-1 -ml-2"
                    >
                      <span>Symbol</span>
                      <ArrowUpDown className="h-4 w-4 flex-shrink-0" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-muted-foreground font-semibold whitespace-nowrap text-left align-middle" style={{ verticalAlign: 'middle' }}>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSort('price')}
                      className="flex items-center gap-2 hover:text-primary h-auto py-1 -ml-2"
                    >
                      <span>Price</span>
                      <ArrowUpDown className="h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-muted-foreground font-semibold whitespace-nowrap text-left align-middle" style={{ verticalAlign: 'middle' }}>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSort('change')}
                      className="flex items-center gap-2 hover:text-primary h-auto py-1 -ml-2"
                    >
                      <span>24h Change</span>
                      <ArrowUpDown className="h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-muted-foreground font-semibold whitespace-nowrap text-left align-middle" style={{ verticalAlign: 'middle' }}>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSort('volume')}
                      className="flex items-center gap-2 hover:text-primary h-auto py-1 -ml-2"
                    >
                      <span>24h Volume</span>
                      <ArrowUpDown className="h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-muted-foreground font-semibold whitespace-nowrap text-left align-middle" style={{ verticalAlign: 'middle' }}>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {coins.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-16 text-muted-foreground">
                      No coins found
                    </TableCell>
                  </TableRow>
                ) : (
                  coins.map((coin) => {
                    const change = parseFloat(coin.priceChangePercent)
                    const isPositive = change >= 0
                    const changePercent = Math.abs(change)
                    return (
                      <TableRow 
                        key={coin.symbol} 
                        className={`border-white/10 hover:bg-white/5 transition-all duration-300 group relative ${
                          isPositive 
                            ? 'hover:shadow-lg hover:shadow-green-500/10 before:content-[""] before:absolute before:inset-0 before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-300 before:bg-gradient-to-r before:from-green-500/5 before:via-transparent before:to-transparent before:pointer-events-none' 
                            : 'hover:shadow-lg hover:shadow-red-500/10 before:content-[""] before:absolute before:inset-0 before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-300 before:bg-gradient-to-r before:from-red-500/5 before:via-transparent before:to-transparent before:pointer-events-none'
                        }`}
                      >
                        <TableCell className="font-bold text-lg relative z-10 whitespace-nowrap text-left align-middle" style={{ width: '150px', minWidth: '150px', verticalAlign: 'middle' }}>
                          <div className="flex items-center gap-2">
                            <span className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                              {isPositive ? (
                                <TrendingUp className="h-4 w-4 text-green-400" />
                              ) : (
                                <TrendingDown className="h-4 w-4 text-red-400" />
                              )}
                            </span>
                            <span>{coin.symbol}</span>
                          </div>
                        </TableCell>
                        
                        <TableCell className="font-medium relative z-10 whitespace-nowrap text-left align-middle" style={{ verticalAlign: 'middle' }}>
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
                        </TableCell>
                        
                        <TableCell className="relative z-10 whitespace-nowrap text-left align-middle" style={{ verticalAlign: 'middle' }}>
                          <div className="flex items-center gap-2">
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
                        </TableCell>
                        
                        <TableCell className="text-muted-foreground relative z-10 whitespace-nowrap text-left align-middle" style={{ verticalAlign: 'middle' }}>
                          <span className="text-sm">
                            ${parseFloat(coin.quoteVolume).toLocaleString('en-US', {
                              maximumFractionDigits: 0,
                            })}
                          </span>
                        </TableCell>
                        
                        <TableCell className="relative z-10 whitespace-nowrap text-left align-middle" style={{ verticalAlign: 'middle' }}>
                          <Button
                            variant="outline"
                            size="sm"
                            asChild
                            className="border-primary/30 hover:bg-primary/10 hover:border-primary/50 transition-all duration-200"
                          >
                            <Link href={`/coins/${coin.symbol}`}>View Details</Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  )
}

