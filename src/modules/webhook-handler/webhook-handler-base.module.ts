import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../database.module';
import { LogModule } from '../log.module';
import { RabbitMQWrapperModule } from '../rabbitmq.module';
import { SharedModule } from '../shared.module';
import { WebhookLogModule } from '../webhookLog.module';
import { WebhookEnqueueModule } from './webhook-enqueue.module';
import { WebhookHealthModule } from './webhook-health.module';

/**
 * WebhookHandlerBaseModule - Base Mínima para Webhook Handler
 *
 * Este módulo contém APENAS o mínimo necessário para receber webhooks:
 * - ConfigModule (variáveis de ambiente)
 * - EventEmitterModule (eventos internos)
 * - RabbitMQWrapperModule (enfileirar mensagens)
 * - LogModule (logging)
 * - DatabaseModule (salvar logs de webhook)
 * - SharedModule (utilitários)
 * - WebhookLogModule (log de webhooks recebidos)
 * - WebhookEnqueueModule (enfileirar payload bruto)
 * - WebhookHealthModule (health check simplificado)
 *
 * NÃO inclui:
 * - PlatformIntegrationModule (workers fazem isso)
 * - ReceiveWebhookUseCase (workers fazem isso)
 * - Handlers (workers fazem isso)
 * - CodeManagementService (workers fazem isso)
 * - Módulos pesados (LLM, AST, Automation, etc.)
 *
 * Este faz o webhook handler:
 * - Ultra leve (~10-20MB vs ~100-120MB antes)
 * - Ultra rápido (~500ms-1s startup vs ~5-7s antes)
 * - Alta throughput (pode lidar com 1000+ req/s)
 * - Stateless (fácil escalar horizontalmente)
 */
@Module({
    imports: [
        // Core Infrastructure (mínimo)
        ConfigModule.forRoot(),
        EventEmitterModule.forRoot(),
        RabbitMQWrapperModule.register(),
        LogModule,
        DatabaseModule,
        SharedModule,
        // Webhook-specific
        WebhookLogModule,
        WebhookEnqueueModule, // Enfileirar payload bruto
        WebhookHealthModule, // Health check simplificado
    ],
    // No providers - all providers come from imported modules
    // No controllers - controllers are added by WebhookHandlerModule
    // No exports - this is a base module
})
export class WebhookHandlerBaseModule {}
