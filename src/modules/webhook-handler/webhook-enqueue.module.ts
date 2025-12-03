import { Module } from '@nestjs/common';
import { RabbitMQWrapperModule } from '../rabbitmq.module';
import { EnqueueWebhookUseCase } from '@/core/application/use-cases/webhook/enqueue-webhook.use-case';
import { LogModule } from '../log.module';

/**
 * WebhookEnqueueModule - Módulo Mínimo para Enfileirar Webhooks
 *
 * Este módulo contém apenas o necessário para enfileirar webhooks:
 * - EnqueueWebhookUseCase (enfileira payload bruto na fila)
 * - RabbitMQWrapperModule (conexão RabbitMQ)
 * - LogModule (logging)
 *
 * NÃO inclui:
 * - Processamento de webhooks (workers fazem isso)
 * - Validação de organização/team (workers fazem isso)
 * - Decisão de qual handler usar (workers fazem isso)
 * - Lógica de negócio (workers fazem isso)
 *
 * Tamanho: ~2-3MB
 */
@Module({
    imports: [
        RabbitMQWrapperModule.register(), // Para AmqpConnection
        LogModule, // Para PinoLoggerService (@Global)
    ],
    providers: [EnqueueWebhookUseCase],
    exports: [EnqueueWebhookUseCase],
})
export class WebhookEnqueueModule {}
