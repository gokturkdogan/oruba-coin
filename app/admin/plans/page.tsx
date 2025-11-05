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
  CreditCard,
  Plus,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'

interface Plan {
  id: string
  name: string
  price: number
  durationDays: number
  isActive: boolean
  displayOrder: number
  createdAt: string
  updatedAt: string
}

export default function AdminPlansPage() {
  const router = useRouter()
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null)
  const [processing, setProcessing] = useState(false)

  // Form states
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [durationDays, setDurationDays] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [displayOrder, setDisplayOrder] = useState('0')

  useEffect(() => {
    fetchPlans()
  }, [])

  const fetchPlans = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/plans')
      if (!res.ok) {
        if (res.status === 403) {
          toast.error('Admin erişimi gerekli')
          router.push('/')
          return
        }
        throw new Error('Failed to fetch plans')
      }
      const data = await res.json()
      setPlans(data.plans || [])
    } catch (err: any) {
      console.error('Plans fetch error:', err)
      setError(err.message || 'Planlar yüklenirken bir hata oluştu')
      toast.error(err.message || 'Planlar yüklenirken bir hata oluştu')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateClick = () => {
    setName('')
    setPrice('')
    setDurationDays('')
    setIsActive(true)
    setDisplayOrder('0')
    setCreateModalOpen(true)
  }

  const handleEditClick = (plan: Plan) => {
    setSelectedPlan(plan)
    setName(plan.name)
    setPrice(plan.price.toString())
    setDurationDays(plan.durationDays.toString())
    setIsActive(plan.isActive)
    setDisplayOrder(plan.displayOrder.toString())
    setEditModalOpen(true)
  }

  const handleDeleteClick = (plan: Plan) => {
    setSelectedPlan(plan)
    setDeleteModalOpen(true)
  }

  const handleCreate = async () => {
    if (!name.trim() || !price.trim() || !durationDays.trim()) {
      toast.error('Lütfen tüm alanları doldurun')
      return
    }

    const priceNum = parseFloat(price)
    const durationNum = parseInt(durationDays)
    const orderNum = parseInt(displayOrder) || 0

    if (isNaN(priceNum) || priceNum <= 0) {
      toast.error('Geçerli bir fiyat girin')
      return
    }

    if (isNaN(durationNum) || durationNum <= 0) {
      toast.error('Geçerli bir süre girin (gün cinsinden)')
      return
    }

    setProcessing(true)
    try {
      const res = await fetch('/api/admin/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          price: priceNum,
          durationDays: durationNum,
          displayOrder: orderNum,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Plan oluşturulamadı')
        return
      }

      toast.success('Plan başarıyla oluşturuldu')
      setCreateModalOpen(false)
      fetchPlans()
    } catch (err: any) {
      console.error('Create plan error:', err)
      toast.error('Bir hata oluştu')
    } finally {
      setProcessing(false)
    }
  }

  const handleUpdate = async () => {
    if (!selectedPlan) return
    if (!name.trim() || !price.trim() || !durationDays.trim()) {
      toast.error('Lütfen tüm alanları doldurun')
      return
    }

    const priceNum = parseFloat(price)
    const durationNum = parseInt(durationDays)
    const orderNum = parseInt(displayOrder) || 0

    if (isNaN(priceNum) || priceNum <= 0) {
      toast.error('Geçerli bir fiyat girin')
      return
    }

    if (isNaN(durationNum) || durationNum <= 0) {
      toast.error('Geçerli bir süre girin (gün cinsinden)')
      return
    }

    setProcessing(true)
    try {
      const res = await fetch(`/api/admin/plans/${selectedPlan.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          price: priceNum,
          durationDays: durationNum,
          isActive,
          displayOrder: orderNum,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Plan güncellenemedi')
        return
      }

      toast.success('Plan başarıyla güncellendi')
      setEditModalOpen(false)
      setSelectedPlan(null)
      fetchPlans()
    } catch (err: any) {
      console.error('Update plan error:', err)
      toast.error('Bir hata oluştu')
    } finally {
      setProcessing(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedPlan) return

    setProcessing(true)
    try {
      const res = await fetch(`/api/admin/plans/${selectedPlan.id}`, {
        method: 'DELETE',
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Plan silinemedi')
        return
      }

      toast.success('Plan başarıyla silindi')
      setDeleteModalOpen(false)
      setSelectedPlan(null)
      fetchPlans()
    } catch (err: any) {
      console.error('Delete plan error:', err)
      toast.error('Bir hata oluştu')
    } finally {
      setProcessing(false)
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

  if (loading) {
    return (
      <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center py-12 text-muted-foreground">Yükleniyor...</div>
      </div>
    )
  }

  return (
    <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CreditCard className="h-6 w-6 text-primary" />
              <CardTitle>Premium Planlar</CardTitle>
            </div>
            <Button onClick={handleCreateClick} className="cursor-pointer">
              <Plus className="h-4 w-4 mr-2" />
              Yeni Plan Ekle
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="text-center py-8 text-destructive">{error}</div>
          ) : plans.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Henüz plan eklenmemiş
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sıra</TableHead>
                  <TableHead>Plan Adı</TableHead>
                  <TableHead>Fiyat</TableHead>
                  <TableHead>Süre</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead>İşlemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plans.map((plan) => (
                  <TableRow key={plan.id}>
                    <TableCell className="font-medium">{plan.displayOrder}</TableCell>
                    <TableCell className="font-medium">{plan.name}</TableCell>
                    <TableCell>₺{plan.price.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                    <TableCell>{formatDuration(plan.durationDays)}</TableCell>
                    <TableCell>
                      <Badge
                        variant={plan.isActive ? 'default' : 'secondary'}
                        className={
                          plan.isActive
                            ? 'bg-green-500/20 text-green-400 border-green-500/30'
                            : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                        }
                      >
                        {plan.isActive ? (
                          <>
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Aktif
                          </>
                        ) : (
                          <>
                            <XCircle className="h-3 w-3 mr-1" />
                            Pasif
                          </>
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditClick(plan)}
                          className="cursor-pointer"
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          Düzenle
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteClick(plan)}
                          className="cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Sil
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Modal */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Yeni Plan Ekle</DialogTitle>
            <DialogDescription>
              Checkout sayfasında gösterilecek yeni bir premium planı ekleyin
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="planName">Plan Adı</Label>
              <Input
                id="planName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Örn: Aylık Plan"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="planPrice">Fiyat (₺)</Label>
              <Input
                id="planPrice"
                type="number"
                step="0.01"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="Örn: 99.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="planDuration">Süre (Gün)</Label>
              <Input
                id="planDuration"
                type="number"
                min="1"
                value={durationDays}
                onChange={(e) => setDurationDays(e.target.value)}
                placeholder="Örn: 30 (1 ay), 365 (1 yıl)"
              />
              <p className="text-xs text-muted-foreground">
                Planın kaç gün süreceğini girin (30 = 1 ay, 365 = 1 yıl)
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="planOrder">Sıralama</Label>
              <Input
                id="planOrder"
                type="number"
                min="0"
                value={displayOrder}
                onChange={(e) => setDisplayOrder(e.target.value)}
                placeholder="0"
              />
              <p className="text-xs text-muted-foreground">
                Checkout sayfasında görüntülenme sırası (düşük sayı önce görünür)
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateModalOpen(false)}
              className="cursor-pointer"
            >
              İptal
            </Button>
            <Button onClick={handleCreate} disabled={processing} className="cursor-pointer">
              {processing ? 'Oluşturuluyor...' : 'Oluştur'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Plan Düzenle</DialogTitle>
            <DialogDescription>
              Plan bilgilerini güncelleyin
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="editPlanName">Plan Adı</Label>
              <Input
                id="editPlanName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Örn: Aylık Plan"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editPlanPrice">Fiyat (₺)</Label>
              <Input
                id="editPlanPrice"
                type="number"
                step="0.01"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="Örn: 99.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editPlanDuration">Süre (Gün)</Label>
              <Input
                id="editPlanDuration"
                type="number"
                min="1"
                value={durationDays}
                onChange={(e) => setDurationDays(e.target.value)}
                placeholder="Örn: 30"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editPlanOrder">Sıralama</Label>
              <Input
                id="editPlanOrder"
                type="number"
                min="0"
                value={displayOrder}
                onChange={(e) => setDisplayOrder(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="editIsActive"
                checked={isActive}
                onCheckedChange={(checked) => setIsActive(checked === true)}
                className="cursor-pointer"
              />
              <Label htmlFor="editIsActive" className="cursor-pointer">
                Aktif (Checkout sayfasında gösterilecek)
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditModalOpen(false)
                setSelectedPlan(null)
              }}
              className="cursor-pointer"
            >
              İptal
            </Button>
            <Button onClick={handleUpdate} disabled={processing} className="cursor-pointer">
              {processing ? 'Güncelleniyor...' : 'Güncelle'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Modal */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Planı Sil</DialogTitle>
            <DialogDescription>
              Bu planı silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.
            </DialogDescription>
          </DialogHeader>
          {selectedPlan && (
            <div className="py-4">
              <div className="space-y-2">
                <div>
                  <span className="font-semibold">Plan:</span> {selectedPlan.name}
                </div>
                <div>
                  <span className="font-semibold">Fiyat:</span> ₺{selectedPlan.price.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                </div>
                <div>
                  <span className="font-semibold">Süre:</span> {formatDuration(selectedPlan.durationDays)}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteModalOpen(false)
                setSelectedPlan(null)
              }}
              className="cursor-pointer"
            >
              İptal
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={processing}
              className="cursor-pointer"
            >
              {processing ? 'Siliniyor...' : 'Sil'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

