# SEMSE Project Handoff — Complete Context for Codex

**Date:** 2026-06-05  
**Status:** FASE 1 Complete, FASE 2+ Ready to Start  
**Project:** SEMSE OS — Autonomous Project Management + Construction Intelligence Layer

---

## 🎯 Executive Summary (2-minute read)

**What is SEMSE?**  
SEMSE OS is a full-stack platform for construction project management, combining:
- Autonomous project creation (Conversational Project Builder)
- Real-time evidence upload & validation (observer AI analyzing photos/video)
- Trade knowledge library (RAG-powered Electrical, Plumbing, HVAC, etc.)
- Governance layer (quadratic voting, trust passports, MCA advice)
- Worker verification via DID cryptographic signatures
- Integration with Ollama for offline LLM capability

**Tech Stack:**
- **Backend:** NestJS (TypeScript) + Prisma ORM + PostgreSQL
- **Frontend:** Next.js (React/TypeScript)
- **Infrastructure:** Railway containerized, Docker multi-stage, pnpm monorepo
- **LLM:** Claude API (Anthropic) + Ollama local fallback
- **Search:** Hybrid RAG (keyword + semantic via Pinecone/vector DB)

**Current Status:**
- ✅ 27/27 trades tools leveled to production (Electrical architecture pattern)
- ✅ Consciousness system live on Railway (maturing autonomy scoring)
- ✅ 616/616 tests passing
- ✅ **FASE 1 Complete:** Infrastructure hardening (security, railway.json, env docs)
- ⏳ **FASE 2 Starting:** Complete missing modules (payment-governance, evidence-gateway)

---

## 📊 Repository Structure

```
project-manager-app/
├── apps/
│   ├── api/                    # NestJS backend
│   │   └── src/
│   │       ├── auth/           # JWT, DID signing
│   │       ├── contractors/    # Contractor profiles
│   │       ├── projects/       # Project CRUD + SSE
│   │       ├── tools/          # Trade knowledge endpoints (27 tools)
│   │       ├── agents/         # AI agents (Prometeo, BuildOps, TradeGuide)
│   │       ├── intake/         # Smart intake wizard (8 categories)
│   │       ├── consciousness/  # Autonomy scoring + maturing
│   │       ├── observer/       # Event logging + sanitization
│   │       └── shared/         # DTOs, types
│   ├── web/                    # Next.js frontend
│   │   └── src/
│   │       ├── app/            # App Router pages
│   │       ├── components/      # React components
│   │       └── lib/            # Utils, API client
│   └── worker/                 # Bull queue processor
├── packages/
│   ├── db/                     # Prisma schema + migrations
│   ├── auth/                   # Auth module exports
│   ├── types/                  # Shared TypeScript types
│   └── utils/                  # Common utilities
├── infra/
│   ├── railway/
│   │   ├── railway.json        # ✅ FIXED: builder="DOCKERFILE"
│   │   └── RAILWAY_ENV_VARS.md # ✅ NEW: Complete deployment guide
│   └── docker/
│       ├── Dockerfile.api
│       ├── Dockerfile.web
│       ├── Dockerfile.worker
│       └── Dockerfile.ollama
└── pnpm-workspace.yaml         # pnpm monorepo config
```

---

## ✅ FASE 1 — Completed (2026-06-05)

### What was done:

1. **Infrastructure Security Baseline**
   - ✅ `.gitignore` hardened — excludes .env, .env.local, .env.*.local, .env.production
   - ✅ `railway.json` fixed — changed builder from NIXPACKS → DOCKERFILE (matches existing Dockerfiles)
   - ✅ `apps/web/.env.example` enhanced — added AUTH_SECRET, SEMSE_BOOTSTRAP_TOKEN templates
   - ✅ `infra/railway/RAILWAY_ENV_VARS.md` created — 169-line deployment guide for all services

