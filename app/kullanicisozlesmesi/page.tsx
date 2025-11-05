'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function KullanimSartlariPage() {
  return (
    <div className="container max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <Card className="glass-effect border-white/10">
        <CardHeader>
          <CardTitle className="text-3xl md:text-4xl font-bold mb-2 gradient-text text-center">
            ORUBA COIN KULLANICI SÖZLEŞMESİ VE GİZLİLİK POLİTİKASI
          </CardTitle>
          <div className="text-center text-muted-foreground space-y-1 pt-4">
            <p>Yürürlük Tarihi: 2025</p>
            <p>Platform: <a href="https://orubacoin.com" className="text-primary hover:underline">orubacoin.com</a></p>
            <p>Şirket: Oruba Teknoloji A.Ş. (bundan sonra "Oruba Coin" olarak anılacaktır)</p>
          </div>
        </CardHeader>
        <CardContent className="space-y-8 text-sm leading-relaxed">
          <div className="border-t border-white/10 pt-6">
            <h2 className="text-2xl font-bold mb-4">1. Giriş</h2>
            <p className="text-muted-foreground mb-4">
              Bu Kullanıcı Sözleşmesi ("Sözleşme"), Oruba Coin platformuna ("Platform") erişen veya üye olan tüm kullanıcılar ("Kullanıcı") ile Oruba Coin arasında akdedilmiştir.
            </p>
            <p className="text-muted-foreground">
              Platforma erişim sağlayan, üyelik oluşturan veya herhangi bir hizmeti kullanan her kişi bu sözleşme hükümlerini okumuş, anlamış ve kabul etmiş sayılır.
            </p>
          </div>

          <div className="border-t border-white/10 pt-6">
            <h2 className="text-2xl font-bold mb-4">2. Hizmetin Tanımı</h2>
            <p className="text-muted-foreground mb-4">
              Oruba Coin; kripto para piyasalarına ilişkin anlık fiyat verileri, istatistiksel analizler ve piyasa göstergeleri sağlayan bir bilgi platformudur.
            </p>
            <p className="text-muted-foreground">
              Platform üzerinde sunulan hiçbir içerik, yatırım tavsiyesi niteliği taşımaz. Kullanıcı, aldığı bilgileri kendi inisiyatifiyle değerlendirmekle yükümlüdür.
            </p>
          </div>

          <div className="border-t border-white/10 pt-6">
            <h2 className="text-2xl font-bold mb-4">3. Üyelik ve Hesap Güvenliği</h2>
            <ol className="list-decimal list-inside space-y-3 text-muted-foreground ml-4">
              <li>Platforma üye olmak isteyen kullanıcılar, doğru ve güncel bilgilerle kayıt formunu doldurmak zorundadır.</li>
              <li>Kullanıcı hesabına ait giriş bilgileri yalnızca kullanıcı tarafından kullanılmalı ve gizli tutulmalıdır.</li>
              <li>Herhangi bir yetkisiz erişim veya şüpheli durum fark edilirse, kullanıcı derhal Oruba Coin'e bildirim yapmalıdır.</li>
              <li>Oruba Coin, kullanıcı güvenliğini sağlamak amacıyla gerekli gördüğü durumlarda hesabı geçici olarak askıya alabilir.</li>
            </ol>
          </div>

          <div className="border-t border-white/10 pt-6">
            <h2 className="text-2xl font-bold mb-4">4. Kişisel Verilerin Korunması (KVKK)</h2>
            <ol className="list-decimal list-inside space-y-3 text-muted-foreground ml-4">
              <li className="mb-3">
                Kullanıcılardan alınan ad, soyad, e-posta, telefon numarası, IP adresi gibi kişisel veriler, 6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) hükümlerine uygun olarak işlenir.
              </li>
              <li className="mb-3">
                Bu veriler yalnızca:
                <ul className="list-disc list-inside space-y-2 mt-2 ml-6">
                  <li>Üyelik işlemlerinin yürütülmesi,</li>
                  <li>Platform hizmetlerinin sağlanması,</li>
                  <li>Premium üyeliklerin yönetimi,</li>
                  <li>Kullanıcı deneyiminin geliştirilmesi,</li>
                  <li>Teknik destek ve bilgilendirme faaliyetleri</li>
                </ul>
                amaçlarıyla işlenir.
              </li>
              <li>Kullanıcı, verilerinin belirtilen amaçlarla işlenmesine açık onay vermektedir.</li>
              <li>Veriler, yasal zorunluluklar dışında üçüncü kişilerle paylaşılmaz.</li>
              <li>Kullanıcı, dilediği zaman verilerinin silinmesini veya anonimleştirilmesini talep edebilir.</li>
            </ol>
          </div>

          <div className="border-t border-white/10 pt-6">
            <h2 className="text-2xl font-bold mb-4">5. Premium Üyelik ve Ödeme Koşulları</h2>
            <ol className="list-decimal list-inside space-y-3 text-muted-foreground ml-4">
              <li>Premium üyelik, kullanıcılara ek analiz araçları, gelişmiş veri görüntüleme özellikleri ve özel içeriklere erişim sağlar.</li>
              <li>Premium üyelik ücreti ve plan koşulları, platformda güncel olarak belirtilir.</li>
              <li>
                Ödeme işlemleri sırasında sayfada belirtilen talimatlara eksiksiz uyulmalıdır.
                Aksi takdirde oluşabilecek hatalı ödeme, gecikme veya olumsuz deneyimlerden Oruba Coin sorumlu değildir.
              </li>
              <li>Premium üyelik bedeli iade edilmez, ancak sistemsel bir hata durumunda kullanıcı destek ekibiyle iletişime geçebilir.</li>
              <li>Oruba Coin, hizmet kapsamını ve ücretleri önceden bildirmek suretiyle değiştirme hakkını saklı tutar.</li>
            </ol>
          </div>

          <div className="border-t border-white/10 pt-6">
            <h2 className="text-2xl font-bold mb-4">6. Kullanıcı Yükümlülükleri</h2>
            <p className="text-muted-foreground mb-3">Kullanıcı:</p>
            <ol className="list-decimal list-inside space-y-3 text-muted-foreground ml-4">
              <li>Platformu yalnızca yasal amaçlarla kullanacağını,</li>
              <li>Diğer kullanıcıların deneyimini olumsuz etkileyecek davranışlarda bulunmayacağını,</li>
              <li>Platformun kaynak kodlarını, verilerini veya yazılım altyapısını izinsiz kopyalamayacağını, değiştirmeyeceğini veya ticari amaçla kullanmayacağını kabul eder.</li>
            </ol>
          </div>

          <div className="border-t border-white/10 pt-6">
            <h2 className="text-2xl font-bold mb-4">7. Sorumluluk Reddi</h2>
            <ol className="list-decimal list-inside space-y-3 text-muted-foreground ml-4">
              <li>Oruba Coin, Binance API gibi üçüncü taraf veri kaynaklarından alınan bilgilerin doğruluğu, sürekliliği veya tamlığı konusunda garanti vermez.</li>
              <li>Platformda sunulan tüm fiyat, analiz ve istatistiksel veriler bilgilendirme amaçlıdır.</li>
              <li>Kripto para piyasaları yüksek volatilite içerdiğinden, kullanıcıların zarara uğraması durumunda Oruba Coin hiçbir şekilde sorumlu tutulamaz.</li>
              <li>Kullanıcı, platformu kullanırken aldığı tüm kararların kendi sorumluluğunda olduğunu kabul eder.</li>
            </ol>
          </div>

          <div className="border-t border-white/10 pt-6">
            <h2 className="text-2xl font-bold mb-4">8. Fikri Mülkiyet Hakları</h2>
            <p className="text-muted-foreground mb-3">
              Platformun tasarımı, yazılımı, grafik unsurları, veri yapısı ve içerikleri Oruba Coin'e aittir.
            </p>
            <p className="text-muted-foreground mb-3">
              İzinsiz kopyalanamaz, çoğaltılamaz veya dağıtılamaz.
            </p>
            <p className="text-muted-foreground">
              Oruba Coin markası, logosu ve görselleri tescilli ticari varlıklardır.
            </p>
          </div>

          <div className="border-t border-white/10 pt-6">
            <h2 className="text-2xl font-bold mb-4">9. Sözleşme Değişiklikleri</h2>
            <p className="text-muted-foreground mb-3">
              Oruba Coin, gerekli gördüğü durumlarda işbu sözleşme koşullarını tek taraflı olarak güncelleme hakkına sahiptir.
            </p>
            <p className="text-muted-foreground">
              Güncellenen metin platformda yayımlandığı anda yürürlüğe girer.
            </p>
            <p className="text-muted-foreground">
              Kullanıcı, siteyi kullanmaya devam ettiği sürece yeni koşulları kabul etmiş sayılır.
            </p>
          </div>

          <div className="border-t border-white/10 pt-6">
            <h2 className="text-2xl font-bold mb-4">10. Uygulanacak Hukuk ve Yetkili Mahkeme</h2>
            <p className="text-muted-foreground mb-3">
              Bu sözleşmeden doğabilecek uyuşmazlıklarda Türk Hukuku uygulanır.
            </p>
            <p className="text-muted-foreground">
              İstanbul (Merkez) Mahkemeleri ve İcra Daireleri yetkilidir.
            </p>
          </div>

          <div className="border-t border-white/10 pt-6">
            <h2 className="text-2xl font-bold mb-4">11. İletişim</h2>
            <div className="space-y-2 text-muted-foreground">
              <p className="font-semibold">Oruba Teknoloji A.Ş.</p>
              <p>E-posta: <a href="mailto:support@orubacoin.com" className="text-primary hover:underline">support@orubacoin.com</a></p>
              <p>Adres: İstanbul, Türkiye</p>
            </div>
          </div>

          <div className="border-t border-white/10 pt-6">
            <p className="text-muted-foreground italic">
              Kullanıcı, Oruba Coin platformuna kayıt olarak bu sözleşmenin tüm hükümlerini kabul ettiğini beyan eder.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

