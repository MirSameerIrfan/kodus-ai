export interface IWorkflowJobRepository {
    update(id: string, data: any): Promise<any>;
    findOne(id: string): Promise<any>;
    findMany(query: any): Promise<{ data: any[] }>;
}

export const WORKFLOW_JOB_REPOSITORY_TOKEN = 'WORKFLOW_JOB_REPOSITORY_TOKEN';
