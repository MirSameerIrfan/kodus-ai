# Alternativas de Arquitetura: Webhook Handler e Workers

## Problema Atual

Usar NestJS completo para webhook handler e workers é **overkill**:
- **Memória**: ~200-500MB só de framework
- **Startup**: ~15-30 segundos
- **Overhead**: DI container, decorators, reflection desnecessários

## Opções de Arquitetura

### Opção 1: NestJS Completo (Atual) ❌

**Estrutura**:
```
webhook-handler.ts → WebhookHandlerModule → AppModule (completo)
worker.ts → WorkerModule → AppModule (completo)
```

**Prós**:
- ✅ Funciona imediatamente
- ✅ Reutiliza código existente
- ✅ TypeScript + estrutura organizada

**Contras**:
- ❌ Muito pesado (~500MB+ por processo)
- ❌ Startup lento (~30s)
- ❌ Overhead desnecessário

**Quando usar**: Prototipagem rápida, depois migrar

---

### Opção 2: Fastify para Webhook Handler + NestJS para Workers ✅ RECOMENDADO

**Estrutura**:
```
webhook-handler-fastify.ts → Fastify (leve) → RabbitMQ direto
worker.ts → WorkerModule → AppModule (completo, necessário para processamento)
```

**Prós**:
- ✅ Webhook handler leve (~50-100MB)
- ✅ Startup rápido (~2-5s)
- ✅ Alta performance (Fastify é 2-3x mais rápido que Express)
- ✅ Workers mantêm NestJS (precisam de toda infraestrutura)

**Contras**:
- ⚠️ Precisa reescrever controllers em Fastify
- ⚠️ Perde integração direta com módulos NestJS

**Quando usar**: Produção, quando performance importa

---

### Opção 3: Fastify para Webhook + Workers Leves ✅ IDEAL

**Estrutura**:
```
webhook-handler-fastify.ts → Fastify → RabbitMQ direto
worker-light.ts → amqplib direto → Processa jobs
```

**Prós**:
- ✅ Muito leve (~30-50MB cada)
- ✅ Startup muito rápido (~1-2s)
- ✅ Máxima performance
- ✅ Escalável horizontalmente

**Contras**:
- ⚠️ Precisa reescrever lógica de processamento
- ⚠️ Perde benefícios do NestJS (DI, módulos, etc.)
- ⚠️ Mais código manual

**Quando usar**: Quando performance é crítica e volume é alto

---

### Opção 4: Híbrida - NestJS Minimal para Webhook ✅ PRAGMÁTICA

**Estrutura**:
```
webhook-handler.ts → WebhookHandlerBaseModule (mínimo) → Apenas necessário
worker.ts → WorkerModule → AppModule (completo)
```

**Prós**:
- ✅ Webhook handler mais leve (~100-150MB)
- ✅ Mantém compatibilidade com código existente
- ✅ Migração gradual possível
- ✅ Workers mantêm NestJS completo

**Contras**:
- ⚠️ Ainda tem overhead do NestJS (menor, mas existe)
- ⚠️ Não é tão leve quanto Fastify

**Quando usar**: Migração gradual, manter compatibilidade

---

## Comparação de Performance

| Opção | Memória Webhook | Startup Webhook | Memória Worker | Startup Worker | Complexidade |
|-------|----------------|-----------------|----------------|----------------|--------------|
| **1. NestJS Completo** | ~500MB | ~30s | ~500MB | ~30s | ⭐ Baixa |
| **2. Fastify + NestJS** | ~50-100MB | ~2-5s | ~500MB | ~30s | ⭐⭐ Média |
| **3. Fastify + Workers Leves** | ~30-50MB | ~1-2s | ~50-100MB | ~2-5s | ⭐⭐⭐ Alta |
| **4. NestJS Minimal** | ~100-150MB | ~5-10s | ~500MB | ~30s | ⭐⭐ Média |

---

## Recomendação por Cenário

### 🚀 MVP / Prototipagem
**Opção 1** (NestJS Completo)
- Rápido de implementar
- Depois migra para Opção 2 ou 4

### 📈 Produção (Volume Médio)
**Opção 2** (Fastify + NestJS)
- Webhook handler leve e rápido
- Workers mantêm toda infraestrutura necessária
- Melhor custo/benefício

### 🔥 Produção (Alto Volume)
**Opção 3** (Fastify + Workers Leves)
- Máxima performance
- Menor custo de infraestrutura
- Requer mais desenvolvimento

### 🔄 Migração Gradual
**Opção 4** (NestJS Minimal)
- Mantém compatibilidade
- Reduz overhead gradualmente
- Permite evoluir para Opção 2 depois

---

## Implementação Recomendada: Opção 2 (Fastify + NestJS)

### Webhook Handler com Fastify

```typescript
// src/webhook-handler-fastify.ts
import Fastify from 'fastify';
import { rabbitmq } from './infra/rabbitmq';
import { validateWebhook } from './utils/webhook-validation';

const app = Fastify({ logger: true });

app.post('/github/webhook', async (request, reply) => {
    // Validar signature
    if (!validateWebhook(request.headers, request.body)) {
        return reply.code(401).send('Unauthorized');
    }
    
    // Enfileirar job
    await rabbitmq.publish('workflow.jobs.code-review', {
        platform: 'github',
        event: request.headers['x-github-event'],
        payload: request.body,
    });
    
    return reply.code(202).send('Webhook received');
});

app.listen({ port: 3332, host: '0.0.0.0' });
```

**Benefícios**:
- ~50-100MB de memória
- Startup ~2-5 segundos
- 2-3x mais rápido que NestJS
- Código simples e direto

### Workers mantêm NestJS

Workers precisam de:
- TypeORM (database)
- LLM modules
- AST modules
- Code review logic
- Toda infraestrutura de processamento

NestJS faz sentido aqui porque:
- Organiza código complexo
- DI facilita testes
- Módulos facilitam manutenção
- Já está implementado

---

## Próximos Passos

1. **Decidir estratégia**: Opção 2 (Fastify + NestJS) é recomendada
2. **Implementar webhook handler Fastify**: Substituir NestJS por Fastify
3. **Manter workers NestJS**: Já está correto
4. **Medir performance**: Comparar antes/depois
5. **Otimizar conforme necessário**: Escalar conforme volume

---

## Conclusão

**Para webhook handler**: Fastify é melhor escolha
- Mais leve
- Mais rápido
- Código mais simples
- Não precisa de toda infraestrutura NestJS

**Para workers**: NestJS faz sentido
- Código complexo
- Precisa de toda infraestrutura
- DI e módulos ajudam
- Já está implementado

**Recomendação final**: Opção 2 (Fastify + NestJS)

