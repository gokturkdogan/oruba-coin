'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Github, Linkedin, Mail } from 'lucide-react'

// WhatsApp Icon Component
const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
  </svg>
)

export function Footer() {
  return (
    <footer className="border-t border-white/10 glass-effect-dark mt-auto">
      <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Brand */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="relative h-10 w-10 overflow-hidden rounded-xl border border-white/10 bg-white/5 shadow-md">
                <Image
                  src="/oruba-coin-logo.png"
                  alt="Oruba Coin"
                  width={40}
                  height={40}
                  className="object-cover"
                  priority
                  unoptimized
                />
              </div>
              <h3 className="font-bold text-xl gradient-text">Oruba Coin</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Gelişmiş içgörüler ve piyasa verileri ile gerçek zamanlı kripto para analiz platformu.
            </p>
          </div>

          {/* Quick Links */}
          <div className="space-y-4">
            <h4 className="font-semibold text-sm">Hızlı Bağlantılar</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/" className="text-muted-foreground hover:text-primary transition-colors">
                  Ana Sayfa
                </Link>
              </li>
              <li>
                <Link href="/coins" className="text-muted-foreground hover:text-primary transition-colors">
                  Piyasa
                </Link>
              </li>
              <li>
                <Link href="/profile" className="text-muted-foreground hover:text-primary transition-colors">
                  Profil
                </Link>
              </li>
            </ul>
          </div>

          {/* Developer */}
          <div className="space-y-4">
            <h4 className="font-semibold text-sm">Geliştirici</h4>
            <p className="text-sm font-medium">Göktürk DOĞAN</p>
            <div className="flex space-x-4">
              <a
                href="https://github.com/gokturkdogan"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-lg glass-effect border border-white/10 flex items-center justify-center hover:border-primary/50 hover:text-primary transition-all cursor-pointer"
                aria-label="GitHub"
              >
                <Github className="h-5 w-5" />
              </a>
              <a
                href="https://www.linkedin.com/in/gokturk-dogan/"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-lg glass-effect border border-white/10 flex items-center justify-center hover:border-primary/50 hover:text-primary transition-all cursor-pointer"
                aria-label="LinkedIn"
              >
                <Linkedin className="h-5 w-5" />
              </a>
              <a
                href="mailto:gokturk.dogan@hotmail.com"
                className="w-10 h-10 rounded-lg glass-effect border border-white/10 flex items-center justify-center hover:border-primary/50 hover:text-primary transition-all cursor-pointer"
                aria-label="E-posta"
              >
                <Mail className="h-5 w-5" />
              </a>
              <a
                href="https://wa.me/905398226918"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-lg glass-effect border border-white/10 flex items-center justify-center hover:border-primary/50 hover:text-primary transition-all cursor-pointer"
                aria-label="WhatsApp"
              >
                <WhatsAppIcon className="h-5 w-5" />
              </a>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-white/10">
          <div className="flex flex-col md:flex-row justify-between items-center text-sm text-muted-foreground">
            <p>© 2024 Oruba Coin. Tüm hakları saklıdır.</p>
            <div className="flex space-x-6 mt-4 md:mt-0">
              <Link href="/kullanicisozlesmesi" className="hover:text-primary transition-colors">
                Kullanıcı Sözleşmesi
              </Link>
            </div>
          </div>
          <div className="mt-4 text-center text-xs text-muted-foreground/70">
            Göktürk DOĞAN tarafından geliştirilmiştir
          </div>
        </div>
      </div>
    </footer>
  )
}

