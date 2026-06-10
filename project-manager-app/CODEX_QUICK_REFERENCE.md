# Codex Quick Reference — SEMSE Session 2026-06-05
## Fast Lookup for Immediate Work

---

## ⚡ Essential Commands

```bash
# Validate before any commit
pnpm typecheck && pnpm test:unit && pnpm build && git diff --check

# Create a commit (after staging)
git add <files>
git commit -m "$(cat <<'EOF'
feat(module-name): concise description

Detailed explanation:
- What was added
- Why it was added
- Integration points

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>
EOF
)"

# Push and create PR
git push -u origin <branch-name>
gh pr create --title "feat(module): description" --body "$(cat <<'EOF'
## Summary
- Bullet points of changes

## Test plan
- How to test this

🤖 Generated with Claude Code
EOF
)"

# Run only what you changed
pnpm test:unit --testPathPattern="payment-governance" # Only FASE 2.1 tests
pnpm typecheck # All TypeScript

# Check git state
git status
git log --oneline -5
git diff # Staged changes
```

---

## 🏗️ Module Template (Copy This Exactly)

Use for FASE 3+ modules:

### 1. Create folders
```bash
mkdir -p apps/api/src/modules/new-module
```

### 2. repository.ts
```typescript
import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";

@Injectable()
export class NewModuleRepository {
  private readonly logger = new Logger(NewModuleRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  async getData(id: string) {
    return this.prisma.model.findUnique({ where: { id } });
  }

  async createData(input: any) {
    return this.prisma.model.create({ data: input });
  }
}
```

### 3. service.ts
```typescript
import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { NewModuleRepository } from "./new-module.repository.js";
import type { SseEventBusService } from "../../infrastructure/sse/sse-event-bus.service.js";

@Injectable()
export class NewModuleService {
  private readonly logger = new Logger(NewModuleService.name);

  constructor(
    private readonly repository: NewModuleRepository,
    private readonly sseBus?: SseEventBusService,
  ) {}

  async doSomething(input: any) {
    try {
      // Validate
      if (!input.required) throw new BadRequestException("Missing required");
      
      // Get entity
      const entity = await this.repository.getData(input.id);
      if (!entity) throw new NotFoundException("Not found");
      
      // Business logic
      const result = await this.repository.createData(input);
      
      // Log and emit
      this.logger.log(`Action completed: ${result.id}`);
      if (this.sseBus) {
        this.sseBus.emit("channel", "event", { data: result });
      }
      
      return result;
    } catch (error) {
      this.logger.error(`Failed: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
}
```

### 4. controller.ts
```typescript
import { Body, Controller, Get, Param, Post, Req } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { NewModuleService } from "./new-module.service.js";
import { ok } from "../../common/api-response.js";
import { resolveRequestContext } from "../../common/request-context.js";
import { resolveRequestId } from "../../common/request-id.js";
import { RequirePermissions } from "../../common/permissions.decorator.js";

function actor(req: FastifyRequest) {
  return resolveRequestContext(req as Parameters<typeof resolveRequestContext>[0]);
}

@Controller("v1/resource")
export class NewModuleController {
  constructor(private readonly service: NewModuleService) {}

  @Post()
  @RequirePermissions("resource:write")
  async create(@Req() req: FastifyRequest, @Body() body: Record<string, unknown>) {
    const rid = resolveRequestId(req.headers ?? {});
    const ctx = actor(req);

    const result = await this.service.doSomething({
      field: String(body.field ?? ""),
      userId: ctx.userId,
      tenantId: ctx.tenantId,
    });

    return ok(rid, result);
  }

  @Get(":id")
  @RequirePermissions("resource:read")
  async get(@Req() req: FastifyRequest, @Param("id") id: string) {
    const rid = resolveRequestId(req.headers ?? {});
    const result = await this.service.getData(id);
    return ok(rid, result);
  }
}
```

### 5. module.ts
```typescript
import { Module } from "@nestjs/common";
import { NewModuleController } from "./new-module.controller.js";
import { NewModuleService } from "./new-module.service.js";
import { NewModuleRepository } from "./new-module.repository.js";
import { SseModule } from "../../infrastructure/sse/sse.module.js";

