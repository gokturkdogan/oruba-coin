'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Users, Shield, TrendingUp, Bell, UserCheck, Mail } from 'lucide-react'
import Link from 'next/link'
import { formatNumberTR } from '@/lib/utils'

interface Stats {
  totalUsers: number
  verifiedUsers: number
  premiumUsers: number
  totalWatchlists: number
  totalPriceAlerts: number
  activePriceAlerts: number
  recentUsers: Array<{
    id: string
    email: string
    name: string | null
    createdAt: string
    isVerified: boolean
    subscription: {
      status: string
    } | null
  }>
}

export default function AdminDashboardPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<Stats | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/admin/stats')
        if (res.status === 403) {
          setError('Admin yetkisi gerekli')
          router.push('/coins')
          return
        }
        if (res.status === 401) {
          setError('Giriş yapmanız gerekiyor')
          router.push('/login')
          return
        }
        if (!res.ok) {
          setError('İstatistikler yüklenemedi')
          return
        }
        const data = await res.json()
        setStats(data.stats)
      } catch (error) {
        console.error('Failed to fetch stats:', error)
        setError('İstatistikler yüklenemedi')
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [router])

  if (loading) {
    return (
      <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center py-12 text-muted-foreground">Yükleniyor...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold mb-4">Hata</h1>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    )
  }

  if (!stats) {
    return null
  }

  const verificationRate = stats.totalUsers > 0 
    ? ((stats.verifiedUsers / stats.totalUsers) * 100).toFixed(1)
    : '0'

  const premiumRate = stats.totalUsers > 0
    ? ((stats.premiumUsers / stats.totalUsers) * 100).toFixed(1)
    : '0'

  return (
    <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Admin Paneli</h1>
        <p className="text-muted-foreground">Sistem istatistikleri ve genel bakış</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Toplam Kullanıcı</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumberTR(stats.totalUsers)}</div>
            <p className="text-xs text-muted-foreground">
              {stats.verifiedUsers} doğrulanmış ({verificationRate}%)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Premium Üyeler</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumberTR(stats.premiumUsers)}</div>
            <p className="text-xs text-muted-foreground">
              {premiumRate}% kullanıcı oranı
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Watchlist Sayısı</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumberTR(stats.totalWatchlists)}</div>
            <p className="text-xs text-muted-foreground">
              Toplam takip listesi
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fiyat Alarmları</CardTitle>
            <Bell className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumberTR(stats.activePriceAlerts)}</div>
            <p className="text-xs text-muted-foreground">
              {stats.totalPriceAlerts} toplam ({stats.activePriceAlerts} aktif)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Hızlı İşlemler</CardTitle>
            <CardDescription>Yönetim paneline hızlı erişim</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Button asChild variant="outline" className="justify-start">
              <Link href="/admin/users">
                <Users className="mr-2 h-4 w-4" />
                Kullanıcı Yönetimi
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Son Kayıt Olan Kullanıcılar</CardTitle>
            <CardDescription>Son 10 yeni kullanıcı</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.recentUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground">Henüz kullanıcı yok</p>
              ) : (
                stats.recentUsers.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-2 rounded-lg border border-border/50 hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10">
                        <UserCheck className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{user.name || user.email}</p>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {user.isVerified ? (
                        <Badge variant="default" className="text-xs">
                          <Mail className="mr-1 h-3 w-3" />
                          Doğrulanmış
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          Beklemede
                        </Badge>
                      )}
                      {user.subscription?.status === 'active' && (
                        <Badge variant="outline" className="text-xs bg-green-500/10 text-green-500 border-green-500/20">
                          Premium
                        </Badge>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

