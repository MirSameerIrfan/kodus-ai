jest.mock('@kodus/flow', () => ({
    getObservability: jest.fn().mockReturnValue({
        getTracer: jest.fn().mockReturnValue({
            startSpan: jest.fn().mockReturnValue({
                end: jest.fn(),
                setAttribute: jest.fn(),
                setAttributes: jest.fn(),
            }),
        }),
    }),
    IdGenerator: {
        generate: jest.fn().mockReturnValue('mock-id'),
    },
}));

const buildContextPackMock = jest.fn();
jest.mock(
    '@/core/infrastructure/adapters/services/context/code-review-context-pack.service',
    () => ({
        CodeReviewContextPackService: jest
            .fn()
            .mockImplementation(() => ({
                buildContextPack: buildContextPackMock,
            })),
    }),
);

import { Test, TestingModule } from '@nestjs/testing';
import { ExternalReferenceLoaderService } from '@/core/infrastructure/adapters/services/kodyRules/externalReferenceLoader.service';
import { PinoLoggerService } from '@/core/infrastructure/adapters/services/logger/pino.service';
import { CodeReviewContextPackService } from '@/core/infrastructure/adapters/services/context/code-review-context-pack.service';
import { IKodyRule } from '@/core/domain/kodyRules/interfaces/kodyRules.interface';
import { AnalysisContext } from '@/config/types/general/codeReview.type';

