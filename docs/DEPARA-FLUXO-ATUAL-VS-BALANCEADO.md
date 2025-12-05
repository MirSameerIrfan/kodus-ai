# Depara: Fluxo Atual vs Arquitetura Balanceada

**Data**: 2025-01-27  
**Objetivo**: Comparar fluxo atual implementado com arquitetura balanceada proposta para identificar discrepâncias, gaps e decisões necessárias

---

## 📊 Visão Geral

### Fluxo Atual (Estado Real do Código)

**Características**:
- Webhook handler enfileira `WEBHOOK_PROCESSING`
- Worker processa `WEBHOOK_PROCESSING` → salva PR → valida → enfileira `CODE_REVIEW`
- Worker processa `CODE_REVIEW` → chama `CodeReviewHandlerService` → executa pipeline atual
- Pipeline atual executa stages sequencialmente (sem pausa/resume, sem persistência de estado)
- `CodeReviewJobProcessor` chama `CodeReviewHandlerService.handlePullRequest()` diretamente

### Arquitetura Balanceada (Proposta)

**Características**:
- Webhook handler enfileira `WEBHOOK_PROCESSING` (igual)
- Worker processa `WEBHOOK_PROCESSING` → salva PR → valida → enfileira `CODE_REVIEW` (igual)
- Worker processa `CODE_REVIEW` → `CodeReviewJobProcessor` cria `AutomationExecution` → chama `PipelineExecutor.execute()`
- `PipelineExecutor` executa stages sequencialmente com persistência de estado
- Stages pesados pausam workflow (WAITING_FOR_EVENT) e retomam via event handler genérico
- Estado do pipeline persistido em `WorkflowJob.pipelineState: JSONB`

---

## 🔍 Depara Detalhado: Etapa por Etapa

### Etapa 1: Recepção do Webhook

| Aspecto | Fluxo Atual | Arquitetura Balanceada | Status |
|---------|-------------|------------------------|--------|
| **Componente** | `apps/webhooks/src/controllers/github.controller.ts` | `apps/webhooks/src/controllers/github.controller.ts` | ✅ Igual |
| **Responsabilidade** | Recebe HTTP, valida signature, enfileira `WEBHOOK_PROCESSING` | Recebe HTTP, valida signature, enfileira `WEBHOOK_PROCESSING` | ✅ Igual |
| **Payload** | Payload bruto + metadata `{platformType, event}` | Payload bruto + metadata `{platformType, event}` | ✅ Igual |
| **Retorno** | 200 OK imediato (não bloqueia) | 200 OK imediato (não bloqueia) | ✅ Igual |

**Conclusão**: ✅ **Sem mudanças necessárias** - Webhook handler já está correto

---

### Etapa 2: Processamento WEBHOOK_PROCESSING

| Aspecto | Fluxo Atual | Arquitetura Balanceada | Status |
|---------|-------------|------------------------|--------|
| **Componente** | `WebhookProcessingJobProcessor` (não existe ainda) | `WebhookProcessingJobProcessor` | ⚠️ Precisa criar |
| **Responsabilidades** | N/A (não implementado) | Salva PR no MongoDB, identifica plataforma, chama handler correto, valida organização/team/licença | ⚠️ Precisa implementar |
| **Salvar PR** | Não está claro onde salva | Worker salva PR antes de validar | ⚠️ Precisa confirmar |
| **Validações** | Não está claro onde valida | Worker valida organização/team/licença antes de enfileirar CODE_REVIEW | ⚠️ Precisa confirmar |
| **Enfileirar CODE_REVIEW** | Não está claro | Se validações passarem, enfileira CODE_REVIEW | ⚠️ Precisa implementar |

**Conclusão**: ⚠️ **Precisa implementar** - `WebhookProcessingJobProcessor` não existe ainda

**Código Atual Relevante**:
- `githubPullRequest.handler.ts` linha 131: `await this.savePullRequestUseCase.execute(params);` - **Salva PR no handler atual**
- `githubPullRequest.handler.ts` linha 175: `this.runCodeReviewAutomationUseCase.execute(params);` - **Executa síncrono (legacy)**

**Decisão Necessária**: 
- ❓ Onde exatamente salvar PR? No `WebhookProcessingJobProcessor` ou no handler específico da plataforma?
- ❓ Como extrair validações de `runCodeReview.use-case.ts` para usar em `WebhookProcessingJobProcessor`?

---

### Etapa 3: Processamento CODE_REVIEW

| Aspecto | Fluxo Atual | Arquitetura Balanceada | Status |
|---------|-------------|------------------------|--------|
| **Componente** | `CodeReviewJobProcessor` | `CodeReviewJobProcessor` | ✅ Existe |
| **Cria AutomationExecution** | Não cria (chama CodeReviewHandlerService que não cria) | Cria AutomationExecution no início | ⚠️ Precisa ajustar |
| **Chama Pipeline** | Chama `CodeReviewHandlerService.handlePullRequest()` | Chama `PipelineExecutor.execute()` diretamente | ⚠️ Precisa refatorar |
| **Integração** | CodeReviewHandlerService → Pipeline atual | CodeReviewJobProcessor → PipelineExecutor → Stages | ⚠️ Precisa refatorar |

**Conclusão**: ⚠️ **Precisa refatorar** - `CodeReviewJobProcessor` atual chama `CodeReviewHandlerService`, mas deveria chamar `PipelineExecutor` diretamente

**Código Atual Relevante**:
- `code-review-job-processor.service.ts` linha 160: `await this.codeReviewHandler.handlePullRequest(...)` - **Chama CodeReviewHandlerService**
- `codeReviewHandlerService.service.ts` linha 139: `await pipeline.execute(initialContext)` - **Executa pipeline atual**

**Decisão Necessária**:
- ❓ Como migrar de `CodeReviewHandlerService.handlePullRequest()` para `PipelineExecutor.execute()`?
- ❓ Onde criar `AutomationExecution`? No `CodeReviewJobProcessor` ou no `PipelineExecutor`?
- ❓ Como manter compatibilidade com código legado durante migração?

