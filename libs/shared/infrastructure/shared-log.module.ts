import { Global, Module } from '@nestjs/common';

// Currently, logging is handled by ObservabilityService and @kodus/flow.
// This module is a placeholder for future logging-specific configuration if needed.

@Global()
@Module({})
export class SharedLogModule {}
