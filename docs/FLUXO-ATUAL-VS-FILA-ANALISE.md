# Análise: Fluxo Atual vs O Que Deve Estar na Fila

**Data**: 2025-01-27  
**Objetivo**: Entender o que deve estar na fila e o que não deve, baseado no fluxo atual

## 🔍 Fluxo Atual (Síncrono - Legado)

### Etapa 1: `runCodeReview.use-case.ts`

**O que faz**:
1. Valida se deve rodar automation (`shouldRunAutomation`)
2. Mapeia payload da plataforma (repository, pullRequest, users)
3. **Busca team com automação ativa** (`findTeamWithActiveCodeReview`):
   - Busca configuração de integração (`findIntegrationConfigWithTeams`)
   - Busca automation (`getAutomation`)
   - Busca team automations (`getTeamAutomations`)
   - Valida se usuário está ignorado (`isUserIgnored`)
   - **Valida permissões/licença** (`validateExecutionPermissions`):
     - Valida licença da organização
     - Valida licença do usuário
     - Valida BYOK config
     - Auto-assign license se necessário
   - Retorna `organizationAndTeamData` + `automationId` + `byokConfig`
4. Busca detalhes do PR se necessário (`codeManagement.getPullRequest`)
5. Busca linguagem do repositório se necessário (`codeManagement.getLanguageRepository`)
6. Chama `executeAutomation.executeStrategy(AUTOMATION_CODE_REVIEW, ...)`

**Tempo estimado**: 500ms - 2s (várias queries no banco, validações)

**É pesado?**: ✅ **SIM** - Múltiplas queries no banco, validações complexas

---

### Etapa 2: `automationCodeReview.ts` (run method)

**O que faz**:
1. Verifica execução ativa (`getActiveExecution`) - deduplicação
2. Valida organização existe (`organizationService.findOne`)
3. **Cria AutomationExecution** (`createAutomationExecution`):
   - Cria registro na tabela `automation_execution`
   - Cria registro na tabela `code_review_execution`
4. Chama `codeReviewHandlerService.handlePullRequest(...)`

**Tempo estimado**: 200ms - 500ms (queries no banco)

**É pesado?**: ⚠️ **MÉDIO** - Queries no banco, mas não é o mais pesado

---

### Etapa 3: `codeReviewHandlerService.service.ts`

**O que faz**:
1. Inicializa observabilidade
2. Cria contexto inicial do pipeline
3. Adiciona reação START no PR
4. Busca pipeline (`pipelineFactory.getPipeline`)
5. **Executa pipeline** (`pipeline.execute(initialContext)`)
6. Adiciona reação SUCCESS/ERROR/SKIP baseado no resultado

**Tempo estimado**: 100ms - 500ms (setup + reações)

**É pesado?**: ⚠️ **MÉDIO** - Setup rápido, mas chama pipeline pesado

---

### Etapa 4: `pipeline` (PipelineExecutor)

**O que faz**:
1. Executa stages sequencialmente (ou em paralelo quando possível)
2. Stages incluem:
   - Validação de commits
   - Resolução de configuração
   - Busca de arquivos alterados
   - **Análise AST** (pode pausar)
   - **Análise de código com LLM** (muito pesado)
   - Preparação de contexto de arquivos
   - Geração de comentários
   - Criação de sugestões
   - Agregação de resultados

**Tempo estimado**: 30s - 5min (depende do tamanho do PR, LLM, AST)

**É pesado?**: ✅✅✅ **MUITO PESADO** - LLM, AST, múltiplas chamadas externas

---

## 📊 Análise: O Que Deve Estar na Fila?

### ❌ NÃO Deve Estar na Fila (Leve, Síncrono)

1. **Validação de signature do webhook**
   - Tempo: < 10ms
   - Deve ser síncrono (segurança)
   - **Local**: Webhook Handler

2. **Enfileiramento do payload bruto**
   - Tempo: < 50ms
   - Deve ser rápido
   - **Local**: Webhook Handler

3. **Retorno 200 OK**
   - Tempo: < 1ms
   - Deve ser imediato
   - **Local**: Webhook Handler

---

### ✅ DEVE Estar na Fila (Pesado, Assíncrono)