---

### Etapa 4: Execução do Pipeline

| Aspecto | Fluxo Atual | Arquitetura Balanceada | Status |
|---------|-------------|------------------------|--------|
| **Componente** | `PipelineExecutor` atual (executa stages sequencialmente) | `PipelineExecutor` novo (com persistência, retry, compensação) | ⚠️ Precisa refatorar |
| **Stages** | Stages atuais (não implementam Stage interface) | Stages implementam Stage ou HeavyStage interface | ⚠️ Precisa migrar |
| **Persistência Estado** | Não persiste estado | Persiste estado após cada stage em `WorkflowJob.pipelineState` | ⚠️ Precisa implementar |
| **Stages Pesados** | Executam síncronamente (bloqueiam worker) | Publicam evento, pausam workflow, retomam quando evento chega | ⚠️ Precisa refatorar |
| **Retry/Compensação** | Não tem retry granular por stage | PipelineExecutor gerencia retry e compensação | ⚠️ Precisa implementar |

**Conclusão**: ⚠️ **Precisa refatorar completamente** - Pipeline atual não tem persistência, stages não implementam interfaces, stages pesados bloqueiam

**Código Atual Relevante**:
- `pipeline-executor.service.ts` - Executa stages sequencialmente sem persistência
- `code-review-pipeline.strategy.ee.ts` - Define stages mas não implementam Stage interface
- Stages em `codeReviewPipeline/stages/` - Não implementam Stage interface

**Decisão Necessária**:
- ❓ Como migrar stages existentes para implementar Stage interface?
- ❓ Quais stages são leves vs pesados?
- ❓ Como implementar persistência de estado sem quebrar código existente?

---

### Etapa 5: Stages Pesados (AST, LLM)

| Aspecto | Fluxo Atual | Arquitetura Balanceada | Status |
|---------|-------------|------------------------|--------|
| **CodeAnalysisASTStage** | Executa síncronamente, espera AST completar | Publica evento, pausa workflow, retoma quando AST completa | ⚠️ Precisa refatorar |
| **ProcessFilesReview** | Executa síncronamente, espera LLM completar | Publica evento, pausa workflow, retoma quando LLM completa | ⚠️ Precisa refatorar |
| **ProcessFilesPrLevelReviewStage** | Executa síncronamente, espera LLM completar | Publica evento, pausa workflow, retoma quando LLM completa | ⚠️ Precisa refatorar |
| **Pausa/Resume** | Não tem | WorkflowPausedError → WAITING_FOR_EVENT → Event handler retoma | ⚠️ Precisa implementar |

**Conclusão**: ⚠️ **Precisa refatorar completamente** - Stages pesados atuais bloqueiam worker, precisam ser event-driven

**Código Atual Relevante**:
- `code-analysis-ast.stage.ts` - Executa AST síncronamente
- `process-files-review.stage.ts` - Executa LLM síncronamente
- `process-files-pr-level-review.stage.ts` - Executa LLM síncronamente

**Decisão Necessária**:
- ❓ Como refatorar stages pesados para implementar HeavyStage interface?
- ❓ Como publicar eventos quando AST/LLM completam?
- ❓ Como implementar event handlers genéricos para retomar workflows?

---

### Etapa 6: Event Handlers para Retomar Workflows

| Aspecto | Fluxo Atual | Arquitetura Balanceada | Status |
|---------|-------------|------------------------|--------|
| **Componente** | Não existe | `HeavyStageEventHandler` genérico | ⚠️ Precisa criar |
| **Responsabilidade** | N/A | Escuta eventos de stages pesados, encontra workflow pausado, retoma pipeline | ⚠️ Precisa implementar |
| **Identificação Stage** | N/A | Evento inclui stageName, handler busca stage pelo nome | ⚠️ Precisa implementar |
| **Retomada** | N/A | Retoma pipeline do último estado salvo, chama stage.resume() | ⚠️ Precisa implementar |

**Conclusão**: ⚠️ **Precisa criar do zero** - Event handlers genéricos não existem

**Decisão Necessária**:
- ❓ Como estruturar eventos de stages pesados completados?
- ❓ Como HeavyStageEventHandler identifica qual workflow retomar?
- ❓ Como retomar pipeline do último estado salvo?

---

### Etapa 7: Persistência de Estado

| Aspecto | Fluxo Atual | Arquitetura Balanceada | Status |
|---------|-------------|------------------------|--------|
| **Componente** | Não existe | `PipelineStateManager` | ⚠️ Precisa criar |
| **Onde Persiste** | N/A | `WorkflowJob.pipelineState: JSONB` | ⚠️ Precisa adicionar campo |
| **Quando Persiste** | N/A | Após cada stage executar | ⚠️ Precisa implementar |
| **Retomada** | N/A | Retoma pipeline do último estado salvo quando workflow é retomado | ⚠️ Precisa implementar |

**Conclusão**: ⚠️ **Precisa criar do zero** - Persistência de estado não existe

**Decisão Necessária**:
- ❓ Como serializar/deserializar contexto do pipeline?
- ❓ O que incluir no estado persistido (contexto completo ou apenas necessário para retomar)?
- ❓ Como garantir que estado persistido não fica desatualizado?

---

## 🎯 Pontos Críticos Identificados

### 1. Integração CodeReviewJobProcessor ↔ PipelineExecutor

**Problema**: `CodeReviewJobProcessor` atual chama `CodeReviewHandlerService.handlePullRequest()`, mas arquitetura balanceada propõe chamar `PipelineExecutor.execute()` diretamente.

**Impacto**: 🔴 **ALTO** - Afeta toda a execução do pipeline

**Decisão Necessária**:
- Refatorar `CodeReviewJobProcessor` para chamar `PipelineExecutor` diretamente
- Extrair criação de `AutomationExecution` de `automationCodeReview.ts` para `CodeReviewJobProcessor`
- Manter `CodeReviewHandlerService` apenas para código legado ou remover?

