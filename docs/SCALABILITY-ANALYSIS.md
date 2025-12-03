# Análise de Escalabilidade - Arquitetura Atual

## ⚠️ Problemas Identificados

### 1. Database Connection Pool - CRÍTICO 🔴

**Configuração Atual**:

```typescript
// PostgreSQL: max 40 conexões por processo
extra: {
    max: 40,  // Máximo de conexões por processo
    min: 1,
}
```

**Cenário de Escala**:

```
Webhook Handler: 10 instâncias × 40 conexões = 400 conexões
API REST:        10 instâncias × 40 conexões = 400 conexões
Workers:         10 instâncias × 40 conexões = 400 conexões
───────────────────────────────────────────────────────
TOTAL:                                      = 1.200 conexões
```

**Problema**:

- PostgreSQL padrão suporta ~100-200 conexões simultâneas
- Com 1.200 conexões, vai esgotar o pool
- Conexões ociosas desperdiçam recursos
- Cada processo mantém pool mesmo quando não usa

**Solução**:

- Reduzir `max` por processo conforme necessidade real
- Webhook handler: `max: 5-10` (só escreve logs)
- API REST: `max: 20-30` (consultas variadas)
- Workers: `max: 10-15` (processamento pesado)
- Total estimado: ~300-500 conexões (mais realista)

---

### 2. Webhook Handler Ainda Carrega Muito ⚠️

**Problema Atual**:

```typescript
WebhookHandlerBaseModule {
    imports: [
        WorkflowQueueModule,  // ← Carrega MUITO código desnecessário
        DatabaseModule,        // ← Pool completo (40 conexões)
        // ...
    ]
}
```

**O que está sendo carregado desnecessariamente**:

- `WorkflowQueueModule` completo (inclui consumers, processors que não precisa)
- `DatabaseModule` completo (pool de 40 conexões, só precisa de 5)
- Módulos de domínio que não são usados

**Impacto**:

- Memória: ~150-200MB (deveria ser ~50MB)
- Startup: ~10-15s (deveria ser ~2-5s)
- Conexões DB: 40 (só precisa de 5)

**Solução**:

- Criar módulo mínimo só para enfileiramento
- Não importar `WorkflowQueueModule` completo
- Criar apenas `EnqueueCodeReviewJobUseCase` isolado
- Pool de DB reduzido (5-10 conexões)

---

### 3. AppModule Compartilhado - Overhead Desnecessário ⚠️

**Problema**:

```typescript
// Todos os processos carregam AppModule completo
ApiModule → AppModule (completo)
WorkerModule → AppModule (completo)
WebhookHandlerModule → WebhookHandlerBaseModule → AppModule parcial
```

**O que cada processo realmente precisa**:

| Componente          | Precisa de AppModule? | O que realmente precisa                           |
| ------------------- | --------------------- | ------------------------------------------------- |
| **Webhook Handler** | ❌ NÃO                | Apenas: DB (logs), RabbitMQ (enfileirar), Logging |
| **API REST**        | ✅ SIM                | Tudo (dashboard precisa de tudo)                  |
| **Worker**          | ✅ SIM                | Tudo (processamento precisa de tudo)              |

**Problema**:

- Webhook handler carrega módulos que nunca usa (LLM, AST, etc.)
- Memória desperdiçada
- Startup mais lento

**Solução**:

- Webhook handler NÃO deve herdar AppModule
- Criar módulo mínimo específico para webhook handler
- Apenas API REST e Workers herdam AppModule

---

### 4. RabbitMQ Connections - Pode Ser Otimizado ⚠️

**Problema**:

- Cada processo cria conexão RabbitMQ completa
- Com muitos processos = muitas conexões
- RabbitMQ tem limite de conexões (padrão: 1024)

**Cenário**:

```
10 webhook handlers × 1 conexão = 10 conexões
10 API REST        × 1 conexão = 10 conexões
10 workers         × 1 conexão = 10 conexões
───────────────────────────────────────────
TOTAL:                          = 30 conexões
```

