'use client'

import Link from 'next/link'
import { Github, Twitter, Mail } from 'lucide-react'

export function Footer() {
  return (
    <footer className="border-t border-white/10 glass-effect-dark mt-auto">
      <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="space-y-4">
            <h3 className="font-bold text-xl gradient-text">Oruba Coin</h3>
            <p className="text-sm text-muted-foreground">
              Real-time cryptocurrency analysis platform with advanced insights and market data.
            </p>
          </div>

          {/* Quick Links */}
          <div className="space-y-4">
            <h4 className="font-semibold text-sm">Quick Links</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/" className="text-muted-foreground hover:text-primary transition-colors">
                  Home
                </Link>
              </li>
              <li>
                <Link href="/coins" className="text-muted-foreground hover:text-primary transition-colors">
                  Market
                </Link>
              </li>
              <li>
                <Link href="/checkout" className="text-muted-foreground hover:text-primary transition-colors">
                  Premium
                </Link>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div className="space-y-4">
            <h4 className="font-semibold text-sm">Resources</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/profile" className="text-muted-foreground hover:text-primary transition-colors">
                  Profile
                </Link>
              </li>
              <li>
                <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
                  Documentation
                </a>
              </li>
              <li>
                <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
                  API
                </a>
              </li>
            </ul>
          </div>

          {/* Social */}
          <div className="space-y-4">
            <h4 className="font-semibold text-sm">Connect</h4>
            <div className="flex space-x-4">
              <a
                href="#"
                className="w-10 h-10 rounded-lg glass-effect border border-white/10 flex items-center justify-center hover:border-primary/50 hover:text-primary transition-all"
              >
                <Twitter className="h-5 w-5" />
              </a>
              <a
                href="#"
                className="w-10 h-10 rounded-lg glass-effect border border-white/10 flex items-center justify-center hover:border-primary/50 hover:text-primary transition-all"
              >
                <Github className="h-5 w-5" />
              </a>
              <a
                href="#"
                className="w-10 h-10 rounded-lg glass-effect border border-white/10 flex items-center justify-center hover:border-primary/50 hover:text-primary transition-all"
              >
                <Mail className="h-5 w-5" />
              </a>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center text-sm text-muted-foreground">
          <p>© 2024 Oruba Coin. All rights reserved.</p>
          <div className="flex space-x-6 mt-4 md:mt-0">
            <Link href="#" className="hover:text-primary transition-colors">
              Privacy
            </Link>
            <Link href="#" className="hover:text-primary transition-colors">
              Terms
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}

