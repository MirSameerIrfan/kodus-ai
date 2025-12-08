import { createLogger } from '@kodus/flow';
import { GetOrganizationNameUseCase } from '@libs/platform/application/use-cases/github/GetOrganizationName';
import { GetIntegrationGithubUseCase } from '@libs/platform/application/use-cases/github/get-integration-github';
import {
    Controller,
    Get,
    HttpStatus,
    Inject,
    Post,
    Query,
    Req,
    Res,
} from '@nestjs/common';
import { Response } from 'express';
import { PlatformType } from '@shared/domain/enums/platform-type.enum';
import { ReceiveWebhookUseCase } from '@libs/platform/application/use-cases/codeManagement/receiveWebhook.use-case';
import {
    IWebhookLogService,
    WEBHOOK_LOG_SERVICE,
} from '@libs/platform/domain/webhook-log/contracts/webhook-log.service.contract';

@Controller('github')
export class GithubController {
    private readonly logger = createLogger(GithubController.name);
    constructor(
        private readonly getOrganizationNameUseCase: GetOrganizationNameUseCase,
        private readonly getIntegrationGithubUseCase: GetIntegrationGithubUseCase,
        private readonly receiveWebhookUseCase: ReceiveWebhookUseCase,
        @Inject(WEBHOOK_LOG_SERVICE)
        private readonly webhookLogService: IWebhookLogService,
    ) {}

    @Get('/organization-name')
    public async getOrganizationName() {
        return this.getOrganizationNameUseCase.execute();
    }

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
                return res.status(HttpStatus.OK).send('Webhook received');
            }
        }

        res.status(HttpStatus.OK).send('Webhook received');

        setImmediate(() => {
            this.logger.log({
                message: `Webhook received, ${event}`,
                context: GithubController.name,
                metadata: {
                    event,
                    installationId: payload?.installation?.id,
                    repository: payload?.repository?.name,
                },
            });

            this.webhookLogService.log(PlatformType.GITHUB, event, payload);

            this.receiveWebhookUseCase.execute({
                payload,
                event,
                platformType: PlatformType.GITHUB,
            });
        });
    }

    @Get('/integration')
    public async getIntegration(@Query('installId') installId: string) {
        return this.getIntegrationGithubUseCase.execute(installId);
    }
}
