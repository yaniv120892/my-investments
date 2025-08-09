# Investment Tracker Setup Guide

## Quick Start

### 1. Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Database (Update with your PostgreSQL connection string)
DATABASE_URL="postgresql://username:password@localhost:5432/my_investments"

# Session Management
SESSION_TTL_MINUTES=60
JWT_SECRET="your-super-secret-jwt-key-change-this"

# Redis (Upstash - Get free tier at https://upstash.com)
UPSTASH_REDIS_REST_URL="https://your-redis-url.upstash.io"
UPSTASH_REDIS_REST_TOKEN="your-redis-token"

# Email Configuration (Gmail recommended)
EMAIL_HOST="smtp.gmail.com"
EMAIL_PORT=587
EMAIL_USER="your-email@gmail.com"
EMAIL_PASS="your-app-password"

# Telegram Bot (Optional - for notifications)
TELEGRAM_BOT_TOKEN="your-telegram-bot-token"
TELEGRAM_CHAT_ID="your-chat-id"

# Market Data APIs
RAPIDAPI_KEY="your-rapidapi-key"
COINGECKO_API_KEY="your-coingecko-api-key"
```

### 2. Database Setup

#### Option A: Local PostgreSQL

1. Install PostgreSQL on your machine
2. Create a database: `createdb my_investments`
3. Update `DATABASE_URL` in `.env`

#### Option B: Cloud Database (Recommended)

1. **Supabase** (Free tier available):

   - Go to https://supabase.com
   - Create a new project
   - Copy the connection string to `DATABASE_URL`

2. **PlanetScale** (Free tier available):

   - Go to https://planetscale.com
   - Create a new database
   - Copy the connection string to `DATABASE_URL`

3. **Railway** (Free tier available):
   - Go to https://railway.app
   - Create a new PostgreSQL database
   - Copy the connection string to `DATABASE_URL`

### 3. Redis Setup (Upstash)

1. Go to https://upstash.com
2. Create a new Redis database
3. Copy the REST URL and token to your `.env` file

### 4. Email Setup (Gmail)

1. Enable 2-factor authentication on your Gmail account
2. Generate an App Password:
   - Go to Google Account settings
   - Security → 2-Step Verification → App passwords
   - Generate a password for "Mail"
3. Use your Gmail address and the app password in `.env`

### 5. Market Data APIs

#### RapidAPI (Yahoo Finance)

1. Go to https://rapidapi.com
2. Subscribe to "Yahoo Finance" API
3. Copy your API key to `RAPIDAPI_KEY`

#### CoinGecko (Cryptocurrencies)

1. Go to https://coingecko.com/en/api
2. Get a free API key
3. Copy to `COINGECKO_API_KEY`

### 6. Telegram Bot (Optional)

1. Message @BotFather on Telegram
2. Create a new bot with `/newbot`
3. Copy the bot token to `TELEGRAM_BOT_TOKEN`
4. Get your chat ID by messaging your bot and checking:
   https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates

### 7. Run Database Migrations

```bash
npx prisma migrate dev --name init
```

### 8. Start Development Server

```bash
npm run dev
```

## Deployment to Vercel

### 1. Push to GitHub

```bash
git add .
git commit -m "Initial commit"
git push origin main
```

### 2. Deploy on Vercel

1. Go to https://vercel.com
2. Import your GitHub repository
3. Add all environment variables in Vercel dashboard
4. Deploy

### 3. Database Migration on Vercel

```bash
npx prisma migrate deploy
```

## Testing the Application

1. Visit `http://localhost:3000`
2. Create a new account
3. Add some test investments
4. Check the dashboard functionality

## Troubleshooting

### Database Connection Issues

- Verify your `DATABASE_URL` is correct
- Ensure the database server is running
- Check if the database exists

### Email Issues

- Verify Gmail app password is correct
- Check if 2FA is enabled
- Test with a different email provider

### Redis Issues

- Verify Upstash credentials
- Check if Redis URL is accessible
- Test connection manually

### Market Data Issues

- Verify API keys are correct
- Check API rate limits
- Test API endpoints manually

## Next Steps

1. **Add Real Investments**: Start adding your actual investments
2. **Configure Notifications**: Set up Telegram bot for portfolio updates
3. **Customize Settings**: Adjust dark mode and currency preferences
4. **Monitor Performance**: Use the snapshot feature to track portfolio changes

## Support

If you encounter issues:

1. Check the console for error messages
2. Verify all environment variables are set
3. Test each service individually
4. Create an issue in the GitHub repository
