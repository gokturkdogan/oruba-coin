'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp, TrendingDown, ArrowUpDown } from 'lucide-react'

interface FuturesCoin {
  symbol: string
  price: string
  priceChangePercent: string
  volume: string
  quoteVolume: string
}

type SortBy = 'symbol' | 'price' | 'change' | 'volume'
type SortOrder = 'asc' | 'desc'

export default function FuturesCoinsPage() {
  const router = useRouter()
  const [coins, setCoins] = useState<FuturesCoin[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortBy>('volume')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const wsRef = useRef<WebSocket | null>(null)
  const coinsMapRef = useRef<Map<string, FuturesCoin>>(new Map())
  const previousPricesRef = useRef<Map<string, number>>(new Map())
  const [flashAnimations, setFlashAnimations] = useState<Record<string, 'up' | 'down'>>({})
  const sortByRef = useRef<SortBy>(sortBy)
  const sortOrderRef = useRef<SortOrder>(sortOrder)
  const searchRef = useRef<string>(search)
  const isMountedRef = useRef<boolean>(true)

  // Initial fetch - only called once on mount
  const fetchCoins = async () => {
    try {
      const res = await fetch('/api/coins/futures')
      const data = await res.json()
      const coinsData = data.coins || []
      
      // Update map with all coins
      coinsMapRef.current.clear()
      previousPricesRef.current.clear()
      coinsData.forEach((coin: FuturesCoin) => {
        coinsMapRef.current.set(coin.symbol, coin)
        previousPricesRef.current.set(coin.symbol, parseFloat(coin.price))
      })
      
      // Initial sort and display
      const sorted = sortCoins(coinsData, sortBy, sortOrder)
      setCoins(sorted)
      setLoading(false)
      
      // Subscribe to WebSocket for these symbols
      if (coinsData.length > 0) {
        subscribeToWebSocket(coinsData.map((c: FuturesCoin) => c.symbol))
      }
    } catch (error) {
      console.error('Failed to fetch futures coins:', error)
      setLoading(false)
    }
  }

  const subscribeToWebSocket = (symbols: string[]) => {
    // Close existing connections
    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING) {
        try {
          wsRef.current.onopen = null
          wsRef.current.onerror = null
          wsRef.current.onclose = null
          wsRef.current.onmessage = null
          wsRef.current.close()
        } catch (e) {
          console.error('Error closing Futures WebSocket:', e)
        }
      }
      wsRef.current = null
    }

    if (symbols.length === 0) return

    // Binance allows up to 200 streams in a single connection
    // We'll subscribe to top 200 symbols (Binance limit)
    const limitedSymbols = symbols.slice(0, 200).map((s) => s.toUpperCase())
    const streams = limitedSymbols
      .map((s) => `${s.toLowerCase()}@ticker`)
      .join('/')

    // Futures WebSocket
    const futuresWsUrl = `wss://fstream.binance.com/stream?streams=${streams}`

    // Helper function to update coins and trigger re-render
    const updateCoinsDisplay = () => {
      // Only update if component is still mounted
      if (!isMountedRef.current) return
      const updatedCoins = Array.from(coinsMapRef.current.values())
      const sorted = sortCoins(updatedCoins, sortByRef.current, sortOrderRef.current)
      const filtered = searchCoins(sorted, searchRef.current)
      setCoins(filtered)
    }

    // Futures WebSocket
    try {
      const futuresWs = new WebSocket(futuresWsUrl)
      
      const wsTimeout = setTimeout(() => {
        if (futuresWs.readyState === WebSocket.CONNECTING) {
          console.warn('Futures WebSocket connection timeout, closing...')
          try {
            futuresWs.close()
          } catch (e) {
            console.error('Error closing timed-out Futures WebSocket:', e)
          }
          
          if (isMountedRef.current && wsRef.current === futuresWs) {
            setTimeout(() => {
              const currentSymbols = Array.from(coinsMapRef.current.keys())
              if (isMountedRef.current && currentSymbols.length > 0) {
                subscribeToWebSocket(currentSymbols)
              }
            }, 2000)
          }
        }
      }, 10000)

      futuresWs.onopen = () => {
        clearTimeout(wsTimeout)
        console.log('Futures WebSocket connected')
      }

      futuresWs.onmessage = (event) => {
        // Component unmount edilmişse mesaj işleme
        if (!isMountedRef.current) return
        
        try {
          const message = JSON.parse(event.data)
          if (message.stream && message.data) {
            const stream = message.stream
            const data = message.data
            const symbol = stream.split('@')[0].toUpperCase()

            // Only update if this symbol is in our map and component is mounted
            if (isMountedRef.current && coinsMapRef.current.has(symbol)) {
              const existingCoin = coinsMapRef.current.get(symbol)!
              const previousPrice = previousPricesRef.current.get(symbol)
              const currentPrice = parseFloat(data.c || data.lastPrice || '0')

              // Update coin data
              const updatedCoin: FuturesCoin = {
                symbol,
                price: data.c || data.lastPrice || '0',
                priceChangePercent: data.P || data.priceChangePercent || '0',
                volume: data.v || data.volume || '0',
                quoteVolume: data.q || data.quoteVolume || '0',
              }
              
              // Check if price changed and trigger flash animation
              if (isMountedRef.current && previousPrice !== undefined && previousPrice !== 0 && currentPrice !== 0 && currentPrice !== previousPrice) {
                const priceDiff = Math.abs(currentPrice - previousPrice)
                const priceChangePercent = (priceDiff / previousPrice) * 100
                
                if (priceChangePercent >= 0.001 || priceDiff >= 0.00000001) {
                  const flashType = currentPrice > previousPrice ? 'up' : 'down'
                  
                  if (isMountedRef.current) {
                    setFlashAnimations(prev => ({
                      ...prev,
                      [symbol]: flashType
                    }))
                    
                    setTimeout(() => {
                      if (isMountedRef.current) {
                        setFlashAnimations(prev => {
                          const { [symbol]: _, ...rest } = prev
                          return rest
                        })
                      }
                    }, 1200)
                  }
                }
              }
              
              // Update previous price
              previousPricesRef.current.set(symbol, currentPrice)
              coinsMapRef.current.set(symbol, updatedCoin)
              updateCoinsDisplay()
            }
          }
        } catch (error) {
          console.error('Error parsing Futures WebSocket message:', error)
        }
      }

      futuresWs.onerror = (error) => {
        clearTimeout(wsTimeout)
        console.error('Futures WebSocket error:', error)
      }

      futuresWs.onclose = (event) => {
        clearTimeout(wsTimeout)
        // Component unmount edilmişse yeniden bağlanma
        if (isMountedRef.current && wsRef.current === futuresWs) {
          console.log('Futures WebSocket disconnected, reconnecting...', event.code, event.reason)
          setTimeout(() => {
            const currentSymbols = Array.from(coinsMapRef.current.keys())
            if (isMountedRef.current && currentSymbols.length > 0 && wsRef.current === futuresWs) {
              subscribeToWebSocket(currentSymbols)
            }
          }, 3000)
        }
      }

      wsRef.current = futuresWs
    } catch (error) {
      console.error('Failed to create Futures WebSocket:', error)
    }
  }

  const sortCoins = useCallback((coinList: FuturesCoin[], by: SortBy, order: SortOrder): FuturesCoin[] => {
    const sorted = [...coinList].sort((a, b) => {
      let aVal: number
      let bVal: number

      switch (by) {
        case 'symbol':
          aVal = a.symbol.localeCompare(b.symbol)
          bVal = 0
          break
        case 'price':
          aVal = parseFloat(a.price)
          bVal = parseFloat(b.price)
          break
        case 'change':
          aVal = parseFloat(a.priceChangePercent)
          bVal = parseFloat(b.priceChangePercent)
          break
        case 'volume':
          aVal = parseFloat(a.quoteVolume)
          bVal = parseFloat(b.quoteVolume)
          break
        default:
          return 0
      }

      if (by === 'symbol') {
        return order === 'asc' ? aVal : -aVal
      }

      return order === 'asc' ? aVal - bVal : bVal - aVal
    })

    return sorted
  }, [])

  const searchCoins = useCallback((coinList: FuturesCoin[], searchTerm: string): FuturesCoin[] => {
    if (!searchTerm.trim()) return coinList
    const term = searchTerm.toLowerCase()
    return coinList.filter(
      (coin) =>
        coin.symbol.toLowerCase().includes(term)
    )
  }, [])

  useEffect(() => {
    isMountedRef.current = true
    sortByRef.current = sortBy
    sortOrderRef.current = sortOrder
    searchRef.current = search
    
    // Re-sort and filter when sort/search changes
    const updatedCoins = Array.from(coinsMapRef.current.values())
    const sorted = sortCoins(updatedCoins, sortBy, sortOrder)
    const filtered = searchCoins(sorted, search)
    setCoins(filtered)
  }, [sortBy, sortOrder, search, sortCoins, searchCoins])

  useEffect(() => {
    fetchCoins()
    
    // Cleanup function - WebSocket'leri kapat
    return () => {
      isMountedRef.current = false
      
      // Tüm event handler'ları kaldır ve WebSocket'leri kapat
      if (wsRef.current) {
        try {
          wsRef.current.onmessage = null
          wsRef.current.onerror = null
          wsRef.current.onclose = null
          wsRef.current.onopen = null
          if (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING) {
            wsRef.current.close()
          }
        } catch (error) {
          console.error('Error closing futures WebSocket:', error)
        }
        wsRef.current = null
      }
      
      // Flash animasyon timeout'larını temizle
      const flashTimeouts = Object.values(flashAnimations).map(() => {
        return setTimeout(() => {}, 0)
      })
      flashTimeouts.forEach((timeout) => {
        clearTimeout(timeout)
      })
    }
  }, [])

  const handleSort = (column: SortBy) => {
    const newSortBy = column
    const newSortOrder =
      sortBy === column
        ? (sortOrder === 'asc' ? 'desc' : 'asc')
        : 'desc'
    
    setSortBy(newSortBy)
    setSortOrder(newSortOrder)
  }

  const formatPrice = (price: string) => {
    const num = parseFloat(price)
    if (isNaN(num) || num === 0) return '0,00'
    
    // For numbers >= 1, show 2 decimal places
    if (num >= 1) {
      return num.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    }
    
    // For numbers < 1, check if it starts with multiple zeros
    // Convert to fixed string to avoid scientific notation and check the decimal part
    const numStr = num.toFixed(18)
    
    // Check if the number has leading zeros (e.g., 0.00000123)
    // Find the first non-zero digit after the decimal point
    let leadingZerosCount = 0
    let firstNonZeroIndex = -1
    
    if (numStr.includes('.')) {
      const decimalPart = numStr.split('.')[1]
      for (let i = 0; i < decimalPart.length; i++) {
        if (decimalPart[i] === '0') {
          leadingZerosCount++
        } else {
          firstNonZeroIndex = i
          break
        }
      }
    }
    
    // If there are 2 or more leading zeros (0.00xxxx), show significant digits
    // but limit to avoid precision issues and long decimal strings
    if (leadingZerosCount >= 2) {
      // For very small numbers, show up to firstNonZeroIndex + 3 digits max
      // This prevents displaying things like 0.009379999999999999
      const significantDigitsToShow = 3
      const totalDecimalPlaces = firstNonZeroIndex + significantDigitsToShow
      
      // Round to the calculated decimal places
      const rounded = Math.round(num * Math.pow(10, totalDecimalPlaces)) / Math.pow(10, totalDecimalPlaces)
      
      // Format with calculated precision, then remove trailing zeros
      let formatted = rounded.toFixed(totalDecimalPlaces)
      formatted = formatted.replace(/\.?0+$/, '')
      
      // Ensure we have the decimal point
      if (!formatted.includes('.')) {
        formatted = formatted + '.00'
      } else {
        const parts = formatted.split('.')
        let decimalPart = parts[1] || ''
        
        // Remove trailing zeros
        decimalPart = decimalPart.replace(/0+$/, '')
        
        // If all decimals were zeros, add 00
        if (decimalPart.length === 0) {
          decimalPart = '00'
        }
        
        formatted = `${parts[0]}.${decimalPart}`
      }
      
      // Format integer part with locale
      const parts = formatted.split('.')
      const integerPart = parseFloat(parts[0]).toLocaleString('tr-TR', { useGrouping: true })
      const decimalPart = parts[1] || '00'
      
      // Türkiye formatına çevir: binlik nokta, ondalık virgül
      return `${integerPart},${decimalPart}`
    } else {
      // No significant leading zeros, round to 2 decimal places
      const rounded = Math.round(num * 100) / 100
      return rounded.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    }
  }

  const formatChange = (change: string) => {
    const num = parseFloat(change)
    if (isNaN(num)) return '0,00%'
    const sign = num >= 0 ? '+' : ''
    return `${sign}${num.toFixed(2)}%`
  }

  if (loading) {
    return (
      <div className="w-full py-6">
        <div className="container max-w-[95%] mx-auto px-3">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Vadeli coinler yükleniyor...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full py-16">
      <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-16">
        <h1 className="text-5xl font-bold mb-4 gradient-text">Vadeli Coin Listesi</h1>
        <p className="text-muted-foreground text-lg">Binance Vadeli İşlemler Piyasası - Gerçek Zamanlı Veriler</p>
      </div>

      <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-10">
        <Card className="glass-effect border-white/10">
          <CardHeader>
            <CardTitle className="text-xl">Ara ve Filtrele</CardTitle>
            <CardDescription>Vadeli coinleri bulun ve farklı metriklerle sıralayın</CardDescription>
          </CardHeader>
          <CardContent>
            <Input
              placeholder="Coin ara (örn: BTC, ETH, BNB)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm glass-effect border-white/10 focus:border-primary/50"
            />
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <div className="text-center py-20 text-muted-foreground">
          <div className="animate-pulse text-lg">Vadeli piyasa verileri yükleniyor...</div>
        </div>
      ) : (
      <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="glass-effect border border-white/10 rounded-xl overflow-hidden bg-card shadow-xl">
          <div className="overflow-x-auto">
            {/* Custom Table - Pixel Perfect */}
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'auto', minWidth: '800px' }}>
              <colgroup>
                <col className="md:w-[180px] w-[120px]" />
                <col className="md:w-auto w-[140px]" />
                <col className="md:w-[180px] w-[140px]" />
                <col className="md:w-auto w-[130px]" />
              </colgroup>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', backgroundColor: 'rgba(255, 255, 255, 0.05)' }}>
                  <th className="md:w-[180px] md:min-w-[180px] md:max-w-[180px] w-[120px] min-w-[120px]" style={{ 
                    textAlign: 'left', 
                    padding: '8px 12px',
                    fontWeight: 600, 
                    color: 'var(--muted-foreground)',
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
                      <span>Sembol</span>
                      <ArrowUpDown style={{ width: '16px', height: '16px', flexShrink: 0, marginLeft: 'auto' }} />
                    </button>
                  </th>
                  <th className="md:w-auto w-[140px] min-w-[140px]" style={{ 
                    textAlign: 'left', 
                    padding: '8px 12px',
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
                      <span>Vadeli Fiyat</span>
                      <ArrowUpDown style={{ width: '16px', height: '16px', flexShrink: 0, marginLeft: 'auto' }} />
                    </button>
                  </th>
                  <th className="md:w-[180px] md:min-w-[180px] md:max-w-[180px] w-[140px] min-w-[140px]" style={{ 
                    textAlign: 'left', 
                    padding: '8px 12px',
                    fontWeight: 600, 
                    color: 'var(--muted-foreground)',
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
                      <span>24s Değişim</span>
                      <ArrowUpDown style={{ width: '16px', height: '16px', flexShrink: 0, marginLeft: 'auto' }} />
                    </button>
                  </th>
                  <th className="md:w-auto w-[130px] min-w-[130px]" style={{ 
                    textAlign: 'left', 
                    padding: '8px 12px',
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
                      <span>Vadeli Hacim</span>
                      <ArrowUpDown style={{ width: '16px', height: '16px', flexShrink: 0, marginLeft: 'auto' }} />
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {coins.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: '32px', color: 'var(--muted-foreground)' }}>
                      {search ? 'Arama sonucu bulunamadı' : 'Coin bulunamadı'}
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
                        onClick={() => router.push(`/coins/${coin.symbol}`)}
                      >
                        <td className="md:w-[180px] md:min-w-[180px] md:max-w-[180px] w-[120px] min-w-[120px]" style={{ 
                          padding: '8px 12px',
                          fontWeight: 700, 
                          fontSize: '14px',
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
                        
                        <td className="md:w-auto w-[140px] min-w-[140px]" style={{ padding: '8px 12px', fontWeight: 500, whiteSpace: 'nowrap' }}>
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
                        
                        <td className="md:w-[180px] md:min-w-[180px] md:max-w-[180px] w-[140px] min-w-[140px]" style={{ 
                          padding: '8px 12px',
                          whiteSpace: 'nowrap'
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
                        
                        <td className="md:w-auto w-[130px] min-w-[130px]" style={{ 
                          padding: '8px 12px',
                          color: 'var(--muted-foreground)',
                          fontSize: '12px',
                          whiteSpace: 'nowrap'
                        }}>
                          <span className="md:hidden">${(parseFloat(coin.quoteVolume || '0') / 1000000).toFixed(1)}M</span>
                          <span className="hidden md:inline">${parseFloat(coin.quoteVolume || '0').toLocaleString('tr-TR', {
                            maximumFractionDigits: 0,
                          })}</span>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Info */}
        <div className="mt-6 text-sm text-muted-foreground">
          <p>Toplam {coins.length} vadeli coin listeleniyor</p>
        </div>
      </div>
      )}

      <style jsx global>{`
        @keyframes flash-green {
          0% {
            background-color: rgba(34, 197, 94, 0.2);
          }
          100% {
            background-color: transparent;
          }
        }
        
        @keyframes flash-red {
          0% {
            background-color: rgba(239, 68, 68, 0.2);
          }
          100% {
            background-color: transparent;
          }
        }
        
        .animate-flash-green {
          animation: flash-green 0.8s ease-out;
        }
        
        .animate-flash-red {
          animation: flash-red 0.8s ease-out;
        }
      `}</style>
    </div>
  )
}

