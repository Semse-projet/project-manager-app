# Railway Deployment Guide

**Project Manager App on Railway**

---

## ✅ Prerequisites

1. **Railway Account** — Sign up at https://railway.app
2. **Railway CLI** — `npm install -g @railway/cli`
3. **Git Repository** — Pushed to GitHub

---

## 🚀 Quick Start (5 minutes)

### 1. Login to Railway
```bash
railway login
```

### 2. Create Railway Project
```bash
railway init
```

### 3. Link to GitHub
```bash
railway link --from github
```

Select your repository (project-manager-app)

### 4. Configure Services

Railway will auto-detect services from `railway.json`:
- **API Server** (Node.js)
- **PostgreSQL** (Database)
- **Redis** (Cache)

### 5. Set Environment Variables
```bash
railway variables set NODE_ENV=production
railway variables set JWT_SECRET=your-secret-key
railway variables set LIENGRID_API_KEY=your-key
railway variables set LOB_API_KEY=your-key
railway variables set TOMORROW_API_KEY=your-key
railway variables set LENDER_API_KEY=your-key
railway variables set SENTRY_DSN=your-dsn
```

### 6. Deploy
```bash
railway up
```

**Done!** Your app is live on Railway 🚀

---

## 📊 Project Structure on Railway

```
Project: project-manager-app
├── API Server (Node.js)
│   ├── Port: 3000
│   ├── Replicas: 3 (auto-scaling)
│   ├── Health checks: enabled
│   └── Logs: Real-time streaming
│
├── PostgreSQL Database
│   ├── Version: 14
│   ├── Plan: Pro
│   ├── Backups: Automatic daily
│   └── Restore: Point-in-time
│
└── Redis Cache
    ├── Version: 7
    ├── Plan: Standard
    └── TTL: 6 hours default
```

---

## 🔧 Configuration

### Auto-scaling
```
Min replicas: 3
Max replicas: 10
CPU target: 70%
Memory target: 80%
```

### Health Checks
```
Liveness: GET /health (every 30s)
Readiness: GET /ready (every 10s)
Timeout: 5s
```

### Resources
```
API: 256MB memory, 250m CPU
Database: Standard plan
Cache: Standard plan
```

---

## 📈 Monitoring

### Railway Dashboard
- Real-time logs
- Deployment history
- Service metrics
- Health status

### Access Logs
```bash
railway logs --service api
```

### See Deployments
```bash
railway logs --type deployment
```

### Monitor Metrics
```bash
railway logs --type metrics
```

---

## 🔄 Continuous Deployment

Railway auto-deploys on git push to main:

```bash
git push origin main
```

Railway will:
1. Build Docker image
2. Run tests
3. Deploy to production
4. Run health checks
5. Auto-rollback if fails

---

## 🆘 Troubleshooting

### App not starting?
```bash
railway logs --service api
```

Check logs for errors. Common issues:
- Missing environment variables
- Database connection failed
- Redis connection failed

### Database connection error?
```bash
railway logs --service postgres
```

Verify `DATABASE_URL` environment variable:
```bash
railway variables get DATABASE_URL
```

### High memory usage?
```bash
railway logs --type metrics
```

Check if need to increase replicas or memory:
```bash
railway update --service api --memory 512
```

---

## 📦 Deployment Workflow

```
1. Commit changes
   git commit -am "feat: new feature"

2. Push to main
   git push origin main

3. Railway auto-detects
   Webhook trigger

4. Build starts
   Docker image built

5. Tests run
   All 160+ tests pass

6. Deploy to staging
   Health checks

7. Deploy to production
   Rolling update (3 replicas)

8. Monitor
   Logs, metrics, alerts
```

---

## 🔐 Security on Railway

- **SSL/TLS**: Auto-generated HTTPS
- **Secrets**: Environment variables encrypted
- **Network**: Isolated VPC
- **Backups**: Automatic PostgreSQL backups
- **Logs**: Encrypted and retained

---

## 💰 Costs Estimation

```
API Server (3 replicas):    $7/month each = $21
PostgreSQL (Pro):           $9/month
Redis (Standard):           $5/month
Storage (10GB):             $0.10/month

Total: ~$35/month (starting cost)
Scales with usage

Free tier available for testing
```

---

## 🔄 Manual Deployment

If needed to deploy manually:

```bash
# Build locally
docker build -t project-manager:latest .

# Tag for Railway
docker tag project-manager:latest railway.app/project-manager:latest

# Push to Railway registry
docker push railway.app/project-manager:latest

# Or use Railway CLI
railway deploy --service api
```

---

## 📚 Useful Commands

```bash
# View environment variables
railway variables

# Update variable
railway variables set KEY=value

# Check deployment status
railway status

# View service logs
railway logs --service api

# SSH into container (if needed)
railway shell --service api

# Update service configuration
railway update --service api --memory 512

# List all services
railway services

# Check metrics
railway metrics --service api
```

---

## 🎯 Next Steps

1. ✅ Deploy to Railway
2. ✅ Configure custom domain
3. ✅ Setup monitoring alerts
4. ✅ Configure backups
5. ✅ Enable auto-scaling

---

## 📞 Support

- **Railway Docs**: https://docs.railway.app
- **Community**: https://railway.app/community
- **Discord**: https://discord.gg/railway

---

**Status: ✅ Ready for Railway Deployment**

*For more details, see railway.json configuration*
