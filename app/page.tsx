'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TrendingUp, TrendingDown, Sparkles, Zap, BarChart3, ArrowRight } from 'lucide-react'
import { createBinanceEventSource } from '@/lib/binance-stream'

interface Coin {
  symbol: string
  price: string
  priceChangePercent: string
  volume: string
  quoteVolume?: string
  futuresVolume?: string
  futuresQuoteVolume?: string
}

export default function HomePage() {
  const [coins, setCoins] = useState<Coin[]>([])
  const [loading, setLoading] = useState(true)
  const [flashAnimations, setFlashAnimations] = useState<Record<string, 'up' | 'down'>>({})
  const wsRef = useRef<EventSource | null>(null)
  const futuresWsRef = useRef<EventSource | null>(null)
  const coinsMapRef = useRef<Map<string, Coin>>(new Map())
  const previousPricesRef = useRef<Map<string, number>>(new Map())
  const isMountedRef = useRef<boolean>(true)

  // Initial fetch
  useEffect(() => {
    isMountedRef.current = true
    
    const fetchPopularCoins = async () => {
      try {
        const res = await fetch('/api/coins/popular')
        if (!res.ok) {
          setLoading(false)
          return
        }
        const data = await res.json()
        const coinsData = data.coins || []
        
        // Update map with popular coins
        coinsMapRef.current.clear()
        previousPricesRef.current.clear()
        coinsData.forEach((coin: Coin) => {
          coinsMapRef.current.set(coin.symbol, coin)
          previousPricesRef.current.set(coin.symbol, parseFloat(coin.price))
        })
        
        // Sort by volume (descending) and take top 5
        const sorted = [...coinsData].sort((a, b) => {
          const aVol = parseFloat(a.quoteVolume || a.volume || '0')
          const bVol = parseFloat(b.quoteVolume || b.volume || '0')
          return bVol - aVol
        }).slice(0, 5)
        
        setCoins(sorted)
        setLoading(false)
        
        // Subscribe to WebSocket for these symbols
        if (sorted.length > 0) {
          subscribeToWebSocket(sorted.map((c: Coin) => c.symbol))
        }
      } catch (error) {
        console.error('Failed to fetch popular coins:', error)
        setLoading(false)
      }
    }
    
    fetchPopularCoins()
    
    return () => {
      isMountedRef.current = false
      // Cleanup WebSocket connections
      if (wsRef.current && wsRef.current.readyState !== EventSource.CLOSED) {
        wsRef.current.onmessage = null
        wsRef.current.onerror = null
        wsRef.current.onopen = null
        wsRef.current.close()
        wsRef.current = null
      }
      if (futuresWsRef.current && futuresWsRef.current.readyState !== EventSource.CLOSED) {
        futuresWsRef.current.onmessage = null
        futuresWsRef.current.onerror = null
        futuresWsRef.current.onopen = null
        futuresWsRef.current.close()
        futuresWsRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const subscribeToWebSocket = useCallback((symbols: string[]) => {
    // Close existing connections
    if (wsRef.current && wsRef.current.readyState !== EventSource.CLOSED) {
      wsRef.current.onmessage = null
      wsRef.current.onerror = null
      wsRef.current.onopen = null
      wsRef.current.close()
      wsRef.current = null
    }
    if (futuresWsRef.current && futuresWsRef.current.readyState !== EventSource.CLOSED) {
      futuresWsRef.current.onmessage = null
      futuresWsRef.current.onerror = null
      futuresWsRef.current.onopen = null
      futuresWsRef.current.close()
      futuresWsRef.current = null
    }

    if (symbols.length === 0) return

    const limitedSymbols = symbols.map((s) => s.toUpperCase())
    const streams = limitedSymbols
      .map((s) => `${s.toLowerCase()}@ticker`)
      .join('/')

    // Streams proxied through server-side SSE endpoint
    const spotStreams = streams
    const futuresStreams = streams

    // Helper function to update coins and trigger re-render
    const updateCoinsDisplay = () => {
      if (!isMountedRef.current) return
      const updatedCoins = Array.from(coinsMapRef.current.values())
      // Sort by volume (descending) and take top 5
      const sorted = [...updatedCoins].sort((a, b) => {
        const aVol = parseFloat(a.quoteVolume || a.volume || '0')
        const bVol = parseFloat(b.quoteVolume || b.volume || '0')
        return bVol - aVol
      }).slice(0, 5)
      setCoins(sorted)
    }

    // Spot WebSocket
    try {
      const spotWs = createBinanceEventSource(spotStreams, { market: 'spot', endpoint: 'ticker' })

      spotWs.onopen = () => {
        console.log('Homepage Spot WebSocket connected')
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

              // Update coin data, preserving futures data
              const updatedCoin: Coin = {
                symbol,
                price: data.c || data.lastPrice || '0',
                priceChangePercent: data.P || data.priceChangePercent || '0',
                volume: data.v || data.volume || '0',
                quoteVolume: data.q || data.quoteVolume || existingCoin.quoteVolume || '0',
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
        console.error('Spot stream error:', error)
      }

      wsRef.current = spotWs
    } catch (error) {
      console.error('Failed to create Spot WebSocket:', error)
    }

    // Futures WebSocket
    try {
      const futuresWs = createBinanceEventSource(futuresStreams, { market: 'futures', endpoint: 'ticker' })

      futuresWs.onopen = () => {
        console.log('Homepage Futures WebSocket connected')
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
        console.error('Futures stream error:', error)
      }

      futuresWsRef.current = futuresWs
    } catch (error) {
      console.error('Failed to create Futures WebSocket:', error)
    }
  }, [])

  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 md:py-32">
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-primary/15 rounded-full blur-[100px] animate-glow" />
          <div className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[120px] animate-glow" style={{ animationDelay: '1.5s' }} />
          <div className="absolute top-1/2 left-1/2 w-[400px] h-[400px] bg-primary/8 rounded-full blur-[90px] animate-glow" style={{ animationDelay: '3s' }} />
        </div>
        
        <div className="relative z-10">
          <div className="max-w-4xl mx-auto space-y-8 px-4 sm:px-6 lg:px-8 text-center">
            <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full glass-effect border border-primary/20 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
              <Sparkles className="h-4 w-4 text-primary animate-pulse" />
              <span className="text-sm font-medium">Gerçek Zamanlı Kripto Analitiği</span>
            </div>
            
            <div className="space-y-6 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
              <h1 className="text-5xl md:text-7xl lg:text-8xl font-extrabold leading-tight tracking-tight">
                <span className="gradient-text inline-block animate-gradient">Oruba Coin</span>
                <br />
                <span className="text-foreground inline-block">Kripto Para</span>
                <br />
                <span className="text-foreground inline-block">İstihbarat Merkezi</span>
              </h1>
              
              <p className="max-w-2xl text-xl md:text-2xl text-muted-foreground leading-relaxed animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
                Binance'dan gelen gerçek zamanlı verilerle fiyatları takip edin, trendleri analiz edin ve bilinçli kararlar verin. 
                Gelişmiş göstergeler ve premium içgörüler parmaklarınızın ucunda.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 pt-4 animate-fade-in-up justify-center items-center" style={{ animationDelay: '0.4s' }}>
                <Button asChild size="lg" className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-white shadow-lg shadow-primary/30 text-base px-8 py-6 hover:scale-105 transition-transform duration-200">
                  <Link href="/register">
                    Ücretsiz Başlayın
                    <ArrowRight className="ml-2 h-5 w-5 inline-block group-hover:translate-x-1 transition-transform" />
                  </Link>
                </Button>
                <Button variant="outline" size="lg" className="border-primary/30 hover:bg-primary/10 text-base px-8 py-6 hover:scale-105 transition-transform duration-200">
                  <Link href="/coins">Piyasaları Keşfet</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Popular Coins Preview */}
      <section className="py-16 md:py-24 relative">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="mb-12 text-center animate-fade-in-up max-w-4xl mx-auto">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 gradient-text">En İyi Performans</h2>
            <p className="text-muted-foreground text-lg md:text-xl">Şu anda en çok işlem gören coinler</p>
          </div>
          
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5 max-w-7xl mx-auto">
            {coins.map((coin: Coin, index: number) => {
              const change = parseFloat(coin.priceChangePercent)
              const isPositive = change >= 0
              return (
                <Card 
                  key={coin.symbol} 
                  className={`glass-effect border-white/10 hover:border-primary/30 transition-all duration-500 hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-2 group overflow-hidden relative animate-fade-in-up flash-soft ${
                    flashAnimations[coin.symbol] === 'up'
                      ? 'flash-soft-up'
                      : flashAnimations[coin.symbol] === 'down'
                      ? 'flash-soft-down'
                      : ''
                  }`}
                  style={{ animationDelay: `${(index + 1) * 0.1}s` }}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="absolute -top-10 -right-10 w-20 h-20 bg-primary/10 rounded-full blur-xl group-hover:scale-150 transition-transform duration-500" />
                  
                  <CardHeader className="relative z-10">
                    <CardTitle className="text-xl font-bold flex items-center justify-between">
                      <span>{coin.symbol}</span>
                      <div className={`transition-transform duration-300 group-hover:scale-110 ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                        {isPositive ? (
                          <TrendingUp className="h-5 w-5" />
                        ) : (
                          <TrendingDown className="h-5 w-5" />
                        )}
                      </div>
                    </CardTitle>
                    <CardDescription className="text-xs">24 Saatlik Performans</CardDescription>
                  </CardHeader>
                  
                  <CardContent className="relative z-10 space-y-3">
                    <div 
                      className={`text-2xl font-bold transition-colors duration-500 group-hover:scale-105 ${
                        flashAnimations[coin.symbol] === 'up'
                          ? 'text-green-300'
                          : flashAnimations[coin.symbol] === 'down'
                          ? 'text-red-300'
                          : ''
                      }`}
                    >
                      ${parseFloat(coin.price).toLocaleString('tr-TR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 6,
                      })}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={`${
                          isPositive 
                            ? 'bg-gradient-to-r from-green-500/10 to-emerald-500/10 text-green-400 border-green-500/30' 
                            : 'bg-gradient-to-r from-red-500/10 to-red-600/10 text-red-400 border-red-500/30'
                        } border transition-transform duration-300 group-hover:scale-110`}
                      >
                        {isPositive ? (
                          <TrendingUp className="h-3 w-3 mr-1 inline-block" />
                        ) : (
                          <TrendingDown className="h-3 w-3 mr-1 inline-block" />
                        )}
                        {isPositive ? '+' : ''}
                        {change.toFixed(2)}%
                      </Badge>
                    </div>
                    
                    <div className="text-xs text-muted-foreground pt-2 border-t border-white/5">
                      Vol: ${parseFloat(coin.quoteVolume || coin.volume).toLocaleString('tr-TR', {
                        maximumFractionDigits: 0,
                      })}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
          
          {coins.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <div className="animate-pulse text-lg">Piyasa verileri yükleniyor...</div>
            </div>
          )}
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 md:py-28 border-t border-white/10 relative">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="mb-16 text-center animate-fade-in-up max-w-4xl mx-auto">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 gradient-text">Güçlü Özellikler</h2>
            <p className="text-muted-foreground text-lg md:text-xl max-w-2xl mx-auto">
              Profesyonel kripto analizi için ihtiyacınız olan her şey
            </p>
          </div>
          
          <div className="grid gap-8 md:grid-cols-3 max-w-6xl mx-auto">
            <Card className="glass-effect border-white/10 hover:border-primary/30 transition-all duration-300 hover:shadow-xl hover:shadow-primary/10 group overflow-hidden relative animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="absolute -top-10 -left-10 w-32 h-32 bg-primary/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
              
              <CardHeader className="relative z-10">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
                  <Zap className="h-7 w-7 text-primary" />
                </div>
                <CardTitle className="text-2xl mb-2">Gerçek Zamanlı Veri</CardTitle>
                <CardDescription className="text-base">
                  WebSocket teknolojisi kullanarak Binance'tan canlı fiyat güncellemeleri. Piyasa hareketlerini kaçırmayın.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="glass-effect border-white/10 hover:border-primary/30 transition-all duration-300 hover:shadow-xl hover:shadow-primary/10 group overflow-hidden relative animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="absolute -top-10 -left-10 w-32 h-32 bg-primary/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
              
              <CardHeader className="relative z-10">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
                  <BarChart3 className="h-7 w-7 text-primary" />
                </div>
                <CardTitle className="text-2xl mb-2">Gelişmiş Analiz</CardTitle>
                <CardDescription className="text-base">
                  Bilinçli işlem kararları için premium göstergeler ve detaylı coin analitiği.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="glass-effect border-white/10 hover:border-primary/30 transition-all duration-300 hover:shadow-xl hover:shadow-primary/10 group overflow-hidden relative animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="absolute -top-10 -left-10 w-32 h-32 bg-primary/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
              
              <CardHeader className="relative z-10">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
                  <Sparkles className="h-7 w-7 text-primary" />
                </div>
                <CardTitle className="text-2xl mb-2">Piyasa İçgörüleri</CardTitle>
                <CardDescription className="text-base">
                  Alış/satış hacimlerini, fiyat hareketlerini ve piyasa trendlerini hassasiyetle takip edin.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>
    </div>
  )
}