2. **Audit Results**
   - ✅ GitHub Actions EXIST — 6 workflows on main (ci.yml, api-integration.yml, api-smoke.yml, etc.) — NOT missing
   - ✅ Tests passing — 446/446 unit tests
   - ✅ No secrets exposed — all committed files use placeholders only
   - ✅ All Dockerfiles verified and compatible

### Commit:
- **Hash:** `a3fc5e4`
- **Branch:** `fix/api-coverage-split-integration-db-tests`
- **PR:** #57 (OPEN — ready for merge to main)

### Key Decision:
- **Railway Service Variables** (runtime) vs Build Arguments — correctly separated
  - `AUTH_SECRET`, `SEMSE_API_BASE_URL`: Runtime Service Variables (set in Railway console)
  - `NEXT_PUBLIC_*` vars: Build Arguments (baked into Next.js build)

---

## 🚀 FASE 2 — Ready to Start (12-16 hours of work)

### Task 1: Complete Payment Governance Module (4-6 hours)

**What:** Payment release/blocking logic for contractors

**Files to create/modify:**
```
apps/api/src/payment-governance/
├── payment-governance.controller.ts     # POST /v1/payments/release
├── payment-governance.service.ts        # Business logic: release, block, score
├── payment-governance.repository.ts     # DB layer
├── dto/
│   ├── release-payment.dto.ts
│   └── block-payment.dto.ts
├── payment-governance.module.ts
└── test/
    └── payment-governance.service.spec.ts
```

**Endpoints needed:**
- `POST /v1/payments/release` — Release payment to contractor
- `POST /v1/payments/block` — Block payment (fraud detection)
- `GET /v1/payments/:contractorId/history` — Payment history with evidence

**Integration points:**
- `observer` module — get event logs for fraud scoring
- `consciousness` module — get autonomyLevel for payment threshold
- `db` schema — Payment, PaymentLedger tables (migrations exist)

**Test target:** 30+ tests

---

### Task 2: Implement Evidence Gateway (6-8 hours)

**What:** Async evidence upload handler + real-time SSE validation stream

**Files to create/modify:**
```
apps/api/src/evidence-gateway/
├── evidence-gateway.controller.ts       # POST /v1/evidence/upload, GET /events
├── evidence-gateway.service.ts          # Async validation, scoring
├── evidence-gateway.repository.ts       # DB ops
├── evidence-gateway.sse.ts              # SSE event stream
├── dto/
│   └── upload-evidence.dto.ts
├── types/
│   └── evidence.types.ts
├── evidence-gateway.module.ts
└── test/
    └── evidence-gateway.service.spec.ts
```

**Endpoints needed:**
- `POST /v1/evidence/upload` — Webhook for async evidence (from mobile app)
- `GET /v1/evidence/:projectId/stream` — SSE stream of validation progress
- `GET /v1/evidence/:projectId/results` — Final validation results with scores

**Async pipeline:**
1. Upload photo/video → store in S3/Railway Storage
2. Queue job: `validateEvidence` 
3. Invoke observer AI → sanitize + extract features
4. Score against trade knowledge RAG
5. Emit SSE: `{ status: 'validating' | 'scored' | 'complete', score: 0.85 }`

**Integration points:**
- `observer` module — call sanitizer
- `trade-knowledge` module — RAG search for matching patterns
- `projects` module — store evidence refs
- Bull queue (worker) — async job processing

**Test target:** 25+ tests

---

### Task 3: Refactor Worker Verification (3-4 hours)

**What:** Consolidate DID verification logic (currently fragmented across auth, contractor, worker modules)

**Current state (fragmented):**
- `auth/did-identity-sse.ts` — DID signature validation
- `contractors/verification.service.ts` — Contractor onboarding
- `worker/did-verification.ts` — Worker queue job