**Status**: ✅ OK para escala atual, mas pode otimizar com connection pooling

---

### 5. Workers - Cluster Mode Correto ✅

**Configuração Atual**:

```javascript
{
    name: 'workflow-worker',
    exec_mode: 'cluster',  // ✅ Correto
    instances: 1,          // Pode aumentar
}
```

**Status**: ✅ OK - pode escalar horizontalmente facilmente

---

## 📊 Análise de Escalabilidade por Componente

### Webhook Handler

**Problemas**:

- ❌ Carrega `WorkflowQueueModule` completo (desnecessário)
- ❌ Pool de DB muito grande (40 conexões, só precisa de 5)
- ❌ Herda AppModule parcialmente (carrega código não usado)

**Escalabilidade Atual**: ⚠️ **LIMITADA**

- Pode escalar horizontalmente (stateless)
- Mas desperdiça recursos (memória, conexões DB)
- Startup lento afeta tempo de recuperação

**Escalabilidade Ideal**: ✅ **ALTA**

- Leve (~50MB)
- Pool pequeno (5 conexões)
- Startup rápido (~2s)
- Pode escalar para 50+ instâncias sem problemas

---

### API REST

**Problemas**:

- ⚠️ Pool de DB pode ser otimizado (40 → 20-30)
- ✅ Precisa de AppModule completo (correto)

**Escalabilidade Atual**: ✅ **BOA**

- Stateless
- Pode escalar horizontalmente
- Pool de DB pode ser ajustado

**Escalabilidade Ideal**: ✅ **ALTA**

- Otimizar pool de DB
- Pode escalar para 20+ instâncias facilmente

---

### Workers

**Problemas**:

- ⚠️ Pool de DB pode ser otimizado (40 → 10-15)
- ✅ Cluster mode correto
- ✅ Precisa de AppModule completo (correto)

**Escalabilidade Atual**: ✅ **BOA**

- Cluster mode permite escalar
- Pode aumentar `instances` conforme necessário

**Escalabilidade Ideal**: ✅ **ALTA**

- Otimizar pool de DB
- Pode escalar para 20+ instâncias facilmente

---

## 🎯 Recomendações de Otimização

### Prioridade ALTA 🔴

1. **Otimizar Webhook Handler**
    - ❌ Remover `WorkflowQueueModule` completo
    - ✅ Criar módulo mínimo só para enfileiramento
    - ✅ Reduzir pool de DB (40 → 5-10)
    - ✅ Não herdar AppModule

2. **Ajustar Connection Pools**
    - Webhook Handler: `max: 5-10`
    - API REST: `max: 20-30`
    - Workers: `max: 10-15`

### Prioridade MÉDIA 🟡

3. **Connection Pooling por Componente**
    - Criar configurações de DB específicas por componente
    - Webhook handler: pool mínimo
    - API REST: pool médio
    - Workers: pool médio-alto

4. **RabbitMQ Connection Pooling**
    - Implementar connection pooling para RabbitMQ
    - Reutilizar conexões entre processos (se possível)

### Prioridade BAIXA 🟢

5. **Monitoramento de Conexões**
    - Métricas de uso de conexões DB por componente
    - Alertas quando pool está esgotando
    - Auto-scaling baseado em uso de conexões

---

## 📈 Cenários de Escala

### Cenário 1: Volume Baixo (Atual)

```
Webhook Handler: 1 instância × 40 conexões = 40
API REST:        1 instância × 40 conexões = 40
Workers:         1 instância × 40 conexões = 40
───────────────────────────────────────────────
TOTAL:                                    = 120 conexões
```

**Status**: ✅ OK (dentro do limite)

---

### Cenário 2: Volume Médio

```
Webhook Handler: 5 instâncias × 40 conexões = 200
API REST:        3 instâncias × 40 conexões = 120
Workers:         5 instâncias × 40 conexões = 200
───────────────────────────────────────────────────
TOTAL:                                      = 520 conexões
```

