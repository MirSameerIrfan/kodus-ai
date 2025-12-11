import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateWorkflowTables1702252800000 implements MigrationInterface {
    name = 'CreateWorkflowTables1702252800000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create workflow schema
        await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS workflow`);

        // Create workflow_type enum
        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE workflow.workflow_type_enum AS ENUM (
                    'CODE_REVIEW',
                    'CRON_CHECK_PR_APPROVAL',
                    'CRON_KODY_LEARNING',
                    'CRON_CODE_REVIEW_FEEDBACK',
                    'WEBHOOK_PROCESSING'
                );
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);

        // Create handler_type enum
        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE workflow.handler_type_enum AS ENUM (
                    'PIPELINE_SYNC',
                    'PIPELINE_ASYNC',
                    'SIMPLE_FUNCTION',
                    'WEBHOOK_RAW'
                );
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);

        // Create job_status enum
        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE workflow.job_status_enum AS ENUM (
                    'PENDING',
                    'PROCESSING',
                    'COMPLETED',
                    'FAILED',
                    'WAITING_FOR_EVENT',
                    'CANCELLED'
                );
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);

        // Create error_classification enum
        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE workflow.error_classification_enum AS ENUM (
                    'RETRYABLE',
                    'NON_RETRYABLE',
                    'CIRCUIT_OPEN',
                    'PERMANENT'
                );
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);

        // Create workflow_jobs table
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS workflow.workflow_jobs (
                uuid UUID DEFAULT gen_random_uuid() PRIMARY KEY,
                "correlationId" VARCHAR(255) NOT NULL,
                "workflowType" workflow.workflow_type_enum NOT NULL,
                "handlerType" workflow.handler_type_enum NOT NULL,
                payload JSONB DEFAULT '{}',
                status workflow.job_status_enum DEFAULT 'PENDING',
                priority INTEGER DEFAULT 0,
                "retryCount" INTEGER DEFAULT 0,
                "maxRetries" INTEGER DEFAULT 3,
                "organizationId" VARCHAR(255),
                "teamId" VARCHAR(255),
                "errorClassification" workflow.error_classification_enum,
                "lastError" TEXT,
                "scheduledAt" TIMESTAMP,
                "startedAt" TIMESTAMP,
                "completedAt" TIMESTAMP,
                "currentStage" VARCHAR(255),
                metadata JSONB,
                "waitingForEvent" JSONB,
                "pipelineState" JSONB,
                "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP(6),
                "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP(6)
            )
        `);

        // Create outbox_messages table
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS workflow.outbox_messages (
                uuid UUID DEFAULT gen_random_uuid() PRIMARY KEY,
                job_id UUID REFERENCES workflow.workflow_jobs(uuid) ON DELETE SET NULL,
                exchange VARCHAR(255) NOT NULL,
                "routingKey" VARCHAR(255) NOT NULL,
                payload JSONB NOT NULL,
                processed BOOLEAN DEFAULT FALSE,
                "processedAt" TIMESTAMP,
                "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP(6),
                "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP(6)
            )
        `);

        // Create inbox_messages table
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS workflow.inbox_messages (
                uuid UUID DEFAULT gen_random_uuid() PRIMARY KEY,
                "messageId" VARCHAR(255) NOT NULL,
                "consumerId" VARCHAR(255),
                job_id UUID REFERENCES workflow.workflow_jobs(uuid) ON DELETE SET NULL,
                processed BOOLEAN DEFAULT FALSE,
                "processedAt" TIMESTAMP,
                "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP(6),
                "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP(6)
            )
        `);

        // Create indexes
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_workflow_jobs_status"
            ON workflow.workflow_jobs (status)
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_workflow_jobs_workflow_type"
            ON workflow.workflow_jobs ("workflowType")
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_workflow_jobs_correlation_id"
            ON workflow.workflow_jobs ("correlationId")
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_workflow_jobs_organization_team"
            ON workflow.workflow_jobs ("organizationId", "teamId")
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_outbox_messages_processed"
            ON workflow.outbox_messages (processed)
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_outbox_messages_created_at"
            ON workflow.outbox_messages ("createdAt")
        `);

        await queryRunner.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS "IDX_inbox_messages_message_id"
            ON workflow.inbox_messages ("messageId")
        `);

        await queryRunner.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS "IDX_inbox_messages_consumer_message"
            ON workflow.inbox_messages ("consumerId", "messageId")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop indexes
        await queryRunner.query(
            `DROP INDEX IF EXISTS workflow."IDX_inbox_messages_consumer_message"`,
        );
        await queryRunner.query(
            `DROP INDEX IF EXISTS workflow."IDX_inbox_messages_message_id"`,
        );
        await queryRunner.query(
            `DROP INDEX IF EXISTS workflow."IDX_outbox_messages_created_at"`,
        );
        await queryRunner.query(
            `DROP INDEX IF EXISTS workflow."IDX_outbox_messages_processed"`,
        );
        await queryRunner.query(
            `DROP INDEX IF EXISTS workflow."IDX_workflow_jobs_organization_team"`,
        );
        await queryRunner.query(
            `DROP INDEX IF EXISTS workflow."IDX_workflow_jobs_correlation_id"`,
        );
        await queryRunner.query(
            `DROP INDEX IF EXISTS workflow."IDX_workflow_jobs_workflow_type"`,
        );
        await queryRunner.query(
            `DROP INDEX IF EXISTS workflow."IDX_workflow_jobs_status"`,
        );

        // Drop tables
        await queryRunner.query(`DROP TABLE IF EXISTS workflow.inbox_messages`);
        await queryRunner.query(
            `DROP TABLE IF EXISTS workflow.outbox_messages`,
        );
        await queryRunner.query(`DROP TABLE IF EXISTS workflow.workflow_jobs`);

        // Drop enums
        await queryRunner.query(
            `DROP TYPE IF EXISTS workflow.error_classification_enum`,
        );
        await queryRunner.query(`DROP TYPE IF EXISTS workflow.job_status_enum`);
        await queryRunner.query(
            `DROP TYPE IF EXISTS workflow.handler_type_enum`,
        );
        await queryRunner.query(
            `DROP TYPE IF EXISTS workflow.workflow_type_enum`,
        );

        // Drop schema (only if empty)
        await queryRunner.query(`DROP SCHEMA IF EXISTS workflow`);
    }
}
