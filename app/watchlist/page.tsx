'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { TrendingUp, TrendingDown, Star, StarOff, Bell, BellOff } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface Coin {
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
}

interface PriceAlert {
  id: string
  symbol: string
  targetPrice: number
  type: 'above' | 'below'
  isActive: boolean
  triggeredAt: string | null
}

export default function WatchlistPage() {
  const router = useRouter()
  const [watchlist, setWatchlist] = useState<string[]>([])
  const [coins, setCoins] = useState<Coin[]>([])
  const [loading, setLoading] = useState(true)
  const [flashAnimations, setFlashAnimations] = useState<Record<string, 'up' | 'down'>>({})
  const [alerts, setAlerts] = useState<Map<string, PriceAlert[]>>(new Map()) // Map of symbol -> array of alerts
  const alertsRef = useRef<Map<string, PriceAlert[]>>(new Map()) // Ref to keep alerts always in sync
  const [alertModalOpen, setAlertModalOpen] = useState(false)
  const [selectedCoin, setSelectedCoin] = useState<string | null>(null)
  const [targetPrice, setTargetPrice] = useState('')
  const [alertType, setAlertType] = useState<'above' | 'below'>('above')
  const [editingAlertId, setEditingAlertId] = useState<string | null>(null)
  const [editingAlertType, setEditingAlertType] = useState<'above' | 'below'>('above')
  const [coinAlerts, setCoinAlerts] = useState<PriceAlert[]>([])
  const wsRef = useRef<WebSocket | null>(null)
  const futuresWsRef = useRef<WebSocket | null>(null)
  const tradesWsRef = useRef<Map<string, WebSocket>>(new Map())
  const futuresTradesWsRef = useRef<Map<string, WebSocket>>(new Map())
  const coinsMapRef = useRef<Map<string, Coin>>(new Map())
  const previousPricesRef = useRef<Map<string, number>>(new Map())
  const spotBuyVolumeRef = useRef<Map<string, number>>(new Map())
  const spotSellVolumeRef = useRef<Map<string, number>>(new Map())
  const futuresBuyVolumeRef = useRef<Map<string, number>>(new Map())
  const futuresSellVolumeRef = useRef<Map<string, number>>(new Map())
  const isMountedRef = useRef<boolean>(true)

  useEffect(() => {
    isMountedRef.current = true
    fetchWatchlist()

    return () => {
      isMountedRef.current = false
      // Cleanup WebSocket connections
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close()
        wsRef.current = null
      }
      if (futuresWsRef.current && futuresWsRef.current.readyState === WebSocket.OPEN) {
        futuresWsRef.current.close()
        futuresWsRef.current = null
      }
      // Cleanup trade WebSockets
      tradesWsRef.current.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.close()
        }
      })
      tradesWsRef.current.clear()
      futuresTradesWsRef.current.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.close()
        }
      })
      futuresTradesWsRef.current.clear()
    }
  }, [])

  const fetchWatchlist = async () => {
    try {
      const res = await fetch('/api/watchlist')
      if (!res.ok) {
        if (res.status === 401) {
          toast.warning('Takip listesi için giriş yapmanız gerekiyor')
          router.push('/login')
          return
        }
        throw new Error('Failed to fetch watchlist')
      }

      const data = await res.json()
      const symbols = data.watchlist || []
      setWatchlist(symbols)

      if (symbols.length === 0) {
        setLoading(false)
        return
      }

      // Fetch 1-hour data for each coin in watchlist
      const coinDataPromises = symbols.map(async (symbol: string) => {
        try {
          const res = await fetch(`/api/coins/${symbol}`)
          if (res.ok) {
            const data = await res.json()
            // Use 1-hour data if available, otherwise fallback to 24h
            const spotBuyVol = data.spotBuyVolume1h || data.spotBuyVolume || '0'
            const spotSellVol = data.spotSellVolume1h || data.spotSellVolume || '0'
            const futuresBuyVol = data.futuresBuyVolume1h || data.futuresBuyVolume || '0'
            const futuresSellVol = data.futuresSellVolume1h || data.futuresSellVolume || '0'
            
            return {
              symbol: data.symbol,
              price: data.price,
              priceChangePercent: data.priceChangePercent,
              volume: data.volume,
              quoteVolume: data.quoteVolume,
              futuresVolume: data.futuresVolume || '0',
              futuresQuoteVolume: data.futuresQuoteVolume || '0',
              spotBuyVolume: spotBuyVol,
              spotSellVolume: spotSellVol,
              futuresBuyVolume: futuresBuyVol,
              futuresSellVolume: futuresSellVol,
            } as Coin
          }
          return null
        } catch (error) {
          console.error(`Failed to fetch data for ${symbol}:`, error)
          return null
        }
      })

      const coinDataResults = await Promise.all(coinDataPromises)
      const watchlistCoins = coinDataResults.filter((coin): coin is Coin => coin !== null)
      
      // Initialize maps
      coinsMapRef.current.clear()
      previousPricesRef.current.clear()
      spotBuyVolumeRef.current.clear()
      spotSellVolumeRef.current.clear()
      futuresBuyVolumeRef.current.clear()
      futuresSellVolumeRef.current.clear()

      watchlistCoins.forEach((coin: Coin) => {
        coinsMapRef.current.set(coin.symbol, coin)
        previousPricesRef.current.set(coin.symbol, parseFloat(coin.price))
        spotBuyVolumeRef.current.set(coin.symbol, parseFloat(coin.spotBuyVolume || '0'))
        spotSellVolumeRef.current.set(coin.symbol, parseFloat(coin.spotSellVolume || '0'))
        futuresBuyVolumeRef.current.set(coin.symbol, parseFloat(coin.futuresBuyVolume || '0'))
        futuresSellVolumeRef.current.set(coin.symbol, parseFloat(coin.futuresSellVolume || '0'))
      })
      
      setCoins(watchlistCoins)
      
      // Fetch price alerts
      await fetchPriceAlerts()
      
      setLoading(false)
      
      // Subscribe to WebSocket for watchlist symbols
      if (symbols.length > 0) {
        subscribeToWebSocket(symbols)
      }
    } catch (error) {
      console.error('Failed to fetch watchlist:', error)
      toast.error('Takip listesi yüklenirken bir hata oluştu')
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
    
    // Close existing trade WebSockets
    tradesWsRef.current.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close()
      }
    })
    tradesWsRef.current.clear()
    
    futuresTradesWsRef.current.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close()
      }
    })
    futuresTradesWsRef.current.clear()

    if (symbols.length === 0) return

    // Binance allows up to 200 streams in a single connection
    const limitedSymbols = symbols.slice(0, 200).map((s) => s.toUpperCase())
    const streams = limitedSymbols
      .map((s) => `${s.toLowerCase()}@ticker`)
      .join('/')

    // Spot WebSocket
    const spotWsUrl = `wss://stream.binance.com:9443/stream?streams=${streams}`
    // Futures WebSocket
    const futuresWsUrl = `wss://fstream.binance.com/stream?streams=${streams}`

    // Helper function to update coins display
    const updateCoinsDisplay = () => {
      if (!isMountedRef.current) return
      const updatedCoins = Array.from(coinsMapRef.current.values())
      // Sort by symbol to maintain consistent order
      updatedCoins.sort((a, b) => a.symbol.localeCompare(b.symbol))
      setCoins(updatedCoins)
    }

    // Spot WebSocket
    try {
      const spotWs = new WebSocket(spotWsUrl)

      spotWs.onopen = () => {
        console.log('Watchlist Spot WebSocket connected')
      }

      spotWs.onmessage = (event) => {
        if (!isMountedRef.current) return

        try {
          const message = JSON.parse(event.data)
          if (message.stream && message.data) {
            const stream = message.stream
            const data = message.data
            const symbol = stream.split('@')[0].toUpperCase()

            if (isMountedRef.current && coinsMapRef.current.has(symbol)) {
              const existingCoin = coinsMapRef.current.get(symbol)!
              const previousPrice = previousPricesRef.current.get(symbol)
              const currentPrice = parseFloat(data.c || data.lastPrice || '0')

              // Update spot buy/sell volumes from ticker data (but keep existing trade-based volumes)
              const currentSpotBuyVolume = spotBuyVolumeRef.current.get(symbol) || 0
              const currentSpotSellVolume = spotSellVolumeRef.current.get(symbol) || 0

              // Update coin data, preserving futures data
              const updatedCoin: Coin = {
                symbol,
                price: data.c || data.lastPrice || '0',
                priceChangePercent: data.P || data.priceChangePercent || '0',
                volume: data.v || data.volume || '0',
                quoteVolume: data.q || data.quoteVolume || '0',
                futuresVolume: existingCoin.futuresVolume,
                futuresQuoteVolume: existingCoin.futuresQuoteVolume,
                spotBuyVolume: currentSpotBuyVolume.toString(),
                spotSellVolume: currentSpotSellVolume.toString(),
                futuresBuyVolume: existingCoin.futuresBuyVolume,
                futuresSellVolume: existingCoin.futuresSellVolume,
              }

              // Check if price changed and trigger flash animation
              if (
                isMountedRef.current &&
                previousPrice !== undefined &&
                previousPrice !== 0 &&
                currentPrice !== 0 &&
                currentPrice !== previousPrice
              ) {
                const priceDiff = Math.abs(currentPrice - previousPrice)
                const priceChangePercent = (priceDiff / previousPrice) * 100

                if (priceChangePercent >= 0.001 || priceDiff >= 0.00000001) {
                  const flashType = currentPrice > previousPrice ? 'up' : 'down'

                  if (isMountedRef.current) {
                    setFlashAnimations((prev) => ({
                      ...prev,
                      [symbol]: flashType,
                    }))

                    setTimeout(() => {
                      if (isMountedRef.current) {
                        setFlashAnimations((prev) => {
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
              
              // Check price alerts
              console.log(`[PriceAlert] WebSocket price update for ${symbol}:`, currentPrice)
              checkPriceAlert(symbol, currentPrice)
            }
          }
        } catch (error) {
          console.error('Error parsing Spot WebSocket message:', error)
        }
      }

      spotWs.onerror = (error) => {
        console.error('Watchlist Spot WebSocket error:', error)
      }

      spotWs.onclose = () => {
        if (isMountedRef.current && wsRef.current === spotWs) {
          console.log('Watchlist Spot WebSocket disconnected, reconnecting...')
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
      console.error('Failed to create Watchlist Spot WebSocket:', error)
    }

    // Futures WebSocket
    try {
      const futuresWs = new WebSocket(futuresWsUrl)

      futuresWs.onopen = () => {
        console.log('Watchlist Futures WebSocket connected')
      }

      futuresWs.onmessage = (event) => {
        if (!isMountedRef.current) return

        try {
          const message = JSON.parse(event.data)
          if (message.stream && message.data) {
            const stream = message.stream
            const data = message.data
            const symbol = stream.split('@')[0].toUpperCase()

            if (isMountedRef.current && coinsMapRef.current.has(symbol)) {
              const existingCoin = coinsMapRef.current.get(symbol)!

              // Update futures buy/sell volumes from ticker data (but keep existing trade-based volumes)
              const currentFuturesBuyVolume = futuresBuyVolumeRef.current.get(symbol) || 0
              const currentFuturesSellVolume = futuresSellVolumeRef.current.get(symbol) || 0

              // Update coin data, preserving spot data
              const updatedCoin: Coin = {
                symbol,
                price: existingCoin.price,
                priceChangePercent: existingCoin.priceChangePercent,
                volume: existingCoin.volume,
                quoteVolume: existingCoin.quoteVolume,
                futuresVolume: data.v || data.volume || '0',
                futuresQuoteVolume: data.q || data.quoteVolume || '0',
                spotBuyVolume: existingCoin.spotBuyVolume,
                spotSellVolume: existingCoin.spotSellVolume,
                futuresBuyVolume: currentFuturesBuyVolume.toString(),
                futuresSellVolume: currentFuturesSellVolume.toString(),
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
        console.error('Watchlist Futures WebSocket error:', error)
      }

      futuresWs.onclose = () => {
        if (isMountedRef.current && futuresWsRef.current === futuresWs) {
          console.log('Watchlist Futures WebSocket disconnected, reconnecting...')
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
      console.error('Failed to create Watchlist Futures WebSocket:', error)
    }

    // Subscribe to trade WebSockets for each symbol
    limitedSymbols.forEach((symbol) => {
      // Spot Trades WebSocket
      try {
        const tradesWsUrl = `wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@trade`
        const tradesWs = new WebSocket(tradesWsUrl)

        tradesWs.onopen = () => {
          console.log(`Spot Trades WebSocket connected for ${symbol}`)
        }

        tradesWs.onmessage = (event) => {
          if (!isMountedRef.current) return

          try {
            const data = JSON.parse(event.data)
            
            if (data && data.e === 'trade') {
              const price = parseFloat(data.p || '0')
              const quantity = parseFloat(data.q || '0')
              const quoteAmount = price * quantity
              // m: true means buyer is market maker (sell order)
              // m: false means seller is market maker (buy order)
              const isBuy = !data.m
              
              // Update spot buy/sell volumes based on trade
              const currentSpotBuyVolume = spotBuyVolumeRef.current.get(symbol) || 0
              const currentSpotSellVolume = spotSellVolumeRef.current.get(symbol) || 0
              
              if (isBuy) {
                spotBuyVolumeRef.current.set(symbol, currentSpotBuyVolume + quoteAmount)
              } else {
                spotSellVolumeRef.current.set(symbol, currentSpotSellVolume + quoteAmount)
              }
              
              // Update coin data
              if (coinsMapRef.current.has(symbol)) {
                const existingCoin = coinsMapRef.current.get(symbol)!
                const updatedCoin: Coin = {
                  ...existingCoin,
                  spotBuyVolume: spotBuyVolumeRef.current.get(symbol)!.toString(),
                  spotSellVolume: spotSellVolumeRef.current.get(symbol)!.toString(),
                }
                coinsMapRef.current.set(symbol, updatedCoin)
                updateCoinsDisplay()
              }
            }
          } catch (error) {
            console.error(`Error parsing Spot Trades WebSocket message for ${symbol}:`, error)
          }
        }

        tradesWs.onerror = (error) => {
          console.error(`Spot Trades WebSocket error for ${symbol}:`, error)
        }

        tradesWs.onclose = () => {
          if (isMountedRef.current && tradesWsRef.current.has(symbol)) {
            console.log(`Spot Trades WebSocket disconnected for ${symbol}, reconnecting...`)
            setTimeout(() => {
              const currentSymbols = Array.from(coinsMapRef.current.keys())
              if (isMountedRef.current && currentSymbols.includes(symbol)) {
                subscribeToWebSocket(currentSymbols)
              }
            }, 3000)
          }
        }

        tradesWsRef.current.set(symbol, tradesWs)
      } catch (error) {
        console.error(`Failed to create Spot Trades WebSocket for ${symbol}:`, error)
      }

      // Futures Trades WebSocket
      try {
        const futuresTradesWsUrl = `wss://fstream.binance.com/ws/${symbol.toLowerCase()}@trade`
        const futuresTradesWs = new WebSocket(futuresTradesWsUrl)

        futuresTradesWs.onopen = () => {
          console.log(`Futures Trades WebSocket connected for ${symbol}`)
        }

        futuresTradesWs.onmessage = (event) => {
          if (!isMountedRef.current) return

          try {
            const data = JSON.parse(event.data)
            
            if (data && data.e === 'trade') {
              const price = parseFloat(data.p || '0')
              const quantity = parseFloat(data.q || '0')
              const quoteAmount = price * quantity
              // m: true means buyer is market maker (sell order)
              // m: false means seller is market maker (buy order)
              const isBuy = !data.m
              
              // Update futures buy/sell volumes based on trade
              const currentFuturesBuyVolume = futuresBuyVolumeRef.current.get(symbol) || 0
              const currentFuturesSellVolume = futuresSellVolumeRef.current.get(symbol) || 0
              
              if (isBuy) {
                futuresBuyVolumeRef.current.set(symbol, currentFuturesBuyVolume + quoteAmount)
              } else {
                futuresSellVolumeRef.current.set(symbol, currentFuturesSellVolume + quoteAmount)
              }
              
              // Update coin data
              if (coinsMapRef.current.has(symbol)) {
                const existingCoin = coinsMapRef.current.get(symbol)!
                const updatedCoin: Coin = {
                  ...existingCoin,
                  futuresBuyVolume: futuresBuyVolumeRef.current.get(symbol)!.toString(),
                  futuresSellVolume: futuresSellVolumeRef.current.get(symbol)!.toString(),
                }
                coinsMapRef.current.set(symbol, updatedCoin)
                updateCoinsDisplay()
              }
            }
          } catch (error) {
            console.error(`Error parsing Futures Trades WebSocket message for ${symbol}:`, error)
          }
        }

        futuresTradesWs.onerror = (error) => {
          console.error(`Futures Trades WebSocket error for ${symbol}:`, error)
        }

        futuresTradesWs.onclose = () => {
          if (isMountedRef.current && futuresTradesWsRef.current.has(symbol)) {
            console.log(`Futures Trades WebSocket disconnected for ${symbol}, reconnecting...`)
            setTimeout(() => {
              const currentSymbols = Array.from(coinsMapRef.current.keys())
              if (isMountedRef.current && currentSymbols.includes(symbol)) {
                subscribeToWebSocket(currentSymbols)
              }
            }, 3000)
          }
        }

        futuresTradesWsRef.current.set(symbol, futuresTradesWs)
      } catch (error) {
        console.error(`Failed to create Futures Trades WebSocket for ${symbol}:`, error)
      }
    })
  }

  const fetchPriceAlerts = async () => {
    try {
      console.log('[PriceAlert] Fetching alerts...')
      const res = await fetch('/api/price-alert')
      if (res.ok) {
        const data = await res.json()
        console.log('[PriceAlert] API returned alerts:', data.alerts?.length || 0)
        const alertsMap = new Map<string, PriceAlert[]>()
        
        if (data.alerts && Array.isArray(data.alerts) && data.alerts.length > 0) {
          data.alerts.forEach((alert: PriceAlert) => {
            // Normalize symbol to uppercase for consistency
            const symbol = alert.symbol.toUpperCase()
            if (!alertsMap.has(symbol)) {
              alertsMap.set(symbol, [])
            }
            alertsMap.get(symbol)!.push(alert)
            console.log(`[PriceAlert] Added alert for ${symbol}:`, {
              id: alert.id,
              targetPrice: alert.targetPrice,
              type: alert.type,
              isActive: alert.isActive
            })
          })
          
          console.log('[PriceAlert] Loaded alerts for symbols:', Array.from(alertsMap.keys()))
          console.log('[PriceAlert] Map size:', alertsMap.size)
          // Update both state and ref
          alertsRef.current = alertsMap
          setAlerts(alertsMap)
        } else {
          console.log('[PriceAlert] No alerts found')
          alertsRef.current = new Map()
          setAlerts(new Map())
        }
      } else {
        console.error('[PriceAlert] Failed to fetch:', res.status)
      }
    } catch (error) {
      console.error('[PriceAlert] Failed to fetch price alerts:', error)
    }
  }

  const fetchCoinAlerts = async (symbol: string) => {
    try {
      const res = await fetch(`/api/price-alert/${symbol}`)
      if (res.ok) {
        const data = await res.json()
        setCoinAlerts(data.alerts || [])
      }
    } catch (error) {
      console.error('Failed to fetch coin alerts:', error)
      setCoinAlerts([])
    }
  }

  const createPriceAlert = async () => {
    if (!selectedCoin || !targetPrice) {
      toast.error('Lütfen tüm alanları doldurun')
      return
    }

    const price = parseFloat(targetPrice)
    if (isNaN(price) || price <= 0) {
      toast.error('Geçerli bir fiyat girin')
      return
    }

    try {
      const res = await fetch('/api/price-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: selectedCoin,
          targetPrice: price,
          type: alertType,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        console.log('[PriceAlert] Alert created:', data.alert)
        // Refresh alerts for this coin
        await fetchCoinAlerts(selectedCoin)
        // Refresh all alerts
        await fetchPriceAlerts()
        toast.success('Fiyat alarmı oluşturuldu')
        setTargetPrice('')
        setEditingAlertId(null)
      } else {
        const error = await res.json()
        toast.error(error.error || 'Alarm oluşturulamadı')
      }
    } catch (error) {
      console.error('Failed to create price alert:', error)
      toast.error('Alarm oluşturulamadı')
    }
  }

  const deletePriceAlert = async (alertId: string) => {
    try {
      const res = await fetch(`/api/price-alert/id/${alertId}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        // Refresh alerts for selected coin
        if (selectedCoin) {
          await fetchCoinAlerts(selectedCoin)
        }
        // Refresh all alerts
        await fetchPriceAlerts()
        toast.success('Fiyat alarmı silindi')
      } else {
        toast.error('Alarm silinemedi')
      }
    } catch (error) {
      console.error('Failed to delete price alert:', error)
      toast.error('Alarm silinemedi')
    }
  }

  const updatePriceAlert = async (alertId: string, newTargetPrice: number, newType?: 'above' | 'below') => {
    try {
      const body: any = { targetPrice: newTargetPrice }
      if (newType) {
        body.type = newType
      }
      
      const res = await fetch(`/api/price-alert/id/${alertId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        // Refresh alerts for selected coin
        if (selectedCoin) {
          await fetchCoinAlerts(selectedCoin)
        }
        // Refresh all alerts
        await fetchPriceAlerts()
        toast.success('Fiyat alarmı güncellendi')
        setEditingAlertId(null)
        setTargetPrice('')
      } else {
        const error = await res.json()
        toast.error(error.error || 'Alarm güncellenemedi')
      }
    } catch (error) {
      console.error('Failed to update price alert:', error)
      toast.error('Alarm güncellenemedi')
    }
  }

  const checkPriceAlert = async (symbol: string, currentPrice: number) => {
    // Normalize symbol to uppercase for consistency
    const normalizedSymbol = symbol.toUpperCase()
    
    // Use ref instead of state to get always up-to-date alerts
    const coinAlertsList = alertsRef.current.get(normalizedSymbol) || []
    
    if (coinAlertsList.length === 0) {
      // No alerts for this symbol, skip check silently
      return
    }
    
    console.log(`[PriceAlert] Checking ${coinAlertsList.length} alerts for ${normalizedSymbol}, current price: ${currentPrice}`)

    // Check each active alert for this coin
    for (const alert of coinAlertsList) {
      if (!alert.isActive || alert.triggeredAt) {
        continue
      }

      // Check if price reached target price based on alert type and tolerance
      const priceDiff = Math.abs(currentPrice - alert.targetPrice)
      const tolerance = alert.targetPrice * 0.001
      
      // Check direction and tolerance
      let shouldTrigger = false
      if (alert.type === 'above') {
        // Price should be >= target price (within tolerance)
        shouldTrigger = currentPrice >= (alert.targetPrice - tolerance)
      } else {
        // Price should be <= target price (within tolerance)
        shouldTrigger = currentPrice <= (alert.targetPrice + tolerance)
      }

      // Log when triggering or when close (within 5% of target)
      const percentDiff = (priceDiff / alert.targetPrice) * 100
      if (shouldTrigger || percentDiff < 5) {
        console.log(`[PriceAlert] Alert ${alert.id} check:`, {
          type: alert.type,
          target: alert.targetPrice,
          current: currentPrice,
          diff: priceDiff.toFixed(8),
          tolerance: tolerance.toFixed(8),
          percentDiff: percentDiff.toFixed(2) + '%',
          shouldTrigger
        })
      }

      if (shouldTrigger) {
        try {
          console.log(`[PriceAlert] Triggering alert ${alert.id} for ${symbol}`)
          const res = await fetch('/api/price-alert/trigger', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              symbol,
              currentPrice,
              alertId: alert.id,
            }),
          })

          if (res.ok) {
            const data = await res.json()
            console.log(`[PriceAlert] Trigger response:`, data)
            if (data.triggered) {
              // Refresh alerts to update ref
              await fetchPriceAlerts()
              toast.success(`${symbol} için fiyat alarmı tetiklendi! Email gönderildi.`)
              break // Only trigger one alert at a time
            } else {
              console.log(`[PriceAlert] Alert not triggered: ${data.message || 'Unknown reason'}`)
            }
          } else {
            const errorData = await res.json().catch(() => ({}))
            console.error(`[PriceAlert] Trigger failed:`, res.status, errorData)
          }
        } catch (error) {
          console.error('[PriceAlert] Failed to trigger price alert:', error)
        }
      }
    }
  }

  const removeFromWatchlist = async (symbol: string) => {
    try {
      const res = await fetch(`/api/watchlist?symbol=${symbol}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        setWatchlist((prev) => prev.filter((s) => s !== symbol))
        setCoins((prev) => prev.filter((c) => c.symbol !== symbol))
        // Remove from maps
        coinsMapRef.current.delete(symbol)
        previousPricesRef.current.delete(symbol)
        spotBuyVolumeRef.current.delete(symbol)
        spotSellVolumeRef.current.delete(symbol)
        futuresBuyVolumeRef.current.delete(symbol)
        futuresSellVolumeRef.current.delete(symbol)
        
        // Close trade WebSockets for this symbol
        if (tradesWsRef.current.has(symbol)) {
          const ws = tradesWsRef.current.get(symbol)!
          if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
            ws.close()
          }
          tradesWsRef.current.delete(symbol)
        }
        if (futuresTradesWsRef.current.has(symbol)) {
          const ws = futuresTradesWsRef.current.get(symbol)!
          if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
            ws.close()
          }
          futuresTradesWsRef.current.delete(symbol)
        }
        
        toast.success(`${symbol} takip listesinden çıkarıldı`)
        
        // Reconnect WebSocket with updated symbols
        const remainingSymbols = Array.from(coinsMapRef.current.keys())
        if (remainingSymbols.length > 0) {
          subscribeToWebSocket(remainingSymbols)
        } else {
          // No more symbols, close connections
          if (wsRef.current) {
            wsRef.current.close()
            wsRef.current = null
          }
          if (futuresWsRef.current) {
            futuresWsRef.current.close()
            futuresWsRef.current = null
          }
        }
      } else {
        toast.error('Bir hata oluştu')
      }
    } catch (error) {
      toast.error('Bir hata oluştu')
    }
  }

  const formatPrice = (price: string): string => {
    const num = parseFloat(price)
    if (isNaN(num)) return '0'

    if (num >= 1) {
      return num.toLocaleString('tr-TR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    }

    const decimalPart = num.toString().split('.')[1] || ''
    let leadingZerosCount = 0
    let firstNonZeroIndex = -1

    for (let i = 0; i < decimalPart.length; i++) {
      if (decimalPart[i] === '0') {
        leadingZerosCount++
      } else {
        firstNonZeroIndex = i
        break
      }
    }

    if (leadingZerosCount >= 2) {
      const significantDigitsToShow = 3
      const totalDecimalPlaces = firstNonZeroIndex + significantDigitsToShow
      const rounded = Math.round(num * Math.pow(10, totalDecimalPlaces)) / Math.pow(10, totalDecimalPlaces)
      let formatted = rounded.toFixed(totalDecimalPlaces)
      formatted = formatted.replace(/\.?0+$/, '')
      if (!formatted.includes('.')) {
        formatted = formatted + '.00'
      } else {
        const parts = formatted.split('.')
        let decimalPart = parts[1] || ''
        decimalPart = decimalPart.replace(/0+$/, '')
        formatted = parts[0] + '.' + (decimalPart || '00')
      }
      return formatted
    }

    return num.toLocaleString('tr-TR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 8,
    })
  }

  if (loading) {
    return (
      <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center py-12 text-muted-foreground">Takip listesi yükleniyor...</div>
      </div>
    )
  }

  return (
    <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-glow" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-glow" style={{ animationDelay: '1s' }} />
      </div>

      <div className="relative z-10">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold gradient-text mb-2">Takip Listem</h1>
              <p className="text-muted-foreground">Takip ettiğiniz coinlerin güncel fiyatları ve istatistikleri</p>
            </div>
            {watchlist.length > 0 && (
              <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/30">
                {watchlist.length} / 10
              </Badge>
            )}
          </div>
        </div>

        {watchlist.length === 0 ? (
          <Card className="glass-effect border-white/10 shadow-xl">
            <CardContent className="py-12 text-center">
              <StarOff className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-xl font-semibold mb-2">Takip listeniz boş</h3>
              <p className="text-muted-foreground mb-6">
                Coin listesinden takip etmek istediğiniz coinleri ekleyebilirsiniz
              </p>
              <Button asChild className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 cursor-pointer">
                <Link href="/coins">Coin Listesine Git</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {coins.map((coin) => {
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
                <Card
                  key={coin.symbol}
                  className={`glass-effect border-white/10 shadow-xl hover:shadow-2xl transition-all duration-300 group ${flashClass}`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className={`p-2 rounded-lg ${
                          isPositive ? 'bg-green-500/10' : 'bg-red-500/10'
                        }`}>
                          {isPositive ? (
                            <TrendingUp className={`h-5 w-5 ${isPositive ? 'text-green-400' : 'text-red-400'}`} />
                          ) : (
                            <TrendingDown className={`h-5 w-5 ${isPositive ? 'text-green-400' : 'text-red-400'}`} />
                          )}
                        </div>
                        <div>
                          <CardTitle className="text-xl">{coin.symbol}</CardTitle>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          onClick={async () => {
                            setSelectedCoin(coin.symbol)
                            setTargetPrice('')
                            setAlertType('above')
                            setEditingAlertId(null)
                            setEditingAlertType('above')
                            await fetchCoinAlerts(coin.symbol)
                            setAlertModalOpen(true)
                          }}
                          variant="ghost"
                          size="sm"
                          className={`h-8 w-8 p-0 cursor-pointer ${
                            alerts.has(coin.symbol) && alerts.get(coin.symbol)!.length > 0
                              ? 'text-blue-400 hover:text-blue-300 hover:bg-blue-500/10'
                              : 'text-muted-foreground hover:text-blue-400 hover:bg-blue-500/10'
                          }`}
                          title={alerts.has(coin.symbol) && alerts.get(coin.symbol)!.length > 0 ? 'Fiyat alarmlarını yönet' : 'Fiyat alarmı ekle'}
                        >
                          {alerts.has(coin.symbol) && alerts.get(coin.symbol)!.length > 0 ? (
                            <Bell className="h-4 w-4 fill-blue-400" />
                          ) : (
                            <BellOff className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          onClick={() => removeFromWatchlist(coin.symbol)}
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-yellow-400 hover:text-yellow-300 hover:bg-yellow-500/10 cursor-pointer"
                          title="Takip listesinden çıkar"
                        >
                          <Star className="h-4 w-4 fill-yellow-400" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Fiyat</p>
                      <p className="text-2xl font-bold">
                        ${formatPrice(coin.price)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">24s Değişim</p>
                      <Badge
                        variant={isPositive ? 'default' : 'destructive'}
                        className={`${
                          isPositive
                            ? 'bg-gradient-to-r from-green-500 via-emerald-500 to-green-400 text-white border-0 shadow-lg shadow-green-500/30'
                            : 'bg-gradient-to-r from-red-500 via-rose-500 to-red-400 text-white border-0 shadow-lg shadow-red-500/30'
                        } font-semibold px-3 py-1 flex items-center gap-1.5 w-fit`}
                      >
                        {isPositive ? (
                          <TrendingUp className="h-3.5 w-3.5" />
                        ) : (
                          <TrendingDown className="h-3.5 w-3.5" />
                        )}
                        <span>{isPositive ? '+' : '-'}</span>
                        <span>{changePercent.toFixed(2)}%</span>
                      </Badge>
                    </div>
                    <div className="space-y-3 pt-2 border-t border-white/10">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">24 Saatlik Spot Hacim</p>
                        <p className="text-sm font-medium mb-1.5">
                          ${parseFloat(coin.quoteVolume || '0').toLocaleString('tr-TR', {
                            maximumFractionDigits: 0,
                          })}
                        </p>
                        <div className="flex flex-col gap-1 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-green-400/80">Alış:</span>
                            <span className="text-green-400 font-semibold">
                              ${parseFloat(coin.spotBuyVolume || '0').toLocaleString('tr-TR', {
                                maximumFractionDigits: 0,
                              })}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-red-400/80">Satış:</span>
                            <span className="text-red-400 font-semibold">
                              ${parseFloat(coin.spotSellVolume || '0').toLocaleString('tr-TR', {
                                maximumFractionDigits: 0,
                              })}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">24 Saatlik Vadeli Hacim</p>
                        <p className="text-sm font-medium mb-1.5">
                          ${parseFloat(coin.futuresQuoteVolume || '0').toLocaleString('tr-TR', {
                            maximumFractionDigits: 0,
                          })}
                        </p>
                        <div className="flex flex-col gap-1 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-green-400/80">Alış:</span>
                            <span className="text-green-400 font-semibold">
                              ${parseFloat(coin.futuresBuyVolume || '0').toLocaleString('tr-TR', {
                                maximumFractionDigits: 0,
                              })}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-red-400/80">Satış:</span>
                            <span className="text-red-400 font-semibold">
                              ${parseFloat(coin.futuresSellVolume || '0').toLocaleString('tr-TR', {
                                maximumFractionDigits: 0,
                              })}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    {alerts.has(coin.symbol) && alerts.get(coin.symbol)!.length > 0 && (
                      <div className="pt-2 border-t border-white/10">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Aktif Alarmlar:</span>
                          <Badge variant="secondary" className="bg-blue-500/10 text-blue-400 border-blue-500/30">
                            {alerts.get(coin.symbol)!.length} adet
                          </Badge>
                        </div>
                      </div>
                    )}
                    <Button
                      asChild
                      className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 cursor-pointer mt-2"
                    >
                      <Link href={`/coins/${coin.symbol}`}>Detaylı Görüntüle</Link>
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        {/* Price Alert Modal */}
        <Dialog open={alertModalOpen} onOpenChange={setAlertModalOpen}>
          <DialogContent className="glass-effect border-white/10 max-w-md max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold gradient-text">
                {selectedCoin} Fiyat Alarmları
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                {selectedCoin && `Her coin için maksimum 5 alarm ekleyebilirsiniz. Fiyat hedef fiyata ulaştığında email alacaksınız.`}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              {coinAlerts.length === 0 ? (
                <div className="text-center py-8">
                  <BellOff className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground mb-4">Bu coinde henüz alarmınız yok</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-muted-foreground">Mevcut Alarmlar ({coinAlerts.length} / 5)</p>
                  {coinAlerts.map((alert) => (
                    <div
                      key={alert.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-white/10 bg-muted/20"
                    >
                      {editingAlertId === alert.id ? (
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              step="any"
                              value={targetPrice}
                              onChange={(e) => setTargetPrice(e.target.value)}
                              placeholder="Yeni fiyat"
                              className="flex-1"
                            />
                            <Select
                              value={editingAlertType}
                              onValueChange={(value: 'above' | 'below') => setEditingAlertType(value)}
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="above">Yukarı</SelectItem>
                                <SelectItem value="below">Aşağı</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              onClick={() => {
                                const price = parseFloat(targetPrice)
                                if (!isNaN(price) && price > 0) {
                                  updatePriceAlert(alert.id, price, editingAlertType)
                                }
                              }}
                              disabled={!targetPrice || parseFloat(targetPrice) <= 0}
                              className="cursor-pointer"
                            >
                              Kaydet
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingAlertId(null)
                                setTargetPrice('')
                                setEditingAlertType('above')
                              }}
                              className="cursor-pointer"
                            >
                              İptal
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold">
                                ${parseFloat(alert.targetPrice.toString()).toLocaleString('tr-TR', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 8,
                                })}
                              </p>
                              <Badge variant="secondary" className={`text-xs ${
                                alert.type === 'above' 
                                  ? 'bg-green-500/10 text-green-400 border-green-500/30' 
                                  : 'bg-red-500/10 text-red-400 border-red-500/30'
                              }`}>
                                {alert.type === 'above' ? 'Yukarı' : 'Aşağı'}
                              </Badge>
                            </div>
                            {selectedCoin && coins.find(c => c.symbol === selectedCoin) && (
                              <p className="text-xs text-muted-foreground">
                                Güncel: ${formatPrice(coins.find(c => c.symbol === selectedCoin)!.price)}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditingAlertId(alert.id)
                                setTargetPrice(alert.targetPrice.toString())
                                setEditingAlertType(alert.type)
                              }}
                              className="cursor-pointer"
                            >
                              Düzenle
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => deletePriceAlert(alert.id)}
                              className="text-red-400 hover:text-red-300 hover:bg-red-500/10 cursor-pointer"
                            >
                              Sil
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {coinAlerts.length < 5 && (
                <div className="pt-4 border-t border-white/10">
                  <p className="text-sm font-medium mb-3">Yeni Alarm Ekle</p>
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="alertType" className="text-sm font-medium mb-2 block">
                        Alarm Tipi
                      </Label>
                      <Select
                        value={alertType}
                        onValueChange={(value: 'above' | 'below') => setAlertType(value)}
                        disabled={editingAlertId !== null}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="above">Yukarı (Fiyat yükselince)</SelectItem>
                          <SelectItem value="below">Aşağı (Fiyat düşünce)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="targetPrice" className="text-sm font-medium mb-2 block">
                        Hedef Fiyat (USDT)
                      </Label>
                      <Input
                        id="targetPrice"
                        type="number"
                        step="any"
                        value={targetPrice}
                        onChange={(e) => setTargetPrice(e.target.value)}
                        placeholder="Örn: 50000"
                        className="w-full"
                        disabled={editingAlertId !== null}
                      />
                      {selectedCoin && coins.find(c => c.symbol === selectedCoin) && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Güncel fiyat: ${formatPrice(coins.find(c => c.symbol === selectedCoin)!.price)}
                        </p>
                      )}
                    </div>
                    <Button
                      onClick={createPriceAlert}
                      disabled={!targetPrice || parseFloat(targetPrice) <= 0 || editingAlertId !== null}
                      className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Alarm Ekle
                    </Button>
                  </div>
                </div>
              )}

              {coinAlerts.length >= 5 && (
                <div className="pt-4 border-t border-white/10">
                  <p className="text-sm text-muted-foreground text-center">
                    Bu coin için maksimum 5 alarm sınırına ulaştınız. Yeni alarm eklemek için mevcut alarmlardan birini silin.
                  </p>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setAlertModalOpen(false)
                  setSelectedCoin(null)
                  setTargetPrice('')
                  setAlertType('above')
                  setEditingAlertId(null)
                  setEditingAlertType('above')
                  setCoinAlerts([])
                }}
                className="cursor-pointer"
              >
                Kapat
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}

