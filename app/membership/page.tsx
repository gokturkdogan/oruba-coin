'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { format, formatDistanceToNow } from 'date-fns'
import { tr } from 'date-fns/locale'
import {
  AlertTriangle,
  AlertCircle,
  Bell,
  Calendar,
  ChevronDown,
  ChevronUp,
  Clock,
  Crown,
  Star,
  X,
  XCircle,
} from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface SubscriptionInfo {
  plan: string
  status: string
  currentPeriodEnd: string
  startedAt?: string
}

interface UserProfile {
  id: string
  email: string
  name?: string
  isPremium: boolean
  subscription?: SubscriptionInfo
}

interface AlertInfo {
  id: string
  symbol: string
  type: 'above' | 'below'
  isActive: boolean
  targetPrice: number
}

interface Plan {
  id: string
  name: string
  price: number
  durationDays: number
  displayOrder?: number
}

interface PendingPayment {
  id: string
  plan: string
  amount: number
  status: string
  createdAt: string
}

interface BankAccountInfo {
  bankName: string
  iban: string
  accountHolder: string
}

const WATCHLIST_LIMIT_PER_LIST = 10

const formatDate = (date: string) =>
  format(new Date(date), 'd MMMM yyyy', {
    locale: tr,
  })

export default function MembershipPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<UserProfile | null>(null)
  const [spotWatchlistCount, setSpotWatchlistCount] = useState<number>(0)
  const [futuresWatchlistCount, setFuturesWatchlistCount] = useState<number>(0)
  const [spotAlerts, setSpotAlerts] = useState<AlertInfo[]>([])
  const [futuresAlerts, setFuturesAlerts] = useState<AlertInfo[]>([])
  const [renewDialogOpen, setRenewDialogOpen] = useState(false)
  const [plans, setPlans] = useState<Plan[]>([])
  const [loadingPlans, setLoadingPlans] = useState(false)
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const [creatingOrder, setCreatingOrder] = useState(false)
  const [pendingPayment, setPendingPayment] = useState<PendingPayment | null>(null)
  const [cancellingPending, setCancellingPending] = useState(false)
  const [bankInfo, setBankInfo] = useState<BankAccountInfo | null>(null)
  const [bankInfoError, setBankInfoError] = useState<string | null>(null)
  const [showPaymentInfo, setShowPaymentInfo] = useState(false)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)

  const subscription = user?.subscription ?? null

  const subscriptionEndDate = useMemo(() => {
    if (!subscription?.currentPeriodEnd) return null
    const parsed = new Date(subscription.currentPeriodEnd)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }, [subscription?.currentPeriodEnd])

  const daysUntilExpiry = useMemo(() => {
    if (!subscriptionEndDate) return null
    const diffMs = subscriptionEndDate.getTime() - Date.now()
    return Math.floor(diffMs / (1000 * 60 * 60 * 24))
  }, [subscriptionEndDate])

  const isSubscriptionActive = useMemo(() => {
    if (!subscriptionEndDate || !subscription) return false
    return subscription.status === 'active' && subscriptionEndDate > new Date()
  }, [subscription, subscriptionEndDate])

  const remainingTimeText = useMemo(() => {
    if (!subscriptionEndDate || !isSubscriptionActive) return null
    try {
      return formatDistanceToNow(subscriptionEndDate, { addSuffix: true, locale: tr })
    } catch {
      return null
    }
  }, [subscriptionEndDate, isSubscriptionActive])

  const membershipStartInfo = useMemo(() => {
    if (!subscription?.startedAt) return null
    try {
      const startDate = new Date(subscription.startedAt)
      return {
        formatted: format(startDate, 'd MMMM yyyy', { locale: tr }),
        relative: formatDistanceToNow(startDate, { addSuffix: true, locale: tr })
          .replace('önce', 'dır')
          .replace('sonra', 'içinde'),
      }
    } catch {
      return null
    }
  }, [subscription?.startedAt])

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const profileRes = await fetch('/api/user/profile')

        if (profileRes.status === 401) {
          router.push('/login')
          return
        }

        const profileData = await profileRes.json()
        setUser(profileData.user ?? null)

        try {
          const pendingRes = await fetch('/api/subscription/my-pending-payment')
          if (pendingRes.ok) {
            const pendingData = await pendingRes.json()
            setPendingPayment(pendingData.pendingPayment ?? null)
          } else {
            setPendingPayment(null)
          }
        } catch (error) {
          console.error('Pending payment fetch error:', error)
          setPendingPayment(null)
        }

        if (profileData?.user?.isPremium) {
          // Fetch spot watchlist
          try {
            const spotWatchlistRes = await fetch('/api/watchlist/spot')
            if (spotWatchlistRes.ok) {
              const spotWatchlistData = await spotWatchlistRes.json()
              const watchlistItems = Array.isArray(spotWatchlistData.watchlist)
                ? spotWatchlistData.watchlist
                : spotWatchlistData.watchlist?.coins || []
              setSpotWatchlistCount(watchlistItems.length)
            }
          } catch (error) {
            console.error('Spot watchlist fetch error:', error)
          }

          // Fetch futures watchlist
          try {
            const futuresWatchlistRes = await fetch('/api/watchlist/futures')
            if (futuresWatchlistRes.ok) {
              const futuresWatchlistData = await futuresWatchlistRes.json()
              const watchlistItems = Array.isArray(futuresWatchlistData.watchlist)
                ? futuresWatchlistData.watchlist
                : futuresWatchlistData.watchlist?.coins || []
              setFuturesWatchlistCount(watchlistItems.length)
            }
          } catch (error) {
            console.error('Futures watchlist fetch error:', error)
          }

          // Fetch spot alerts
          try {
            const spotAlertsRes = await fetch('/api/alerts?market=spot')
            if (spotAlertsRes.ok) {
              const spotAlertsData = await spotAlertsRes.json()
              setSpotAlerts(spotAlertsData.alerts ?? [])
            }
          } catch (error) {
            console.error('Spot alerts fetch error:', error)
          }

          // Fetch futures alerts
          try {
            const futuresAlertsRes = await fetch('/api/alerts?market=futures')
            if (futuresAlertsRes.ok) {
              const futuresAlertsData = await futuresAlertsRes.json()
              setFuturesAlerts(futuresAlertsData.alerts ?? [])
            }
          } catch (error) {
            console.error('Futures alerts fetch error:', error)
          }
        } else {
          setSpotWatchlistCount(0)
          setFuturesWatchlistCount(0)
          setSpotAlerts([])
          setFuturesAlerts([])
        }
      } catch (error) {
        console.error('Membership page load error:', error)
        toast.error('Üyelik bilgileri yüklenirken bir hata oluştu')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [router])

  const totalActiveAlerts =
    spotAlerts.filter((alert) => alert.isActive).length +
    futuresAlerts.filter((alert) => alert.isActive).length

  const totalInactiveAlerts =
    spotAlerts.filter((alert) => !alert.isActive).length +
    futuresAlerts.filter((alert) => !alert.isActive).length

  const fetchPlans = async () => {
    try {
      setLoadingPlans(true)
      const res = await fetch('/api/plans/active')
      if (!res.ok) {
        throw new Error('Planlar yüklenemedi')
      }
      const data = await res.json()
      setPlans(data.plans ?? [])
      if (data.plans?.length && !selectedPlanId) {
        setSelectedPlanId(data.plans[0].id)
      }
    } catch (error) {
      console.error('Active plans fetch error:', error)
      toast.error('Planlar yüklenemedi')
    } finally {
      setLoadingPlans(false)
    }
  }

  useEffect(() => {
    if (renewDialogOpen) {
      fetchPlans()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renewDialogOpen])

  useEffect(() => {
    const fetchBankInfo = async () => {
      try {
        const bankRes = await fetch('/api/bank-account/active')
        if (!bankRes.ok) {
          throw new Error('Bank info fetch failed')
        }
        const bankData = await bankRes.json()
        setBankInfo(bankData)
        setBankInfoError(null)
      } catch (error) {
        console.error('Bank info fetch error:', error)
        setBankInfo(null)
        setBankInfoError('Hesap bilgileri alınamadı. Lütfen destek ekibiyle iletişime geçin.')
      }
    }

    if (pendingPayment) {
      fetchBankInfo()
      setShowPaymentInfo(false)
    } else {
      setBankInfo(null)
      setBankInfoError(null)
      setShowPaymentInfo(false)
    }
  }, [pendingPayment])

  const handleCreateRenewalOrder = async () => {
    if (pendingPayment) {
      toast.error('Zaten bekleyen bir ödeme talebiniz var. Yeni talep oluşturmak için mevcut talebi tamamlayın veya iptal edin.')
      return
    }
    if (!selectedPlanId) {
      toast.error('Lütfen bir plan seçin')
      return
    }
    const plan = plans.find((p) => p.id === selectedPlanId)
    if (!plan) {
      toast.error('Seçilen plan bulunamadı')
      return
    }

    setCreatingOrder(true)
    try {
      const res = await fetch('/api/subscription/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: plan.name,
          planId: plan.id,
          amount: plan.price,
        }),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => null)
        throw new Error(errorData?.error || 'Yenileme talebi oluşturulamadı')
      }

      toast.success('Yenileme talebiniz oluşturuldu. Dekont ile bize ulaşmayı unutmayın.')
      setRenewDialogOpen(false)
    } catch (error: any) {
      console.error('Renew order error:', error)
      toast.error(error.message || 'Yenileme talebi oluşturulamadı')
    } finally {
      setCreatingOrder(false)
    }
  }

  const handleCancelPendingPayment = async () => {
    if (!pendingPayment) return

    setCancellingPending(true)
    try {
      const res = await fetch('/api/subscription/my-pending-payment', {
        method: 'DELETE',
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => null)
        throw new Error(errorData?.error || 'Bekleyen talep iptal edilemedi')
      }

      setPendingPayment(null)
      setShowPaymentInfo(false)
      setCancelDialogOpen(false)
      toast.success('Bekleyen ödeme talebiniz iptal edildi')
    } catch (error: any) {
      console.error('Cancel pending payment error:', error)
      toast.error(error.message || 'Bekleyen talep iptal edilemedi')
    } finally {
      setCancellingPending(false)
    }
  }

  if (loading) {
    return (
      <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center text-muted-foreground">
        Üyelik bilgileriniz yükleniyor...
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/5 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-glow" />
        <div
          className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-glow"
          style={{ animationDelay: '1.5s' }}
        />
      </div>

      <div className="relative z-10 space-y-8">
        <div>
          <h1 className="text-4xl font-bold gradient-text mb-2">Premium Bilgileriniz</h1>
          <p className="text-muted-foreground">
            Premium üyeliğinizin sunduğu avantajları görüntüleyin ve kullanım durumunuzu takip edin.
          </p>
        </div>

        <PremiumStatusCard
          user={user}
          isSubscriptionActive={isSubscriptionActive}
          subscriptionEndDate={subscriptionEndDate}
          daysUntilExpiry={daysUntilExpiry}
          remainingTimeText={remainingTimeText}
          membershipStartInfo={membershipStartInfo}
          onRenewClick={() => {
            if (pendingPayment) {
              toast.error('Bekleyen ödeme talebiniz var. Yeni talep oluşturmak için mevcut talebi tamamlayın veya iptal edin.')
              return
            }
            setRenewDialogOpen(true)
          }}
          renewDisabled={!!pendingPayment}
        />

        <PendingPaymentCard
          pendingPayment={pendingPayment}
          bankInfo={bankInfo}
          bankInfoError={bankInfoError}
          showPaymentInfo={showPaymentInfo}
          onTogglePaymentInfo={() => setShowPaymentInfo((prev) => !prev)}
          onRequestCancel={() => setCancelDialogOpen(true)}
          cancelDialogOpen={cancelDialogOpen}
          onCancelDialogChange={setCancelDialogOpen}
          onConfirmCancel={handleCancelPendingPayment}
          cancellingPending={cancellingPending}
        />

        <PremiumBenefitsCard />

        <UsageGrid
          spotWatchlistCount={spotWatchlistCount}
          futuresWatchlistCount={futuresWatchlistCount}
          watchlistLimit={WATCHLIST_LIMIT_PER_LIST}
          spotAlerts={spotAlerts}
          futuresAlerts={futuresAlerts}
          totalActiveAlerts={totalActiveAlerts}
        />

        <Dialog open={renewDialogOpen} onOpenChange={setRenewDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Premium Üyeliğinizi Uzatın</DialogTitle>
              <DialogDescription>
                Favori planınızı seçin. Ödeme talebi oluşturduktan sonra dekontu destek ekibine
                <a href="mailto:orubacoin@gmail.com" className="text-primary hover:underline"> orubacoin@gmail.com</a>
                adresinden ileterek yenilemeyi tamamlayabilirsiniz.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {pendingPayment && (
                <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/15 p-3 text-sm text-yellow-100">
                  Mevcut bekleyen ödeme talebiniz ({pendingPayment.plan}) nedeniyle yeni talep şu an
                  oluşturulamaz. Talebi tamamladıktan veya iptal ettikten sonra yeniden deneyebilirsiniz.
                </div>
              )}
              {loadingPlans ? (
                <div className="py-8 text-center text-muted-foreground">Planlar yükleniyor...</div>
              ) : plans.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground border border-dashed border-white/20 rounded-lg">
                  Şu anda aktif plan bulunmuyor. Lütfen daha sonra tekrar deneyin.
                </div>
              ) : (
                <div className="space-y-3">
                  {plans.map((plan) => {
                    const isSelected = selectedPlanId === plan.id
                    return (
                      <button
                        key={plan.id}
                        type="button"
                        onClick={() => setSelectedPlanId(plan.id)}
                        className={`w-full text-left rounded-xl border p-4 transition-all cursor-pointer ${
                          isSelected
                            ? 'border-primary/60 bg-primary/10 shadow-lg shadow-primary/20'
                            : 'border-white/10 hover:border-primary/30 hover:bg-primary/5'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                          <div>
                            <h3 className="text-lg font-semibold">{plan.name}</h3>
                            <p className="text-sm text-muted-foreground">
                              {plan.durationDays} günlük premium erişim
                            </p>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold">
                              ₺{plan.price.toLocaleString('tr-TR', { minimumFractionDigits: 0 })}
                            </div>
                            {isSelected && (
                              <span className="text-xs uppercase tracking-wider text-primary">Seçili Plan</span>
                            )}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Ödeme talebinizi oluşturduktan sonra dekontu destek ekibine
                <a href="mailto:orubacoin@gmail.com" className="text-primary hover:underline"> orubacoin@gmail.com</a>
                adresinden iletin. Onaylandıktan sonra premium
                süreniz seçtiğiniz plan kadar uzatılacaktır.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRenewDialogOpen(false)}>
                Vazgeç
              </Button>
              <Button
                onClick={handleCreateRenewalOrder}
                disabled={creatingOrder || plans.length === 0 || !!pendingPayment}
              >
                {creatingOrder ? 'Talep oluşturuluyor...' : 'Ödeme Talebi Oluştur'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}


interface PremiumStatusCardProps {
  user: UserProfile | null
  isSubscriptionActive: boolean
  subscriptionEndDate: Date | null
  daysUntilExpiry: number | null
  remainingTimeText: string | null
  membershipStartInfo: { formatted: string; relative: string } | null
  onRenewClick: () => void
  renewDisabled: boolean
}

function PremiumStatusCard({
  user,
  isSubscriptionActive,
  subscriptionEndDate,
  daysUntilExpiry,
  remainingTimeText,
  membershipStartInfo,
  onRenewClick,
  renewDisabled,
}: PremiumStatusCardProps) {
  const planName = user?.subscription?.plan ?? 'Premium değil'
  const showExpiryWarning = isSubscriptionActive && daysUntilExpiry !== null && daysUntilExpiry <= 7

  return (
    <Card className="glass-effect border-white/10 shadow-xl">
      <CardHeader className="border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10">
            <Crown className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-xl">Üyelik Durumu</CardTitle>
            <CardDescription>Geçerli planınız ve yenileme bilgileri</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6 space-y-4">
        {showExpiryWarning && (
          <ExpiryWarning
            daysUntilExpiry={daysUntilExpiry!}
            onRenewClick={onRenewClick}
            renewDisabled={renewDisabled}
          />
        )}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Mevcut Durum</p>
            {isSubscriptionActive ? (
              <Badge className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white border-0 shadow-lg shadow-yellow-500/20">
                Premium Aktif
              </Badge>
            ) : (
              <Badge variant="secondary" className="bg-muted/60">
                Ücretsiz Plan
              </Badge>
            )}
          </div>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Plan</p>
            <div className="font-semibold text-lg">{planName}</div>
          </div>
          {subscriptionEndDate && (
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                Bitiş Tarihi
              </p>
              <div
                className={`font-medium ${
                  daysUntilExpiry !== null && daysUntilExpiry <= 3
                    ? 'text-red-400'
                    : daysUntilExpiry !== null && daysUntilExpiry <= 7
                    ? 'text-yellow-400'
                    : ''
                }`}
              >
                {formatDate(subscriptionEndDate.toISOString())}
              </div>
              {remainingTimeText && (
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {remainingTimeText}
                </div>
              )}
            </div>
          )}
        </div>
        {membershipStartInfo && (
          <div className="rounded-lg border border-white/10 bg-muted/10 p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground uppercase tracking-wide mb-1">
                Premium Ailesine Katılım
              </p>
              <p className="text-base font-semibold text-foreground">
                {membershipStartInfo.formatted} tarihinden beri premium ailesindesiniz.
              </p>
              <p className="text-xs text-muted-foreground mt-1">{membershipStartInfo.relative}</p>
            </div>
            <Badge className="bg-primary/15 border-primary/30 text-primary px-3 py-1 text-sm">
              Birlikte Daha Güçlüyüz
            </Badge>
          </div>
        )}
        {!isSubscriptionActive && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-primary mt-0.5" />
            <div className="space-y-1 text-sm">
              <p className="font-medium text-primary">Premium üyeliğiniz aktif değil.</p>
              <p className="text-muted-foreground">
                Premium özelliklere erişmek için plan satın almanız gerekir. Satın alma işlemleri yakında bu sayfaya
                eklenecek.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ExpiryWarning({
  daysUntilExpiry,
  onRenewClick,
  renewDisabled,
}: {
  daysUntilExpiry: number
  onRenewClick: () => void
  renewDisabled: boolean
}) {
  const isCritical = daysUntilExpiry <= 3

  return (
    <div
      className={`flex items-start gap-3 rounded-xl border p-4 shadow-inner ${
        isCritical ? 'border-red-500/40 bg-red-500/10 text-red-200' : 'border-yellow-500/40 bg-yellow-500/10 text-yellow-100'
      }`}
    >
      <div className="mt-0.5">
        <AlertTriangle className={`h-5 w-5 ${isCritical ? 'text-red-300' : 'text-yellow-200'}`} />
      </div>
      <div className="flex-1 space-y-1 text-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <p className="font-semibold uppercase tracking-wide">
              {isCritical ? 'Avantajlarınızı Kaybetmek Üzeresiniz!' : 'Premium Avantajlarınızı Kaçırmayın'}
            </p>
            <p>
              Premium ayrıcalıklarınız{' '}
              <span className="font-medium">{daysUntilExpiry <= 0 ? 'bugün' : `${daysUntilExpiry} gün içinde`}</span>{' '}
              sona eriyor. Üyeliğinizi yenilemezseniz takip listesi limitleriniz ve alarm haklarınız standart plana
              dönecek.
            </p>
          </div>
          {isCritical && (
            <Button
              size="sm"
              variant="secondary"
              className="bg-white/15 hover:bg-white/25 text-white border-white/30"
              onClick={onRenewClick}
              disabled={renewDisabled}
            >
              Üyeliğimi Uzat
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

interface PendingPaymentCardProps {
  pendingPayment: PendingPayment | null
  bankInfo: BankAccountInfo | null
  bankInfoError: string | null
  showPaymentInfo: boolean
  onTogglePaymentInfo: () => void
  onRequestCancel: () => void
  cancelDialogOpen: boolean
  onCancelDialogChange: (open: boolean) => void
  onConfirmCancel: () => void
  cancellingPending: boolean
}

function PendingPaymentCard({
  pendingPayment,
  bankInfo,
  bankInfoError,
  showPaymentInfo,
  onTogglePaymentInfo,
  onRequestCancel,
  cancelDialogOpen,
  onCancelDialogChange,
  onConfirmCancel,
  cancellingPending,
}: PendingPaymentCardProps) {
  if (!pendingPayment) return null

  return (
    <Card className="glass-effect border-yellow-500/30 bg-yellow-500/5 shadow-lg text-yellow-100">
      <CardHeader className="border-b border-yellow-500/20 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-yellow-500/20">
            <AlertCircle className="h-5 w-5 text-yellow-300" />
          </div>
          <div>
            <CardTitle className="text-xl text-yellow-100">Bekleyen Ödeme Talebiniz</CardTitle>
            <CardDescription className="text-yellow-50/70">
              Talep onaylanana kadar yeni bir talep oluşturamazsınız. Gerekirse iptal edip yeniden gönderebilirsiniz.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6 space-y-4 text-sm">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <InfoTile label="Plan" value={pendingPayment.plan} />
          <InfoTile
            label="Tutar"
            value={`₺${pendingPayment.amount.toLocaleString('tr-TR')}`}
          />
          <InfoTile
            label="Oluşturulma"
            value={new Date(pendingPayment.createdAt).toLocaleDateString('tr-TR')}
          />
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-yellow-100/80">
            Ödemeyi tamamladıysanız dekontu destek ekibine
            <a href="mailto:orubacoin@gmail.com" className="text-yellow-200 underline underline-offset-2"> orubacoin@gmail.com</a>
            adresinden iletmeyi unutmayın. Farklı bir planla ilerlemek isterseniz önce mevcut talebi iptal etmeniz gerekir.
          </p>
          <Button
            variant="outline"
            className="border-yellow-500/40 text-yellow-100 hover:bg-yellow-500/20 cursor-pointer"
            onClick={onRequestCancel}
          >
            <XCircle className="h-4 w-4 mr-2" />
            Bekleyen Talebi İptal Et
          </Button>
        </div>
        <div className="border border-yellow-500/20 rounded-lg bg-yellow-500/5 overflow-hidden transition-all">
          <button
            type="button"
            onClick={onTogglePaymentInfo}
            className="w-full flex items-center justify-between px-4 py-3 text-yellow-50 hover:bg-yellow-500/10 transition-colors cursor-pointer"
          >
            <span className="font-semibold text-sm">Nasıl ödeme yaparım?</span>
            {showPaymentInfo ? (
              <ChevronUp className="h-4 w-4 text-yellow-100" />
            ) : (
              <ChevronDown className="h-4 w-4 text-yellow-100" />
            )}
          </button>
          <div
            className={`grid transition-all duration-300 ${
              showPaymentInfo ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
            }`}
          >
            <div className="overflow-hidden">
              <div className="px-4 pb-4 pt-2 space-y-3 text-sm text-yellow-50/90">
                {bankInfoError ? (
                  <p className="text-red-200">{bankInfoError}</p>
                ) : bankInfo ? (
                  <PaymentInstructions bankInfo={bankInfo} />
                ) : (
                  <p className="text-yellow-100/80">Hesap bilgileri yükleniyor...</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardContent>

      <AlertDialog open={cancelDialogOpen} onOpenChange={onCancelDialogChange}>
        <AlertDialogContent className="max-w-md text-red-50">
          <AlertDialogCancel className="absolute right-3 top-3 h-8 w-8 border border-red-500/30 bg-red-500/10 text-red-200 hover:bg-red-500/20 hover:text-red-50 focus:ring-red-500 focus:ring-offset-black cursor-pointer">
            <X className="h-3.5 w-3.5" />
          </AlertDialogCancel>
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-red-500/50 bg-red-500/10">
              <AlertTriangle className="h-6 w-6 text-red-300" />
            </div>
            <div className="space-y-3">
              <AlertDialogHeader className="space-y-1 text-left">
                <AlertDialogTitle className="text-xl font-semibold text-red-50">
                  Talebi iptal etmek istediğinize emin misiniz?
                </AlertDialogTitle>
                <AlertDialogDescription className="text-sm text-red-100/80">
                  Ödemeyi yaptıysanız iade edilmeyecektir. Talebi iptal ederseniz yeniden plan seçmeniz ve ödeme
                  yapmanız gerekir.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-2 text-sm text-red-100/70">
                <p>
                  İşlemi onaylamadan önce mevcut talebinize ait dekontu gönderdiyseniz destek ekibi ile
                  <a href="mailto:orubacoin@gmail.com" className="text-red-200 underline underline-offset-2"> orubacoin@gmail.com</a>
                  üzerinden iletişime geçmeden bu işlemi yapmayın.
                </p>
              </div>
              <AlertDialogFooter className="sm:justify-end sm:space-x-2 space-y-0">
                <AlertDialogCancel disabled={cancellingPending}>
                  Vazgeç
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={onConfirmCancel}
                  disabled={cancellingPending}
                  className="bg-red-500 text-white hover:bg-red-400 focus:ring-red-500 focus:ring-offset-black disabled:opacity-70 cursor-pointer"
                >
                  {cancellingPending ? 'İptal ediliyor...' : 'Evet, Talebi İptal Et'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

function PaymentInstructions({ bankInfo }: { bankInfo: BankAccountInfo }) {
  return (
    <>
      <div className="rounded-md border border-yellow-500/20 bg-yellow-500/10 p-3 space-y-1">
        <p className="text-xs uppercase tracking-wide text-yellow-200/70">Gönderim Bilgileri</p>
        <p>
          <span className="font-semibold text-yellow-50">Banka:</span> {bankInfo.bankName}
        </p>
        <p>
          <span className="font-semibold text-yellow-50">Hesap Sahibi:</span> {bankInfo.accountHolder}
        </p>
        <p className="break-all">
          <span className="font-semibold text-yellow-50">IBAN:</span> {bankInfo.iban}
        </p>
      </div>
      <ol className="list-decimal list-inside space-y-2">
        <li>
          Yukarıdaki IBAN bilgilerine, talep ettiğiniz plan tutarı kadar havale/EFT yapın. Açıklama alanına e-posta
          adresinizi yazmayı unutmayın.
        </li>
        <li>Ödeme dekontunu destek ekibimize iletin.</li>
        <li>Dekont incelendikten sonra premium süreniz seçtiğiniz plan kadar uzatılır ve size bilgi verilir.</li>
      </ol>
      <p className="text-xs text-yellow-200/60">
        Not: Ödemeyi yaptıktan sonra talebi iptal etmeyin; onay süreci tamamlanana kadar beklemede kalacaktır.
      </p>
    </>
  )
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3">
      <p className="text-xs uppercase tracking-wide text-yellow-200/80">{label}</p>
      <p className="text-base font-semibold text-yellow-50">{value}</p>
    </div>
  )
}

function PremiumBenefitsCard() {
  return (
    <Card className="glass-effect border-white/10 shadow-lg">
      <CardHeader className="border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10">
            <Crown className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-xl">Premium Ayrıcalıkları</CardTitle>
            <CardDescription>Aktif premium üyeliğinizle gelen avantajlar</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-lg border border-white/10 bg-muted/10 p-4">
            <h3 className="text-sm font-semibold mb-2 text-primary">Gerçek Zamanlı Takip</h3>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li>• Spot ve vadeli piyasa takip listelerinde toplam 20 coin saklama</li>
              <li>• Canlı fiyat güncellemeleri ve saatlik hacim takibi</li>
              <li>• Premium kullanıcıya özel veri önceliği</li>
            </ul>
          </div>
          <div className="rounded-lg border border-white/10 bg-muted/10 p-4">
            <h3 className="text-sm font-semibold mb-2 text-primary">Fiyat Alarmları</h3>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li>• Spot ve vadeli piyasalar için ayrı alarm yönetimi</li>
              <li>• Her coin için yukarı/aşağı olmak üzere iki eşik</li>
              <li>• Gerçekleşen alarmları geçmiş olarak saklama</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

interface UsageGridProps {
  spotWatchlistCount: number
  futuresWatchlistCount: number
  watchlistLimit: number
  spotAlerts: AlertInfo[]
  futuresAlerts: AlertInfo[]
  totalActiveAlerts: number
}

function UsageGrid({
  spotWatchlistCount,
  futuresWatchlistCount,
  watchlistLimit,
  spotAlerts,
  futuresAlerts,
  totalActiveAlerts,
}: UsageGridProps) {
  const spotActiveAlerts = spotAlerts.filter((alert) => alert.isActive).length
  const spotInactiveAlerts = spotAlerts.length - spotActiveAlerts
  const futuresActiveAlerts = futuresAlerts.filter((alert) => alert.isActive).length
  const futuresInactiveAlerts = futuresAlerts.length - futuresActiveAlerts

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="glass-effect border-white/10 shadow-lg">
        <CardHeader className="border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Star className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-xl">Takip Listesi Kullanımı</CardTitle>
              <CardDescription>Spot ve vadeli listelerinizdeki coin sayısı</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <WatchlistTile
              title="Spot Takip Listesi"
              count={spotWatchlistCount}
              limit={watchlistLimit}
              href="/spot-watchlist"
              className="bg-gradient-to-br from-primary/10 to-primary/5"
            />
            <WatchlistTile
              title="Vadeli Takip Listesi"
              count={futuresWatchlistCount}
              limit={watchlistLimit}
              href="/futures-watchlist"
              className="bg-gradient-to-br from-secondary/10 to-secondary/5"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Her liste için maksimum {watchlistLimit} coin saklanabilir. Gerektiğinde daha az takip edilen coinleri
            çıkararak yeni coinler ekleyebilirsiniz.
          </p>
        </CardContent>
      </Card>

      <Card className="glass-effect border-white/10 shadow-lg">
        <CardHeader className="border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Bell className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-xl">Fiyat Alarmı Kullanımı</CardTitle>
              <CardDescription>Aktif ve geçmiş alarm sayılarınız</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <AlertTile
              title="Spot Alarmlar"
              active={spotActiveAlerts}
              inactive={spotInactiveAlerts}
            />
            <AlertTile
              title="Vadeli Alarmlar"
              active={futuresActiveAlerts}
              inactive={futuresInactiveAlerts}
            />
          </div>
          <div className="rounded-lg border border-dashed border-white/20 p-4 text-sm text-muted-foreground space-y-2">
            <p className="font-medium text-foreground">Toplam Aktif Alarm: {totalActiveAlerts}</p>
            <p className="text-xs">
              Premium kullanıcılar her coin için yukarı/aşağı olmak üzere iki ayrı alarm tanımlayabilir. Gerçekleşen
              alarmlar pasif durumuna düşer ve geçmişte saklanır.
            </p>
            <div className="flex gap-3">
              <Button asChild size="sm" variant="secondary" className="cursor-pointer">
                <Link href="/spot-watchlist">Spot alarmları yönet</Link>
              </Button>
              <Button asChild size="sm" variant="secondary" className="cursor-pointer">
                <Link href="/futures-watchlist">Vadeli alarmları yönet</Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function WatchlistTile({
  title,
  count,
  limit,
  href,
  className,
}: {
  title: string
  count: number
  limit: number
  href: string
  className?: string
}) {
  return (
    <div className={cn('rounded-lg border border-white/10 p-4 space-y-2', className)}>
      <p className="font-semibold text-primary">{title}</p>
      <p className="text-2xl font-bold">
        {count} <span className="text-base text-muted-foreground">/ {limit}</span>
      </p>
      <p className="text-muted-foreground">
        {Math.max(limit - count, 0)} coin ekleyebilirsiniz.
      </p>
      <Button asChild size="sm" variant="outline" className="text-primary border-primary/30 hover:bg-primary/10 cursor-pointer">
        <Link href={href}>{title.includes('Vadeli') ? 'Vadeli takip listesine git' : 'Spot takip listesine git'}</Link>
      </Button>
    </div>
  )
}

function AlertTile({ title, active, inactive }: { title: string; active: number; inactive: number }) {
  return (
    <div className="rounded-lg border border-white/10 bg-primary/5 p-4 space-y-2">
      <p className="font-semibold text-primary">{title}</p>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold">{active}</span>
        <span className="text-xs uppercase tracking-wide text-muted-foreground">aktif</span>
      </div>
      <p className="text-muted-foreground">Pasif/Gerçekleşen: {inactive}</p>
    </div>
  )
}
