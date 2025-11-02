# Oruba Coin - Crypto Analysis Platform

A comprehensive cryptocurrency analysis platform built with Next.js, providing real-time price data, market insights, and advanced analytics.

## Features

- 🔄 **Real-time Data**: Live cryptocurrency prices from Binance API with WebSocket support
- 📊 **Advanced Analytics**: Premium features including detailed charts, indicators, and market analysis
- 💳 **Premium Subscriptions**: Stripe-integrated subscription system
- 🔐 **Authentication**: Secure JWT-based authentication system
- 📱 **Responsive Design**: Modern UI built with TailwindCSS and shadcn/ui
- ⚡ **Performance**: Optimized data fetching and caching strategies

## Tech Stack

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript, TailwindCSS
- **UI Components**: shadcn/ui, Radix UI
- **Backend**: Next.js API Routes, Prisma ORM
- **Database**: PostgreSQL
- **Authentication**: JWT (jsonwebtoken), bcryptjs
- **Payment**: Stripe
- **Data Source**: Binance API (REST + WebSocket)
- **Charts**: Recharts

## Getting Started

### Prerequisites

- Node.js 18+ 
- PostgreSQL database
- Stripe account (for payments)
- Binance API keys (optional, public data doesn't require keys)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd oruba-coin
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

Edit `.env` and fill in your configuration:
- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: Secret key for JWT tokens
- `STRIPE_SECRET_KEY`: Stripe secret key
- `STRIPE_PREMIUM_PRICE_ID`: Stripe price ID for premium subscription
- `STRIPE_WEBHOOK_SECRET`: Stripe webhook secret
- `NEXT_PUBLIC_APP_URL`: Your app URL (http://localhost:3000 for local)

4. Set up the database:
```bash
npx prisma generate
npx prisma migrate dev
```

5. Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
oruba-coin/
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes
│   │   ├── auth/         # Authentication endpoints
│   │   ├── coins/        # Coin data endpoints
│   │   ├── user/         # User profile endpoints
│   │   ├── stripe/       # Stripe checkout
│   │   └── webhook/      # Stripe webhook
│   ├── coins/            # Coin pages
│   ├── login/            # Login page
│   ├── register/         # Registration page
│   ├── profile/          # User profile
│   └── checkout/         # Premium subscription
├── components/           # React components
│   ├── ui/              # shadcn/ui components
│   └── navbar.tsx       # Navigation component
├── lib/                  # Utility libraries
│   ├── prisma.ts        # Prisma client
│   ├── auth.ts          # Authentication utilities
│   ├── binance.ts       # Binance API client
│   ├── stripe.ts        # Stripe client
│   └── websocket.ts     # WebSocket client
└── prisma/              # Database schema
    └── schema.prisma    # Prisma schema
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user

### Coins
- `GET /api/coins` - Get all coins (with search, sort, filter)
- `GET /api/coins/popular` - Get top 5 popular coins
- `GET /api/coins/[symbol]` - Get coin details

### User
- `GET /api/user/profile` - Get user profile

### Stripe
- `POST /api/stripe/create-checkout` - Create checkout session
- `POST /api/webhook/stripe` - Handle Stripe webhooks

## Database Schema

- **Users**: User accounts and authentication
- **Subscriptions**: Premium subscription management
- **Coins**: Coin metadata
- **PriceSnapshots**: Historical price data
- **UserEvents**: User activity tracking

## Premium Features

Premium subscribers get access to:
- Daily charts and extended historical data
- Advanced technical indicators
- Data export functionality
- Price alerts (coming soon)

## Deployment

### Vercel

1. Push your code to GitHub
2. Import project in Vercel
3. Set environment variables in Vercel dashboard
4. Deploy

### Database

For production, use a managed PostgreSQL service like:
- Vercel Postgres
- Supabase
- Neon
- Railway

### WebSocket Scaling

For production WebSocket scaling, consider:
- Separate WebSocket service (Node.js/Express)
- Redis Pub/Sub for message distribution
- Socket.io for client-server communication

## Environment Variables

See `.env.example` for all required environment variables.

## Development

```bash
# Run development server
npm run dev

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev

# Open Prisma Studio
npx prisma studio
```

## License

MIT

## Support

For issues and questions, please open an issue on GitHub.