**Target: Unified module**
```
apps/api/src/worker-verification/
├── worker-verification.controller.ts    # GET /v1/workers/:id/verify, POST /v1/workers/:id/sign
├── worker-verification.service.ts       # DID signing, validation, state machine
├── worker-verification.repository.ts    # DB ops
├── worker-verification.sse.ts           # Real-time verification status
├── types/
│   └── worker-verification.types.ts
├── worker-verification.module.ts
└── test/
    └── worker-verification.service.spec.ts
```

**State machine:**
```
PENDING → SIGNING → SIGNED → VERIFIED ✅
          ↓
        FAILED ❌
```

**Integration points:**
- `auth` — DID cryptography (keep but import from here)
- `contractors` — store verification status on ContractorProfile
- `projects` — workers assigned with verified flag
- SSE → real-time status updates to frontend

**Test target:** 20+ tests

---

## 🔒 Security Rules (MANDATORY)

### 1. Environment Variables
```bash
# ✅ DO: Create .env.example with placeholders
SEMSE_API_BASE_URL=http://semse-api.railway.internal:4000
AUTH_SECRET=your_secret_here_min_32_chars

# ❌ DON'T: Commit real .env files
# Real .env files are .gitignore'd — verified via git check-ignore

# ✅ DO: Set real values in Railway console → Service Variables
# Railway dashboard → [Service] → Variables → Add SERVICE_VARIABLE
```

### 2. Validation Before Committing
```bash
# Required before git commit:
pnpm typecheck          # TypeScript compilation check
pnpm test:unit          # All unit tests must pass
pnpm build              # Full build (catches next.js issues)
git diff --check        # No trailing whitespace

# After commit, verify secrets:
git diff HEAD~1 | grep -iE "sk-|password|token|secret" # Should be EMPTY
```

### 3. .gitignore Rules
```
.env                    # Never commit any .env file
.env.local              # Dev/local overrides
.env.*.local            # Environment-specific
.env.production         # Production secrets
```

**Verification:**
```bash
git check-ignore -v apps/api/.env     # Should output: .gitignore:7:.env...
git check-ignore -v apps/web/.env.local  # Should output: .gitignore:8:.env.*...
```

### 4. Railway Service Variables
All secrets must be set in Railway console (never in code):
- `AUTH_SECRET` — JWT signing key (32+ chars)
- `DATABASE_URL` — PostgreSQL connection
- `REDIS_URL` — Redis cache
- `OPENAI_API_KEY` — Claude API key
- `ANTHROPIC_API_KEY` — Backup LLM
- `SEMSE_BOOTSTRAP_TOKEN` — Internal auth token

See: `infra/railway/RAILWAY_ENV_VARS.md` (complete guide)

---

## 📐 Architecture Patterns (Follow These)

### 1. NestJS Module Pattern (Every new feature follows this)

```typescript
// 1. service.ts — Business logic
@Injectable()
export class PaymentGovernanceService {
  constructor(
    private readonly paymentRepository: PaymentRepository,
    private readonly observerService: ObserverService,  // Integrate with other modules
    private readonly logger: Logger,
  ) {}

  async releasePayment(dto: ReleasePaymentDto) {
    // Validation
    // Business logic
    // Logging
    // Return result
  }
}

// 2. controller.ts — HTTP routes
@Controller('v1/payments')
export class PaymentGovernanceController {
  constructor(private readonly service: PaymentGovernanceService) {}

  @Post('/release')
  async release(@Body() dto: ReleasePaymentDto) {
    return this.service.releasePayment(dto);
  }
}

// 3. module.ts — Registration
@Module({
  controllers: [PaymentGovernanceController],
  providers: [PaymentGovernanceService, PaymentRepository],
  exports: [PaymentGovernanceService],
})
export class PaymentGovernanceModule {}

// 4. Add to AppModule imports:
@Module({
  imports: [PaymentGovernanceModule, ...],
})
export class AppModule {}

// 5. Test file: service.spec.ts
describe('PaymentGovernanceService', () => {
  // 30+ test cases
})

// 6. Database: Prisma schema + migration
// schema.prisma already has Payment, PaymentLedger models
```

