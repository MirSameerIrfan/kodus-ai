/**
 * Context Engineering Interfaces
 *
 * Este módulo define contratos agnósticos para ingestão, seleção,
 * compactação e entrega de contexto para LLMs. Ele pode ser usado como
 * base para implementar um “context OS” independente de domínio.
 */

export type ContextDomain =
    | 'code'
    | 'support'
    | 'finance'
    | 'legal'
    | 'hr'
    | 'operations'
    | string;

export type SensitivityLevel = 'none' | 'low' | 'medium' | 'high';
export type ConfidentialityLevel = 'public' | 'internal' | 'restricted';

export interface SourceRef {
    type: string;
    location: string;
    accessor?: string;
    metadata?: Record<string, unknown>;
}

export type LineageAction =
    | 'created'
    | 'updated'
    | 'compacted'
    | 'expired'
    | 'approved'
    | 'rollback';

export interface LineageRecord {
    timestamp: number;
    actor: 'ingestion' | 'human' | 'automation';
    action: LineageAction;
    notes?: string;
    metadata?: Record<string, unknown>;
}

export interface KnowledgeItem {
    id: string;
    domain: ContextDomain;
    source: SourceRef;
    payload: {
        text?: string;
        structured?: unknown;
        attachments?: string[];
    };
    modality?: 'text' | 'code' | 'table' | 'image' | 'event' | string;
    metadata: {
        version: string;
        title?: string;
        tags?: string[];
        piiLevel?: SensitivityLevel;
        confidentiality: ConfidentialityLevel;
        ttlMs?: number;
        createdAt: number;
        updatedAt: number;
        lineage: LineageRecord[];
        ownerId?: string;
        checksum?: string;
    };
}

export type ConnectorCapability =
    | 'poll'
    | 'webhook'
    | 'search'
    | 'snapshot'
    | 'metadata';

export interface RawChange<TMeta = unknown> {
    ref: SourceRef;
    changeType: 'added' | 'modified' | 'removed';
    metadata?: TMeta;
    cursor?: string | number;
}

export interface RawAsset {
    ref: SourceRef;
    content: ArrayBuffer | string | Record<string, unknown>;
    contentType?: string;
    metadata?: Record<string, unknown>;
}

export interface Connector<TMeta = unknown> {
    id: string;
    capabilities: ConnectorCapability[];
    schema?: unknown;
    listChanges(params: Record<string, unknown>): AsyncIterable<RawChange<TMeta>>;
    fetchItem(ref: SourceRef): Promise<RawAsset>;
    close?(): Promise<void>;
}

export interface ValidationIssue {
    level: 'info' | 'warning' | 'error';
    message: string;
    itemId?: string;
}

export interface ValidationReport {
    issues: ValidationIssue[];
    isValid: boolean;
}

export interface IngestionPipeline {
    normalize(change: RawChange): Promise<KnowledgeItem[]>;
    validate(items: KnowledgeItem[]): Promise<ValidationReport>;
    persist(items: KnowledgeItem[]): Promise<void>;
}

export interface SignalPacket {
    userMessage?: string;
    conversationId?: string;
    metadata?: Record<string, unknown>;
}

export interface RetrievalQuery {
    domain: ContextDomain;
    taskIntent: string;
    signal: SignalPacket;
    constraints?: {
        maxTokens?: number;
        since?: number;
        includeDomains?: ContextDomain[];
        excludeSources?: string[];
        confidentiality?: ConfidentialityLevel;
    };
    hints?: Record<string, unknown>;
}

export interface ContentSlice {
    range?: [number, number];
    summary?: string;
    weight: number;
    metadata?: Record<string, unknown>;
}

export interface Candidate {
    item: KnowledgeItem;
    score: number;
    rationale?: string;
    slices?: ContentSlice[];
    metadata?: Record<string, unknown>;
}

export interface RetrievalResult {
    candidates: Candidate[];
    durationMs?: number;
    diagnostics?: Record<string, unknown>;
}

export interface Indexer {
    upsert(items: KnowledgeItem[]): Promise<void>;
    delete(itemIds: string[]): Promise<void>;
    query(request: RetrievalQuery): Promise<RetrievalResult>;
}

export type LayerResidence = 'resident' | 'on_demand' | 'cached';

