'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Check, Lock } from 'lucide-react'

export default function CheckoutPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    fetch('/api/user/profile')
      .then((res) => res.json())
      .then((data) => {
        if (!data.user) {
          router.push('/login')
          return
        }
        setUser(data.user)
        if (data.user.isPremium) {
          router.push('/profile')
        }
      })
      .catch(() => {
        router.push('/login')
      })
  }, [router])

  const handleCheckout = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Ödeme oturumu oluşturulamadı')
        return
      }

      if (data.url) {
        window.location.href = data.url
      } else {
        toast.error('Ödeme URL'si alınamadı')
      }
    } catch (error) {
        toast.error('Bir hata oluştu')
    } finally {
      setLoading(false)
    }
  }

  if (!user) {
    return (
      <div className="container py-8">
        <div className="text-center py-12 text-muted-foreground">Yükleniyor...</div>
      </div>
    )
  }

  return (
    <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Premium'a Yükselt</h1>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lock className="h-6 w-6 text-yellow-500" />
            <CardTitle>Premium Plan</CardTitle>
          </div>
          <CardDescription>Gelişmiş özellikler ve içgörülere erişin</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <Check className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <div className="font-semibold">Gelişmiş Coin Analitiği</div>
                <div className="text-sm text-muted-foreground">
                  Günlük grafikler, genişletilmiş geçmiş veriler ve detaylı piyasa göstergeleri
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Check className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <div className="font-semibold">Premium Göstergeler</div>
                <div className="text-sm text-muted-foreground">
                  Gelişmiş teknik göstergelere ve piyasa analiz araçlarına erişim
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Check className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <div className="font-semibold">Veri Dışa Aktarma</div>
                <div className="text-sm text-muted-foreground">
                  Coin verilerini ve grafikleri birden fazla formatta indirin
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Check className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <div className="font-semibold">Fiyat Uyarıları</div>
                <div className="text-sm text-muted-foreground">
                  Favori coinleriniz için özel fiyat uyarıları ayarlayın
                </div>
              </div>
            </div>
          </div>

          <div className="border-t pt-6">
            <div className="text-center space-y-4">
              <div>
                <div className="text-4xl font-bold">Premium</div>
                <div className="text-muted-foreground">Abonelik tabanlı plan</div>
              </div>
              <Button
                size="lg"
                className="w-full"
                onClick={handleCheckout}
                disabled={loading}
              >
                {loading ? 'İşleniyor...' : 'Stripe ile Abone Ol'}
              </Button>
              <p className="text-xs text-muted-foreground">
                Stripe tarafından güçlendirilmiş güvenli ödeme işleme
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  )
}

