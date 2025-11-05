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
  Building2,
  Plus,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  Copy,
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

interface BankAccount {
  id: string
  bankName: string
  iban: string
  accountHolder: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export default function AdminBankAccountPage() {
  const router = useRouter()
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [selectedAccount, setSelectedAccount] = useState<BankAccount | null>(null)
  const [processing, setProcessing] = useState(false)

  // Form states
  const [bankName, setBankName] = useState('')
  const [iban, setIban] = useState('')
  const [accountHolder, setAccountHolder] = useState('')
  const [isActive, setIsActive] = useState(true)

  useEffect(() => {
    fetchBankAccounts()
  }, [])

  const fetchBankAccounts = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/bank-account')
      if (!res.ok) {
        if (res.status === 403) {
          toast.error('Admin erişimi gerekli')
          router.push('/')
          return
        }
        throw new Error('Failed to fetch bank accounts')
      }
      const data = await res.json()
      setBankAccounts(data.bankAccounts || [])
    } catch (err: any) {
      console.error('Bank accounts fetch error:', err)
      setError(err.message || 'Banka hesapları yüklenirken bir hata oluştu')
      toast.error(err.message || 'Banka hesapları yüklenirken bir hata oluştu')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateClick = () => {
    setBankName('')
    setIban('')
    setAccountHolder('')
    setIsActive(true)
    setCreateModalOpen(true)
  }

  const handleEditClick = (account: BankAccount) => {
    setSelectedAccount(account)
    setBankName(account.bankName)
    setIban(account.iban)
    setAccountHolder(account.accountHolder)
    setIsActive(account.isActive)
    setEditModalOpen(true)
  }

  const handleDeleteClick = (account: BankAccount) => {
    setSelectedAccount(account)
    setDeleteModalOpen(true)
  }

  const handleCreate = async () => {
    if (!bankName.trim() || !iban.trim() || !accountHolder.trim()) {
      toast.error('Lütfen tüm alanları doldurun')
      return
    }

    setProcessing(true)
    try {
      const res = await fetch('/api/admin/bank-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bankName: bankName.trim(),
          iban: iban.trim(),
          accountHolder: accountHolder.trim(),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Banka hesabı oluşturulamadı')
        return
      }

      toast.success('Banka hesabı başarıyla oluşturuldu')
      setCreateModalOpen(false)
      fetchBankAccounts()
    } catch (err: any) {
      console.error('Create bank account error:', err)
      toast.error('Bir hata oluştu')
    } finally {
      setProcessing(false)
    }
  }

  const handleUpdate = async () => {
    if (!selectedAccount) return
    if (!bankName.trim() || !iban.trim() || !accountHolder.trim()) {
      toast.error('Lütfen tüm alanları doldurun')
      return
    }

    setProcessing(true)
    try {
      const res = await fetch(`/api/admin/bank-account/${selectedAccount.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bankName: bankName.trim(),
          iban: iban.trim(),
          accountHolder: accountHolder.trim(),
          isActive,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Banka hesabı güncellenemedi')
        return
      }

      toast.success('Banka hesabı başarıyla güncellendi')
      setEditModalOpen(false)
      setSelectedAccount(null)
      fetchBankAccounts()
    } catch (err: any) {
      console.error('Update bank account error:', err)
      toast.error('Bir hata oluştu')
    } finally {
      setProcessing(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedAccount) return

    setProcessing(true)
    try {
      const res = await fetch(`/api/admin/bank-account/${selectedAccount.id}`, {
        method: 'DELETE',
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Banka hesabı silinemedi')
        return
      }

      toast.success('Banka hesabı başarıyla silindi')
      setDeleteModalOpen(false)
      setSelectedAccount(null)
      fetchBankAccounts()
    } catch (err: any) {
      console.error('Delete bank account error:', err)
      toast.error('Bir hata oluştu')
    } finally {
      setProcessing(false)
    }
  }

  const handleCopyIban = (iban: string) => {
    navigator.clipboard.writeText(iban.replace(/\s/g, ''))
    toast.success('IBAN kopyalandı!')
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
              <Building2 className="h-6 w-6 text-primary" />
              <CardTitle>Banka Hesap Bilgileri</CardTitle>
            </div>
            <Button onClick={handleCreateClick} className="cursor-pointer">
              <Plus className="h-4 w-4 mr-2" />
              Yeni Hesap Ekle
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="text-center py-8 text-destructive">{error}</div>
          ) : bankAccounts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Henüz banka hesabı eklenmemiş
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Banka Adı</TableHead>
                  <TableHead>Hesap Sahibi</TableHead>
                  <TableHead>IBAN</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead>İşlemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bankAccounts.map((account) => (
                  <TableRow key={account.id}>
                    <TableCell className="font-medium">{account.bankName}</TableCell>
                    <TableCell>{account.accountHolder}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-mono">{account.iban}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopyIban(account.iban)}
                          className="h-6 w-6 p-0 cursor-pointer"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={account.isActive ? 'default' : 'secondary'}
                        className={
                          account.isActive
                            ? 'bg-green-500/20 text-green-400 border-green-500/30'
                            : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                        }
                      >
                        {account.isActive ? (
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
                          onClick={() => handleEditClick(account)}
                          className="cursor-pointer"
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          Düzenle
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteClick(account)}
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
            <DialogTitle>Yeni Banka Hesabı Ekle</DialogTitle>
            <DialogDescription>
              Checkout sayfasında gösterilecek banka hesap bilgilerini ekleyin
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="bankName">Banka Adı</Label>
              <Input
                id="bankName"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="Örn: Garanti BBVA"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="iban">IBAN</Label>
              <Input
                id="iban"
                value={iban}
                onChange={(e) => setIban(e.target.value)}
                placeholder="TR00 0000 0000 0000 0000 0000 00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="accountHolder">Hesap Sahibi</Label>
              <Input
                id="accountHolder"
                value={accountHolder}
                onChange={(e) => setAccountHolder(e.target.value)}
                placeholder="Örn: Oruba Coin"
              />
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
            <DialogTitle>Banka Hesabı Düzenle</DialogTitle>
            <DialogDescription>
              Banka hesap bilgilerini güncelleyin
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="editBankName">Banka Adı</Label>
              <Input
                id="editBankName"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="Örn: Garanti BBVA"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editIban">IBAN</Label>
              <Input
                id="editIban"
                value={iban}
                onChange={(e) => setIban(e.target.value)}
                placeholder="TR00 0000 0000 0000 0000 0000 00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editAccountHolder">Hesap Sahibi</Label>
              <Input
                id="editAccountHolder"
                value={accountHolder}
                onChange={(e) => setAccountHolder(e.target.value)}
                placeholder="Örn: Oruba Coin"
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
                setSelectedAccount(null)
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
            <DialogTitle>Banka Hesabını Sil</DialogTitle>
            <DialogDescription>
              Bu banka hesabını silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.
            </DialogDescription>
          </DialogHeader>
          {selectedAccount && (
            <div className="py-4">
              <div className="space-y-2">
                <div>
                  <span className="font-semibold">Banka:</span> {selectedAccount.bankName}
                </div>
                <div>
                  <span className="font-semibold">Hesap Sahibi:</span> {selectedAccount.accountHolder}
                </div>
                <div>
                  <span className="font-semibold">IBAN:</span> {selectedAccount.iban}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteModalOpen(false)
                setSelectedAccount(null)
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

