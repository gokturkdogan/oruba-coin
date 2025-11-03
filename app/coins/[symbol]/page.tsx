'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  BarChart, 
  Bar,
  AreaChart,
  Area,
  ComposedChart
} from 'recharts'
import { TrendingUp, TrendingDown, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { formatNumberTR } from '@/lib/utils'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'

interface CoinData {
  symbol: string
  price: string
  priceChangePercent: string
  volume: string
  quoteVolume: string
  futuresVolume?: string
  futuresQuoteVolume?: string
  highPrice: string
  lowPrice: string
  openPrice: string
  prevClosePrice: string
  tradeCount?: number
  highestBuyPrice?: string
  highestSellPrice?: string
  klines: Array<{
    time: number
    open: number
    high: number
    low: number
    close: number
    volume: number
  }>
  futuresKlines?: Array<{
    time: number
    open: number
    high: number
    low: number
    close: number
    volume: number
  }>
  premium?: {
    dailyChart: Array<{
      time: number
      open: number
      high: number
      low: number
      close: number
      volume: number
    }>
  }
}

interface Trade {
  id: number
  price: number
  quantity: number
  quoteAmount: number // price * quantity
  time: number
  isBuy: boolean
}

export default function CoinDetailPage() {
  const params = useParams()
  const symbolParam = params?.symbol as string
  const symbol = symbolParam?.toUpperCase()
  const [coinData, setCoinData] = useState<CoinData | null>(null)
  const [loading, setLoading] = useState(true)
  const [isPremium, setIsPremium] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const futuresWsRef = useRef<WebSocket | null>(null)
  const tradesWsRef = useRef<WebSocket | null>(null)
  const coinDataRef = useRef<CoinData | null>(null)
  const timeRangeRef = useRef<'1D' | '7D' | '30D' | '90D' | '1Y'>('1D')
  const previousValuesRef = useRef<{
    price?: number
    spotVolume?: number
    futuresVolume?: number
    highPrice?: number
    lowPrice?: number
  }>({})
  const [flashAnimations, setFlashAnimations] = useState<Record<string, 'up' | 'down'>>({})
  const [buyTrades, setBuyTrades] = useState<Trade[]>([])
  const [sellTrades, setSellTrades] = useState<Trade[]>([])
  const [timeRange, setTimeRange] = useState<'1D' | '7D' | '30D' | '90D' | '1Y'>('1D')
  const [chartLoading, setChartLoading] = useState(false)
  const [chartKlines, setChartKlines] = useState<CoinData['klines']>([])
  const [chartFuturesKlines, setChartFuturesKlines] = useState<CoinData['futuresKlines']>([])
  const [showPrice, setShowPrice] = useState(true)
  const [showSpotVolume, setShowSpotVolume] = useState(true)
  const [showFuturesVolume, setShowFuturesVolume] = useState(true)

  // Keep ref in sync with state
  useEffect(() => {
    coinDataRef.current = coinData
    // Store initial values
    if (coinData) {
      previousValuesRef.current = {
        price: parseFloat(coinData.price || '0'),
        spotVolume: parseFloat(coinData.quoteVolume || '0'),
        futuresVolume: parseFloat(coinData.futuresQuoteVolume || '0'),
        highPrice: parseFloat(coinData.highPrice || '0'),
        lowPrice: parseFloat(coinData.lowPrice || '0'),
      }
    }
  }, [coinData])

  // Keep timeRangeRef in sync with state
  useEffect(() => {
    timeRangeRef.current = timeRange
  }, [timeRange])

  // Initialize or reset chartKlines when timeRange is 1D
  useEffect(() => {
    if (timeRange === '1D' && coinData && coinData.klines) {
      // When switching back to 1D, use the current coinData.klines (which is updated by WebSocket)
      setChartKlines(coinData.klines)
      // For 1D, futures klines are not available in real-time, so we'll use initial data if available
      if (coinData.futuresKlines) {
        setChartFuturesKlines(coinData.futuresKlines)
      }
    }
  }, [timeRange, coinData])

  // Fetch chart data only when timeRange changes and it's NOT 1D
  useEffect(() => {
    if (!symbol || !coinData || timeRange === '1D') {
      // For 1D, we use WebSocket data from coinData.klines, no API call needed
      return
    }

    const fetchChartData = async () => {
      setChartLoading(true)
      try {
        const res = await fetch(`/api/coins/${symbol}?range=${timeRange}`)
        if (res.ok) {
          const data = await res.json()
          setChartKlines(data.klines || [])
          setChartFuturesKlines(data.futuresKlines || [])
        }
      } catch (error) {
        console.error('Failed to fetch chart data:', error)
      } finally {
        setChartLoading(false)
      }
    }

    fetchChartData()
  }, [timeRange, symbol]) // Removed coinData from dependencies to prevent constant refetching

  useEffect(() => {
    console.log('CoinDetailPage mounted with symbol:', symbol)
    
    if (!symbol) {
      console.log('No symbol provided')
      setLoading(false)
      return
    }

    // Check premium status
    fetch('/api/user/profile')
      .then((res) => res.json())
      .then((data) => {
        setIsPremium(data.user?.isPremium || false)
      })
      .catch(() => {})

    // Initial fetch - get klines and initial data
    const fetchInitialData = async () => {
      try {
        console.log('Starting initial fetch for symbol:', symbol)
        setLoading(true)
        const res = await fetch(`/api/coins/${symbol}`)
        console.log('Fetch response status:', res.status, res.ok)
        
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}))
          console.error('API error:', res.status, errorData)
          setCoinData(null)
          setError(errorData.error || 'Failed to load coin data')
          setLoading(false)
          return
        }
        
        const data = await res.json()
        console.log('Initial API response received:', data)
        
        // Validate that we have required data
        if (data && data.symbol) {
          // Ensure klines exists (can be empty array)
          if (!data.klines) {
            data.klines = []
          }
          if (!data.futuresKlines) {
            data.futuresKlines = []
          }
          console.log('Setting initial coin data...')
          setCoinData(data)
          setChartKlines(data.klines || [])
          setChartFuturesKlines(data.futuresKlines || [])
          setError(null)
          setLoading(false)
          
          // After initial data is loaded, connect WebSocket
          connectWebSocket(symbol)
        } else {
          console.error('Invalid coin data received:', data)
          setCoinData(null)
          setError('Invalid coin data received')
          setLoading(false)
        }
      } catch (error) {
        console.error('Failed to fetch coin data:', error)
        setCoinData(null)
        setError('Failed to fetch coin data')
        setLoading(false)
      }
    }

    const connectWebSocket = (coinSymbol: string) => {
      // Close existing connections
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close()
        wsRef.current = null
      }
      if (futuresWsRef.current && futuresWsRef.current.readyState === WebSocket.OPEN) {
        futuresWsRef.current.close()
        futuresWsRef.current = null
      }
      if (tradesWsRef.current && tradesWsRef.current.readyState === WebSocket.OPEN) {
        tradesWsRef.current.close()
        tradesWsRef.current = null
      }

      // Spot WebSocket
      const spotStream = `${coinSymbol.toLowerCase()}@ticker`
      const spotWsUrl = `wss://stream.binance.com:9443/ws/${spotStream}`

      // Futures WebSocket
      const futuresStream = `${coinSymbol.toLowerCase()}@ticker`
      const futuresWsUrl = `wss://fstream.binance.com/ws/${futuresStream}`

      // Trades WebSocket
      const tradesStream = `${coinSymbol.toLowerCase()}@trade`
      const tradesWsUrl = `wss://stream.binance.com:9443/ws/${tradesStream}`

      // Spot WebSocket
      try {
        const spotWs = new WebSocket(spotWsUrl)

        spotWs.onopen = () => {
          console.log('Spot WebSocket connected for', coinSymbol)
        }

        spotWs.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            const currentCoinData = coinDataRef.current
            const previousValues = previousValuesRef.current
            
            if (data && currentCoinData) {
              const newPrice = parseFloat(data.c || data.lastPrice || currentCoinData.price || '0')
              const newSpotVolume = parseFloat(data.q || data.quoteVolume || currentCoinData.quoteVolume || '0')
              const newHighPrice = parseFloat(data.h || data.highPrice || currentCoinData.highPrice || '0')
              
              // Check for price changes - trigger on ANY change
              if (previousValues.price !== undefined && previousValues.price > 0 && newPrice > 0 && newPrice !== previousValues.price) {
                const priceDiff = Math.abs(newPrice - previousValues.price)
                const priceChangePercent = (priceDiff / previousValues.price) * 100
                
                // Trigger animation for any meaningful change
                if (priceChangePercent >= 0.001 || priceDiff >= 0.00000001) {
                  const flashType = newPrice > previousValues.price ? 'up' : 'down'
                  console.log(`💰 Price changed: ${previousValues.price} → ${newPrice} (${flashType})`)
                  setFlashAnimations(prev => ({ ...prev, price: flashType }))
                  setTimeout(() => {
                    setFlashAnimations(prev => {
                      const { price: _, ...rest } = prev
                      return rest
                    })
                  }, 1200)
                }
              }
              
              // Check for spot volume changes - trigger on ANY change
              if (previousValues.spotVolume !== undefined && previousValues.spotVolume > 0 && newSpotVolume > 0 && newSpotVolume !== previousValues.spotVolume) {
                const volumeDiff = Math.abs(newSpotVolume - previousValues.spotVolume)
                const volumeChangePercent = (volumeDiff / previousValues.spotVolume) * 100
                
                // Trigger animation for any meaningful change
                if (volumeChangePercent >= 0.01 || volumeDiff >= 100) {
                  const flashType = newSpotVolume > previousValues.spotVolume ? 'up' : 'down'
                  console.log(`📊 Spot Volume changed: ${previousValues.spotVolume} → ${newSpotVolume} (${flashType})`)
                  setFlashAnimations(prev => ({ ...prev, spotVolume: flashType }))
                  setTimeout(() => {
                    setFlashAnimations(prev => {
                      const { spotVolume: _, ...rest } = prev
                      return rest
                    })
                  }, 1200)
                }
              }
              
              // Check for high price changes
              if (previousValues.highPrice !== undefined && previousValues.highPrice > 0 && newHighPrice > 0 && newHighPrice !== previousValues.highPrice) {
                const highDiff = Math.abs(newHighPrice - previousValues.highPrice)
                const highChangePercent = (highDiff / previousValues.highPrice) * 100
                
                // Trigger animation for any meaningful change
                if (highChangePercent >= 0.001 || highDiff >= 0.00000001) {
                  const flashType = newHighPrice > previousValues.highPrice ? 'up' : 'down'
                  console.log(`📈 High Price changed: ${previousValues.highPrice} → ${newHighPrice} (${flashType})`)
                  setFlashAnimations(prev => ({ ...prev, highPrice: flashType }))
                  setTimeout(() => {
                    setFlashAnimations(prev => {
                      const { highPrice: _, ...rest } = prev
                      return rest
                    })
                  }, 1200)
                }
              }
              
              // Update coin data with Spot WebSocket data
              // Note: openPrice and prevClosePrice should NOT be updated from WebSocket
              // They represent fixed "previous day" values and should only come from initial API call
              const updatedCoinData: CoinData = {
                ...currentCoinData,
                price: data.c || data.lastPrice || currentCoinData.price,
                priceChangePercent: data.P || data.priceChangePercent || currentCoinData.priceChangePercent,
                volume: data.v || data.volume || currentCoinData.volume,
                quoteVolume: data.q || data.quoteVolume || currentCoinData.quoteVolume,
                highPrice: data.h || data.highPrice || currentCoinData.highPrice,
                lowPrice: data.l || data.lowPrice || currentCoinData.lowPrice,
                // Preserve original openPrice and prevClosePrice - do not update from WebSocket
                openPrice: currentCoinData.openPrice,
                prevClosePrice: currentCoinData.prevClosePrice,
                // Preserve futures data
                futuresVolume: currentCoinData.futuresVolume,
                futuresQuoteVolume: currentCoinData.futuresQuoteVolume,
              }
              
              // Update previous values
              previousValuesRef.current = {
                ...previousValuesRef.current,
                price: newPrice,
                spotVolume: newSpotVolume,
                highPrice: newHighPrice,
              }
              
              setCoinData(updatedCoinData)
              
              // For 1D time range, update chartKlines with latest data from WebSocket
              if (timeRangeRef.current === '1D') {
                // For 1D, we update the last point with the current price for real-time updates
                setChartKlines(prev => {
                  if (prev.length === 0) return prev
                  const updated = [...prev]
                  const lastIndex = updated.length - 1
                  const lastPoint = updated[lastIndex]
                  updated[lastIndex] = {
                    ...lastPoint,
                    close: newPrice,
                    high: Math.max(lastPoint.high, newPrice),
                    low: Math.min(lastPoint.low, newPrice),
                  }
                  return updated
                })
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
          console.log('Spot WebSocket disconnected, reconnecting...')
          setTimeout(() => {
            if (coinDataRef.current) {
              connectWebSocket(coinSymbol)
            }
          }, 3000)
        }

        wsRef.current = spotWs
      } catch (error) {
        console.error('Failed to create Spot WebSocket:', error)
      }

      // Futures WebSocket
      try {
        const futuresWs = new WebSocket(futuresWsUrl)

        futuresWs.onopen = () => {
          console.log('Futures WebSocket connected for', coinSymbol)
        }

        futuresWs.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            const currentCoinData = coinDataRef.current
            const previousValues = previousValuesRef.current
            
            if (data && currentCoinData) {
              const newFuturesVolume = parseFloat(data.q || data.quoteVolume || currentCoinData.futuresQuoteVolume || '0')
              
              // Check for futures volume changes - trigger on ANY change
              if (previousValues.futuresVolume !== undefined && previousValues.futuresVolume > 0 && newFuturesVolume > 0 && newFuturesVolume !== previousValues.futuresVolume) {
                const volumeDiff = Math.abs(newFuturesVolume - previousValues.futuresVolume)
                const volumeChangePercent = (volumeDiff / previousValues.futuresVolume) * 100
                
                // Trigger animation for any meaningful change
                if (volumeChangePercent >= 0.01 || volumeDiff >= 100) {
                  const flashType = newFuturesVolume > previousValues.futuresVolume ? 'up' : 'down'
                  console.log(`📊 Futures Volume changed: ${previousValues.futuresVolume} → ${newFuturesVolume} (${flashType})`)
                  setFlashAnimations(prev => ({ ...prev, futuresVolume: flashType }))
                  setTimeout(() => {
                    setFlashAnimations(prev => {
                      const { futuresVolume: _, ...rest } = prev
                      return rest
                    })
                  }, 1200)
                }
              }
              
              // Update coin data with Futures WebSocket data
              const updatedCoinData: CoinData = {
                ...currentCoinData,
                futuresVolume: data.v || data.volume || currentCoinData.futuresVolume || '0',
                futuresQuoteVolume: data.q || data.quoteVolume || currentCoinData.futuresQuoteVolume || '0',
              }
              
              // Update previous values
              previousValuesRef.current = {
                ...previousValuesRef.current,
                futuresVolume: newFuturesVolume,
              }
              
              setCoinData(updatedCoinData)
            }
          } catch (error) {
            console.error('Error parsing Futures WebSocket message:', error)
          }
        }

        futuresWs.onerror = (error) => {
          console.error('Futures WebSocket error:', error)
        }

        futuresWs.onclose = () => {
          console.log('Futures WebSocket disconnected, reconnecting...')
          setTimeout(() => {
            if (coinDataRef.current) {
              connectWebSocket(coinSymbol)
            }
          }, 3000)
        }

        futuresWsRef.current = futuresWs
      } catch (error) {
        console.error('Failed to create Futures WebSocket:', error)
      }

      // Trades WebSocket
      try {
        const tradesWs = new WebSocket(tradesWsUrl)

            tradesWs.onopen = () => {
              console.log('Trades WebSocket connected for', coinSymbol)
            }

            tradesWs.onmessage = (event) => {
              try {
                const data = JSON.parse(event.data)
                
                if (data && data.e === 'trade') {
                  const price = parseFloat(data.p || '0')
                  const quantity = parseFloat(data.q || '0')
                  const quoteAmount = price * quantity
                  const tradeTime = data.T || data.E || Date.now()
                  // m: true means buyer is market maker (sell order)
                  // m: false means seller is market maker (buy order)
                  const isBuy = !data.m
                  
                  const trade: Trade = {
                    id: data.t || Date.now() + Math.random(), // Add random to ensure uniqueness
                    price: price,
                    quantity: quantity,
                    quoteAmount: quoteAmount,
                    time: tradeTime,
                    isBuy: isBuy,
                  }
                  
                  if (isBuy) {
                    setBuyTrades(prev => {
                      const updated = [trade, ...prev]
                      // Keep only last 20
                      return updated.slice(0, 20)
                    })
                  } else {
                    setSellTrades(prev => {
                      const updated = [trade, ...prev]
                      // Keep only last 20
                      return updated.slice(0, 20)
                    })
                  }
                }
              } catch (error) {
                console.error('Error parsing Trades WebSocket message:', error)
              }
            }

            tradesWs.onerror = (error) => {
              console.error('Trades WebSocket error:', error)
            }

            tradesWs.onclose = () => {
              console.log('Trades WebSocket disconnected, reconnecting...')
              setTimeout(() => {
                if (coinDataRef.current) {
                  connectWebSocket(coinSymbol)
                }
              }, 3000)
            }

        tradesWsRef.current = tradesWs
      } catch (error) {
        console.error('Failed to create Trades WebSocket:', error)
      }
    }

    fetchInitialData()

        return () => {
          // Cleanup: close WebSockets on unmount
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
          if (tradesWsRef.current) {
            try {
              tradesWsRef.current.onmessage = null
              tradesWsRef.current.onerror = null
              tradesWsRef.current.onclose = null
              tradesWsRef.current.onopen = null
              if (tradesWsRef.current.readyState === WebSocket.OPEN || tradesWsRef.current.readyState === WebSocket.CONNECTING) {
                tradesWsRef.current.close()
              }
            } catch (error) {
              console.error('Error closing trades WebSocket:', error)
            }
            tradesWsRef.current = null
          }
        }
  }, [symbol])

  console.log('Render - loading:', loading, 'coinData:', coinData ? 'exists' : 'null', 'error:', error, 'symbol:', symbol)
  
  if (loading) {
    return (
      <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center py-12 text-muted-foreground">Coin verileri yükleniyor...</div>
      </div>
    )
  }

  // Only show error/not found if loading is complete and we have an error or no data
  if (!coinData && error) {
    return (
      <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold mb-4">Coin bulunamadı</h1>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button asChild>
            <Link href="/coins">Coinlere Dön</Link>
          </Button>
        </div>
      </div>
    )
  }
  
  // If still loading (shouldn't happen but just in case)
  if (!coinData) {
    return (
      <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center py-12 text-muted-foreground">Coin verileri yükleniyor...</div>
      </div>
    )
  }

  const change = parseFloat(coinData.priceChangePercent)
  const isPositive = change >= 0

  const formatKlineData = (klines: CoinData['klines'], futuresKlines: CoinData['futuresKlines'] = [], timeRangeValue: string = timeRange) => {
    // Create a map of futures klines by time for quick lookup
    const futuresMap = new Map<number, number>()
    futuresKlines.forEach(fk => {
      futuresMap.set(fk.time, fk.volume)
    })
    
    return klines.map((k, index) => {
      const isPositive = index === 0 ? true : k.close >= klines[index - 1].close
      
      let timeFormat: string
      if (timeRangeValue === '1Y') {
        timeFormat = new Date(k.time).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      } else if (timeRangeValue === '90D' || timeRangeValue === '30D') {
        timeFormat = new Date(k.time).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        })
      } else if (timeRangeValue === '7D') {
        timeFormat = new Date(k.time).toLocaleString('tr-TR', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      } else {
        // 1D
        timeFormat = new Date(k.time).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
        })
      }
      
      // Find matching futures volume by time (closest match)
      const futuresVolume = futuresMap.get(k.time) || 0
      
      return {
        time: timeFormat,
        timestamp: k.time,
        price: k.close,
        open: k.open,
        high: k.high,
        low: k.low,
        close: k.close,
        volume: k.volume, // Spot volume
        futuresVolume: futuresVolume, // Futures volume
        isPositive: isPositive,
      }
    })
  }

  const formatDailyKlineData = (klines: NonNullable<CoinData['premium']>['dailyChart']) => {
    return klines.map((k, index) => {
      const isPositive = index === 0 ? true : k.close >= klines[index - 1].close
      return {
        time: new Date(k.time).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        }),
        timestamp: k.time,
        price: k.close,
        open: k.open,
        high: k.high,
        low: k.low,
        close: k.close,
        volume: k.volume,
        isPositive: isPositive,
      }
    })
  }

  // Only format and calculate if we have data
  const chartData = chartKlines.length > 0 ? formatKlineData(chartKlines, chartFuturesKlines, timeRange) : []
  const priceChange = chartData.length > 0 && chartData[0] ? 
    ((chartData[chartData.length - 1].close - chartData[0].open) / chartData[0].open) * 100 : 0
  const isChartPositive = priceChange >= 0
  
  // Memoize chart data to prevent unnecessary re-renders
  const memoizedChartData = chartData

  const timeRangeOptions: Array<{ label: string; value: '1D' | '7D' | '30D' | '90D' | '1Y' }> = [
    { label: '24 Saat', value: '1D' },
    { label: '7 Gün', value: '7D' },
    { label: '30 Gün', value: '30D' },
    { label: '90 Gün', value: '90D' },
    { label: '1 Yıl', value: '1Y' },
  ]

  return (
    <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className={`mb-8 p-6 rounded-xl transition-all duration-300 ${
        flashAnimations.price === 'up' ? 'animate-flash-green' : 
        flashAnimations.price === 'down' ? 'animate-flash-red' : 
        'bg-transparent'
      }`}>
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
          {isPositive ? (
            <TrendingUp className="h-8 w-8 text-green-400" />
          ) : (
            <TrendingDown className="h-8 w-8 text-red-400" />
          )}
          {coinData.symbol}
        </h1>
        <div className="flex items-center gap-4">
          <div className={`text-3xl font-bold ${
            flashAnimations.price === 'up' ? 'text-green-400' : 
            flashAnimations.price === 'down' ? 'text-red-400' : 
            ''
          }`}>
            ${parseFloat(coinData.price).toLocaleString('tr-TR', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 6,
            })}
          </div>
          <Badge
            variant={isPositive ? 'default' : 'destructive'}
            className={`${
              isPositive 
                ? 'bg-gradient-to-r from-green-500 via-emerald-500 to-green-400 text-white border-0 shadow-lg shadow-green-500/30' 
                : 'bg-gradient-to-r from-red-500 via-rose-500 to-red-400 text-white border-0 shadow-lg shadow-red-500/30'
            } font-semibold px-4 py-2 flex items-center gap-2`}
            style={{ fontSize: '1rem' }}
          >
            {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            {isPositive ? '+' : ''}
            {change.toFixed(2)}%
          </Badge>
        </div>
      </div>

      {/* Bilgi Kartı */}
      <Card className="mb-6 bg-gradient-to-br from-background/95 to-background/80 border-border/50 shadow-lg">
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
            {/* 24s En Yüksek */}
            <div className="flex flex-col gap-2 p-4 rounded-lg bg-gradient-to-br from-green-500/10 to-green-500/5 border border-green-500/20">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">24s En Yüksek</span>
              <span className={`text-xl font-bold ${
                flashAnimations.highPrice === 'up' ? 'text-green-400' : 
                flashAnimations.highPrice === 'down' ? 'text-green-300' : 
                'text-green-400'
              }`}>
                ${parseFloat(coinData.highPrice).toLocaleString('tr-TR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 6,
                })}
              </span>
            </div>

            {/* 24s En Düşük */}
            <div className="flex flex-col gap-2 p-4 rounded-lg bg-gradient-to-br from-red-500/10 to-red-500/5 border border-red-500/20">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">24s En Düşük</span>
              <span className="text-xl font-bold text-red-400">
                ${parseFloat(coinData.lowPrice).toLocaleString('tr-TR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 6,
                })}
              </span>
            </div>

            {/* 24 Saatlik Spot Hacim */}
            <div className="flex flex-col gap-2 p-4 rounded-lg bg-gradient-to-br from-blue-500/10 to-blue-500/5 border border-blue-500/20">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">24s Spot Hacim</span>
              <span className={`text-xl font-bold text-blue-400 ${
                flashAnimations.spotVolume === 'up' ? 'animate-pulse' : ''
              }`}>
                ${parseFloat(coinData.quoteVolume || '0').toLocaleString('tr-TR', {
                  maximumFractionDigits: 0,
                })}
              </span>
            </div>

            {/* 24 Saatlik Vadeli Hacim */}
            <div className="flex flex-col gap-2 p-4 rounded-lg bg-gradient-to-br from-purple-500/10 to-purple-500/5 border border-purple-500/20">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">24s Vadeli Hacim</span>
              <span className={`text-xl font-bold text-purple-400 ${
                flashAnimations.futuresVolume === 'up' ? 'animate-pulse' : ''
              }`}>
                ${parseFloat(coinData.futuresQuoteVolume || '0').toLocaleString('tr-TR', {
                  maximumFractionDigits: 0,
                })}
              </span>
            </div>

            {/* 24 Saatlik Dolar Cinsinden Değişim */}
            <div className="flex flex-col gap-2 p-4 rounded-lg bg-gradient-to-br from-amber-500/10 to-amber-500/5 border border-amber-500/20">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">24s Dolar Değişim</span>
              <span className={`text-xl font-bold ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                {isPositive ? '+' : ''}${(parseFloat(coinData.price) - parseFloat(coinData.prevClosePrice)).toLocaleString('tr-TR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 6,
                })}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="hourly" className="w-full">
        <TabsList>
          <TabsTrigger value="hourly">24s Grafik</TabsTrigger>
          <TabsTrigger value="daily" disabled={!isPremium}>
            {!isPremium && <Lock className="h-3 w-3 ml-1" />}
            Günlük Grafik (Premium)
          </TabsTrigger>
        </TabsList>
        <TabsContent value="hourly" className="mt-6">
          <Card className="bg-gradient-to-br from-background to-background/80 border-border/50">
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <CardTitle className="text-2xl mb-1">Fiyat Grafiği</CardTitle>
                  <CardDescription>
                    {timeRange === '1D' && '24 saatlik fiyat hareketleri'}
                    {timeRange === '7D' && '7 günlük fiyat hareketleri'}
                    {timeRange === '30D' && '30 günlük fiyat hareketleri'}
                    {timeRange === '90D' && '90 günlük fiyat hareketleri'}
                    {timeRange === '1Y' && '1 yıllık fiyat hareketleri'}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex gap-2 bg-background/50 p-1 rounded-lg border border-border/50">
                    {timeRangeOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => setTimeRange(option.value)}
                        className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all cursor-pointer ${
                          timeRange === option.value
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  <div className="text-right">
                    <div className={`text-2xl font-bold ${isChartPositive ? 'text-green-400' : 'text-red-400'}`}>
                      {isChartPositive ? '+' : ''}{priceChange.toFixed(2)}%
                    </div>
                    <div className="text-sm text-muted-foreground">Dönem Değişimi</div>
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-border/50">
                <div className="flex items-center gap-6 flex-wrap">
                  <Label className="text-sm font-medium text-muted-foreground cursor-pointer flex items-center gap-2">
                    <Checkbox
                      checked={showPrice}
                      onCheckedChange={(checked) => setShowPrice(checked === true)}
                      className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                    />
                    <span>Fiyat</span>
                  </Label>
                  <Label className="text-sm font-medium text-muted-foreground cursor-pointer flex items-center gap-2">
                    <Checkbox
                      checked={showSpotVolume}
                      onCheckedChange={(checked) => setShowSpotVolume(checked === true)}
                      className="data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
                    />
                    <span className="text-blue-400">Spot Hacim</span>
                  </Label>
                  <Label className="text-sm font-medium text-muted-foreground cursor-pointer flex items-center gap-2">
                    <Checkbox
                      checked={showFuturesVolume}
                      onCheckedChange={(checked) => setShowFuturesVolume(checked === true)}
                      className="data-[state=checked]:bg-purple-500 data-[state=checked]:border-purple-500"
                    />
                    <span className="text-purple-400">Vadeli Hacim</span>
                  </Label>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {chartLoading ? (
                <div className="flex items-center justify-center h-[500px]">
                  <div className="text-muted-foreground">Grafik yükleniyor...</div>
                </div>
              ) : chartData.length === 0 ? (
                <div className="flex items-center justify-center h-[500px]">
                  <div className="text-muted-foreground">Veri yükleniyor...</div>
                </div>
              ) : (
              <ResponsiveContainer width="100%" height={500}>
                <ComposedChart data={memoizedChartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <defs>
                    <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={isChartPositive ? "rgba(34, 197, 94, 0.3)" : "rgba(239, 68, 68, 0.3)"} stopOpacity={1} />
                      <stop offset="100%" stopColor={isChartPositive ? "rgba(34, 197, 94, 0)" : "rgba(239, 68, 68, 0)"} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="volumeGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgba(96, 165, 250, 0.4)" stopOpacity={1} />
                      <stop offset="100%" stopColor="rgba(96, 165, 250, 0)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="futuresVolumeGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgba(167, 139, 250, 0.4)" stopOpacity={1} />
                      <stop offset="100%" stopColor="rgba(167, 139, 250, 0)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid 
                    strokeDasharray="3 3" 
                    stroke="rgba(255, 255, 255, 0.05)" 
                    vertical={false}
                  />
                  <XAxis 
                    dataKey="time" 
                    stroke="rgba(255, 255, 255, 0.3)"
                    tick={{ fill: 'rgba(255, 255, 255, 0.5)', fontSize: 12 }}
                    axisLine={{ stroke: 'rgba(255, 255, 255, 0.1)' }}
                  />
                  <YAxis 
                    yAxisId="price"
                    orientation="left"
                    stroke="rgba(255, 255, 255, 0.3)"
                    tick={{ fill: 'rgba(255, 255, 255, 0.5)', fontSize: 12 }}
                    axisLine={{ stroke: 'rgba(255, 255, 255, 0.1)' }}
                    domain={['dataMin - 0.01', 'dataMax + 0.01']}
                    tickFormatter={(value) => `$${value.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  />
                  <YAxis 
                    yAxisId="volume"
                    orientation="right"
                    stroke="rgba(255, 255, 255, 0.3)"
                    tick={{ fill: 'rgba(255, 255, 255, 0.5)', fontSize: 12 }}
                    axisLine={{ stroke: 'rgba(255, 255, 255, 0.1)' }}
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'rgba(0, 0, 0, 0.9)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '8px',
                      color: '#fff',
                    }}
                    content={({ active, payload, label }: any) => {
                      if (!active || !payload || !payload.length) return null
                      
                      const formatVolume = (val: number) => {
                        if (!val || isNaN(val)) return '0'
                        const parts = val.toFixed(2).split('.')
                        const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.')
                        const decimalPart = parts[1]
                        return decimalPart === '00' ? integerPart : `${integerPart},${decimalPart}`
                      }
                      
                      return (
                        <div className="rounded-lg border border-white/10 bg-black/90 p-3 shadow-lg">
                          <p className="mb-2 text-sm text-white/70">{label}</p>
                          {payload.map((entry: any, index: number) => {
                            const dataKey = entry.dataKey || entry.name
                            let formattedValue = String(entry.value || 0)
                            let labelName = entry.name || dataKey
                            let valueColor = 'text-white'
                            
                            if (dataKey === 'price') {
                              formattedValue = `$${formatNumberTR(entry.value, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`
                              labelName = 'Fiyat'
                              // Fiyat için grafiğin genel yönüne göre renk (yeşil/kırmızı)
                              const chartData = payload.find((p: any) => p.dataKey === 'price')
                              if (chartData) {
                                // Basit bir renk mantığı: fiyat için beyaz, grafik zaten renkli
                                valueColor = 'text-white'
                              }
                            } else if (dataKey === 'volume') {
                              formattedValue = `$${formatVolume(entry.value)}`
                              labelName = 'Spot Hacim'
                              valueColor = 'text-blue-400'
                            } else if (dataKey === 'futuresVolume') {
                              formattedValue = `$${formatVolume(entry.value)}`
                              labelName = 'Vadeli Hacim'
                              valueColor = 'text-purple-400'
                            }
                            
                            return (
                              <div key={index} className="flex items-center justify-between gap-4 text-sm">
                                <span className="text-white/70">{labelName}:</span>
                                <span className={`font-semibold ${valueColor}`}>{formattedValue}</span>
                              </div>
                            )
                          })}
                        </div>
                      )
                    }}
                  />
                  {showPrice && (
                    <Area
                      yAxisId="price"
                      type="monotone"
                      dataKey="price"
                      stroke={isChartPositive ? "#22c55e" : "#ef4444"}
                      strokeWidth={2.5}
                      fill="url(#priceGradient)"
                      fillOpacity={1}
                      isAnimationActive={true}
                      animationDuration={800}
                    />
                  )}
                  {showSpotVolume && (
                    <Bar
                      yAxisId="volume"
                      dataKey="volume"
                      fill="url(#volumeGradient)"
                      opacity={0.7}
                      radius={[4, 4, 0, 0]}
                      isAnimationActive={timeRange !== '1D'} // Disable animation for real-time updates
                      name="Spot Hacim"
                    />
                  )}
                  {showFuturesVolume && (
                    <Bar
                      yAxisId="volume"
                      dataKey="futuresVolume"
                      fill="url(#futuresVolumeGradient)"
                      opacity={0.7}
                      radius={[4, 4, 0, 0]}
                      isAnimationActive={timeRange !== '1D'} // Disable animation for real-time updates
                      name="Vadeli Hacim"
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="daily" className="mt-6">
          {isPremium && coinData.premium?.dailyChart ? (
            <Card className="bg-gradient-to-br from-background to-background/80 border-border/50">
              <CardHeader>
                <CardTitle className="text-2xl mb-1">Günlük Grafik (30 gün)</CardTitle>
                <CardDescription>Premium özellik - Hacimle günlük fiyat hareketleri</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={500}>
                  <ComposedChart 
                    data={formatDailyKlineData(coinData.premium.dailyChart)} 
                    margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                  >
                    <defs>
                      <linearGradient id="dailyPriceGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgba(139, 92, 246, 0.3)" stopOpacity={1} />
                        <stop offset="100%" stopColor="rgba(139, 92, 246, 0)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="dailyVolumeGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgba(139, 92, 246, 0.4)" stopOpacity={1} />
                        <stop offset="100%" stopColor="rgba(139, 92, 246, 0)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid 
                      strokeDasharray="3 3" 
                      stroke="rgba(255, 255, 255, 0.05)" 
                      vertical={false}
                    />
                    <XAxis 
                      dataKey="time" 
                      stroke="rgba(255, 255, 255, 0.3)"
                      tick={{ fill: 'rgba(255, 255, 255, 0.5)', fontSize: 12 }}
                      axisLine={{ stroke: 'rgba(255, 255, 255, 0.1)' }}
                    />
                    <YAxis 
                      yAxisId="price"
                      orientation="left"
                      stroke="rgba(255, 255, 255, 0.3)"
                      tick={{ fill: 'rgba(255, 255, 255, 0.5)', fontSize: 12 }}
                      axisLine={{ stroke: 'rgba(255, 255, 255, 0.1)' }}
                      domain={['dataMin - 0.01', 'dataMax + 0.01']}
                      tickFormatter={(value) => `$${value.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    />
                    <YAxis 
                      yAxisId="volume"
                      orientation="right"
                      stroke="rgba(255, 255, 255, 0.3)"
                      tick={{ fill: 'rgba(255, 255, 255, 0.5)', fontSize: 12 }}
                      axisLine={{ stroke: 'rgba(255, 255, 255, 0.1)' }}
                    />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: 'rgba(0, 0, 0, 0.9)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '8px',
                        color: '#fff',
                      }}
                      content={({ active, payload, label }: any) => {
                        if (!active || !payload || !payload.length) return null
                        
                        const formatVolume = (val: number) => {
                          if (!val || isNaN(val)) return '0'
                          const parts = val.toFixed(2).split('.')
                          const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.')
                          const decimalPart = parts[1]
                          return decimalPart === '00' ? integerPart : `${integerPart},${decimalPart}`
                        }
                        
                        return (
                          <div className="rounded-lg border border-white/10 bg-black/90 p-3 shadow-lg">
                            <p className="mb-2 text-sm text-white/70">{label}</p>
                            {payload.map((entry: any, index: number) => {
                              const dataKey = entry.dataKey || entry.name
                              let formattedValue = String(entry.value || 0)
                              let labelName = entry.name || dataKey
                              let valueColor = 'text-white'
                              
                              if (dataKey === 'price') {
                                formattedValue = `$${formatNumberTR(entry.value, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`
                                labelName = 'Fiyat'
                                valueColor = 'text-white'
                              } else if (dataKey === 'volume') {
                                formattedValue = `$${formatVolume(entry.value)}`
                                labelName = 'Volume'
                                valueColor = 'text-purple-400'
                              }
                              
                              return (
                                <div key={index} className="flex items-center justify-between gap-4 text-sm">
                                  <span className="text-white/70">{labelName}:</span>
                                  <span className={`font-semibold ${valueColor}`}>{formattedValue}</span>
                                </div>
                              )
                            })}
                          </div>
                        )
                      }}
                      labelStyle={{ color: 'rgba(255, 255, 255, 0.7)' }}
                    />
                    <Area
                      yAxisId="price"
                      type="monotone"
                      dataKey="price"
                      stroke="#8b5cf6"
                      strokeWidth={2.5}
                      fill="url(#dailyPriceGradient)"
                      fillOpacity={1}
                      isAnimationActive={true}
                      animationDuration={800}
                    />
                    <Bar
                      yAxisId="volume"
                      dataKey="volume"
                      fill="url(#dailyVolumeGradient)"
                      opacity={0.6}
                      radius={[4, 4, 0, 0]}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Lock className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-xl font-semibold mb-2">Premium Özellik</h3>
                <p className="text-muted-foreground mb-4">
                  Günlük grafikler ve gelişmiş göstergelere erişmek için Premium'a yükseltin
                </p>
                <Button asChild>
                  <Link href="/checkout">Premium'a Yükselt</Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

          <Card className="mt-6 bg-gradient-to-br from-background to-background/80 border-border/50">
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <CardTitle className="text-xl">İşlem Hacmi</CardTitle>
                  <CardDescription>
                    {timeRange === '1D' && '24 saatlik hacim dağılımı'}
                    {timeRange === '7D' && '7 günlük hacim dağılımı'}
                    {timeRange === '30D' && '30 günlük hacim dağılımı'}
                    {timeRange === '90D' && '90 günlük hacim dağılımı'}
                    {timeRange === '1Y' && '1 yıllık hacim dağılımı'}
                  </CardDescription>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-border/50">
                <div className="flex items-center gap-6 flex-wrap">
                  <Label className="text-sm font-medium text-muted-foreground cursor-pointer flex items-center gap-2">
                    <Checkbox
                      checked={showSpotVolume}
                      onCheckedChange={(checked) => setShowSpotVolume(checked === true)}
                      className="data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
                    />
                    <span className="text-blue-400">Spot Hacim</span>
                  </Label>
                  <Label className="text-sm font-medium text-muted-foreground cursor-pointer flex items-center gap-2">
                    <Checkbox
                      checked={showFuturesVolume}
                      onCheckedChange={(checked) => setShowFuturesVolume(checked === true)}
                      className="data-[state=checked]:bg-purple-500 data-[state=checked]:border-purple-500"
                    />
                    <span className="text-purple-400">Vadeli Hacim</span>
                  </Label>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {chartLoading ? (
                <div className="flex items-center justify-center h-[350px]">
                  <div className="text-muted-foreground">Grafik yükleniyor...</div>
                </div>
              ) : chartData.length === 0 ? (
                <div className="flex items-center justify-center h-[350px]">
                  <div className="text-muted-foreground">Veri yükleniyor...</div>
                </div>
              ) : (
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={memoizedChartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <defs>
                    <linearGradient id="volumeBarGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgba(96, 165, 250, 0.8)" stopOpacity={1} />
                      <stop offset="100%" stopColor="rgba(96, 165, 250, 0.3)" stopOpacity={1} />
                    </linearGradient>
                    <linearGradient id="futuresVolumeBarGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgba(167, 139, 250, 0.8)" stopOpacity={1} />
                      <stop offset="100%" stopColor="rgba(167, 139, 250, 0.3)" stopOpacity={1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid 
                    strokeDasharray="3 3" 
                    stroke="rgba(255, 255, 255, 0.05)" 
                    vertical={false}
                  />
                  <XAxis 
                    dataKey="time" 
                    stroke="rgba(255, 255, 255, 0.3)"
                    tick={{ fill: 'rgba(255, 255, 255, 0.5)', fontSize: 12 }}
                    axisLine={{ stroke: 'rgba(255, 255, 255, 0.1)' }}
                  />
                  <YAxis 
                    stroke="rgba(255, 255, 255, 0.3)"
                    tick={{ fill: 'rgba(255, 255, 255, 0.5)', fontSize: 12 }}
                    axisLine={{ stroke: 'rgba(255, 255, 255, 0.1)' }}
                    tickFormatter={(value) => {
                      if (value >= 1000000) return `${(value / 1000000).toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}M`
                      if (value >= 1000) return `${(value / 1000).toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}K`
                      return value.toString()
                    }}
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'rgba(0, 0, 0, 0.9)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '8px',
                      color: '#fff',
                    }}
                    content={({ active, payload, label }: any) => {
                      if (!active || !payload || !payload.length) return null
                      
                      const formatVolume = (val: number) => {
                        if (!val || isNaN(val)) return '0'
                        const parts = val.toFixed(2).split('.')
                        const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.')
                        const decimalPart = parts[1]
                        return decimalPart === '00' ? integerPart : `${integerPart},${decimalPart}`
                      }
                      
                      return (
                        <div className="rounded-lg border border-white/10 bg-black/90 p-3 shadow-lg">
                          <p className="mb-2 text-sm text-white/70">{label}</p>
                          {payload.map((entry: any, index: number) => {
                            const dataKey = entry.dataKey || entry.name
                            let formattedValue = String(entry.value || 0)
                            let labelName = entry.name || dataKey
                            let valueColor = 'text-white'
                            
                            if (dataKey === 'volume') {
                              formattedValue = `$${formatVolume(entry.value)}`
                              labelName = 'Spot Hacim'
                              valueColor = 'text-blue-400'
                            } else if (dataKey === 'futuresVolume') {
                              formattedValue = `$${formatVolume(entry.value)}`
                              labelName = 'Vadeli Hacim'
                              valueColor = 'text-purple-400'
                            }
                            
                            return (
                              <div key={index} className="flex items-center justify-between gap-4 text-sm">
                                <span className="text-white/70">{labelName}:</span>
                                <span className={`font-semibold ${valueColor}`}>{formattedValue}</span>
                              </div>
                            )
                          })}
                        </div>
                      )
                    }}
                  />
                  {showSpotVolume && (
                    <Bar 
                      dataKey="volume" 
                      fill="url(#volumeBarGradient)"
                      radius={[8, 8, 0, 0]}
                      isAnimationActive={timeRange !== '1D'} // Disable animation for real-time updates
                      animationDuration={800}
                      name="Spot Hacim"
                    />
                  )}
                  {showFuturesVolume && (
                    <Bar 
                      dataKey="futuresVolume" 
                      fill="url(#futuresVolumeBarGradient)"
                      radius={[8, 8, 0, 0]}
                      isAnimationActive={timeRange !== '1D'} // Disable animation for real-time updates
                      animationDuration={800}
                      name="Vadeli Hacim"
                    />
                  )}
                </BarChart>
              </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-2 mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-400" />
                  Alış Emirleri
                </CardTitle>
                <CardDescription>Son 20 alış emri (gerçek zamanlı)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {buyTrades.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Henüz alış emri yok
                    </div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border/50">
                          <th className="text-left p-2 text-muted-foreground">Zaman</th>
                          <th className="text-right p-2 text-muted-foreground">Fiyat</th>
                          <th className="text-right p-2 text-muted-foreground">Miktar</th>
                          <th className="text-right p-2 text-muted-foreground">Toplam</th>
                        </tr>
                      </thead>
                      <tbody>
                        {buyTrades.map((trade, index) => (
                          <tr key={`buy-${trade.id}-${trade.time}-${index}`} className="border-b border-border/30 hover:bg-green-500/5 transition-colors">
                            <td className="p-2 text-muted-foreground">
                              {new Date(trade.time).toLocaleTimeString('tr-TR', {
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                              })}
                            </td>
                            <td className="p-2 text-right font-semibold text-green-400">
                              ${trade.price.toLocaleString('tr-TR', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 8,
                              })}
                            </td>
                            <td className="p-2 text-right text-muted-foreground">
                              {trade.quantity.toLocaleString('tr-TR', {
                                maximumFractionDigits: 8,
                              })}
                            </td>
                            <td className="p-2 text-right font-semibold text-green-300">
                              ${trade.quoteAmount.toLocaleString('tr-TR', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingDown className="h-5 w-5 text-red-400" />
                  Satış Emirleri
                </CardTitle>
                <CardDescription>Son 20 satış emri (gerçek zamanlı)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {sellTrades.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Henüz satış emri yok
                    </div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border/50">
                          <th className="text-left p-2 text-muted-foreground">Zaman</th>
                          <th className="text-right p-2 text-muted-foreground">Fiyat</th>
                          <th className="text-right p-2 text-muted-foreground">Miktar</th>
                          <th className="text-right p-2 text-muted-foreground">Toplam</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sellTrades.map((trade, index) => (
                          <tr key={`sell-${trade.id}-${trade.time}-${index}`} className="border-b border-border/30 hover:bg-red-500/5 transition-colors">
                            <td className="p-2 text-muted-foreground">
                              {new Date(trade.time).toLocaleTimeString('tr-TR', {
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                              })}
                            </td>
                            <td className="p-2 text-right font-semibold text-red-400">
                              ${trade.price.toLocaleString('tr-TR', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 8,
                              })}
                            </td>
                            <td className="p-2 text-right text-muted-foreground">
                              {trade.quantity.toLocaleString('tr-TR', {
                                maximumFractionDigits: 8,
                              })}
                            </td>
                            <td className="p-2 text-right font-semibold text-red-300">
                              ${trade.quoteAmount.toLocaleString('tr-TR', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )
    }