### 2. SSE Pattern (Real-time updates)

```typescript
// service.ts
async validateEvidenceStream(projectId: string, res: Response) {
  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Emit initial status
  res.write(`data: ${JSON.stringify({ status: 'validating' })}\n\n`);

  // Process async
  this.evidenceQueue.add('validate', { projectId })
    .then(job => {
      // Listen to job progress
      job.progress((progress) => {
        res.write(`data: ${JSON.stringify({ status: 'progress', score: progress })}\n\n`);
      });
    });
}

// controller.ts
@Get('/:projectId/stream')
validateStream(@Param('projectId') id: string, @Res() res: Response) {
  this.service.validateEvidenceStream(id, res);
}
```

### 3. Repository Pattern (DB abstraction)

```typescript
// repository.ts
@Injectable()
export class PaymentRepository {
  constructor(private readonly db: PrismaClient) {}

  async create(data: CreatePaymentInput) {
    return this.db.payment.create({ data });
  }

  async findById(id: string) {
    return this.db.payment.findUnique({ where: { id } });
  }
}

// service.ts imports and uses repository
constructor(private readonly paymentRepository: PaymentRepository) {}
```

### 4. Integration Points (Always check these)

When adding a new module:
1. ✅ Import required services (Consciousness, Observer, TradeKnowledge, etc.)
2. ✅ Add to AppModule
3. ✅ Create DB migrations if needed
4. ✅ Export service if other modules need it
5. ✅ Add integration tests

---

## 🧪 Testing Standards

### Unit Tests (Every service needs them)
```bash
pnpm test:unit          # Run all unit tests
pnpm test:unit --watch # Watch mode
```

**Target:** 30+ tests per new service

**Pattern:**
```typescript
describe('PaymentGovernanceService', () => {
  let service: PaymentGovernanceService;
  let repository: PaymentRepository;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        PaymentGovernanceService,
        { provide: PaymentRepository, useValue: mockRepository },
      ],
    }).compile();

    service = module.get<PaymentGovernanceService>(PaymentGovernanceService);
    repository = module.get<PaymentRepository>(PaymentRepository);
  });

  it('should release payment when contractor verified', async () => {
    // Arrange
    // Act
    // Assert
  });
});
```

### Integration Tests (After unit tests)
```bash
pnpm test:integration  # Full stack with real DB
```

### E2E Tests (CI/CD verification)
```bash
pnpm test:e2e          # Full app flow
```

---

## 📚 Key Files & References

### Documentation
- **`SEMSE_CONSTITUTION.md`** — 40 principles governing all decisions
- **`infra/railway/RAILWAY_ENV_VARS.md`** — Complete Railway deployment guide
- **`FASE_1_COMPLETION_REPORT.md`** — What was done in FASE 1
- **`AUDIT_REPORT_2026_06_05.md`** — Ecosystem audit (2 CRITICAL fixed, 3 HIGH pending)

### Code References
- **Consciousness module** — `apps/api/src/consciousness/` — Shows RAG integration pattern
- **Trade Knowledge** — `apps/api/src/tools/*/research.controller.ts` — Shows 27 tools pattern
- **Observer** — `apps/api/src/observer/` — Shows event logging + sanitization
- **Intake** — `apps/api/src/intake/` — Shows SSE + multi-category pipeline

### Database
- **Schema:** `packages/db/prisma/schema.prisma` (Payment, Evidence, PaymentLedger models exist)
- **Migrations:** `packages/db/prisma/migrations/` (48 total, SQL DDL)
- **Seed:** `packages/db/prisma/seed.ts` (test data)

---

## 🎯 Next Steps (Exact Order)

