'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { StarOff, Lock, Star, TrendingUp, TrendingDown } from 'lucide-react'
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

interface Coin {
  symbol: string
  price: string
  priceChangePercent: string
  quoteVolume: string
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
  const isMountedRef = useRef<boolean>(true)
  const wsRef = useRef<WebSocket | null>(null) // Spot ticker WebSocket
  const coinsMapRef = useRef<Map<string, Coin>>(new Map())
  const previousPricesRef = useRef<Map<string, number>>(new Map())
  const [flashAnimations, setFlashAnimations] = useState<Record<string, 'up' | 'down'>>({})

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
    const updateCoinsDisplay = () => {
      if (!isMountedRef.current) return
      const updatedCoins = Array.from(coinsMapRef.current.values())
      setCoins(updatedCoins)
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

              // Update coin data
              const updatedCoin: Coin = {
                symbol,
                price: data.c || data.lastPrice || '0',
                priceChangePercent: data.P || data.priceChangePercent || '0',
                quoteVolume: quoteVolume.toString(),
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
                    }, 800)
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
        setLoading(false)
        return
      }

      // Fetch coin data ONLY for symbols in watchlist (parallel requests)
      const coinDataPromises = symbols.map(async (symbol: string) => {
        try {
          // Fetch data for this specific coin (only if in watchlist)
          const res = await fetch(`/api/coins/${symbol}`)
          if (!res.ok) {
            console.error(`Failed to fetch data for ${symbol}:`, res.status)
            return null
          }
          const data = await res.json()
          
          // Return only spot data: symbol, price, price change, 24h volume
          return {
            symbol: data.symbol,
            price: data.price,
            priceChangePercent: data.priceChangePercent || '0',
            quoteVolume: data.quoteVolume || '0',
          } as Coin
        } catch (error) {
          console.error(`Error fetching data for ${symbol}:`, error)
          return null
        }
      })

      const coinDataResults = await Promise.all(coinDataPromises)
      
      if (!isMountedRef.current) return
      
      const watchlistCoins = coinDataResults.filter((coin): coin is Coin => coin !== null)
      
      // Update map and previous prices for WebSocket updates
      coinsMapRef.current.clear()
      previousPricesRef.current.clear()
      watchlistCoins.forEach((coin) => {
        coinsMapRef.current.set(coin.symbol, coin)
        previousPricesRef.current.set(coin.symbol, parseFloat(coin.price))
      })
      
      setCoins(watchlistCoins)
      setLoading(false)
      
      // Subscribe to WebSocket for real-time updates
      if (watchlistCoins.length > 0) {
        const symbols = watchlistCoins.map((c) => c.symbol)
        subscribeToWebSocket(symbols)
      }
    } catch (error) {
      console.error('Failed to fetch watchlist:', error)
      if (isMountedRef.current) {
        toast.error('Takip listesi yüklenirken bir hata oluştu')
        setLoading(false)
      }
    }
  }, [router, subscribeToWebSocket])

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
      
      coinsMapRef.current.clear()
      previousPricesRef.current.clear()
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
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold gradient-text mb-2">Spot Takip Listesi</h1>
              <p className="text-muted-foreground">Spot takip listesindeki coinlerin güncel fiyatları ve hacimleri</p>
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
                      <button
                        onClick={() => handleRemoveClick(coin.symbol)}
                        className="p-1.5 rounded-md hover:bg-yellow-500/10 transition-colors cursor-pointer text-yellow-400 hover:text-yellow-300"
                        title="Spot takip listesinden çıkar"
                      >
                        <Star className="h-5 w-5 fill-yellow-400" />
                      </button>
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
                      <p className="text-sm font-medium">
                        ${parseFloat(coin.quoteVolume || '0').toLocaleString('tr-TR', {
                          maximumFractionDigits: 0,
                        })}
                      </p>
                    </div>
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

