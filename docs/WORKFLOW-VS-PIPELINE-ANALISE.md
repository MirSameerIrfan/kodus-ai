# Análise: Workflow vs Pipeline - O Que Deve Estar Onde?

**Data**: 2025-01-27  
**Objetivo**: Entender o que é workflow vs pipeline e o que deve estar em cada um

## 🤔 Questão Central

**Pergunta**: Em workflow, processo de code review, será que tudo precisa ser etapa do pipeline? Não deveria ter pipeline separado?

---

## 📊 Análise: O Que É Workflow vs Pipeline?

### Workflow (Orquestração de Alto Nível)

**Responsabilidades**:
- Validações de negócio (organização, team, licença)
- Criação de entidades (AutomationExecution, CodeReviewExecution)
- Decisões de negócio (deve executar? pode executar?)
- Coordenação entre componentes
- Gerenciamento de estado (PENDING → PROCESSING → COMPLETED/FAILED)

**Exemplos**:
- `findTeamWithActiveCodeReview` - Validação de negócio
- `validateExecutionPermissions` - Validação de licença
- `createAutomationExecution` - Criação de entidade
- `getActiveExecution` - Decisão de deduplicação

**Características**:
- Lógica de negócio
- Queries no banco
- Validações
- Decisões

---

### Pipeline (Execução Técnica Específica)

**Responsabilidades**:
- Execução técnica de análise de código
- Processamento de arquivos
- Chamadas a LLM
- Geração de comentários
- Análise AST

**Stages Atuais**:
1. `ValidateNewCommitsStage` - Valida commits técnicos
2. `ResolveConfigStage` - Resolve configuração técnica
3. `ValidateConfigStage` - Valida configuração técnica
4. `FetchChangedFilesStage` - Busca arquivos alterados
5. `LoadExternalContextStage` - Carrega contexto externo
6. `FileContextGateStage` - Gate técnico
7. `InitialCommentStage` - Comentário inicial
8. `KodyFineTuningStage` - Fine-tuning técnico
9. `CodeAnalysisASTStage` - Análise AST (pode pausar)
10. `ProcessFilesPrLevelReviewStage` - Review PR-level
11. `ProcessFilesReview` - Review de arquivos (pode pausar)
12. `CreatePrLevelCommentsStage` - Comentários PR-level
13. `CreateFileCommentsStage` - Comentários file-level
14. `CodeAnalysisASTCleanupStage` - Limpeza AST
15. `AggregateResultsStage` - Agregação de resultados
16. `UpdateCommentsAndGenerateSummaryStage` - Atualização e resumo
17. `RequestChangesOrApproveStage` - Solicitação de mudanças/aprovação

**Características**:
- Processamento técnico
- Chamadas a serviços externos (LLM, AST)
- Transformação de dados
- Geração de output

---

## 🔍 Análise: O Que Está Misturado Hoje?

### Fluxo Atual (Síncrono)

```
runCodeReview.use-case.ts
  ↓ (validações de negócio - WORKFLOW)
automationCodeReview.ts
  ↓ (criação de entidades - WORKFLOW)
codeReviewHandlerService.service.ts
  ↓ (setup - WORKFLOW?)
pipeline.execute()
  ↓ (execução técnica - PIPELINE)
```

**Problema identificado**:
- `runCodeReview` faz validações de negócio ✅ (WORKFLOW)
- `automationCodeReview` cria AutomationExecution ✅ (WORKFLOW)
- `codeReviewHandler` faz setup e chama pipeline ⚠️ (MISTURADO?)
- `pipeline` executa stages técnicos ✅ (PIPELINE)

---

## 💡 Proposta: Separar Workflow de Pipeline

### Workflow (Orquestração)

**Responsabilidades**:
- Validações de negócio
- Criação de entidades
- Decisões
- Chamar pipeline quando necessário

**Não faz**:
- ❌ Processamento técnico de código
- ❌ Chamadas a LLM
- ❌ Análise de arquivos

---

### Pipeline (Execução Técnica)

**Responsabilidades**:
- Execução técnica de análise
- Processamento de arquivos
- Chamadas a LLM/AST
- Geração de comentários

**Não faz**:
- ❌ Validações de negócio
- ❌ Criação de AutomationExecution
- ❌ Decisões de licença/organização

---

## 🎯 Pergunta de Clarificação

**O que você quer dizer com "não deveria ter pipeline?"**

**Opção A**: Pipeline não deveria estar dentro do workflow - workflow deveria apenas orquestrar e chamar pipeline quando necessário, mas pipeline é separado

**Opção B**: Alguns stages do pipeline não deveriam ser stages - deveriam ser parte do workflow (ex: validações, criação de entidades)

**Opção C**: Pipeline deveria ser apenas a parte técnica (LLM, análise), workflow faz o resto (validações, setup, criação de entidades)

**Opção D**: Outra interpretação?

---

## 📋 Análise de Stages: Workflow vs Pipeline?

### Stages que PODEM ser Workflow (não Pipeline):

1. **ValidateNewCommitsStage** - Valida commits técnicos
   - ⚠️ É técnico ou de negócio?
   - Se for validação de negócio (ex: "deve processar este commit?"), é WORKFLOW
   - Se for validação técnica (ex: "há commits novos?"), é PIPELINE

2. **ResolveConfigStage** - Resolve configuração
   - ⚠️ É técnico ou de negócio?
   - Se for resolução de configuração de negócio, é WORKFLOW
   - Se for resolução técnica, é PIPELINE

3. **ValidateConfigStage** - Valida configuração
   - ⚠️ É técnico ou de negócio?
   - Se for validação de negócio (ex: "configuração válida para este team?"), é WORKFLOW
   - Se for validação técnica (ex: "configuração bem formada?"), é PIPELINE

### Stages que SÃO Pipeline (técnicos):

- `FetchChangedFilesStage` - Busca arquivos (técnico)
- `ProcessFilesReview` - Análise LLM (técnico)
- `CreateFileCommentsStage` - Geração de comentários (técnico)
- `CodeAnalysisASTStage` - Análise AST (técnico)

---

## 🤔 Questões para Clarificar

1. **O que é "workflow" para você?**
   - Apenas orquestração (validações, decisões, criação de entidades)?
   - Ou inclui também execução técnica?

2. **O que é "pipeline" para você?**
   - Apenas execução técnica (LLM, análise, comentários)?
   - Ou inclui também validações e setup?

3. **Onde traçar a linha entre workflow e pipeline?**
   - Workflow = negócio, Pipeline = técnico?
   - Workflow = orquestração, Pipeline = execução?

4. **Como integrar workflow queue com pipeline?**
   - Workflow queue orquestra e chama pipeline quando necessário?
   - Ou pipeline é parte do workflow?

