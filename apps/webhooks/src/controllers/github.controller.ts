import { createLogger } from '@kodus/flow';
import { Controller, HttpStatus, Post, Req, Res } from '@nestjs/common';
import { Response, Request } from 'express';

import { PlatformType } from '@libs/core/domain/enums/platform-type.enum';
import { EnqueueWebhookUseCase } from '@libs/platform/application/use-cases/webhook/enqueue-webhook.use-case';

@Controller('github')
export class GithubController {
    private readonly logger = createLogger(GithubController.name);

    constructor(
        private readonly enqueueWebhookUseCase: EnqueueWebhookUseCase,
        // TODO
        // @Inject(WEBHOOK_LOG_SERVICE)
        // private readonly webhookLogService: IWebhookLogService,
    ) {}

    @Post('/webhook')
    async handleWebhook(@Req() req: Request, @Res() res: Response) {
        // Validação síncrona
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
                return res
                    .status(HttpStatus.OK)
                    .send('Webhook ignored (action not supported)');
            }
        }

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

            // Log de auditoria (opcional/legado)
            //this.webhookLogService.log(PlatformType.GITHUB, event, payload);

            // Transactional Outbox: Salva no banco de dados (atomicamente)
            // Se falhar aqui, lança erro e retorna 500 para o GitHub tentar novamente
            await this.enqueueWebhookUseCase.execute({
                platformType: PlatformType.GITHUB,
                event,
                payload,
            });

            // Retorna 200 OK apenas se persistiu com sucesso
            return res
                .status(HttpStatus.OK)
                .send('Webhook received and queued');
        } catch (error) {
            this.logger.error({
                message: 'Error enqueuing webhook',
                context: GithubController.name,
                error,
                metadata: {
                    event,
                    platformType: PlatformType.GITHUB,
                },
            });
            return res
                .status(HttpStatus.INTERNAL_SERVER_ERROR)
                .send('Error processing webhook');
        }
    }
}
