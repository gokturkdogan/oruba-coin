# Oruba Coin - Crypto Analysis Platform

**English** | [Türkçe](#türkçe)

---

## English

### Overview

Oruba Coin is a comprehensive cryptocurrency analysis platform that provides real-time market data, advanced analytics, and personalized tracking features for both spot and futures markets. Built with modern web technologies, the platform offers real-time price updates, detailed charts, watchlist management, and price alert systems.

### How It Works

The platform integrates with Binance API to fetch real-time cryptocurrency data through both REST API and WebSocket connections. Users can browse spot and futures markets separately, track their favorite coins in personalized watchlists, and set up price alerts that notify them when prices reach specific thresholds. The system processes market data continuously, providing up-to-date information on prices, volumes, and trading activities.

For premium subscribers, the platform offers enhanced features including extended historical data, detailed market analysis, and advanced tracking capabilities. Subscription renewals are managed through manual EFT/Havale requests that the support team reviews and approves.

### Key Features

#### Market Data
- **Real-time Spot Market**: Live prices, 24-hour volume, and hourly volume tracking for spot markets
- **Real-time Futures Market**: Live prices, 24-hour volume, and hourly volume tracking for futures markets
- **Buy/Sell Volume Breakdown**: Detailed analysis of buying and selling volumes for both markets
- **Price Charts**: Interactive charts with multiple time ranges (1M, 5M, 15M, 30M, 1D, 7D, 30D, 90D, 1Y)
- **Trade History**: Real-time trade feed showing buy and sell orders

#### Watchlist Management
- **Spot Watchlist**: Personal watchlist for spot market coins with real-time updates
- **Futures Watchlist**: Personal watchlist for futures market coins with real-time updates
- **Real-time Updates**: WebSocket-powered live price and volume updates
- **Flash Animations**: Visual indicators for price movements

#### Price Alerts
- **Spot Price Alerts**: Set alerts for spot market prices (above/below thresholds)
- **Futures Price Alerts**: Set alerts for futures market prices (above/below thresholds)
- **Multiple Alerts**: Up to 2 alerts per coin (one for above, one for below price)
- **Browser Notifications**: Real-time notifications when price targets are reached

#### Premium Features
- **Extended Historical Data**: Access to longer time ranges and more detailed charts
- **Advanced Analytics**: In-depth market analysis and indicators
- **Watchlist Management**: Track up to 10 coins per watchlist
- **Price Alerts**: Unlimited price alerts for market monitoring

#### User Management
- **Secure Authentication**: JWT-based authentication system with email verification
- **User Profiles**: Personal dashboard and settings management
- **Admin Panel**: Administrative tools for user and payment management

### Technologies Used

#### Frontend
- **Next.js 16** (App Router) - React framework with server-side rendering
- **React 19** - Modern UI library
- **TypeScript** - Type-safe development
- **TailwindCSS** - Utility-first CSS framework
- **shadcn/ui** - High-quality component library
- **Radix UI** - Accessible component primitives
- **Recharts** - Charting library for data visualization

#### Backend
- **Next.js API Routes** - Serverless API endpoints
- **Prisma ORM** - Database ORM for PostgreSQL
- **PostgreSQL** - Relational database for data persistence

#### Authentication & Security
- **JWT (jsonwebtoken)** - Token-based authentication
- **bcryptjs** - Password hashing
- **Email Verification** - Account verification system

#### External Services
- **Binance API** - REST API and WebSocket for cryptocurrency data
- **Resend** - Email delivery service

#### Data Processing
- **WebSocket** - Real-time bidirectional communication
- **Zod** - Schema validation

### System Architecture

The application follows a modern full-stack architecture:

1. **Frontend Layer**: React components with Next.js App Router for client-side rendering and server-side rendering
2. **API Layer**: Next.js API routes handling business logic and data processing
3. **Database Layer**: PostgreSQL database managed through Prisma ORM
4. **Real-time Layer**: WebSocket connections to Binance for live market data
5. **External Services**: Integration with Binance API and email services

Data flows from Binance API through WebSocket connections, processes in real-time, and displays to users through the React frontend. User interactions trigger API calls that update the database and manage user preferences.

---

## Türkçe

### Genel Bakış

Oruba Coin, spot ve vadeli piyasalar için gerçek zamanlı piyasa verileri, gelişmiş analitikler ve kişiselleştirilmiş takip özellikleri sunan kapsamlı bir kripto para analiz platformudur. Modern web teknolojileri ile geliştirilen platform, gerçek zamanlı fiyat güncellemeleri, detaylı grafikler, takip listesi yönetimi ve fiyat alarm sistemi sunar.

### Sistem İşleyişi

Platform, Binance API ile entegre olarak REST API ve WebSocket bağlantıları üzerinden gerçek zamanlı kripto para verilerini çeker. Kullanıcılar spot ve vadeli piyasaları ayrı ayrı görüntüleyebilir, favori coinlerini kişisel takip listelerinde takip edebilir ve fiyatlar belirli eşiklere ulaştığında bildirim almak için fiyat alarmları kurabilir. Sistem, piyasa verilerini sürekli işleyerek fiyatlar, hacimler ve işlem faaliyetleri hakkında güncel bilgi sağlar.

Premium aboneler için platform, genişletilmiş geçmiş veriler, detaylı piyasa analizi ve gelişmiş takip özellikleri sunar. Abonelik yenilemeleri, destek ekibinin onayladığı EFT/Havale talepleriyle manuel olarak yönetilir.

### Temel Özellikler

#### Piyasa Verileri
- **Gerçek Zamanlı Spot Piyasası**: Spot piyasalar için canlı fiyatlar, 24 saatlik hacim ve saatlik hacim takibi
- **Gerçek Zamanlı Vadeli Piyasası**: Vadeli piyasalar için canlı fiyatlar, 24 saatlik hacim ve saatlik hacim takibi
- **Alış/Satış Hacim Analizi**: Her iki piyasa için alış ve satış hacimlerinin detaylı analizi
- **Fiyat Grafikleri**: Birden fazla zaman aralığı ile interaktif grafikler (1Dk, 5Dk, 15Dk, 30Dk, 1G, 7G, 30G, 90G, 1Y)
- **İşlem Geçmişi**: Alış ve satış emirlerini gösteren gerçek zamanlı işlem akışı

#### Takip Listesi Yönetimi
- **Spot Takip Listesi**: Gerçek zamanlı güncellemeler ile spot piyasa coinleri için kişisel takip listesi
- **Vadeli Takip Listesi**: Gerçek zamanlı güncellemeler ile vadeli piyasa coinleri için kişisel takip listesi
- **Gerçek Zamanlı Güncellemeler**: WebSocket destekli canlı fiyat ve hacim güncellemeleri
- **Flash Animasyonları**: Fiyat hareketleri için görsel göstergeler

#### Fiyat Alarmları
- **Spot Fiyat Alarmları**: Spot piyasa fiyatları için alarm kurulumu (yukarı/aşağı eşik değerleri)
- **Vadeli Fiyat Alarmları**: Vadeli piyasa fiyatları için alarm kurulumu (yukarı/aşağı eşik değerleri)
- **Çoklu Alarmlar**: Coin başına maksimum 2 alarm (biri yukarı, biri aşağı fiyat için)
- **Tarayıcı Bildirimleri**: Fiyat hedeflerine ulaşıldığında gerçek zamanlı bildirimler

#### Premium Özellikler
- **Genişletilmiş Geçmiş Veriler**: Daha uzun zaman aralıkları ve daha detaylı grafiklere erişim
- **Gelişmiş Analitikler**: Derinlemesine piyasa analizi ve göstergeler
- **Takip Listesi Yönetimi**: Takip listesi başına 10 coin'e kadar takip etme
- **Fiyat Alarmları**: Piyasa izleme için sınırsız fiyat alarmı

#### Kullanıcı Yönetimi
- **Güvenli Kimlik Doğrulama**: E-posta doğrulama ile JWT tabanlı kimlik doğrulama sistemi
- **Kullanıcı Profilleri**: Kişisel kontrol paneli ve ayar yönetimi
- **Admin Paneli**: Kullanıcı ve ödeme yönetimi için yönetim araçları

### Kullanılan Teknolojiler

#### Frontend
- **Next.js 16** (App Router) - Sunucu tarafı render ile React framework
- **React 19** - Modern UI kütüphanesi
- **TypeScript** - Tip güvenli geliştirme
- **TailwindCSS** - Utility-first CSS framework
- **shadcn/ui** - Yüksek kaliteli bileşen kütüphanesi
- **Radix UI** - Erişilebilir bileşen primitifleri
- **Recharts** - Veri görselleştirme için grafik kütüphanesi

#### Backend
- **Next.js API Routes** - Sunucusuz API endpoint'leri
- **Prisma ORM** - PostgreSQL için veritabanı ORM'i
- **PostgreSQL** - Veri kalıcılığı için ilişkisel veritabanı

#### Kimlik Doğrulama ve Güvenlik
- **JWT (jsonwebtoken)** - Token tabanlı kimlik doğrulama
- **bcryptjs** - Şifre hashleme
- **E-posta Doğrulama** - Hesap doğrulama sistemi

#### Harici Servisler
- **Binance API** - Kripto para verileri için REST API ve WebSocket
- **Resend** - E-posta teslimat servisi

#### Veri İşleme
- **WebSocket** - Gerçek zamanlı çift yönlü iletişim
- **Zod** - Şema doğrulama

### Sistem Mimarisi

Uygulama modern bir full-stack mimari izler:

1. **Frontend Katmanı**: İstemci tarafı render ve sunucu tarafı render için Next.js App Router ile React bileşenleri
2. **API Katmanı**: İş mantığı ve veri işlemeyi yöneten Next.js API route'ları
3. **Veritabanı Katmanı**: Prisma ORM ile yönetilen PostgreSQL veritabanı
4. **Gerçek Zamanlı Katman**: Canlı piyasa verileri için Binance'e WebSocket bağlantıları
5. **Harici Servisler**: Binance API ve e-posta servisleri ile entegrasyon

Veriler Binance API'den WebSocket bağlantıları üzerinden gelir, gerçek zamanlı olarak işlenir ve React frontend aracılığıyla kullanıcılara gösterilir. Kullanıcı etkileşimleri, veritabanını güncelleyen ve kullanıcı tercihlerini yöneten API çağrılarını tetikler.
