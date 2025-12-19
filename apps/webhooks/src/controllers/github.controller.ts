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
    ) {}

    @Post('/webhook')
    handleWebhook(@Req() req: Request, @Res() res: Response) {
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

        // Responde imediatamente (não bloqueia a request aguardando persistência/fila)
        res.status(HttpStatus.OK).send('Webhook received');

        setImmediate(() => {
            void this.enqueueWebhookUseCase
                .execute({
                    platformType: PlatformType.GITHUB,
                    event,
                    payload,
                })
                .then(() => {
                    this.logger.log({
                        message: `Webhook enqueued, ${event}`,
                        context: GithubController.name,
                        metadata: {
                            event,
                            installationId: payload?.installation?.id,
                            repository: payload?.repository?.name,
                        },
                    });
                })
                .catch((error) => {
                    this.logger.error({
                        message: 'Error enqueuing webhook',
                        context: GithubController.name,
                        error,
                        metadata: {
                            event,
                            platformType: PlatformType.GITHUB,
                        },
                    });
                });
        });
    }
}
