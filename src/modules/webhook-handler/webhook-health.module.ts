import { Module } from '@nestjs/common';
import { WebhookHealthController } from '@/core/infrastructure/http/controllers/webhook-health.controller';
import { DatabaseModule } from '../database.module';
import { RabbitMQWrapperModule } from '../rabbitmq.module';

/**
 * WebhookHealthModule - Health Check Simplificado para Webhook Handler
 *
 * Este módulo contém apenas verificações essenciais para o webhook handler:
 * - Status da aplicação
 * - Conexão com RabbitMQ (crítico - precisa enfileirar mensagens)
 * - Conexão com PostgreSQL (crítico - precisa salvar logs de webhook)
 *
 * NÃO verifica:
 * - Redis/Cache (não crítico para webhook handler)
 * - LLM, AST (não é responsabilidade do webhook handler)
 * - Workers (não é responsabilidade)
 * - Code review (não é responsabilidade)
 *
 * Tamanho: ~1-2MB (vs ~5-10MB do HealthModule completo)
 */
@Module({
    imports: [
        DatabaseModule, // Apenas para verificar conexão PostgreSQL
        RabbitMQWrapperModule.register(), // Apenas para verificar conexão RabbitMQ
    ],
    controllers: [WebhookHealthController],
})
export class WebhookHealthModule {}
