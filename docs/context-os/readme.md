# Kodus Context OS

This folder reúne as notas de arquitetura e o **core agnóstico** exportado via
`@context-os-core`. O objetivo é permitir que qualquer domínio (code
review, suporte, bot de manicure, central de conhecimento etc.) construa packs
tri-layer, execute ações (MCP/workflows) e monitore telemetria de forma
padronizada.

## Pacotes

```
src/
└─ shared/utils/context-os-core/  # primitives agnósticas reutilizáveis
    interfaces/                   # ContextPack, builders, ações
    builders/                     # Core/Catalog/Active layer helpers
    pipeline/                     # SequentialPackAssemblyPipeline
    mcp/                          # Registry + Orchestrator + Sanitizer
    utils/                        # Token budgeting utilitário
    index.ts                      # exports públicos

packages/
└─ context-engineering/examples/context-os-core/  # exemplos de uso (code review, manicure, knowledge)
```

## Como usar o core

1. No monorepo, importe via alias `@context-os-core` (arquivos em
   `src/shared/utils/context-os-core`). Caso precise publicar separado, gere um
   pacote a partir desse diretório.
2. Construa um **snapshot** do domínio (metaprompt, categorias, contexto
   externo). Exemplo completo em `context-engineering/examples/context-os-core/code-review-basic.ts`.
3. Crie um **bundle** com os builders necessários:
   - `CoreLayerBuilder` para instruções/persona/políticas.
   - `CatalogLayerBuilder` para sumários e entidades.
   - `ActiveLayerBuilder` para snippets, diffs, logs.
4. Use o `SequentialPackAssemblyPipeline` ou o helper `TriLayerPackBuilder` para
   gerar o `ContextPack`.
5. Execute as ações obrigatórias (MCP ou internas) com o `MCPOrchestrator` ou um
   executor custom de ações (`ContextActionExecutor`).
6. Converta o pack em prompts/mensagens (delivery adapter próprio) e envie para
   o LLM/serviço desejado.

## Exemplos prontos

Dentro de `context-engineering/examples/context-os-core/` há três cenários práticos:

- **tri-layer-example.ts** – demonstração completa com MCP, telemetria console e
  pipeline tri-layer.
- **code-review-basic.ts** – core/catalog/active customizados para revisão de
  código (sem dependências externas).
- **manicure-assistant.ts** – agente de agendamento em salão de beleza usando o
  mesmo pipeline.
- **knowledge-hub.ts** – central de conhecimento corporativa que cita fontes e
  traz snippets relevantes.

Para executar qualquer exemplo dentro do monorepo:

```bash
cd context-engineering/examples/context-os-core
node --loader ts-node/esm code-review-basic.ts
```

> Observação: os exemplos retornam as camadas montadas. Cabe à aplicação
> converter o `ContextPack` resultante em prompts ou mensagens específicas.

## Fluxo típico

1. **Snapshot** – converte overrides e referências externas do domínio em um
   objeto rico (metaprompt, severidades, contextos adicionais). Esse passo fica
   fora do core e depende da sua aplicação.
2. **Bundle** – instância os builders com o snapshot. Aqui você decide
   compaction strategy, heurísticas de seleção, actions obrigatórias.
3. **Pipeline** – `SequentialPackAssemblyPipeline` executa core → catalog →
   active e calcula orçamento.
4. **Actions** – `MCPOrchestrator` (ou executores custom) roda ferramentas e
   injeta resultados (snippets, `ContextResourceRef`).
5. **Delivery** – converta o pack em prompts/mensagens (ex.: `renderSystemPrompt`).
6. **Telemetria** – use `ContextTelemetry` para registrar `SELECTION`,
   `ACTION_*`, `DELIVERY`, etc.

## DomainBundle, herança de configs e MCP

Com a introdução dos tipos `DomainSnapshot` e `DomainBundle` (`src/shared/utils/context-os-core/interfaces.ts`), o fluxo fica formalizado em três camadas:

