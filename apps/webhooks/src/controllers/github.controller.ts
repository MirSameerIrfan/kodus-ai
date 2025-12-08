import { createLogger } from '@kodus/flow';
import { Controller, HttpStatus, Inject, Post, Req, Res } from '@nestjs/common';
import { Response } from 'express';
import { PlatformType } from '@libs/common/enums/platform-type.enum';
import { EnqueueWebhookUseCase } from '@libs/platform/application/use-cases/webhook/enqueue-webhook.use-case';
import {
    IWebhookLogService,
    WEBHOOK_LOG_SERVICE,
} from '@libs/platform/domain/webhook-log/contracts/webhook-log.service.contract';

@Controller('github')
export class GithubController {
    private readonly logger = createLogger(GithubController.name);

    constructor(
        private readonly enqueueWebhookUseCase: EnqueueWebhookUseCase,
        @Inject(WEBHOOK_LOG_SERVICE)
        private readonly webhookLogService: IWebhookLogService,
    ) {}

    @Post('/webhook')
    handleWebhook(@Req() req: Request, @Res() res: Response) {
        // Validação síncrona rápida (não bloqueia event loop)
        const event = req.headers['x-github-event'] as string;
        const payload = req.body as any;

        if (event === 'pull_request') {
            if (
                payload?.action !== 'opened' &&
                payload?.action !== 'synchronize' &&
                payload?.action !== 'closed' &&
                payload?.action !== 'reopened' &&
                payload?.action !== 'ready_for_review'
            ) {
                return res.status(HttpStatus.OK).send('Webhook received');
            }
        }

        // Retorna 200 OK imediatamente (não bloqueia)
        res.status(HttpStatus.OK).send('Webhook received');

        // Processa assincronamente na próxima iteração do event loop
        // setImmediate garante que não bloqueia a resposta HTTP
        setImmediate(() => {
            // Usa void para garantir que não esperamos a Promise
            // Erros são tratados internamente sem bloquear
            void (async () => {
                try {
                    this.logger.log({
                        message: `Webhook received, ${event}`,
                        context: GithubController.name,
                        metadata: {
                            event,
                            installationId: payload?.installation?.id,
                            repository: payload?.repository?.name,
                        },
                    });

                    this.webhookLogService.log(
                        PlatformType.GITHUB,
                        event,
                        payload,
                    );

                    await this.enqueueWebhookUseCase.execute({
                        platformType: PlatformType.GITHUB,
                        event,
                        payload,
                    });
                } catch (error) {
                    // Erro não deve quebrar o processo, apenas logar
                    this.logger.error({
                        message: 'Error enqueuing webhook',
                        context: GithubController.name,
                        error,
                        metadata: {
                            event,
                            platformType: PlatformType.GITHUB,
                        },
                    });
                }
            })();
        });
    }
}