1. **Validações de organização/team/licença** (`findTeamWithActiveCodeReview`)
   - Tempo: 500ms - 2s
   - Múltiplas queries no banco
   - **Deve estar na fila**: ✅ SIM

2. **Criação de AutomationExecution**
   - Tempo: 200ms - 500ms
   - Queries no banco
   - **Deve estar na fila**: ✅ SIM

3. **Execução do pipeline completo**
   - Tempo: 30s - 5min
   - LLM, AST, análise pesada
   - **Deve estar na fila**: ✅✅✅ SIM (mais pesado)

---

## 🤔 Pergunta Crítica: Quantas Etapas na Fila?

### Opção A: Duas Etapas (WEBHOOK_PROCESSING → CODE_REVIEW)

**Fluxo**:
1. Webhook Handler → Enfileira `WEBHOOK_PROCESSING` (payload bruto)
2. Worker processa `WEBHOOK_PROCESSING`:
   - Identifica platformType
   - Chama handler (githubPullRequest.handler.ts)
   - Handler salva PR
   - Handler chama `runCodeReview.use-case.ts` (validações)
   - Se passar validações → Enfileira `CODE_REVIEW`
3. Worker processa `CODE_REVIEW`:
   - Cria AutomationExecution
   - Executa pipeline

**Vantagens**:
- Separação clara: processamento de webhook vs code review
- Permite filtrar webhooks inválidos antes de processar code review
- Permite salvar PR antes de validar licença

**Desvantagens**:
- Duas etapas na fila (mais complexo)
- Mais latência total

---

### Opção B: Uma Etapa Direta (CODE_REVIEW direto)

**Fluxo**:
1. Webhook Handler → Enfileira `CODE_REVIEW` diretamente
   - Mas precisa de `organizationAndTeam` que não tem ainda!
2. Worker processa `CODE_REVIEW`:
   - Validações (`findTeamWithActiveCodeReview`)
   - Cria AutomationExecution
   - Executa pipeline

**Vantagens**:
- Mais simples (uma etapa)
- Menos latência

**Desvantagens**:
- Webhook handler precisa fazer validações básicas antes de enfileirar?
- Ou enfileira sem `organizationAndTeam` e worker faz tudo?

---

## 🎯 Decisões Necessárias

### 1. Onde fazer validações pesadas?

**Opção A**: No worker (depois de enfileirar)
- ✅ Webhook handler ultra leve
- ✅ Validações podem falhar e job vai para DLQ
- ❌ Jobs inválidos ocupam espaço na fila

**Opção B**: No webhook handler (antes de enfileirar)
- ✅ Não enfileira jobs inválidos
- ❌ Webhook handler fica pesado
- ❌ Resposta HTTP pode demorar

**Opção C**: Validações básicas no webhook handler, pesadas no worker
- ✅ Balance entre leveza e eficiência
- ⚠️ Onde traçar a linha?

---

### 2. Onde salvar PR no MongoDB?

**Opção A**: No webhook handler (antes de enfileirar)
- ✅ Dados disponíveis mesmo se job falhar
- ✅ Evita race conditions
- ❌ Webhook handler precisa de acesso ao MongoDB

**Opção B**: No worker processando WEBHOOK_PROCESSING
- ✅ Separação de responsabilidades
- ✅ Webhook handler mais leve
- ⚠️ Se job falhar antes de salvar, PR não é salvo

**Opção C**: No worker processando CODE_REVIEW
- ✅ Depois de validações passarem
- ❌ Se validações falharem, PR não é salvo

---

### 3. Quantas etapas na fila?

**Opção A**: Duas etapas (WEBHOOK_PROCESSING → CODE_REVIEW)
- ✅ Separação clara
- ✅ Permite filtrar antes de processar pesado
- ❌ Mais complexo

**Opção B**: Uma etapa (CODE_REVIEW direto)
- ✅ Mais simples
- ❌ Precisa de `organizationAndTeam` antes de enfileirar?
- ❌ Ou enfileira sem e worker faz tudo?

---

## 📋 Próximos Passos

Aguardando clarificações sobre:
1. Onde fazer validações (antes ou depois de enfileirar)?
2. Onde salvar PR (webhook handler ou worker)?
3. Quantas etapas na fila (duas ou uma)?

