# shared/ — Cross-Cutting Utilities

This folder contains pure utilities and types used across features.

## Structure

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

## Rules

- ✅ Pure functions and types
- ✅ No NestJS dependencies (when possible)
- ❌ NO business logic
- ❌ NO feature-specific code

## Import

```typescript
import { PinoService } from '@shared/logging/pino.service';
import { PlatformType } from '@shared/enums/platform-type.enum';
import { OrganizationAndTeamData } from '@shared/types/general/organizationAndTeamData';
```

## See Also

- [Architecture Guide](../docs/ARCHITECTURE.md)