---

### 2. Migração de Stages para Stage Interface

**Problema**: Stages atuais não implementam `Stage` ou `HeavyStage` interface. Arquitetura balanceada requer que todos stages implementem essas interfaces.

**Impacto**: 🔴 **ALTO** - Afeta todos os stages do pipeline

**Decisão Necessária**:
- Como migrar stages existentes para implementar Stage interface?
- Quais stages são leves vs pesados?
- Como manter compatibilidade durante migração?

---

### 3. Refatoração de Stages Pesados para Event-Driven

**Problema**: Stages pesados atuais (AST, LLM) executam síncronamente e bloqueiam worker. Arquitetura balanceada requer que sejam event-driven.

**Impacto**: 🔴 **ALTO** - Afeta performance e escalabilidade

**Decisão Necessária**:
- Como refatorar `CodeAnalysisASTStage` para implementar HeavyStage?
- Como refatorar `ProcessFilesReview` para implementar HeavyStage?
- Como publicar eventos quando AST/LLM completam?
- Como serviços externos (AST, LLM) publicam eventos?

---

### 4. Implementação de Persistência de Estado

**Problema**: Pipeline atual não persiste estado. Arquitetura balanceada requer persistência após cada stage.

**Impacto**: 🟡 **MÉDIO** - Afeta recuperação de falhas, mas não bloqueia MVP

**Decisão Necessária**:
- Como serializar contexto do pipeline?
- O que incluir no estado persistido?
- Como garantir consistência entre estado persistido e execução real?

---

### 5. Criação de WebhookProcessingJobProcessor

**Problema**: `WebhookProcessingJobProcessor` não existe ainda. Arquitetura balanceada requer este componente.

**Impacto**: 🟡 **MÉDIO** - Componente novo, não afeta código existente

**Decisão Necessária**:
- Como extrair validações de `runCodeReview.use-case.ts`?
- Onde exatamente salvar PR? No `WebhookProcessingJobProcessor` ou no handler da plataforma?
- Como identificar plataforma e chamar handler correto?

---

### 6. Event Handlers Genéricos

**Problema**: Event handlers genéricos para retomar workflows não existem. Arquitetura balanceada requer `HeavyStageEventHandler`.

**Impacto**: 🟡 **MÉDIO** - Componente novo, necessário para stages pesados funcionarem

**Decisão Necessária**:
- Como estruturar eventos de stages pesados completados?
- Como HeavyStageEventHandler identifica qual workflow retomar?
- Como retomar pipeline do último estado salvo?

---

## 📋 Checklist de Validação

### Arquitetura Balanceada Resolve Problemas do Fluxo Atual?

- [ ] ✅ Responsabilidade Única: Stages isolados com responsabilidade única
- [ ] ✅ Fluxo Completo: PipelineExecutor garante execução completa
- [ ] ✅ Testabilidade: Cada stage testável isoladamente + pipeline completo testável
- [ ] ✅ Performance: Stages pesados não bloqueiam worker (event-driven)
- [ ] ✅ Manutenibilidade: Fácil adicionar/remover/reordenar stages

### Pontos que Precisam Ajuste na Arquitetura Balanceada?

- [ ] ⚠️ Integração CodeReviewJobProcessor precisa ser mais clara
- [ ] ⚠️ Migração de stages precisa ser mais detalhada
- [ ] ⚠️ Event handlers genéricos precisam mais detalhes de implementação

### Decisões Pendentes?

- [ ] ❓ Onde exatamente salvar PR? WebhookProcessingJobProcessor ou handler da plataforma?
- [ ] ❓ Como extrair validações de runCodeReview.use-case.ts?
- [ ] ❓ Como migrar CodeReviewJobProcessor para chamar PipelineExecutor diretamente?
- [ ] ❓ Como manter compatibilidade com código legado durante migração?
- [ ] ❓ Como refatorar stages pesados para event-driven?
- [ ] ❓ Como serviços externos (AST, LLM) publicam eventos?

---

## 🔍 Discrepâncias Identificadas

Esta seção lista todas as discrepâncias entre o fluxo atual e a arquitetura balanceada proposta.

### Discrepância 1: Processamento de WEBHOOK_PROCESSING

**Descrição da diferença**: No fluxo atual, jobs `WEBHOOK_PROCESSING` são enfileirados mas não são processados (falta processor). Na arquitetura balanceada, `WebhookProcessingJobProcessor` processa esses jobs.

**Onde responsabilidades diferem**: 
- Fluxo atual: Webhook handler enfileira, mas ninguém processa
- Arquitetura balanceada: WebhookProcessingJobProcessor processa e salva PR

**Onde componentes mudam**: 
- Novo componente necessário: `WebhookProcessingJobProcessor`

**Onde integrações são diferentes**: 
- Fluxo atual: Consumer roteia para CodeReviewJobProcessor (que rejeita WEBHOOK_PROCESSING)
- Arquitetura balanceada: Consumer roteia para WebhookProcessingJobProcessor (que processa WEBHOOK_PROCESSING)

**Onde comportamento esperado diverge**: 
- Fluxo atual: Jobs WEBHOOK_PROCESSING falham com erro
- Arquitetura balanceada: Jobs WEBHOOK_PROCESSING são processados, PR é salvo, validações acontecem, CODE_REVIEW é enfileirado

---

### Discrepância 2: Criação de AutomationExecution

**Descrição da diferença**: No fluxo atual, AutomationExecution não é criado no fluxo assíncrono. Na arquitetura balanceada, CodeReviewJobProcessor cria AutomationExecution no início.

**Onde responsabilidades diferem**: 
- Fluxo atual: Ninguém cria AutomationExecution no fluxo assíncrono
- Arquitetura balanceada: CodeReviewJobProcessor cria AutomationExecution

