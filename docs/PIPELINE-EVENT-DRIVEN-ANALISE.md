# Análise: Pipeline Event-Driven - Tornando Stages Assíncronos

**Data**: 2025-01-27  
**Objetivo**: Entender como tornar pipeline mais event-driven, permitindo paralelismo e não bloqueando esperando serviços externos

---

## 🔍 Problema Atual

### Pipeline Atual (Sequencial, Síncrono)

```
Pipeline.execute(context)
  ↓
Stage 1: ValidateNewCommitsStage (sequencial)
  ↓
Stage 2: ResolveConfigStage (sequencial)
  ↓
Stage 3: ValidateConfigStage (sequencial)
  ↓
Stage 4: FetchChangedFilesStage (sequencial)
  ↓
Stage 5: LoadExternalContextStage (sequencial)
  ↓
Stage 6: FileContextGateStage (sequencial)
  ↓
Stage 7: InitialCommentStage (sequencial)
  ↓
Stage 8: KodyFineTuningStage (sequencial)
  ↓
Stage 9: CodeAnalysisASTStage (sequencial, pode pausar)
  ↓ (espera AST completar - BLOQUEIA)
Stage 10: ProcessFilesPrLevelReviewStage (sequencial, demora muito)
  ↓ (espera LLM - BLOQUEIA)
Stage 11: ProcessFilesReview (sequencial, demora muito)
  ↓ (espera LLM - BLOQUEIA)
Stage 12: CreatePrLevelCommentsStage (sequencial)
  ↓
Stage 13: CreateFileCommentsStage (sequencial)
  ↓
Stage 14: CodeAnalysisASTCleanupStage (sequencial)
  ↓
Stage 15: AggregateResultsStage (sequencial)
  ↓
Stage 16: UpdateCommentsAndGenerateSummaryStage (sequencial)
  ↓
Stage 17: RequestChangesOrApproveStage (sequencial)
```

**Problemas**:

- ❌ Tudo executa sequencialmente (mesmo que possa ser paralelo)
- ❌ Stages que chamam serviços externos bloqueiam worker
- ❌ Worker fica ocupado esperando LLM/AST
- ❌ Não aproveita paralelismo possível

---

## 💡 Solução: Pipeline Event-Driven

### Conceito: Stages como Workflow Jobs

**Ideia**: Cada stage pesado ou que depende de serviço externo pode ser um Workflow Job separado

**Vantagens**:

- ✅ Worker não bloqueia esperando serviços externos
- ✅ Stages podem rodar em paralelo (se não tiverem dependências)
- ✅ Retry granular por stage
- ✅ Pausa/resume por stage
- ✅ Escalabilidade independente

---

## 🏗️ Arquitetura Proposta: Pipeline Híbrido

### Stages Leves (Executam no Worker)

**Características**:

- Rápidos (< 1s)
- Não dependem de serviços externos
- Podem executar sequencialmente no mesmo worker

**Exemplos**:

- `ValidateNewCommitsStage` - Valida commits (query no banco)
- `ResolveConfigStage` - Resolve configuração (query no banco)
- `ValidateConfigStage` - Valida configuração (lógica)
- `FetchChangedFilesStage` - Busca arquivos (API call rápido)
- `AggregateResultsStage` - Agrega resultados (lógica)
- `CreatePrLevelCommentsStage` - Cria comentários (API call)
- `CreateFileCommentsStage` - Cria comentários (API call)

**Execução**: Sequencial no mesmo worker, rápido

---

### Stages Pesados/Externos (Workflow Jobs Separados)

**Características**:

- Demoram muito (> 5s)
- Dependem de serviços externos (LLM, AST)
- Podem falhar e precisar retry
- Podem pausar esperando evento externo

**Exemplos**:

- `CodeAnalysisASTStage` - Análise AST (serviço externo, pode pausar)
- `ProcessFilesPrLevelReviewStage` - Review PR-level (LLM, demora muito)
- `ProcessFilesReview` - Review de arquivos (LLM, demora muito)

**Execução**: Workflow Job separado, event-driven

---

## 🔄 Fluxo Proposto: Pipeline Híbrido

### Fase 1: Stages Leves (Sequencial no Worker)

```
Worker (CODE_REVIEW)
  ↓
Cria AutomationExecution
  ↓
Executa Stages Leves Sequencialmente:
  - ValidateNewCommitsStage
  - ResolveConfigStage
  - ValidateConfigStage
  - FetchChangedFilesStage
  - LoadExternalContextStage
  - FileContextGateStage
  - InitialCommentStage
  ↓
Prepara contexto para stages pesados
```

**Tempo**: 1-5s (rápido, no mesmo worker)

---

### Fase 2: Stages Pesados (Workflow Jobs Separados)

**Opção A: Um Job por Stage Pesado**

