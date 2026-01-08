
export enum SupportedLanguage {
    TYPESCRIPT = 'typescript',
    JAVASCRIPT = 'javascript',
    PYTHON = 'python',
    JAVA = 'java',
    GO = 'go',
    RUBY = 'ruby',
    PHP = 'php',
    CSHARP = 'csharp',
    RUST = 'rust',
}

export type LanguageConfig = {
    name: SupportedLanguage;
    extensions: string[];
};

export const SUPPORTED_LANGUAGES: Record<SupportedLanguage, LanguageConfig> = {
    typescript: {
        name: SupportedLanguage.TYPESCRIPT,
        extensions: ['.ts', '.tsx'],
    },
    javascript: {
        name: SupportedLanguage.JAVASCRIPT,
        extensions: ['.js', '.jsx'],
    },
    python: {
        name: SupportedLanguage.PYTHON,
        extensions: ['.py'],
    },
    java: {
        name: SupportedLanguage.JAVA,
        extensions: ['.java'],
    },
    go: {
        name: SupportedLanguage.GO,
        extensions: ['.go'],
    },
    ruby: {
        name: SupportedLanguage.RUBY,
        extensions: ['.rb'],
    },
    php: {
        name: SupportedLanguage.PHP,
        extensions: ['.php'],
    },
    csharp: {
        name: SupportedLanguage.CSHARP,
        extensions: ['.cs'],
    },
    rust: {
        name: SupportedLanguage.RUST,
        extensions: ['.rs'],
    },
};

export interface ASTValidateCodeItem {
    id: string;
    encodedData: string;
    language?: string;
    filePath: string;
    diff?: string;
}

export interface ASTValidateCodeRequest {
    files: ASTValidateCodeItem[];
}

export enum ASTValidationStatus {
    VALID = 'VALID',
    INVALID_SYNTAX = 'INVALID_SYNTAX',
    UNSUPPORTED_LANGUAGE = 'UNSUPPORTED_LANGUAGE',
    ERROR = 'ERROR',
}

export interface ASTValidateCodeResult {
    id: string;
    isValid: boolean;
    status: ASTValidationStatus;
    error?: string;
    filePath?: string;
}

export interface ASTValidateCodeResponse {
    results: ASTValidateCodeResult[];
}