**Onde componentes mudam**: 
- CodeReviewJobProcessor precisa criar AutomationExecution (atualmente não cria)

**Onde integrações são diferentes**: 
- Fluxo atual: CodeReviewJobProcessor chama CodeReviewHandlerService diretamente
- Arquitetura balanceada: CodeReviewJobProcessor cria AutomationExecution, depois chama PipelineExecutor

**Onde comportamento esperado diverge**: 
- Fluxo atual: Não há timeline do review, não há deduplicação
- Arquitetura balanceada: Timeline completa do review, deduplicação funcionando

---

### Discrepância 3: Persistência de Estado do Pipeline

**Descrição da diferença**: No fluxo atual, pipeline não persiste estado. Na arquitetura balanceada, PipelineExecutor persiste estado após cada stage.

**Onde responsabilidades diferem**: 
- Fluxo atual: Pipeline não persiste estado
- Arquitetura balanceada: PipelineStateManager persiste estado em WorkflowJob.pipelineState

**Onde componentes mudam**: 
- Novo componente necessário: `PipelineStateManager`
- PipelineExecutor precisa integrar com PipelineStateManager

**Onde integrações são diferentes**: 
- Fluxo atual: Pipeline executa stages sequencialmente sem persistência
- Arquitetura balanceada: PipelineExecutor persiste estado após cada stage, pode retomar de onde parou

**Onde comportamento esperado diverge**: 
- Fluxo atual: Se worker crashar, perde contexto e precisa recomeçar do zero
- Arquitetura balanceada: Se worker crashar, pode retomar do último stage executado

---

### Discrepância 4: Stages Pesados Bloqueiam Worker

**Descrição da diferença**: No fluxo atual, stages pesados (AST, LLM) executam síncronamente e bloqueiam worker. Na arquitetura balanceada, stages pesados são event-driven e pausam workflow.

**Onde responsabilidades diferem**: 
- Fluxo atual: Stages pesados executam síncronamente
- Arquitetura balanceada: Stages pesados publicam evento, pausam workflow, retomam quando evento chega

**Onde componentes mudam**: 
- Stages pesados precisam implementar HeavyStage interface
- Novo componente necessário: `HeavyStageEventHandler`

**Onde integrações são diferentes**: 
- Fluxo atual: PipelineExecutor espera stage pesado completar síncronamente
- Arquitetura balanceada: PipelineExecutor pausa workflow quando stage pesado lança WorkflowPausedError, event handler retoma quando evento chega

**Onde comportamento esperado diverge**: 
- Fluxo atual: Worker fica bloqueado esperando AST/LLM completar
- Arquitetura balanceada: Worker é liberado, pode processar outros jobs enquanto espera evento

---

## 🎯 Pontos Críticos

Esta seção lista pontos críticos que precisam decisão antes da implementação.

### Ponto Crítico 1: WebhookProcessingJobProcessor - Extração de Validações

**Descrição**: Como extrair validações de `runCodeReview.use-case.ts` para usar em `WebhookProcessingJobProcessor`?

**Impacto**: ARQUITETURA

**Prioridade**: ALTA

**Pergunta/Questão**: Como estruturar código para reutilizar validações entre fluxo síncrono (legado) e fluxo assíncrono (novo)?

**Opções Consideradas**:
- Opção A: Extrair validações para serviço compartilhado (ex: `CodeReviewValidationService`)
- Opção B: Duplicar validações em WebhookProcessingJobProcessor
- Opção C: Refatorar runCodeReview.use-case.ts para usar serviço compartilhado

**Recomendação**: Opção A - Extrair para serviço compartilhado mantém DRY e facilita manutenção

---

### Ponto Crítico 2: CodeReviewJobProcessor - Migração para PipelineExecutor

**Descrição**: Como migrar CodeReviewJobProcessor para criar AutomationExecution e chamar PipelineExecutor diretamente?

**Impacto**: ARQUITETURA

**Prioridade**: ALTA

**Pergunta/Questão**: Como manter compatibilidade com código legado durante migração?

**Opções Consideradas**:
- Opção A: Migração completa de uma vez (big bang)
- Opção B: Migração gradual com feature flag
- Opção C: Manter ambos (legado e novo) em paralelo durante transição

**Recomendação**: Opção B - Migração gradual com feature flag permite rollback se necessário

---

### Ponto Crítico 3: Migração de Stages para Stage Interface

**Descrição**: Como migrar stages existentes para Stage interface sem quebrar código?

**Impacto**: ARQUITETURA

**Prioridade**: ALTA

**Pergunta/Questão**: Quais stages são leves vs pesados? Como identificar?

**Opções Consideradas**:
- Opção A: Analisar cada stage individualmente (tempo de execução, dependências externas)
- Opção B: Migrar todos para Stage primeiro, depois identificar pesados
- Opção C: Começar pelos pesados (mais críticos)

**Recomendação**: Opção A - Análise individual permite decisão informada por stage

---

### Ponto Crítico 4: Stages Pesados - Refatoração para Event-Driven

**Descrição**: Como refatorar stages pesados para event-driven sem quebrar funcionalidade atual?

**Impacto**: PERFORMANCE

**Prioridade**: ALTA

**Pergunta/Questão**: Como serviços externos (AST, LLM) publicam eventos quando completam?

**Opções Consideradas**:
- Opção A: Serviços externos publicam eventos diretamente no RabbitMQ
- Opção B: Polling periódico para verificar se tarefa completou
- Opção C: Webhook/callback do serviço externo para notificar conclusão

**Recomendação**: Opção C - Webhook/callback é mais eficiente que polling, mas requer mudanças nos serviços externos

---

### Ponto Crítico 5: Persistência - Serialização de Contexto

**Descrição**: Como serializar contexto do pipeline para JSONB?

**Impacto**: DADOS

**Prioridade**: MÉDIA

**Pergunta/Questão**: O que incluir no estado persistido? Contexto completo ou apenas necessário para retomar?

