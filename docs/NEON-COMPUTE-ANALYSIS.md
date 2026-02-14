# Neon Compute Time Analizi

Neon'da **compute time**, veritabanı işlemci kaynağının ne kadar süre aktif kaldığıyla ölçülür. Hem sorgu süreleri hem de compute açıkken geçen boş (idle) süre dahildir. Aylık limitin ~%80’e gelmesinin olası nedenleri ve yapılabilecekler aşağıda.

---

## 1. Her auth isteğinde DB sorgusu (En olası ana neden)

**Nerede:** `lib/auth.ts` → `getCurrentUser(token)`

- JWT verify’dan sonra **her seferinde** `prisma.user.findUnique({ where: { id }, include: { subscription: true } })` çalışıyor.
- Bu fonksiyon şu API’lerde kullanılıyor:
  - `GET /api/user/profile` (navbar + birçok sayfa)
  - `requireAuth` kullanan tüm route’lar (profile, subscription, alerts, admin vb.)

**Etki:** Giriş yapmış her kullanıcı, her sayfa açılışı / API çağrısında en az 1 DB round-trip. Navbar tek başına her sayfa yüklemesinde `/api/user/profile` çağırıyor → her sayfa = 1 user+subscription sorgusu. Trafik artınca compute süresi hızla artar.

**Öneri:**
- **Kısa TTL’li cache:** `getCurrentUser` sonucunu token hash’i (veya userId) ile in-memory cache’le (örn. 1–2 dakika). Aynı token ile gelen istekler bu süre içinde DB’ye gitmesin.
- **Alternatif:** Kritik olmayan yerlerde sadece JWT’den userId/email okuyup DB’ye hiç gitmeyin; sadece abonelik gerektiren işlemlerde (alerts, watchlist, subscription) `getCurrentUser` ile tam user + subscription çekin.

---

## 2. Alarm / cron job’lar (alerts check)

**Nerede:** `app/api/alerts/check/route.ts`

- Dışarıdan (Vercel Cron veya harici cron) periyodik çağrılıyorsa (örn. her 1–2 dakika):
  - `PriceAlert.findMany` (tüm aktif alarmlar)
  - Tetiklenenler için `$transaction` (update + `userEvent.createMany`)
  - `PushSubscription.findMany`
  - Gerekirse `deleteMany`
- Her çalışma = birkaç DB round-trip + Neon compute’un uyanık kalması.

**Etki:** Örneğin dakikada 1 çalışırsa ayda ~43.200 çalışma; her biri DB’yi meşgul eder ve compute süresini artırır.

**Öneri:**
- Cron aralığını **5 dakika veya daha fazla** yapın (alarmlar için genelde yeterli).
- Sadece aktif alarm sayısı > 0 ise fiyat çekip kontrol edin; 0 ise erken çıkıp DB/API yükünü azaltın.

---

## 3. oruba-coin-worker – settings her 30 saniyede (Çok yüksek etki)

**Nerede:** `oruba-coin-worker` (Fly.io), `src/index.js`

Worker **doğrudan Neon’a bağlanmıyor**; sadece Oruba backend API’lerini (Vercel) çağırıyor. Ama bu çağrılar backend’i tetikliyor, backend de her istekte DB’ye gidiyor.

- **`scheduleSettingsRefresh()`:** Her **30 saniyede** çalışıyor (satır 378–382).
- **İki worker** var (SPOT + FUTURES); ikisi de kendi interval’inde `GET /api/volume-alert/settings` çağırıyor.
- **Sonuç:** 30 saniyede 2 istek → dakikada 4 istek → ayda **~172.800** `/api/volume-alert/settings` çağrısı.
- Bu endpoint (`app/api/volume-alert/settings/route.ts`) her çağrıda **`prisma.settings.findUnique`** (ve gerekirse `create`) yapıyor → **ayda ~172.800 DB sorgusu** sadece settings için.

Threshold değerleri çok nadiren değişir; 30 saniye gereksiz yere agresif.