**Status**: ⚠️ **PROBLEMA** - Esgota pool do PostgreSQL

**Com Otimização**:

```
Webhook Handler: 5 instâncias × 5 conexões  = 25
API REST:        3 instâncias × 25 conexões = 75
Workers:         5 instâncias × 15 conexões  = 75
───────────────────────────────────────────────────
TOTAL:                                      = 175 conexões
```

**Status**: ✅ OK

---

### Cenário 3: Volume Alto

```
Webhook Handler: 20 instâncias × 40 conexões = 800
API REST:        10 instâncias × 40 conexões = 400
Workers:         20 instâncias × 40 conexões  = 800
───────────────────────────────────────────────────────
TOTAL:                                         = 2.000 conexões
```

**Status**: 🔴 **CRÍTICO** - Impossível escalar assim

**Com Otimização**:

```
Webhook Handler: 20 instâncias × 5 conexões  = 100
API REST:        10 instâncias × 25 conexões = 250
Workers:         20 instâncias × 15 conexões  = 300
───────────────────────────────────────────────────────
TOTAL:                                         = 650 conexões
```

**Status**: ⚠️ Ainda alto, mas gerenciável com PostgreSQL otimizado

**Solução Adicional**:

- Usar PgBouncer ou connection pooler
- Reduzir ainda mais pools por processo
- Implementar read replicas para consultas

---

## 🔧 Implementação das Otimizações

### 1. Criar Módulo Mínimo para Webhook Handler

```typescript
// src/modules/webhook-handler-minimal.module.ts
@Module({
    imports: [
        // Apenas o essencial
        ConfigModule.forRoot(),
        LogModule,
        DatabaseModuleMinimal, // Pool reduzido (5 conexões)
        RabbitMQWrapperModuleMinimal, // Apenas publisher
        WebhookLogModule,
        // NÃO importa WorkflowQueueModule completo
        // NÃO importa AppModule
    ],
})
export class WebhookHandlerMinimalModule {}
```

### 2. Configuração de DB por Componente

```typescript
// src/config/database/typeorm/typeORM.factory.ts
createTypeOrmOptions(): TypeOrmModuleOptions {
    const component = process.env.COMPONENT_TYPE; // 'webhook' | 'api' | 'worker'

    const poolConfig = {
        webhook: { max: 5, min: 1 },   // Mínimo
        api: { max: 25, min: 2 },      // Médio
        worker: { max: 15, min: 2 },   // Médio-alto
    }[component] || { max: 40, min: 1 };

    return {
        // ...
        extra: {
            max: poolConfig.max,
            min: poolConfig.min,
            // ...
        },
    };
}
```

### 3. Remover WorkflowQueueModule do Webhook Handler

```typescript
// Criar apenas o necessário para enfileirar
@Module({
    imports: [
        RabbitMQWrapperModule.register(),
        // Criar EnqueueService isolado (sem WorkflowQueueModule completo)
    ],
    providers: [
        EnqueueCodeReviewJobUseCase, // Isolado, sem dependências pesadas
    ],
})
export class WebhookEnqueueModule {}
```

---

## ✅ Conclusão

### Arquitetura Atual: ⚠️ **ESCALÁVEL COM LIMITAÇÕES**

**Pontos Positivos**:

- ✅ Separação física completa
- ✅ Processos independentes
- ✅ Escalabilidade horizontal possível
- ✅ Workers em cluster mode

**Pontos de Atenção**:

- ⚠️ Database connection pool muito alto por processo
- ⚠️ Webhook handler carrega código desnecessário
- ⚠️ Pode esgotar conexões DB ao escalar

### Arquitetura Otimizada: ✅ **ALTAMENTE ESCALÁVEL**

**Melhorias**:

- ✅ Pools de DB ajustados por componente
- ✅ Webhook handler mínimo (leve e rápido)
- ✅ Pode escalar para 50+ instâncias sem problemas
- ✅ Uso eficiente de recursos

**Recomendação**: Implementar otimizações de Prioridade ALTA antes de escalar para produção.
