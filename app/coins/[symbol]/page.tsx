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
  const wsRef = useRef<WebSocket | null>(null)
  const futuresWsRef = useRef<WebSocket | null>(null)
  const tradesWsRef = useRef<WebSocket | null>(null)
  const futuresTradesWsRef = useRef<WebSocket | null>(null)
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
    if (chartKlinesBottom.length === 0) {
      return {
        spotBuy: 0,
        spotSell: 0,
        futuresBuy: 0,
        futuresSell: 0,
      }
    }
    
    // Calculate totals from raw klines data
    const spotBuy = chartKlinesBottom.reduce((sum, k) => sum + (k.buyVolume || 0), 0)
    const spotSell = chartKlinesBottom.reduce((sum, k) => sum + (k.sellVolume || 0), 0)
    const futuresBuy = chartFuturesKlinesBottom.reduce((sum, k) => sum + (k.buyVolume || 0), 0)
    const futuresSell = chartFuturesKlinesBottom.reduce((sum, k) => sum + (k.sellVolume || 0), 0)
    
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
      if (futuresTradesWsRef.current && futuresTradesWsRef.current.readyState === WebSocket.OPEN) {
        futuresTradesWsRef.current.close()
        futuresTradesWsRef.current = null
      }

      // Spot WebSocket
      const spotStream = `${coinSymbol.toLowerCase()}@ticker`
      const spotWsUrl = `wss://stream.binance.com:9443/ws/${spotStream}`

      // Futures WebSocket
      const futuresStream = `${coinSymbol.toLowerCase()}@ticker`
      const futuresWsUrl = `wss://fstream.binance.com/ws/${futuresStream}`

      // Trades WebSocket (Spot)
      const tradesStream = `${coinSymbol.toLowerCase()}@trade`
      const tradesWsUrl = `wss://stream.binance.com:9443/ws/${tradesStream}`

      // Futures Trades WebSocket
      const futuresTradesStream = `${coinSymbol.toLowerCase()}@trade`
      const futuresTradesWsUrl = `wss://fstream.binance.com/ws/${futuresTradesStream}`

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
              
              // Update spot buy/sell volumes from ticker data
              const newSpotBuyVolume = parseFloat(data.Q || data.takerBuyQuoteVolume || '0')
              const newSpotQuoteVolume = parseFloat(data.q || data.quoteVolume || currentCoinData.quoteVolume || '0')
              const newSpotSellVolume = newSpotQuoteVolume - newSpotBuyVolume

              // Update buy/sell volumes maintaining ratio if total volume changed
              if (newSpotQuoteVolume > 0 && previousValues.spotVolume !== undefined && previousValues.spotVolume > 0) {
                const volumeRatio = newSpotQuoteVolume / previousValues.spotVolume
                if (volumeRatio > 0.9 && volumeRatio < 1.1) {
                  // Small change, maintain ratio
                  const currentBuyRatio = spotBuyVolumeRef.current / (spotBuyVolumeRef.current + spotSellVolumeRef.current || 1)
                  const currentSellRatio = spotSellVolumeRef.current / (spotBuyVolumeRef.current + spotSellVolumeRef.current || 1)
                  spotBuyVolumeRef.current = newSpotQuoteVolume * currentBuyRatio
                  spotSellVolumeRef.current = newSpotQuoteVolume * currentSellRatio
                } else {
                  // Significant change, use new values
                  spotBuyVolumeRef.current = newSpotBuyVolume > 0 ? newSpotBuyVolume : spotBuyVolumeRef.current
                  spotSellVolumeRef.current = newSpotSellVolume > 0 ? newSpotSellVolume : spotSellVolumeRef.current
                }
              } else if (newSpotBuyVolume > 0) {
                spotBuyVolumeRef.current = newSpotBuyVolume
                spotSellVolumeRef.current = newSpotSellVolume > 0 ? newSpotSellVolume : (newSpotQuoteVolume - newSpotBuyVolume)
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
                spotBuyVolume: spotBuyVolumeRef.current.toString(),
                spotSellVolume: spotSellVolumeRef.current.toString(),
                highPrice: data.h || data.highPrice || currentCoinData.highPrice,
                lowPrice: data.l || data.lowPrice || currentCoinData.lowPrice,
                // Preserve original openPrice and prevClosePrice - do not update from WebSocket
                openPrice: currentCoinData.openPrice,
                prevClosePrice: currentCoinData.prevClosePrice,
                // Preserve futures data
                futuresVolume: currentCoinData.futuresVolume,
                futuresQuoteVolume: currentCoinData.futuresQuoteVolume,
                futuresBuyVolume: currentCoinData.futuresBuyVolume,
                futuresSellVolume: currentCoinData.futuresSellVolume,
              }
              
              // Update previous values
              previousValuesRef.current = {
                ...previousValuesRef.current,
                price: newPrice,
                spotVolume: newSpotVolume,
                highPrice: newHighPrice,
              }
              
              setCoinData(updatedCoinData)
              
              // For 1D or minute time ranges, update chartKlinesTop and chartKlinesBottom with latest data from WebSocket
              if (timeRangeTopRef.current === '1D' || timeRangeTopRef.current === '1M' || timeRangeTopRef.current === '5M' || timeRangeTopRef.current === '15M' || timeRangeTopRef.current === '30M') {
                setChartKlinesTop(prev => {
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
              
              if (timeRangeBottomRef.current === '1D' || timeRangeBottomRef.current === '1M' || timeRangeBottomRef.current === '5M' || timeRangeBottomRef.current === '15M' || timeRangeBottomRef.current === '30M') {
                setChartKlinesBottom(prev => {
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
              
              // Update futures buy/sell volumes from ticker data
              const newFuturesBuyVolume = parseFloat(data.Q || data.takerBuyQuoteVolume || '0')
              const newFuturesQuoteVolume = parseFloat(data.q || data.quoteVolume || currentCoinData.futuresQuoteVolume || '0')
              const newFuturesSellVolume = newFuturesQuoteVolume - newFuturesBuyVolume

              // Update buy/sell volumes maintaining ratio if total volume changed
              if (newFuturesQuoteVolume > 0 && previousValues.futuresVolume !== undefined && previousValues.futuresVolume > 0) {
                const volumeRatio = newFuturesQuoteVolume / previousValues.futuresVolume
                if (volumeRatio > 0.9 && volumeRatio < 1.1) {
                  // Small change, maintain ratio
                  const currentBuyRatio = futuresBuyVolumeRef.current / (futuresBuyVolumeRef.current + futuresSellVolumeRef.current || 1)
                  const currentSellRatio = futuresSellVolumeRef.current / (futuresBuyVolumeRef.current + futuresSellVolumeRef.current || 1)
                  futuresBuyVolumeRef.current = newFuturesQuoteVolume * currentBuyRatio
                  futuresSellVolumeRef.current = newFuturesQuoteVolume * currentSellRatio
                } else {
                  // Significant change, use new values
                  futuresBuyVolumeRef.current = newFuturesBuyVolume > 0 ? newFuturesBuyVolume : futuresBuyVolumeRef.current
                  futuresSellVolumeRef.current = newFuturesSellVolume > 0 ? newFuturesSellVolume : futuresSellVolumeRef.current
                }
              } else if (newFuturesBuyVolume > 0) {
                futuresBuyVolumeRef.current = newFuturesBuyVolume
                futuresSellVolumeRef.current = newFuturesSellVolume > 0 ? newFuturesSellVolume : (newFuturesQuoteVolume - newFuturesBuyVolume)
              }

              // Update coin data with Futures WebSocket data
              const updatedCoinData: CoinData = {
                ...currentCoinData,
                futuresVolume: data.v || data.volume || currentCoinData.futuresVolume || '0',
                futuresQuoteVolume: data.q || data.quoteVolume || currentCoinData.futuresQuoteVolume || '0',
                futuresBuyVolume: futuresBuyVolumeRef.current.toString(),
                futuresSellVolume: futuresSellVolumeRef.current.toString(),
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
                  
                  // Update spot buy/sell volumes based on trade
                  if (isBuy) {
                    spotBuyVolumeRef.current += quoteAmount
                  } else {
                    spotSellVolumeRef.current += quoteAmount
                  }
                  
                  // Update coinData with new volumes - only update ref, don't trigger state update on every trade
                  // State will be updated via ticker WebSocket which is less frequent
                  if (coinDataRef.current) {
                    const updatedCoinData: CoinData = {
                      ...coinDataRef.current,
                      spotBuyVolume: spotBuyVolumeRef.current.toString(),
                      spotSellVolume: spotSellVolumeRef.current.toString(),
                    }
                    coinDataRef.current = updatedCoinData
                    // Don't call setCoinData here - it's too frequent and causes infinite loop
                    // The ticker WebSocket will update the state periodically
                  }
                  
                  // Use trade ID from Binance if available, otherwise generate a unique ID
                  const tradeId = data.t || `${tradeTime}-${Math.random().toString(36).substring(2, 9)}`
                  
                  const trade: Trade = {
                    id: tradeId,
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

      // Futures Trades WebSocket
      try {
        const futuresTradesWs = new WebSocket(futuresTradesWsUrl)

        futuresTradesWs.onopen = () => {
          console.log('Futures Trades WebSocket connected for', coinSymbol)
        }

        futuresTradesWs.onmessage = (event) => {
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
              
              // Update futures buy/sell volumes based on trade
              if (isBuy) {
                futuresBuyVolumeRef.current += quoteAmount
              } else {
                futuresSellVolumeRef.current += quoteAmount
              }
              
              // Update coinData with new volumes - only update ref, don't trigger state update on every trade
              // State will be updated via ticker WebSocket which is less frequent
              if (coinDataRef.current) {
                const updatedCoinData: CoinData = {
                  ...coinDataRef.current,
                  futuresBuyVolume: futuresBuyVolumeRef.current.toString(),
                  futuresSellVolume: futuresSellVolumeRef.current.toString(),
                }
                coinDataRef.current = updatedCoinData
                // Don't call setCoinData here - it's too frequent and causes infinite loop
                // The ticker WebSocket will update the state periodically
              }
            }
          } catch (error) {
            console.error('Error parsing Futures Trades WebSocket message:', error)
          }
        }

        futuresTradesWs.onerror = (error) => {
          console.error('Futures Trades WebSocket error:', error)
        }

        futuresTradesWs.onclose = () => {
          console.log('Futures Trades WebSocket disconnected, reconnecting...')
          setTimeout(() => {
            if (coinDataRef.current) {
              connectWebSocket(coinSymbol)
            }
          }, 3000)
        }

        futuresTradesWsRef.current = futuresTradesWs
      } catch (error) {
        console.error('Failed to create Futures Trades WebSocket:', error)
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
          if (futuresTradesWsRef.current) {
            try {
              futuresTradesWsRef.current.onmessage = null
              futuresTradesWsRef.current.onerror = null
              futuresTradesWsRef.current.onclose = null
              futuresTradesWsRef.current.onopen = null
              if (futuresTradesWsRef.current.readyState === WebSocket.OPEN || futuresTradesWsRef.current.readyState === WebSocket.CONNECTING) {
                futuresTradesWsRef.current.close()
              }
            } catch (error) {
              console.error('Error closing futures trades WebSocket:', error)
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

        <div className={`mb-8 p-6 rounded-xl transition-all duration-300 ${flashAnimations.price === 'up' ? 'animate-flash-green' : flashAnimations.price === 'down' ? 'animate-flash-red' : 'bg-transparent'}`}>
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
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
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
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex gap-2 bg-background/50 p-1 rounded-lg border border-border/50">
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
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex gap-2 bg-background/50 p-1 rounded-lg border border-border/50">
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
              </div>
              <div className="mt-4 pt-4 border-t border-border/50">
                <div className="flex items-center gap-6 flex-wrap">
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
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
      </div>
  )
}

