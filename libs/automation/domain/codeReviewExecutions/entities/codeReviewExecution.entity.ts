import { Entity } from '@libs/core/domain/interfaces/entity';

import { CodeReviewExecution } from '../interfaces/codeReviewExecution.interface';

export class CodeReviewExecutionEntity<T> implements Entity<
    CodeReviewExecution<T>
> {
    private readonly _uuid: CodeReviewExecution<T>['uuid'];
    private readonly _createdAt: CodeReviewExecution<T>['createdAt'];
    private readonly _updatedAt: CodeReviewExecution<T>['updatedAt'];

    private readonly _automationExecution: CodeReviewExecution<T>['automationExecution'];
    private readonly _status: CodeReviewExecution<T>['status'];
    private readonly _message?: CodeReviewExecution<T>['message'];

    constructor(codeReviewExecution: CodeReviewExecution<T>) {
        this._uuid = codeReviewExecution.uuid;
        this._createdAt = codeReviewExecution.createdAt;
        this._updatedAt = codeReviewExecution.updatedAt;
        this._automationExecution = codeReviewExecution.automationExecution;
        this._status = codeReviewExecution.status;
        this._message = codeReviewExecution.message;
    }

    toObject(): CodeReviewExecution<T> {
        return {
            uuid: this.uuid,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            automationExecution: this.automationExecution,
            status: this.status,
            message: this.message,
        };
    }

    toJson(): CodeReviewExecution<T> {
        return this.toObject();
    }

    public static create<T>(
        execution: CodeReviewExecution<T>,
    ): CodeReviewExecutionEntity<T> {
        return new CodeReviewExecutionEntity(execution);
    }

    get uuid(): CodeReviewExecution<T>['uuid'] {
        return this._uuid;
    }

    get createdAt(): CodeReviewExecution<T>['createdAt'] {
        return this._createdAt;
    }

    get updatedAt(): CodeReviewExecution<T>['updatedAt'] {
        return this._updatedAt;
    }

    get automationExecution(): CodeReviewExecution<T>['automationExecution'] {
        return this._automationExecution;
    }

    get status(): CodeReviewExecution<T>['status'] {
        return this._status;
    }

    get message(): CodeReviewExecution<T>['message'] {
        return this._message;
    }
}
