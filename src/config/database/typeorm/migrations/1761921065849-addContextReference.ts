import { MigrationInterface, QueryRunner } from "typeorm";

export class AddContextReference1761921065849 implements MigrationInterface {
    name = 'AddContextReference1761921065849'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "context_references" DROP COLUMN "payload"
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "context_references"
            ADD "payload" jsonb NOT NULL
        `);
    }

}
