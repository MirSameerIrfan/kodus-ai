# 🤔 Por Que Existem 2 Formas de Rodar?

**Resposta curta**: Na prática, **não precisa ter 2 formas para desenvolvimento**. A separação faz sentido para **produção**, mas para dev local pode ser overkill.

---

## 📊 Diferença Real

### Forma 1: Monolítica (`dev.small`)

**O que acontece**:
- 1 processo roda `ApiModule` que tem **TUDO**:
  - ✅ Controllers HTTP (API REST)
  - ✅ Webhook handlers (GitHub, GitLab, etc)
  - ✅ Workers (processa jobs)
  - ✅ LLM modules
  - ✅ AST modules
  - ✅ Code review execution
  - ✅ Tudo junto!

**Memória**: ~500-800MB  
**Startup**: ~15-30 segundos  
**Complexidade**: Baixa

---

### Forma 2: Monorepo (`dev.monorepo`)

**O que acontece**:
- **3 processos separados**:

  1. **`webhook-handler`** (leve):
     - ✅ Só recebe webhooks
     - ✅ Enfileira jobs no RabbitMQ
     - ❌ **NÃO** carrega LLM/AST/Code Review
     - Memória: ~100-120MB
     - Startup: ~5-7 segundos

  2. **`api-rest`** (completo):
     - ✅ API REST completa (dashboard, admin)
     - ✅ Todos os controllers
     - ✅ LLM, AST, Code Review (para consultas)
     - Memória: ~500-800MB
     - Startup: ~15-30 segundos

  3. **`worker`** (processamento):
     - ✅ Só processa jobs da fila
     - ✅ LLM, AST, Code Review execution
     - ❌ Sem HTTP (não expõe endpoints)
     - Memória: ~500-800MB
     - Startup: ~15-30 segundos

**Total**: ~1.1-1.7GB de memória  
**Complexidade**: Alta

---

## 🎯 Vantagens da Separação (Monorepo)

### 1. **Performance do Webhook Handler**

**Monolítica**: Webhook handler carrega TUDO (LLM, AST, etc) mesmo que não use
- Startup lento (~15-30s)
- Memória alta (~500-800MB)
- Resposta mais lenta para webhooks

**Monorepo**: Webhook handler é leve
- Startup rápido (~5-7s)
- Memória baixa (~100-120MB)
- Resposta rápida para webhooks (só enfileira)

### 2. **Escalabilidade**

**Monolítica**: 
- Se precisa escalar, escala tudo junto
- Não pode escalar só workers

**Monorepo**:
- Pode escalar workers independentemente
- Pode ter 10 workers e 1 webhook handler
- Escalabilidade granular

### 3. **Isolamento de Falhas**

**Monolítica**:
- Se worker crasha, API também crasha
- Tudo junto = tudo cai junto

**Monorepo**:
- Se worker crasha, webhook handler continua funcionando
- Isolamento de falhas

---

## ❌ Desvantagens da Separação

### 1. **Complexidade**

- 3 containers para gerenciar
- 3 processos para debugar
- Mais configuração
- Mais pontos de falha

### 2. **Recursos**

- Mais memória total (~1.1-1.7GB vs ~500-800MB)
- Mais CPU
- Mais overhead de containers

### 3. **Desenvolvimento**

- Mais difícil de debugar
- Mais lento para começar
- Mais configuração necessária

---

## 💡 Quando Usar Cada Uma?

### Use **Monolítica** (`dev.small`) quando:

✅ **Desenvolvimento local**  
✅ **Testes simples**  
✅ **Setup rápido**  
✅ **Recursos limitados**  
✅ **Não precisa escalar**

**Comando**:
```bash
yarn docker:up
```

---

### Use **Monorepo** (`dev.monorepo`) quando:

✅ **Testando escalabilidade**  
✅ **Simulando produção**  
✅ **Desenvolvendo features específicas de um componente**  
✅ **Precisa de isolamento**  
✅ **Performance crítica (webhooks)**

**Comando**:
```bash
yarn docker:up:monorepo
```

---

## 🎯 Recomendação Honesta

### Para Desenvolvimento Diário

**Use `dev.small` (monolítica)** ✅

**Por quê**:
- Mais simples
- Mais rápido para começar
- Menos recursos
- Funciona perfeitamente para dev

### Para Produção

**Use Monorepo** ✅

**Por quê**:
- Escalabilidade independente
- Performance melhor (webhook handler leve)
- Isolamento de falhas
- Mais próximo do ambiente real

---

## 🤷 Conclusão

**A separação faz sentido para produção, mas para desenvolvimento local pode ser overkill.**

Se você está desenvolvendo features, debugando, testando... **use `dev.small`**. É mais simples e funciona bem.

A forma monorepo existe principalmente para:
1. Testar a arquitetura de produção
2. Desenvolver features específicas de um componente
3. Simular escalabilidade

**Mas para 90% do desenvolvimento diário, `dev.small` é suficiente.**

---

## 📝 Resumo

| Aspecto | Monolítica | Monorepo |
|---------|------------|----------|
| **Complexidade** | Baixa ✅ | Alta ❌ |
| **Recursos** | Menos ✅ | Mais ❌ |
| **Setup** | Rápido ✅ | Lento ❌ |
| **Escalabilidade** | Limitada ❌ | Excelente ✅ |
| **Performance Webhooks** | Boa ✅ | Excelente ✅ |
| **Isolamento** | Não ❌ | Sim ✅ |
| **Uso Dev** | ✅ Recomendado | ⚠️ Overkill |
| **Uso Prod** | ⚠️ Limitado | ✅ Recomendado |

---

**TL;DR**: Use `dev.small` para desenvolvimento. Monorepo é para produção/simulação de produção.

