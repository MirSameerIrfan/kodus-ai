import { Test, TestingModule } from '@nestjs/testing';

import { PROMPT_CONTEXT_ENGINE_SERVICE_TOKEN } from '@/core/domain/prompts/contracts/promptContextEngine.contract';
import {
    IPromptExternalReferenceManagerService,
    PROMPT_EXTERNAL_REFERENCE_MANAGER_SERVICE_TOKEN,
} from '@/core/domain/prompts/contracts/promptExternalReferenceManager.contract';
import { PROMPT_EXTERNAL_REFERENCE_REPOSITORY_TOKEN } from '@/core/domain/prompts/contracts/promptExternalReferenceRepository.contract';
import { PinoLoggerService } from '@/core/infrastructure/adapters/services/logger/pino.service';
import { PromptExternalReferenceManagerService } from '@/core/infrastructure/adapters/services/prompts/promptExternalReferenceManager.service';

describe('PromptExternalReferenceManagerService - hasLikelyExternalReferences', () => {
    let service: IPromptExternalReferenceManagerService;

    beforeEach(async () => {
        const mockRepository = {
            create: jest.fn(),
            findByConfigKey: jest.fn(),
            findByConfigKeys: jest.fn(),
            upsert: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            findByOrganizationId: jest.fn(),
            updateStatus: jest.fn(),
        };

        const mockContextEngine = {
            detectAndResolveReferences: jest.fn(),
            detectReferences: jest.fn(),
            calculatePromptHash: jest.fn(),
        };

        const mockLogger = {
            log: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                {
                    provide: PROMPT_EXTERNAL_REFERENCE_MANAGER_SERVICE_TOKEN,
                    useClass: PromptExternalReferenceManagerService,
                },
                {
                    provide: PROMPT_EXTERNAL_REFERENCE_REPOSITORY_TOKEN,
                    useValue: mockRepository,
                },
                {
                    provide: PROMPT_CONTEXT_ENGINE_SERVICE_TOKEN,
                    useValue: mockContextEngine,
                },
                {
                    provide: PinoLoggerService,
                    useValue: mockLogger,
                },
            ],
        }).compile();

        service = module.get<IPromptExternalReferenceManagerService>(
            PROMPT_EXTERNAL_REFERENCE_MANAGER_SERVICE_TOKEN,
        );
    });

    describe('Pattern 1: @file[:\s]', () => {
        it('should detect @file: format', () => {
            const result = service['hasLikelyExternalReferences'](
                'Follow @file:README.md',
            );
            expect(result).toBe(true);
        });

        it('should detect @file with space', () => {
            const result = service['hasLikelyExternalReferences'](
                'Check @file CONTRIBUTING.md',
            );
            expect(result).toBe(true);
        });

        it('should detect @FILE (case insensitive)', () => {
            const result = service['hasLikelyExternalReferences'](
                'Use @FILE:config.yml',
            );
            expect(result).toBe(true);
        });

        it('should NOT detect @filename without separator', () => {
            const result = service['hasLikelyExternalReferences'](
                '@filename is important',
            );
            expect(result).toBe(false);
        });
    });

    describe('Pattern 2: [[file:', () => {
        it('should detect [[file:path]] format', () => {
            const result = service['hasLikelyExternalReferences'](
                'Use [[file:config.yml]] for settings',
            );
            expect(result).toBe(true);
        });

        it('should detect [[FILE: (case insensitive)', () => {
            const result = service['hasLikelyExternalReferences'](
                'See [[FILE:docs/README.md]]',
            );
            expect(result).toBe(true);
        });

        it('should detect single brackets (caught by pattern 9)', () => {
            const result = service['hasLikelyExternalReferences'](
                'Use [file:config.yml]',
            );
            expect(result).toBe(true);
        });

        it('should detect [[files: (caught by pattern 9)', () => {
            const result = service['hasLikelyExternalReferences'](
                '[[files:config.yml]]',
            );
            expect(result).toBe(true);
        });
    });

    describe('Pattern 3: @filename.ext', () => {
        it('should detect @README.md', () => {
            const result = service['hasLikelyExternalReferences'](
                'Follow @README.md guidelines',
            );
            expect(result).toBe(true);
        });

        it('should detect @setup.py', () => {
            const result = service['hasLikelyExternalReferences'](
                'Check @setup.py configuration',
            );
            expect(result).toBe(true);
        });

        it('should detect @config.json', () => {
            const result = service['hasLikelyExternalReferences'](
                'Use @config.json settings',
            );
            expect(result).toBe(true);
        });

        it('should detect @index.ts', () => {
            const result = service['hasLikelyExternalReferences'](
                'See @index.ts for implementation',
            );
            expect(result).toBe(true);
        });

        it('should NOT detect @config without extension', () => {
            const result = service['hasLikelyExternalReferences'](
                '@config without extension',
            );
            expect(result).toBe(false);
        });

        it('should detect filename without @ (caught by pattern 8: CAPS)', () => {
            const result = service['hasLikelyExternalReferences'](
                'README.md is important',
            );
            expect(result).toBe(true);
        });

        it('should NOT detect unsupported extension', () => {
            const result =
                service['hasLikelyExternalReferences']('Use @file.exe');
            expect(result).toBe(false);
        });
    });

    describe('Pattern 4: refer to.*.(ext)', () => {
        it('should detect "refer to CONTRIBUTING.md"', () => {
            const result = service['hasLikelyExternalReferences'](
                'Refer to CONTRIBUTING.md',
            );
            expect(result).toBe(true);
        });

        it('should detect "refer to ... file"', () => {
            const result = service['hasLikelyExternalReferences'](
                'Please refer to the setup.py file',
            );
            expect(result).toBe(true);
        });

        it('should detect with path', () => {
            const result = service['hasLikelyExternalReferences'](
                'Refer to our docs/guide.md for details',
            );
            expect(result).toBe(true);
        });

        it('should NOT detect without file extension', () => {
            const result = service['hasLikelyExternalReferences'](
                'Refer to the documentation',
            );
            expect(result).toBe(false);
        });

        it('should detect "Reference setup.md" (caught by pattern 9)', () => {
            const result =
                service['hasLikelyExternalReferences']('Reference setup.md');
            expect(result).toBe(true);
        });
    });

    describe('Pattern 5: check.*.(ext)', () => {
        it('should detect "check README.md"', () => {
            const result = service['hasLikelyExternalReferences'](
                'Check README.md for setup',
            );
            expect(result).toBe(true);
        });

        it('should detect "check the ... file"', () => {
            const result = service['hasLikelyExternalReferences'](
                'Please check the config.yml file',
            );
            expect(result).toBe(true);
        });

        it('should detect with path', () => {
            const result = service['hasLikelyExternalReferences'](
                'Check our docs/GUIDE.md',
            );
            expect(result).toBe(true);
        });

        it('should NOT detect without file', () => {
            const result = service['hasLikelyExternalReferences'](
                'Check the configuration',
            );
            expect(result).toBe(false);
        });

        it('should detect "Checkout setup.md" (caught by pattern 9)', () => {
            const result =
                service['hasLikelyExternalReferences']('Checkout setup.md');
            expect(result).toBe(true);
        });
    });

    describe('Pattern 6: see.*.(ext)', () => {
        it('should detect "see CONTRIBUTING.md"', () => {
            const result = service['hasLikelyExternalReferences'](
                'See CONTRIBUTING.md',
            );
            expect(result).toBe(true);
        });

        it('should detect with path', () => {
            const result = service['hasLikelyExternalReferences'](
                'See the docs/setup.py for details',
            );
            expect(result).toBe(true);
        });

        it('should detect "please see"', () => {
            const result = service['hasLikelyExternalReferences'](
                'Please see config.json',
            );
            expect(result).toBe(true);
        });

        it('should NOT detect without file', () => {
            const result = service['hasLikelyExternalReferences'](
                'See the documentation',
            );
            expect(result).toBe(false);
        });

        it('should detect "Seed setup.md" (caught by pattern 9)', () => {
            const result =
                service['hasLikelyExternalReferences']('Seed setup.md');
            expect(result).toBe(true);
        });
    });

    describe('Pattern 7: \\w+\\.\\w+\\.(ext) - Files with paths', () => {
        it('should detect src.config.ts', () => {
            const result = service['hasLikelyExternalReferences'](
                'Use src.config.ts settings',
            );
            expect(result).toBe(true);
        });

        it('should detect utils.helpers.js', () => {
            const result = service['hasLikelyExternalReferences'](
                'Check utils.helpers.js',
            );
            expect(result).toBe(true);
        });

        it('should detect docs.api.md', () => {
            const result =
                service['hasLikelyExternalReferences']('Follow docs.api.md');
            expect(result).toBe(true);
        });

        it('should detect single dot files (caught by pattern 9)', () => {
            const result =
                service['hasLikelyExternalReferences']('Use config.ts');
            expect(result).toBe(true);
        });
    });

    describe('Pattern 8: [A-Z_][A-Z0-9_]*\\.(ext) - CAPS files', () => {
        it('should detect README.md', () => {
            const result =
                service['hasLikelyExternalReferences']('Follow README.md');
            expect(result).toBe(true);
        });

        it('should detect CONTRIBUTING.md', () => {
            const result = service['hasLikelyExternalReferences'](
                'Check CONTRIBUTING.md',
            );
            expect(result).toBe(true);
        });

        it('should detect CONFIG_PROD.yml', () => {
            const result = service['hasLikelyExternalReferences'](
                'Use CONFIG_PROD.yml',
            );
            expect(result).toBe(true);
        });

        it('should detect CHANGELOG.md', () => {
            const result =
                service['hasLikelyExternalReferences']('See CHANGELOG.md');
            expect(result).toBe(true);
        });

        it('should detect lowercase (caught by pattern 9)', () => {
            const result =
                service['hasLikelyExternalReferences']('check readme.md');
            expect(result).toBe(true);
        });

        it('should NOT detect files starting with lowercase', () => {
            const result =
                service['hasLikelyExternalReferences']('Use setup.py');
            expect(result).toBe(false);
        });
    });

    describe('Pattern 9: Common config files', () => {
        it('should detect readme.md (lowercase)', () => {
            const result =
                service['hasLikelyExternalReferences']('Follow readme.md');
            expect(result).toBe(true);
        });

        it('should detect package.json', () => {
            const result = service['hasLikelyExternalReferences'](
                'Check package.json settings',
            );
            expect(result).toBe(true);
        });

        it('should detect tsconfig.json', () => {
            const result = service['hasLikelyExternalReferences'](
                'Use tsconfig.json configuration',
            );
            expect(result).toBe(true);
        });

        it('should detect jest.config.ts', () => {
            const result =
                service['hasLikelyExternalReferences']('See jest.config.ts');
            expect(result).toBe(true);
        });

        it('should detect contributing.md', () => {
            const result = service['hasLikelyExternalReferences'](
                'Follow contributing.md guidelines',
            );
            expect(result).toBe(true);
        });

        it('should detect webpack.config.js', () => {
            const result = service['hasLikelyExternalReferences'](
                'Check webpack.config.js',
            );
            expect(result).toBe(true);
        });

        it('should detect vite.config.ts', () => {
            const result =
                service['hasLikelyExternalReferences']('Use vite.config.ts');
            expect(result).toBe(true);
        });

        it('should detect setup.yml', () => {
            const result =
                service['hasLikelyExternalReferences']('Follow setup.yml');
            expect(result).toBe(true);
        });

        it('should detect config.yaml', () => {
            const result =
                service['hasLikelyExternalReferences']('Use config.yaml');
            expect(result).toBe(true);
        });

        it('should NOT detect non-listed files', () => {
            const result =
                service['hasLikelyExternalReferences']('Use myfile.md');
            expect(result).toBe(false);
        });

        it('should NOT detect non-listed extensions', () => {
            const result =
                service['hasLikelyExternalReferences']('Use package.xml');
            expect(result).toBe(false);
        });
    });

    describe('Edge cases and combined scenarios', () => {
        it('should detect multiple references in same text', () => {
            const result = service['hasLikelyExternalReferences'](
                'Follow @file:README.md and check package.json',
            );
            expect(result).toBe(true);
        });

        it('should handle empty string', () => {
            const result = service['hasLikelyExternalReferences']('');
            expect(result).toBe(false);
        });

        it('should handle text without any references', () => {
            const result = service['hasLikelyExternalReferences'](
                'Fix all bugs and improve performance',
            );
            expect(result).toBe(false);
        });

        it('should handle text with only partial patterns', () => {
            const result = service['hasLikelyExternalReferences'](
                'The configuration is important',
            );
            expect(result).toBe(false);
        });

        it('should handle multiline text with references', () => {
            const result = service['hasLikelyExternalReferences'](
                'Follow these steps:\n1. Check README.md\n2. Fix bugs',
            );
            expect(result).toBe(true);
        });

        it('should handle text with URLs (should not match)', () => {
            const result = service['hasLikelyExternalReferences'](
                'Visit https://github.com/repo',
            );
            expect(result).toBe(false);
        });
    });

    describe('Deletion logic when references are removed', () => {
        it('should delete existing record when user removes external references', async () => {
            const mockRepository = {
                findByConfigKey: jest.fn().mockResolvedValue({
                    uuid: 'existing-uuid',
                    configKey: 'org:repo',
                    sourceType: 'custom_instruction',
                    promptHash: 'old-hash',
                    references: [{ filePath: 'README.md' }],
                }),
                delete: jest.fn().mockResolvedValue(true),
                upsert: jest.fn(),
            };

            const mockContextEngine = {
                calculatePromptHash: jest.fn().mockReturnValue('new-hash'),
            };

            const mockLogger = {
                log: jest.fn(),
                warn: jest.fn(),
                error: jest.fn(),
            };

            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    {
                        provide:
                            PROMPT_EXTERNAL_REFERENCE_MANAGER_SERVICE_TOKEN,
                        useClass: PromptExternalReferenceManagerService,
                    },
                    {
                        provide: PROMPT_EXTERNAL_REFERENCE_REPOSITORY_TOKEN,
                        useValue: mockRepository,
                    },
                    {
                        provide: PROMPT_CONTEXT_ENGINE_SERVICE_TOKEN,
                        useValue: mockContextEngine,
                    },
                    {
                        provide: PinoLoggerService,
                        useValue: mockLogger,
                    },
                ],
            }).compile();

            const testService =
                module.get<IPromptExternalReferenceManagerService>(
                    PROMPT_EXTERNAL_REFERENCE_MANAGER_SERVICE_TOKEN,
                );

            const result = await testService.createOrUpdatePendingReference({
                promptText: 'Fix all bugs',
                configKey: 'org:repo',
                sourceType: 'custom_instruction' as any,
                organizationId: 'org-123',
                repositoryId: 'repo-456',
                repositoryName: 'test-repo',
            });

            expect(result).toBeNull();
            expect(mockRepository.findByConfigKey).toHaveBeenCalledWith(
                'org:repo',
                'custom_instruction',
            );
            expect(mockRepository.delete).toHaveBeenCalledWith('existing-uuid');
            expect(mockLogger.log).toHaveBeenCalledWith(
                expect.objectContaining({
                    message:
                        'No external references pattern detected, deleted existing record',
                }),
            );
        });

        it('should return null when no references and no existing record', async () => {
            const mockRepository = {
                findByConfigKey: jest.fn().mockResolvedValue(null),
                delete: jest.fn(),
                upsert: jest.fn(),
            };

            const mockContextEngine = {
                calculatePromptHash: jest.fn(),
            };

            const mockLogger = {
                log: jest.fn(),
                warn: jest.fn(),
                error: jest.fn(),
            };

            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    {
                        provide:
                            PROMPT_EXTERNAL_REFERENCE_MANAGER_SERVICE_TOKEN,
                        useClass: PromptExternalReferenceManagerService,
                    },
                    {
                        provide: PROMPT_EXTERNAL_REFERENCE_REPOSITORY_TOKEN,
                        useValue: mockRepository,
                    },
                    {
                        provide: PROMPT_CONTEXT_ENGINE_SERVICE_TOKEN,
                        useValue: mockContextEngine,
                    },
                    {
                        provide: PinoLoggerService,
                        useValue: mockLogger,
                    },
                ],
            }).compile();

            const testService =
                module.get<IPromptExternalReferenceManagerService>(
                    PROMPT_EXTERNAL_REFERENCE_MANAGER_SERVICE_TOKEN,
                );

            const result = await testService.createOrUpdatePendingReference({
                promptText: 'Fix all bugs',
                configKey: 'org:repo',
                sourceType: 'custom_instruction' as any,
                organizationId: 'org-123',
                repositoryId: 'repo-456',
                repositoryName: 'test-repo',
            });

            expect(result).toBeNull();
            expect(mockRepository.delete).not.toHaveBeenCalled();
        });
    });

    describe('Real-world prompt examples', () => {
        it('should detect: "Follow coding standards from @file:CONTRIBUTING.md"', () => {
            const result = service['hasLikelyExternalReferences'](
                'Follow coding standards from @file:CONTRIBUTING.md',
            );
            expect(result).toBe(true);
        });

        it('should detect: "Use the configuration in package.json"', () => {
            const result = service['hasLikelyExternalReferences'](
                'Use the configuration in package.json',
            );
            expect(result).toBe(true);
        });

        it('should detect: "Refer to docs/API.md for details"', () => {
            const result = service['hasLikelyExternalReferences'](
                'Refer to docs/API.md for details',
            );
            expect(result).toBe(true);
        });

        it('should NOT detect: "Fix all bugs in the codebase"', () => {
            const result = service['hasLikelyExternalReferences'](
                'Fix all bugs in the codebase',
            );
            expect(result).toBe(false);
        });

        it('should NOT detect: "Improve code quality and performance"', () => {
            const result = service['hasLikelyExternalReferences'](
                'Improve code quality and performance',
            );
            expect(result).toBe(false);
        });

        it('should NOT detect: "Follow best practices for security"', () => {
            const result = service['hasLikelyExternalReferences'](
                'Follow best practices for security',
            );
            expect(result).toBe(false);
        });

        it('should detect: "Check CHANGELOG.md for recent changes"', () => {
            const result = service['hasLikelyExternalReferences'](
                'Check CHANGELOG.md for recent changes',
            );
            expect(result).toBe(true);
        });

        it('should detect: "See [[file:docs/setup.md]] for installation"', () => {
            const result = service['hasLikelyExternalReferences'](
                'See [[file:docs/setup.md]] for installation',
            );
            expect(result).toBe(true);
        });
    });
});
