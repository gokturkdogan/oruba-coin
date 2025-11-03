'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Check, Zap, BarChart3, Download, Bell, Lock, TrendingUp, Sparkles, Target } from 'lucide-react'

export default function PremiumPage() {
  return (
    <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      {/* Hero Section */}
      <section className="text-center mb-16">
        <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full glass-effect border border-primary/20 mb-6">
          <Sparkles className="h-4 w-4 text-primary animate-pulse" />
          <span className="text-sm font-medium">Premium Üyelik</span>
        </div>
        
        <h1 className="text-5xl md:text-6xl font-extrabold mb-6 gradient-text">
          Premium Program
        </h1>
        <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto mb-8">
          Profesyonel kripto analiz araçları ve gelişmiş özelliklerle işlemlerinizi bir üst seviyeye taşıyın
        </p>
        
        <Button 
          asChild
          size="lg"
          className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-white shadow-lg shadow-primary/30 text-base px-8 py-6 hover:scale-105 transition-transform duration-200"
        >
          <Link href="/checkout">Premium'a Yükselt</Link>
        </Button>
      </section>

      {/* Features Grid */}
      <section className="mb-16">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold mb-4 gradient-text">Premium Özellikler</h2>
          <p className="text-muted-foreground text-lg md:text-xl max-w-2xl mx-auto">
            Premium üyelerimizin erişebileceği özel araçlar ve avantajlar
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto">
          <Card className="glass-effect border-white/10 hover:border-primary/30 transition-all duration-300 hover:shadow-xl hover:shadow-primary/10 group overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="absolute -top-10 -left-10 w-32 h-32 bg-primary/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
            
            <CardHeader className="relative z-10">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
                <BarChart3 className="h-7 w-7 text-primary" />
              </div>
              <CardTitle className="text-2xl mb-2">Coin Detayı</CardTitle>
              <CardDescription className="text-base">
                Her coin için detaylı bilgiler, istatistikler ve gerçek zamanlı veriler. Spot ve vadeli hacim verileri ile kapsamlı analiz.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="glass-effect border-white/10 hover:border-primary/30 transition-all duration-300 hover:shadow-xl hover:shadow-primary/10 group overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="absolute -top-10 -left-10 w-32 h-32 bg-primary/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
            
            <CardHeader className="relative z-10">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
                <TrendingUp className="h-7 w-7 text-primary" />
              </div>
              <CardTitle className="text-2xl mb-2">Grafik Analizi</CardTitle>
              <CardDescription className="text-base">
                Profesyonel grafik araçları ile fiyat hareketlerini analiz edin. 24 saat, 7 gün, 30 gün ve daha uzun periyotlar için detaylı grafikler.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="glass-effect border-white/10 hover:border-primary/30 transition-all duration-300 hover:shadow-xl hover:shadow-primary/10 group overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="absolute -top-10 -left-10 w-32 h-32 bg-primary/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
            
            <CardHeader className="relative z-10">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
                <Target className="h-7 w-7 text-primary" />
              </div>
              <CardTitle className="text-2xl mb-2">Takip Listesi Oluşturma</CardTitle>
              <CardDescription className="text-base">
                İlginizi çeken coinleri özel listelerinize ekleyin ve takip edin. Favori coinlerinizi kolayca yönetin.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="glass-effect border-white/10 hover:border-primary/30 transition-all duration-300 hover:shadow-xl hover:shadow-primary/10 group overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="absolute -top-10 -left-10 w-32 h-32 bg-primary/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
            
            <CardHeader className="relative z-10">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
                <BarChart3 className="h-7 w-7 text-primary" />
              </div>
              <CardTitle className="text-2xl mb-2">Alım Satım Hacim Ayrıştırması</CardTitle>
              <CardDescription className="text-base">
                Alış ve satış emirlerini ayrı ayrı görüntüleyin. Piyasa gücünü anlamak için alım-satım hacim oranlarını analiz edin.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="glass-effect border-white/10 hover:border-primary/30 transition-all duration-300 hover:shadow-xl hover:shadow-primary/10 group overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="absolute -top-10 -left-10 w-32 h-32 bg-primary/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
            
            <CardHeader className="relative z-10">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
                <Zap className="h-7 w-7 text-primary" />
              </div>
              <CardTitle className="text-2xl mb-2">Trade Takibi</CardTitle>
              <CardDescription className="text-base">
                Gerçek zamanlı alım-satım işlemlerini takip edin. Her trade'in fiyat, miktar ve zaman bilgilerini canlı olarak görüntüleyin.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="glass-effect border-white/10 hover:border-primary/30 transition-all duration-300 hover:shadow-xl hover:shadow-primary/10 group overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="absolute -top-10 -left-10 w-32 h-32 bg-primary/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
            
            <CardHeader className="relative z-10">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
                <TrendingUp className="h-7 w-7 text-primary" />
              </div>
              <CardTitle className="text-2xl mb-2">Saatlik Hacim Takibi</CardTitle>
              <CardDescription className="text-base">
                Saat bazında hacim analizi ile piyasa trendlerini daha iyi anlayın. Zaman dilimlerine göre hacim dağılımını görüntüleyin.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>

      {/* Comparison Table */}
      <section className="mb-16">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold mb-4 gradient-text">Plan Karşılaştırma</h2>
          <p className="text-muted-foreground text-lg md:text-xl max-w-2xl mx-auto">
            Ücretsiz ve Premium planlar arasındaki farkları görün
          </p>
        </div>

        <div className="max-w-5xl mx-auto">
          <Card className="glass-effect border-white/10 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10 bg-white/5">
                    <th className="text-left p-4 font-semibold">Özellik</th>
                    <th className="text-center p-4 font-semibold">Ücretsiz Plan</th>
                    <th className="text-center p-4 font-semibold bg-primary/10">
                      <div className="flex items-center justify-center gap-2">
                        <Lock className="h-5 w-5 text-primary" />
                        <span className="gradient-text">Premium Plan</span>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-white/10">
                    <td className="p-4 font-medium">Coin Listesi</td>
                    <td className="p-4 text-center">
                      <Check className="h-5 w-5 text-green-400 mx-auto" />
                    </td>
                    <td className="p-4 text-center bg-primary/5">
                      <Check className="h-5 w-5 text-green-400 mx-auto" />
                    </td>
                  </tr>
                  <tr className="border-b border-white/10">
                    <td className="p-4 font-medium">Anlık Fiyat Takibi</td>
                    <td className="p-4 text-center">
                      <Check className="h-5 w-5 text-green-400 mx-auto" />
                    </td>
                    <td className="p-4 text-center bg-primary/5">
                      <Check className="h-5 w-5 text-green-400 mx-auto" />
                    </td>
                  </tr>
                  <tr className="border-b border-white/10">
                    <td className="p-4 font-medium">Hacim Takibi</td>
                    <td className="p-4 text-center">
                      <Check className="h-5 w-5 text-green-400 mx-auto" />
                    </td>
                    <td className="p-4 text-center bg-primary/5">
                      <Check className="h-5 w-5 text-green-400 mx-auto" />
                    </td>
                  </tr>
                  <tr className="border-b border-white/10">
                    <td className="p-4 font-medium">Coin Detayı</td>
                    <td className="p-4 text-center">
                      <span className="text-muted-foreground">-</span>
                    </td>
                    <td className="p-4 text-center bg-primary/5">
                      <Check className="h-5 w-5 text-green-400 mx-auto" />
                    </td>
                  </tr>
                  <tr className="border-b border-white/10">
                    <td className="p-4 font-medium">Grafik Analizi</td>
                    <td className="p-4 text-center">
                      <span className="text-muted-foreground">-</span>
                    </td>
                    <td className="p-4 text-center bg-primary/5">
                      <Check className="h-5 w-5 text-green-400 mx-auto" />
                    </td>
                  </tr>
                  <tr className="border-b border-white/10">
                    <td className="p-4 font-medium">Takip Listesi Oluşturma</td>
                    <td className="p-4 text-center">
                      <span className="text-muted-foreground">-</span>
                    </td>
                    <td className="p-4 text-center bg-primary/5">
                      <Check className="h-5 w-5 text-green-400 mx-auto" />
                    </td>
                  </tr>
                  <tr className="border-b border-white/10">
                    <td className="p-4 font-medium">Alım Satım Hacim Ayrıştırması</td>
                    <td className="p-4 text-center">
                      <span className="text-muted-foreground">-</span>
                    </td>
                    <td className="p-4 text-center bg-primary/5">
                      <Check className="h-5 w-5 text-green-400 mx-auto" />
                    </td>
                  </tr>
                  <tr className="border-b border-white/10">
                    <td className="p-4 font-medium">Trade Takibi</td>
                    <td className="p-4 text-center">
                      <span className="text-muted-foreground">-</span>
                    </td>
                    <td className="p-4 text-center bg-primary/5">
                      <Check className="h-5 w-5 text-green-400 mx-auto" />
                    </td>
                  </tr>
                  <tr className="border-b border-white/10">
                    <td className="p-4 font-medium">Saatlik Hacim Takibi</td>
                    <td className="p-4 text-center">
                      <span className="text-muted-foreground">-</span>
                    </td>
                    <td className="p-4 text-center bg-primary/5">
                      <Check className="h-5 w-5 text-green-400 mx-auto" />
                    </td>
                  </tr>
                  <tr>
                    <td className="p-4 font-medium">E-posta Bildirimi Ayarlama</td>
                    <td className="p-4 text-center">
                      <span className="text-muted-foreground">-</span>
                    </td>
                    <td className="p-4 text-center bg-primary/5">
                      <Check className="h-5 w-5 text-green-400 mx-auto" />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="text-center">
        <Card className="glass-effect border-primary/30 bg-gradient-to-br from-primary/10 to-transparent max-w-3xl mx-auto">
          <CardHeader>
            <CardTitle className="text-3xl md:text-4xl font-bold mb-4 gradient-text">
              Premium'a Geçiş Yapın
            </CardTitle>
            <CardDescription className="text-lg">
              Profesyonel araçlarla kripto yatırımlarınızı bir üst seviyeye taşıyın
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                asChild
                size="lg"
                className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-white shadow-lg shadow-primary/30 text-base px-8 py-6 hover:scale-105 transition-transform duration-200"
              >
                <Link href="/checkout">Premium'a Yükselt</Link>
              </Button>
              <Button 
                variant="outline" 
                size="lg"
                className="border-primary/30 hover:bg-primary/10 text-base px-8 py-6 hover:scale-105 transition-transform duration-200 cursor-pointer"
                onClick={() => {
                  window.location.href = '/coins'
                }}
              >
                Önce Coinleri Keşfet
              </Button>
            </div>
            
            <p className="text-sm text-muted-foreground">
              💳 Güvenli ödeme işleme • 🔒 İstediğiniz zaman iptal edin • ✨ 7/24 öncelikli destek
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}

