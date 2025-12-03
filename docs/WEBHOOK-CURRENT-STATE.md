# Estado Atual do Webhook Handler

## 🎯 Objetivo

Focar no webhook handler e entender o que precisa ser ajustado.

---

## 📊 Estado Atual

### ✅ O Que Já Está Pronto

1. **Estrutura de Apps**:
    - ✅ `apps/webhooks/src/main.ts` configurado
    - ✅ Porta 3332 configurada
    - ✅ Entry point funcionando

2. **Módulos Criados**:
    - ✅ `WebhookHandlerModule` (entry module)
    - ✅ `WebhookHandlerBaseModule` (base mínima)
    - ✅ `WebhookEnqueueModule` (enfileirar webhooks)
    - ✅ `WebhookHealthModule` (health check)

3. **Use Case Criado**:
    - ✅ `EnqueueWebhookUseCase` (enfileira payload bruto)

---

### ❌ O Que Precisa Ser Ajustado

1. **Controllers Ainda Usam `ReceiveWebhookUseCase`**:
    - ❌ `GithubController` usa `ReceiveWebhookUseCase` (antigo)
    - ❌ `GitlabController` usa `ReceiveWebhookUseCase` (antigo)
    - ❌ `BitbucketController` usa `ReceiveWebhookUseCase` (antigo)
    - ❌ `AzureReposController` usa `ReceiveWebhookUseCase` (antigo)

2. **Controllers Ainda Usam Use Cases Pesados**:
    - ❌ `GithubController` usa `GetOrganizationNameUseCase` (não precisa no webhook)
    - ❌ `GithubController` usa `GetIntegrationGithubUseCase` (não precisa no webhook)

3. **Dependências Pesadas**:
    - ❌ `ReceiveWebhookUseCase` carrega `PlatformIntegrationModule`
    - ❌ `PlatformIntegrationModule` carrega handlers pesados
    - ❌ Handlers carregam LLM, AST, Automation, etc.

---

## 🎯 O Que Precisa Ser Feito

### 1. Atualizar Controllers para Usar `EnqueueWebhookUseCase`

**Antes**:

```typescript
// GithubController
constructor(
    private readonly receiveWebhookUseCase: ReceiveWebhookUseCase,
    // ...
) {}

handleWebhook(@Req() req: Request, @Res() res: Response) {
    // Valida signature
    // Log webhook
    this.receiveWebhookUseCase.execute({ ... }); // Processa tudo
    res.status(HttpStatus.OK).send('Webhook received');
}
```

**Depois**:

```typescript
// GithubController
constructor(
    private readonly enqueueWebhookUseCase: EnqueueWebhookUseCase,
    @Inject(WEBHOOK_LOG_SERVICE)
    private readonly webhookLogService: IWebhookLogService,
) {}

async handleWebhook(@Req() req: Request, @Res() res: Response) {
    // 1. Validar signature
    // 2. Log webhook
    // 3. Enfileirar payload bruto (sem processar)
    await this.enqueueWebhookUseCase.execute({
        platformType: 'github',
        event: req.headers['x-github-event'],
        payload: req.body,
    });
    // 4. Retornar 200 OK imediatamente
    res.status(HttpStatus.OK).send('Webhook received');
}
```

---

### 2. Remover Dependências Pesadas dos Controllers

**Remover**:

- ❌ `GetOrganizationNameUseCase` (não precisa no webhook)
- ❌ `GetIntegrationGithubUseCase` (não precisa no webhook)
- ❌ `ReceiveWebhookUseCase` (substituir por `EnqueueWebhookUseCase`)

**Manter**:

- ✅ `EnqueueWebhookUseCase` (enfileira payload bruto)
- ✅ `IWebhookLogService` (log de webhooks)

---

### 3. Verificar Se `WebhookHandlerBaseModule` Está Mínimo

**Verificar se não está importando**:

- ❌ `PlatformIntegrationModule`
- ❌ `GithubModule`
- ❌ `GitlabModule`
- ❌ `BitbucketModule`
- ❌ `AzureReposModule`

**Deve importar apenas**:

- ✅ `WebhookEnqueueModule`
- ✅ `WebhookLogModule`
- ✅ `WebhookHealthModule`
- ✅ Infraestrutura mínima (Config, Log, Database, RabbitMQ)

---

## 📋 Checklist de Ajustes

- [ ] Atualizar `GithubController` para usar `EnqueueWebhookUseCase`
- [ ] Atualizar `GitlabController` para usar `EnqueueWebhookUseCase`
- [ ] Atualizar `BitbucketController` para usar `EnqueueWebhookUseCase`
- [ ] Atualizar `AzureReposController` para usar `EnqueueWebhookUseCase`
- [ ] Remover `GetOrganizationNameUseCase` de `GithubController`
- [ ] Remover `GetIntegrationGithubUseCase` de `GithubController`
- [ ] Verificar se `WebhookHandlerBaseModule` está mínimo
- [ ] Testar webhook handler isoladamente
- [ ] Verificar se build funciona: `yarn build:webhooks`

---

## 🎯 Próximos Passos

1. **Atualizar Controllers** para usar `EnqueueWebhookUseCase`
2. **Remover dependências pesadas** dos controllers
3. **Verificar módulos** para garantir que está mínimo
4. **Testar** webhook handler isoladamente

---

**Quer que eu comece atualizando os controllers?**