describe('ExternalReferenceLoaderService', () => {
    let service: ExternalReferenceLoaderService;
    let mockLogger: jest.Mocked<PinoLoggerService>;
    let mockContextPackService: jest.Mocked<CodeReviewContextPackService>;

    const mockContext: AnalysisContext = {
        organizationAndTeamData: {
            organizationId: 'org-123',
            teamId: 'team-456',
        },
        repository: {
            id: 'repo-123',
            name: 'test-repo',
        },
        pullRequest: {
            number: 42,
            head: { ref: 'feature-branch' },
            base: { ref: 'main' },
        },
    } as any;

    beforeEach(async () => {
        mockLogger = {
            log: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
        } as any;

        buildContextPackMock.mockReset();
        mockContextPackService = {
            buildContextPack: buildContextPackMock,
        } as any;

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ExternalReferenceLoaderService,
                {
                    provide: PinoLoggerService,
                    useValue: mockLogger,
                },
                {
                    provide: CodeReviewContextPackService,
                    useValue: mockContextPackService,
                },
            ],
        }).compile();

        service = module.get<ExternalReferenceLoaderService>(
            ExternalReferenceLoaderService,
        );
    });

    describe('loadReferences', () => {
        it('should return knowledge references and augmentations from context pack', async () => {
            const rule: IKodyRule = {
                uuid: 'rule-1',
                contextReferenceId: 'ctx-ref-1',
            } as any;

            mockContextPackService.buildContextPack.mockResolvedValue({
                pack: {
                    layers: [
                        {
                            metadata: { sourceType: 'knowledge' },
                            content: [
                                {
                                    filePath: 'docs/rule.md',
                                    content: 'Rule content',
                                    description: 'Important rule',
                                },
                                {
                                    filePath: 'docs/invalid.json',
                                    content: 123,
                                },
                            ],
                        },
                        {
                            metadata: { sourceType: 'other' },
                            content: [
                                {
                                    filePath: 'ignored',
                                    content: 'should be ignored',
                                },
                            ],
                        },
                    ],
                },
                augmentations: {
                    requirementA: {
                        path: ['requirementA'],
                        outputs: [
                            {
                                success: true,
                                toolName: 'tool-1',
                                provider: 'provider-1',
                                output: 'value',
                            },
                            {
                                success: false,
                                toolName: 'tool-1',
                                provider: 'provider-1',
                                error: 'missing args',
                            },
                        ],
                    },
                },
            });

            const result = await service.loadReferences(rule, mockContext);

            expect(result.references).toEqual([
                {
                    filePath: 'docs/rule.md',
                    content: 'Rule content',
                    description: 'Important rule',
                },
            ]);

            expect(result.augmentations.size).toBe(1);
            expect(result.augmentations.get('requirementA::0')).toEqual({
                provider: 'provider-1',
                toolName: 'tool-1',
                output: 'value',
            });
            expect(mockLogger.log).toHaveBeenCalledWith(
                expect.objectContaining({
                    message:
                        'Loaded references via Context Pack for Kody Rule context',
                }),
            );
        });

        it('should return empty arrays when rule has no contextReferenceId', async () => {
            const rule: IKodyRule = {
                uuid: 'rule-1',
            } as any;

            const result = await service.loadReferences(rule, mockContext);

            expect(result.references).toEqual([]);
            expect(result.augmentations.size).toBe(0);
            expect(mockLogger.debug).toHaveBeenCalledWith(
                expect.objectContaining({
                    message:
                        'Rule has no contextReferenceId, skipping reference loading',
                }),
            );
            expect(mockContextPackService.buildContextPack).not.toHaveBeenCalled();
        });

        it('should handle errors thrown by context pack service', async () => {
            const rule: IKodyRule = {
                uuid: 'rule-1',
                contextReferenceId: 'ctx-ref-1',
            } as any;

            mockContextPackService.buildContextPack.mockRejectedValue(
                new Error('boom'),
            );

            const result = await service.loadReferences(rule, mockContext);

            expect(result.references).toEqual([]);
            expect(result.augmentations.size).toBe(0);
            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: 'Failed to load references via Context Pack',
                }),
            );
        });
    });

    describe('loadReferencesForRules', () => {
        it('should aggregate references and augmentations for multiple rules', async () => {
            const rules: Partial<IKodyRule>[] = [
                { uuid: 'rule-1', contextReferenceId: 'ctx-1' },
                { uuid: 'rule-2', contextReferenceId: 'ctx-2' },
                { uuid: 'rule-without-context' },
            ];

            mockContextPackService.buildContextPack
                .mockResolvedValueOnce({
                    pack: {
                        layers: [
                            {
                                metadata: { sourceType: 'knowledge' },
                                content: [
                                    {
                                        filePath: 'docs/rule1.md',
                                        content: 'content-1',
                                    },
                                ],
                            },
                        ],
                    },
                    augmentations: {
                        requirementA: {
                            outputs: [
                                {
                                    success: true,
                                    toolName: 'tool-A',
                                    provider: 'provider-A',
                                    output: 'value-A',
                                },
                            ],
                        },
                    },
                })
                .mockResolvedValueOnce({
                    pack: {
                        layers: [
                            {
                                metadata: { sourceType: 'knowledge' },
                                content: [
                                    {
                                        filePath: 'docs/rule2.md',
                                        content: 'content-2',
                                    },
                                ],
                            },
                        ],
                    },
                    augmentations: undefined,
                });

            const result = await service.loadReferencesForRules(
                rules,
                mockContext,
            );

            expect(result.referencesMap.size).toBe(2);
            expect(result.referencesMap.get('rule-1')).toEqual([
                { filePath: 'docs/rule1.md', content: 'content-1' },
            ]);
            expect(result.referencesMap.get('rule-2')).toEqual([
                { filePath: 'docs/rule2.md', content: 'content-2' },
            ]);

            expect(result.mcpResultsMap.size).toBe(1);
            expect(result.mcpResultsMap.get('rule-1')).toEqual({
                'requirementA::0': {
                    provider: 'provider-A',
                    toolName: 'tool-A',
                    output: 'value-A',
                },
            });

            expect(mockLogger.log).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: 'Loaded external references for rules',
                    metadata: expect.objectContaining({
                        totalRules: 3,
                        rulesWithReferences: 2,
                        totalReferencesLoaded: 2,
                    }),
                }),
            );
        });
    });
});
