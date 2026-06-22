#!/bin/bash

# Railway Deployment Script

set -e

echo "🚀 Project Manager App — Railway Deployment"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI not found. Install it:"
    echo "   npm install -g @railway/cli"
    exit 1
fi

# Check if logged in
if ! railway whoami &> /dev/null; then
    echo "🔐 Logging in to Railway..."
    railway login
fi

# Get project info
echo ""
echo "📦 Current project:"
railway status || echo "⚠️  No project linked. Run 'railway link'"

# Set environment variables
echo ""
echo "⚙️  Setting environment variables..."

# Create .env.production if not exists
if [ ! -f .env.production ]; then
    echo "❌ .env.production not found"
    echo "Create it with your production secrets and try again"
    exit 1
fi

# Load environment variables
set -a
source .env.production
set +a

# Set in Railway
railway variables set NODE_ENV=production
railway variables set LOG_LEVEL=info
railway variables set DATABASE_POOL_SIZE=20

if [ -n "$JWT_SECRET" ]; then
    railway variables set JWT_SECRET="$JWT_SECRET"
fi

if [ -n "$LIENGRID_API_KEY" ]; then
    railway variables set LIENGRID_API_KEY="$LIENGRID_API_KEY"
fi

if [ -n "$LOB_API_KEY" ]; then
    railway variables set LOB_API_KEY="$LOB_API_KEY"
fi

if [ -n "$TOMORROW_API_KEY" ]; then
    railway variables set TOMORROW_API_KEY="$TOMORROW_API_KEY"
fi

if [ -n "$SENTRY_DSN" ]; then
    railway variables set SENTRY_DSN="$SENTRY_DSN"
fi

echo "✅ Environment variables set"

# Build and deploy
echo ""
echo "🏗️  Building and deploying..."
railway up

# Wait for deployment
echo ""
echo "⏳ Waiting for deployment..."
sleep 10

# Check status
echo ""
echo "📊 Deployment status:"
railway status

# Get URL
echo ""
echo "✅ Deployment complete!"
RAILWAY_URL=$(railway domain)
echo "🌐 Your app is live at: https://$RAILWAY_URL"

echo ""
echo "📝 Next steps:"
echo "  1. Verify app at: https://$RAILWAY_URL/health"
echo "  2. Check logs: railway logs --service api"
echo "  3. Setup monitoring: railway logs --type metrics"
echo "  4. Configure alerts: dashboard.railway.app"

echo ""
echo "🎉 Deployment successful!"
