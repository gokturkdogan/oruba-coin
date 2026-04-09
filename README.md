# Oruba Coin 🚀
 
Oruba Coin is a sleek crypto market companion built to keep traders on top of spot and futures action in real time. Track the coins that matter, get alerted when prices move, and dive into full-screen charts wherever you are.

## ✨ Highlights
- ⚡ Live market coverage for spot and futures pairs
- 📰 Streamed trades, depth, and volume snapshots
- 📱 PWA installable on mobile with offline support
- 🔔 Push notifications even when the app is closed
- 🧭 Responsive UX tailored for desktop, tablet, and mobile
 
## 🛠️ Core Features
- 📈 Interactive charts with quick range selectors and full-screen modal on mobile
- 📊 Buy/sell volume breakdowns and hourly liquidity signals
- ⭐ Personal watchlists with flash animations on price swings
- 🚨 Price alerts that trigger background push notifications
- 📨 Premium approval emails paired with instant push reminders

## 📱 Platforms & Experience
- 🖥️ Desktop web (Next.js / React)
- 📱 Mobile web & PWA home-screen experience
- 📶 Works seamlessly across modern Chromium and Safari browsers

## 💎 Premium Structure
- 🔓 Unlock extended historical data windows
- 🧮 Access deeper analytics and enriched indicators
- 📋 Manage larger watchlists and unlimited alerts
- 🙋 Manual verification workflow for secure upgrades

## 🧰 Tech Stack
- 🧠 Next.js 14 (App Router), React 18, TypeScript
- 🎨 Tailwind CSS, shadcn/ui, Radix primitives
- 📊 Recharts for market visualization
- 🗄️ Prisma ORM with PostgreSQL
- 🌐 Binance REST + WebSocket data feeds
- 📬 Resend email delivery, Web Push (VAPID)
- ✅ Zod validation, JWT auth, bcrypt hashing

## ☁️ Infrastructure & Ops
- ▲ Deployed on Vercel with Frankfurt region preference
- 🌩️ Serverless API routes for business logic
- 🔄 SSE-based Binance proxy to bypass network blocks
- ⏰ External cron triggers for scheduled alert checks

## 📦 Progressive Web App
- 📥 Custom install prompt for mobile browsers
- 🧭 Service worker with cache-first static assets
- 🔔 Web push subscriptions stored per user
- 📳 Notification click-through logic for seamless deep links

## 🔐 Security & Reliability
- 🔑 JWT-secured endpoints with token rotation
- 🕵️ Role-based admin tools for subscription review
- 🧹 Automatic cleanup of expired push subscriptions
- 🛡️ Safe-guarded environment variables and region-aware Prisma binaries

Stay close to the market and let Oruba Coin surface the signals, so you can focus on the trades that count. 👋
