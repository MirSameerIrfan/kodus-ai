# Arquitetura Ideal: Processo de Code Review com AI - Pensando do Zero

**Data**: 2025-01-27  
**Perspectiva**: CTO Sênior - Pensando do Zero  
**Objetivo**: Definir arquitetura ideal para processo de code review com AI que tem N etapas

---

## 🎯 Princípios Fundamentais

### 1. Separação de Responsabilidades

**Workflow Queue** = Orquestração de Alto Nível

- Gerencia estado do processo (PENDING → PROCESSING → COMPLETED/FAILED)
- Faz validações de negócio (organização, licença, team)
- Cria entidades de controle (AutomationExecution)
- Decide próximos passos
- Gerencia retry, timeout, pausa/resume

**Pipeline** = Execução Técnica Específica

- Processa código (análise LLM, AST)
- Gera comentários
- Transforma dados técnicos
- Não faz validações de negócio
- Não cria entidades de controle

---

## 🏗️ Arquitetura Ideal (Do Zero)

### Visão de Alto Nível

```
┌─────────────────────────────────────────────────────────┐
│ WORKFLOW QUEUE (Orquestração)                          │
│                                                          │
│ 1. Recebe evento (webhook)                              │
│ 2. Valida negócio (organização, licença, team)          │
│ 3. Cria entidade de controle (AutomationExecution)      │
│ 4. Decide: deve processar?                               │
│ 5. Se sim → Chama Pipeline (execução técnica)          │
│ 6. Gerencia estado, retry, pausa/resume                 │
└─────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│ PIPELINE (Execução Técnica)                            │
│                                                          │
│ 1. Recebe contexto (PR, arquivos, configuração)        │
│ 2. Processa código (LLM, AST)                           │
│ 3. Gera comentários                                     │
│ 4. Retorna resultado                                    │
│                                                          │
│ NÃO faz:                                                │
│ - Validações de negócio                                 │
│ - Criação de entidades                                  │
│ - Decisões de workflow                                  │
└─────────────────────────────────────────────────────────┘
```

---

## 📋 O Que Vai na Fila vs O Que Não Vai

### ✅ VAI na Fila (Workflow Queue)

**Por que vai na fila?**

- Precisa ser assíncrono (não bloquear webhook)
- Pode falhar e precisa retry
- Pode demorar (validações pesadas, processamento)
- Precisa pausar/resumir (esperar AST, esperar LLM)

**Exemplos**:

1. **Validações de Negócio** (WEBHOOK_PROCESSING)
    - Buscar organização/team
    - Validar licença
    - Verificar automação ativa
    - ⏱️ Tempo: 500ms - 2s
    - 🔄 Pode falhar? Sim (organização não encontrada, licença inválida)

2. **Execução Técnica** (CODE_REVIEW)
    - Criar AutomationExecution
    - Executar pipeline (análise LLM, AST)
    - Gerar comentários
    - ⏱️ Tempo: 30s - 5min
    - 🔄 Pode falhar? Sim (LLM timeout, AST indisponível)
    - ⏸️ Pode pausar? Sim (esperar AST, esperar LLM)

---

### ❌ NÃO VAI na Fila

**Por que não vai na fila?**

- É rápido (< 100ms)
- É crítico para segurança (deve ser síncrono)
- Não precisa retry
- Não pode falhar (se falhar, rejeita imediatamente)

**Exemplos**:

1. **Validação de Signature** (Webhook Handler)
    - Validação de segurança
    - ⏱️ Tempo: < 10ms
    - 🔄 Pode falhar? Sim, mas rejeita imediatamente (não retry)

2. **Enfileiramento** (Webhook Handler)
    - Salvar job no banco + outbox
    - ⏱️ Tempo: < 50ms
    - 🔄 Pode falhar? Sim, mas retorna erro ao webhook (não retry automático)

3. **Retorno HTTP** (Webhook Handler)
    - Retornar 200 OK
    - ⏱️ Tempo: < 1ms
    - 🔄 Não pode falhar (já retornou)

---

## 🔄 Fluxo Ideal (Do Zero)

### Etapa 1: Webhook Handler (Síncrono, Rápido)

```
Webhook HTTP → Valida Signature → Enfileira WEBHOOK_PROCESSING → Retorna 200 OK
```

**O que faz**:

