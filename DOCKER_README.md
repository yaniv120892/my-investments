# Docker Setup for My Investments

This guide will help you set up PostgreSQL and Redis using Docker for the My Investments application.

## Prerequisites

- Docker and Docker Compose installed on your system
- Node.js and npm (for running the application)

## Quick Start

### 1. Start the Services

```bash
docker-compose up -d
```

This will start:

- PostgreSQL on port 5432
- Redis on port 6379

### 2. Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Database (Docker PostgreSQL)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/my_investments"

# Session Management
SESSION_TTL_MINUTES=60
JWT_SECRET="your-super-secret-jwt-key-change-this"

# Redis (Docker Redis)
UPSTASH_REDIS_REST_URL="redis://localhost:6379"
UPSTASH_REDIS_REST_TOKEN=""

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

### 3. Database Setup

Run the database migrations:

```bash
npm run db:generate
npm run db:migrate
```

### 4. Start the Application

```bash
npm run dev
```

## Docker Commands

### Start Services

```bash
docker-compose up -d
```

### Stop Services

```bash
docker-compose down
```

### View Logs

```bash
# All services
docker-compose logs

# Specific service
docker-compose logs postgres
docker-compose logs redis
```

### Reset Data

```bash
# Stop and remove volumes (WARNING: This will delete all data)
docker-compose down -v
docker-compose up -d
```

### Access PostgreSQL

```bash
# Connect to PostgreSQL container
docker exec -it my-investments-postgres psql -U postgres -d my_investments

# Or connect from host
psql -h localhost -p 5432 -U postgres -d my_investments
```

### Access Redis

```bash
# Connect to Redis container
docker exec -it my-investments-redis redis-cli

# Or connect from host
redis-cli -h localhost -p 6379
```

## Service Details

### PostgreSQL

- **Image**: postgres:15-alpine
- **Port**: 5432
- **Database**: my_investments
- **Username**: postgres
- **Password**: postgres
- **Data Volume**: postgres_data

### Redis

- **Image**: redis:7-alpine
- **Port**: 6379
- **Data Volume**: redis_data

## Troubleshooting

### Database Connection Issues

- Ensure PostgreSQL container is running: `docker-compose ps`
- Check logs: `docker-compose logs postgres`
- Verify DATABASE_URL in your .env file

### Redis Connection Issues

- Ensure Redis container is running: `docker-compose ps`
- Check logs: `docker-compose logs redis`
- Verify UPSTASH_REDIS_REST_URL in your .env file

### Port Conflicts

If ports 5432 or 6379 are already in use:

1. Stop the conflicting services
2. Or modify the ports in docker-compose.yml:
   ```yaml
   ports:
     - "5433:5432" # Use port 5433 instead
   ```

## Production Considerations

For production deployment:

1. Change default passwords
2. Use environment variables for sensitive data
3. Configure proper backup strategies
4. Set up monitoring and logging
5. Consider using managed services instead of Docker containers

## Next Steps

1. Set up your environment variables
2. Run database migrations
3. Start the Next.js development server
4. Test the application functionality