**Opções Consideradas**:
- Opção A: Persistir contexto completo (mais simples, mais espaço)
- Opção B: Persistir apenas dados necessários para retomar (mais complexo, menos espaço)
- Opção C: Híbrido - contexto completo mas com compressão

**Recomendação**: Opção A inicialmente - Simplicidade primeiro, otimizar depois se necessário

---

### Ponto Crítico 6: Event Handlers - Estrutura Genérica

**Descrição**: Como estruturar eventos e handlers genéricos para retomar workflows?

**Impacto**: INTEGRAÇÃO

**Prioridade**: MÉDIA

**Pergunta/Questão**: Como HeavyStageEventHandler identifica qual workflow retomar?

**Opções Consideradas**:
- Opção A: Evento inclui workflowJobId diretamente
- Opção B: Evento inclui eventType + eventKey, handler busca workflow por query
- Opção C: Mapeamento explícito de eventos para workflows

**Recomendação**: Opção B - Mais flexível, permite múltiplos workflows esperando mesmo evento

---

## 🔧 Código Legado para Refatoração

Esta seção documenta código legado que precisa ser refatorado para arquitetura balanceada.

### Item 1: CodeReviewJobProcessor

**Arquivo(s)**: `src/core/infrastructure/adapters/services/workflowQueue/code-review-job-processor.service.ts`

**Descrição**: Processor atual não cria AutomationExecution e chama CodeReviewHandlerService diretamente. Precisa ser refatorado para criar AutomationExecution e chamar PipelineExecutor.

**Tipo de ajuste**: Refatorar

**Impacto estimado**: ALTO - Afeta toda execução de code review

---

### Item 2: PipelineExecutor Atual

**Arquivo(s)**: `src/core/infrastructure/adapters/services/pipeline/pipeline-executor.service.ts`

**Descrição**: PipelineExecutor atual não persiste estado e não gerencia retry/compensação. Precisa ser refatorado para integrar com PipelineStateManager e gerenciar retry/compensação.

**Tipo de ajuste**: Refatorar

**Impacto estimado**: ALTO - Afeta toda execução de pipeline

---

### Item 3: Stages do Pipeline

**Arquivo(s)**: 
- `src/core/infrastructure/adapters/services/codeBase/codeReviewPipeline/stages/process-files-review.stage.ts`
- `src/core/infrastructure/adapters/services/codeBase/codeReviewPipeline/stages/process-files-pr-level-review.stage.ts`
- `src/core/infrastructure/adapters/services/codeBase/codeReviewPipeline/stages/code-analysis-ast.stage.ts`
- (outros stages)

**Descrição**: Stages não implementam Stage interface. Stages pesados executam síncronamente e bloqueiam worker. Precisa migrar todos para Stage interface e stages pesados para HeavyStage interface.

**Tipo de ajuste**: Migrar

**Impacto estimado**: ALTO - Afeta todos os stages do pipeline

---

### Item 4: CodeReviewHandlerService

**Arquivo(s)**: `src/core/infrastructure/adapters/services/codeBase/codeReviewHandlerService.service.ts`

**Descrição**: Handler atual cria contexto e executa pipeline diretamente. Na arquitetura balanceada, PipelineExecutor será chamado por CodeReviewJobProcessor. Este handler pode ser mantido para código legado ou removido se migração completa.

**Tipo de ajuste**: Ajustar ou remover

**Impacto estimado**: MÉDIO - Pode ser mantido para compatibilidade durante migração

---

### Item 5: runCodeReview.use-case.ts

**Arquivo(s)**: `src/core/application/use-cases/automation/runCodeReview.use-case.ts` (se existir)

**Descrição**: Use case atual contém validações que precisam ser extraídas para reutilização em WebhookProcessingJobProcessor. Validações devem ser extraídas para serviço compartilhado.

**Tipo de ajuste**: Refatorar (extrair validações)

**Impacto estimado**: MÉDIO - Afeta fluxo síncrono legado e novo fluxo assíncrono

---

## ✅ Validação da Arquitetura Balanceada

Esta seção valida que a arquitetura balanceada resolve todos os problemas do fluxo atual.

### Responsabilidades Únicas ✅

**Evidência**: 
- Cada stage implementa Stage interface com responsabilidade única clara
- PipelineExecutor orquestra mas não executa lógica de negócio
- CodeReviewJobProcessor gerencia workflow job, não executa pipeline

**Conclusão**: ✅ Arquitetura balanceada atende responsabilidades únicas

---

### Fluxo Completo ✅

**Evidência**: 
- PipelineExecutor garante execução completa do pipeline
- Se stage falhar, PipelineExecutor gerencia retry e compensação
- Estado persistido permite retomar de onde parou

**Conclusão**: ✅ Arquitetura balanceada garante fluxo completo

---

### Testabilidade ✅

**Evidência**: 
- Cada stage é testável isoladamente (implementa Stage interface)
- PipelineExecutor é testável independentemente dos stages
- Event handlers são testáveis independentemente

**Conclusão**: ✅ Arquitetura balanceada melhora testabilidade significativamente

---

### Performance ✅

**Evidência**: 
- Stages pesados não bloqueiam worker (event-driven)
- Worker pode processar outros jobs enquanto espera eventos
- Persistência de estado permite retomar sem perder trabalho

**Conclusão**: ✅ Arquitetura balanceada melhora performance significativamente

---

### Manutenibilidade ✅

**Evidência**: 
- Fácil adicionar novos stages (implementar Stage interface)
- Fácil remover stages (remover do pipeline strategy)
- Fácil reordenar stages (ajustar ordem no pipeline strategy)
- Código organizado com responsabilidades claras

**Conclusão**: ✅ Arquitetura balanceada melhora manutenibilidade significativamente

---

## 🔗 Integrações para Atualização

Esta seção mapeia integrações existentes que precisam ser atualizadas.

### Integração 1: RabbitMQ - Roteamento de Jobs

