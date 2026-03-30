'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Shield,
  Save,
  Info,
  RefreshCw,
  CircleCheck,
  CircleOff,
  Loader2,
  AlertTriangle,
  Server,
} from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

interface Settings {
  spotVolumeThreshold: number
  futuresVolumeThreshold: number
}

type WorkerFlySummary =
  | 'all_running'
  | 'all_stopped'
  | 'transitioning'
  | 'partial'
  | 'none'
  | 'unknown'

type WorkerStatusPayload =
  | { configured: false; error: string }
  | {
      configured: true
      appName: string
      summary: WorkerFlySummary
      machines: { id: string; name?: string; state: string; region?: string }[]
      checkedAt: string
    }

function flyMachineStateLabel(state: string): string {
  const s = state.toLowerCase()
  if (s === 'started') return 'Çalışıyor'
  if (s === 'stopped') return 'Durduruldu'
  if (s === 'starting') return 'Başlıyor'
  if (s === 'stopping') return 'Durduruluyor'
  if (s === 'created') return 'Oluşturuldu'
  return state
}

function summaryBadgeProps(summary: WorkerFlySummary): {
  label: string
  Icon: typeof CircleCheck
  className: string
} {
  switch (summary) {
    case 'all_running':
      return {
        label: 'Çalışıyor',
        Icon: CircleCheck,
        className:
          'border-green-300 bg-green-100 text-green-900 dark:border-green-800 dark:bg-green-950/80 dark:text-green-100',
      }
    case 'all_stopped':
      return {
        label: 'Durduruldu',
        Icon: CircleOff,
        className:
          'border-slate-300 bg-slate-100 text-slate-800 dark:border-slate-600 dark:bg-slate-900/60 dark:text-slate-200',
      }
    case 'transitioning':
      return {
        label: 'Geçiş halinde',
        Icon: Loader2,
        className:
          'border-amber-300 bg-amber-100 text-amber-950 dark:border-amber-800 dark:bg-amber-950/80 dark:text-amber-100',
      }
    case 'partial':
      return {
        label: 'Kısmen çalışıyor',
        Icon: AlertTriangle,
        className:
          'border-amber-300 bg-amber-100 text-amber-950 dark:border-amber-800 dark:bg-amber-950/80 dark:text-amber-100',
      }
    case 'none':
      return {
        label: 'Makine bulunamadı',
        Icon: AlertTriangle,
        className:
          'border-red-300 bg-red-100 text-red-900 dark:border-red-900 dark:bg-red-950/80 dark:text-red-100',
      }
    default:
      return {
        label: 'Bilinmiyor',
        Icon: AlertTriangle,
        className: 'border-border bg-muted text-foreground',
      }
  }
}

