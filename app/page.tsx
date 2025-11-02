import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TrendingUp, TrendingDown, Sparkles, Zap, BarChart3, ArrowRight } from 'lucide-react'

async function getPopularCoins() {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/coins/popular`, {
      cache: 'no-store',
    })
    if (!res.ok) return []
    const data = await res.json()
    return data.coins || []
  } catch {
    return []
  }
}

interface Coin {
  symbol: string
  price: string
  priceChangePercent: string
  volume: string
}

export default async function HomePage() {
  const coins = await getPopularCoins()

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
        
        <div className="container relative z-10">
          <div className="max-w-4xl mx-auto space-y-8 px-4 sm:px-6 lg:px-8">
            <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full glass-effect border border-primary/20 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
              <Sparkles className="h-4 w-4 text-primary animate-pulse" />
              <span className="text-sm font-medium">Real-time Crypto Analytics</span>
            </div>
            
            <div className="space-y-6 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
              <h1 className="text-5xl md:text-7xl lg:text-8xl font-extrabold leading-tight tracking-tight">
                <span className="gradient-text inline-block animate-gradient">Oruba Coin</span>
                <br />
                <span className="text-foreground inline-block">Your Crypto</span>
                <br />
                <span className="text-foreground inline-block">Intelligence Hub</span>
              </h1>
              
              <p className="max-w-2xl text-xl md:text-2xl text-muted-foreground leading-relaxed animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
                Track prices, analyze trends, and make informed decisions with real-time data from Binance. 
                Advanced indicators and premium insights at your fingertips.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 pt-4 animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
                <Button asChild size="lg" className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-white shadow-lg shadow-primary/30 text-base px-8 py-6 hover:scale-105 transition-transform duration-200">
                  <Link href="/register">
                    Get Started Free
                    <ArrowRight className="ml-2 h-5 w-5 inline-block group-hover:translate-x-1 transition-transform" />
                  </Link>
                </Button>
                <Button variant="outline" size="lg" className="border-primary/30 hover:bg-primary/10 text-base px-8 py-6 hover:scale-105 transition-transform duration-200">
                  <Link href="/coins">Explore Markets</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Popular Coins Preview */}
      <section className="py-16 md:py-24 relative">
        <div className="container px-4 sm:px-6 lg:px-8">
          <div className="mb-12 text-center animate-fade-in-up">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 gradient-text">Top Performer</h2>
            <p className="text-muted-foreground text-lg md:text-xl">Most traded coins right now</p>
          </div>
          
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5 max-w-7xl mx-auto">
            {coins.map((coin: Coin, index: number) => {
              const change = parseFloat(coin.priceChangePercent)
              const isPositive = change >= 0
              return (
                <Card 
                  key={coin.symbol} 
                  className="glass-effect border-white/10 hover:border-primary/30 transition-all duration-300 hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-2 group overflow-hidden relative animate-fade-in-up"
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
                    <CardDescription className="text-xs">24h Performance</CardDescription>
                  </CardHeader>
                  
                  <CardContent className="relative z-10 space-y-3">
                    <div className="text-2xl font-bold transition-transform duration-300 group-hover:scale-105">
                      ${parseFloat(coin.price).toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 6,
                      })}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={isPositive ? 'default' : 'destructive'}
                        className={`${
                          isPositive 
                            ? 'bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-green-400 border-green-500/30' 
                            : 'bg-gradient-to-r from-red-500/20 to-rose-500/20 text-red-400 border-red-500/30'
                        } border transition-transform duration-300 group-hover:scale-110`}
                      >
                        {isPositive ? '+' : ''}
                        {change.toFixed(2)}%
                      </Badge>
                    </div>
                    
                    <div className="text-xs text-muted-foreground pt-2 border-t border-white/5">
                      Vol: ${parseFloat(coin.volume).toLocaleString('en-US', {
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
              <div className="animate-pulse text-lg">Loading market data...</div>
            </div>
          )}
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 md:py-28 border-t border-white/10 relative">
        <div className="container px-4 sm:px-6 lg:px-8">
          <div className="mb-16 text-center animate-fade-in-up">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 gradient-text">Powerful Features</h2>
            <p className="text-muted-foreground text-lg md:text-xl max-w-2xl mx-auto">
              Everything you need for professional crypto analysis
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
                <CardTitle className="text-2xl mb-2">Real-time Data</CardTitle>
                <CardDescription className="text-base">
                  Live price updates from Binance using WebSocket technology. Never miss a market movement.
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
                <CardTitle className="text-2xl mb-2">Advanced Analysis</CardTitle>
                <CardDescription className="text-base">
                  Premium indicators and detailed coin analytics for informed trading decisions.
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
                <CardTitle className="text-2xl mb-2">Market Insights</CardTitle>
                <CardDescription className="text-base">
                  Track buy/sell volumes, price movements, and market trends with precision.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>
    </div>
  )
}
