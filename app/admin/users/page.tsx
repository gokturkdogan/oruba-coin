'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Users, Search, Edit, Shield, Mail, UserCheck } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { formatNumberTR } from '@/lib/utils'

interface User {
  id: string
  email: string
  name: string | null
  isVerified: boolean
  isAdmin: boolean
  createdAt: string
  subscription: {
    plan: string
    status: string
    currentPeriodEnd: string
  } | null
  watchlistCount: number
  priceAlertCount: number
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export default function AdminUsersPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<User[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [page, setPage] = useState(1)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [editData, setEditData] = useState({
    name: '',
    isVerified: false,
    isAdmin: false,
  })

  useEffect(() => {
    fetchUsers()
  }, [page, search])

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      })
      if (search) {
        params.append('search', search)
      }

      const res = await fetch(`/api/admin/users?${params}`)
      
      if (res.status === 403) {
        toast.error('Admin yetkisi gerekli')
        router.push('/admin')
        return
      }
      if (res.status === 401) {
        toast.error('Giriş yapmanız gerekiyor')
        router.push('/login')
        return
      }
      if (!res.ok) {
        toast.error('Kullanıcılar yüklenemedi')
        return
      }

      const data = await res.json()
      setUsers(data.users)
      setPagination(data.pagination)
    } catch (error) {
      console.error('Failed to fetch users:', error)
      toast.error('Kullanıcılar yüklenemedi')
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setSearch(searchInput)
    setPage(1)
  }

  const handleEdit = (user: User) => {
    setSelectedUser(user)
    setEditData({
      name: user.name || '',
      isVerified: user.isVerified,
      isAdmin: user.isAdmin,
    })
    setEditDialogOpen(true)
  }

  const handleUpdate = async () => {
    if (!selectedUser) return

    try {
      const res = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editData),
      })

      if (!res.ok) {
        const error = await res.json()
        toast.error(error.error || 'Kullanıcı güncellenemedi')
        return
      }

      toast.success('Kullanıcı güncellendi')
      setEditDialogOpen(false)
      fetchUsers()
    } catch (error) {
      console.error('Failed to update user:', error)
      toast.error('Kullanıcı güncellenemedi')
    }
  }

  if (loading && users.length === 0) {
    return (
      <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center py-12 text-muted-foreground">Yükleniyor...</div>
      </div>
    )
  }

  return (
    <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Kullanıcı Yönetimi</h1>
          <p className="text-muted-foreground">Tüm kullanıcıları görüntüleyin ve yönetin</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/admin">
            <Shield className="mr-2 h-4 w-4" />
            Admin Paneli
          </Link>
        </Button>
      </div>

      {/* Search */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Email veya isim ile ara..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button type="submit">Ara</Button>
            {search && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSearchInput('')
                  setSearch('')
                  setPage(1)
                }}
              >
                Temizle
              </Button>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>Kullanıcılar</CardTitle>
          <CardDescription>
            {pagination && (
              <>
                Toplam {formatNumberTR(pagination.total)} kullanıcı
                {search && ` - "${search}" için sonuçlar`}
              </>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {search ? 'Arama sonucu bulunamadı' : 'Henüz kullanıcı yok'}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Kullanıcı</th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Durum</th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Abonelik</th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">İstatistikler</th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Kayıt Tarihi</th>
                      <th className="text-right p-4 text-sm font-medium text-muted-foreground">İşlemler</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id} className="border-b border-border/50 hover:bg-accent/50 transition-colors">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
                              <Users className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium">{user.name || 'İsimsiz'}</p>
                              <p className="text-sm text-muted-foreground">{user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex flex-col gap-1">
                            {user.isVerified ? (
                              <Badge variant="default" className="w-fit">
                                <Mail className="mr-1 h-3 w-3" />
                                Doğrulanmış
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="w-fit">
                                Beklemede
                              </Badge>
                            )}
                            {user.isAdmin && (
                              <Badge variant="outline" className="w-fit bg-purple-500/10 text-purple-500 border-purple-500/20">
                                <Shield className="mr-1 h-3 w-3" />
                                Admin
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="p-4">
                          {user.subscription?.status === 'active' ? (
                            <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
                              Premium
                            </Badge>
                          ) : (
                            <span className="text-sm text-muted-foreground">Standart</span>
                          )}
                        </td>
                        <td className="p-4">
                          <div className="flex flex-col gap-1 text-sm">
                            <span className="text-muted-foreground">
                              Watchlist: <span className="font-medium text-foreground">{user.watchlistCount}</span>
                            </span>
                            <span className="text-muted-foreground">
                              Alarm: <span className="font-medium text-foreground">{user.priceAlertCount}</span>
                            </span>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className="text-sm text-muted-foreground">
                            {new Date(user.createdAt).toLocaleDateString('tr-TR', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                            })}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEdit(user)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-6 pt-6 border-t border-border">
                  <div className="text-sm text-muted-foreground">
                    Sayfa {pagination.page} / {pagination.totalPages}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      Önceki
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                      disabled={page === pagination.totalPages}
                    >
                      Sonraki
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kullanıcı Düzenle</DialogTitle>
            <DialogDescription>
              {selectedUser?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="name">İsim</Label>
              <Input
                id="name"
                value={editData.name}
                onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                placeholder="Kullanıcı adı"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="isVerified"
                checked={editData.isVerified}
                onCheckedChange={(checked) => setEditData({ ...editData, isVerified: checked === true })}
              />
              <Label htmlFor="isVerified" className="cursor-pointer">
                Email doğrulanmış
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="isAdmin"
                checked={editData.isAdmin}
                onCheckedChange={(checked) => setEditData({ ...editData, isAdmin: checked === true })}
              />
              <Label htmlFor="isAdmin" className="cursor-pointer">
                Admin yetkisi
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              İptal
            </Button>
            <Button onClick={handleUpdate}>
              Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

