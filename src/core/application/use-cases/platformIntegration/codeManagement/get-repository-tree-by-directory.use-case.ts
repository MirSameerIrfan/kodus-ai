import { PinoLoggerService } from '@/core/infrastructure/adapters/services/logger/pino.service';
import { CodeManagementService } from '@/core/infrastructure/adapters/services/platformIntegration/codeManagement.service';
import { IUseCase } from '@/shared/domain/interfaces/use-case.interface';
import { CacheService } from '@/shared/utils/cache/cache.service';
import {
    IGetAdditionalInfoHelper,
    GET_ADDITIONAL_INFO_HELPER_TOKEN,
} from '@/shared/domain/contracts/getAdditionalInfo.helper.contract';
import { Inject, Injectable } from '@nestjs/common';
import { TreeItem } from '@/config/types/general/tree.type';
import { GetRepositoryTreeByDirectoryDto } from '@/core/infrastructure/http/dtos/get-repository-tree-by-directory.dto';

export interface DirectoryItem {
    name: string;
    path: string;
    sha: string;
    hasChildren: boolean; // Indica se deve mostrar o ícone de expandir
}

export interface RepositoryTreeByDirectoryResponse {
    repository: string | null;
    parentPath: string | null; // Path do diretório pai (null se for raiz)
    currentPath: string | null; // Path do diretório atual (null se for raiz)
    directories: DirectoryItem[];
}

@Injectable()
export class GetRepositoryTreeByDirectoryUseCase implements IUseCase {
    constructor(
        private readonly codeManagementService: CodeManagementService,
        private readonly logger: PinoLoggerService,
        @Inject(GET_ADDITIONAL_INFO_HELPER_TOKEN)
        private readonly getAdditionalInfoHelper: IGetAdditionalInfoHelper,
        private readonly cacheService: CacheService,
    ) {}

    public async execute(
        params: GetRepositoryTreeByDirectoryDto,
    ): Promise<RepositoryTreeByDirectoryResponse> {
        try {
            // Criar chave de cache única para cada diretório
            const cacheKey = this.buildCacheKey(
                params.organizationId,
                params.teamId,
                params.repositoryId,
                params.directoryPath,
            );

            // Tentar buscar do cache se useCache = true
            let directories: TreeItem[] = [];
            
            if (params.useCache) {
                const cached = await this.cacheService.getFromCache<{
                    directories: TreeItem[];
                }>(cacheKey);

                if (cached) {
                    directories = cached.directories;
                    
                    this.logger.debug({
                        message: 'Repository tree by directory loaded from cache',
                        context: GetRepositoryTreeByDirectoryUseCase.name,
                        metadata: {
                            organizationId: params.organizationId,
                            repositoryId: params.repositoryId,
                            directoryPath: params.directoryPath || 'root',
                        },
                    });
                }
            }

            // Se não tem no cache, buscar da API
            if (directories.length === 0) {
                directories = await this.codeManagementService.getRepositoryTreeByDirectory({
                    organizationAndTeamData: {
                        organizationId: params.organizationId,
                        teamId: params.teamId,
                    },
                    repositoryId: params.repositoryId,
                    directoryPath: params.directoryPath,
                });

                // Salvar no cache por 15 minutos
                if (directories.length > 0) {
                    await this.cacheService.addToCache(
                        cacheKey,
                        { directories },
                        900000, // 15 minutes
                    );
                }
            }

            // Formatar a resposta
            const formattedDirectories = this.formatDirectories(directories);

            // Calcular o parent path
            const parentPath = this.getParentPath(params.directoryPath);

            // Buscar nome do repositório
            const repositoryName = 
                await this.getAdditionalInfoHelper.getRepositoryNameByOrganizationAndRepository(
                    params.organizationId,
                    params.repositoryId,
                );

            return {
                repository: repositoryName,
                parentPath,
                currentPath: params.directoryPath || null,
                directories: formattedDirectories,
            };
        } catch (error) {
            this.logger.error({
                message: 'Error while getting repository tree by directory',
                context: GetRepositoryTreeByDirectoryUseCase.name,
                error: error,
                metadata: {
                    organizationId: params.organizationId,
                    repositoryId: params.repositoryId,
                    directoryPath: params.directoryPath,
                },
            });
            
            return {
                repository: null,
                parentPath: null,
                currentPath: params.directoryPath || null,
                directories: [],
            };
        }
    }

    /**
     * Formata os itens da árvore para o formato de resposta
     */
    private formatDirectories(treeItems: TreeItem[]): DirectoryItem[] {
        return treeItems.map((item) => {
            const pathParts = item.path.split('/');
            const name = pathParts[pathParts.length - 1];

            return {
                name,
                path: item.path,
                sha: item.sha,
                hasChildren: true, // Assumimos que todo diretório pode ter filhos
            };
        });
    }

    /**
     * Calcula o path do diretório pai
     * @example getParentPath('src/services/auth') -> 'src/services'
     * @example getParentPath('src') -> null
     * @example getParentPath(undefined) -> null
     */
    private getParentPath(currentPath?: string): string | null {
        if (!currentPath) {
            return null; // Está na raiz, não tem pai
        }

        const pathParts = currentPath.split('/');
        
        if (pathParts.length === 1) {
            return null; // Está no primeiro nível, pai é a raiz
        }

        return pathParts.slice(0, -1).join('/');
    }

    /**
     * Constrói a chave de cache única para cada combinação
     */
    private buildCacheKey(
        organizationId: string,
        teamId: string,
        repositoryId: string,
        directoryPath?: string,
    ): string {
        const pathSegment = directoryPath ? `-${directoryPath.replace(/\//g, '-')}` : '-root';
        return `repo-tree-by-dir-${organizationId}-${teamId}-${repositoryId}${pathSegment}`;
    }
}