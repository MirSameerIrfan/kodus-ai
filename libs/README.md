# libs/ — Business Features

This folder contains all business domain features. Each feature is self-contained and follows hexagonal architecture.

## Structure

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

## Feature Internal Structure

Each feature follows hexagonal architecture:

```
libs/[feature]/
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
│   └── http/dtos/
├── ee/                     # Enterprise Edition features
├── modules/                # NestJS module definitions
└── [feature].module.ts     # Main feature module
```

## Rules

- ✅ Self-contained business logic
- ✅ Hexagonal architecture (domain → application → infrastructure)
- ✅ EE code co-located in `ee/` subfolder
- ✅ Export only public API through main module
- ❌ NO circular dependencies between features
- ❌ NO imports from `@/` (legacy src/)

## Creating a New Feature

1. Create folder: `libs/[feature-name]/`
2. Create structure: `domain/`, `application/`, `infrastructure/`
3. Create main module: `[feature-name].module.ts`
4. Export via path alias: `@libs/[feature-name]`

## See Also

- [Architecture Guide](../docs/ARCHITECTURE.md)
