# Kodus Architecture Guide

## Overview

Kodus uses a **feature-based monorepo architecture** with hexagonal architecture applied per feature. This design enables:

- Independent deployment of API, Worker, and Webhooks
- Clear separation of concerns
- Isolated testing per feature
- Fast onboarding for new developers
- Enterprise Edition (EE) code co-located with features

## Directory Structure

```
kodus-ai/
├── apps/           # Entry points (thin layers)
├── libs/           # Features (business domains)
├── core/           # Technical fundamentals
├── shared/         # Cross-cutting utilities
├── packages/       # External packages (do not modify)
└── src/            # Legacy backup (will be removed after migration)
```

---

## 📁 apps/ — Entry Points

**Purpose:** Thin layers that only handle HTTP/queue entry and delegate to features.

```
apps/
├── api/            # REST API endpoints
│   └── src/
│       ├── main.ts
│       ├── app.module.ts
│       └── controllers/
├── webhooks/       # Webhook receivers (GitHub, GitLab, etc.)
│   └── src/
│       ├── main.ts
│       └── controllers/
└── worker/         # Background job processors
    └── src/
        ├── main.ts
        └── consumers/
```

### Rules for apps/
- ✅ Receive requests and return responses
- ✅ Import modules from `@libs/*`
- ✅ Minimal business logic (delegate to features)
- ❌ NO domain entities or use cases
- ❌ NO direct database access

---

## 📁 libs/ — Features (Business Domains)

**Purpose:** Self-contained business features with hexagonal architecture.

```
libs/
├── agents/           # AI agents orchestration
├── analytics/        # Usage tracking, logs, metrics
├── automation/       # Automation rules and triggers
├── code-review/      # PR analysis, suggestions, feedback
├── dry-run/          # Test runs without side effects
├── identity/         # Auth, users, permissions
├── integrations/     # External service connections
├── issues/           # Issue tracking
├── kody-rules/       # Custom code review rules
├── mcp-server/       # Model Context Protocol server
├── notifications/    # Alerts and notifications
├── organization/     # Orgs, teams, parameters
├── platform/         # GitHub/GitLab/Azure abstraction
└── workflow-queue/   # Job queue management
```

### Internal Structure (per feature)

Each feature follows hexagonal architecture:

```
libs/code-review/
├── domain/                 # Core business logic (no dependencies)
│   ├── entities/
│   ├── interfaces/
│   ├── contracts/          # Ports (abstractions)
│   └── enums/
├── application/            # Use cases (orchestration)
│   └── use-cases/
├── infrastructure/         # Adapters (implementations)
│   ├── repositories/
│   ├── services/
│   └── http/
│       └── dtos/
├── ee/                     # Enterprise Edition features
│   ├── ast/
│   ├── pipeline/
│   └── fine-tuning/
├── modules/                # NestJS module definitions
└── code-review.module.ts   # Main feature module
```

### Rules for libs/
- ✅ Self-contained business logic
- ✅ Hexagonal architecture (domain → application → infrastructure)
- ✅ EE code co-located in `ee/` subfolder
- ✅ Export only public API through main module
- ❌ NO circular dependencies between features
- ❌ NO imports from `@/` (legacy src/)

---

## 📁 core/ — Technical Fundamentals

**Purpose:** Framework-level infrastructure shared across all features.

```
core/
├── cache/              # Caching strategies
├── config/             # Configuration loaders
│   ├── axios/
│   ├── log/
│   └── loaders/
├── database/           # Database connections and migrations
│   ├── typeorm/
│   └── mongoose/
├── decorators/         # Custom NestJS decorators
├── errors/             # Global error handlers
├── filters/            # Exception filters
├── guards/             # Auth guards
└── interceptors/       # Request/response interceptors
```

### Rules for core/
- ✅ Framework-level code only
- ✅ No business logic
- ❌ NO feature-specific code

---

## 📁 shared/ — Cross-Cutting Utilities

**Purpose:** Pure utilities and types used across features.

```
shared/
├── contracts/          # Shared interfaces
├── domain/
│   ├── enums/
│   └── interfaces/
├── dtos/               # Shared DTOs
├── ee/                 # EE shared utilities
│   ├── configs/
│   └── services/
├── enums/              # Global enums
├── infrastructure/
│   └── repositories/
├── interfaces/         # Global interfaces
├── logging/            # Logging services
├── types/              # Type definitions
│   ├── database/
│   ├── general/
│   └── http/
└── utils/              # Helper functions
```