export default function AdminSettingsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [restartingWorker, setRestartingWorker] = useState(false)
  const [workerFlyLoading, setWorkerFlyLoading] = useState(true)
  const [workerFlyError, setWorkerFlyError] = useState<string | null>(null)
  const [workerFlyData, setWorkerFlyData] = useState<WorkerStatusPayload | null>(null)
  const [settings, setSettings] = useState<Settings>({
    spotVolumeThreshold: 400000,
    futuresVolumeThreshold: 600000,
  })
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchSettings()
    void fetchWorkerFlyStatus()
  }, [])

  const fetchWorkerFlyStatus = async () => {
    setWorkerFlyLoading(true)
    setWorkerFlyError(null)
    try {
      const res = await fetch('/api/admin/worker-status')
      const data = (await res.json()) as WorkerStatusPayload & { error?: string; detail?: string }
      if (!res.ok) {
        throw new Error(
          typeof data.error === 'string' ? data.error : 'Worker durumu alınamadı'
        )
      }
      setWorkerFlyData(data as WorkerStatusPayload)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Worker durumu alınamadı'
      setWorkerFlyError(message)
      setWorkerFlyData(null)
    } finally {
      setWorkerFlyLoading(false)
    }
  }

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

  const handleRestartWorker = async () => {
    if (
      !window.confirm(
        'Hacim worker sıfırlanacak (Fly.io machine stop + start). Limitler ve push abonelik listesi veritabanından yeniden yüklenecek. Devam?'
      )
    ) {
      return
    }
    setRestartingWorker(true)
    try {
      const res = await fetch('/api/admin/restart-worker', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(
          typeof data.error === 'string'
            ? data.error
            : 'Worker yeniden başlatılamadı. Vercel ortamında FLY_API_TOKEN tanımlı mı kontrol edin.'
        )
      }
      toast.success(
        `Worker yeniden başlatıldı (${data.restarted ?? 1} machine). Birkaç saniye içinde yeni ayarlar geçerli olur.`
      )
      void fetchWorkerFlyStatus()
      window.setTimeout(() => void fetchWorkerFlyStatus(), 4500)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Worker yeniden başlatılamadı'
      toast.error(message)
    } finally {
      setRestartingWorker(false)
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
            Bu ayarlar veritabanında saklanır. Worker ilk açılışta ve yeniden başlatıldığında limitleri
            ve push abonelik önbelleğini bu değerlerle yükler. Limit değişikliğinden sonra worker’ın
            yeni eşikleri kullanması için önce <strong>Kaydet</strong>, ardından{' '}
            <strong>Worker’ı yeniden başlat</strong> düğmesine basın.
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
          <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <Server className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="text-sm font-medium">Hacim worker (Fly.io)</span>
                {workerFlyLoading ? (
                  <Badge variant="outline" className="gap-1 font-normal">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Sorgulanıyor…
                  </Badge>
                ) : workerFlyError ? (
                  <Badge variant="destructive" className="font-normal">
                    Hata
                  </Badge>
                ) : workerFlyData && !workerFlyData.configured ? (
                  <Badge variant="secondary" className="font-normal max-w-[280px] truncate" title={workerFlyData.error}>
                    Fly API yapılandırılmadı
                  </Badge>
                ) : workerFlyData?.configured ? (
                  (() => {
                    const { label, Icon, className } = summaryBadgeProps(workerFlyData.summary)
                    const iconSpin = workerFlyData.summary === 'transitioning'
                    return (
                      <Badge
                        variant="outline"
                        className={cn('font-normal gap-1 border', className)}
                      >
                        <Icon className={cn(iconSpin && 'animate-spin')} />
                        {label}
                      </Badge>
                    )
                  })()
                ) : null}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="shrink-0"
                onClick={() => void fetchWorkerFlyStatus()}
                disabled={workerFlyLoading || restartingWorker}
              >
                <RefreshCw className={cn('h-4 w-4', workerFlyLoading && 'animate-spin')} />
                <span className="ml-1.5 hidden sm:inline">Durumu yenile</span>
              </Button>
            </div>
            {workerFlyError ? (
              <p className="text-sm text-destructive">{workerFlyError}</p>
            ) : null}
            {workerFlyData && !workerFlyData.configured ? (
              <p className="text-xs text-muted-foreground">
                {workerFlyData.error}. Vercel ortamında{' '}
                <code className="text-[11px] bg-muted px-1 rounded">FLY_API_TOKEN</code> tanımlayın.
              </p>
            ) : null}
            {workerFlyData?.configured && workerFlyData.machines.length > 0 ? (
              <ul className="text-xs text-muted-foreground space-y-1.5 border-t border-border/60 pt-3">
                {workerFlyData.machines.map((m) => (
                  <li key={m.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 font-mono">
                    <span className="text-[11px] break-all opacity-90">{m.id}</span>
                    {m.region ? (
                      <span className="text-[11px] shrink-0">· {m.region}</span>
                    ) : null}
                    <span
                      className={cn(
                        'text-[11px] font-sans font-medium',
                        m.state.toLowerCase() === 'started'
                          ? 'text-green-700 dark:text-green-400'
                          : m.state.toLowerCase() === 'stopped'
                            ? 'text-slate-600 dark:text-slate-400'
                            : 'text-amber-700 dark:text-amber-400'
                      )}
                    >
                      {flyMachineStateLabel(m.state)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
            {workerFlyData?.configured ? (
              <p className="text-[11px] text-muted-foreground">
                Uygulama:{' '}
                <span className="font-medium text-foreground">{workerFlyData.appName}</span>
                {workerFlyData.checkedAt
                  ? ` · ${new Date(workerFlyData.checkedAt).toLocaleString('tr-TR')}`
                  : null}
              </p>
            ) : null}
          </div>

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

          <div className="flex flex-wrap items-center justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={handleRestartWorker}
              disabled={restartingWorker || saving}
            >
              {restartingWorker ? (
                <span>Worker yeniden başlatılıyor...</span>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Worker’ı yeniden başlat
                </>
              )}
            </Button>
            <Button onClick={handleSave} disabled={saving || restartingWorker}>
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
