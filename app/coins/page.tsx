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
import { TrendingUp, TrendingDown, ArrowUpDown, Minus } from 'lucide-react'
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
  const wsRef = useRef<WebSocket[]>([])
  const coinsMapRef = useRef<Map<string, Coin>>(new Map())
  const previousPricesRef = useRef<Map<string, number>>(new Map())
  // Price changes for all periods
  const priceChangesRef = useRef<Map<string, {
    '30min': number | null
    '1h': number | null
    '2h': number | null
    '4h': number | null
  }>>(new Map())
  const [priceChanges, setPriceChanges] = useState<Record<string, {
    '30min': 'up' | 'down' | 'equal' | null
    '1h': 'up' | 'down' | 'equal' | null
    '2h': 'up' | 'down' | 'equal' | null
    '4h': 'up' | 'down' | 'equal' | null
  }>>({})
  const [loadingPriceChanges, setLoadingPriceChanges] = useState(true)
  const [flashAnimations, setFlashAnimations] = useState<Record<string, 'up' | 'down'>>({})
  const [wsConnectedSymbols, setWsConnectedSymbols] = useState<Set<string>>(new Set())
  const sortByRef = useRef<SortBy>(sortBy)
  const sortOrderRef = useRef<SortOrder>(sortOrder)
  const searchRef = useRef<string>(search)
  const isMountedRef = useRef<boolean>(true)


  // Initial fetch - only called once on mount
  const fetchCoins = async () => {
    try {
      // Fetch all coins
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

  // Fetch price changes for all periods (30min, 1h, 2h, 4h)
  // Progressive loading: İlk yüklemede sadece görünen coinler için istek at
  const fetchPriceChanges = async (prioritySymbols?: string[]) => {
    try {
      setLoadingPriceChanges(true)
      
      // İlk yüklemede görünen coinler (ilk 100 veya priority symbols)
      const symbolsToFetch = prioritySymbols || Array.from(coinsMapRef.current.keys()).slice(0, 100)
      const priorityParam = symbolsToFetch.join(',')
      
      const res = await fetch(`/api/coins/price-changes?prioritySymbols=${encodeURIComponent(priorityParam)}`)
      const data = await res.json()
      const priceChangesData = data.priceChanges || {}
      
      // Update price changes for all coins
      coinsMapRef.current.forEach((coin, symbol) => {
        const currentPrice = parseFloat(coin.price)
        const changes = priceChangesData[symbol]
        
        if (changes) {
          // Store historical prices
          priceChangesRef.current.set(symbol, changes)
          
          // Calculate change directions
          const changeDirections: {
            '30min': 'up' | 'down' | 'equal' | null
            '1h': 'up' | 'down' | 'equal' | null
            '2h': 'up' | 'down' | 'equal' | null
            '4h': 'up' | 'down' | 'equal' | null
          } = {
            '30min': null,
            '1h': null,
            '2h': null,
            '4h': null,
          }
          
          // 30min
          if (changes['30min'] && changes['30min'] > 0 && currentPrice > 0) {
            changeDirections['30min'] = currentPrice > changes['30min'] ? 'up' : 
                                        currentPrice < changes['30min'] ? 'down' : 'equal'
          }
          
          // 1h
          if (changes['1h'] && changes['1h'] > 0 && currentPrice > 0) {
            changeDirections['1h'] = currentPrice > changes['1h'] ? 'up' : 
                                     currentPrice < changes['1h'] ? 'down' : 'equal'
          }
          
          // 2h
          if (changes['2h'] && changes['2h'] > 0 && currentPrice > 0) {
            changeDirections['2h'] = currentPrice > changes['2h'] ? 'up' : 
                                     currentPrice < changes['2h'] ? 'down' : 'equal'
          }
          
          // 4h
          if (changes['4h'] && changes['4h'] > 0 && currentPrice > 0) {
            changeDirections['4h'] = currentPrice > changes['4h'] ? 'up' : 
                                     currentPrice < changes['4h'] ? 'down' : 'equal'
          }
          
          setPriceChanges(prev => ({
            ...prev,
            [symbol]: changeDirections
          }))
        }
      })
      
      setLoadingPriceChanges(false)
    } catch (error) {
      console.error('Failed to fetch price changes:', error)
      setLoadingPriceChanges(false)
    }
  }

  const subscribeToWebSocket = (symbols: string[]) => {
    // Close existing connections
    wsRef.current.forEach(ws => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close()
      }
    })
    wsRef.current = []

    if (symbols.length === 0) return

    // Binance allows up to 200 streams in a single connection
    // Coinleri 200'lük gruplara böl ve her grup için ayrı WebSocket bağlantısı aç (maksimum 3)
    const BATCH_SIZE = 200
    const MAX_SOCKETS = 3
    const symbolBatches: string[][] = []
    
    for (let i = 0; i < symbols.length && symbolBatches.length < MAX_SOCKETS; i += BATCH_SIZE) {
      symbolBatches.push(symbols.slice(i, i + BATCH_SIZE))
    }

    // Tüm socket'lere dahil edilen coinleri topla
    const allConnectedSymbols = new Set<string>()
    symbolBatches.forEach(batch => {
      batch.forEach(s => allConnectedSymbols.add(s.toUpperCase()))
    })
    setWsConnectedSymbols(allConnectedSymbols)

    // Helper function to update coins and trigger re-render
    const updateCoinsDisplay = () => {
      // Only update if component is still mounted
      if (!isMountedRef.current) return
      const updatedCoins = Array.from(coinsMapRef.current.values())
      const sorted = sortCoins(updatedCoins, sortByRef.current, sortOrderRef.current)
      const filtered = searchCoins(sorted, searchRef.current)
      setCoins(filtered)
    }

    // Her batch için WebSocket bağlantısı oluştur
    symbolBatches.forEach((batch, batchIndex) => {
      const limitedSymbols = batch.map((s) => s.toUpperCase())
      const streams = limitedSymbols
        .map((s) => `${s.toLowerCase()}@ticker`)
        .join('/')

      // Spot WebSocket
      const spotWsUrl = `wss://stream.binance.com:9443/stream?streams=${streams}`

      try {
        const spotWs = new WebSocket(spotWsUrl)

        spotWs.onopen = () => {
          console.log(`Spot WebSocket connected (socket ${batchIndex + 1}/${symbolBatches.length}, ${limitedSymbols.length} symbols)`)
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

                // Update price changes based on WebSocket price updates
                const historicalPrices = priceChangesRef.current.get(symbol)
                if (historicalPrices && currentPrice > 0) {
                  const changeDirections: {
                    '30min': 'up' | 'down' | 'equal' | null
                    '1h': 'up' | 'down' | 'equal' | null
                    '2h': 'up' | 'down' | 'equal' | null
                    '4h': 'up' | 'down' | 'equal' | null
                  } = {
                    '30min': null,
                    '1h': null,
                    '2h': null,
                    '4h': null,
                  }
                  
                  // 30min
                  if (historicalPrices['30min'] && historicalPrices['30min'] > 0) {
                    changeDirections['30min'] = currentPrice > historicalPrices['30min'] ? 'up' : 
                                                currentPrice < historicalPrices['30min'] ? 'down' : 'equal'
                  }
                  
                  // 1h
                  if (historicalPrices['1h'] && historicalPrices['1h'] > 0) {
                    changeDirections['1h'] = currentPrice > historicalPrices['1h'] ? 'up' : 
                                             currentPrice < historicalPrices['1h'] ? 'down' : 'equal'
                  }
                  
                  // 2h
                  if (historicalPrices['2h'] && historicalPrices['2h'] > 0) {
                    changeDirections['2h'] = currentPrice > historicalPrices['2h'] ? 'up' : 
                                             currentPrice < historicalPrices['2h'] ? 'down' : 'equal'
                  }
                  
                  // 4h
                  if (historicalPrices['4h'] && historicalPrices['4h'] > 0) {
                    changeDirections['4h'] = currentPrice > historicalPrices['4h'] ? 'up' : 
                                             currentPrice < historicalPrices['4h'] ? 'down' : 'equal'
                  }
                  
                  if (isMountedRef.current) {
                    setPriceChanges(prev => ({
                      ...prev,
                      [symbol]: changeDirections
                    }))
                  }
                }

                // Update coin data
                const updatedCoin: Coin = {
                  symbol,
                  price: data.c || data.lastPrice || '0',
                  priceChangePercent: data.P || data.priceChangePercent || '0',
                  volume: data.v || data.volume || '0',
                  quoteVolume: data.q || data.quoteVolume || '0',
                  futuresVolume: existingCoin.futuresVolume || '0',
                  futuresQuoteVolume: existingCoin.futuresQuoteVolume || '0',
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
          console.error(`Spot WebSocket error (socket ${batchIndex + 1}):`, error)
        }

        spotWs.onclose = () => {
          // Component unmount edilmişse yeniden bağlanma
          if (isMountedRef.current && wsRef.current.includes(spotWs)) {
            console.log(`Spot WebSocket disconnected (socket ${batchIndex + 1}), reconnecting...`)
            setTimeout(() => {
              const currentSymbols = Array.from(coinsMapRef.current.keys())
              if (isMountedRef.current && currentSymbols.length > 0 && wsRef.current.includes(spotWs)) {
                subscribeToWebSocket(currentSymbols)
              }
            }, 3000)
          }
        }

        wsRef.current.push(spotWs)
      } catch (error) {
        console.error(`Failed to create Spot WebSocket (socket ${batchIndex + 1}):`, error)
      }
    })
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
    // Price changes'ı ayrı bir istek olarak al (sayfa beklemesin)
    // İlk yüklemede sadece görünen coinler için istek at (hızlı yükleme)
    fetchPriceChanges()
    
    // Arka planda tüm coinler için yükle (progressive loading)
    setTimeout(() => {
      if (isMountedRef.current) {
        const allSymbols = Array.from(coinsMapRef.current.keys())
        fetchPriceChanges(allSymbols)
      }
    }, 2000) // 2 saniye sonra tüm coinler için yükle

    // Cleanup function - WebSocket'leri kapat
    return () => {
      isMountedRef.current = false
      
      // Tüm event handler'ları kaldır ve WebSocket'leri kapat
      wsRef.current.forEach(ws => {
        if (ws) {
          try {
            ws.onmessage = null
            ws.onerror = null
            ws.onclose = null
            ws.onopen = null
            if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
              ws.close()
            }
          } catch (error) {
            console.error('Error closing WebSocket:', error)
          }
        }
      })
      wsRef.current = []
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
                <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'auto', minWidth: '1000px' }}>
                  <colgroup>
                    <col className="md:w-[180px] w-[120px]" />
                    <col className="md:w-[80px] w-[60px]" />
                    <col className="md:w-[80px] w-[60px]" />
                    <col className="md:w-[80px] w-[60px]" />
                    <col className="md:w-[80px] w-[60px]" />
                    <col className="md:w-auto w-[140px]" />
                    <col className="md:w-[180px] w-[140px]" />
                    <col className="md:w-[200px] w-[120px]" />
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
                  <th className="md:w-[80px] md:min-w-[80px] md:max-w-[80px] w-[60px] min-w-[60px]" style={{ 
                    textAlign: 'center', 
                    padding: '8px 12px',
                    fontWeight: 600, 
                    color: 'var(--muted-foreground)',
                  }}>
                    <span>30dk</span>
                  </th>
                  <th className="md:w-[80px] md:min-w-[80px] md:max-w-[80px] w-[60px] min-w-[60px]" style={{ 
                    textAlign: 'center', 
                    padding: '8px 12px',
                    fontWeight: 600, 
                    color: 'var(--muted-foreground)',
                  }}>
                    <span>1s</span>
                  </th>
                  <th className="md:w-[80px] md:min-w-[80px] md:max-w-[80px] w-[60px] min-w-[60px]" style={{ 
                    textAlign: 'center', 
                    padding: '8px 12px',
                    fontWeight: 600, 
                    color: 'var(--muted-foreground)',
                  }}>
                    <span>2s</span>
                  </th>
                  <th className="md:w-[80px] md:min-w-[80px] md:max-w-[80px] w-[60px] min-w-[60px]" style={{ 
                    textAlign: 'center', 
                    padding: '8px 12px',
                    fontWeight: 600, 
                    color: 'var(--muted-foreground)',
                  }}>
                    <span>4s</span>
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
                    <td colSpan={8} style={{ textAlign: 'center', padding: '64px 16px', color: 'var(--muted-foreground)' }}>
                      Coin bulunamadı
                    </td>
                  </tr>
                ) : (
                  coins.map((coin) => {
                    const change = parseFloat(coin.priceChangePercent)
                    const isPositive = change >= 0
                    const changePercent = Math.abs(change)
                    const flashType = flashAnimations[coin.symbol]
                    const flashClass = flashType
                      ? `flash-soft ${flashType === 'up' ? 'flash-soft-up' : 'flash-soft-down'}`
                      : 'flash-soft'
                    const isWsConnected = wsConnectedSymbols.has(coin.symbol.toUpperCase())
                    const coinPriceChanges = priceChanges[coin.symbol] || {
                      '30min': null,
                      '1h': null,
                      '2h': null,
                      '4h': null,
                    }
                    
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
                        
                        {/* 30dk */}
                        <td className="md:w-[80px] md:min-w-[80px] md:max-w-[80px] w-[60px] min-w-[60px]" style={{ 
                          padding: '8px 12px',
                          textAlign: 'center',
                          whiteSpace: 'nowrap'
                        }}>
                          {loadingPriceChanges ? (
                            <div className="flex items-center justify-center">
                              <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent"></div>
                            </div>
                          ) : coinPriceChanges['30min'] === 'up' ? (
                            <div className="flex items-center justify-center">
                              <div className="rounded-full bg-green-500/20 border-2 border-green-400 p-1.5">
                                <TrendingUp className="h-4 w-4 text-green-400" />
                              </div>
                            </div>
                          ) : coinPriceChanges['30min'] === 'down' ? (
                            <div className="flex items-center justify-center">
                              <div className="rounded-full bg-red-500/20 border-2 border-red-500 p-1.5">
                                <TrendingDown className="h-4 w-4" style={{ color: '#ef4444' }} />
                              </div>
                            </div>
                          ) : coinPriceChanges['30min'] === 'equal' ? (
                            <div className="flex items-center justify-center">
                              <div className="rounded-full bg-gray-500/20 border-2 border-gray-400 p-1.5">
                                <Minus className="h-4 w-4 text-gray-400" />
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">-</span>
                          )}
                        </td>
                        
                        {/* 1s */}
                        <td className="md:w-[80px] md:min-w-[80px] md:max-w-[80px] w-[60px] min-w-[60px]" style={{ 
                          padding: '8px 12px',
                          textAlign: 'center',
                          whiteSpace: 'nowrap'
                        }}>
                          {loadingPriceChanges ? (
                            <div className="flex items-center justify-center">
                              <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent"></div>
                            </div>
                          ) : coinPriceChanges['1h'] === 'up' ? (
                            <div className="flex items-center justify-center">
                              <div className="rounded-full bg-green-500/20 border-2 border-green-400 p-1.5">
                                <TrendingUp className="h-4 w-4 text-green-400" />
                              </div>
                            </div>
                          ) : coinPriceChanges['1h'] === 'down' ? (
                            <div className="flex items-center justify-center">
                              <div className="rounded-full bg-red-500/20 border-2 border-red-500 p-1.5">
                                <TrendingDown className="h-4 w-4" style={{ color: '#ef4444' }} />
                              </div>
                            </div>
                          ) : coinPriceChanges['1h'] === 'equal' ? (
                            <div className="flex items-center justify-center">
                              <div className="rounded-full bg-gray-500/20 border-2 border-gray-400 p-1.5">
                                <Minus className="h-4 w-4 text-gray-400" />
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">-</span>
                          )}
                        </td>
                        
                        {/* 2s */}
                        <td className="md:w-[80px] md:min-w-[80px] md:max-w-[80px] w-[60px] min-w-[60px]" style={{ 
                          padding: '8px 12px',
                          textAlign: 'center',
                          whiteSpace: 'nowrap'
                        }}>
                          {loadingPriceChanges ? (
                            <div className="flex items-center justify-center">
                              <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent"></div>
                            </div>
                          ) : coinPriceChanges['2h'] === 'up' ? (
                            <div className="flex items-center justify-center">
                              <div className="rounded-full bg-green-500/20 border-2 border-green-400 p-1.5">
                                <TrendingUp className="h-4 w-4 text-green-400" />
                              </div>
                            </div>
                          ) : coinPriceChanges['2h'] === 'down' ? (
                            <div className="flex items-center justify-center">
                              <div className="rounded-full bg-red-500/20 border-2 border-red-500 p-1.5">
                                <TrendingDown className="h-4 w-4" style={{ color: '#ef4444' }} />
                              </div>
                            </div>
                          ) : coinPriceChanges['2h'] === 'equal' ? (
                            <div className="flex items-center justify-center">
                              <div className="rounded-full bg-gray-500/20 border-2 border-gray-400 p-1.5">
                                <Minus className="h-4 w-4 text-gray-400" />
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">-</span>
                          )}
                        </td>
                        
                        {/* 4s */}
                        <td className="md:w-[80px] md:min-w-[80px] md:max-w-[80px] w-[60px] min-w-[60px]" style={{ 
                          padding: '8px 12px',
                          textAlign: 'center',
                          whiteSpace: 'nowrap'
                        }}>
                          {loadingPriceChanges ? (
                            <div className="flex items-center justify-center">
                              <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent"></div>
                            </div>
                          ) : coinPriceChanges['4h'] === 'up' ? (
                            <div className="flex items-center justify-center">
                              <div className="rounded-full bg-green-500/20 border-2 border-green-400 p-1.5">
                                <TrendingUp className="h-4 w-4 text-green-400" />
                              </div>
                            </div>
                          ) : coinPriceChanges['4h'] === 'down' ? (
                            <div className="flex items-center justify-center">
                              <div className="rounded-full bg-red-500/20 border-2 border-red-500 p-1.5">
                                <TrendingDown className="h-4 w-4" style={{ color: '#ef4444' }} />
                              </div>
                            </div>
                          ) : coinPriceChanges['4h'] === 'equal' ? (
                            <div className="flex items-center justify-center">
                              <div className="rounded-full bg-gray-500/20 border-2 border-gray-400 p-1.5">
                                <Minus className="h-4 w-4 text-gray-400" />
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">-</span>
                          )}
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
                                wsRef.current.forEach(ws => {
                                  if (ws) {
                                    ws.close()
                                  }
                                })
                                wsRef.current = []
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

