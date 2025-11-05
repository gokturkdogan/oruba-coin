'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Check, Lock, Copy, CheckCircle, Clock, Building2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

const PLAN_PRICES = {
  monthly: 99,
  yearly: 899,
}

const IBAN_INFO = {
  bankName: process.env.NEXT_PUBLIC_BANK_NAME || 'Banka Adı',
  iban: process.env.NEXT_PUBLIC_IBAN || 'TR00 0000 0000 0000 0000 0000 00',
  accountHolder: process.env.NEXT_PUBLIC_ACCOUNT_HOLDER || 'Oruba Coin',
}

export default function CheckoutPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('monthly')
  const [pendingPayment, setPendingPayment] = useState<any>(null)
  const [orderCreated, setOrderCreated] = useState(false)

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

    // Check for pending payment
    fetch('/api/subscription/my-pending-payment')
      .then((res) => res.json())
      .then((data) => {
        if (data.pendingPayment) {
          setPendingPayment(data.pendingPayment)
          setOrderCreated(true)
          setSelectedPlan(data.pendingPayment.plan as 'monthly' | 'yearly')
        }
      })
      .catch(() => {
        // Ignore error
      })
  }, [router])

  const handleCopyIban = () => {
    navigator.clipboard.writeText(IBAN_INFO.iban.replace(/\s/g, ''))
    toast.success('IBAN kopyalandı!')
  }

  const handleCreateOrder = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/subscription/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: selectedPlan }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Sipariş oluşturulamadı')
        return
      }

      toast.success('Sipariş oluşturuldu! Ödeme yaptıktan sonra admin onayı bekleniyor.')
      setOrderCreated(true)
      setPendingPayment(data.order)
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
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 gradient-text">Premium'a Yükselt</h1>

        {/* Plan Selection */}
        {!orderCreated && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <Card
              className={`cursor-pointer transition-all ${
                selectedPlan === 'monthly'
                  ? 'border-primary border-2 bg-primary/5'
                  : 'hover:border-primary/50'
              }`}
              onClick={() => setSelectedPlan('monthly')}
            >
              <CardHeader>
                <CardTitle>Aylık Plan</CardTitle>
                <div className="mt-4">
                  <div className="text-4xl font-bold gradient-text">₺{PLAN_PRICES.monthly}</div>
                  <div className="text-sm text-muted-foreground">aylık</div>
                </div>
              </CardHeader>
            </Card>

            <Card
              className={`cursor-pointer transition-all relative ${
                selectedPlan === 'yearly'
                  ? 'border-primary border-2 bg-primary/5'
                  : 'hover:border-primary/50'
              }`}
              onClick={() => setSelectedPlan('yearly')}
            >
              <div className="absolute top-0 right-0 bg-primary text-white text-xs font-bold px-3 py-1 rounded-bl-lg">
                Popüler
              </div>
              <CardHeader>
                <CardTitle>Yıllık Plan</CardTitle>
                <div className="mt-4">
                  <div className="flex items-baseline gap-2">
                    <div className="text-4xl font-bold gradient-text">₺{PLAN_PRICES.yearly}</div>
                    <div className="text-sm text-muted-foreground line-through">₺{PLAN_PRICES.monthly * 12}</div>
                  </div>
                  <div className="text-sm text-muted-foreground">yıllık</div>
                  <div className="text-xs text-green-400 font-semibold mt-1">2 ay ücretsiz!</div>
                </div>
              </CardHeader>
            </Card>
          </div>
        )}

        {/* Payment Instructions */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="h-6 w-6 text-primary" />
              <CardTitle>EFT/Havale ile Ödeme</CardTitle>
            </div>
            <CardDescription>
              Aşağıdaki IBAN bilgilerine ödeme yaparak Premium üyeliğinizi aktifleştirin
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* IBAN Info */}
            <div className="space-y-4 p-6 bg-muted/30 rounded-lg border border-border/50">
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">Banka Adı</div>
                <div className="text-lg font-semibold">{IBAN_INFO.bankName}</div>
              </div>
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">Hesap Sahibi</div>
                <div className="text-lg font-semibold">{IBAN_INFO.accountHolder}</div>
              </div>
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">IBAN</div>
                <div className="flex items-center gap-3">
                  <div className="text-lg font-mono font-semibold">{IBAN_INFO.iban}</div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyIban}
                    className="flex items-center gap-2"
                  >
                    <Copy className="h-4 w-4" />
                    Kopyala
                  </Button>
                </div>
              </div>
              {orderCreated && pendingPayment && (
                <div className="space-y-2 pt-4 border-t border-border/50">
                  <div className="text-sm text-muted-foreground">Ödenecek Tutar</div>
                  <div className="text-2xl font-bold gradient-text">₺{pendingPayment.amount}</div>
                  <div className="text-xs text-muted-foreground">
                    {selectedPlan === 'monthly' ? 'Aylık' : 'Yıllık'} plan
                  </div>
                </div>
              )}
            </div>

            {/* Order Status */}
            {orderCreated && pendingPayment && (
              <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-blue-400" />
                  <div className="flex-1">
                    <div className="font-semibold text-blue-400">Sipariş Oluşturuldu</div>
                    <div className="text-sm text-muted-foreground">
                      Ödemenizi yaptıktan sonra admin onayı bekleniyor. Onaylandıktan sonra Premium üyeliğiniz aktif olacaktır.
                    </div>
                  </div>
                  <Badge variant="secondary" className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                    Beklemede
                  </Badge>
                </div>
              </div>
            )}

            {/* Create Order Button */}
            {!orderCreated && (
              <Button
                size="lg"
                className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-white shadow-lg shadow-primary/30"
                onClick={handleCreateOrder}
                disabled={loading}
              >
                {loading ? 'İşleniyor...' : 'Sipariş Oluştur'}
              </Button>
            )}

            {/* Features List */}
            <div className="pt-6 border-t space-y-4">
              <div className="font-semibold mb-4">Premium Özellikler:</div>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-semibold">Gelişmiş Coin Analitiği</div>
                    <div className="text-sm text-muted-foreground">
                      Günlük grafikler, genişletilmiş geçmiş veriler ve detaylı piyasa göstergeleri
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-semibold">Premium Göstergeler</div>
                    <div className="text-sm text-muted-foreground">
                      Gelişmiş teknik göstergelere ve piyasa analiz araçlarına erişim
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-semibold">Fiyat Alarmları</div>
                    <div className="text-sm text-muted-foreground">
                      Favori coinleriniz için özel fiyat uyarıları ayarlayın
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
