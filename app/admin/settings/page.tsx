'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Shield, Save, Info } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

interface Settings {
  spotVolumeThreshold: number
  futuresVolumeThreshold: number
}

export default function AdminSettingsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState<Settings>({
    spotVolumeThreshold: 400000,
    futuresVolumeThreshold: 600000,
  })
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/settings')
      if (res.status === 403) {
        setError('Admin yetkisi gerekli')
        router.push('/admin')
        return
      }
      if (res.status === 401) {
        setError('Giriş yapmanız gerekiyor')
        router.push('/login')
        return
      }
      if (!res.ok) {
        throw new Error('Ayarlar yüklenemedi')
      }
      const data = await res.json()
      setSettings(data.settings)
    } catch (error) {
      console.error('Failed to fetch settings:', error)
      setError('Ayarlar yüklenemedi')
      toast.error('Ayarlar yüklenemedi')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Ayarlar kaydedilemedi')
      }

      toast.success('Ayarlar başarıyla kaydedildi')
    } catch (error: any) {
      console.error('Failed to save settings:', error)
      toast.error(error.message || 'Ayarlar kaydedilemedi')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center py-12 text-muted-foreground">Yükleniyor...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold mb-4">Hata</h1>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Sistem Ayarları</h1>
          <p className="text-muted-foreground">Hacim uyarı limitlerini yönetin</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/admin">
            <Shield className="mr-2 h-4 w-4" />
            Admin Paneli
          </Link>
        </Button>
      </div>

      {/* Info Card */}
      <Card className="mb-6 border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-900 dark:text-blue-100">
            <Info className="h-5 w-5" />
            Hacim Uyarı Sistemi
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-blue-800 dark:text-blue-200">
            Bu ayarlar, Binance üzerinden gelen coin hacimlerini izleyen worker sistemini kontrol eder.
            Belirlediğiniz limitlerin üzerinde hacim görüldüğünde, tüm kullanıcılara otomatik olarak
            push bildirimi gönderilir. Worker sistemi bu limitleri periyodik olarak kontrol eder ve
            güncellemeleri otomatik olarak uygular.
          </p>
        </CardContent>
      </Card>

      {/* Settings Form */}
      <Card>
        <CardHeader>
          <CardTitle>Hacim Limitleri</CardTitle>
          <CardDescription>
            Spot ve vadeli piyasa hacim uyarı eşiklerini belirleyin (USD cinsinden)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="spotVolumeThreshold">Spot Hacim Limiti (USD)</Label>
            <Input
              id="spotVolumeThreshold"
              type="number"
              min="0"
              step="1000"
              value={settings.spotVolumeThreshold}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  spotVolumeThreshold: parseFloat(e.target.value) || 0,
                })
              }
              placeholder="400000"
            />
            <p className="text-sm text-muted-foreground">
              Spot piyasada 15 dakikalık hacim bu değeri aştığında bildirim gönderilir
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="futuresVolumeThreshold">Vadeli Hacim Limiti (USD)</Label>
            <Input
              id="futuresVolumeThreshold"
              type="number"
              min="0"
              step="1000"
              value={settings.futuresVolumeThreshold}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  futuresVolumeThreshold: parseFloat(e.target.value) || 0,
                })
              }
              placeholder="600000"
            />
            <p className="text-sm text-muted-foreground">
              Vadeli piyasada 15 dakikalık hacim bu değeri aştığında bildirim gönderilir
            </p>
          </div>

          <div className="flex justify-end pt-4">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <span className="mr-2">Kaydediliyor...</span>
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Kaydet
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
