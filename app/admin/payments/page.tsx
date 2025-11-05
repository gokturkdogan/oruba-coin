'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import {
  Clock,
  CheckCircle,
  XCircle,
  Eye,
  Calendar as CalendarIcon,
  DollarSign,
  User,
  Mail,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { format } from 'date-fns'
import { tr } from 'date-fns/locale'

interface PendingPayment {
  id: string
  userId: string
  userEmail: string
  userName: string | null
  plan: string
  amount: number
  status: string
  currentPeriodEnd: string | null
  adminNotes: string | null
  createdAt: string
  updatedAt: string
}

export default function AdminPaymentsPage() {
  const router = useRouter()
  const [payments, setPayments] = useState<PendingPayment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('pending')
  const [approveModalOpen, setApproveModalOpen] = useState(false)
  const [rejectModalOpen, setRejectModalOpen] = useState(false)
  const [selectedPayment, setSelectedPayment] = useState<PendingPayment | null>(null)
  const [periodEndDate, setPeriodEndDate] = useState<Date | undefined>(undefined)
  const [adminNotes, setAdminNotes] = useState('')
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    fetchPayments()
  }, [statusFilter])

  const fetchPayments = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/subscription/pending-payments?status=${statusFilter}`)
      if (!res.ok) {
        if (res.status === 403) {
          toast.error('Admin erişimi gerekli')
          router.push('/')
          return
        }
        throw new Error('Failed to fetch payments')
      }
      const data = await res.json()
      setPayments(data.payments)
    } catch (err: any) {
      console.error('Payments fetch error:', err)
      setError(err.message || 'Ödeme verileri yüklenirken bir hata oluştu')
      toast.error(err.message || 'Ödeme verileri yüklenirken bir hata oluştu')
    } finally {
      setLoading(false)
    }
  }

  const handleApproveClick = async (payment: PendingPayment) => {
    setSelectedPayment(payment)
    setAdminNotes('')
    
    // Fetch plan from database to get duration
    try {
      const plansRes = await fetch('/api/admin/plans?activeOnly=false')
      if (plansRes.ok) {
        const plansData = await plansRes.json()
        const matchingPlan = plansData.plans?.find((p: any) => p.name === payment.plan)
        
        if (matchingPlan) {
          // Set default period end date based on plan duration
          const today = new Date()
          today.setDate(today.getDate() + matchingPlan.durationDays)
          setPeriodEndDate(today)
        } else {
          // Fallback: try to infer from plan name or use 30 days default
          const today = new Date()
          const planNameLower = payment.plan.toLowerCase()
          if (planNameLower.includes('aylık') || planNameLower.includes('monthly')) {
            today.setMonth(today.getMonth() + 1)
          } else if (planNameLower.includes('yıllık') || planNameLower.includes('yearly') || planNameLower.includes('yıl')) {
            today.setFullYear(today.getFullYear() + 1)
          } else {
            // Default to 30 days if unknown
            today.setDate(today.getDate() + 30)
          }
          setPeriodEndDate(today)
        }
      } else {
        // Fallback: try to infer from plan name or use 30 days default
        const today = new Date()
        const planNameLower = payment.plan.toLowerCase()
        if (planNameLower.includes('aylık') || planNameLower.includes('monthly')) {
          today.setMonth(today.getMonth() + 1)
        } else if (planNameLower.includes('yıllık') || planNameLower.includes('yearly') || planNameLower.includes('yıl')) {
          today.setFullYear(today.getFullYear() + 1)
        } else {
          // Default to 30 days if unknown
          today.setDate(today.getDate() + 30)
        }
        setPeriodEndDate(today)
      }
    } catch (error) {
      // Fallback: try to infer from plan name or use 30 days default
      const today = new Date()
      const planNameLower = payment.plan.toLowerCase()
      if (planNameLower.includes('aylık') || planNameLower.includes('monthly')) {
        today.setMonth(today.getMonth() + 1)
      } else if (planNameLower.includes('yıllık') || planNameLower.includes('yearly') || planNameLower.includes('yıl')) {
        today.setFullYear(today.getFullYear() + 1)
      } else {
        // Default to 30 days if unknown
        today.setDate(today.getDate() + 30)
      }
      setPeriodEndDate(today)
    }
    
    setApproveModalOpen(true)
  }

  const handleRejectClick = (payment: PendingPayment) => {
    setSelectedPayment(payment)
    setAdminNotes('')
    setRejectModalOpen(true)
  }

  const handleApprove = async () => {
    if (!selectedPayment || !periodEndDate) return

    setProcessing(true)
    try {
      // Set time to end of day (23:59:59)
      const endDate = new Date(periodEndDate)
      endDate.setHours(23, 59, 59, 999)

      const res = await fetch(`/api/subscription/pending-payments/${selectedPayment.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve',
          currentPeriodEnd: endDate.toISOString(),
          adminNotes: adminNotes || undefined,
        }),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Ödeme onaylanamadı')
      }

      toast.success('Ödeme onaylandı ve abonelik aktifleştirildi')
      setApproveModalOpen(false)
      setSelectedPayment(null)
      fetchPayments()
    } catch (err: any) {
      console.error('Failed to approve payment:', err)
      toast.error(err.message || 'Ödeme onaylanırken bir hata oluştu')
    } finally {
      setProcessing(false)
    }
  }

  const handleReject = async () => {
    if (!selectedPayment) return

    setProcessing(true)
    try {
      const res = await fetch(`/api/subscription/pending-payments/${selectedPayment.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reject',
          adminNotes: adminNotes || undefined,
        }),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Ödeme reddedilemedi')
      }

      toast.success('Ödeme reddedildi')
      setRejectModalOpen(false)
      setSelectedPayment(null)
      fetchPayments()
    } catch (err: any) {
      console.error('Failed to reject payment:', err)
      toast.error(err.message || 'Ödeme reddedilirken bir hata oluştu')
    } finally {
      setProcessing(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-400 border-yellow-500/30">
            <Clock className="h-3 w-3 mr-1" /> Beklemede
          </Badge>
        )
      case 'approved':
        return (
          <Badge variant="secondary" className="bg-green-500/10 text-green-400 border-green-500/30">
            <CheckCircle className="h-3 w-3 mr-1" /> Onaylandı
          </Badge>
        )
      case 'rejected':
        return (
          <Badge variant="secondary" className="bg-red-500/10 text-red-400 border-red-500/30">
            <XCircle className="h-3 w-3 mr-1" /> Reddedildi
          </Badge>
        )
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  if (loading) {
    return (
      <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center text-muted-foreground">
        Ödemeler yükleniyor...
      </div>
    )
  }

  if (error) {
    return (
      <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center text-red-500">
        <h1 className="text-2xl font-bold mb-4">Erişim Reddedildi</h1>
        <p>{error}</p>
      </div>
    )
  }

  return (
    <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-4xl font-bold gradient-text mb-8">Bekleyen Ödemeler</h1>

      {/* Status Filter */}
      <Card className="mb-6 bg-gradient-to-br from-background/95 to-background/80 border-border/50 shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl">Ödeme Listesi</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex gap-2">
            <Button
              variant={statusFilter === 'pending' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('pending')}
            >
              Bekleyenler
            </Button>
            <Button
              variant={statusFilter === 'approved' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('approved')}
            >
              Onaylananlar
            </Button>
            <Button
              variant={statusFilter === 'rejected' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('rejected')}
            >
              Reddedilenler
            </Button>
            <Button
              variant={statusFilter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('all')}
            >
              Tümü
            </Button>
          </div>

          <div className="rounded-md border bg-background/50">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">Kullanıcı</TableHead>
                  <TableHead className="w-[120px]">Plan</TableHead>
                  <TableHead className="w-[120px]">Tutar</TableHead>
                  <TableHead className="w-[150px]">Durum</TableHead>
                  <TableHead className="w-[180px]">Bitiş Tarihi</TableHead>
                  <TableHead className="w-[150px]">Oluşturulma</TableHead>
                  <TableHead className="w-[200px] text-right">İşlemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      Ödeme bulunamadı.
                    </TableCell>
                  </TableRow>
                ) : (
                  payments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{payment.userName || 'N/A'}</div>
                          <div className="text-sm text-muted-foreground">{payment.userEmail}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {payment.plan}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-semibold">₺{payment.amount}</TableCell>
                      <TableCell>{getStatusBadge(payment.status)}</TableCell>
                      <TableCell>
                        {payment.currentPeriodEnd ? (
                          <div className="text-sm">
                            {new Date(payment.currentPeriodEnd).toLocaleDateString('tr-TR', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                            })}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(payment.createdAt).toLocaleDateString('tr-TR')}
                      </TableCell>
                      <TableCell className="text-right">
                        {payment.status === 'pending' && (
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleApproveClick(payment)}
                              className="text-green-400 hover:text-green-300 hover:bg-green-500/10"
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Onayla
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRejectClick(payment)}
                              className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                            >
                              <XCircle className="h-4 w-4 mr-1" />
                              Reddet
                            </Button>
                          </div>
                        )}
                        {payment.status !== 'pending' && payment.adminNotes && (
                          <div className="text-xs text-muted-foreground">
                            {payment.adminNotes}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Approve Modal */}
      <Dialog open={approveModalOpen} onOpenChange={setApproveModalOpen}>
        <DialogContent className="sm:max-w-[500px] bg-background/95 backdrop-blur-lg border-white/10 shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold gradient-text">Ödemeyi Onayla</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {selectedPayment?.userEmail} için ödemeyi onaylayın ve aboneliği aktifleştirin.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Abonelik Bitiş Tarihi</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={`w-full justify-start text-left font-normal ${
                      !periodEndDate ? 'text-muted-foreground' : ''
                    }`}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {periodEndDate ? (
                      format(periodEndDate, 'PPP', { locale: tr })
                    ) : (
                      <span>Tarih seçin</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={periodEndDate}
                    onSelect={setPeriodEndDate}
                    disabled={(date) => date < new Date()}
                    initialFocus
                    locale={tr}
                  />
                </PopoverContent>
              </Popover>
              <p className="text-xs text-muted-foreground">
                Plan: {selectedPayment?.plan} • 
                Tutar: ₺{selectedPayment?.amount}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="adminNotes">Notlar (Opsiyonel)</Label>
              <Input
                id="adminNotes"
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Ödeme ile ilgili notlar..."
                className="w-full"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveModalOpen(false)}>
              İptal
            </Button>
            <Button onClick={handleApprove} disabled={processing || !periodEndDate}>
              {processing ? 'İşleniyor...' : 'Onayla ve Aktifleştir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Modal */}
      <Dialog open={rejectModalOpen} onOpenChange={setRejectModalOpen}>
        <DialogContent className="sm:max-w-[500px] bg-background/95 backdrop-blur-lg border-white/10 shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold gradient-text">Ödemeyi Reddet</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {selectedPayment?.userEmail} için ödemeyi reddetmek istediğinizden emin misiniz?
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="rejectNotes">Red Nedeni (Opsiyonel)</Label>
              <Input
                id="rejectNotes"
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Red nedeni..."
                className="w-full"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectModalOpen(false)}>
              İptal
            </Button>
            <Button
              onClick={handleReject}
              disabled={processing}
              className="bg-red-500 hover:bg-red-600"
            >
              {processing ? 'İşleniyor...' : 'Reddet'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

