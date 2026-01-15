'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Users, Shield, TrendingUp, UserCheck, Mail, Settings } from 'lucide-react'
import Link from 'next/link'
import { formatNumberTR } from '@/lib/utils'

interface Stats {
  totalUsers: number
  verifiedUsers: number
  premiumUsers: number
  totalWatchlists: number
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
    <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">Admin Paneli</h1>
        <p className="text-sm sm:text-base text-muted-foreground">Sistem istatistikleri ve genel bakış</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 mb-6 sm:mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Toplam Kullanıcı</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold">{formatNumberTR(stats.totalUsers)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.verifiedUsers} doğrulanmış ({verificationRate}%)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Premium Üyeler</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold">{formatNumberTR(stats.premiumUsers)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {premiumRate}% kullanıcı oranı
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Watchlist Sayısı</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold">{formatNumberTR(stats.totalWatchlists)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Toplam takip listesi
            </p>
          </CardContent>
        </Card>

      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg sm:text-xl">Hızlı İşlemler</CardTitle>
            <CardDescription className="text-xs sm:text-sm">Yönetim paneline hızlı erişim</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Button asChild variant="outline" className="justify-start w-full text-sm">
              <Link href="/admin/users">
                <Users className="mr-2 h-4 w-4 flex-shrink-0" />
                Kullanıcı Yönetimi
              </Link>
            </Button>
            <Button asChild variant="outline" className="justify-start w-full text-sm">
              <Link href="/admin/settings">
                <Settings className="mr-2 h-4 w-4 flex-shrink-0" />
                Sistem Ayarları
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg sm:text-xl">Son Kayıt Olan Kullanıcılar</CardTitle>
            <CardDescription className="text-xs sm:text-sm">Son 10 yeni kullanıcı</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {stats.recentUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground">Henüz kullanıcı yok</p>
              ) : (
                stats.recentUsers.map((user) => (
                  <div
                    key={user.id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 p-2 sm:p-3 rounded-lg border border-border/50 hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 flex-shrink-0">
                        <UserCheck className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{user.name || user.email}</p>
                        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 sm:gap-2 flex-wrap sm:flex-nowrap">
                      {user.isVerified ? (
                        <Badge variant="default" className="text-xs whitespace-nowrap">
                          <Mail className="mr-1 h-3 w-3" />
                          Doğrulanmış
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs whitespace-nowrap">
                          Beklemede
                        </Badge>
                      )}
                      {user.subscription?.status === 'active' && (
                        <Badge variant="outline" className="text-xs bg-green-500/10 text-green-500 border-green-500/20 whitespace-nowrap">
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


