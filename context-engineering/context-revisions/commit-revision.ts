import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    createRevisionEntry,
    type ContextRequirement,
    type ContextRevisionLogEntry,
    type ContextRevisionScope,
} from '../../src/shared/utils/context-os-core/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOG_PATH = path.resolve(__dirname, 'revision-log.json');

interface CliOptions {
    input: string;
    scope: string;
    entityType: string;
    entityId: string;
    originKind?: string;
    originId?: string;
    originName?: string;
    originContact?: string;
    parent?: string;
    revisionId?: string;
}

function parseArgs(): CliOptions {
    const args = process.argv.slice(2);
    const options: Record<string, string> = {};

    for (let i = 0; i < args.length; i += 1) {
        const arg = args[i];
        if (!arg.startsWith('--')) {
            // eslint-disable-next-line no-console
            console.warn(`Ignorando argumento desconhecido: ${arg}`);
            continue;
        }
        const key = arg.slice(2);
        const value = args[i + 1];
        if (!value || value.startsWith('--')) {
            options[key] = 'true';
        } else {
            options[key] = value;
            i += 1;
        }
    }

    if (!options.input) {
        throw new Error('Flag --input é obrigatória');
    }
    if (!options.scope) {
        throw new Error('Flag --scope é obrigatória');
    }
    if (!options['entity-type']) {
        throw new Error('Flag --entity-type é obrigatória');
    }
    if (!options['entity-id']) {
        throw new Error('Flag --entity-id é obrigatória');
    }

    return {
        input: options.input,
        scope: options.scope,
        entityType: options['entity-type'],
        entityId: options['entity-id'],
        originKind: options['origin-kind'],
        originId: options['origin-id'],
        originName: options['origin-name'],
        originContact: options['origin-contact'],
        parent: options.parent,
        revisionId: options.revision,
    };
}

function parseScope(raw: string): ContextRevisionScope {
    if (raw === 'global') {
        return { level: 'global' };
    }

    if (raw.startsWith('repository:')) {
        const [, repositoryId] = raw.split(':');
        return {
            level: 'repository',
            identifiers: { repositoryId },
            path: [{ level: 'repository', id: repositoryId }],
        };
    }

    if (raw.startsWith('directory:')) {
        const [, repositoryId, directoryId] = raw.split(':');
        return {
            level: 'directory',
            identifiers: { repositoryId, directoryId },
            path: [
                { level: 'repository', id: repositoryId },
                { level: 'directory', id: directoryId },
            ],
        };
    }

    if (raw.startsWith('prompt:')) {
        const [, repositoryId, promptId, directoryId] = raw.split(':');
        return {
            level: 'prompt',
            identifiers: {
                repositoryId,
                promptId,
                ...(directoryId ? { directoryId } : {}),
            },
            path: [
                { level: 'repository', id: repositoryId },
                ...(directoryId
                    ? [{ level: 'directory', id: directoryId }]
                    : []),
                { level: 'prompt', id: promptId },
            ],
        };
    }

    return { level: raw };
}

async function readRequirements(filePath: string): Promise<ContextRequirement[]> {
    const absolute = path.isAbsolute(filePath)
        ? filePath
        : path.resolve(process.cwd(), filePath);
    const content = await readFile(absolute, 'utf-8');
    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed)) {
        throw new Error('Arquivo de requirements deve conter uma array JSON');
    }
    return parsed as ContextRequirement[];
}

async function loadRevisionLog(): Promise<ContextRevisionLogEntry[]> {
    try {
        const content = await readFile(LOG_PATH, 'utf-8');
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
            return parsed as ContextRevisionLogEntry[];
        }
        if (parsed && Array.isArray(parsed.revisions)) {
            return parsed.revisions as ContextRevisionLogEntry[];
        }
        return [];
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            return [];
        }
        throw error;
    }
}

async function persistRevisionLog(entries: ContextRevisionLogEntry[]): Promise<void> {
    const dir = path.dirname(LOG_PATH);
    await mkdir(dir, { recursive: true });
    const payload = JSON.stringify({ revisions: entries }, null, 2);
    await writeFile(LOG_PATH, payload, 'utf-8');
}

function generateRevisionId(): string {
    const iso = new Date().toISOString();
    const sanitized = iso
        .replace(/[-:]/g, '')
        .replace('.', '')
        .replace('Z', 'Z');
    return `rev_${sanitized}`;
}

async function main(): Promise<void> {
    const options = parseArgs();
    const scope = parseScope(options.scope);
    const requirements = await readRequirements(options.input);
    const revisionId = options.revisionId ?? generateRevisionId();
    const originKind = options.originKind ?? 'manual';
    const originId = options.originId ?? process.env.USER ?? 'unknown';

    const entry = createRevisionEntry({
        revisionId,
        parentRevisionId: options.parent,
        scope,
        entityType: options.entityType,
        entityId: options.entityId,
        origin: {
            kind: originKind,
            id: originId,
            name: options.originName,
            contact: options.originContact,
        },
        requirements,
        payload: { requirements },
    });

    const log = await loadRevisionLog();
    log.push(entry);
    await persistRevisionLog(log);

    // eslint-disable-next-line no-console
    const count = entry.requirements?.length ?? 0;
    console.log(
        `Revisão ${entry.revisionId} registrada (${count} requirements).`,
    );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    main().catch((error) => {
        // eslint-disable-next-line no-console
        console.error('Falha ao registrar revisão:', error);
        process.exitCode = 1;
    });
}