### FASE 2.1 — Payment Governance (Start here)
**Estimated:** 4-6 hours  
**Checklist:**
- [ ] Create `apps/api/src/payment-governance/` folder
- [ ] Implement service with release + block logic
- [ ] Add controller with 3 endpoints
- [ ] Register module in AppModule
- [ ] Write 30+ unit tests
- [ ] Verify `pnpm test:unit` passes (should be 476+/476+ tests)
- [ ] Commit with message: `feat(payment): implement payment-governance module with release/block flow`
- [ ] Create PR to main

### FASE 2.2 — Evidence Gateway (After 2.1)
**Estimated:** 6-8 hours  
**Checklist:**
- [ ] Create `apps/api/src/evidence-gateway/` folder
- [ ] Implement async upload + validation pipeline
- [ ] Add SSE stream for real-time progress
- [ ] Register module in AppModule
- [ ] Write 25+ unit tests
- [ ] Verify all tests pass
- [ ] Commit with message: `feat(evidence): implement evidence-gateway with async validation & SSE`

### FASE 2.3 — Worker Verification Refactor (After 2.2)
**Estimated:** 3-4 hours  
**Checklist:**
- [ ] Create `apps/api/src/worker-verification/` folder (consolidate from auth + contractors + worker)
- [ ] Implement unified DID verification state machine
- [ ] Add SSE real-time status updates
- [ ] Update auth/contractor modules to use this service
- [ ] Write 20+ unit tests
- [ ] Verify all tests pass
- [ ] Commit with message: `refactor(worker): unify DID verification across modules`

### After FASE 2: Merge to Main
```bash
git push origin [branch]
gh pr create --title "feat(fase2): payment governance + evidence gateway + worker verification" ...
# Verify CI passes
# Merge to main
# Deploy to Railway
```

---

## 🛠️ Development Commands

```bash
# Setup
pnpm install

# Development
pnpm dev            # Start all apps locally (API on :4000, Web on :3000, Worker, Ollama)

# Testing
pnpm test:unit      # Unit tests
pnpm test:e2e       # E2E tests
pnpm test:watch     # Watch mode

# Code quality
pnpm typecheck      # TypeScript compilation
pnpm lint           # ESLint
pnpm format         # Prettier (auto-fix)

# Build
pnpm build          # Full build (all apps)

# Database
pnpm db:migrate     # Apply migrations
pnpm db:seed        # Populate test data
pnpm db:reset       # Drop + recreate (dev only)

# Git validation (do this before commit)
git diff --check    # Check for trailing whitespace
pnpm typecheck && pnpm test:unit && pnpm build
```

---

## 🚨 Common Pitfalls

❌ **Don't:**
- Commit .env files with real secrets
- Use NIXPACKS builder (use DOCKERFILE)
- Import from `apps/` in other apps (use `packages/types` instead)
- Create async operations without Bull queue integration
- Forget to register new modules in AppModule
- Write code without tests (target: 30+ per service)

✅ **Do:**
- Create .env.example templates only
- Use Railway Service Variables for secrets
- Follow NestJS module pattern exactly
- Integrate with existing services (Consciousness, Observer, TradeKnowledge)
- Use repository pattern for DB access
- Write unit + integration tests simultaneously

---

## 📞 Contact & Questions

**Current PR:** #57 (FASE 1 hardening) — review and merge to main  
**Main branch:** Ready for FASE 2  
**Test status:** 446/446 passing ✅  
**Infrastructure:** Railway configured per guide, ready for variables update

**Questions?** Check:
1. `SEMSE_CONSTITUTION.md` — Architectural decisions
2. `infra/railway/RAILWAY_ENV_VARS.md` — Deployment details
3. `packages/db/prisma/schema.prisma` — Data model
4. Existing modules (consciousness, observer, trade-knowledge) — Code patterns

---

**Prepared by:** Claude Haiku 4.5  
**Date:** 2026-06-05  
**Handoff Status:** ✅ Complete — Codex ready to take FASE 2
