# core/ — Technical Fundamentals

This folder contains framework-level infrastructure shared across all features.

## Structure

```
core/
├── cache/              # Caching strategies
├── config/             # Configuration loaders
│   ├── axios/          # HTTP client configs
│   ├── log/            # Logging configs
│   └── loaders/        # Environment loaders
├── database/           # Database connections and migrations
│   ├── typeorm/
│   └── mongoose/
├── decorators/         # Custom NestJS decorators
├── errors/             # Global error handlers
├── filters/            # Exception filters
├── guards/             # Auth guards
└── interceptors/       # Request/response interceptors
```

## Rules

- ✅ Framework-level code only
- ✅ Shared across all features
- ❌ NO business logic
- ❌ NO feature-specific code

## Import

```typescript
import { DatabaseModule } from '@core/database/database.module';
import { CacheService } from '@core/cache/cache.service';
```

## See Also

- [Architecture Guide](../docs/ARCHITECTURE.md)

