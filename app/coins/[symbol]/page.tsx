'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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
import { TrendingUp, TrendingDown, Lock, Crown, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { formatNumberTR } from '@/lib/utils'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { createBinanceEventSource } from '@/lib/binance-stream'

interface CoinData {
  symbol: string
  price: string
  priceChangePercent: string
  volume: string
  quoteVolume: string
  futuresVolume?: string
  futuresQuoteVolume?: string
  spotBuyVolume?: string
  spotSellVolume?: string
  futuresBuyVolume?: string
  futuresSellVolume?: string
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
    buyVolume?: number
    sellVolume?: number
  }>
  futuresKlines?: Array<{
    time: number
    open: number
    high: number
    low: number
    close: number
    volume: number
    buyVolume?: number
    sellVolume?: number
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
  const [isPremium, setIsPremium] = useState<boolean | null>(null) // null = checking, false = not premium, true = premium
  const [checkingPremium, setCheckingPremium] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const wsRef = useRef<EventSource | null>(null)
  const futuresWsRef = useRef<EventSource | null>(null)
  const tradesWsRef = useRef<EventSource | null>(null)
  const futuresTradesWsRef = useRef<EventSource | null>(null)
  const coinDataRef = useRef<CoinData | null>(null)
  const timeRangeTopRef = useRef<'1M' | '5M' | '15M' | '30M' | '1D' | '7D' | '30D' | '90D' | '1Y'>('1D')
  const timeRangeBottomRef = useRef<'1M' | '5M' | '15M' | '30M' | '1D' | '7D' | '30D' | '90D' | '1Y'>('1D')
  const previousValuesRef = useRef<{
    price?: number
    spotVolume?: number
    futuresVolume?: number
    highPrice?: number
    lowPrice?: number
  }>({})
  const spotBuyVolumeRef = useRef<number>(0)
  const spotSellVolumeRef = useRef<number>(0)
  const futuresBuyVolumeRef = useRef<number>(0)
  const futuresSellVolumeRef = useRef<number>(0)
  const [flashAnimations, setFlashAnimations] = useState<Record<string, 'up' | 'down'>>({})
  const [buyTrades, setBuyTrades] = useState<Trade[]>([])
  const [sellTrades, setSellTrades] = useState<Trade[]>([])
  const [futuresBuyTrades, setFuturesBuyTrades] = useState<Trade[]>([])
  const [futuresSellTrades, setFuturesSellTrades] = useState<Trade[]>([])
  // Üst grafik (Fiyat Grafiği) için zaman aralığı
  const [timeRangeTop, setTimeRangeTop] = useState<'1M' | '5M' | '15M' | '30M' | '1D' | '7D' | '30D' | '90D' | '1Y'>('1D')
  // Alt grafik (Hacim Grafiği) için zaman aralığı
  const [timeRangeBottom, setTimeRangeBottom] = useState<'1M' | '5M' | '15M' | '30M' | '1D' | '7D' | '30D' | '90D' | '1Y'>('1D')
  const [chartLoadingTop, setChartLoadingTop] = useState(false)
  const [chartLoadingBottom, setChartLoadingBottom] = useState(false)
  const [chartKlinesTop, setChartKlinesTop] = useState<CoinData['klines']>([])
  const [chartFuturesKlinesTop, setChartFuturesKlinesTop] = useState<CoinData['futuresKlines']>([])
  const [chartKlinesBottom, setChartKlinesBottom] = useState<CoinData['klines']>([])
  const [chartFuturesKlinesBottom, setChartFuturesKlinesBottom] = useState<CoinData['futuresKlines']>([])
  // Üst grafik (Fiyat Grafiği) için state'ler
  const [showPrice, setShowPrice] = useState(true)
  const [showSpotVolumeTop, setShowSpotVolumeTop] = useState(true)
  const [showFuturesVolumeTop, setShowFuturesVolumeTop] = useState(true)
  
  // Alt grafik (Hacim Grafiği) için state'ler
  const [showSpotVolumeBottom, setShowSpotVolumeBottom] = useState(true)
  const [showFuturesVolumeBottom, setShowFuturesVolumeBottom] = useState(true)
  const [showBuyVolume, setShowBuyVolume] = useState(true)
  const [showSellVolume, setShowSellVolume] = useState(true)

  // Calculate total volumes for the selected time range - must be before useEffect hooks
  const totalVolumes = useMemo(() => {
    const spotKlines = Array.isArray(chartKlinesBottom) ? chartKlinesBottom : []
    const futuresKlines = Array.isArray(chartFuturesKlinesBottom) ? chartFuturesKlinesBottom : []

    if (spotKlines.length === 0) {
      return {
        spotBuy: 0,
        spotSell: 0,
        futuresBuy: 0,
        futuresSell: 0,
      }
    }
    
    // Calculate totals from raw klines data
    const spotBuy = spotKlines.reduce((sum, k) => sum + (k.buyVolume || 0), 0)
    const spotSell = spotKlines.reduce((sum, k) => sum + (k.sellVolume || 0), 0)
    const futuresBuy = futuresKlines.reduce((sum, k) => sum + (k.buyVolume || 0), 0)
    const futuresSell = futuresKlines.reduce((sum, k) => sum + (k.sellVolume || 0), 0)
    
    return {
      spotBuy,
      spotSell,
      futuresBuy,
      futuresSell,
    }
  }, [chartKlinesBottom, chartFuturesKlinesBottom])

  // Keep ref in sync with state
  useEffect(() => {
    coinDataRef.current = coinData
  }, [coinData])
  
  // Store initial values only once when coinData is first loaded
  useEffect(() => {
    if (coinData && !previousValuesRef.current.price) {
      previousValuesRef.current = {
        price: parseFloat(coinData.price || '0'),
        spotVolume: parseFloat(coinData.quoteVolume || '0'),
        futuresVolume: parseFloat(coinData.futuresQuoteVolume || '0'),
        highPrice: parseFloat(coinData.highPrice || '0'),
        lowPrice: parseFloat(coinData.lowPrice || '0'),
      }
    }
  }, [coinData])

  // Keep timeRangeRefs in sync with state
  useEffect(() => {
    timeRangeTopRef.current = timeRangeTop
  }, [timeRangeTop])

  useEffect(() => {
    timeRangeBottomRef.current = timeRangeBottom
  }, [timeRangeBottom])

  // Initialize or reset chartKlinesTop when timeRangeTop is 1D
  useEffect(() => {
    if (timeRangeTop === '1D' && coinData && coinData.klines) {
      setChartKlinesTop(coinData.klines)
      if (coinData.futuresKlines) {
        setChartFuturesKlinesTop(coinData.futuresKlines)
      }
    }
    // For minute ranges, data will be fetched via API in the separate useEffect
  }, [timeRangeTop, coinData])

  // Initialize or reset chartKlinesBottom when timeRangeBottom is 1D
  useEffect(() => {
    if (timeRangeBottom === '1D' && coinData && coinData.klines) {
      setChartKlinesBottom(coinData.klines)
      if (coinData.futuresKlines) {
        setChartFuturesKlinesBottom(coinData.futuresKlines)
      }
    }
    // For minute ranges, data will be fetched via API in the separate useEffect
  }, [timeRangeBottom, coinData])

  // Fetch chart data for top chart only when timeRangeTop changes and it's NOT 1D or minute ranges
  useEffect(() => {
    // Don't fetch if not premium or still checking
    if (checkingPremium || isPremium === false) {
      return
    }
    if (!symbol || !isPremium || timeRangeTop === '1D' || timeRangeTop === '1M' || timeRangeTop === '5M' || timeRangeTop === '15M' || timeRangeTop === '30M') {
      // For minute ranges, we'll fetch in a separate effect
      if (timeRangeTop !== '1D' && (timeRangeTop === '1M' || timeRangeTop === '5M' || timeRangeTop === '15M' || timeRangeTop === '30M')) {
        // Fetch minute data
        let isMounted = true
        const fetchChartData = async () => {
          setChartLoadingTop(true)
          try {
            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), 30000)
            const res = await fetch(`/api/coins/${symbol}?range=${timeRangeTop}`, { signal: controller.signal })
            clearTimeout(timeoutId)
            if (!isMounted) return
            if (res.ok) {
              const data = await res.json()
              setChartKlinesTop(data.klines || [])
              setChartFuturesKlinesTop(data.futuresKlines || [])
            } else {
              console.error('Failed to fetch chart data')
            }
          } catch (error: any) {
            if (!isMounted) return
            if (error.name !== 'AbortError') {
              console.error('Error fetching chart data:', error)
            }
          } finally {
            if (isMounted) {
              setChartLoadingTop(false)
            }
          }
        }
        fetchChartData()
        return () => { isMounted = false }
      }
      return
    }

    let isMounted = true

    const fetchChartData = async () => {
      setChartLoadingTop(true)
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 30000)
        
        const res = await fetch(`/api/coins/${symbol}?range=${timeRangeTop}`, {
          signal: controller.signal
        })
        
        clearTimeout(timeoutId)
        
        if (!isMounted) return
        
        if (res.ok) {
          const data = await res.json()
          setChartKlinesTop(data.klines || [])
          setChartFuturesKlinesTop(data.futuresKlines || [])
        } else {
          const errorData = await res.json().catch(() => ({}))
          console.error('Failed to fetch top chart data:', res.status, errorData)
          setError(errorData.error || 'Grafik verisi yüklenirken bir hata oluştu')
        }
      } catch (error: any) {
        if (!isMounted) return
        
        if (error.name === 'AbortError') {
          console.error('Top chart data fetch timeout')
          setError('Veri çekme işlemi zaman aşımına uğradı. Lütfen tekrar deneyin.')
        } else {
          console.error('Failed to fetch top chart data:', error)
          setError('Grafik verisi yüklenirken bir hata oluştu')
        }
      } finally {
        if (isMounted) {
          setChartLoadingTop(false)
        }
      }
    }

    fetchChartData()
    
    return () => {
      isMounted = false
    }
  }, [timeRangeTop, symbol, isPremium, checkingPremium]) // Only fetch when timeRangeTop or symbol changes, and if premium

  // Fetch chart data for bottom chart only when timeRangeBottom changes and it's NOT 1D or minute ranges
  useEffect(() => {
    // Don't fetch if not premium or still checking
    if (checkingPremium || isPremium === false) {
      return
    }
    if (!symbol || !isPremium || timeRangeBottom === '1D' || timeRangeBottom === '1M' || timeRangeBottom === '5M' || timeRangeBottom === '15M' || timeRangeBottom === '30M') {
      // For minute ranges, we'll fetch in a separate effect
      if (timeRangeBottom !== '1D' && (timeRangeBottom === '1M' || timeRangeBottom === '5M' || timeRangeBottom === '15M' || timeRangeBottom === '30M')) {
        // Fetch minute data
        let isMounted = true
        const fetchChartData = async () => {
          setChartLoadingBottom(true)
          try {
            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), 30000)
            const res = await fetch(`/api/coins/${symbol}?range=${timeRangeBottom}`, { signal: controller.signal })
            clearTimeout(timeoutId)
            if (!isMounted) return
            if (res.ok) {
              const data = await res.json()
              setChartKlinesBottom(data.klines || [])
              setChartFuturesKlinesBottom(data.futuresKlines || [])
            } else {
              console.error('Failed to fetch chart data')
            }
          } catch (error: any) {
            if (!isMounted) return
            if (error.name !== 'AbortError') {
              console.error('Error fetching chart data:', error)
            }
          } finally {
            if (isMounted) {
              setChartLoadingBottom(false)
            }
          }
        }
        fetchChartData()
        return () => { isMounted = false }
      }
      return
    }

    let isMounted = true

    const fetchChartData = async () => {
      setChartLoadingBottom(true)
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 30000)
        
        const res = await fetch(`/api/coins/${symbol}?range=${timeRangeBottom}`, {
          signal: controller.signal
        })
        
        clearTimeout(timeoutId)
        
        if (!isMounted) return
        
        if (res.ok) {
          const data = await res.json()
          setChartKlinesBottom(data.klines || [])
          setChartFuturesKlinesBottom(data.futuresKlines || [])
        } else {
          const errorData = await res.json().catch(() => ({}))
          console.error('Failed to fetch bottom chart data:', res.status, errorData)
          setError(errorData.error || 'Grafik verisi yüklenirken bir hata oluştu')
        }
      } catch (error: any) {
        if (!isMounted) return
        
        if (error.name === 'AbortError') {
          console.error('Bottom chart data fetch timeout')
          setError('Veri çekme işlemi zaman aşımına uğradı. Lütfen tekrar deneyin.')
        } else {
          console.error('Failed to fetch bottom chart data:', error)
          setError('Grafik verisi yüklenirken bir hata oluştu')
        }
      } finally {
        if (isMounted) {
          setChartLoadingBottom(false)
        }
      }
    }

    fetchChartData()
    
    return () => {
      isMounted = false
    }
  }, [timeRangeBottom, symbol, isPremium]) // Only fetch when timeRangeBottom or symbol changes, and if premium

  // Check premium status FIRST - before any data fetching
  useEffect(() => {
    const checkPremium = async () => {
      try {
        const res = await fetch('/api/user/profile')
        if (res.ok) {
          const data = await res.json()
          setIsPremium(data.user?.isPremium || false)
        } else {
          setIsPremium(false)
        }
      } catch (error) {
        setIsPremium(false)
      } finally {
        setCheckingPremium(false)
      }
    }
    checkPremium()
  }, [])

  useEffect(() => {
    console.log('CoinDetailPage mounted with symbol:', symbol)
    
    if (!symbol) {
      console.log('No symbol provided')
      setLoading(false)
      return
    }

    // Don't fetch data if not premium or still checking
    if (checkingPremium || isPremium === false || !isPremium) {
      setLoading(false)
      return
    }

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
          // Set initial buy/sell volumes
          spotBuyVolumeRef.current = parseFloat(data.spotBuyVolume || '0')
          spotSellVolumeRef.current = parseFloat(data.spotSellVolume || '0')
          futuresBuyVolumeRef.current = parseFloat(data.futuresBuyVolume || '0')
          futuresSellVolumeRef.current = parseFloat(data.futuresSellVolume || '0')
          // Set initial data for both charts
          setChartKlinesTop(data.klines || [])
          setChartFuturesKlinesTop(data.futuresKlines || [])
          setChartKlinesBottom(data.klines || [])
          setChartFuturesKlinesBottom(data.futuresKlines || [])
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
      if (wsRef.current) {
        try {
          wsRef.current.onmessage = null
          wsRef.current.onerror = null
          wsRef.current.onopen = null
          wsRef.current.close()
        } catch (error) {
          console.error('Error closing spot stream:', error)
        }
        wsRef.current = null
      }

      if (futuresWsRef.current) {
        try {
          futuresWsRef.current.onmessage = null
          futuresWsRef.current.onerror = null
          futuresWsRef.current.onopen = null
          futuresWsRef.current.close()
        } catch (error) {
          console.error('Error closing futures stream:', error)
        }
        futuresWsRef.current = null
      }

      if (tradesWsRef.current) {
        try {
          tradesWsRef.current.onmessage = null
          tradesWsRef.current.onerror = null
          tradesWsRef.current.onopen = null
          tradesWsRef.current.close()
        } catch (error) {
          console.error('Error closing trades stream:', error)
        }
        tradesWsRef.current = null
      }

      if (futuresTradesWsRef.current) {
        try {
          futuresTradesWsRef.current.onmessage = null
          futuresTradesWsRef.current.onerror = null
          futuresTradesWsRef.current.onopen = null
          futuresTradesWsRef.current.close()
        } catch (error) {
          console.error('Error closing futures trades stream:', error)
        }
        futuresTradesWsRef.current = null
      }

      // Spot WebSocket
      const spotStream = `${coinSymbol.toLowerCase()}@ticker`
      const futuresStream = `${coinSymbol.toLowerCase()}@ticker`
      const tradesStream = `${coinSymbol.toLowerCase()}@trade`
      const futuresTradesStream = `${coinSymbol.toLowerCase()}@trade`

      try {
        const spotWs = createBinanceEventSource(spotStream, { market: 'spot', endpoint: 'ticker' })

        spotWs.onopen = () => {
          console.log('Spot stream connected for', coinSymbol)
        }

        spotWs.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data)
            if (payload?.type) {
              if (payload.type === 'error') {
                console.error('Spot stream error message:', payload.message)
              }
              return
            }

            const dataWrapper = payload.data ?? payload
            if (!dataWrapper) return

            const currentCoinData = coinDataRef.current
            const previousValues = previousValuesRef.current

            if (currentCoinData) {
              const newPrice = parseFloat(dataWrapper.c || dataWrapper.lastPrice || currentCoinData.price || '0')
              const newSpotVolume = parseFloat(dataWrapper.q || dataWrapper.quoteVolume || currentCoinData.quoteVolume || '0')
              const newHighPrice = parseFloat(dataWrapper.h || dataWrapper.highPrice || currentCoinData.highPrice || '0')

              if (previousValues.price !== undefined && previousValues.price > 0 && newPrice > 0 && newPrice !== previousValues.price) {
                const priceDiff = Math.abs(newPrice - previousValues.price)
                const priceChangePercent = (priceDiff / previousValues.price) * 100

                if (priceChangePercent >= 0.001 || priceDiff >= 0.00000001) {
                  const flashType = newPrice > previousValues.price ? 'up' : 'down'
                  setFlashAnimations((prev) => ({ ...prev, price: flashType }))
                  setTimeout(() => {
                    setFlashAnimations((prev) => {
                      const { price: _, ...rest } = prev
                      return rest
                    })
                  }, 1200)
                }
              }

              if (previousValues.spotVolume !== undefined && previousValues.spotVolume > 0 && newSpotVolume > 0 && newSpotVolume !== previousValues.spotVolume) {
                const volumeDiff = Math.abs(newSpotVolume - previousValues.spotVolume)
                const volumeChangePercent = (volumeDiff / previousValues.spotVolume) * 100

                if (volumeChangePercent >= 0.01 || volumeDiff >= 100) {
                  const flashType = newSpotVolume > previousValues.spotVolume ? 'up' : 'down'
                  setFlashAnimations((prev) => ({ ...prev, spotVolume: flashType }))
                  setTimeout(() => {
                    setFlashAnimations((prev) => {
                      const { spotVolume: _, ...rest } = prev
                      return rest
                    })
                  }, 1200)
                }
              }

              if (previousValues.highPrice !== undefined && previousValues.highPrice > 0 && newHighPrice > 0 && newHighPrice !== previousValues.highPrice) {
                const highDiff = Math.abs(newHighPrice - previousValues.highPrice)
                const highChangePercent = (highDiff / previousValues.highPrice) * 100

                if (highChangePercent >= 0.001 || highDiff >= 0.00000001) {
                  const flashType = newHighPrice > previousValues.highPrice ? 'up' : 'down'
                  setFlashAnimations((prev) => ({ ...prev, highPrice: flashType }))
                  setTimeout(() => {
                    setFlashAnimations((prev) => {
                      const { highPrice: _, ...rest } = prev
                      return rest
                    })
                  }, 1200)
                }
              }

              const newSpotBuyVolume = parseFloat(dataWrapper.Q || dataWrapper.takerBuyQuoteVolume || '0')
              const newSpotQuoteVolume = parseFloat(dataWrapper.q || dataWrapper.quoteVolume || currentCoinData.quoteVolume || '0')
              const newSpotSellVolume = dataWrapper.takerSellQuoteVolume
                ? parseFloat(dataWrapper.takerSellQuoteVolume)
                : newSpotQuoteVolume - newSpotBuyVolume

              if (newSpotQuoteVolume > 0 && previousValues.spotVolume !== undefined && previousValues.spotVolume > 0) {
                const volumeRatio = newSpotQuoteVolume / previousValues.spotVolume
                if (volumeRatio > 0.9 && volumeRatio < 1.1) {
                  spotBuyVolumeRef.current *= volumeRatio
                  spotSellVolumeRef.current *= volumeRatio
                }
              }

              spotBuyVolumeRef.current = newSpotBuyVolume
              spotSellVolumeRef.current = newSpotSellVolume

              previousValuesRef.current.price = newPrice
              previousValuesRef.current.spotVolume = newSpotQuoteVolume
              previousValuesRef.current.highPrice = newHighPrice

              setCoinData((prev) => {
                if (!prev) return prev
                return {
                  ...prev,
                  price: newPrice.toString(),
                  quoteVolume: newSpotQuoteVolume.toString(),
                  spotBuyVolume: newSpotBuyVolume.toString(),
                  spotSellVolume: newSpotSellVolume.toString(),
                  highPrice: newHighPrice.toString(),
                }
              })
            }
          } catch (error) {
            console.error('Spot stream parse error:', error)
          }
        }

        spotWs.onerror = (error) => {
          console.error('Spot stream error:', error)
        }

        wsRef.current = spotWs
      } catch (error) {
        console.error('Failed to create Spot stream:', error)
      }

      // Futures WebSocket
      try {
        const futuresWs = createBinanceEventSource(futuresStream, { market: 'futures', endpoint: 'ticker' })

        futuresWs.onopen = () => {
          console.log('Futures stream connected for', coinSymbol)
        }

        futuresWs.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data)
            if (payload?.type) {
              if (payload.type === 'error') {
                console.error('Futures stream error message:', payload.message)
              }
              return
            }

            const dataWrapper = payload.data ?? payload
            if (!dataWrapper) return

            const currentCoinData = coinDataRef.current
            const previousValues = previousValuesRef.current

            if (currentCoinData) {
              const newFuturesVolume = parseFloat(dataWrapper.q || dataWrapper.quoteVolume || currentCoinData.futuresQuoteVolume || '0')

              if (previousValues.futuresVolume !== undefined && previousValues.futuresVolume > 0 && newFuturesVolume > 0 && newFuturesVolume !== previousValues.futuresVolume) {
                const volumeDiff = Math.abs(newFuturesVolume - previousValues.futuresVolume)
                const volumeChangePercent = (volumeDiff / previousValues.futuresVolume) * 100

                if (volumeChangePercent >= 0.01 || volumeDiff >= 100) {
                  const flashType = newFuturesVolume > previousValues.futuresVolume ? 'up' : 'down'
                  setFlashAnimations((prev) => ({ ...prev, futuresVolume: flashType }))
                  setTimeout(() => {
                    setFlashAnimations((prev) => {
                      const { futuresVolume: _, ...rest } = prev
                      return rest
                    })
                  }, 1200)
                }
              }

              const newFuturesBuyVolume = parseFloat(dataWrapper.Q || dataWrapper.takerBuyQuoteVolume || '0')
              const newFuturesQuoteVolume = parseFloat(dataWrapper.q || dataWrapper.quoteVolume || currentCoinData.futuresQuoteVolume || '0')
              const newFuturesSellVolume = dataWrapper.takerSellQuoteVolume
                ? parseFloat(dataWrapper.takerSellQuoteVolume)
                : newFuturesQuoteVolume - newFuturesBuyVolume

              if (newFuturesQuoteVolume > 0 && previousValues.futuresVolume !== undefined && previousValues.futuresVolume > 0) {
                const volumeRatio = newFuturesQuoteVolume / previousValues.futuresVolume
                if (volumeRatio > 0.9 && volumeRatio < 1.1) {
                  const currentBuyRatio = futuresBuyVolumeRef.current / (futuresBuyVolumeRef.current + futuresSellVolumeRef.current || 1)
                  const currentSellRatio = futuresSellVolumeRef.current / (futuresBuyVolumeRef.current + futuresSellVolumeRef.current || 1)
                  futuresBuyVolumeRef.current = newFuturesQuoteVolume * currentBuyRatio
                  futuresSellVolumeRef.current = newFuturesQuoteVolume * currentSellRatio
                } else {
                  futuresBuyVolumeRef.current = newFuturesBuyVolume > 0 ? newFuturesBuyVolume : futuresBuyVolumeRef.current
                  futuresSellVolumeRef.current = newFuturesSellVolume > 0 ? newFuturesSellVolume : futuresSellVolumeRef.current
                }
              } else if (newFuturesBuyVolume > 0) {
                futuresBuyVolumeRef.current = newFuturesBuyVolume
                futuresSellVolumeRef.current = newFuturesSellVolume > 0 ? newFuturesSellVolume : newFuturesQuoteVolume - newFuturesBuyVolume
              }

              const updatedCoinData: CoinData = {
                ...currentCoinData,
                futuresVolume: dataWrapper.v || dataWrapper.volume || currentCoinData.futuresVolume || '0',
                futuresQuoteVolume: dataWrapper.q || dataWrapper.quoteVolume || currentCoinData.futuresQuoteVolume || '0',
                futuresBuyVolume: futuresBuyVolumeRef.current.toString(),
                futuresSellVolume: futuresSellVolumeRef.current.toString(),
              }

              previousValuesRef.current = {
                ...previousValuesRef.current,
                futuresVolume: newFuturesVolume,
              }

              setCoinData(updatedCoinData)
            }
          } catch (error) {
            console.error('Futures stream parse error:', error)
          }
        }

        futuresWs.onerror = (error) => {
          console.error('Futures stream error:', error)
        }

        futuresWsRef.current = futuresWs
      } catch (error) {
        console.error('Failed to create Futures stream:', error)
      }

      // Trades WebSocket
      try {
        const tradesWs = createBinanceEventSource(tradesStream, { market: 'spot', endpoint: 'trade' })

        tradesWs.onopen = () => {
          console.log('Trades stream connected for', coinSymbol)
        }

        tradesWs.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data)
            if (payload?.type) {
              if (payload.type === 'error') {
                console.error('Trades stream error message:', payload.message)
              }
              return
            }

            const tradeData = payload.data ?? payload
            if (!tradeData || tradeData.e !== 'trade') return

            const price = parseFloat(tradeData.p || '0')
            const quantity = parseFloat(tradeData.q || '0')
            const quoteAmount = price * quantity
            const tradeTime = tradeData.T || tradeData.E || Date.now()
            const isBuy = !tradeData.m

            if (isBuy) {
              spotBuyVolumeRef.current += quoteAmount
            } else {
              spotSellVolumeRef.current += quoteAmount
            }

            if (coinDataRef.current) {
              const updatedCoinData: CoinData = {
                ...coinDataRef.current,
                spotBuyVolume: spotBuyVolumeRef.current.toString(),
                spotSellVolume: spotSellVolumeRef.current.toString(),
              }
              coinDataRef.current = updatedCoinData
            }

            const tradeId = tradeData.t || `${tradeTime}-${Math.random().toString(36).substring(2, 9)}`

            const trade: Trade = {
              id: tradeId,
              price,
              quantity,
              quoteAmount,
              time: tradeTime,
              isBuy,
            }

            if (isBuy) {
              setBuyTrades((prev) => {
                const newTrades = [trade, ...prev].slice(0, 25)
                return newTrades
              })
            } else {
              setSellTrades((prev) => {
                const newTrades = [trade, ...prev].slice(0, 25)
                return newTrades
              })
            }
          } catch (error) {
            console.error('Trades stream parse error:', error)
          }
        }

        tradesWs.onerror = (error) => {
          console.error('Trades stream error:', error)
        }

        tradesWsRef.current = tradesWs
      } catch (error) {
        console.error('Failed to create Trades stream:', error)
      }

      // Futures Trades WebSocket
      try {
        const futuresTradesWs = createBinanceEventSource(futuresTradesStream, { market: 'futures', endpoint: 'trade' })

        futuresTradesWs.onopen = () => {
          console.log('Futures trades stream connected for', coinSymbol)
        }

        futuresTradesWs.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data)
            if (payload?.type) {
              if (payload.type === 'error') {
                console.error('Futures trades stream error message:', payload.message)
              }
              return
            }

            const tradeData = payload.data ?? payload
            if (!tradeData || tradeData.e !== 'trade') return

            const price = parseFloat(tradeData.p || '0')
            const quantity = parseFloat(tradeData.q || '0')
            const quoteAmount = price * quantity
            const tradeTime = tradeData.T || tradeData.E || Date.now()
            const isBuy = !tradeData.m

            if (isBuy) {
              futuresBuyVolumeRef.current += quoteAmount
            } else {
              futuresSellVolumeRef.current += quoteAmount
            }

            if (coinDataRef.current) {
              const updatedCoinData: CoinData = {
                ...coinDataRef.current,
                futuresBuyVolume: futuresBuyVolumeRef.current.toString(),
                futuresSellVolume: futuresSellVolumeRef.current.toString(),
              }
              coinDataRef.current = updatedCoinData
            }

            const tradeId = tradeData.t || `${tradeTime}-${Math.random().toString(36).substring(2, 9)}`

            const trade: Trade = {
              id: tradeId,
              price,
              quantity,
              quoteAmount,
              time: tradeTime,
              isBuy,
            }

            if (isBuy) {
              setFuturesBuyTrades((prev) => {
                const newTrades = [trade, ...prev].slice(0, 25)
                return newTrades
              })
            } else {
              setFuturesSellTrades((prev) => {
                const newTrades = [trade, ...prev].slice(0, 25)
                return newTrades
              })
            }
          } catch (error) {
            console.error('Futures trades stream parse error:', error)
          }
        }

        futuresTradesWs.onerror = (error) => {
          console.error('Futures trades stream error:', error)
        }

        futuresTradesWsRef.current = futuresTradesWs
      } catch (error) {
        console.error('Failed to create Futures trades stream:', error)
      }
    }

    fetchInitialData()

        return () => {
          // Cleanup: close WebSockets on unmount
          if (wsRef.current) {
            try {
              wsRef.current.onmessage = null
              wsRef.current.onerror = null
              wsRef.current.onopen = null
              wsRef.current.close()
            } catch (error) {
              console.error('Error closing spot stream:', error)
            }
            wsRef.current = null
          }
          if (futuresWsRef.current) {
            try {
              futuresWsRef.current.onmessage = null
              futuresWsRef.current.onerror = null
              futuresWsRef.current.onopen = null
              futuresWsRef.current.close()
            } catch (error) {
              console.error('Error closing futures stream:', error)
            }
            futuresWsRef.current = null
          }
          if (tradesWsRef.current) {
            try {
              tradesWsRef.current.onmessage = null
              tradesWsRef.current.onerror = null
              tradesWsRef.current.onopen = null
              tradesWsRef.current.close()
            } catch (error) {
              console.error('Error closing trades stream:', error)
            }
            tradesWsRef.current = null
          }
          if (futuresTradesWsRef.current) {
            try {
              futuresTradesWsRef.current.onmessage = null
              futuresTradesWsRef.current.onerror = null
              futuresTradesWsRef.current.onopen = null
              futuresTradesWsRef.current.close()
            } catch (error) {
              console.error('Error closing futures trades stream:', error)
            }
            futuresTradesWsRef.current = null
          }
        }
  }, [symbol, isPremium, checkingPremium])

  console.log('Render - loading:', loading, 'coinData:', coinData ? 'exists' : 'null', 'error:', error, 'symbol:', symbol, 'isPremium:', isPremium, 'checkingPremium:', checkingPremium)
  
  // Check premium status first - don't show anything if not premium
  if (checkingPremium) {
    return (
      <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center py-12 text-muted-foreground">Yükleniyor...</div>
      </div>
    )
  }

  if (!isPremium) {
    return (
      <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <div className="bg-card border border-border rounded-lg p-12 max-w-md w-full text-center shadow-lg">
            <Lock className="h-16 w-16 mx-auto mb-6 text-muted-foreground" />
            <h2 className="text-2xl font-bold mb-4">Premium Özellik</h2>
            <p className="text-muted-foreground mb-6">
              Bu özellik sadece premium üyelerimize özeldir. Detaylı coin analizlerine erişmek için premium üyeliğe geçin.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button asChild className="cursor-pointer">
                <Link href="/checkout">Premium'a Geçiş Yap</Link>
              </Button>
              <Button asChild variant="outline" className="cursor-pointer">
                <Link href="/premium">Premium Hakkında</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }
  
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

  const formatKlineData = (klines: CoinData['klines'], futuresKlines: CoinData['futuresKlines'] = [], timeRangeValue: string = '1D') => {
    // Create a map of futures klines by time for quick lookup
    const futuresMap = new Map<number, { volume: number, buyVolume?: number, sellVolume?: number }>()
    futuresKlines.forEach(fk => {
      futuresMap.set(fk.time, {
        volume: fk.volume,
        buyVolume: fk.buyVolume,
        sellVolume: fk.sellVolume,
      })
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
      } else if (timeRangeValue === '1M' || timeRangeValue === '5M' || timeRangeValue === '15M' || timeRangeValue === '30M') {
        // Minute ranges - show hour:minute:second
        timeFormat = new Date(k.time).toLocaleTimeString('tr-TR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      } else {
        // 1D
        timeFormat = new Date(k.time).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
        })
      }
      
      // Find matching futures data by time (closest match)
      const futuresData = futuresMap.get(k.time) || { volume: 0, buyVolume: 0, sellVolume: 0 }
      
      return {
        time: timeFormat,
        timestamp: k.time,
        price: k.close,
        open: k.open,
        high: k.high,
        low: k.low,
        close: k.close,
        volume: k.volume, // Spot toplam volume
        buyVolume: k.buyVolume || 0, // Spot alış hacmi
        sellVolume: k.sellVolume || 0, // Spot satış hacmi
        futuresVolume: futuresData.volume, // Futures toplam volume
        futuresBuyVolume: futuresData.buyVolume || 0, // Futures alış hacmi
        futuresSellVolume: futuresData.sellVolume || 0, // Futures satış hacmi
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

  // Only format and calculate if we have data for top chart
  const chartDataTop = chartKlinesTop.length > 0 ? formatKlineData(chartKlinesTop, chartFuturesKlinesTop, timeRangeTop) : []
  const priceChange = chartDataTop.length > 0 && chartDataTop[0] ? 
    ((chartDataTop[chartDataTop.length - 1].close - chartDataTop[0].open) / chartDataTop[0].open) * 100 : 0
  const isChartPositive = priceChange >= 0
  
  // Only format and calculate if we have data for bottom chart
  const chartDataBottom = chartKlinesBottom.length > 0 ? formatKlineData(chartKlinesBottom, chartFuturesKlinesBottom, timeRangeBottom) : []
  
  // Memoize chart data to prevent unnecessary re-renders
  const memoizedChartDataTop = chartDataTop
  const memoizedChartDataBottom = chartDataBottom

  const timeRangeOptions: Array<{ label: string; value: '1M' | '5M' | '15M' | '30M' | '1D' | '7D' | '30D' | '90D' | '1Y' }> = [
    { label: '5 Dakika', value: '5M' },
    { label: '15 Dakika', value: '15M' },
    { label: '30 Dakika', value: '30M' },
    { label: '24 Saat', value: '1D' },
    { label: '7 Gün', value: '7D' },
    { label: '30 Gün', value: '30D' },
    { label: '90 Gün', value: '90D' },
    { label: '1 Yıl', value: '1Y' },
  ]

  const volumeChange = (() => {
    if (!chartDataBottom.length) return 0
    const first = chartDataBottom[0]
    const last = chartDataBottom[chartDataBottom.length - 1]

    const initialVolume = (first.volume ?? 0) + (first.futuresVolume ?? 0)
    const finalVolume = (last.volume ?? 0) + (last.futuresVolume ?? 0)

    if (initialVolume === 0) {
      if (finalVolume === 0) return 0
      return finalVolume > 0 ? 100 : -100
    }

    return ((finalVolume - initialVolume) / initialVolume) * 100
  })()
  const isBottomChartPositive = volumeChange >= 0

  return (
    <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Premium Uyarı Kartı - Premium olmayan kullanıcılar için */}
      {!isPremium && (
        <Card className="mb-6 glass-effect border-primary/30 bg-gradient-to-br from-primary/10 to-primary/5 shadow-lg">
          <CardContent className="pt-6 pb-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <div className="relative">
                  <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse" />
                  <Lock className="h-8 w-8 text-primary relative z-10" />
                </div>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Crown className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-bold gradient-text">Premium Özellik</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Coin detayı ve gelişmiş grafik analizi sadece Premium üyelerimize özeldir. Detaylı coin analitiği, grafikler, alım-satım hacim ayrıştırması ve trade takibi gibi profesyonel özelliklere erişmek için Premium'a geçiş yapın.
                </p>
                <div className="flex items-center gap-3">
                  <Button
                    asChild
                    size="sm"
                    className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-white shadow-lg shadow-primary/30 cursor-pointer"
                  >
                    <Link href="/checkout">
                      <Crown className="mr-2 h-4 w-4" />
                      Premium'a Geçiş Yap
                    </Link>
                  </Button>
                  <Link
                    href="/premium"
                    className="text-sm text-primary hover:underline"
                  >
                    Premium özellikler hakkında daha fazla bilgi →
                  </Link>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Premium olmayan kullanıcılar için blur overlay */}
      <div className={`relative ${!isPremium ? 'blur-md pointer-events-none select-none' : ''}`}>
        {!isPremium && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/85 backdrop-blur-sm">
            <div className="text-center p-8 max-w-md">
              <div className="relative inline-block mb-6">
                <div className="absolute inset-0 bg-primary/40 rounded-full blur-3xl animate-pulse scale-150" />
                <Lock className="h-24 w-24 text-primary relative z-10 mx-auto drop-shadow-2xl" />
              </div>
              <h3 className="text-3xl font-bold gradient-text mb-3">Premium Özellik</h3>
              <p className="text-muted-foreground mb-2 text-base">
                Bu özellik sadece Premium üyelerimize özeldir
              </p>
              <p className="text-sm text-muted-foreground/80 mb-6">
                Detaylı coin analitiği, gelişmiş grafikler ve profesyonel araçlara erişmek için Premium'a geçiş yapın
              </p>
              <Button
                asChild
                size="lg"
                className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-white shadow-lg shadow-primary/30 cursor-pointer"
              >
                <Link href="/checkout">
                  <Crown className="mr-2 h-5 w-5" />
                  Premium'a Geçiş Yap
                </Link>
              </Button>
              <div className="mt-4">
                <Link
                  href="/premium"
                  className="text-sm text-primary hover:underline"
                >
                  Premium özellikler hakkında daha fazla bilgi →
                </Link>
              </div>
            </div>
          </div>
        )}

        <div className={`mb-8 p-6 rounded-xl transition-all duration-300 flash-soft ${flashAnimations.price === 'up' ? 'flash-soft-up' : flashAnimations.price === 'down' ? 'flash-soft-down' : ''}`}>
        <h1 className="text-3xl font-bold mb-4 flex flex-col sm:flex-row sm:items-center gap-2">
          {isPositive ? (
            <TrendingUp className="h-8 w-8 text-green-400" />
          ) : (
            <TrendingDown className="h-8 w-8 text-red-400" />
          )}
          {coinData.symbol}
        </h1>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <div className={`text-3xl font-bold ${
            flashAnimations.price === 'up' ? 'text-green-300' : 
            flashAnimations.price === 'down' ? 'text-red-300' : 
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
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-6">
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
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">24 Saatlik Spot Hacim</span>
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
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">24 Saatlik Vadeli Hacim</span>
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

          <Card className="bg-gradient-to-br from-background to-background/80 border-border/50">
            <CardHeader>
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-2xl mb-1">Fiyat Grafiği</CardTitle>
                  <CardDescription>
                    {timeRangeTop === '5M' && 'Son 5 dakika fiyat hareketleri'}
                    {timeRangeTop === '15M' && 'Son 15 dakika fiyat hareketleri'}
                    {timeRangeTop === '30M' && 'Son 30 dakika fiyat hareketleri'}
                    {timeRangeTop === '1D' && '24 saatlik fiyat hareketleri'}
                    {timeRangeTop === '7D' && '7 günlük fiyat hareketleri'}
                    {timeRangeTop === '30D' && '30 günlük fiyat hareketleri'}
                    {timeRangeTop === '90D' && '90 günlük fiyat hareketleri'}
                    {timeRangeTop === '1Y' && '1 yıllık fiyat hareketleri'}
                  </CardDescription>
                </div>
                <div className="flex flex-col md:flex-row md:items-center gap-4 w-full lg:w-auto">
                  <div className="w-full md:w-auto">
                    <div className="md:hidden">
                      <select
                        value={timeRangeTop}
                        onChange={(event) => setTimeRangeTop(event.target.value as typeof timeRangeTop)}
                        className="w-full rounded-lg border border-border/50 bg-background/70 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        {timeRangeOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="hidden md:flex gap-2 bg-background/50 p-1 rounded-lg border border-border/50">
                      {timeRangeOptions.map((option) => (
                        <button
                          key={option.value}
                          onClick={() => setTimeRangeTop(option.value)}
                          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all cursor-pointer ${
                            timeRangeTop === option.value
                              ? 'bg-primary text-primary-foreground shadow-sm'
                              : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="text-right md:text-left md:min-w-[120px]">
                    <div className={`text-2xl font-bold ${isChartPositive ? 'text-green-400' : 'text-red-400'}`}>
                      {isChartPositive ? '+' : ''}{priceChange.toFixed(2)}%
                    </div>
                    <div className="text-sm text-muted-foreground">Dönem Değişimi</div>
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-border/50">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 flex-wrap">
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
                      checked={showSpotVolumeTop}
                      onCheckedChange={(checked) => setShowSpotVolumeTop(checked === true)}
                      className="data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
                    />
                    <span className="text-blue-400">Spot Hacim</span>
                  </Label>
                  <Label className="text-sm font-medium text-muted-foreground cursor-pointer flex items-center gap-2">
                    <Checkbox
                      checked={showFuturesVolumeTop}
                      onCheckedChange={(checked) => setShowFuturesVolumeTop(checked === true)}
                      className="data-[state=checked]:bg-purple-500 data-[state=checked]:border-purple-500"
                    />
                    <span className="text-purple-400">Vadeli Hacim</span>
                  </Label>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {chartLoadingTop ? (
                <div className="flex items-center justify-center h-[500px]">
                  <div className="text-muted-foreground">Grafik yükleniyor...</div>
                </div>
              ) : chartDataTop.length === 0 ? (
                <div className="flex items-center justify-center h-[500px]">
                  <div className="text-muted-foreground">Veri yükleniyor...</div>
                </div>
              ) : (
              <ResponsiveContainer width="100%" height={500}>
                <ComposedChart data={memoizedChartDataTop} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
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
                  {showSpotVolumeTop && (
                    <Bar
                      yAxisId="volume"
                      dataKey="volume"
                      fill="url(#volumeGradient)"
                      opacity={0.7}
                      radius={[4, 4, 0, 0]}
                      isAnimationActive={timeRangeTop !== '1D' && timeRangeTop !== '1M' && timeRangeTop !== '5M' && timeRangeTop !== '15M' && timeRangeTop !== '30M'} // Disable animation for real-time updates
                      name="Spot Hacim"
                    />
                  )}
                  {showFuturesVolumeTop && (
                    <Bar
                      yAxisId="volume"
                      dataKey="futuresVolume"
                      fill="url(#futuresVolumeGradient)"
                      opacity={0.7}
                      radius={[4, 4, 0, 0]}
                      isAnimationActive={timeRangeTop !== '1D' && timeRangeTop !== '1M' && timeRangeTop !== '5M' && timeRangeTop !== '15M' && timeRangeTop !== '30M'} // Disable animation for real-time updates
                      name="Vadeli Hacim"
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

      <Card className="mt-6 bg-gradient-to-br from-background to-background/80 border-border/50">
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <CardTitle className="text-xl">İşlem Hacmi</CardTitle>
                  <CardDescription>
                    {timeRangeBottom === '5M' && 'Son 5 dakika hacim dağılımı'}
                    {timeRangeBottom === '15M' && 'Son 15 dakika hacim dağılımı'}
                    {timeRangeBottom === '30M' && 'Son 30 dakika hacim dağılımı'}
                    {timeRangeBottom === '1D' && '24 saatlik hacim dağılımı'}
                    {timeRangeBottom === '7D' && '7 günlük hacim dağılımı'}
                    {timeRangeBottom === '30D' && '30 günlük hacim dağılımı'}
                    {timeRangeBottom === '90D' && '90 günlük hacim dağılımı'}
                    {timeRangeBottom === '1Y' && '1 yıllık hacim dağılımı'}
                  </CardDescription>
                </div>
                <div className="flex flex-col md:flex-row md:items-center gap-4 w-full lg:w-auto">
                  <div className="w-full md:w-auto">
                    <div className="md:hidden">
                      <select
                        value={timeRangeBottom}
                        onChange={(event) => setTimeRangeBottom(event.target.value as typeof timeRangeBottom)}
                        className="w-full rounded-lg border border-border/50 bg-background/70 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        {timeRangeOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="hidden md:flex gap-2 bg-background/50 p-1 rounded-lg border border-border/50">
                      {timeRangeOptions.map((option) => (
                        <button
                          key={option.value}
                          onClick={() => setTimeRangeBottom(option.value)}
                          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all cursor-pointer ${
                            timeRangeBottom === option.value
                              ? 'bg-primary text-primary-foreground shadow-sm'
                              : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="text-right md:text-left md:min-w-[120px]">
                    <div className={`text-2xl font-bold ${isBottomChartPositive ? 'text-green-400' : 'text-red-400'}`}>
                      {isBottomChartPositive ? '+' : ''}{volumeChange.toFixed(2)}%
                    </div>
                    <div className="text-sm text-muted-foreground">Hacim Değişimi</div>
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-border/50">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 flex-wrap">
                  <Label className="text-sm font-medium text-muted-foreground cursor-pointer flex items-center gap-2">
                    <Checkbox
                      checked={showSpotVolumeBottom}
                      onCheckedChange={(checked) => setShowSpotVolumeBottom(checked === true)}
                      className="data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
                    />
                    <span className="text-blue-400">Spot Hacim</span>
                  </Label>
                  <Label className="text-sm font-medium text-muted-foreground cursor-pointer flex items-center gap-2">
                    <Checkbox
                      checked={showFuturesVolumeBottom}
                      onCheckedChange={(checked) => setShowFuturesVolumeBottom(checked === true)}
                      className="data-[state=checked]:bg-purple-500 data-[state=checked]:border-purple-500"
                    />
                    <span className="text-purple-400">Vadeli Hacim</span>
                  </Label>
                  <Label className="text-sm font-medium text-muted-foreground cursor-pointer flex items-center gap-2">
                    <Checkbox
                      checked={showBuyVolume}
                      onCheckedChange={(checked) => setShowBuyVolume(checked === true)}
                      className="data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
                    />
                    <span className="text-green-400">Alış</span>
                  </Label>
                  <Label className="text-sm font-medium text-muted-foreground cursor-pointer flex items-center gap-2">
                    <Checkbox
                      checked={showSellVolume}
                      onCheckedChange={(checked) => setShowSellVolume(checked === true)}
                      className="data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500"
                    />
                    <span className="text-red-400">Satış</span>
                  </Label>
                </div>
              </div>
              
              {/* Toplam Hacim Bilgileri */}
              {chartKlinesBottom.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border/50">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-background/50 p-3 rounded-lg border border-border/30">
                      <div className="text-xs text-muted-foreground mb-1">Spot Toplam Alış</div>
                      <div className="text-sm font-semibold text-green-400">
                        ${formatNumberTR(totalVolumes.spotBuy)}
                      </div>
                    </div>
                    <div className="bg-background/50 p-3 rounded-lg border border-border/30">
                      <div className="text-xs text-muted-foreground mb-1">Spot Toplam Satış</div>
                      <div className="text-sm font-semibold text-red-400">
                        ${formatNumberTR(totalVolumes.spotSell)}
                      </div>
                    </div>
                    <div className="bg-background/50 p-3 rounded-lg border border-border/30">
                      <div className="text-xs text-muted-foreground mb-1">Vadeli Toplam Alış</div>
                      <div className="text-sm font-semibold text-green-300">
                        ${formatNumberTR(totalVolumes.futuresBuy)}
                      </div>
                    </div>
                    <div className="bg-background/50 p-3 rounded-lg border border-border/30">
                      <div className="text-xs text-muted-foreground mb-1">Vadeli Toplam Satış</div>
                      <div className="text-sm font-semibold text-red-300">
                        ${formatNumberTR(totalVolumes.futuresSell)}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {chartLoadingBottom ? (
                <div className="flex items-center justify-center h-[350px]">
                  <div className="text-muted-foreground">Grafik yükleniyor...</div>
                </div>
              ) : chartDataBottom.length === 0 ? (
                <div className="flex items-center justify-center h-[350px]">
                  <div className="text-muted-foreground">Veri yükleniyor...</div>
                </div>
              ) : (
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={memoizedChartDataBottom} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <defs>
                    <linearGradient id="volumeBarGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgba(96, 165, 250, 0.8)" stopOpacity={1} />
                      <stop offset="100%" stopColor="rgba(96, 165, 250, 0.3)" stopOpacity={1} />
                    </linearGradient>
                    <linearGradient id="futuresVolumeBarGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgba(167, 139, 250, 0.8)" stopOpacity={1} />
                      <stop offset="100%" stopColor="rgba(167, 139, 250, 0.3)" stopOpacity={1} />
                    </linearGradient>
                    {/* Spot alış/satış gradyanları */}
                    <linearGradient id="spotBuyVolumeGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgba(34, 197, 94, 0.8)" stopOpacity={1} />
                      <stop offset="100%" stopColor="rgba(34, 197, 94, 0.3)" stopOpacity={1} />
                    </linearGradient>
                    <linearGradient id="spotSellVolumeGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgba(239, 68, 68, 0.8)" stopOpacity={1} />
                      <stop offset="100%" stopColor="rgba(239, 68, 68, 0.3)" stopOpacity={1} />
                    </linearGradient>
                    {/* Vadeli alış/satış gradyanları */}
                    <linearGradient id="futuresBuyVolumeGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgba(74, 222, 128, 0.8)" stopOpacity={1} />
                      <stop offset="100%" stopColor="rgba(74, 222, 128, 0.3)" stopOpacity={1} />
                    </linearGradient>
                    <linearGradient id="futuresSellVolumeGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgba(248, 113, 113, 0.8)" stopOpacity={1} />
                      <stop offset="100%" stopColor="rgba(248, 113, 113, 0.3)" stopOpacity={1} />
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
                      
                      // Find the data point to get all volume values
                      const dataPoint = memoizedChartDataBottom.find((d: any) => d.time === label)
                      
                      return (
                        <div className="rounded-lg border border-white/10 bg-black/90 p-3 shadow-lg">
                          <p className="mb-2 text-sm text-white/70">{label}</p>
                          
                          {/* Spot Volume Section */}
                          {showSpotVolumeBottom && dataPoint && (
                            <div className={`${showFuturesVolumeBottom ? 'mb-2 pb-2 border-b border-white/10' : ''}`}>
                              <p className="text-xs font-semibold text-blue-400 mb-1">Spot Hacim</p>
                              {(() => {
                                const totalVolume = dataPoint.volume || 0
                                const buyVolume = dataPoint.buyVolume || 0
                                const sellVolume = dataPoint.sellVolume || 0
                                const buyPercentage = totalVolume > 0 ? (buyVolume / totalVolume) * 100 : 0
                                const sellPercentage = totalVolume > 0 ? (sellVolume / totalVolume) * 100 : 0
                                
                                const showBuy = showBuyVolume
                                const showSell = showSellVolume
                                
                                return (
                                  <>
                                    {(showBuy || showSell) && (
                                      <div className="flex items-center justify-between gap-4 text-sm">
                                        <span className="text-white/70">Toplam:</span>
                                        <span className="font-semibold text-blue-400">${formatVolume(totalVolume)}</span>
                                      </div>
                                    )}
                                    {showBuy && (
                                      <div className="flex items-center justify-between gap-4 text-sm">
                                        <span className="text-white/70">Alış:</span>
                                        <span className="font-semibold text-green-400">
                                          ${formatVolume(buyVolume)} ({buyPercentage.toFixed(1)}%)
                                        </span>
                                      </div>
                                    )}
                                    {showSell && (
                                      <div className="flex items-center justify-between gap-4 text-sm">
                                        <span className="text-white/70">Satış:</span>
                                        <span className="font-semibold text-red-400">
                                          ${formatVolume(sellVolume)} ({sellPercentage.toFixed(1)}%)
                                        </span>
                                      </div>
                                    )}
                                  </>
                                )
                              })()}
                            </div>
                          )}
                          
                          {/* Futures Volume Section */}
                          {showFuturesVolumeBottom && dataPoint && (
                            <div>
                              <p className="text-xs font-semibold text-purple-400 mb-1">Vadeli Hacim</p>
                              {(() => {
                                const totalVolume = dataPoint.futuresVolume || 0
                                const buyVolume = dataPoint.futuresBuyVolume || 0
                                const sellVolume = dataPoint.futuresSellVolume || 0
                                const buyPercentage = totalVolume > 0 ? (buyVolume / totalVolume) * 100 : 0
                                const sellPercentage = totalVolume > 0 ? (sellVolume / totalVolume) * 100 : 0
                                
                                const showBuy = showBuyVolume
                                const showSell = showSellVolume
                                
                                return (
                                  <>
                                    {(showBuy || showSell) && (
                                      <div className="flex items-center justify-between gap-4 text-sm">
                                        <span className="text-white/70">Toplam:</span>
                                        <span className="font-semibold text-purple-400">${formatVolume(totalVolume)}</span>
                                      </div>
                                    )}
                                    {showBuy && (
                                      <div className="flex items-center justify-between gap-4 text-sm">
                                        <span className="text-white/70">Alış:</span>
                                        <span className="font-semibold text-green-300">
                                          ${formatVolume(buyVolume)} ({buyPercentage.toFixed(1)}%)
                                        </span>
                                      </div>
                                    )}
                                    {showSell && (
                                      <div className="flex items-center justify-between gap-4 text-sm">
                                        <span className="text-white/70">Satış:</span>
                                        <span className="font-semibold text-red-300">
                                          ${formatVolume(sellVolume)} ({sellPercentage.toFixed(1)}%)
                                        </span>
                                      </div>
                                    )}
                                  </>
                                )
                              })()}
                            </div>
                          )}
                        </div>
                      )
                    }}
                  />
                  {showSpotVolumeBottom && (
                    <>
                      {showBuyVolume && (
                        <Bar 
                          dataKey="buyVolume" 
                          stackId="spot"
                          fill="url(#spotBuyVolumeGradient)"
                          radius={[0, 0, 0, 0]}
                          isAnimationActive={timeRangeBottom !== '1D' && timeRangeBottom !== '1M' && timeRangeBottom !== '5M' && timeRangeBottom !== '15M' && timeRangeBottom !== '30M'}
                          animationDuration={800}
                          name="Spot Alış"
                        />
                      )}
                      {showSellVolume && (
                        <Bar 
                          dataKey="sellVolume" 
                          stackId="spot"
                          fill="url(#spotSellVolumeGradient)"
                          radius={showBuyVolume ? [0, 0, 0, 0] : [8, 8, 0, 0]}
                          isAnimationActive={timeRangeBottom !== '1D' && timeRangeBottom !== '1M' && timeRangeBottom !== '5M' && timeRangeBottom !== '15M' && timeRangeBottom !== '30M'}
                          animationDuration={800}
                          name="Spot Satış"
                        />
                      )}
                    </>
                  )}
                  {showFuturesVolumeBottom && (
                    <>
                      {showBuyVolume && (
                        <Bar 
                          dataKey="futuresBuyVolume" 
                          stackId="futures"
                          fill="url(#futuresBuyVolumeGradient)"
                          radius={[0, 0, 0, 0]}
                          isAnimationActive={timeRangeBottom !== '1D' && timeRangeBottom !== '1M' && timeRangeBottom !== '5M' && timeRangeBottom !== '15M' && timeRangeBottom !== '30M'}
                          animationDuration={800}
                          name="Vadeli Alış"
                        />
                      )}
                      {showSellVolume && (
                        <Bar 
                          dataKey="futuresSellVolume" 
                          stackId="futures"
                          fill="url(#futuresSellVolumeGradient)"
                          radius={showBuyVolume ? [0, 0, 0, 0] : [8, 8, 0, 0]}
                          isAnimationActive={timeRangeBottom !== '1D' && timeRangeBottom !== '1M' && timeRangeBottom !== '5M' && timeRangeBottom !== '15M' && timeRangeBottom !== '30M'}
                          animationDuration={800}
                          name="Vadeli Satış"
                        />
                      )}
                    </>
                  )}
                </BarChart>
              </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Spot Trades Tables */}
          <div className="mt-8">
            <h3 className="text-2xl font-bold mb-6 gradient-text">Spot İşlemler Tradeleri</h3>
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-green-400" />
                    Spot Alış Emirleri
                  </CardTitle>
                  <CardDescription>Son 20 spot alış emri (gerçek zamanlı)</CardDescription>
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
                  Spot Satış Emirleri
                </CardTitle>
                <CardDescription>Son 20 spot satış emri (gerçek zamanlı)</CardDescription>
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

          {/* Futures Trades Tables */}
          <div className="mt-8">
            <h3 className="text-2xl font-bold mb-6 gradient-text">Vadeli İşlemler Tradeleri</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-green-400" />
                    Vadeli Alış Emirleri
                  </CardTitle>
                  <CardDescription>Son 20 vadeli alış emri (gerçek zamanlı)</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-[500px] overflow-y-auto">
                    {futuresBuyTrades.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        Henüz vadeli alış emri yok
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
                          {futuresBuyTrades.map((trade, index) => (
                            <tr key={`futures-buy-${trade.id}-${trade.time}-${index}`} className="border-b border-border/30 hover:bg-green-500/5 transition-colors">
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
                    Vadeli Satış Emirleri
                  </CardTitle>
                  <CardDescription>Son 20 vadeli satış emri (gerçek zamanlı)</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-[500px] overflow-y-auto">
                    {futuresSellTrades.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        Henüz vadeli satış emri yok
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
                          {futuresSellTrades.map((trade, index) => (
                            <tr key={`futures-sell-${trade.id}-${trade.time}-${index}`} className="border-b border-border/30 hover:bg-red-500/5 transition-colors">
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
        </div>
      </div>
  )
}