@Module({
  imports: [SseModule],
  controllers: [NewModuleController],
  providers: [NewModuleService, NewModuleRepository],
  exports: [NewModuleService],
})
export class NewModuleModule {}
```

### 6. module.service.spec.ts
```typescript
import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import { NewModuleService } from "./new-module.service.js";
import { NewModuleRepository } from "./new-module.repository.js";

describe("NewModuleService", () => {
  let service: NewModuleService;
  let repository: jest.Mocked<NewModuleRepository>;

  const mockRepository = {
    getData: jest.fn(),
    createData: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NewModuleService,
        { provide: NewModuleRepository, useValue: mockRepository },
      ],
    }).compile();

    service = module.get<NewModuleService>(NewModuleService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("doSomething", () => {
    it("should create data successfully", async () => {
      mockRepository.createData.mockResolvedValue({ id: "123" } as any);

      const result = await service.doSomething({ /* input */ });

      expect(result.id).toBe("123");
    });

    it("should throw when not found", async () => {
      mockRepository.getData.mockResolvedValue(null);

      await expect(service.doSomething({ id: "invalid" })).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
```

### 7. Register in AppModule
```typescript
// At top
import { NewModuleModule } from "./modules/new-module/new-module.module.js";

// In @Module imports
[
  // ... other modules
  NewModuleModule,  // Add here
]
```

---

## 🔐 Security Checklist (ALWAYS DO THIS)

Before **every** commit:

```bash
# 1. No secrets in code
git diff | grep -iE "sk-ant|sk-proj|password|token|secret|api.key"
# Should be EMPTY

# 2. All .env files excluded
git check-ignore -v apps/api/.env apps/web/.env.local apps/worker/.env
# Should ALL output .gitignore:7 or similar

# 3. Types check
pnpm typecheck
# Should complete with no errors

# 4. Tests pass
pnpm test:unit
# Should output: 446/446 (or higher)

# 5. No trailing whitespace
git diff --check
# Should be EMPTY

# 6. Build succeeds
pnpm build
# Should output dist/ folder
```

---

## 🧪 Test Pattern (Copy This)

```typescript
describe("MyService", () => {
  let service: MyService;
  let mockRepository = {
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MyService,
        { provide: MyRepository, useValue: mockRepository },
      ],
    }).compile();

    service = module.get<MyService>(MyService);
  });

  afterEach(() => {
    jest.clearAllMocks(); // IMPORTANT: Reset mocks between tests
  });

  describe("myMethod", () => {
    it("should do X when condition Y", async () => {
      // Arrange
      mockRepository.findById.mockResolvedValue({ id: "123" } as any);

      // Act
      const result = await service.myMethod("123");

      // Assert
      expect(result.id).toBe("123");
      expect(mockRepository.findById).toHaveBeenCalledWith("123");
    });

    it("should throw error when not found", async () => {
      // Arrange
      mockRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(service.myMethod("invalid")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("should handle edge case", async () => {
      // Test boundary conditions, empty inputs, null values, etc.
    });
  });
});
```

---

## 🎯 Common Tasks

### Add a new endpoint to existing module

1. Add method to service:
```typescript
async newEndpoint(input: any) {
  // Logic here
  return result;
}
```

2. Add endpoint to controller:
```typescript
@Post("new-endpoint")
@RequirePermissions("resource:write")
async new(@Req() req, @Body() body: Record<string, unknown>) {
  const rid = resolveRequestId(req.headers ?? {});
  const ctx = actor(req);
  const result = await this.service.newEndpoint({ /* ... */ });
  return ok(rid, result);
}
```

3. Add test to service.spec.ts:
```typescript
it("should handle newEndpoint", async () => {
  mockRepository.someMethod.mockResolvedValue({ /* ... */ } as any);
  const result = await service.newEndpoint({ /* ... */ });
  expect(result).toBeDefined();
});
```

### Debug a failing test

```bash
# Run just that test file
pnpm test:unit --testPathPattern="payment-governance"

# Run just that describe block
pnpm test:unit --testNamePattern="PaymentGovernanceService releasePayment"

# See full output
pnpm test:unit --verbose

# Watch mode
pnpm test:unit --watch
```

### Check what changed in a module

```bash
git diff HEAD~1 apps/api/src/modules/payment-governance/
git show HEAD:apps/api/src/modules/payment-governance/payment-governance.service.ts
```

### Revert a change safely

```bash
# See what would change
git diff apps/api/src/modules/payment-governance/payment-governance.service.ts

# Revert just that file to HEAD
git checkout apps/api/src/modules/payment-governance/payment-governance.service.ts

# Or revert entire last commit (creates new commit)
git revert HEAD
```

---

## 🔗 Key Files to Know

| File | Purpose | When to Edit |
|------|---------|--------------|
| `apps/api/src/app.module.ts` | Module registration | Adding new modules |
| `apps/api/tsconfig.json` | TypeScript config | If adding new source paths |
| `packages/db/prisma/schema.prisma` | Database models | If new DB tables needed |
| `infra/railway/RAILWAY_ENV_VARS.md` | Environment docs | If adding new env vars |
| `.gitignore` | Git exclusions | If new file types to exclude |
| `pnpm-workspace.yaml` | Monorepo config | Rarely needed |

---

## 📊 Tests to Run Before PR

```bash
# 1. All tests must pass
pnpm test:unit
# Expect: 446/446 (or higher)

# 2. TypeScript strict mode
pnpm typecheck
# Expect: No errors

# 3. Linting (if available)
pnpm lint
# Expect: 0 errors

# 4. Build
pnpm build
# Expect: Success (dist/ folder created)

# 5. Security check
git diff | grep -iE "sk-ant|password|token"
# Expect: Empty output

# Example full validation:
pnpm typecheck && pnpm test:unit && pnpm build && echo "✅ All validations passed"
```

---

## 🚨 If Something Breaks

### Tests fail
```bash
# Check if it's your code or environment
pnpm test:unit --testPathPattern="<your-module>"

# See detailed output
pnpm test:unit --verbose

# Reset node_modules if needed
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### TypeScript errors
```bash
# Check your file specifically
pnpm typecheck 2>&1 | grep "your-file.ts"

# Clear cache
rm -rf apps/api/dist apps/web/.next

# Re-run
pnpm typecheck
```

### Git is confused
```bash
# See what's staged
git status

# Unstage everything
git reset

# See what changed
git diff --name-only

# Revert file to HEAD
git checkout apps/api/src/modules/my-module/my-file.ts

# Hard reset to last commit (⚠️ DANGEROUS)
git reset --hard HEAD
```

### Module not registering
```bash
# Check it's in app.module.ts
grep "MyModule" apps/api/src/app.module.ts
# Should appear 2x: import line + in imports array

# Check syntax
pnpm typecheck
# Should show any syntax errors

# Check export in module.ts
# Should have: @Module({ ... }) export class MyModule {}
```

---

## 🎓 What Codex Inherits

**Current Status:**
- ✅ FASE 1 complete (4 commits)
- ✅ FASE 2 complete (3 modules: payment-governance, evidence-gateway, worker-verification)
- ✅ 446/446 tests passing
- ✅ 0 TypeScript errors
- ✅ 0 security violations

**For FASE 3:**
- Create CI/CD workflows (already exist on main — verify with `git show origin/main:.github/workflows/`)
- Add pre-commit hooks
- Set up Railway monitoring
- Implement branch protection rules

**For FASE 4:**
- Write API documentation
- Create deployment guides
- Document architecture decisions

---

**Branch:** `fix/api-coverage-split-integration-db-tests`  
**Status:** Ready for PR to main  
**Next Owner:** Codex (autonomous)

Good luck! 🚀