### Rules for shared/
- ✅ Pure functions and types
- ✅ No NestJS dependencies (when possible)
- ❌ NO business logic
- ❌ NO feature-specific code

---

## Import Aliases

Configure in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "paths": {
      "@libs/*": ["libs/*"],
      "@core/*": ["core/*"],
      "@shared/*": ["shared/*"],
      "@apps/*": ["apps/*/src"]
    }
  }
}
```

### Import Examples

```typescript
// ✅ Correct imports
import { CodeReviewModule } from '@libs/code-review/code-review.module';
import { PinoService } from '@shared/logging/pino.service';
import { DatabaseModule } from '@core/database/database.module';

// ❌ Wrong imports (legacy)
import { Something } from '@/core/...';  // Don't use @/ anymore
import { Something } from '../../../';   // Avoid relative paths
```

---

## Where to Put New Code?

### Decision Tree

```
Is it a new business feature?
├── YES → Create in libs/[feature-name]/
│         └── Follow hexagonal structure
│
└── NO → Is it framework/infrastructure?
         ├── YES → Put in core/
         │
         └── NO → Is it a pure utility/type?
                  ├── YES → Put in shared/
                  │
                  └── NO → Is it an entry point?
                           └── YES → Put in apps/
```

### Quick Reference

| Type of Code | Location | Example |
|--------------|----------|---------|
| New feature | `libs/[feature]/` | `libs/billing/` |
| Use case | `libs/[feature]/application/use-cases/` | `create-invoice.use-case.ts` |
| Entity | `libs/[feature]/domain/entities/` | `invoice.entity.ts` |
| Repository | `libs/[feature]/infrastructure/repositories/` | `invoice.repository.ts` |
| API endpoint | `apps/api/src/controllers/` | `invoice.controller.ts` |
| Background job | `apps/worker/src/consumers/` | `invoice.consumer.ts` |
| Webhook handler | `apps/webhooks/src/controllers/` | `stripe.controller.ts` |
| Database config | `core/database/` | `typeorm.config.ts` |
| Shared enum | `shared/enums/` | `currency.enum.ts` |
| Shared type | `shared/types/` | `pagination.type.ts` |
| EE feature | `libs/[feature]/ee/` | `libs/billing/ee/premium/` |

---

## Enterprise Edition (EE)

EE code lives **inside the feature it extends**:

```
libs/code-review/
├── domain/
├── application/
├── infrastructure/
└── ee/                     # ← EE code here
    ├── ast/                # AST analysis (EE)
    ├── pipeline/           # Advanced pipeline (EE)
    └── fine-tuning/        # ML fine-tuning (EE)
```

### Rules for EE
- ✅ Co-locate with the feature it extends
- ✅ Can import from parent feature's domain/application
- ❌ Core feature should NOT import from EE

---

## Testing

Each feature can be tested in isolation:

```bash
# Test a specific feature
yarn test libs/code-review

# Test all features
yarn test libs/

# Test apps
yarn test apps/
```

---

## Building & Running

```bash
# Development (all apps)
yarn start:dev

# Development (specific app)
yarn start:dev:api
yarn start:dev:webhooks
yarn start:dev:worker

# Production build
yarn build:api
yarn build:webhooks
yarn build:worker

# Docker
yarn docker:start
```

---

## Migration from src/

The `src/` folder is kept as backup during migration. Rules:

1. **DO NOT** modify files in `src/`
2. **DO NOT** import from `@/` in new code
3. After migration is complete and validated in production, `src/` will be removed

---

## Summary

| Folder | Purpose | Imports From |
|--------|---------|--------------|
| `apps/` | Entry points | `@libs/*`, `@core/*`, `@shared/*` |
| `libs/` | Business features | `@libs/*`, `@core/*`, `@shared/*` |
| `core/` | Framework infrastructure | `@shared/*` |
| `shared/` | Pure utilities | Nothing (or external packages) |

**Golden Rule:** Features in `libs/` should be as independent as possible. If you need to import from another feature, consider if that code should be in `shared/` instead.

