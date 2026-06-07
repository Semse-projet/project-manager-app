# Logging Integration Plan - SEMSE Services

**Goal:** Integrate Python SEMSE logger into key services  
**Status:** Ready to execute after Railway verification  
**Scope:** Wire up logging to autonomy-server, API bridge, and key workers

---

## Phase 1: Autonomy Server (15 min)

**Location:** `/home/yoni/labsemse/project-manager-app/apps/autonomy-server/src/server.mjs`

**Action:** 
```javascript
// Before: console.log
// After: 
const logger = new SEMSELogger("autonomy-server", run_id=process.env.RUN_ID);
logger.info("Server starting", { port: 3005, version: "1.0" });
```

**Impact:** Autonomy logs now structured, traceable, Railway-ready

---

## Phase 2: API Service Logger Middleware

**Location:** `apps/api/src/infrastructure/logger/`

**Action:** Create NestJS middleware that injects SEMSELogger
```typescript
@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  constructor() {}
  use(req, res, next) {
    const logger = new SEMSELogger("semse-api", 
      trace_id=req.headers['x-trace-id']);
    req.logger = logger;
    next();
  }
}
```

**Impact:** Every API request has structured logging context

---

## Phase 3: Worker Service

**Location:** `apps/worker/` 

**Action:** Wire logger to BullMQ processors
```typescript
processor.process(async (job) => {
  const logger = new SEMSELogger("semse-worker",
    run_id=job.id);
  with logger.span("process_job"):
    logger.info("Job started", {jobId: job.id});
    // ... do work
    logger.info("Job complete");
});
```

**Impact:** Worker jobs have distributed tracing

---

## Phase 4: Distributed Trace Propagation

**Context:** HTTP requests flow API → Worker → Autonomy

**Action:** Extract/inject traceId from headers
```javascript
// Request comes in
const traceId = req.headers['x-trace-id'] || uuid();

// Create logger with propagated traceId
const logger = new SEMSELogger(serviceName, trace_id=traceId);

// When making downstream calls
const response = await fetch(nextService, {
  headers: { 'x-trace-id': traceId }
});
```

**Impact:** Full distributed trace from entry to exit

---

## Quick Wins (Can do in 1-2 hours total)

1. **Autonomy server logging** — 10 min
2. **API middleware** — 15 min  
3. **Worker processors** — 15 min
4. **Trace header propagation** — 10 min
5. **Test & verify** — 10 min

**Total:** ~60 min for full logging integration

---

## Testing

```bash
# 1. Start local services
pnpm dev:api
pnpm dev:worker  
pnpm start:autonomy

# 2. Make request and check logs
curl http://localhost:4000/api/test

# 3. Verify
# - Logs are JSON
# - Have traceId
# - Show trace through services
```

---

## Next: Metrics Layer (Optional)

After logging is integrated, can add:
- Span duration auto-tracking
- Error rate monitoring
- Throughput metrics
- P95/P99 latencies

---

**Status:** Ready to execute  
**Blockers:** None (logging utility is complete and tested)  
**Estimated timeline:** 1-2 hours full integration
