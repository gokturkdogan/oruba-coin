'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { toast } from 'sonner'
import Link from 'next/link'
import { Lock, Check, Mail, User, Shield, Crown, Calendar, Key } from 'lucide-react'

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
    <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-glow" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-glow" style={{ animationDelay: '1s' }} />
      </div>

      <div className="relative z-10">
        <div className="mb-8">
          <h1 className="text-4xl font-bold gradient-text mb-2">Profil Ayarları</h1>
          <p className="text-muted-foreground">Hesap bilgilerinizi yönetin ve güvenliğinizi koruyun</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Sol Taraf - Hesap Bilgileri */}
          <Card className="glass-effect border-white/10 shadow-xl hover:shadow-2xl transition-all duration-300">
            <CardHeader className="border-b border-white/10 pb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-xl">Hesap Bilgileri</CardTitle>
                  <CardDescription>Profil detaylarınız ve durumunuz</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              {/* Avatar Section */}
              <div className="flex items-center space-x-4 pb-4 border-b border-white/10">
                <Avatar className="h-16 w-16 ring-4 ring-primary/20">
                  <AvatarFallback className="bg-gradient-to-br from-primary/80 to-primary/60 text-white font-semibold text-xl">
                    {user.name?.[0] || user.email[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold text-lg">{user.name || 'Kullanıcı'}</p>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                </div>
              </div>

              {/* Email */}
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">E-posta Adresi</Label>
                </div>
                <div className="pl-6">
                  <div className="p-3 rounded-lg bg-muted/50 border border-white/10 font-medium">
                    {user.email}
                  </div>
                </div>
              </div>

              {/* Name */}
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">İsim</Label>
                </div>
                <div className="pl-6">
                  <div className="p-3 rounded-lg bg-muted/50 border border-white/10 font-medium">
                    {user.name || 'Belirtilmemiş'}
                  </div>
                </div>
              </div>

              {/* Verification Status */}
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">Doğrulama Durumu</Label>
                </div>
                <div className="pl-6">
                  {user.isVerified ? (
                    <Badge variant="default" className="bg-green-500/20 text-green-400 border-green-500/30 hover:bg-green-500/30">
                      <Check className="h-3 w-3 mr-1" />
                      Doğrulanmış
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="bg-orange-500/20 text-orange-400 border-orange-500/30">
                      Doğrulanmamış
                    </Badge>
                  )}
                </div>
              </div>

              {/* Subscription Status */}
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Crown className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">Abonelik Durumu</Label>
                </div>
                <div className="pl-6 space-y-3">
                  {user.isPremium ? (
                    <div className="space-y-2">
                      <Badge variant="default" className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white border-0 shadow-lg shadow-yellow-500/20">
                        <Crown className="h-3 w-3 mr-1" />
                        Premium Aktif
                      </Badge>
                      {user.subscription && (
                        <div className="flex items-center space-x-2 text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg border border-white/10">
                          <Calendar className="h-4 w-4" />
                          <span>
                            Yenileme tarihi:{' '}
                            <span className="font-medium text-foreground">
                              {new Date(user.subscription.currentPeriodEnd).toLocaleDateString('tr-TR', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                              })}
                            </span>
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <Badge variant="secondary" className="bg-muted/50">Ücretsiz Plan</Badge>
                      <Button asChild size="sm" className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 cursor-pointer">
                        <Link href="/checkout">✨ Premium'a Yükselt</Link>
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sağ Taraf - Şifre Değiştir */}
          <Card className="glass-effect border-white/10 shadow-xl hover:shadow-2xl transition-all duration-300">
            <CardHeader className="border-b border-white/10 pb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10">
                  <Key className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-xl">Şifre Değiştir</CardTitle>
                  <CardDescription>Hesap güvenliğiniz için şifrenizi güncelleyin</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handlePasswordChange} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword" className="flex items-center space-x-2">
                    <Lock className="h-4 w-4" />
                    <span>Mevcut Şifre</span>
                  </Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    value={passwordData.currentPassword}
                    onChange={(e) =>
                      setPasswordData({ ...passwordData, currentPassword: e.target.value })
                    }
                    required
                    className="glass-effect border-white/10 focus:border-primary/50"
                    placeholder="••••••••"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newPassword" className="flex items-center space-x-2">
                    <Key className="h-4 w-4" />
                    <span>Yeni Şifre</span>
                  </Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={passwordData.newPassword}
                    onChange={(e) =>
                      setPasswordData({ ...passwordData, newPassword: e.target.value })
                    }
                    required
                    minLength={8}
                    className="glass-effect border-white/10 focus:border-primary/50"
                    placeholder="En az 8 karakter"
                  />
                  <p className="text-xs text-muted-foreground pl-6">Şifre en az 8 karakter olmalıdır</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="flex items-center space-x-2">
                    <Lock className="h-4 w-4" />
                    <span>Yeni Şifreyi Onayla</span>
                  </Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={passwordData.confirmPassword}
                    onChange={(e) =>
                      setPasswordData({ ...passwordData, confirmPassword: e.target.value })
                    }
                    required
                    minLength={8}
                    className="glass-effect border-white/10 focus:border-primary/50"
                    placeholder="Yeni şifrenizi tekrar girin"
                  />
                </div>
                <Button 
                  type="submit" 
                  disabled={changingPassword}
                  className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-white shadow-lg shadow-primary/20 cursor-pointer"
                >
                  {changingPassword ? (
                    <>
                      <span className="animate-spin mr-2">⏳</span>
                      Değiştiriliyor...
                    </>
                  ) : (
                    <>
                      <Key className="h-4 w-4 mr-2" />
                      Şifre Değiştir
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

