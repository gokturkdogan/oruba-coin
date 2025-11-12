"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Image from "next/image"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Smartphone } from "lucide-react"

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  prompt: () => Promise<void>
  userChoice: Promise<{
    outcome: "accepted" | "dismissed"
    platform: string
  }>
}

const STORAGE_KEY = "oruba-pwa-install-dismissed"

function isStandalone(): boolean {
  if (typeof window === "undefined") return false
  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    (window.navigator as any).standalone === true
  )
}

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [open, setOpen] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [isIos, setIsIos] = useState(false)
  const [eligible, setEligible] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return

    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === "true") {
      setDismissed(true)
    }

    const userAgent = window.navigator.userAgent.toLowerCase()
    const isMobile = /iphone|ipad|ipod|android/.test(userAgent)
    const ios = /iphone|ipad|ipod/.test(userAgent)
    setIsIos(ios)

    if (isMobile && !isStandalone() && stored !== "true") {
      setEligible(true)
      if (ios) {
        // iOS does not fire beforeinstallprompt; show instructions directly
        const timeout = window.setTimeout(() => setOpen(true), 1200)
        return () => window.clearTimeout(timeout)
      }
    }

    return
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return

    const handler = (event: Event) => {
      const installEvent = event as BeforeInstallPromptEvent
      installEvent.preventDefault()

      console.info("[PWA] beforeinstallprompt event fired")

      const userAgent = window.navigator.userAgent.toLowerCase()
      const isMobile = /iphone|ipad|ipod|android/.test(userAgent)
      if (!isMobile || dismissed || isStandalone()) {
        console.info("[PWA] beforeinstallprompt ignored", { isMobile, dismissed, standalone: isStandalone() })
        return
      }

      setDeferredPrompt(installEvent)
      setEligible(true)
      setOpen(true)
    }

    window.addEventListener("beforeinstallprompt", handler as EventListener)

    return () => {
      window.removeEventListener("beforeinstallprompt", handler as EventListener)
    }
  }, [dismissed])

  useEffect(() => {
    if (typeof window === "undefined") return
    if (dismissed) return
    if (!eligible) return
    if (isIos) return
    if (open) return

    const timeout = window.setTimeout(() => {
      setOpen(true)
    }, 1200)

    return () => window.clearTimeout(timeout)
  }, [eligible, dismissed, isIos, open])

  const handleClose = useCallback(() => {
    setOpen(false)
    setDismissed(true)
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, "true")
    }
  }, [])

  const handleInstall = useCallback(() => {
    if (deferredPrompt) {
      deferredPrompt.prompt()
      deferredPrompt.userChoice.then((choice) => {
        if (choice.outcome === "accepted") {
          setDismissed(true)
          if (typeof window !== "undefined") {
            localStorage.setItem(STORAGE_KEY, "true")
          }
        }
      })
    }
  }, [deferredPrompt])

  const showModal = useMemo(() => {
    if (dismissed) return false
    if (isStandalone()) return false

    const shouldShow = eligible || Boolean(deferredPrompt)
    if (shouldShow) {
      console.info("[PWA] Showing install prompt modal", {
        eligible,
        hasDeferredPrompt: Boolean(deferredPrompt),
        dismissed,
      })
    }
    return eligible || Boolean(deferredPrompt)
  }, [eligible, deferredPrompt, dismissed])

  if (!showModal) {
    return null
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) {
          handleClose()
        } else {
          setOpen(true)
        }
      }}
    >
      <DialogContent className="max-w-sm border-primary/40 bg-gradient-to-b from-slate-950/95 via-slate-900 to-slate-950 text-slate-100">
        <DialogHeader className="space-y-4 text-left">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 overflow-hidden rounded-2xl border border-primary/30 bg-primary/10 p-2">
              <Image
                src="/oruba-coin-logo.png"
                alt="Oruba Coin"
                width={64}
                height={64}
                className="h-full w-full object-contain"
                priority
                unoptimized
              />
            </div>
            <div>
              <DialogTitle className="text-2xl font-semibold tracking-tight">
                {isIos ? "Oruba Coin'i ana ekrana ekle" : "Uygulamayı indir"}
              </DialogTitle>
            </div>
          </div>
        </DialogHeader>

        {!isIos && deferredPrompt && (
          <Button
            className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-white shadow-lg shadow-primary/30 cursor-pointer"
            onClick={handleInstall}
          >
            Uygulamayı indir
          </Button>
        )}

        {isIos && (
          <div className="space-y-4 rounded-lg border border-primary/20 bg-slate-900/40 p-4 text-sm text-slate-200">
            <ol className="list-decimal space-y-2 pl-5">
              <li>
                Safari'de alt bardaki <span className="font-semibold">Paylaş</span> ikonuna dokunun.
              </li>
              <li>
                Açılan menüde <span className="font-semibold">"Ana Ekrana Ekle"</span> seçeneğini bulun.
              </li>
              <li>
                Açılan pencerede <span className="font-semibold">"Ekle"</span> diyerek işlemi tamamlayın.
              </li>
            </ol>
          </div>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button
            variant="ghost"
            className="w-full text-slate-300 hover:text-slate-100 hover:bg-slate-800/60 cursor-pointer"
            onClick={handleClose}
          >
            Kapat
          </Button>
        </DialogFooter>

        <div className="flex items-center justify-center gap-2 rounded-lg border border-white/5 bg-slate-900/60 p-3 text-xs text-slate-400">
          <Smartphone className="h-4 w-4" />
          <span>Bu uyarı sadece mobil cihazlarda gösterilir.</span>
        </div>
      </DialogContent>
    </Dialog>
  )
}