```
Worker (CODE_REVIEW)
  ↓
Enfileira AST_ANALYSIS (se necessário)
  ↓
Enfileira PR_LEVEL_REVIEW (se necessário)
  ↓
Enfileira FILES_REVIEW (se necessário)
  ↓
Pausa workflow (WAITING_FOR_EVENT)
```

```
Worker (AST_ANALYSIS)
  ↓
Executa CodeAnalysisASTStage
  ↓
Publica evento: ast.analysis.completed
```

```
Worker (PR_LEVEL_REVIEW)
  ↓
Executa ProcessFilesPrLevelReviewStage
  ↓
Publica evento: pr.review.completed
```

```
Worker (FILES_REVIEW)
  ↓
Executa ProcessFilesReview
  ↓
Publica evento: files.review.completed
```

```
ASTEventHandler / PRReviewEventHandler / FilesReviewEventHandler
  ↓
Recebe evento
  ↓
Retoma workflow (CODE_REVIEW)
  ↓
Continua com stages finais
```

**Vantagens**:

- ✅ Worker não bloqueia
- ✅ Stages pesados podem rodar em paralelo
- ✅ Retry granular por stage
- ✅ Escalabilidade independente

**Desvantagens**:

- ⚠️ Mais complexo (múltiplos jobs)
- ⚠️ Precisa coordenar eventos

---

**Opção B: Um Job para Todos os Stages Pesados**

```
Worker (CODE_REVIEW)
  ↓
Enfileira CODE_REVIEW_HEAVY_STAGES
  ↓
Pausa workflow (WAITING_FOR_EVENT)
```

```
Worker (CODE_REVIEW_HEAVY_STAGES)
  ↓
Executa todos stages pesados sequencialmente:
  - CodeAnalysisASTStage (pode pausar internamente)
  - ProcessFilesPrLevelReviewStage
  - ProcessFilesReview
  ↓
Publica evento: heavy.stages.completed
```

```
HeavyStagesEventHandler
  ↓
Recebe evento
  ↓
Retoma workflow (CODE_REVIEW)
  ↓
Continua com stages finais
```

**Vantagens**:

- ✅ Mais simples (um job extra)
- ✅ Worker não bloqueia durante stages pesados

**Desvantagens**:

- ⚠️ Stages pesados ainda rodam sequencialmente (não paralelo)
- ⚠️ Menos granularidade

---

## 🎯 Pergunta Crítica

**Como você quer estruturar os stages pesados?**

**A)** Cada stage pesado é um Workflow Job separado (AST_ANALYSIS, PR_LEVEL_REVIEW, FILES_REVIEW) - máximo paralelismo, máximo controle granular

**B)** Um Workflow Job para todos stages pesados (CODE_REVIEW_HEAVY_STAGES) - mais simples, menos paralelismo

**C)** Stages pesados executam no mesmo worker mas são event-driven internamente (publicam evento, pausam, esperam resposta) - híbrido

**D)** Pipeline inteiro vira stages event-driven (cada stage é um job) - máximo controle, máxima complexidade

---

## 💭 Minha Recomendação (Como CTO)

**Opção C - Híbrido**: Stages pesados executam no mesmo worker mas são event-driven

**Por quê?**

- ✅ Mantém pipeline como unidade lógica
- ✅ Worker não bloqueia (pausa workflow, espera evento)
- ✅ Não adiciona complexidade de múltiplos jobs
- ✅ Permite retry e pausa/resume por stage pesado
- ✅ Stages leves continuam sequenciais (rápido)

**Como funciona**:

- Stages leves: Sequencial no worker (rápido)
- Stages pesados: Publicam evento, pausam workflow, esperam resposta, retomam
- Worker é liberado durante espera

**Exemplo**:

```
ProcessFilesReview.execute(context)
  ↓
Prepara contexto para LLM
  ↓
Publica evento: llm.review.requested
  ↓
Lança WorkflowPausedError('llm.review.completed', contextId)
  ↓
Workflow pausa (WAITING_FOR_EVENT)
  ↓
Worker é liberado
```

```
LLMService completa análise
  ↓
Publica evento: llm.review.completed
```

```
LLMReviewEventHandler
  ↓
Recebe evento
  ↓
Retoma workflow (CODE_REVIEW)
  ↓
ProcessFilesReview continua com resultado
```

---

## 📚 Referências de Padrões de Mercado

**Ver documento completo**: `docs/PADROES-MERCADO-WORKFLOW-ORCHESTRATION.md`

**Padrões Identificados**:

1. **Temporal (Uber)** - Workflow + Activities Pattern (Uber, Netflix, Coinbase)
2. **AWS Step Functions** - State Machine + Task Token Pattern (Airbnb, Netflix, Capital One)
3. **Camunda/Zeebe** - BPMN Workflow Engine Pattern (Zalando, ING Bank)
4. **Saga Pattern** - Choreography vs Orchestration

**Recomendação**: Padrão Híbrido (Temporal-like) - alinhado com padrões de mercado

---

## 🤔 Sua Opinião?

Qual abordagem faz mais sentido para você?
