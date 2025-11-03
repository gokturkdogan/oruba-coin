'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import Link from 'next/link'
import { Lock, Check } from 'lucide-react'

interface User {
  id: string
  email: string
  name?: string
  isVerified: boolean
  isPremium: boolean
  subscription?: {
    plan: string
    status: string
    currentPeriodEnd: string
  }
}

export default function ProfilePage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [changingPassword, setChangingPassword] = useState(false)
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })

  useEffect(() => {
    fetch('/api/user/profile')
      .then((res) => {
        if (!res.ok) {
          router.push('/login')
          return null
        }
        return res.json()
      })
      .then((data) => {
        if (data?.user) {
          setUser(data.user)
        }
      })
      .catch(() => {
        router.push('/login')
      })
      .finally(() => setLoading(false))
  }, [router])

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('Yeni şifreler eşleşmiyor')
      return
    }

    if (passwordData.newPassword.length < 8) {
      toast.error('Şifre en az 8 karakter olmalı')
      return
    }

    setChangingPassword(true)
    // Note: You'll need to implement a password change API endpoint
      toast.info('Şifre değiştirme özelliği yakında gelecek')
    setChangingPassword(false)
  }

  if (loading) {
    return (
      <div className="container py-8">
        <div className="text-center py-12 text-muted-foreground">Profil yükleniyor...</div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Profil</h1>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Hesap Bilgileri</CardTitle>
          <CardDescription>Hesap detaylarınız ve abonelik durumunuz</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>E-posta</Label>
            <div className="mt-1 font-medium">{user.email}</div>
          </div>
          <div>
            <Label>İsim</Label>
            <div className="mt-1 font-medium">{user.name || 'Belirtilmemiş'}</div>
          </div>
          <div>
            <Label>Doğrulama Durumu</Label>
            <div className="mt-1">
              {user.isVerified ? (
                <Badge variant="default" className="bg-green-500">
                  <Check className="h-3 w-3 mr-1" />
                  Doğrulanmış
                </Badge>
              ) : (
                <Badge variant="secondary">Doğrulanmamış</Badge>
              )}
            </div>
          </div>
          <div>
            <Label>Abonelik Durumu</Label>
            <div className="mt-1">
              {user.isPremium ? (
                <div className="space-y-2">
                  <Badge variant="default" className="bg-yellow-500">
                    <Lock className="h-3 w-3 mr-1" />
                    Premium Aktif
                  </Badge>
                  {user.subscription && (
                    <div className="text-sm text-muted-foreground">
                      Yenileme tarihi:{' '}
                      {new Date(user.subscription.currentPeriodEnd).toLocaleDateString('tr-TR', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <Badge variant="secondary">Ücretsiz Plan</Badge>
                  <div>
                    <Button asChild size="sm">
                      <Link href="/checkout">Premium'a Yükselt</Link>
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Şifre Değiştir</CardTitle>
          <CardDescription>Hesap şifrenizi güncelleyin</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Mevcut Şifre</Label>
              <Input
                id="currentPassword"
                type="password"
                value={passwordData.currentPassword}
                onChange={(e) =>
                  setPasswordData({ ...passwordData, currentPassword: e.target.value })
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">Yeni Şifre</Label>
              <Input
                id="newPassword"
                type="password"
                value={passwordData.newPassword}
                onChange={(e) =>
                  setPasswordData({ ...passwordData, newPassword: e.target.value })
                }
                required
                minLength={8}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Yeni Şifreyi Onayla</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={passwordData.confirmPassword}
                onChange={(e) =>
                  setPasswordData({ ...passwordData, confirmPassword: e.target.value })
                }
                required
                minLength={8}
              />
            </div>
            <Button type="submit" disabled={changingPassword}>
              {changingPassword ? 'Değiştiriliyor...' : 'Şifre Değiştir'}
            </Button>
          </form>
        </CardContent>
      </Card>
      </div>
    </div>
  )
}