export type ContextLayerKind =
    | 'core'
    | 'catalog'
    | 'active'
    | 'instructions'
    | 'facts'
    | 'history'
    | 'entities'
    | 'tools'
    | 'metadata'
    | string;

export interface TokenBudget {
    limit: number;
    usage: number;
    breakdown: Record<string, number>;
}

export interface ContextLayer {
    id?: string;
    kind: ContextLayerKind;
    priority: number;
    tokens: number;
    residence?: LayerResidence;
    content: unknown;
    references: Array<{ itemId: string; sliceId?: string }>;
    metadata?: Record<string, unknown>;
}

export interface ContextResourceRef {
    id: string;
    type: 'file' | 'script' | 'template' | 'binary' | string;
    location: string;
    description?: string;
    metadata?: Record<string, unknown>;
}

export type ContextActionType =
    | 'mcp'
    | 'workflow'
    | 'internal'
    | 'http'
    | string;

export type ContextActionTrigger =
    | 'pre_core'
    | 'pre_delivery'
    | 'post_delivery'
    | 'async'
    | 'background';

export interface ContextActionDescriptor {
    id: string;
    type: ContextActionType;
    trigger: ContextActionTrigger;
    instruction?: string;
    metadata?: Record<string, unknown>;
    config?: Record<string, unknown>;
    mcpId?: string;
    toolName?: string;
    workflowId?: string;
    callable?: string;
    endpoint?: string;
}

export interface ContextPack {
    id: string;
    domain: ContextDomain;
    version: string;
    createdAt: number;
    createdBy: string;
    budget: TokenBudget;
    layers: ContextLayer[];
    provenance?: LineageRecord[];
    constraints?: RetrievalQuery['constraints'];
    resources?: ContextResourceRef[];
    requiredActions?: ContextActionDescriptor[];
    requiredTools?: MCPToolReference[];
    metadata?: Record<string, unknown>;
}

export interface ContextPackBuilder {
    buildPack(input: {
        query: RetrievalQuery;
        candidates: Candidate[];
        existingContext?: RuntimeContextSnapshot;
    }): Promise<ContextPack>;
}

export interface StructuredContent {
    type: string;
    data: unknown;
}

export interface SessionMessage {
    id: string;
    role: 'user' | 'assistant' | 'tool' | 'system';
    content: string | StructuredContent;
    timestamp: number;
    metadata?: Record<string, unknown>;
}

export interface ExecutionState {
    phase: 'planning' | 'execution' | 'responded' | 'error' | 'idle';
    lastUserIntent?: string;
    pendingActions?: string[];
    currentStepId?: string;
    iterationCount?: number;
    totalIterations?: number;
    metadata?: Record<string, unknown>;
}

export interface Entity {
    id: string;
    type: string;
    displayName?: string;
    lastUsed?: number;
    metadata?: Record<string, unknown>;
}

export interface RuntimeContextSnapshot {
    sessionId: string;
    threadId: string;
    tenantId: string;
    createdAt: number;
    updatedAt: number;
    state: ExecutionState;
    messages: SessionMessage[];
    knowledgeRefs: Array<{ packId: string; layer: ContextLayerKind; itemRefs: string[] }>;
    entities: Record<string, Entity[]>;
    metadata?: Record<string, unknown>;
}

export interface SessionInit {
    tenantId: string;
    userId?: string;
    threadId?: string;
    initialState?: Partial<ExecutionState>;
    metadata?: Record<string, unknown>;
}

export interface ContextUpdatePatch {
    state?: Partial<ExecutionState>;
    messagesAppend?: SessionMessage[];
    messagesUpdate?: Array<{
        id: string;
        content?: SessionMessage['content'];
        metadata?: Record<string, unknown>;
    }>;
    resourcesFetch?: ContextResourceRef[];
    entitiesUpsert?: Record<string, Entity[]>;
    knowledgeRefsAppend?: RuntimeContextSnapshot['knowledgeRefs'];
    metadata?: Record<string, unknown>;
}

export interface RuntimeContextStore {
    initSession(params: SessionInit): Promise<RuntimeContextSnapshot>;
    getSession(sessionId: string): Promise<RuntimeContextSnapshot>;
    updateSession(sessionId: string, update: ContextUpdatePatch): Promise<void>;
    archiveSession(sessionId: string): Promise<void>;
}

