# Context Requirements – Esquema Hierárquico

Cada perfil/configuração (global → repositório → diretório → prompt específico)
pode declarar **requirements** que informam ao Context‑OS quando precisa montar
um pack antes de executar prompts, workflows, actions ou ferramentas.

## Estrutura Base (interfaces do SDK)

```ts
type ContextConsumerKind = 'prompt' | 'workflow' | 'action' | 'tool' | 'agent' | string;

interface ContextConsumerRef {
  id: string;
  kind: ContextConsumerKind;
  name?: string;
  metadata?: Record<string, unknown>;
}

interface ContextRequirement {
  id: string;
  consumer: ContextConsumerRef;
  request: RetrievalQuery;          // domain/taskIntent/constraints/hints
  packProfileId?: string;           // opcional: pipeline ou preset específico
  requiredLayerKinds?: ContextLayerKind[];
  dependencies?: ContextDependency[];
  optional?: boolean;
  metadata?: Record<string, unknown>;
  version?: string;
  revisionId?: string;
  parentRevisionId?: string;
  createdBy?: string;
  createdAt?: number;
  updatedBy?: string;
  updatedAt?: number;
  message?: string;
  status?: 'active' | 'deprecated' | 'draft';
}

interface ContextDependency {
  type: 'tool' | 'workflow' | 'prompt' | 'action' | 'knowledge' | string;
  id: string;
  metadata?: Record<string, unknown>;
}
```

## Pointer no JSON de Configuração

O JSONB original continua enxuto: em vez de armazenar a lista completa, cada
nível armazena somente um ponteiro (`contextReferenceId`) e opcionalmente o hash
da revisão aplicada. Exemplo no objeto `global`:

```json
{
  "id": "global",
  "name": "Global",
  "configs": {
    "summary": { "behaviourForExistingDescription": "concatenate" },
    "reviewOptions": { "potential_issues": true },
    "contextReferenceId": "rev_20250310T150000Z",
    "contextRequirementsHash": "f8af263c91c5cfb6564f5cb1f046f33e737f0a68a653..."
  },
  "repositories": [...]
}
```

Nos níveis inferiores (repositório, diretório, prompt específico) seguimos o
mesmo padrão. O loader lê os ponteiros em cascata (global → repo → diretório →
arquivo) e resolve as revisões a partir da tabela dedicada.

## Uso no Front-end

1. No editor de prompt/ação/workflow, exiba um toggle “Precisa de contexto”.
2. Ao ativar, o formulário popula os campos do `ContextRequirement` (consumer,
   query, camadas, dependencies etc.).
3. Na hora de salvar, o front envia essa lista para a API de commit, que gera
   a revisão e devolve `revisionId`/`hash`. O front então persiste apenas os
  ponteiros (`contextReferenceId`, `contextRequirementsHash`) no JSON de
   configuração.

### Entity Type / ID e Scope

- `entityType`: classifica o item versionado (`prompt`, `prompt_section`,
  `workflow`, `knowledge`, etc.).
- `entityId`: identificador único daquele item (ex.: `code-review-v2`,
  `code-review-v2#generation.main`).
- `scope`: estrutura agnóstica com `level` (nome amigável do nível) e
  `identifiers` opcionais (`{ level: 'global' }`,
  `{ level: 'tenant', identifiers: { tenantId: 'acme' } }`, etc.).

## Tabela de Revisões (`context_revisions`)

Cada commit gera um registro que guarda o payload completo dos requirements e o
histórico (estilo git). Modelo sugerido (TypeORM):