**Componente que integra**: `WorkflowJobConsumer`

**Serviço/Componente integrado**: RabbitMQ (fila `workflow.jobs.queue`)

**Tipo de ajuste necessário**: 
- Consumer precisa rotear jobs para processor correto baseado em workflowType
- Atualmente sempre roteia para CodeReviewJobProcessor
- Precisa rotear WEBHOOK_PROCESSING para WebhookProcessingJobProcessor

**Impacto estimado**: MÉDIO - Afeta roteamento de todos os jobs

---

### Integração 2: PostgreSQL - Persistência de Estado

**Componente que integra**: `PipelineStateManager`

**Serviço/Componente integrado**: PostgreSQL (tabela `workflow_jobs`, campo `pipelineState: JSONB`)

**Tipo de ajuste necessário**: 
- Adicionar campo `pipelineState: JSONB` em `WorkflowJob`
- Criar migration para adicionar campo
- PipelineStateManager salva/retoma estado neste campo

**Impacto estimado**: BAIXO - Adiciona campo novo, não quebra existente

---

### Integração 3: RabbitMQ - Eventos de Stages Pesados

**Componente que integra**: `HeavyStageEventHandler`

**Serviço/Componente integrado**: RabbitMQ (exchange para eventos de stages pesados)

**Tipo de ajuste necessário**: 
- Criar exchange/topics para eventos de stages pesados completados
- HeavyStageEventHandler consome eventos e retoma workflows
- Stages pesados publicam eventos quando completam

**Impacto estimado**: MÉDIO - Nova integração, não afeta existente

---

### Integração 4: MongoDB - Salvamento de PR

**Componente que integra**: `WebhookProcessingJobProcessor`

**Serviço/Componente integrado**: MongoDB (collection de pull requests)

**Tipo de ajuste necessário**: 
- WebhookProcessingJobProcessor salva PR no MongoDB antes de validar
- Reutilizar `SavePullRequestUseCase` existente
- Garantir que PR seja salvo mesmo se validações falharem depois

**Impacto estimado**: BAIXO - Reutiliza código existente

---

### Integração 5: Serviços Externos - AST e LLM

**Componente que integra**: Stages pesados (CodeAnalysisASTStage, ProcessFilesReview, etc.)

**Serviço/Componente integrado**: Serviços externos de AST e LLM

**Tipo de ajuste necessário**: 
- Serviços externos precisam publicar eventos quando tarefas completam
- Alternativamente, implementar polling ou webhook/callback
- Stages pesados precisam publicar evento e pausar workflow

**Impacto estimado**: ALTO - Requer mudanças em serviços externos ou implementação de polling/webhook

---

## 🚨 Problemas Identificados

Esta seção documenta cada problema identificado no fluxo atual com formato padronizado.

### Problema 1: Falta Processor para WEBHOOK_PROCESSING

**Descrição**: Jobs `WEBHOOK_PROCESSING` são enfileirados pelo webhook handler mas não são processados porque não existe processor específico. Consumer roteia sempre para CodeReviewJobProcessor que rejeita WEBHOOK_PROCESSING.

**Impacto**: ALTO

**Evidência do código**: 
- Arquivo: `src/core/infrastructure/adapters/services/workflowQueue/code-review-job-processor.service.ts`
- Linha: 39-42
- Código: `if (job.workflowType !== WorkflowType.CODE_REVIEW) { throw new Error(...); }`

**Localização exata**: 
- Consumer: `workflow-job-consumer.service.ts` sempre injeta `CodeReviewJobProcessorService`
- Processor: `code-review-job-processor.service.ts` valida tipo e lança erro se não for CODE_REVIEW

**Comportamento atual**: Jobs WEBHOOK_PROCESSING falham com erro "Job is not a CODE_REVIEW workflow"

**Comportamento esperado**: Jobs WEBHOOK_PROCESSING devem ser processados por WebhookProcessingJobProcessor que salva PR, valida, e enfileira CODE_REVIEW

---

### Problema 2: CodeReviewJobProcessor não cria AutomationExecution

**Descrição**: No fluxo assíncrono atual, AutomationExecution não é criado. Isso significa que não há timeline do review e não há deduplicação funcionando.

**Impacto**: ALTO

**Evidência do código**: 
- Arquivo: `src/core/infrastructure/adapters/services/workflowQueue/code-review-job-processor.service.ts`
- Linha: 160-175
- Código: Chama `codeReviewHandler.handlePullRequest()` diretamente sem criar AutomationExecution

**Localização exata**: 
- CodeReviewJobProcessor não cria AutomationExecution antes de chamar CodeReviewHandlerService
- CodeReviewHandlerService também não cria AutomationExecution

**Comportamento atual**: AutomationExecution não é criado, não há timeline, não há deduplicação

**Comportamento esperado**: CodeReviewJobProcessor deve criar AutomationExecution no início do processamento usando correlationId como uuid

---

### Problema 3: Pipeline não persiste estado

**Descrição**: Pipeline atual não persiste estado após cada stage. Se worker crashar, perde contexto e precisa recomeçar do zero.

**Impacto**: MÉDIO

**Evidência do código**: 
- Arquivo: `src/core/infrastructure/adapters/services/pipeline/pipeline-executor.service.ts`
- Linha: Executa stages sequencialmente sem persistência

**Localização exata**: 
- PipelineExecutor executa stages mas não salva estado
- Não há PipelineStateManager integrado

**Comportamento atual**: Se worker crashar durante pipeline, perde contexto e precisa recomeçar

**Comportamento esperado**: PipelineExecutor deve persistir estado após cada stage em WorkflowJob.pipelineState, permitindo retomar de onde parou

---

### Problema 4: Stages pesados bloqueiam worker

**Descrição**: Stages pesados (AST, LLM) executam síncronamente e bloqueiam worker enquanto esperam serviços externos completarem.

**Impacto**: ALTO

