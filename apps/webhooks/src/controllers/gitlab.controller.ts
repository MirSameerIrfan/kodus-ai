import { createLogger } from '@kodus/flow';
import { Controller, HttpStatus, Inject, Post, Req, Res } from '@nestjs/common';
import { Response } from 'express';
import { PlatformType } from '@/shared/domain/enums/platform-type.enum';
import { EnqueueWebhookUseCase } from '@/core/application/use-cases/webhook/enqueue-webhook.use-case';
import {
    WEBHOOK_LOG_SERVICE,
    IWebhookLogService,
} from '@/core/domain/webhookLog/contracts/webhook-log.service.contract';

@Controller('gitlab')
export class GitlabController {
    private readonly logger = createLogger(GitlabController.name);
    constructor(
        private readonly enqueueWebhookUseCase: EnqueueWebhookUseCase,
        @Inject(WEBHOOK_LOG_SERVICE)
        private readonly webhookLogService: IWebhookLogService,
    ) {}

    @Post('/webhook')
    handleWebhook(@Req() req: Request, @Res() res: Response) {
        // Validação síncrona rápida (não bloqueia event loop)
        const event = req.headers['x-gitlab-event'] as string;
        const payload = req.body as any;

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
                        context: GitlabController.name,
                        metadata: {
                            event,
                            installationId: payload?.installation?.id,
                            repository: payload?.repository?.name,
                        },
                    });

                    //TODO isso pode ir para outro lugar melhor, pois não é responsabilidade do controller
                    this.webhookLogService.log(
                        PlatformType.GITLAB,
                        event,
                        payload,
                    );

                    await this.enqueueWebhookUseCase.execute({
                        platformType: PlatformType.GITLAB,
                        event,
                        payload,
                    });
                } catch (error) {
                    // Erro não deve quebrar o processo, apenas logar
                    this.logger.error({
                        message: 'Error enqueuing webhook',
                        context: GitlabController.name,
                        error,
                        metadata: {
                            event,
                            platformType: PlatformType.GITLAB,
                        },
                    });
                }
            })();
        });
    }
}
