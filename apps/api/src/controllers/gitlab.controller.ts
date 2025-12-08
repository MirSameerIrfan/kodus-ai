import { createLogger } from '@kodus/flow';
import { Controller, HttpStatus, Inject, Post, Req, Res } from '@nestjs/common';
import { Response } from 'express';
import { PlatformType } from '@shared/domain/enums/platform-type.enum';
import { ReceiveWebhookUseCase } from '@libs/platform/application/use-cases/codeManagement/receiveWebhook.use-case';
import {
    WEBHOOK_LOG_SERVICE,
    IWebhookLogService,
} from '@libs/platform/domain/webhook-log/contracts/webhook-log.service.contract';

@Controller('gitlab')
export class GitlabController {
    private readonly logger = createLogger(GitlabController.name);
    constructor(
        private readonly receiveWebhookUseCase: ReceiveWebhookUseCase,
        @Inject(WEBHOOK_LOG_SERVICE)
        private readonly webhookLogService: IWebhookLogService,
    ) {}

    @Post('/webhook')
    handleWebhook(@Req() req: Request, @Res() res: Response) {
        const event = req.headers['x-gitlab-event'] as string;
        const payload = req.body as any;

        res.status(HttpStatus.OK).send('Webhook received');

        setImmediate(() => {
            this.logger.log({
                message: `Webhook received, ${event}`,
                context: GitlabController.name,
                metadata: {
                    event,
                    installationId: payload?.installation?.id,
                    repository: payload?.repository?.name,
                },
            });

            this.webhookLogService.log(PlatformType.GITLAB, event, payload);

            this.receiveWebhookUseCase.execute({
                payload,
                event,
                platformType: PlatformType.GITLAB,
            });
        });
    }
}