export interface ToolSchema {
    name: string;
    description?: string;
    inputSchema: unknown;
    outputSchema?: unknown;
    examples?: Array<Record<string, unknown>>;
    metadata?: Record<string, unknown>;
}

export interface ToolDescriptor {
    id: string;
    description: string;
    schema: ToolSchema;
    metadata?: Record<string, unknown>;
}

export interface ContextActionExecutionResult {
    success: boolean;
    output?: unknown;
    resources?: ContextResourceRef[];
    layerPatches?: Partial<Record<ContextLayerKind, unknown>>;
    telemetry?: Record<string, unknown>;
}

export interface ContextActionExecutionContext {
    action: ContextActionDescriptor;
    pack: ContextPack;
    context: LayerInputContext;
    runtime?: RuntimeContextSnapshot;
}

export interface ContextActionExecutor {
    supports(action: ContextActionDescriptor): boolean;
    execute(
        params: ContextActionExecutionContext,
    ): Promise<ContextActionExecutionResult>;
}

/**
 * ---------------------------------------------------------------------------
 * MCP (Model Context Protocol) integration
 * ---------------------------------------------------------------------------
 */

export interface MCPToolReference {
    mcpId: string;
    toolName: string;
    description?: string;
    schema?: ToolSchema;
    metadata?: Record<string, unknown>;
    lastValidatedAt?: number;
}

export type MCPStatus = 'available' | 'degraded' | 'unavailable';

export interface MCPRegistration {
    id: string;
    title?: string;
    endpoint: string;
    description?: string;
    status: MCPStatus;
    authConfig?: {
        type: 'api_key' | 'oauth2' | 'jwt' | 'custom';
        secretId?: string;
        metadata?: Record<string, unknown>;
    };
    tools: MCPToolReference[];
    lastHeartbeatAt?: number;
    metadata?: Record<string, unknown>;
}

export interface MCPInvocationRequest {
    registry: MCPRegistration;
    tool: MCPToolReference;
    input: Record<string, unknown>;
    runtimeMetadata?: Record<string, unknown>;
}

export interface MCPInvocationResult {
    success: boolean;
    output?: Record<string, unknown> | string | null;
    error?: {
        code?: string;
        message: string;
        details?: Record<string, unknown>;
    };
    latencyMs: number;
    metadata?: Record<string, unknown>;
}

export interface MCPClient {
    invoke(request: MCPInvocationRequest): Promise<MCPInvocationResult>;
    healthCheck?(mcpId: string): Promise<MCPStatus>;
}

export interface AgentIdentity {
    name: string;
    description?: string;
    role?: string;
    policies?: string[];
    language?: string;
    constraints?: string[];
    metadata?: Record<string, unknown>;
}

export interface DeliveryRequest {
    userIntent: string;
    agentIdentity: AgentIdentity;
    toolset: ToolDescriptor[];
    format?: 'chat' | 'json' | 'xml' | 'custom';
    maxTokens?: number;
    metadata?: Record<string, unknown>;
}

export interface DeliveryPayload {
    systemMessage: string;
    userMessage: string;
    toolSchemas?: ToolSchema[];
    attachments?: Array<{ type: string; data: unknown }>;
    onDemandResources?: ContextResourceRef[];
    diagnostics?: Record<string, unknown>;
}

export interface DeliveryAdapter<TOutput = unknown> {
    buildPayload(
        pack: ContextPack,
        runtime: RuntimeContextSnapshot,
        request: DeliveryRequest,
    ): DeliveryPayload;
    deliver(payload: DeliveryPayload): Promise<TOutput>;
}

export interface ContextEvent {
    type:
        | 'SELECTION'
        | 'DELIVERY'
        | 'UPDATE'
        | 'ERROR'
        | 'ACTION_STARTED'
        | 'ACTION_COMPLETED'
        | 'ACTION_FAILED';
    sessionId: string;
    packId?: string;
    tenantId: string;
    userId?: string;
    budget?: TokenBudget;
    groundednessScore?: number;
    tokensUsed?: number;
    latencyMs?: number;
    metadata?: Record<string, unknown>;
    timestamp: number;
}