**Evidência do código**: 
- Arquivos: 
  - `code-analysis-ast.stage.ts`
  - `process-files-review.stage.ts`
  - `process-files-pr-level-review.stage.ts`
- Código: Stages executam síncronamente, esperam serviços externos completarem

**Localização exata**: 
- Stages pesados executam `await service.complete()` ou similar, bloqueando worker

**Comportamento atual**: Worker fica bloqueado esperando AST/LLM completar, não pode processar outros jobs

**Comportamento esperado**: Stages pesados devem publicar evento, pausar workflow (WAITING_FOR_EVENT), liberar worker, e retomar quando evento chegar

---

### Problema 5: Stages não implementam Stage interface

**Descrição**: Stages atuais não implementam Stage interface, não há responsabilidade única clara, e não há estrutura padronizada.

**Impacto**: MÉDIO

**Evidência do código**: 
- Arquivos: Todos os stages em `codeReviewPipeline/stages/`
- Código: Stages são classes que implementam métodos específicos, mas não implementam interface comum

**Localização exata**: 
- Stages não implementam Stage interface definida na arquitetura balanceada
- Não há estrutura padronizada para stages

**Comportamento atual**: Stages têm estruturas diferentes, difícil testar isoladamente, difícil adicionar/remover

**Comportamento esperado**: Todos stages devem implementar Stage interface (ou HeavyStage para pesados), com estrutura padronizada

---

### Problema 6: Não há event handlers para retomar workflows

**Descrição**: Não existem event handlers genéricos para retomar workflows pausados quando eventos de stages pesados chegam.

**Impacto**: MÉDIO

**Evidência do código**: 
- Não existe `HeavyStageEventHandler` ou similar
- Não há código que retoma workflows pausados baseado em eventos

**Localização exata**: 
- Componente não existe ainda

**Comportamento atual**: Stages pesados não podem pausar/resumir porque não há handlers para retomar

**Comportamento esperado**: HeavyStageEventHandler deve escutar eventos de stages pesados completados, encontrar workflow pausado, e retomar pipeline do último estado salvo

---

### Problema 7: PR não é salvo no MongoDB no fluxo assíncrono

**Descrição**: No fluxo assíncrono atual, PR não é salvo no MongoDB antes de processar code review. Isso pode causar problemas se job falhar.

**Impacto**: MÉDIO

**Evidência do código**: 
- Arquivo: `apps/webhooks/src/controllers/github.controller.ts`
- Código: Webhook handler não salva PR, apenas enfileira

**Localização exata**: 
- Webhook handler não chama SavePullRequestUseCase
- Processor também não salva PR

**Comportamento atual**: PR não é salvo antes de processar code review

**Comportamento esperado**: WebhookProcessingJobProcessor deve salvar PR no MongoDB antes de validar e enfileirar CODE_REVIEW

---

### Problema 8: Validações não acontecem no fluxo assíncrono

**Descrição**: Validações de organização, team e licença não são feitas no fluxo assíncrono atual antes de processar code review.

**Impacto**: ALTO

**Evidência do código**: 
- Arquivo: `code-review-job-processor.service.ts`
- Código: Processor não valida organização/team/licença antes de processar

**Localização exata**: 
- CodeReviewJobProcessor não chama validações antes de executar pipeline
- Validações existem em runCodeReview.use-case.ts mas não são chamadas

**Comportamento atual**: Validações não são feitas, jobs podem ser processados mesmo com organização/team/licença inválidos

**Comportamento esperado**: WebhookProcessingJobProcessor deve validar organização, team e licença antes de enfileirar CODE_REVIEW

---

## 📝 Decisões Tomadas

Esta seção documenta decisões tomadas para cada ponto crítico identificado.

### Decisão 1: WebhookProcessingJobProcessor - Extração de Validações

**Pergunta original**: Como extrair validações de `runCodeReview.use-case.ts` para usar em `WebhookProcessingJobProcessor`?

**Opções consideradas**:
- **Opção A**: Extrair validações para serviço compartilhado (ex: `CodeReviewValidationService`)
  - Prós: DRY, fácil manutenção, reutilizável
  - Contras: Requer refatoração de código legado
- **Opção B**: Duplicar validações em WebhookProcessingJobProcessor
  - Prós: Simples, não afeta código legado
  - Contras: Duplicação, difícil manutenção
- **Opção C**: Refatorar runCodeReview.use-case.ts para usar serviço compartilhado
  - Prós: DRY, código legado também se beneficia
  - Contras: Requer refatoração de código legado

**Decisão tomada**: Opção A - Extrair validações para `CodeReviewValidationService` compartilhado

