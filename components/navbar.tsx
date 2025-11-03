'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { Menu, X } from 'lucide-react'

interface User {
  id: string
  email: string
  name?: string
  isPremium: boolean
}

export function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    fetch('/api/user/profile')
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          setUser({
            id: data.user.id,
            email: data.user.email,
            name: data.user.name,
            isPremium: data.user.isPremium,
          })
        }
      })
      .catch(() => {
        setUser(null)
      })
      .finally(() => setLoading(false))
  }, [])

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      setUser(null)
      toast.success('Başarıyla çıkış yapıldı')
      router.push('/')
    } catch (error) {
      toast.error('Çıkış yapılamadı')
    }
  }

  return (
    <nav className="border-b border-white/10 glass-effect-dark sticky top-0 z-50">
      <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center">
            <a 
              href="/" 
              onClick={(e) => {
                e.preventDefault()
                window.location.href = '/'
              }}
              className="flex items-center space-x-2 group cursor-pointer"
            >
              <span className="font-bold text-xl gradient-text">Oruba Coin</span>
              <span className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">₿</span>
            </a>
          </div>
          <div className="hidden md:flex items-center space-x-8 text-sm font-medium">
            <a
              href="/"
              onClick={(e) => {
                e.preventDefault()
                window.location.href = '/'
              }}
              className={`transition-all duration-200 hover:text-primary relative cursor-pointer ${
                pathname === '/' ? 'text-primary font-semibold' : 'text-foreground/70'
              }`}
            >
              Ana Sayfa
              {pathname === '/' && (
                <span className="absolute -bottom-1 left-0 right-0 h-0.5 bg-gradient-to-r from-primary to-primary/50 rounded-full" />
              )}
            </a>
            <a
              href="/coins"
              onClick={(e) => {
                e.preventDefault()
                window.location.href = '/coins'
              }}
              className={`transition-all duration-200 hover:text-primary relative cursor-pointer ${
                pathname === '/coins' ? 'text-primary font-semibold' : 'text-foreground/70'
              }`}
            >
              Coinler
              {pathname === '/coins' && (
                <span className="absolute -bottom-1 left-0 right-0 h-0.5 bg-gradient-to-r from-primary to-primary/50 rounded-full" />
              )}
            </a>
            <a
              href="/premium"
              onClick={(e) => {
                e.preventDefault()
                window.location.href = '/premium'
              }}
              className={`transition-all duration-200 hover:text-primary relative cursor-pointer ${
                pathname === '/premium' ? 'text-primary font-semibold' : 'text-foreground/70'
              }`}
            >
              Premium Programı
              {pathname === '/premium' && (
                <span className="absolute -bottom-1 left-0 right-0 h-0.5 bg-gradient-to-r from-primary to-primary/50 rounded-full" />
              )}
            </a>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Mobile menu button */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
            
            {/* Desktop user menu */}
            <div className="hidden md:flex items-center space-x-4">
              {loading ? (
                <div className="h-8 w-20 animate-pulse rounded bg-muted" />
              ) : user ? (
                <>
                  {user.isPremium && (
                    <Badge variant="default" className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white border-0 shadow-lg shadow-yellow-500/20">
                      ✨ Premium
                    </Badge>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>
                            {user.name?.[0] || user.email[0].toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56" align="end" forceMount>
                      <DropdownMenuLabel className="font-normal">
                        <div className="flex flex-col space-y-1">
                          <p className="text-sm font-medium leading-none">
                            {user.name || 'User'}
                          </p>
                          <p className="text-xs leading-none text-muted-foreground">
                            {user.email}
                          </p>
                        </div>
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onClick={(e) => {
                          e.preventDefault()
                          window.location.href = '/profile'
                        }}
                      >
                        Profil
                      </DropdownMenuItem>
                      {!user.isPremium && (
                        <>
                          <DropdownMenuItem 
                            onClick={(e) => {
                              e.preventDefault()
                              window.location.href = '/premium'
                            }}
                          >
                            Premium Programı
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={(e) => {
                              e.preventDefault()
                              window.location.href = '/checkout'
                            }}
                          >
                            Premium'a Yükselt
                          </DropdownMenuItem>
                        </>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleLogout}>
                        Çıkış Yap
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              ) : (
                <>
                  <Button 
                    variant="ghost" 
                    className="hover:text-primary cursor-pointer"
                    onClick={() => {
                      window.location.href = '/login'
                    }}
                  >
                    Giriş Yap
                  </Button>
                  <Button 
                    className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-white shadow-lg shadow-primary/20 cursor-pointer"
                    onClick={() => {
                      window.location.href = '/register'
                    }}
                  >
                    Kayıt Ol
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
        
        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-white/10 py-4 space-y-4">
            <a
              href="/"
              onClick={(e) => {
                e.preventDefault()
                setMobileMenuOpen(false)
                window.location.href = '/'
              }}
              className={`block px-4 py-2 rounded-lg transition-all cursor-pointer ${
                pathname === '/' ? 'text-primary bg-primary/10' : 'text-foreground/70 hover:bg-white/5'
              }`}
            >
              Ana Sayfa
            </a>
            <a
              href="/coins"
              onClick={(e) => {
                e.preventDefault()
                setMobileMenuOpen(false)
                window.location.href = '/coins'
              }}
              className={`block px-4 py-2 rounded-lg transition-all cursor-pointer ${
                pathname === '/coins' ? 'text-primary bg-primary/10' : 'text-foreground/70 hover:bg-white/5'
              }`}
            >
              Coinler
            </a>
            <a
              href="/premium"
              onClick={(e) => {
                e.preventDefault()
                setMobileMenuOpen(false)
                window.location.href = '/premium'
              }}
              className={`block px-4 py-2 rounded-lg transition-all cursor-pointer ${
                pathname === '/premium' ? 'text-primary bg-primary/10' : 'text-foreground/70 hover:bg-white/5'
              }`}
            >
              Premium Programı
            </a>
            {user && (
              <>
                <a
                  href="/profile"
                  onClick={(e) => {
                    e.preventDefault()
                    setMobileMenuOpen(false)
                    window.location.href = '/profile'
                  }}
                  className="block px-4 py-2 rounded-lg text-foreground/70 hover:bg-white/5 transition-all cursor-pointer"
                >
                  Profil
                </a>
                {!user.isPremium && (
                  <>
                    <a
                      href="/premium"
                      onClick={(e) => {
                        e.preventDefault()
                        setMobileMenuOpen(false)
                        window.location.href = '/premium'
                      }}
                      className="block px-4 py-2 rounded-lg text-foreground/70 hover:bg-white/5 transition-all cursor-pointer"
                    >
                      Premium Programı
                    </a>
                    <a
                      href="/checkout"
                      onClick={(e) => {
                        e.preventDefault()
                        setMobileMenuOpen(false)
                        window.location.href = '/checkout'
                      }}
                      className="block px-4 py-2 rounded-lg text-foreground/70 hover:bg-white/5 transition-all cursor-pointer"
                    >
                      Premium'a Yükselt
                    </a>
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </nav>
  )
}

