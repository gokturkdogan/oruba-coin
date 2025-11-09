'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Check, Lock, Copy, CheckCircle, Clock, Building2, AlertTriangle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface Plan {
  id: string
  name: string
  price: number
  durationDays: number
  displayOrder: number
}

export default function CheckoutPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [plans, setPlans] = useState<Plan[]>([])
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const [pendingPayment, setPendingPayment] = useState<any>(null)
  const [orderCreated, setOrderCreated] = useState(false)
  const [ibanInfo, setIbanInfo] = useState({
    bankName: 'Banka Adı',
    iban: 'TR00 0000 0000 0000 0000 0000 00',
    accountHolder: 'Oruba Coin',
  })

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

    // Fetch active plans
    fetch('/api/plans/active')
      .then((res) => res.json())
      .then((data) => {
        if (data.plans && data.plans.length > 0) {
          setPlans(data.plans)
          setSelectedPlanId(data.plans[0].id)
        }
      })
      .catch(() => {
        // Ignore error
      })

    // Check for pending payment
    fetch('/api/subscription/my-pending-payment')
      .then((res) => res.json())
      .then((data) => {
        if (data.pendingPayment) {
          setPendingPayment(data.pendingPayment)
          setOrderCreated(true)
          // Find plan by name from pending payment
          fetch('/api/plans/active')
            .then((res) => res.json())
            .then((planData) => {
              if (planData.plans) {
                const matchingPlan = planData.plans.find((p: Plan) => p.name === data.pendingPayment.plan)
                if (matchingPlan) {
                  setSelectedPlanId(matchingPlan.id)
                }
              }
            })
            .catch(() => {})
        }
      })
      .catch(() => {
        // Ignore error
      })

    // Fetch active bank account info
    fetch('/api/bank-account/active')
      .then((res) => res.json())
      .then((data) => {
        setIbanInfo({
          bankName: data.bankName || 'Banka Adı',
          iban: data.iban || 'TR00 0000 0000 0000 0000 0000 00',
          accountHolder: data.accountHolder || 'Oruba Coin',
        })
      })
      .catch(() => {
        // Ignore error, use defaults
      })
  }, [router])

  const handleCopyIban = () => {
    navigator.clipboard.writeText(ibanInfo.iban.replace(/\s/g, ''))
    toast.success('IBAN kopyalandı!')
  }

  const handleCreateOrder = async () => {
    if (!selectedPlanId) {
      toast.error('Lütfen bir plan seçin')
      return
    }

    const selectedPlan = plans.find(p => p.id === selectedPlanId)
    if (!selectedPlan) {
      toast.error('Seçilen plan bulunamadı')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/subscription/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          plan: selectedPlan.name, // Backward compatibility için name gönderiyoruz
          planId: selectedPlan.id,
          amount: selectedPlan.price 
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Sipariş oluşturulamadı')
        return
      }

      toast.success('Sipariş oluşturuldu! Ödeme yaptıktan sonra admin onayı bekleniyor.')
      setOrderCreated(true)
      setPendingPayment(data.order || data.pendingPayment)
    } catch (error) {
      toast.error('Bir hata oluştu')
    } finally {
      setLoading(false)
    }
  }

  const formatDuration = (days: number) => {
    if (days === 30) return '1 Ay'
    if (days === 365) return '1 Yıl'
    if (days < 30) return `${days} Gün`
    if (days < 365) {
      const months = Math.floor(days / 30)
      const remainingDays = days % 30
      if (remainingDays === 0) return `${months} Ay`
      return `${months} Ay ${remainingDays} Gün`
    }
    const years = Math.floor(days / 365)
    const remainingDays = days % 365
    if (remainingDays === 0) return `${years} Yıl`
    const months = Math.floor(remainingDays / 30)
    if (months === 0) return `${years} Yıl ${remainingDays} Gün`
    return `${years} Yıl ${months} Ay`
  }

  const selectedPlan = plans.find(p => p.id === selectedPlanId)

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
        {!orderCreated && plans.length > 0 && (
          <div className={`grid gap-6 mb-8 ${plans.length === 1 ? 'grid-cols-1' : plans.length === 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}`}>
            {plans.map((plan, index) => (
              <Card
                key={plan.id}
                className={`cursor-pointer transition-all relative ${
                  selectedPlanId === plan.id
                    ? 'border-primary border-2 bg-primary/5'
                    : 'hover:border-primary/50'
                }`}
                onClick={() => setSelectedPlanId(plan.id)}
              >
                {index === 0 && plans.length > 1 && (
                  <div className="absolute top-0 right-0 bg-primary text-white text-xs font-bold px-3 py-1 rounded-bl-lg">
                    Popüler
                  </div>
                )}
                <CardHeader>
                  <CardTitle>{plan.name}</CardTitle>
                  <div className="mt-4">
                    <div className="text-4xl font-bold gradient-text">
                      ₺{plan.price.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className="text-sm text-muted-foreground">{formatDuration(plan.durationDays)}</div>
                  </div>
                </CardHeader>
              </Card>
            ))}
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
                <div className="text-lg font-semibold">{ibanInfo.bankName}</div>
              </div>
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">Hesap Sahibi</div>
                <div className="text-lg font-semibold">{ibanInfo.accountHolder}</div>
              </div>
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">IBAN</div>
                <div className="flex items-center gap-3">
                  <div className="text-lg font-mono font-semibold">{ibanInfo.iban}</div>
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
                    {pendingPayment.plan || selectedPlan?.name || 'Plan'}
                  </div>
                </div>
              )}
            </div>

            {/* Warning Message */}
            <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div>
                    <div className="font-semibold text-yellow-500 mb-1">Önemli Uyarı</div>
                    <div className="text-sm text-muted-foreground">
                      Hesap bilgilerindeki isim soy isim ile gönderici IBAN isim soy isim uyuşmazlığı durumunda ödeme onaylanmayacaktır ve para iadesi gerçekleştirilmeyecektir.
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Ödeme dekontunuzu <a href="mailto:orubacoin@gmail.com" className="text-primary hover:underline">orubacoin@gmail.com</a> adresine iletmeyi unutmayın.
                  </div>
                </div>
              </div>
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
