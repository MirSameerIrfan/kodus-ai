export type VirtualEntryType = 'file' | 'directory';

export interface VirtualEntry {
    name: string;
    type: VirtualEntryType;
    path: string;
    children?: VirtualEntry[];
    metadata?: Record<string, unknown>;
    content?: string;
}

export interface VirtualFileSystemOptions {
    pathSeparator?: string;
}

function normalizePath(path: string, sep: string): string {
    const raw = path.replace(/\\/g, sep).replace(/\s+/g, ' ');
    const parts = raw
        .split(sep)
        .map((part) => part.trim())
        .filter(Boolean);
    return parts.join(sep);
}

export class VirtualFileSystem {
    private readonly sep: string;
    private readonly root: VirtualEntry = {
        name: '',
        path: '',
        type: 'directory',
        children: [],
    };

    constructor(
        files: Record<string, string>,
        options: VirtualFileSystemOptions = {},
    ) {
        this.sep = options.pathSeparator ?? '/';
        this.load(files);
    }

    private load(files: Record<string, string>): void {
        for (const [path, content] of Object.entries(files)) {
            this.addFile(path, content);
        }
    }

    private addFile(path: string, content: string): void {
        const normalized = normalizePath(path, this.sep);
        if (!normalized) {
            return;
        }

        const segments = normalized.split(this.sep);
        let current: VirtualEntry = this.root;

        for (let i = 0; i < segments.length; i += 1) {
            const segment = segments[i]!;
            const isLeaf = i === segments.length - 1;

            if (!current.children) {
                current.children = [];
            }

            let child = current.children.find(
                (entry) => entry.name === segment,
            );

            if (!child) {
                child = {
                    name: segment,
                    path: current.path
                        ? `${current.path}${this.sep}${segment}`
                        : segment,
                    type: isLeaf ? 'file' : 'directory',
                    children: isLeaf ? undefined : [],
                };
                current.children.push(child);
            }

            const ensuredChild = child;

            if (isLeaf) {
                ensuredChild.type = 'file';
                ensuredChild.content = content;
            } else {
                ensuredChild.type = 'directory';
                if (!ensuredChild.children) {
                    ensuredChild.children = [];
                }
                current = ensuredChild;
            }
        }
    }

    list(path = ''): VirtualEntry[] {
        const node = this.resolveNode(path);
        if (!node || node.type !== 'directory') {
            return [];
        }
        return [...(node.children ?? [])].sort((a, b) =>
            a.name.localeCompare(b.name),
        );
    }

    readFile(path: string): string | undefined {
        const node = this.resolveNode(path);
        if (!node || node.type !== 'file') {
            return undefined;
        }
        return node.content;
    }

    toTree(): VirtualEntry {
        return this.root;
    }

    private resolveNode(path: string): VirtualEntry | undefined {
        const normalized = normalizePath(path, this.sep);
        if (!normalized) {
            return this.root;
        }

        const segments = normalized.split(this.sep);
        let current: VirtualEntry | undefined = this.root;

        for (const segment of segments) {
            if (!current || current.type !== 'directory' || !current.children) {
                return undefined;
            }
            current = current.children.find((entry) => entry.name === segment);
        }

        return current;
    }
}
