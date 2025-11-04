'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'

export default function LoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await res.json()

      if (!res.ok) {
        // Email doğrulanmamışsa warning göster
        if (res.status === 403 && data.error?.includes('doğrulanmamış')) {
          toast.warning(data.error || 'Email adresiniz doğrulanmamış')
        } else {
          // API'den gelen anlamlı mesajı göster
          toast.error(data.error || 'Giriş yapılırken bir hata oluştu')
        }
        return
      }

      toast.success('Giriş başarılı! Hoş geldiniz')
      // Admin ise admin paneline, değilse coins sayfasına yönlendir
      if (data.user?.isAdmin) {
        router.push('/admin')
      } else {
        router.push('/coins')
      }
      router.refresh()
    } catch (error) {
      toast.error('Bağlantı hatası. Lütfen internet bağlantınızı kontrol edin ve tekrar deneyin')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-center min-h-[calc(100vh-4rem)] py-12 relative">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-glow" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-glow" style={{ animationDelay: '1s' }} />
      </div>
      
      <Card className="w-full max-w-md glass-effect border-white/10 relative z-10">
        <CardHeader className="text-center space-y-2">
          <CardTitle className="text-3xl font-bold gradient-text">Tekrar Hoş Geldiniz</CardTitle>
          <CardDescription className="text-base">Hesabınıza erişmek için bilgilerinizi girin</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">E-posta</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                className="glass-effect border-white/10 focus:border-primary/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">Şifre</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                className="glass-effect border-white/10 focus:border-primary/50"
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button 
              type="submit" 
              className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-white shadow-lg shadow-primary/20 mt-4 cursor-pointer" 
              disabled={loading}
            >
              {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
            </Button>
            <p className="text-sm text-center text-muted-foreground">
              Hesabınız yok mu?{' '}
              <Link href="/register" className="text-primary hover:underline font-medium">
                Kayıt Ol
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}

