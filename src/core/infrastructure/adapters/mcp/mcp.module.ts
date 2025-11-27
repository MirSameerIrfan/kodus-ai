import { PermissionValidationModule } from '@/ee/shared/permission-validation.module';
import { IssuesModule } from '@/modules/issues.module';
import { KodyRulesModule } from '@/modules/kodyRules.module';
import { PullRequestsModule } from '@/modules/pullRequests.module';
import { DynamicModule, Module, Provider, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PlatformIntegrationModule } from '../../../../modules/platformIntegration.module';
import { McpController } from './controllers/mcp.controller';
import { McpEnabledGuard } from './guards/mcp-enabled.guard';
import { MCPManagerService } from './services/mcp-manager.service';
import { McpServerService } from './services/mcp-server.service';
import { CodeManagementTools, KodyRulesTools } from './tools';
import { KodyIssuesTools } from './tools/kodyIssues.tools';

@Module({})
export class McpModule {
    static forRoot(configService?: ConfigService): DynamicModule {
        const imports = [];
        const providers: Provider[] = [];
        const controllers = [];
        const exports = [];

        // Always provide MCPManagerService, controllers and full functionality are conditional
        const isEnabled =
            process.env.API_MCP_SERVER_ENABLED === 'true' ||
            configService?.get<boolean>('API_MCP_SERVER_ENABLED', false);

        // Always provide MCPManagerService for dependency injection
        providers.push(MCPManagerService);
        exports.push(MCPManagerService);

        // Always import required modules for MCPManagerService dependencies
        imports.push(
            JwtModule,
            forwardRef(() => PermissionValidationModule),
        );

        if (isEnabled) {
            imports.push(
                forwardRef(() => PlatformIntegrationModule),
                forwardRef(() => KodyRulesModule),
                forwardRef(() => IssuesModule),
                forwardRef(() => PullRequestsModule),
            );

            controllers.push(McpController);

            providers.push(
                McpServerService,
                McpEnabledGuard,
                CodeManagementTools,
                KodyRulesTools,
                KodyIssuesTools,
            );

            exports.push(McpServerService);
        }

        return {
            module: McpModule,
            imports,
            controllers,
            providers,
            exports,
            global: true,
        };
    }
}
