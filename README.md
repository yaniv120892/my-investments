# Investment Tracker - Personal Investment Management App

A comprehensive web application for tracking personal investments with real-time market data, portfolio management, and performance analytics.

## 🚀 Features

### 🔐 Authentication & Security

- Email/password registration and login
- Two-factor authentication with email verification codes
- Secure password hashing with bcrypt
- JWT-based session management
- Automatic session expiration

### 📱 Responsive Design

- Mobile-first responsive design with Tailwind CSS
- Dark mode toggle with user preferences
- Hebrew RTL support
- Optimized for desktop, tablet, and mobile

### 💼 Investment Categories

- **Stocks/ETFs** - Track individual stocks and ETFs
- **Cryptocurrencies** - Monitor crypto investments
- **Pension Funds** - Israeli pension fund tracking
- **Education Funds** - Education fund management
- **Investment Provident Funds** - Provident fund tracking
- **Money Market Funds** - Money market investments
- **Foreign Currencies** - USD and other currency tracking

### 📊 Portfolio Management

- Add, edit, and delete investments
- Real-time market data integration
- Portfolio value calculations in NIS
- Category-based investment grouping
- Performance tracking over time

### 🔗 Live Market Data

- **Stocks/ETFs**: Yahoo Finance via RapidAPI
- **Cryptocurrencies**: CoinGecko API
- **USD/NIS**: Bank of Israel exchange rates
- Redis caching with 1-hour TTL
- Automatic currency conversion to NIS

### 📈 Performance Analytics

- Portfolio snapshots with historical data
- Performance tracking over time
- Telegram notifications for portfolio updates
- Manual snapshot triggers via API

### ⚙️ User Settings

- Dark mode toggle
- Base currency selection (NIS, USD, EUR)
- User preferences persistence

## 🛠️ Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: PostgreSQL with Prisma ORM
- **Caching**: Redis via Upstash
- **Authentication**: Custom JWT-based system
- **Email**: Nodemailer for verification codes
- **Notifications**: Telegram Bot API
- **Deployment**: Vercel

## 📦 Installation

### Prerequisites

- Node.js 18+
- PostgreSQL database
- Redis instance (Upstash recommended)
- Email service (Gmail SMTP recommended)
- Telegram Bot (for notifications)

### 1. Clone the Repository

```bash
git clone <repository-url>
cd my-investments
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Setup

Create a `.env` file in the root directory:

```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/my_investments"

# Session Management
SESSION_TTL_MINUTES=60
JWT_SECRET="your-super-secret-jwt-key-change-this"

# Redis (Upstash)
UPSTASH_REDIS_REST_URL="https://your-redis-url.upstash.io"
UPSTASH_REDIS_REST_TOKEN="your-redis-token"

# Email Configuration
EMAIL_HOST="smtp.gmail.com"
EMAIL_PORT=587
EMAIL_USER="your-email@gmail.com"
EMAIL_PASS="your-app-password"

# Telegram Bot
TELEGRAM_BOT_TOKEN="your-telegram-bot-token"
TELEGRAM_CHAT_ID="your-chat-id"

# Market Data APIs
RAPIDAPI_KEY="your-rapidapi-key"
COINGECKO_API_KEY="your-coingecko-api-key"

# Bank of Israel API (optional)
BOI_API_KEY="your-boi-api-key"
```

### 4. Database Setup

```bash
# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev

# (Optional) Seed database
npx prisma db seed
```

### 5. Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:3000`

## 🚀 Deployment

### Vercel Deployment

1. **Push to GitHub**

   ```bash
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

2. **Connect to Vercel**

   - Go to [Vercel](https://vercel.com)
   - Import your GitHub repository
   - Add environment variables in Vercel dashboard

3. **Environment Variables in Vercel**
   Add all the environment variables from your `.env` file to the Vercel project settings.

4. **Database Setup**

   - Set up a PostgreSQL database (recommended: Supabase, PlanetScale, or Railway)
   - Update `DATABASE_URL` in Vercel environment variables
   - Run migrations: `npx prisma migrate deploy`

5. **Redis Setup**
   - Create an Upstash Redis instance
   - Update Redis environment variables in Vercel

### Manual Snapshot Trigger

To trigger portfolio snapshots manually:

```bash
curl -X POST https://your-app.vercel.app/api/snapshot
```

## 📁 Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   │   ├── auth/          # Authentication endpoints
│   │   ├── investments/   # Investment management
│   │   ├── snapshot/      # Portfolio snapshots
│   │   └── user/          # User settings
│   ├── dashboard/         # Main dashboard page
│   ├── login/             # Login page
│   ├── settings/          # User settings page
│   └── signup/            # Registration page
├── components/            # Reusable components
├── lib/                   # Core utilities
│   ├── auth.ts           # Authentication utilities
│   ├── db.ts             # Database connection
│   ├── emailService.ts   # Email functionality
│   ├── marketDataService.ts # Market data integration
│   ├── redis.ts          # Redis utilities
│   └── telegramNotifier.ts # Telegram notifications
├── types/                 # TypeScript type definitions
└── utils/                 # Utility functions
    └── format.ts         # Formatting utilities
```

## 🔧 API Endpoints

### Authentication

- `POST /api/auth/signup` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/verify` - Email verification
- `POST /api/auth/logout` - User logout

### Investments

- `GET /api/investments` - Get user investments
- `POST /api/investments` - Create new investment
- `PUT /api/investments/[id]` - Update investment
- `DELETE /api/investments/[id]` - Delete investment

### User Settings

- `GET /api/user/settings` - Get user settings
- `PATCH /api/user/settings` - Update user settings

### Snapshots

- `POST /api/snapshot` - Trigger portfolio snapshot

## 🧪 Testing

Currently, no testing framework is implemented. The application focuses on core functionality and can be extended with testing libraries like Jest and Cypress in the future.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:

- Create an issue in the GitHub repository
- Check the documentation
- Review the code comments for implementation details

## 🔮 Future Enhancements

- [ ] Investment performance charts
- [ ] Export portfolio data
- [ ] Multiple currency support
- [ ] Investment recommendations
- [ ] Tax reporting features
- [ ] Mobile app version
- [ ] Advanced analytics
- [ ] Social features (portfolio sharing)