**Justificativa técnica**: 
- Mantém DRY (Don't Repeat Yourself)
- Facilita manutenção (validações em um lugar só)
- Permite evolução independente de validações
- Código legado pode migrar gradualmente para usar serviço compartilhado

**Impacto esperado**: 
- Positivo: Código mais limpo, fácil manutenção
- Negativo: Requer refatoração inicial

**Referências**: 
- Spec 001-workflow-queue: FR-002d1 menciona extrair validações

---

### Decisão 2: CodeReviewJobProcessor - Migração para PipelineExecutor

**Pergunta original**: Como migrar CodeReviewJobProcessor para criar AutomationExecution e chamar PipelineExecutor diretamente?

**Opções consideradas**:
- **Opção A**: Migração completa de uma vez (big bang)
  - Prós: Simples, código limpo rápido
  - Contras: Risco alto, difícil rollback
- **Opção B**: Migração gradual com feature flag
  - Prós: Rollback fácil, validação incremental
  - Contras: Código temporário durante migração
- **Opção C**: Manter ambos (legado e novo) em paralelo durante transição
  - Prós: Zero downtime, validação completa
  - Contras: Código duplicado temporariamente

**Decisão tomada**: Opção B - Migração gradual com feature flag

**Justificativa técnica**: 
- Permite validação incremental
- Rollback fácil se problemas aparecerem
- Reduz risco comparado com big bang
- Código temporário é aceitável durante migração

**Impacto esperado**: 
- Positivo: Migração segura, validação incremental
- Negativo: Código temporário durante migração

**Referências**: 
- Spec 001-workflow-queue: FR-010d menciona CodeReviewJobProcessor criar AutomationExecution

---

### Decisão 3: Migração de Stages - Análise Individual

**Pergunta original**: Quais stages são leves vs pesados? Como identificar?

**Opções consideradas**:
- **Opção A**: Analisar cada stage individualmente (tempo de execução, dependências externas)
  - Prós: Decisão informada, otimização precisa
  - Contras: Requer análise detalhada
- **Opção B**: Migrar todos para Stage primeiro, depois identificar pesados
  - Prós: Progresso rápido, estrutura padronizada
  - Contras: Pode migrar pesados como leves inicialmente
- **Opção C**: Começar pelos pesados (mais críticos)
  - Prós: Resolve problema de bloqueio primeiro
  - Contras: Pode deixar leves sem estrutura

**Decisão tomada**: Opção A - Analisar cada stage individualmente

**Justificativa técnica**: 
- Permite decisão informada por stage
- Identifica corretamente quais são pesados (bloqueiam worker)
- Otimização precisa (só pesados precisam ser event-driven)
- Evita trabalho desnecessário em stages leves

**Impacto esperado**: 
- Positivo: Decisões corretas, otimização precisa
- Negativo: Requer análise detalhada inicial

**Referências**: 
- Docs: `ARQUITETURA-IDEAL-BALANCEADA.md` menciona Stage vs HeavyStage

---

### Decisão 4: Stages Pesados - Webhook/Callback

**Pergunta original**: Como serviços externos (AST, LLM) publicam eventos quando completam?

**Opções consideradas**:
- **Opção A**: Serviços externos publicam eventos diretamente no RabbitMQ
  - Prós: Integração direta, eficiente
  - Contras: Requer mudanças em serviços externos, acoplamento
- **Opção B**: Polling periódico para verificar se tarefa completou
  - Prós: Não requer mudanças em serviços externos
  - Contras: Ineficiente, latência alta
- **Opção C**: Webhook/callback do serviço externo para notificar conclusão
  - Prós: Eficiente, não requer polling
  - Contras: Requer mudanças em serviços externos ou implementação de endpoint

**Decisão tomada**: Opção C - Webhook/callback do serviço externo

**Justificativa técnica**: 
- Mais eficiente que polling (sem latência desnecessária)
- Não requer polling constante (economia de recursos)
- Se serviços externos não suportam webhook, implementar endpoint que recebe callback e publica evento

**Impacto esperado**: 
- Positivo: Performance melhor, eficiência maior
- Negativo: Requer mudanças em serviços externos ou implementação de endpoint

**Referências**: 
- Spec 001-workflow-queue: FR-002e menciona stages pesados event-driven

---

### Decisão 5: Persistência - Contexto Completo Inicialmente

**Pergunta original**: O que incluir no estado persistido? Contexto completo ou apenas necessário para retomar?

**Opções consideradas**:
- **Opção A**: Persistir contexto completo (mais simples, mais espaço)
  - Prós: Simples, garante que tudo está disponível
  - Contras: Mais espaço no banco
- **Opção B**: Persistir apenas dados necessários para retomar (mais complexo, menos espaço)
  - Prós: Menos espaço, mais eficiente
  - Contras: Complexo, pode esquecer dados importantes
- **Opção C**: Híbrido - contexto completo mas com compressão
  - Prós: Balanceado
  - Contras: Adiciona complexidade de compressão

**Decisão tomada**: Opção A - Persistir contexto completo inicialmente

**Justificativa técnica**: 
- Simplicidade primeiro (YAGNI - You Aren't Gonna Need It)
- Garante que todos os dados estão disponíveis para retomar
- Otimizar depois se espaço se tornar problema
- JSONB suporta grandes objetos eficientemente

**Impacto esperado**: 
- Positivo: Simples, confiável
- Negativo: Mais espaço no banco (aceitável inicialmente)

**Referências**: 
- Spec 001-workflow-queue: FR-002e1 menciona persistência em WorkflowJob.pipelineState

---

### Decisão 6: Event Handlers - Query por EventType + EventKey

**Pergunta original**: Como HeavyStageEventHandler identifica qual workflow retomar?

**Opções consideradas**:
- **Opção A**: Evento inclui workflowJobId diretamente
  - Prós: Simples, direto
  - Contras: Acoplamento entre evento e workflow
- **Opção B**: Evento inclui eventType + eventKey, handler busca workflow por query
  - Prós: Flexível, permite múltiplos workflows esperando mesmo evento
  - Contras: Requer query no banco
- **Opção C**: Mapeamento explícito de eventos para workflows
  - Prós: Explícito, fácil debug
  - Contras: Complexo, difícil manter

**Decisão tomada**: Opção B - Evento inclui eventType + eventKey, handler busca por query

**Justificativa técnica**: 
- Mais flexível (múltiplos workflows podem esperar mesmo evento)
- Desacoplado (evento não precisa conhecer workflow)
- Query otimizada com índice é eficiente
- Permite casos de uso futuros (ex: múltiplos workflows esperando mesmo AST completar)

**Impacto esperado**: 
- Positivo: Flexível, desacoplado
- Negativo: Requer query no banco (aceitável com índice)

**Referências**: 
- Spec 001-workflow-queue: Clarificação sobre HeavyStageEventHandler identifica por stageName

---

## 🎯 Próximos Passos

1. ✅ **Fluxo atual documentado** - FLUXO-ATUAL.md criado
2. ✅ **Depara completo** - Todas as seções adicionadas
3. ✅ **Problemas identificados** - 8 problemas documentados
4. ✅ **Decisões tomadas** - 6 decisões documentadas
5. ⏭️ **Próximo**: Usar esta análise para implementar na spec 001-workflow-queue