1. **Snapshot** – documento persistido (Mongo/SQL/JSON) com:
   - `config`: dados brutos do domínio (ex.: `v2PromptOverrides`, políticas, TTL).
   - `promptOverrides`: entradas estruturadas (&ldquo;quem&rdquo; fala, em qual `scope`, texto) e, opcionalmente, `requiredTools` + `requiredActions`.
   - `actions`: descritores adicionais que valem para todo o domínio (workflows internos, triggers de MCP, etc.).
2. **Bundle** – instancia builders/materializers com base no snapshot e injeta:
   - `pipeline` (`SequentialPackAssemblyPipeline`) + `TriLayerPackBuilder`.
   - Unificação de ações/required tools (dedupe por `id` e `mcpId::toolName`).
   - `deliveryAdapter` opcional já alinhado com o meta prompt.
  - Exemplo completo em `context-engineering/examples/context-os-core/code-review-bundle.ts`.
3. **Runtime** – pack produzido passa pelo `MCPOrchestrator` e pelo `DeliveryAdapter`.

### Como salvar a escolha de MCP para um prompt

Quando o usuário troca o prompt de bug no front-end e seleciona a tool `mcp X`, basta persistir algo como:

```json
{
  "id": "global",
  "domain": "code",
  "version": "2025.01",
  "config": {
    "v2PromptOverrides": { "...": "..." }
  },
  "promptOverrides": [
    {
      "id": "bug-review-system",
      "role": "system",
      "scope": "core",
      "content": "You are Kody Bug-Hunter...",
      "requiredTools": [
        { "mcpId": "bugspec", "toolName": "fetch-bugspec" }
      ],
      "requiredActions": [
        {
          "id": "load-bugspec",
          "type": "mcp",
          "trigger": "pre_delivery",
          "mcpId": "bugspec",
          "toolName": "fetch-bugspec",
          "metadata": { "attachLayer": "catalog" }
        }
      ]
    }
  ],
  "actions": [
    {
      "id": "load-pr-metadata",
      "type": "mcp",
      "trigger": "pre_core",
      "mcpId": "repo-insights",
      "toolName": "pull-pr-metadata"
    }
  ]
}
```

Esse JSON pode continuar obedecendo o esquema de herança atual (global → repositório → diretório). O `SnapshotLoader` resolve os merges e entrega um `DomainSnapshot` pronto para o bundle.

### Triggers e execução

- `pre_core`: roda antes de construir camadas, útil para popular metadados do bundle.
- `pre_delivery`: garante que recursos do MCP estejam no pack antes de enviar ao LLM.
- `post_delivery`: registra telemetria ou workflows assíncronos.

O `MCPOrchestrator` (ver `src/shared/utils/context-os-core/mcp/orchestrator.ts`) percorre `pack.requiredTools`; o bundle se encarrega de sincronizar `promptOverrides.requiredTools` + `actions` com esse campo, evitando múltiplas execuções da mesma tool.

## Serviços auxiliares

O core não inclui tarefas pesadas (ex.: resolução de referências externas,
indexação semântica). Esses serviços podem continuar existindo como processos à
parte; basta alimentar o snapshot/bundle com os resultados (ex.: arquivos
resolvidos, embeddings, grafos).

## Próximos passos sugeridos

- Definir a interface comum de **DomainBundle** (snapshot loader + materializers
  + delivery adapter) e publicar exemplos mais ricos.
- Implementar executores adicionais (`workflow`, `internal`) reutilizando o
  mesmo contrato de `ContextActionDescriptor`.
- Acoplar `ContextTelemetry` às ferramentas de observabilidade que vocês já
  usam (Prometheus, Elastic, etc.).

Com esse desenho, o `@kodus/flow` continua agnóstico e qualquer equipe consegue
aproveitar o mesmo conjunto de primitivos para construir o seu Context OS.
