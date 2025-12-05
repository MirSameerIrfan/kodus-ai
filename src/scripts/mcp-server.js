#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const mcp_module_1 = require("../core/infrastructure/adapters/mcp/mcp.module");
const mcp_server_service_1 = require("../core/infrastructure/adapters/mcp/services/mcp-server.service");
async function bootstrap() {
    const logger = new common_1.Logger('MCP Server');
    try {
        process.env.API_MCP_SERVER_ENABLED = 'true';
        const app = await core_1.NestFactory.create(mcp_module_1.McpModule, {
            logger: ['error', 'warn', 'log'],
        });
        app.enableCors({
            origin: '*',
            methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'mcp-session-id'],
            exposedHeaders: ['mcp-session-id'],
        });
        const port = process.env.MCP_PORT || 3001;
        await app.listen(port, '0.0.0.0');
        logger.log(`Kodus Code Management MCP Server started on http://0.0.0.0:${port}`);
        logger.log(`MCP endpoint: POST/GET/DELETE http://0.0.0.0:${port}/mcp`);
        logger.log(`Health check: GET http://0.0.0.0:${port}/health`);
        const mcpService = app.get(mcp_server_service_1.McpServerService);
        const shutdown = async (signal) => {
            logger.log(`Received ${signal}. Shutting down MCP Server...`);
            try {
                await mcpService.cleanup();
                await app.close();
                logger.log('MCP Server shutdown complete');
                process.exit(0);
            }
            catch (error) {
                logger.error('Error during shutdown:', error);
                process.exit(1);
            }
        };
        process.on('SIGINT', () => shutdown('SIGINT'));
        process.on('SIGTERM', () => shutdown('SIGTERM'));
    }
    catch (error) {
        logger.error('Failed to start MCP Server', error);
        process.exit(1);
    }
}
bootstrap();
//# sourceMappingURL=mcp-server.js.map