import {
    Controller,
    Get,
    Param,
    Query,
    UseGuards,
    HttpStatus,
    HttpCode,
} from '@nestjs/common';
import { JOB_STATUS_SERVICE_TOKEN } from '@/core/domain/workflowQueue/contracts/job-status.service.contract';
import { IJobStatusService } from '@/core/domain/workflowQueue/contracts/job-status.service.contract';
import { Inject } from '@nestjs/common';
import { JobStatus } from '@/core/domain/workflowQueue/enums/job-status.enum';
import { WorkflowType } from '@/core/domain/workflowQueue/enums/workflow-type.enum';
import { PolicyGuard } from '@/core/infrastructure/adapters/services/permissions/policy.guard';
import { CheckPolicies } from '@/core/infrastructure/adapters/services/permissions/policy.guard';
import { checkPermissions } from '@/core/infrastructure/adapters/services/permissions/policy.handlers';
import {
    Action,
    ResourceType,
} from '@/core/domain/permissions/enums/permissions.enum';

@Controller('workflow-queue')
@UseGuards(PolicyGuard)
export class WorkflowQueueController {
    constructor(
        @Inject(JOB_STATUS_SERVICE_TOKEN)
        private readonly jobStatusService: IJobStatusService,
    ) {}

    @Get('/jobs/:jobId')
    @CheckPolicies(checkPermissions(Action.Read, ResourceType.CodeReview))
    @HttpCode(HttpStatus.OK)
    async getJobStatus(@Param('jobId') jobId: string) {
        const job = await this.jobStatusService.getJobStatus(jobId);

        if (!job) {
            return {
                status: HttpStatus.NOT_FOUND,
                message: 'Job not found',
            };
        }

        return {
            status: HttpStatus.OK,
            data: job,
        };
    }

    @Get('/jobs/:jobId/detail')
    @CheckPolicies(checkPermissions(Action.Read, ResourceType.CodeReview))
    @HttpCode(HttpStatus.OK)
    async getJobDetail(@Param('jobId') jobId: string) {
        const detail = await this.jobStatusService.getJobDetail(jobId);

        if (!detail) {
            return {
                status: HttpStatus.NOT_FOUND,
                message: 'Job not found',
            };
        }

        return {
            status: HttpStatus.OK,
            data: detail,
        };
    }

    @Get('/metrics')
    @CheckPolicies(checkPermissions(Action.Read, ResourceType.CodeReview))
    @HttpCode(HttpStatus.OK)
    async getMetrics() {
        const metrics = await this.jobStatusService.getMetrics();

        return {
            status: HttpStatus.OK,
            data: metrics,
        };
    }
}
