'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { StarOff, Lock, Star, TrendingUp, TrendingDown, Bell, BellOff } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface Coin {
  symbol: string
  price: string
  priceChangePercent: string
  quoteVolume: string
  hourlySpotVolume?: string
  hourlySpotBuyVolume?: string
  hourlySpotSellVolume?: string
}

interface PriceAlert {
  id: string
  symbol: string
  market: string
  type: 'above' | 'below'
  targetPrice: number
  isActive: boolean
  triggeredAt: string | null
  createdAt: string
  updatedAt: string
}

export default function SpotWatchlistPage() {
  const router = useRouter()
  const [watchlist, setWatchlist] = useState<string[]>([])
  const [coins, setCoins] = useState<Coin[]>([])
  const [loading, setLoading] = useState(true)
  const [isPremium, setIsPremium] = useState<boolean | null>(null)
  const [checkingPremium, setCheckingPremium] = useState(true)
  const [removeModalOpen, setRemoveModalOpen] = useState(false)
  const [coinToRemove, setCoinToRemove] = useState<string | null>(null)
  const [alerts, setAlerts] = useState<Record<string, PriceAlert[]>>({}) // symbol -> alerts[]
  const [alertModalOpen, setAlertModalOpen] = useState(false)
  const [selectedCoin, setSelectedCoin] = useState<string | null>(null)
  const [alertType, setAlertType] = useState<'above' | 'below'>('above')
  const [targetPrice, setTargetPrice] = useState<string>('')
  const [editingAlert, setEditingAlert] = useState<PriceAlert | null>(null)
  const isMountedRef = useRef<boolean>(true)
  const wsRef = useRef<WebSocket | null>(null) // Spot ticker WebSocket
  const tradesWsRef = useRef<WebSocket | null>(null) // Spot trade WebSocket
  const coinsMapRef = useRef<Map<string, Coin>>(new Map())
  const previousPricesRef = useRef<Map<string, number>>(new Map())
  const hourlyVolumeStartTimeRef = useRef<Map<string, number>>(new Map()) // Her coin için saatlik hacim başlangıç zamanı
  const [flashAnimations, setFlashAnimations] = useState<Record<string, 'up' | 'down'>>({})
  const [pageOpenTime, setPageOpenTime] = useState<number | null>(null) // Sayfa açıldığı zaman (info kutusu için)

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

  // Subscribe to Spot WebSocket for real-time updates
  const subscribeToWebSocket = useCallback((symbols: string[]) => {
    // Close existing connection
    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING) {
        try {
          wsRef.current.onopen = null
          wsRef.current.onerror = null
          wsRef.current.onclose = null
          wsRef.current.onmessage = null
          wsRef.current.close()
        } catch (e) {
          console.error('Error closing Spot WebSocket:', e)
        }
      }
      wsRef.current = null
    }

    if (symbols.length === 0) return

    // Binance allows up to 200 streams in a single connection
    const limitedSymbols = symbols.slice(0, 200).map((s) => s.toUpperCase())
    const streams = limitedSymbols
      .map((s) => `${s.toLowerCase()}@ticker`)
      .join('/')

    // Spot WebSocket URL
    const spotWsUrl = `wss://stream.binance.com/stream?streams=${streams}`

    // Helper function to update coins and trigger re-render
    // No throttling - watchlist has fewer coins, immediate updates are fine
    // Create new array to ensure React detects change
    const updateCoinsDisplay = () => {
      if (!isMountedRef.current) return
      const updatedCoins = Array.from(coinsMapRef.current.values())
      // Create new array reference to force React to detect change
      setCoins([...updatedCoins])
    }

    try {
      const spotWs = new WebSocket(spotWsUrl)
      
      const wsTimeout = setTimeout(() => {
        if (spotWs.readyState === WebSocket.CONNECTING) {
          console.warn('Spot WebSocket connection timeout, closing...')
          try {
            spotWs.close()
          } catch (e) {
            console.error('Error closing timed-out Spot WebSocket:', e)
          }
          
          if (isMountedRef.current && wsRef.current === spotWs) {
            setTimeout(() => {
              const currentSymbols = Array.from(coinsMapRef.current.keys())
              if (isMountedRef.current && currentSymbols.length > 0) {
                subscribeToWebSocket(currentSymbols)
              }
            }, 2000)
          }
        }
      }, 10000)

      spotWs.onopen = () => {
        clearTimeout(wsTimeout)
        console.log('Spot Watchlist WebSocket connected')
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

              // Update quote volume from ticker
              const quoteVolume = parseFloat(data.q || data.quoteVolume || '0')

              // Update coin data - preserve hourly volumes from trade WebSocket
              // EXACTLY like spot-coins: use existingCoin but get latest from map
              const latestCoin = coinsMapRef.current.get(symbol) || existingCoin
              
              const updatedCoin: Coin = {
                symbol,
                price: data.c || data.lastPrice || '0',
                priceChangePercent: data.P || data.priceChangePercent || '0',
                quoteVolume: quoteVolume.toString(),
                hourlySpotVolume: latestCoin.hourlySpotVolume || '0', // Preserve hourly volume from trade WebSocket
                hourlySpotBuyVolume: latestCoin.hourlySpotBuyVolume || '0', // Preserve hourly buy volume from trade WebSocket
                hourlySpotSellVolume: latestCoin.hourlySpotSellVolume || '0', // Preserve hourly sell volume from trade WebSocket
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
        clearTimeout(wsTimeout)
        console.error('Spot WebSocket error:', error)
      }

      spotWs.onclose = (event) => {
        clearTimeout(wsTimeout)
        if (isMountedRef.current && wsRef.current === spotWs) {
          console.log('Spot WebSocket disconnected, reconnecting...', event.code, event.reason)
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
  }, [])

  // Subscribe to Spot Trade WebSocket for hourly volume tracking
  const subscribeToTradeWebSocket = useCallback((symbols: string[]) => {
    // Close existing trade WebSocket
    if (tradesWsRef.current) {
      if (tradesWsRef.current.readyState === WebSocket.OPEN || tradesWsRef.current.readyState === WebSocket.CONNECTING) {
        try {
          tradesWsRef.current.onopen = null
          tradesWsRef.current.onerror = null
          tradesWsRef.current.onclose = null
          tradesWsRef.current.onmessage = null
          tradesWsRef.current.close()
        } catch (e) {
          console.error('Error closing Spot Trade WebSocket:', e)
        }
      }
      tradesWsRef.current = null
    }

    if (symbols.length === 0) return

    // Binance allows up to 200 streams in a single connection
    const limitedSymbols = symbols.slice(0, 200).map((s) => s.toUpperCase())
    const tradeStreams = limitedSymbols
      .map((s) => `${s.toLowerCase()}@trade`)
      .join('/')

    // Spot Trade WebSocket
    const spotTradeWsUrl = `wss://stream.binance.com/stream?streams=${tradeStreams}`

    // Helper function to update coins and trigger re-render (throttled for performance)
    // EXACTLY like spot-coins page - 300ms throttle ensures smooth updates
    let lastUpdateTime = 0
    const updateCoinsDisplay = () => {
      if (!isMountedRef.current) return
      
      const now = Date.now()
      const timeSinceLastUpdate = now - lastUpdateTime
      
      // Throttle: Maksimum 300ms'de bir güncelle (3-4 FPS - smooth)
      if (timeSinceLastUpdate < 300) {
        return
      }
      
      const updatedCoins = Array.from(coinsMapRef.current.values())
      // Create new array reference to force React to detect change
      setCoins([...updatedCoins])
      lastUpdateTime = now
    }

    try {
      const spotTradeWs = new WebSocket(spotTradeWsUrl)
      
      const wsTimeout = setTimeout(() => {
        if (spotTradeWs.readyState === WebSocket.CONNECTING) {
          console.warn('Spot Trade WebSocket connection timeout, closing...')
          try {
            spotTradeWs.close()
          } catch (e) {
            console.error('Error closing timed-out Spot Trade WebSocket:', e)
          }
          
          if (isMountedRef.current && tradesWsRef.current === spotTradeWs) {
            setTimeout(() => {
              const currentSymbols = Array.from(coinsMapRef.current.keys())
              if (isMountedRef.current && currentSymbols.length > 0) {
                subscribeToTradeWebSocket(currentSymbols)
              }
            }, 2000)
          }
        }
      }, 10000)

      spotTradeWs.onopen = () => {
        clearTimeout(wsTimeout)
        console.log('Spot Trade WebSocket connected (watchlist)')
      }

      spotTradeWs.onmessage = (event) => {
        if (!isMountedRef.current) return
        
        try {
          const message = JSON.parse(event.data)
          if (message.stream && message.data) {
            const stream = message.stream
            const data = message.data
            const symbol = stream.split('@')[0].toUpperCase()
            
            // Sadece sayfa açıldıktan sonraki trade'leri işle (başlangıç zamanından sonra)
            const oneHourAgo = hourlyVolumeStartTimeRef.current.get(symbol)
            if (!oneHourAgo) return
            
            const tradeTime = data.T || data.t || 0 // Trade zamanı
            const currentTime = Date.now()
            
            // Trade zamanı başlangıç zamanından sonraki ve şu anki zamandan önceki trade'ler için
            if (tradeTime < oneHourAgo || tradeTime > currentTime) return
            
            if (isMountedRef.current && coinsMapRef.current.has(symbol)) {
              const existingCoin = coinsMapRef.current.get(symbol)!
              
              // Trade bilgilerini al
              const price = parseFloat(data.p || data.price || '0')
              const quantity = parseFloat(data.q || data.quantity || '0')
              const quoteAmount = price * quantity // USDT cinsinden hacim
              
              // isBuyerMaker: false = alış (buy), true = satış (sell)
              const isBuyerMaker = data.m !== undefined ? data.m : (data.isBuyerMaker !== undefined ? data.isBuyerMaker : false)
              
              // Mevcut saatlik hacimleri al
              const currentHourlyVolume = parseFloat(existingCoin.hourlySpotVolume || '0')
              const currentHourlyBuyVolume = parseFloat(existingCoin.hourlySpotBuyVolume || '0')
              const currentHourlySellVolume = parseFloat(existingCoin.hourlySpotSellVolume || '0')
              
              // Yeni trade'i saatlik hacimlere ekle
              let updatedHourlyVolume = currentHourlyVolume + quoteAmount
              let updatedHourlyBuyVolume = currentHourlyBuyVolume
              let updatedHourlySellVolume = currentHourlySellVolume
              
              if (!isBuyerMaker) {
                // Alış trade'i
                updatedHourlyBuyVolume = currentHourlyBuyVolume + quoteAmount
              } else {
                // Satış trade'i
                updatedHourlySellVolume = currentHourlySellVolume + quoteAmount
              }
              
              // Debug log removed - same as spot-coins
              
              // Coin verisini güncelle
              const updatedCoin: Coin = {
                ...existingCoin,
                hourlySpotVolume: updatedHourlyVolume.toFixed(2),
                hourlySpotBuyVolume: updatedHourlyBuyVolume.toFixed(2),
                hourlySpotSellVolume: updatedHourlySellVolume.toFixed(2),
              }
              
              coinsMapRef.current.set(symbol, updatedCoin)
              
              // Debug: Log trade updates (every 20th trade)
              if (Math.random() < 0.05) {
                console.log(`[Watchlist Trade] ${symbol}: +${quoteAmount.toFixed(2)} USDT, Hourly: ${currentHourlyVolume.toFixed(2)} -> ${updatedHourlyVolume.toFixed(2)}`)
              }
              
              updateCoinsDisplay()
            }
          }
        } catch (error) {
          console.error('Error parsing Spot Trade WebSocket message:', error)
        }
      }

      spotTradeWs.onerror = (error) => {
        clearTimeout(wsTimeout)
        console.error('Spot Trade WebSocket error:', error)
      }

      spotTradeWs.onclose = (event) => {
        clearTimeout(wsTimeout)
        if (isMountedRef.current && tradesWsRef.current === spotTradeWs) {
          console.log('Spot Trade WebSocket disconnected, reconnecting...', event.code, event.reason)
          setTimeout(() => {
            const currentSymbols = Array.from(coinsMapRef.current.keys())
            if (isMountedRef.current && currentSymbols.length > 0 && tradesWsRef.current === spotTradeWs) {
              subscribeToTradeWebSocket(currentSymbols)
            }
          }, 3000)
        }
      }

      tradesWsRef.current = spotTradeWs
    } catch (error) {
      console.error('Failed to create Spot Trade WebSocket:', error)
    }
  }, [])

  const fetchWatchlist = useCallback(async () => {
    if (!isMountedRef.current) return
    
    try {
      setLoading(true)
      
      // Fetch watchlist symbols
      const watchlistRes = await fetch('/api/watchlist/spot')
      if (!watchlistRes.ok) {
        if (watchlistRes.status === 401) {
          toast.warning('Takip listesi için giriş yapmanız gerekiyor')
          router.push('/login')
          setLoading(false)
          return
        }
        throw new Error('Failed to fetch watchlist')
      }

      const watchlistData = await watchlistRes.json()
      const symbols = watchlistData.watchlist || []
      
      if (!isMountedRef.current) return
      setWatchlist(symbols)

      if (symbols.length === 0) {
        setCoins([])
        coinsMapRef.current.clear()
        previousPricesRef.current.clear()
        hourlyVolumeStartTimeRef.current.clear()
        setLoading(false)
        return
      }

      // Fetch watchlist coins data from new dedicated endpoint
      const coinsRes = await fetch('/api/watchlist/spot/coins')
      if (!coinsRes.ok) {
        if (coinsRes.status === 401) {
          toast.warning('Takip listesi için giriş yapmanız gerekiyor')
          router.push('/login')
          setLoading(false)
          return
        }
        throw new Error('Failed to fetch watchlist coins')
      }

      const coinsData = await coinsRes.json()
      const watchlistCoins = (coinsData.coins || []).map((coin: any) => ({
        symbol: coin.symbol,
        price: coin.price,
        priceChangePercent: coin.priceChangePercent || '0',
        quoteVolume: coin.quoteVolume || '0',
        hourlySpotVolume: coin.hourlySpotVolume || '0',
        hourlySpotBuyVolume: coin.hourlySpotBuyVolume || '0',
        hourlySpotSellVolume: coin.hourlySpotSellVolume || '0',
      } as Coin))
      
      // Her coin için saatlik hacim başlangıç zamanını kaydet (sayfa açıldığı andan 1 saat öncesi)
      // API'den gelen saatlik hacim, bu zamandan şu ana kadar olan hacim
      // WebSocket'ten gelen yeni trade'ler bu zamandan sonraki olanlar olacak
      const currentTime = Date.now()
      const oneHourAgo = currentTime - (60 * 60 * 1000) // Tam 1 saat önce
      
      // Sayfa açıldığı zamanı kaydet (info kutusu için)
      setPageOpenTime(oneHourAgo)
      
      // Update map and previous prices for WebSocket updates
      coinsMapRef.current.clear()
      previousPricesRef.current.clear()
      hourlyVolumeStartTimeRef.current.clear()
      watchlistCoins.forEach((coin: Coin) => {
        coinsMapRef.current.set(coin.symbol, coin)
        previousPricesRef.current.set(coin.symbol, parseFloat(coin.price))
        // Her coin için saatlik hacim başlangıç zamanını kaydet
        hourlyVolumeStartTimeRef.current.set(coin.symbol, oneHourAgo)
      })
      
      setCoins(watchlistCoins)
      setLoading(false)
      
      // Subscribe to WebSocket for real-time updates
      if (watchlistCoins.length > 0) {
        const symbols = watchlistCoins.map((c: Coin) => c.symbol)
        subscribeToWebSocket(symbols)
        subscribeToTradeWebSocket(symbols)
      }
    } catch (error) {
      console.error('Failed to fetch watchlist:', error)
      if (isMountedRef.current) {
        toast.error('Takip listesi yüklenirken bir hata oluştu')
        setLoading(false)
      }
    }
  }, [router, subscribeToWebSocket, subscribeToTradeWebSocket])

  // Fetch alerts for all coins in watchlist
  const fetchAlerts = useCallback(async () => {
    if (!isMountedRef.current || !isPremium) return
    
    try {
      const res = await fetch('/api/alerts?market=spot')
      if (res.ok) {
        const data = await res.json()
        const alertsArray = data.alerts || []
        
        // Group alerts by symbol
        const alertsBySymbol: Record<string, PriceAlert[]> = {}
        alertsArray.forEach((alert: PriceAlert) => {
          if (!alertsBySymbol[alert.symbol]) {
            alertsBySymbol[alert.symbol] = []
          }
          alertsBySymbol[alert.symbol].push(alert)
        })
        
        if (isMountedRef.current) {
          setAlerts(alertsBySymbol)
        }
      }
    } catch (error) {
      console.error('Failed to fetch alerts:', error)
    }
  }, [isPremium])

  // Open alert modal for creating/editing
  const handleAlertClick = (symbol: string, alert?: PriceAlert) => {
    setSelectedCoin(symbol)
    if (alert) {
      // Existing alert - edit mode
      setEditingAlert(alert)
      setAlertType(alert.type)
      setTargetPrice(alert.targetPrice.toString())
    } else {
      // New alert - check if there are existing alerts for this coin
      const existingAlerts = alerts[symbol] || []
      const hasAbove = existingAlerts.some(a => a.type === 'above' && a.isActive)
      const hasBelow = existingAlerts.some(a => a.type === 'below' && a.isActive)
      
      // If both exist, default to above (user can still change)
      // If one exists, default to the other one
      if (hasAbove && !hasBelow) {
        setAlertType('below')
      } else if (hasBelow && !hasAbove) {
        setAlertType('above')
      } else {
        setAlertType('above') // Default
      }
      
      setEditingAlert(null)
      setTargetPrice('')
    }
    setAlertModalOpen(true)
  }

  // Create or update alert
  const handleSaveAlert = async () => {
    if (!selectedCoin || !targetPrice) {
      toast.error('Lütfen hedef fiyat girin')
      return
    }

    const price = parseFloat(targetPrice)
    if (isNaN(price) || price <= 0) {
      toast.error('Geçerli bir fiyat girin')
      return
    }

    try {
      if (editingAlert) {
        // Update existing alert
        const res = await fetch(`/api/alerts/${editingAlert.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targetPrice: price }),
        })

        if (res.ok) {
          toast.success('Alert güncellendi')
          await fetchAlerts()
          setAlertModalOpen(false)
          setEditingAlert(null)
          setTargetPrice('')
        } else {
          const error = await res.json()
          toast.error(error.error || 'Alert güncellenirken hata oluştu')
        }
      } else {
        // Create new alert
        const res = await fetch('/api/alerts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            symbol: selectedCoin,
            market: 'spot',
            type: alertType,
            targetPrice: price,
          }),
        })

        if (res.ok) {
          toast.success('Alert oluşturuldu')
          await fetchAlerts()
          setAlertModalOpen(false)
          setTargetPrice('')
        } else {
          const error = await res.json()
          toast.error(error.error || 'Alert oluşturulurken hata oluştu')
        }
      }
    } catch (error) {
      console.error('Failed to save alert:', error)
      toast.error('Bir hata oluştu')
    }
  }

  // Delete alert
  const handleDeleteAlert = async (alertId: string) => {
    try {
      const res = await fetch(`/api/alerts/${alertId}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        toast.success('Alert silindi')
        await fetchAlerts()
      } else {
        const error = await res.json()
        toast.error(error.error || 'Alert silinirken hata oluştu')
      }
    } catch (error) {
      console.error('Failed to delete alert:', error)
      toast.error('Bir hata oluştu')
    }
  }

  // Fetch alerts when watchlist changes
  useEffect(() => {
    if (isPremium && !checkingPremium && watchlist.length > 0) {
      fetchAlerts()
    }
  }, [isPremium, checkingPremium, watchlist.length, fetchAlerts])

  useEffect(() => {
    isMountedRef.current = true
    
    // Don't fetch data if not premium or still checking
    if (checkingPremium) {
      return
    }
    
    if (isPremium === false || !isPremium) {
      setLoading(false)
      return
    }
    
    fetchWatchlist()

    return () => {
      isMountedRef.current = false
      
      // Cleanup WebSocket connections
      if (wsRef.current) {
        try {
          wsRef.current.onopen = null
          wsRef.current.onerror = null
          wsRef.current.onclose = null
          wsRef.current.onmessage = null
          if (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING) {
            wsRef.current.close()
          }
        } catch (e) {
          console.error('Error closing WebSocket on cleanup:', e)
        }
        wsRef.current = null
      }
      
      if (tradesWsRef.current) {
        try {
          tradesWsRef.current.onopen = null
          tradesWsRef.current.onerror = null
          tradesWsRef.current.onclose = null
          tradesWsRef.current.onmessage = null
          if (tradesWsRef.current.readyState === WebSocket.OPEN || tradesWsRef.current.readyState === WebSocket.CONNECTING) {
            tradesWsRef.current.close()
          }
        } catch (e) {
          console.error('Error closing Trade WebSocket on cleanup:', e)
        }
        tradesWsRef.current = null
      }
      
      coinsMapRef.current.clear()
      previousPricesRef.current.clear()
      hourlyVolumeStartTimeRef.current.clear()
    }
  }, [checkingPremium, isPremium, fetchWatchlist])

  const removeFromWatchlist = async (symbol: string) => {
    try {
      const res = await fetch(`/api/watchlist/spot?symbol=${symbol}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        setWatchlist((prev) => prev.filter((s) => s !== symbol))
        setCoins((prev) => prev.filter((c) => c.symbol !== symbol))
        // Remove from map and previous prices
        coinsMapRef.current.delete(symbol)
        previousPricesRef.current.delete(symbol)
        toast.success(`${symbol} spot takip listesinden çıkarıldı`)
        setRemoveModalOpen(false)
        setCoinToRemove(null)
      } else {
        toast.error('Bir hata oluştu')
      }
    } catch (error) {
      toast.error('Bir hata oluştu')
    }
  }

  const handleRemoveClick = (symbol: string) => {
    setCoinToRemove(symbol)
    setRemoveModalOpen(true)
  }

  const formatStartTime = (startTime: number | null) => {
    if (!startTime) return null
    
    const startDate = new Date(startTime)
    const startHours = startDate.getHours().toString().padStart(2, '0')
    const startMinutes = startDate.getMinutes().toString().padStart(2, '0')
    
    return `${startHours}:${startMinutes}`
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
              Spot takip listesi özelliği sadece premium üyelerimize özeldir. Coin takibi için premium üyeliğe geçin.
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
                <h1 className="text-4xl font-bold gradient-text mb-2">Spot Takip Listesi</h1>
                <p className="text-muted-foreground">Spot takip listesindeki coinlerin güncel fiyatları ve hacimleri</p>
              </div>
            </div>
          </div>

          {/* Skeleton Loading Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card
                key={i}
                className="glass-effect border-white/10 shadow-xl animate-pulse"
              >
                <CardHeader className="pb-3">
                  <div className="h-6 bg-muted/50 rounded w-24"></div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="h-4 bg-muted/30 rounded w-16 mb-2"></div>
                    <div className="h-8 bg-muted/50 rounded w-32"></div>
                  </div>
                  <div>
                    <div className="h-4 bg-muted/30 rounded w-24 mb-2"></div>
                    <div className="h-6 bg-muted/50 rounded w-40"></div>
                  </div>
                  <div className="h-10 bg-muted/50 rounded mt-2"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
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
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-4xl font-bold gradient-text mb-2">Spot Takip Listesi</h1>
              <p className="text-muted-foreground">Spot takip listesindeki coinlerin güncel fiyatları ve hacimleri</p>
            </div>
            <div className="flex items-start gap-4">
              {watchlist.length > 0 && (
                <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/30">
                  {watchlist.length} / 10
                </Badge>
              )}
              {/* Info Kutusu - Sağ Üst */}
              {pageOpenTime && (
                <Card className="glass-effect border-white/10 min-w-[280px]">
                  <CardContent className="pt-3 pb-3">
                    <div className="flex items-start gap-2">
                      <div className="flex-shrink-0 mt-0.5">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4 text-primary"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-foreground mb-1">
                          Saatlik Hacim Takibi
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatStartTime(pageOpenTime)} saatinden itibaren
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          alınmıştır ve sonrasında gelen tradeler aktif olarak eklenmektedir
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>

        {watchlist.length === 0 ? (
          <Card className="glass-effect border-white/10 shadow-xl">
            <CardContent className="py-12 text-center">
              <StarOff className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-xl font-semibold mb-2">Takip listeniz boş</h3>
              <p className="text-muted-foreground mb-6">
                Spot coin listesinden takip etmek istediğiniz coinleri ekleyebilirsiniz
              </p>
              <Button asChild className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 cursor-pointer">
                <Link href="/spot-coins">Spot Coin Listesine Git</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {coins.map((coin) => {
              return (
                <Card
                  key={coin.symbol}
                  className={`glass-effect border-white/10 shadow-xl hover:shadow-2xl transition-all duration-500 group ${
                    flashAnimations[coin.symbol] === 'up' 
                      ? 'bg-green-500/10 border-green-500/30' 
                      : flashAnimations[coin.symbol] === 'down' 
                      ? 'bg-red-500/10 border-red-500/30' 
                      : ''
                  }`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-xl">{coin.symbol}</CardTitle>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleAlertClick(coin.symbol)}
                          className="p-1.5 rounded-md hover:bg-primary/10 transition-colors cursor-pointer text-primary hover:text-primary/80"
                          title="Fiyat alarmı oluştur/düzenle"
                        >
                          {alerts[coin.symbol] && alerts[coin.symbol].some(a => a.isActive) ? (
                            <Bell className="h-5 w-5 fill-primary" />
                          ) : (
                            <Bell className="h-5 w-5" />
                          )}
                        </button>
                        <button
                          onClick={() => handleRemoveClick(coin.symbol)}
                          className="p-1.5 rounded-md hover:bg-yellow-500/10 transition-colors cursor-pointer text-yellow-400 hover:text-yellow-300"
                          title="Spot takip listesinden çıkar"
                        >
                          <Star className="h-5 w-5 fill-yellow-400" />
                        </button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Fiyat</p>
                      <p className={`text-2xl font-bold transition-colors duration-500 ${
                        flashAnimations[coin.symbol] === 'up' 
                          ? 'text-green-400' 
                          : flashAnimations[coin.symbol] === 'down' 
                          ? 'text-red-400' 
                          : ''
                      }`}>
                        ${formatPrice(coin.price)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">24s Değişim</p>
                      {(() => {
                        const change = parseFloat(coin.priceChangePercent || '0')
                        const isPositive = change >= 0
                        const changePercent = Math.abs(change)
                        return (
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
                        )
                      })()}
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">24 Saatlik Spot Hacim</p>
                      <p className="text-sm font-medium mb-3">
                        ${parseFloat(coin.quoteVolume || '0').toLocaleString('tr-TR', {
                          maximumFractionDigits: 0,
                        })}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Saatlik Spot Hacim</p>
                      <p className="text-sm font-medium mb-1.5">
                        ${parseFloat(coin.hourlySpotVolume || '0').toLocaleString('tr-TR', {
                          maximumFractionDigits: 0,
                        })}
                      </p>
                      <div className="flex flex-col gap-1 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-green-400/80">Alış:</span>
                          <span className="text-green-400 font-semibold">
                            ${parseFloat(coin.hourlySpotBuyVolume || '0').toLocaleString('tr-TR', {
                              maximumFractionDigits: 0,
                            })}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-red-400/80">Satış:</span>
                          <span className="text-red-400 font-semibold">
                            ${parseFloat(coin.hourlySpotSellVolume || '0').toLocaleString('tr-TR', {
                              maximumFractionDigits: 0,
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Aktif Alert'ler */}
                    {alerts[coin.symbol] && alerts[coin.symbol].length > 0 && (
                      <div className="pt-2 border-t border-border/50">
                        <p className="text-xs text-muted-foreground mb-2">Aktif Alarmlar</p>
                        <div className="flex flex-col gap-1.5">
                          {alerts[coin.symbol]
                            .filter((alert) => alert.isActive)
                            .map((alert) => (
                              <div
                                key={alert.id}
                                className="flex items-center justify-between p-2 rounded-md bg-primary/5 border border-primary/20"
                              >
                                <div className="flex items-center gap-2">
                                  <Bell className="h-3.5 w-3.5 text-primary" />
                                  <span className="text-xs font-medium">
                                    {alert.type === 'above' ? '↑' : '↓'} ${alert.targetPrice.toLocaleString('tr-TR', {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 8,
                                    })}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => handleAlertClick(coin.symbol, alert)}
                                    className="p-1 rounded hover:bg-primary/10 transition-colors cursor-pointer text-xs text-primary"
                                    title="Düzenle"
                                  >
                                    Düzenle
                                  </button>
                                  <button
                                    onClick={() => handleDeleteAlert(alert.id)}
                                    className="p-1 rounded hover:bg-red-500/10 transition-colors cursor-pointer text-xs text-red-400"
                                    title="Sil"
                                  >
                                    <BellOff className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
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

        {/* Alert Modal */}
        <Dialog open={alertModalOpen} onOpenChange={setAlertModalOpen}>
          <DialogContent className="glass-effect border-white/10 max-w-md">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold gradient-text">
                {editingAlert ? 'Alert Düzenle' : 'Yeni Alert Oluştur'}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                {selectedCoin && (
                  <>
                    <strong>{selectedCoin}</strong> için spot fiyat alarmı {editingAlert ? 'düzenle' : 'oluştur'}
                  </>
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {!editingAlert && selectedCoin && (
                <div>
                  <Label htmlFor="alert-type">Alert Tipi</Label>
                  {(() => {
                    const existingAlerts = alerts[selectedCoin] || []
                    const hasAbove = existingAlerts.some(a => a.type === 'above' && a.isActive)
                    const hasBelow = existingAlerts.some(a => a.type === 'below' && a.isActive)
                    
                    return (
                      <>
                        <Select value={alertType} onValueChange={(value) => setAlertType(value as 'above' | 'below')}>
                          <SelectTrigger className="mt-2">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="above" disabled={hasAbove}>
                              Fiyat Yukarı Çıktığında (Above) {hasAbove && '(Zaten var)'}
                            </SelectItem>
                            <SelectItem value="below" disabled={hasBelow}>
                              Fiyat Aşağı İndiğinde (Below) {hasBelow && '(Zaten var)'}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        {hasAbove && hasBelow && (
                          <p className="text-xs text-muted-foreground mt-2">
                            Bu coin için zaten hem "yukarı" hem "aşağı" alert'i mevcut. Mevcut alert'leri düzenlemek için listeden seçin.
                          </p>
                        )}
                      </>
                    )
                  })()}
                </div>
              )}
              <div>
                <Label htmlFor="target-price">Hedef Fiyat (USDT)</Label>
                <Input
                  id="target-price"
                  type="number"
                  step="any"
                  value={targetPrice}
                  onChange={(e) => setTargetPrice(e.target.value)}
                  placeholder="Örn: 50000"
                  className="mt-2"
                />
              </div>
              {selectedCoin && coinsMapRef.current.has(selectedCoin) && (
                <div className="text-sm text-muted-foreground">
                  Mevcut fiyat: <strong>${formatPrice(coinsMapRef.current.get(selectedCoin)!.price)}</strong>
                </div>
              )}
            </div>
            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setAlertModalOpen(false)
                  setEditingAlert(null)
                  setTargetPrice('')
                }}
                className="cursor-pointer"
              >
                İptal
              </Button>
              <Button
                onClick={handleSaveAlert}
                className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 cursor-pointer"
              >
                {editingAlert ? 'Güncelle' : 'Oluştur'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Remove Confirmation Modal */}
        <Dialog open={removeModalOpen} onOpenChange={setRemoveModalOpen}>
          <DialogContent className="glass-effect border-white/10">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold gradient-text">
                Takip Listesinden Çıkar
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                {coinToRemove && (
                  <>
                    <strong>{coinToRemove}</strong> coinini spot takip listesinden çıkarmak istediğinize emin misiniz?
                  </>
                )}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setRemoveModalOpen(false)
                  setCoinToRemove(null)
                }}
                className="cursor-pointer"
              >
                İptal
              </Button>
              <Button
                onClick={() => {
                  if (coinToRemove) {
                    removeFromWatchlist(coinToRemove)
                  }
                }}
                className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 cursor-pointer"
              >
                Çıkar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}