export interface DriftAlert {
    domain: ContextDomain;
    severity: 'low' | 'medium' | 'high';
    description: string;
    detectedAt: number;
    recommendedAction?: string;
    metadata?: Record<string, unknown>;
}

export interface ContextMetrics {
    usageByDomain: Record<ContextDomain, number>;
    avgTokensPerLayer: Record<ContextLayerKind, number>;
    groundedness: { mean: number; p95: number };
    driftAlerts: DriftAlert[];
    metadata?: Record<string, unknown>;
}

export interface ContextTelemetry {
    record(event: ContextEvent): Promise<void>;
    report(params?: Record<string, unknown>): Promise<ContextMetrics>;
}

/**
 * ---------------------------------------------------------------------------
 * Tri-layer / Pack assembly helpers
 * ---------------------------------------------------------------------------
 */

export interface LayerInputContext {
    domain: ContextDomain;
    taskIntent: string;
    retrieval: RetrievalResult;
    runtimeContext?: RuntimeContextSnapshot;
    deliveryRequest?: DeliveryRequest;
    metadata?: Record<string, unknown>;
}

export interface LayerBuildOptions {
    maxTokens?: number;
    priority?: number;
    residence?: LayerResidence;
    includeDiagnostics?: boolean;
}

export interface LayerBuildDiagnostics {
    tokensBefore?: number;
    tokensAfter?: number;
    compactionStrategy?: string;
    notes?: string;
}

export interface LayerBuildResult {
    layer: ContextLayer;
    resources?: ContextResourceRef[];
    diagnostics?: LayerBuildDiagnostics;
}

export interface ContextLayerBuilder {
    stage: Extract<ContextLayerKind, 'core' | 'catalog' | 'active'>;
    build(
        input: LayerInputContext,
        options?: LayerBuildOptions,
    ): Promise<LayerBuildResult>;
}

export interface PackAssemblyStep {
    builder: ContextLayerBuilder;
    description?: string;
}

export interface PackAssemblyPipeline {
    steps: PackAssemblyStep[];
    execute(
        input: LayerInputContext,
        options?: LayerBuildOptions,
    ): Promise<{
        pack: ContextPack;
        resources: ContextResourceRef[];
        diagnostics?: Record<string, unknown>;
    }>;
}

/**
 * ---------------------------------------------------------------------------
 * Domain bundles (snapshot + builders + delivery)
 * ---------------------------------------------------------------------------
 */

export type PromptRole = 'system' | 'user' | 'assistant' | 'tool' | string;

export type PromptScope =
    | 'core'
    | 'catalog'
    | 'active'
    | 'fallback'
    | 'meta'
    | string;

export interface PromptOverride {
    id: string;
    role: PromptRole;
    scope: PromptScope;
    content: string;
    metadata?: Record<string, unknown>;
    requiredActions?: ContextActionDescriptor[];
    requiredTools?: MCPToolReference[];
}

export interface DomainSnapshot<TConfig = Record<string, unknown>> {
    id: string;
    domain: ContextDomain;
    version: string;
    createdAt: number;
    config: TConfig;
    promptOverrides?: PromptOverride[];
    actions?: ContextActionDescriptor[];
    resources?: ContextResourceRef[];
    metadata?: Record<string, unknown>;
}

export interface DomainBundleBuilders {
    core: ContextLayerBuilder;
    catalog?: ContextLayerBuilder;
    active?: ContextLayerBuilder;
    extras?: ContextLayerBuilder[];
}

export interface DomainBundleComponents<TDelivery = unknown> {
    builders: DomainBundleBuilders;
    pipeline: PackAssemblyPipeline;
    packBuilder: ContextPackBuilder;
    actions?: ContextActionDescriptor[];
    requiredTools?: MCPToolReference[];
    deliveryAdapter?: DeliveryAdapter<TDelivery>;
    metadata?: Record<string, unknown>;
}

export interface DomainBundle<
    TSnapshot extends DomainSnapshot = DomainSnapshot,
    TDelivery = unknown,
> {
    id: string;
    domain: ContextDomain;
    version: string;
    snapshot: TSnapshot;
    components: DomainBundleComponents<TDelivery>;
    metadata?: Record<string, unknown>;
}
