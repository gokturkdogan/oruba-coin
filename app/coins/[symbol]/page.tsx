'use client'

import { useState, useEffect } from 'react'
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

export default function CoinDetailPage() {
  const params = useParams()
  const symbol = (params.symbol as string)?.toUpperCase()
  const [coinData, setCoinData] = useState<CoinData | null>(null)
  const [loading, setLoading] = useState(true)
  const [isPremium, setIsPremium] = useState(false)

  useEffect(() => {
    // Check premium status
    fetch('/api/user/profile')
      .then((res) => res.json())
      .then((data) => {
        setIsPremium(data.user?.isPremium || false)
      })
      .catch(() => {})

    const fetchData = async () => {
      try {
        const res = await fetch(`/api/coins/${symbol}`)
        if (!res.ok) throw new Error('Failed to fetch')
        const data = await res.json()
        setCoinData(data)
      } catch (error) {
        console.error('Failed to fetch coin data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
    const interval = setInterval(fetchData, 5000) // Update every 5 seconds
    return () => clearInterval(interval)
  }, [symbol])

  if (loading) {
    return (
      <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center py-12 text-muted-foreground">Loading coin data...</div>
      </div>
    )
  }

  if (!coinData) {
    return (
      <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold mb-4">Coin not found</h1>
          <Button asChild>
            <Link href="/coins">Back to Coins</Link>
          </Button>
        </div>
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
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">{coinData.symbol}</h1>
        <div className="flex items-center gap-4">
          <div className="text-3xl font-bold">
            ${parseFloat(coinData.price).toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 6,
            })}
          </div>
          <Badge
            variant={isPositive ? 'default' : 'destructive'}
            className={isPositive ? 'bg-green-500' : ''}
            style={{ fontSize: '1rem', padding: '0.5rem 1rem' }}
          >
            {isPositive ? <TrendingUp className="h-4 w-4 mr-1" /> : <TrendingDown className="h-4 w-4 mr-1" />}
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
            <div className="flex justify-between">
              <span className="text-muted-foreground">24h High</span>
              <span className="font-semibold">${parseFloat(coinData.highPrice).toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 6,
              })}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">24h Low</span>
              <span className="font-semibold">${parseFloat(coinData.lowPrice).toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 6,
              })}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">24h Volume</span>
              <span className="font-semibold">
                ${parseFloat(coinData.quoteVolume).toLocaleString('en-US', {
                  maximumFractionDigits: 0,
                })}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Open Price</span>
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
            <div className="flex justify-between">
              <span className="text-muted-foreground">Previous Close</span>
              <span className="font-semibold">${parseFloat(coinData.prevClosePrice).toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 6,
              })}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Price Change</span>
              <span className={`font-semibold ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
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
    </div>
  )
}

