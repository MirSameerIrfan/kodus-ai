import { DynamicModule, Module, Provider, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { McpController } from './controllers/mcp.controller';
import { McpEnabledGuard } from './guards/mcp-enabled.guard';
import { MCPManagerService } from './services/mcp-manager.service';
import { McpServerService } from './services/mcp-server.service';
import { CodeManagementTools, KodyRulesTools } from './tools';
import { KodyIssuesTools } from './tools/kodyIssues.tools';
import { PermissionValidationModule } from '@libs/ee/shared/permission-validation.module';
import { KodyRulesModule } from '@libs/kodyRules/modules/kodyRules.module';
import { PlatformModule } from '@libs/platform/modules/platform.module';
import { IssuesModule } from '@libs/issues/issues.module';
import { PullRequestsModule } from '@libs/code-review/modules/pull-requests.module';
import { MCPToolMetadataService } from './services/mcp-tool-metadata.service';
import { IntegrationModule } from '@libs/integrations/modules/integrations.module';

@Module({})
export class McpModule {
    static forRoot(configService?: ConfigService): DynamicModule {
        const imports = [];
        const providers: Provider[] = [];
        const controllers = [];
        const exports: Provider[] = [];

        // Always provide MCPManagerService and MCPToolMetadataService for dependency injection
        providers.push(MCPManagerService, MCPToolMetadataService);
        exports.push(MCPManagerService, MCPToolMetadataService);

        // Always import required modules for MCPManagerService dependencies
        imports.push(
            JwtModule,
            forwardRef(() => PermissionValidationModule),
            forwardRef(() => IntegrationModule),
        );

        const isEnabled =
            process.env.API_MCP_SERVER_ENABLED === 'true' ||
            configService?.get<boolean>('API_MCP_SERVER_ENABLED', false);

        if (isEnabled) {
            imports.push(
                forwardRef(() => PlatformModule),
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
