import { IssuesModule } from '@libs/issues/issues.module';
import { KodyRulesModule } from '@libs/kody-rules/kody-rules.module';
import { DynamicModule, Module, Provider, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PullRequestsModule } from '@libs/code-review/modules/pull-requests.module';
import { MCPManagerService } from './services/mcp-manager.service';
import { McpController } from './controllers/mcp.controller';
import { McpServerService } from './services/mcp-server.service';
import { McpEnabledGuard } from './guards/mcp-enabled.guard';
import { CodeManagementTools, KodyIssuesTools, KodyRulesTools } from './tools';

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
