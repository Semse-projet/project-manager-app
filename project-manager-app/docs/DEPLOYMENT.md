# Deployment Guide

## Production Environment

### Prerequisites
- Docker & Docker Compose
- Node 18+
- PostgreSQL 14+
- Redis (optional, for caching)

### Environment Variables
```bash
DATABASE_URL=postgresql://user:password@host:5432/dbname
JWT_SECRET=your-secret-key
LIENGRID_API_KEY=xxx
LOB_API_KEY=xxx
TOMORROW_API_KEY=xxx
SENTRY_DSN=xxx
NODE_ENV=production
```

### Docker Build
```bash
docker build -t project-manager:latest .
docker run -p 3000:3000 \
  -e DATABASE_URL=postgresql://... \
  -e JWT_SECRET=... \
  project-manager:latest
```

### CI/CD Pipeline
- GitHub Actions auto-deploys on `main` branch
- Runs tests before deployment
- Health check after deployment

### Monitoring
- Sentry for error tracking
- CloudWatch for logs
- Prometheus for metrics
- Datadog APM (optional)

### Database Migrations
```bash
npm run migrate
npm run seed
```

### Scaling
- Horizontal: Multiple app instances behind load balancer
- Vertical: Upgrade server specs
- Database: Read replicas for analytics queries

### Backup & Recovery
- Daily database backups
- Point-in-time recovery enabled
- S3 backup storage

### Performance Targets
- API latency: <200ms p95
- Database queries: <100ms p95
- Uptime: 99.9%

---

**For more details, see:** CI/CD pipeline in `.github/workflows/`