**Öneri:**
- Worker’da settings refresh aralığını **en az 5 dakika** (300.000 ms) yapın. İsterseniz 2–3 dakika da yeterli.
- Böylece ayda ~172.800 yerine **~5.760** (5 dk) veya **~17.280** (2 dk) çağrıya iner; Neon compute belirgin azalır.

---

## 4. Volume / push bildirim job’ları

**Nerede:** `app/api/push/volume/route.ts`, `app/api/push/futures-volume/route.ts`, `app/api/push/admin-settings-update/route.ts`

- Hepsi `prisma.pushSubscription.findMany()` (bazıları tüm subscription’lar) ve gerekirse `deleteMany` yapıyor.
- Sık tetiklenen bir cron veya worker varsa her tetikleme DB’yi çalıştırır.

**Öneri:**
- Bu endpoint’leri ne sıklıkla çağırdığınızı kontrol edin (örn. 1 dk yerine 5–15 dk).
- Mümkünse sadece ilgili kullanıcıların subscription’larını çekin (ör. volume alert’e abone olanlar); gerekmedikçe tüm listeyi çekmeyin.

---

## 5. Bağlantı / connection pool

**Nerede:** `prisma/schema.prisma`, `DATABASE_URL`, serverless ortamı

- Neon **serverless**’ta her soğuk başlangıç veya yeni connection compute’u uyandırır veya açık tutar.
- Vercel’de her API route invocation’ı yeni Prisma/connection açabiliyor; connection sayısı ve süresi compute time’a yansır.

**Öneri:**
- **Neon connection pooler** kullanın. Neon dashboard’dan “Connection string” içinde **pooled** (pgbouncer) URL’i alın; `DATABASE_URL` olarak onu kullanın. Böylece gerçek DB connection sayısı azalır, compute daha verimli kullanılır.
- Prisma için Neon’un önerdiği connection limit’i (örn. `?connection_limit=5` veya pooler’ın limiti) kullanın; aşırı connection açmayın.

---

## 6. Gereksiz / ağır sorgular

- **`/api/coins` (app/api/coins/route.ts):** Prisma import edilmiş ama route içinde kullanılmıyor. Kaldırırsanız yanlışlıkla eklenebilecek sorguların önüne geçersiniz.
- **Admin / stats:** `app/api/admin/stats/route.ts` içinde birden fazla `count()` ve `findMany` var; sadece admin panelinden nadiren çağrılıyorsa büyük etki yapmaz ama gereksiz büyük `findMany` (limit yok) varsa `take` ile sınırlayın.

---

## 7. Development / log

- `lib/prisma.ts` içinde `NODE_ENV === 'development'` iken `log: ['query', 'error', 'warn']` açık. Bu sadece log yazdırır, Neon’a ekstra compute yükü bindirmez; production’da zaten `['error']` kullanılıyor.

---

## Özet tablo

| Kaynak                    | Olası etki      | Öncelik |
|---------------------------|-----------------|--------|
| **Worker settings 30 sn** | **Çok yüksek**  | **1**  |
| getCurrentUser her istekte DB | Yüksek          | 2      |
| Alerts check cron sıklığı | Orta–yüksek     | 3      |
| Push/volume cron sıklığı  | Orta            | 4      |
| Connection pool kullanmama | Orta (serverless) | 5  |
| Gereksiz Prisma kullanımı | Düşük            | 6      |

---

## Hızlı yapılabilecekler

1. **oruba-coin-worker:** `scheduleSettingsRefresh` aralığını **30 saniye → 5 dakika** (300_000 ms) yapın. Tek değişiklikle ayda ~172k DB sorgusu ~5.7k’ya iner.
2. **Neon dashboard:** Connection string’de **pooled** URL kullanıldığından emin olun.
3. **Cron:** Alerts check ve push/volume job’larının tetiklenme sıklığını 5 dk veya üzeri yapın.
4. **getCurrentUser cache:** Kısa TTL’li (1–2 dk) in-memory cache ekleyin; aynı token ile tekrarlayan isteklerde DB’ye gitmeyin.
5. **app/api/coins/route.ts:** Kullanılmayan `prisma` import’u kaldırıldı (yapıldı).

Bu adımlar özellikle **worker settings** ve getCurrentUser, Neon compute time’ı belirgin düşürür.
