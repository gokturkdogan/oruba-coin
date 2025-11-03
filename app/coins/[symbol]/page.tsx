'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'
import { TrendingUp, TrendingDown, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

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
  klines: Array<{
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
          console.log('Setting initial coin data...')
          setCoinData(data)
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
              const updatedCoinData: CoinData = {
                ...currentCoinData,
                price: data.c || data.lastPrice || currentCoinData.price,
                priceChangePercent: data.P || data.priceChangePercent || currentCoinData.priceChangePercent,
                volume: data.v || data.volume || currentCoinData.volume,
                quoteVolume: data.q || data.quoteVolume || currentCoinData.quoteVolume,
                highPrice: data.h || data.highPrice || currentCoinData.highPrice,
                lowPrice: data.l || data.lowPrice || currentCoinData.lowPrice,
                openPrice: data.o || data.openPrice || currentCoinData.openPrice,
                prevClosePrice: data.x || data.prevClosePrice || currentCoinData.prevClosePrice,
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
                    id: data.t || Date.now(),
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
            wsRef.current.close()
            wsRef.current = null
          }
          if (futuresWsRef.current) {
            futuresWsRef.current.close()
            futuresWsRef.current = null
          }
          if (tradesWsRef.current) {
            tradesWsRef.current.close()
            tradesWsRef.current = null
          }
        }
  }, [symbol])

  console.log('Render - loading:', loading, 'coinData:', coinData ? 'exists' : 'null', 'error:', error, 'symbol:', symbol)
  
  if (loading) {
    return (
      <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center py-12 text-muted-foreground">Loading coin data...</div>
      </div>
    )
  }

  // Only show error/not found if loading is complete and we have an error or no data
  if (!coinData && error) {
    return (
      <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold mb-4">Coin not found</h1>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button asChild>
            <Link href="/coins">Back to Coins</Link>
          </Button>
        </div>
      </div>
    )
  }
  
  // If still loading (shouldn't happen but just in case)
  if (!coinData) {
    return (
      <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center py-12 text-muted-foreground">Loading coin data...</div>
      </div>
    )
  }

  const change = parseFloat(coinData.priceChangePercent)
  const isPositive = change >= 0

  const formatKlineData = (klines: CoinData['klines']) => {
    return klines.map((k) => ({
      time: new Date(k.time).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      price: k.close,
      volume: k.volume,
    }))
  }

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
          <div className={`text-3xl font-bold flex items-center gap-2 ${
            flashAnimations.price === 'up' ? 'text-green-400' : 
            flashAnimations.price === 'down' ? 'text-red-400' : 
            ''
          }`}>
            {flashAnimations.price === 'up' ? (
              <TrendingUp className="h-6 w-6" />
            ) : flashAnimations.price === 'down' ? (
              <TrendingDown className="h-6 w-6" />
            ) : null}
            ${parseFloat(coinData.price).toLocaleString('en-US', {
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

      <div className="grid gap-6 md:grid-cols-2 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Market Data</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className={`flex justify-between items-center p-3 rounded-lg transition-all duration-300 border ${
              flashAnimations.price === 'up' ? 'animate-flash-green border-green-500/50' : 
              flashAnimations.price === 'down' ? 'animate-flash-red border-red-500/50' : 
              'bg-transparent border-transparent'
            }`}>
              <span className="text-muted-foreground flex items-center gap-2">
                {flashAnimations.price === 'up' ? (
                  <TrendingUp className="h-4 w-4 text-green-400" />
                ) : flashAnimations.price === 'down' ? (
                  <TrendingDown className="h-4 w-4 text-red-400" />
                ) : (
                  <TrendingUp className="h-4 w-4" />
                )}
                Price
              </span>
              <span className={`font-semibold ${
                flashAnimations.price === 'up' ? 'text-green-400' : 
                flashAnimations.price === 'down' ? 'text-red-400' : 
                ''
              }`}>
                ${parseFloat(coinData.price).toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 6,
                })}
              </span>
            </div>
            <div className={`flex justify-between items-center p-3 rounded-lg transition-all duration-300 border ${
              flashAnimations.highPrice === 'up' ? 'animate-flash-green border-green-500/50' : 
              flashAnimations.highPrice === 'down' ? 'animate-flash-red border-red-500/50' : 
              'bg-transparent border-transparent'
            }`}>
              <span className="text-muted-foreground flex items-center gap-2">
                {flashAnimations.highPrice === 'up' ? (
                  <TrendingUp className="h-4 w-4 text-green-400" />
                ) : flashAnimations.highPrice === 'down' ? (
                  <TrendingDown className="h-4 w-4 text-red-400" />
                ) : (
                  <TrendingUp className="h-4 w-4 text-green-400" />
                )}
                24h High
              </span>
              <span className={`font-semibold ${
                flashAnimations.highPrice === 'up' ? 'text-green-400' : 
                flashAnimations.highPrice === 'down' ? 'text-red-400' : 
                ''
              }`}>
                ${parseFloat(coinData.highPrice).toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 6,
                })}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 rounded-lg bg-transparent">
              <span className="text-muted-foreground flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-red-400" />
                24h Low
              </span>
              <span className="font-semibold">${parseFloat(coinData.lowPrice).toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 6,
              })}</span>
            </div>
            <div className={`flex justify-between items-center p-3 rounded-lg transition-all duration-300 border ${
              flashAnimations.spotVolume === 'up' ? 'animate-flash-green border-green-500/50' : 
              flashAnimations.spotVolume === 'down' ? 'animate-flash-red border-red-500/50' : 
              'bg-transparent border-transparent'
            }`}>
              <span className="text-muted-foreground flex items-center gap-2">
                {flashAnimations.spotVolume === 'up' ? (
                  <TrendingUp className="h-4 w-4 text-green-400" />
                ) : flashAnimations.spotVolume === 'down' ? (
                  <TrendingDown className="h-4 w-4 text-red-400" />
                ) : (
                  <TrendingUp className="h-4 w-4" />
                )}
                24h Spot Volume
              </span>
              <span className={`font-semibold ${
                flashAnimations.spotVolume === 'up' ? 'text-green-400' : 
                flashAnimations.spotVolume === 'down' ? 'text-red-400' : 
                ''
              }`}>
                ${parseFloat(coinData.quoteVolume || '0').toLocaleString('en-US', {
                  maximumFractionDigits: 0,
                })}
              </span>
            </div>
            <div className={`flex justify-between items-center p-3 rounded-lg transition-all duration-300 border ${
              flashAnimations.futuresVolume === 'up' ? 'animate-flash-green border-green-500/50' : 
              flashAnimations.futuresVolume === 'down' ? 'animate-flash-red border-red-500/50' : 
              'bg-transparent border-transparent'
            }`}>
              <span className="text-muted-foreground flex items-center gap-2">
                {flashAnimations.futuresVolume === 'up' ? (
                  <TrendingUp className="h-4 w-4 text-green-400" />
                ) : flashAnimations.futuresVolume === 'down' ? (
                  <TrendingDown className="h-4 w-4 text-red-400" />
                ) : (
                  <TrendingUp className="h-4 w-4" />
                )}
                24h Futures Volume
              </span>
              <span className={`font-semibold ${
                flashAnimations.futuresVolume === 'up' ? 'text-green-400' : 
                flashAnimations.futuresVolume === 'down' ? 'text-red-400' : 
                ''
              }`}>
                ${parseFloat(coinData.futuresQuoteVolume || '0').toLocaleString('en-US', {
                  maximumFractionDigits: 0,
                })}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 rounded-lg bg-transparent">
              <span className="text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Open Price
              </span>
              <span className="font-semibold">${parseFloat(coinData.openPrice).toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 6,
              })}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Statistics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center p-3 rounded-lg bg-transparent">
              <span className="text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Previous Close
              </span>
              <span className="font-semibold">${parseFloat(coinData.prevClosePrice).toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 6,
              })}</span>
            </div>
            <div className={`flex justify-between items-center p-3 rounded-lg transition-all duration-300 ${
              isPositive ? 'bg-green-500/10' : 'bg-red-500/10'
            }`}>
              <span className="text-muted-foreground flex items-center gap-2">
                {isPositive ? (
                  <TrendingUp className="h-4 w-4 text-green-400" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-400" />
                )}
                Price Change
              </span>
              <span className={`font-semibold flex items-center gap-1.5 ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                {isPositive ? (
                  <TrendingUp className="h-4 w-4" />
                ) : (
                  <TrendingDown className="h-4 w-4" />
                )}
                {isPositive ? '+' : ''}
                {(
                  parseFloat(coinData.price) - parseFloat(coinData.prevClosePrice)
                ).toFixed(6)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="hourly" className="w-full">
        <TabsList>
          <TabsTrigger value="hourly">24h Chart</TabsTrigger>
          <TabsTrigger value="daily" disabled={!isPremium}>
            {!isPremium && <Lock className="h-3 w-3 ml-1" />}
            Daily Chart (Premium)
          </TabsTrigger>
        </TabsList>
        <TabsContent value="hourly" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Price Chart (24h)</CardTitle>
              <CardDescription>Hourly price movements</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={formatKlineData(coinData.klines)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="price" stroke="#8884d8" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="daily" className="mt-6">
          {isPremium && coinData.premium?.dailyChart ? (
            <Card>
              <CardHeader>
                <CardTitle>Daily Chart (30 days)</CardTitle>
                <CardDescription>Premium feature - Daily price movements</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart
                    data={coinData.premium.dailyChart.map((k) => ({
                      time: new Date(k.time).toLocaleDateString('en-US'),
                      price: k.close,
                    }))}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="price" stroke="#8884d8" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Lock className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-xl font-semibold mb-2">Premium Feature</h3>
                <p className="text-muted-foreground mb-4">
                  Upgrade to Premium to access daily charts and advanced indicators
                </p>
                <Button asChild>
                  <Link href="/checkout">Upgrade to Premium</Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Volume Chart</CardTitle>
              <CardDescription>24h trading volume</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={formatKlineData(coinData.klines)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="volume" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-2 mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-400" />
                  Alış Emirleri (Buy Orders)
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
                        {buyTrades.map((trade) => (
                          <tr key={trade.id} className="border-b border-border/30 hover:bg-green-500/5 transition-colors">
                            <td className="p-2 text-muted-foreground">
                              {new Date(trade.time).toLocaleTimeString('tr-TR', {
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                              })}
                            </td>
                            <td className="p-2 text-right font-semibold text-green-400">
                              ${trade.price.toLocaleString('en-US', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 8,
                              })}
                            </td>
                            <td className="p-2 text-right text-muted-foreground">
                              {trade.quantity.toLocaleString('en-US', {
                                maximumFractionDigits: 8,
                              })}
                            </td>
                            <td className="p-2 text-right font-semibold text-green-300">
                              ${trade.quoteAmount.toLocaleString('en-US', {
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
                  Satış Emirleri (Sell Orders)
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
                        {sellTrades.map((trade) => (
                          <tr key={trade.id} className="border-b border-border/30 hover:bg-red-500/5 transition-colors">
                            <td className="p-2 text-muted-foreground">
                              {new Date(trade.time).toLocaleTimeString('tr-TR', {
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                              })}
                            </td>
                            <td className="p-2 text-right font-semibold text-red-400">
                              ${trade.price.toLocaleString('en-US', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 8,
                              })}
                            </td>
                            <td className="p-2 text-right text-muted-foreground">
                              {trade.quantity.toLocaleString('en-US', {
                                maximumFractionDigits: 8,
                              })}
                            </td>
                            <td className="p-2 text-right font-semibold text-red-300">
                              ${trade.quoteAmount.toLocaleString('en-US', {
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

