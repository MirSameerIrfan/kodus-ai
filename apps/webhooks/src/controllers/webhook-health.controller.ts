import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { Controller, Get, HttpStatus, Optional, Res } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Response } from 'express';
import { Connection } from 'typeorm';

/**
 * WebhookHealthController - Health Check Simplificado para Webhook Handler
 *
 * Verifica apenas o essencial:
 * - Status da aplicação
 * - Conexão com RabbitMQ (crítico - precisa enfileirar mensagens)
 * - Conexão com PostgreSQL (crítico - precisa salvar logs de webhook)
 */
@Controller('health')
export class WebhookHealthController {
    constructor(
        @InjectConnection()
        private readonly dataSource: Connection,
        @Optional()
        private readonly amqpConnection: AmqpConnection,
    ) {}

    @Get()
    async check(@Res() res: Response) {
        try {
            const checks = {
                application: await this.checkApplication(),
                rabbitmq: await this.checkRabbitMQ(),
                postgresql: await this.checkPostgreSQL(),
            };

            const allHealthy = Object.values(checks).every(
                (check) => check.status === 'ok',
            );

            const response = {
                status: allHealthy ? 'ok' : 'degraded',
                timestamp: new Date().toISOString(),
                checks,
            };

            const statusCode = allHealthy
                ? HttpStatus.OK
                : HttpStatus.SERVICE_UNAVAILABLE;

            return res.status(statusCode).json(response);
        } catch (error) {
            const response = {
                status: 'error',
                error: `Health check failed: ${error instanceof Error ? error.message : String(error)}`,
                timestamp: new Date().toISOString(),
            };

            return res.status(HttpStatus.SERVICE_UNAVAILABLE).json(response);
        }
    }

    @Get('simple')
    simpleCheck(@Res() res: Response) {
        return res.status(HttpStatus.OK).json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            message: 'Webhook handler is running',
            uptime: Math.floor(process.uptime()),
        });
    }

    private async checkApplication(): Promise<{
        status: string;
        error?: string;
    }> {
        try {
            return { status: 'ok' };
        } catch (error) {
            return { status: 'error', error: error.message };
        }
    }

    private async checkRabbitMQ(): Promise<{ status: string; error?: string }> {
        try {
            if (!this.amqpConnection) {
                return {
                    status: 'error',
                    error: 'RabbitMQ connection not available (disabled?)',
                };
            }

            // Verificar se conexão RabbitMQ está ativa
            const channel = this.amqpConnection.channel;
            if (!channel) {
                return {
                    status: 'error',
                    error: 'RabbitMQ channel not available',
                };
            }

            // Tentar verificar uma queue (não bloqueia se não existir)
            await channel.checkQueue('workflow.webhooks.queue').catch(() => {
                // Queue pode não existir ainda, mas conexão está OK
            });

            return { status: 'ok' };
        } catch (error) {
            return { status: 'error', error: error.message };
        }
    }

    private async checkPostgreSQL(): Promise<{
        status: string;
        error?: string;
    }> {
        try {
            // Verificar se conexão PostgreSQL está ativa
            await this.dataSource.query('SELECT 1');
            return { status: 'ok' };
        } catch (error) {
            return { status: 'error', error: error.message };
        }
    }
}
