import { createLogger } from '@kodus/flow';
import { Controller, HttpStatus, Inject, Post, Req, Res } from '@nestjs/common';
import { Response, Request } from 'express';
import { PlatformType } from '@libs/core/domain/enums/platform-type.enum';
import { EnqueueWebhookUseCase } from '@libs/platform/application/use-cases/webhook/enqueue-webhook.use-case';
import { validateWebhookToken } from '@libs/core/utils/webhooks/webhookTokenCrypto';
import {
    WEBHOOK_LOG_SERVICE,
    IWebhookLogService,
} from '@libs/platform/domain/webhook-log/contracts/webhook-log.service.contract';

@Controller('azure-repos')
export class AzureReposController {
    private readonly logger = createLogger(AzureReposController.name);

    constructor(
        private readonly enqueueWebhookUseCase: EnqueueWebhookUseCase,
        @Inject(WEBHOOK_LOG_SERVICE)
        private readonly webhookLogService: IWebhookLogService,
    ) {}

    @Post('/webhook')
    handleWebhook(@Req() req: Request, @Res() res: Response) {
        // Validação síncrona rápida (não bloqueia event loop)
        const encrypted = req.query.token as string;

        if (!validateWebhookToken(encrypted)) {
            this.logger.error({
                message: 'Webhook Azure DevOps Not Token Valid',
                context: AzureReposController.name,
            });
            return res.status(403).send('Unauthorized');
        }

        const payload = req.body as any;
        const eventType = payload?.eventType as string;

        if (!eventType) {
            this.logger.log({
                message: 'Webhook Azure DevOps recebido sem eventType',
                context: AzureReposController.name,
                metadata: { payload },
            });
            return res
                .status(HttpStatus.BAD_REQUEST)
                .send('Evento não reconhecido');
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
                        message: `Webhook received, ${eventType}`,
                        context: AzureReposController.name,
                        metadata: {
                            event: eventType,
                            repositoryName: payload?.resource?.repository?.name,
                            pullRequestId: payload?.resource?.pullRequestId,
                            projectId: payload?.resourceContainers?.project?.id,
                        },
                    });

                    this.webhookLogService.log(
                        PlatformType.AZURE_REPOS,
                        eventType,
                        payload,
                    );

                    await this.enqueueWebhookUseCase.execute({
                        platformType: PlatformType.AZURE_REPOS,
                        event: eventType,
                        payload,
                    });
                } catch (error) {
                    // Erro não deve quebrar o processo, apenas logar
                    this.logger.error({
                        message: 'Error enqueuing webhook',
                        context: AzureReposController.name,
                        error,
                        metadata: {
                            event: eventType,
                            platformType: PlatformType.AZURE_REPOS,
                        },
                    });
                }
            })();
        });
    }
}
