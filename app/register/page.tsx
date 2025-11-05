'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { toast } from 'sonner'

export default function RegisterPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!termsAccepted) {
      toast.error('Lütfen kullanıcı sözleşmesini kabul edin')
      return
    }
    
    setLoading(true)

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await res.json()

      if (!res.ok) {
        // API'den gelen anlamlı mesajı göster
        toast.error(data.error || 'Kayıt olurken bir hata oluştu')
        return
      }

      toast.success('Kayıt başarılı! E-posta adresinize gönderilen doğrulama linkine tıklayarak hesabınızı aktifleştirin')
      router.push('/login')
      router.refresh()
    } catch (error) {
      toast.error('Bağlantı hatası. Lütfen internet bağlantınızı kontrol edin ve tekrar deneyin')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-center min-h-[calc(100vh-4rem)] py-12 relative">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-glow" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-glow" style={{ animationDelay: '1s' }} />
      </div>
      
      <Card className="w-full max-w-md glass-effect border-white/10 relative z-10">
        <CardHeader className="text-center space-y-2">
          <CardTitle className="text-3xl font-bold gradient-text">Oruba Coin'a Katıl</CardTitle>
          <CardDescription className="text-base">Başlamak için yeni bir hesap oluşturun</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium">İsim Soyisim</Label>
              <Input
                id="name"
                type="text"
                placeholder="John Doe"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="glass-effect border-white/10 focus:border-primary/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">E-posta</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                className="glass-effect border-white/10 focus:border-primary/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">Şifre</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                minLength={8}
                className="glass-effect border-white/10 focus:border-primary/50"
              />
              <p className="text-xs text-muted-foreground">En az 8 karakter</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-start space-x-2">
                <Checkbox
                  id="terms"
                  checked={termsAccepted}
                  onCheckedChange={(checked) => setTermsAccepted(checked === true)}
                  className="mt-1 cursor-pointer"
                />
                <div className="flex-1">
                  <p className="text-sm leading-relaxed">
                    <Dialog>
                      <DialogTrigger asChild>
                        <button type="button" className="text-primary hover:underline inline cursor-pointer">
                          Kullanıcı sözleşmesini ve gizlilik politikasını
                        </button>
                      </DialogTrigger>
                      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle className="text-2xl font-bold">
                            ORUBA COIN KULLANICI SÖZLEŞMESİ VE GİZLİLİK POLİTİKASI
                          </DialogTitle>
                          <DialogDescription className="pt-4">
                            Oruba Coin platformuna üye olarak aşağıdaki koşulları kabul etmiş sayılırsınız:
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-6 py-4">
                          <div>
                            <h3 className="font-semibold text-lg mb-2">1. Kişisel Verilerin Korunması:</h3>
                            <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground ml-4">
                              <li>Üyelik sırasında paylaştığınız tüm kişisel veriler 6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") kapsamında korunmaktadır.</li>
                              <li>Bu veriler yalnızca sistem içi kimlik doğrulama, kullanıcı deneyimi iyileştirmesi ve premium hizmetlerin sağlanması amacıyla kullanılacaktır.</li>
                              <li>Üçüncü taraflarla izniniz olmadan paylaşılmaz.</li>
                            </ul>
                          </div>
                          <div>
                            <h3 className="font-semibold text-lg mb-2">2. Hizmet Kullanımı:</h3>
                            <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground ml-4">
                              <li>Oruba Coin üzerinden sağlanan tüm analiz, veri ve içerikler bilgilendirme amaçlıdır.</li>
                              <li>Kullanıcı, elde ettiği bilgileri kendi yatırım kararları doğrultusunda değerlendirmekle yükümlüdür.</li>
                              <li>Platform yatırım tavsiyesi sunmaz.</li>
                            </ul>
                          </div>
                          <div>
                            <h3 className="font-semibold text-lg mb-2">3. Premium Üyelik ve Ödeme Şartları:</h3>
                            <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground ml-4">
                              <li>Premium üyelik, kullanıcının ek analiz ve ayrıcalıklı özelliklere erişmesini sağlar.</li>
                              <li>Ödeme işlemleri sırasında sayfada belirtilen talimatlara eksiksiz uyulmalıdır.</li>
                              <li>Aksi takdirde oluşabilecek hatalı ödeme, gecikme veya olumsuz deneyimlerden firmamız sorumlu değildir.</li>
                            </ul>
                          </div>
                          <div>
                            <h3 className="font-semibold text-lg mb-2">4. Üyelik Güvenliği:</h3>
                            <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground ml-4">
                              <li>Kullanıcı, hesabına ait giriş bilgilerini gizli tutmakla yükümlüdür.</li>
                              <li>Herhangi bir yetkisiz erişim tespit edildiğinde, derhal platforma bildirim yapılmalıdır.</li>
                            </ul>
                          </div>
                          <div>
                            <h3 className="font-semibold text-lg mb-2">5. Sözleşme Değişiklikleri:</h3>
                            <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground ml-4">
                              <li>Oruba Coin, gerekli gördüğü durumlarda işbu sözleşmeyi güncelleme hakkını saklı tutar.</li>
                              <li>Güncel metin her zaman <a href="https://orubacoin.com/kullanicisozlesmesi" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">orubacoin.com/kullanicisozlesmesi</a> adresinde yayımlanacaktır.</li>
                            </ul>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                    {' '}okudum, kabul ediyorum.
                  </p>
                  <Label htmlFor="terms" className="sr-only">Kullanıcı sözleşmesini kabul ediyorum</Label>
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button 
              type="submit" 
              className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-white shadow-lg shadow-primary/20 mt-4 cursor-pointer" 
              disabled={loading}
            >
              {loading ? 'Kayıt yapılıyor...' : 'Hesap Oluştur'}
            </Button>
            <p className="text-sm text-center text-muted-foreground">
              Zaten hesabınız var mı?{' '}
              <Link href="/login" className="text-primary hover:underline font-medium">
                Giriş Yap
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}

