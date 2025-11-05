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
import { Menu, X, Shield, LogOut, ShieldCheck, DollarSign, Home, Building2, CreditCard } from 'lucide-react'

interface User {
  id: string
  email: string
  name?: string
  isPremium: boolean
  isAdmin?: boolean
}

export function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const isAdminPage = pathname?.startsWith('/admin')

  const fetchUser = () => {
    fetch('/api/user/profile')
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          setUser({
            id: data.user.id,
            email: data.user.email,
            name: data.user.name,
            isPremium: data.user.isPremium,
            isAdmin: data.user.isAdmin,
          })
        } else {
          setUser(null)
        }
      })
      .catch(() => {
        setUser(null)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchUser()

    // Listen for login/logout events
    const handleAuthChange = () => {
      fetchUser()
    }

    window.addEventListener('auth:change', handleAuthChange)
    return () => {
      window.removeEventListener('auth:change', handleAuthChange)
    }
  }, [])

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      setUser(null)
      // Trigger navbar update for other components
      window.dispatchEvent(new Event('auth:change'))
      toast.success('Başarıyla çıkış yapıldı')
      router.push('/')
      router.refresh()
    } catch (error) {
      toast.error('Çıkış yapılamadı')
    }
  }

  // Admin panel için sadeleştirilmiş navbar
  if (isAdminPage) {
    return (
      <nav className="border-b border-white/10 glass-effect-dark sticky top-0 z-50">
        <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-6">
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
              <div className="flex items-center gap-2">
                <Link
                  href="/admin"
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors ${
                    pathname === '/admin'
                      ? 'bg-primary/20 text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                >
                  <Home className="h-4 w-4" />
                  Dashboard
                </Link>
                <Link
                  href="/admin/users"
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors ${
                    pathname === '/admin/users'
                      ? 'bg-primary/20 text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                >
                  <Shield className="h-4 w-4" />
                  Kullanıcılar
                </Link>
                <Link
                  href="/admin/payments"
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors ${
                    pathname === '/admin/payments'
                      ? 'bg-primary/20 text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                >
                  <DollarSign className="h-4 w-4" />
                  Ödemeler
                </Link>
                <Link
                  href="/admin/bank-account"
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors ${
                    pathname === '/admin/bank-account'
                      ? 'bg-primary/20 text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                >
                  <Building2 className="h-4 w-4" />
                  IBAN Bilgileri
                </Link>
                <Link
                  href="/admin/plans"
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors ${
                    pathname === '/admin/plans'
                      ? 'bg-primary/20 text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                >
                  <CreditCard className="h-4 w-4" />
                  Planlar
                </Link>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                <span className="font-bold text-lg gradient-text">Admin</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Çıkış
              </Button>
            </div>
          </div>
        </div>
      </nav>
    )
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
            <a
              href="/hourly-volume"
              onClick={(e) => {
                e.preventDefault()
                window.location.href = '/hourly-volume'
              }}
              className={`transition-all duration-200 hover:text-primary relative cursor-pointer ${
                pathname === '/hourly-volume' ? 'text-primary font-semibold' : 'text-foreground/70'
              }`}
            >
              Saatlik Hacim Takibi
              {pathname === '/hourly-volume' && (
                <span className="absolute -bottom-1 left-0 right-0 h-0.5 bg-gradient-to-r from-primary to-primary/50 rounded-full" />
              )}
            </a>
            <a
              href="/futures-coins"
              onClick={(e) => {
                e.preventDefault()
                window.location.href = '/futures-coins'
              }}
              className={`transition-all duration-200 hover:text-primary relative cursor-pointer ${
                pathname === '/futures-coins' ? 'text-primary font-semibold' : 'text-foreground/70'
              }`}
            >
              Vadeli Coin Listesi
              {pathname === '/futures-coins' && (
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
                      <Button 
                        variant="ghost" 
                        className="relative h-10 w-10 rounded-full cursor-pointer hover:bg-primary/10 transition-all duration-200 border-2 border-primary/30 hover:border-primary/60 hover:shadow-lg hover:shadow-primary/20"
                      >
                        <Avatar className="h-10 w-10 ring-2 ring-primary/20 hover:ring-primary/40 transition-all">
                          <AvatarFallback className="bg-gradient-to-br from-primary/80 to-primary/60 text-white font-semibold text-sm">
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
                        className="cursor-pointer"
                      >
                        Profil
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={(e) => {
                          e.preventDefault()
                          window.location.href = '/watchlist'
                        }}
                        className="cursor-pointer"
                      >
                        Takip Listem
                      </DropdownMenuItem>
                      {user.isAdmin && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={(e) => {
                              e.preventDefault()
                              window.location.href = '/admin'
                            }}
                            className="cursor-pointer"
                          >
                            <Shield className="mr-2 h-4 w-4" />
                            Admin Paneli
                          </DropdownMenuItem>
                        </>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onClick={(e) => {
                          e.preventDefault()
                          handleLogout()
                        }}
                        className="cursor-pointer text-red-400 focus:text-red-400"
                      >
                        <LogOut className="mr-2 h-4 w-4" />
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
            <a
              href="/hourly-volume"
              onClick={(e) => {
                e.preventDefault()
                setMobileMenuOpen(false)
                window.location.href = '/hourly-volume'
              }}
              className={`block px-4 py-2 rounded-lg transition-all cursor-pointer ${
                pathname === '/hourly-volume' ? 'text-primary bg-primary/10' : 'text-foreground/70 hover:bg-white/5'
              }`}
            >
              Saatlik Hacim Takibi
            </a>
            <a
              href="/futures-coins"
              onClick={(e) => {
                e.preventDefault()
                setMobileMenuOpen(false)
                window.location.href = '/futures-coins'
              }}
              className={`block px-4 py-2 rounded-lg transition-all cursor-pointer ${
                pathname === '/futures-coins' ? 'text-primary bg-primary/10' : 'text-foreground/70 hover:bg-white/5'
              }`}
            >
              Vadeli Coin Listesi
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
                <a
                  href="/watchlist"
                  onClick={(e) => {
                    e.preventDefault()
                    setMobileMenuOpen(false)
                    window.location.href = '/watchlist'
                  }}
                  className="block px-4 py-2 rounded-lg text-foreground/70 hover:bg-white/5 transition-all cursor-pointer"
                >
                  Takip Listem
                </a>
                {user.isAdmin && (
                  <a
                    href="/admin"
                    onClick={(e) => {
                      e.preventDefault()
                      setMobileMenuOpen(false)
                      window.location.href = '/admin'
                    }}
                    className="block px-4 py-2 rounded-lg text-foreground/70 hover:bg-white/5 transition-all cursor-pointer flex items-center gap-2"
                  >
                    <Shield className="h-4 w-4" />
                    Admin Paneli
                  </a>
                )}
                <button
                  onClick={(e) => {
                    e.preventDefault()
                    setMobileMenuOpen(false)
                    handleLogout()
                  }}
                  className="w-full text-left block px-4 py-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-all cursor-pointer flex items-center gap-2"
                >
                  <LogOut className="h-4 w-4" />
                  Çıkış Yap
                </button>
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

