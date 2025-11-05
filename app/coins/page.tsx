'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
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
import { TrendingUp, TrendingDown, ArrowUpDown } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface Coin {
  symbol: string
  price: string
  priceChangePercent: string
  volume: string
  quoteVolume: string
  futuresVolume?: string
  futuresQuoteVolume?: string
}

type SortBy = 'symbol' | 'price' | 'change' | 'volume' | 'futuresVolume'
type SortOrder = 'asc' | 'desc'

export default function CoinsPage() {
  const [coins, setCoins] = useState<Coin[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortBy>('volume')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const wsRef = useRef<WebSocket | null>(null)
  const futuresWsRef = useRef<WebSocket | null>(null)
  const coinsMapRef = useRef<Map<string, Coin>>(new Map())
  const previousPricesRef = useRef<Map<string, number>>(new Map())
  const [flashAnimations, setFlashAnimations] = useState<Record<string, 'up' | 'down'>>({})
  const sortByRef = useRef<SortBy>(sortBy)
  const sortOrderRef = useRef<SortOrder>(sortOrder)
  const searchRef = useRef<string>(search)
  const isMountedRef = useRef<boolean>(true)


  // Initial fetch - only called once on mount
  const fetchCoins = async () => {
    try {
      // Fetch all coins without filters (we'll filter/sort client-side)
      const res = await fetch(`/api/coins`)
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
    // Close existing connections
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.close()
      wsRef.current = null
    }
    if (futuresWsRef.current && futuresWsRef.current.readyState === WebSocket.OPEN) {
      futuresWsRef.current.close()
      futuresWsRef.current = null
    }

    if (symbols.length === 0) return

    // Binance allows up to 200 streams in a single connection
    // We'll subscribe to top 200 symbols (Binance limit)
    const limitedSymbols = symbols.slice(0, 200).map((s) => s.toUpperCase())
    const streams = limitedSymbols
      .map((s) => `${s.toLowerCase()}@ticker`)
      .join('/')

    // Spot WebSocket
    const spotWsUrl = `wss://stream.binance.com:9443/stream?streams=${streams}`
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

    // Spot WebSocket
    try {
      const spotWs = new WebSocket(spotWsUrl)

      spotWs.onopen = () => {
        console.log('Spot WebSocket connected')
      }

      spotWs.onmessage = (event) => {
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

              // Update coin data, preserving futures data
              const updatedCoin: Coin = {
                symbol,
                price: data.c || data.lastPrice || '0',
                priceChangePercent: data.P || data.priceChangePercent || '0',
                volume: data.v || data.volume || '0',
                quoteVolume: data.q || data.quoteVolume || '0',
                futuresVolume: existingCoin.futuresVolume,
                futuresQuoteVolume: existingCoin.futuresQuoteVolume,
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
          console.error('Error parsing Spot WebSocket message:', error)
        }
      }

      spotWs.onerror = (error) => {
        console.error('Spot WebSocket error:', error)
      }

      spotWs.onclose = () => {
        // Component unmount edilmişse yeniden bağlanma
        if (isMountedRef.current && wsRef.current === spotWs) {
          console.log('Spot WebSocket disconnected, reconnecting...')
          setTimeout(() => {
            const currentSymbols = Array.from(coinsMapRef.current.keys())
            if (isMountedRef.current && currentSymbols.length > 0 && wsRef.current === spotWs) {
              subscribeToWebSocket(currentSymbols)
            }
          }, 3000)
        }
      }

      wsRef.current = spotWs
    } catch (error) {
      console.error('Failed to create Spot WebSocket:', error)
    }

    // Futures WebSocket
    try {
      const futuresWs = new WebSocket(futuresWsUrl)

      futuresWs.onopen = () => {
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
              
              // Update coin data, preserving spot data and updating only futures volume
              const updatedCoin: Coin = {
                ...existingCoin,
                futuresVolume: data.v || data.volume || existingCoin.futuresVolume || '0',
                futuresQuoteVolume: data.q || data.quoteVolume || existingCoin.futuresQuoteVolume || '0',
              }
              
              coinsMapRef.current.set(symbol, updatedCoin)
              updateCoinsDisplay()
            }
          }
        } catch (error) {
          console.error('Error parsing Futures WebSocket message:', error)
        }
      }

      futuresWs.onerror = (error) => {
        console.error('Futures WebSocket error:', error)
      }

      futuresWs.onclose = () => {
        // Component unmount edilmişse yeniden bağlanma
        if (isMountedRef.current && futuresWsRef.current === futuresWs) {
          console.log('Futures WebSocket disconnected, reconnecting...')
          setTimeout(() => {
            const currentSymbols = Array.from(coinsMapRef.current.keys())
            if (isMountedRef.current && currentSymbols.length > 0 && futuresWsRef.current === futuresWs) {
              subscribeToWebSocket(currentSymbols)
            }
          }, 3000)
        }
      }

      futuresWsRef.current = futuresWs
    } catch (error) {
      console.error('Failed to create Futures WebSocket:', error)
    }
  }

  const sortCoins = useCallback((coinList: Coin[], by: SortBy, order: SortOrder): Coin[] => {
    const sorted = [...coinList].sort((a, b) => {
      let aVal: number
      let bVal: number

      switch (by) {
        case 'symbol':
          return order === 'asc'
            ? a.symbol.localeCompare(b.symbol)
            : b.symbol.localeCompare(a.symbol)
        case 'price':
          aVal = parseFloat(a.price) || 0
          bVal = parseFloat(b.price) || 0
          break
        case 'change':
          aVal = parseFloat(a.priceChangePercent) || 0
          bVal = parseFloat(b.priceChangePercent) || 0
          break
        case 'volume':
          aVal = parseFloat(a.quoteVolume) || 0
          bVal = parseFloat(b.quoteVolume) || 0
          break
        case 'futuresVolume':
          aVal = parseFloat(a.futuresQuoteVolume || '0') || 0
          bVal = parseFloat(b.futuresQuoteVolume || '0') || 0
          break
        default:
          aVal = parseFloat(a.quoteVolume) || 0
          bVal = parseFloat(b.quoteVolume) || 0
          break
      }

      // Handle NaN cases
      if (isNaN(aVal)) aVal = 0
      if (isNaN(bVal)) bVal = 0

      return order === 'asc' ? aVal - bVal : bVal - aVal
    })

    return sorted
  }, [])

  const searchCoins = useCallback((coinList: Coin[], searchTerm: string): Coin[] => {
    if (!searchTerm) return coinList
    return coinList.filter((coin) =>
      coin.symbol.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [])

  // Initial fetch - only once on mount
  useEffect(() => {
    isMountedRef.current = true
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
          console.error('Error closing spot WebSocket:', error)
        }
        wsRef.current = null
      }
      if (futuresWsRef.current) {
        try {
          futuresWsRef.current.onmessage = null
          futuresWsRef.current.onerror = null
          futuresWsRef.current.onclose = null
          futuresWsRef.current.onopen = null
          if (futuresWsRef.current.readyState === WebSocket.OPEN || futuresWsRef.current.readyState === WebSocket.CONNECTING) {
            futuresWsRef.current.close()
          }
        } catch (error) {
          console.error('Error closing futures WebSocket:', error)
        }
        futuresWsRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Update refs when state changes
  useEffect(() => {
    sortByRef.current = sortBy
    sortOrderRef.current = sortOrder
    searchRef.current = search
  }, [sortBy, sortOrder, search])

  // Client-side filtering and sorting when search/sort changes
  useEffect(() => {
    if (coinsMapRef.current.size === 0) return

    const allCoins = Array.from(coinsMapRef.current.values())
    const sorted = sortCoins(allCoins, sortBy, sortOrder)
    const filtered = searchCoins(sorted, search)
    setCoins(filtered)
  }, [search, sortBy, sortOrder, sortCoins, searchCoins])

  const handleSort = (field: SortBy) => {
    const newSortBy = field
    const newSortOrder = sortBy === field 
      ? (sortOrder === 'asc' ? 'desc' : 'asc')
      : 'desc'
    
    // Update both states in a single batch
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

  return (
    <div className="w-full py-16">
      <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-16">
        <h1 className="text-5xl font-bold mb-4 gradient-text">Piyasa Genel Bakış</h1>
        <p className="text-muted-foreground text-lg">Binance'tan gerçek zamanlı kripto para fiyatları</p>
      </div>

      <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-10">
        <Card className="glass-effect border-white/10">
          <CardHeader>
            <CardTitle className="text-xl">Ara ve Filtrele</CardTitle>
            <CardDescription>Coinleri bulun ve farklı metriklerle sıralayın</CardDescription>
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
          <div className="animate-pulse text-lg">Piyasa verileri yükleniyor...</div>
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
                    <col className="md:w-auto w-[130px]" />
                    <col className="md:w-[150px] w-[120px]" />
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
                      <span>Fiyat</span>
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
                      <span>Spot Hacim</span>
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
                      onClick={() => handleSort('futuresVolume')}
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
                  <th className="md:w-[200px] md:min-w-[200px] md:max-w-[200px] w-[120px] min-w-[120px]" style={{ 
                    textAlign: 'left', 
                    padding: '8px 12px',
                    fontWeight: 600, 
                    color: 'var(--muted-foreground)',
                  }}>
                    <span className="hidden md:inline">İşlemler</span>
                    <span className="md:hidden">İşlem</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {coins.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '64px 16px', color: 'var(--muted-foreground)' }}>
                      Coin bulunamadı
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
                        onClick={(e) => {
                          // Sadece td içindeki link dışındaki tıklamalarda durduralım
                          const target = e.target as HTMLElement
                          if (!target.closest('a') && !target.closest('button')) {
                            e.stopPropagation()
                          }
                        }}
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
                        
                        <td className="md:w-auto w-[130px] min-w-[130px]" style={{ 
                          padding: '8px 12px',
                          color: 'var(--muted-foreground)',
                          fontSize: '12px',
                          whiteSpace: 'nowrap'
                        }}>
                          <span className="md:hidden">${(parseFloat(coin.futuresQuoteVolume || '0') / 1000000).toFixed(1)}M</span>
                          <span className="hidden md:inline">${parseFloat(coin.futuresQuoteVolume || '0').toLocaleString('tr-TR', {
                            maximumFractionDigits: 0,
                          })}</span>
                        </td>
                        
                        <td className="md:w-[200px] md:min-w-[200px] md:max-w-[200px] w-[120px] min-w-[120px]" style={{ 
                          padding: '8px 12px',
                          position: 'relative',
                          zIndex: 10,
                          whiteSpace: 'nowrap'
                        }}>
                          <Link
                              href={`/coins/${coin.symbol}`}
                              onClick={(e) => {
                                e.stopPropagation()
                                // WebSocket'leri temizle
                                if (wsRef.current) {
                                  wsRef.current.close()
                                  wsRef.current = null
                                }
                                if (futuresWsRef.current) {
                                  futuresWsRef.current.close()
                                  futuresWsRef.current = null
                                }
                              }}
                              className="inline-flex items-center justify-center text-center rounded-md md:text-sm text-xs font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-primary/30 bg-background hover:bg-primary/10 hover:border-primary/50 md:h-9 md:px-4 h-8 px-2 py-2 relative z-10 cursor-pointer w-full"
                              style={{ position: 'relative', zIndex: 10 }}
                            >
                              <span className="hidden md:inline">Detay</span>
                              <span className="md:hidden">→</span>
                            </Link>
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