- ✅ Valida signature (segurança)
- ✅ Enfileira payload bruto
- ✅ Retorna 200 OK

**O que NÃO faz**:

- ❌ Validações de negócio
- ❌ Processamento
- ❌ Salvar PR (isso vai no worker)

**Tempo**: < 100ms

---

### Etapa 2: Worker - WEBHOOK_PROCESSING (Assíncrono, Fila)

```
Consome WEBHOOK_PROCESSING → Salva PR → Identifica Plataforma → Valida Negócio → Enfileira CODE_REVIEW
```

**O que faz**:

- ✅ Salva PR no MongoDB
- ✅ Identifica platformType
- ✅ Chama handler correto
- ✅ Valida organização/team/licença
- ✅ Se passar → Enfileira CODE_REVIEW
- ✅ Se falhar → Marca como FAILED

**O que NÃO faz**:

- ❌ Executa análise de código
- ❌ Chama LLM
- ❌ Gera comentários

**Tempo**: 500ms - 2s

---

### Etapa 3: Worker - CODE_REVIEW (Assíncrono, Fila)

```
Consome CODE_REVIEW → Cria AutomationExecution → Executa Pipeline → Atualiza AutomationExecution
```

**O que faz**:

- ✅ Cria AutomationExecution (timeline)
- ✅ Verifica execução ativa (deduplicação)
- ✅ Chama Pipeline (execução técnica)
- ✅ Atualiza AutomationExecution com resultado

**O que NÃO faz**:

- ❌ Validações de negócio (já foram feitas)
- ❌ Salva PR (já foi salvo)

**Tempo**: 30s - 5min

---

### Etapa 4: Pipeline (Execução Técnica, Chamado pelo Workflow)

```
Pipeline.execute(context) → Stages Técnicos → Retorna Resultado
```

**O que faz**:

- ✅ Valida commits técnicos
- ✅ Resolve configuração técnica
- ✅ Busca arquivos alterados
- ✅ Processa código (LLM, AST)
- ✅ Gera comentários
- ✅ Retorna resultado

**O que NÃO faz**:

- ❌ Validações de negócio
- ❌ Criação de AutomationExecution
- ❌ Decisões de workflow
- ❌ Gerencia estado do workflow

**Tempo**: 30s - 5min (dentro do CODE_REVIEW)

---

## 🎯 Separação Clara: Workflow vs Pipeline

### Workflow Queue (Orquestração)

**Responsabilidades**:

- ✅ Gerencia estado (PENDING → PROCESSING → COMPLETED/FAILED)
- ✅ Validações de negócio (organização, licença, team)
- ✅ Criação de entidades (AutomationExecution)
- ✅ Decisões (deve processar? pode processar?)
- ✅ Retry, timeout, pausa/resume
- ✅ Chama Pipeline quando necessário

**NÃO faz**:

- ❌ Processamento técnico de código
- ❌ Chamadas a LLM diretamente
- ❌ Análise de arquivos
- ❌ Geração de comentários

---

### Pipeline (Execução Técnica)

**Responsabilidades**:

- ✅ Processamento técnico (análise LLM, AST)
- ✅ Transformação de dados técnicos
- ✅ Geração de comentários
- ✅ Validações técnicas (commits, configuração)

**NÃO faz**:

- ❌ Validações de negócio
- ❌ Criação de AutomationExecution
- ❌ Decisões de workflow
- ❌ Gerencia estado do workflow

---

## 💡 Arquitetura Ideal: Workflow Chama Pipeline

```
Workflow Job (CODE_REVIEW)
  ↓
Cria AutomationExecution
  ↓
Chama Pipeline.execute(context)
  ↓
Pipeline executa stages técnicos
  ↓
Pipeline retorna resultado
  ↓
Workflow atualiza AutomationExecution
```

**Vantagens**:

- ✅ Separação clara de responsabilidades
- ✅ Pipeline pode ser reutilizado em outros contextos
- ✅ Workflow gerencia estado, Pipeline executa técnica
- ✅ Testes independentes (workflow mocka pipeline, pipeline mocka workflow)

---

## 🤔 Pergunta para Você

**Como CTO, você concorda com essa separação?**

- **Workflow Queue** = Orquestração (validações, decisões, estado, chama pipeline)
- **Pipeline** = Execução técnica (análise LLM, processamento, comentários)

**Ou você vê de outra forma?**