```ts
@Entity({ name: 'context_revisions' })
class ContextRevisionEntity {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  revisionId: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  parentRevisionId?: string;

  @Column({ type: 'jsonb' })
  scope: ContextRevisionScope;            // { level: 'global' } etc.

  @Column({ type: 'varchar', length: 128 })
  entityType: string;

  @Column({ type: 'varchar', length: 256 })
  entityId: string;

  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>;       // ex.: { requirements: [...] }

  @Column({ type: 'jsonb', nullable: true })
  requirements?: ContextRequirement[];    // opcional: facilita consultas

  @Column({ type: 'jsonb', nullable: true })
  knowledgeRefs?: Array<{ itemId: string; version?: string }>;

  @Column({ type: 'varchar', length: 64, nullable: true })
  payloadHash?: string;

  @Column({ type: 'jsonb', nullable: true })
  origin?: ContextRevisionActor;

  @Column({ type: 'varchar', length: 512, nullable: true })
  message?: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;
}
```

O `payload` pode conter qualquer estrutura (ex.: `{ requirements: [...] }` ou
qualquer outro objeto). Quando houver uma lista de `ContextRequirement`, vale
persistir também no campo dedicado `requirements` para simplificar consultas.
O campo `origin` guarda informações sobre quem/qual sistema gerou aquela revisão.

### Exemplo de Revisão

```json
{
  "revisionId": "rev_20250310T150000Z",
  "parentRevisionId": "rev_20250305T090000Z",
  "scope": { "level": "global" },
  "entityType": "prompt",
  "entityId": "code-review-v2",
  "origin": { "kind": "human", "id": "qa@kodus" },
  "message": "Adicionar contexto generation",
  "createdAt": 1761847520451,
  "payload": {
    "requirements": [
      {
        "id": "review-default",
        "consumer": { "kind": "prompt", "id": "code-review-v2" },
        "request": { "domain": "code", "taskIntent": "review" },
        "dependencies": [
          { "type": "tool", "id": "mcp-bug|bugspec-matcher" }
        ],
        "version": "1.0.1",
        "status": "active"
      },
      {
        "id": "review-generation",
        "consumer": {
          "kind": "prompt_section",
          "id": "code-review-v2#generation.main",
          "name": "Generation Field"
        },
        "request": { "domain": "code", "taskIntent": "review" },
        "dependencies": [
          { "type": "tool", "id": "kodus|kodus_list_commits" }
        ],
        "version": "1.0.0",
        "status": "active",
        "metadata": { "notes": "Contexto para generation" }
      }
    ]
  },
  "requirements": [
    {
      "id": "review-default",
      "consumer": { "kind": "prompt", "id": "code-review-v2" },
      "request": { "domain": "code", "taskIntent": "review" },
      "packProfileId": "code-review-bug",
      "dependencies": [{ "type": "tool", "id": "mcp-bug|bugspec-matcher" }],
      "version": "1.0.1",
      "status": "active"
    },
    {
      "id": "review-generation",
      "consumer": {
        "kind": "prompt_section",
        "id": "code-review-v2#generation.main",
        "name": "Generation Field"
      },
      "request": { "domain": "code", "taskIntent": "review" },
      "dependencies": [{ "type": "tool", "id": "kodus|kodus_list_commits" }],
      "version": "1.0.0",
      "status": "active",
      "metadata": { "notes": "Contexto para generation" }
    }
  ],
  "payloadHash": "057cc88a93066dca919cafbd69c17cb4016a96b6f2516fea75c9c1352642bd83"
}
```

## Uso no Front-end

1. A UI de configuração envia (ou edita) o array de `ContextRequirement` e chama
   a API de commit.
2. O serviço registra a revisão na tabela acima, calcula o hash e atualiza o
  ponteiro `contextReferenceId`/`contextRequirementsHash` no JSONB correspondente.
3. O loader (`CodeBaseConfigService`) lê os ponteiros e carrega as revisões em
   cascata, aplicando `mergeContextRequirements` antes de montar o pack.

O laboratório em `context-revisions/` ajuda a simular commits, history, diff e
rollback antes de implementar o back-end definitivo.

Com isso, qualquer consumer marcado no front terá um contrato unificado para a
orquestração do Context‑OS, reutilizando diretamente o tipo exportado pelo SDK
(`@context-os-core`).***
