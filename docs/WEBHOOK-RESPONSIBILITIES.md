# Responsabilidades: Webhook Handler vs Worker vs API

## 🎯 Objetivo do Webhook Handler

**O que deveria fazer**:

1. ✅ Receber evento do webhook
2. ✅ Validar signature (segurança)
3. ✅ Retornar 200 OK imediatamente (não bloquear)
4. ✅ Enfileirar payload bruto na fila

**O que NÃO deveria fazer**:

- ❌ Decidir qual handler usar
- ❌ Processar lógica de negócio
- ❌ Validar organização/team
- ❌ Executar code review
- ❌ Salvar PRs
- ❌ Gerar issues

---

## 🔍 Análise Atual vs Ideal

### Atual (Complexo)

```
Webhook → GithubController
    ↓
ReceiveWebhookUseCase (decide qual handler)
    ↓
GitHubPullRequestHandler (processa, valida, decide workflow queue ou síncrono)
    ↓
EnqueueCodeReviewJobUseCase (se workflow queue habilitado)
    OU
RunCodeReviewAutomationUseCase (se workflow queue desabilitado)
```

**Problemas**:

- Webhook handler precisa conhecer todos os handlers
- Webhook handler precisa validar organização/team
- Webhook handler precisa decidir workflow queue ou síncrono
- Webhook handler precisa processar lógica de negócio
- Webhook handler fica pesado (~100-120MB)

---

### Ideal (Simples)

```
Webhook → GithubController
    ↓
Validar signature
    ↓
Enfileirar payload bruto na fila (sem processar)
    ↓
Retornar 200 OK
```

```
Worker → Consumir da fila
    ↓
Identificar plataforma (GitHub, GitLab, etc.)
    ↓
Decidir qual handler usar
    ↓
Validar organização/team
    ↓
Processar webhook
    ↓
Executar lógica de negócio (code review, etc.)
```

**Vantagens**:

- Webhook handler é **ultra leve** (~10-20MB)
- Webhook handler é **stateless** (fácil escalar)
- Webhook handler é **rápido** (~100-200ms response time)
- Worker faz **todo o processamento pesado**
- Separação clara de responsabilidades

---

## 📋 Responsabilidades por Módulo

### Webhook Handler

**Responsabilidades**:

1. ✅ Receber webhook HTTP
2. ✅ Validar signature (GitHub secret, GitLab token, etc.)
3. ✅ Extrair payload bruto
4. ✅ Enfileirar payload bruto na fila RabbitMQ
5. ✅ Retornar 200 OK imediatamente

**Não Faz**:

- ❌ Não processa payload
- ❌ Não valida organização/team
- ❌ Não decide qual handler usar
- ❌ Não executa lógica de negócio

**Dependências Mínimas**:

- `ConfigModule` (variáveis de ambiente)
- `RabbitMQWrapperModule` (enfileirar)
- `WebhookLogModule` (log de webhooks recebidos)
- `HealthModule` (health check)

**Tamanho Esperado**: ~10-20MB, ~500ms-1s startup

---

### Worker

**Responsabilidades**:

1. ✅ Consumir mensagens da fila RabbitMQ
2. ✅ Identificar plataforma (GitHub, GitLab, Bitbucket, Azure Repos)
3. ✅ Decidir qual handler usar (`GitHubPullRequestHandler`, etc.)
4. ✅ Validar organização/team
5. ✅ Processar webhook (extrair dados, validar PR, etc.)
6. ✅ Executar lógica de negócio:
    - Salvar PR
    - Enfileirar code review job (se workflow queue habilitado)
    - OU executar code review diretamente (se workflow queue desabilitado)
    - Gerar issues quando PR fecha
    - Sincronizar Kody Rules quando PR merge

**Dependências**:

- `WorkflowQueueModule` completo
- `PlatformIntegrationModule` completo
- `CodebaseModule` completo
- `AutomationModule` completo
- Todos os módulos pesados

**Tamanho Esperado**: ~200-300MB, ~10-15s startup

---

### API REST

**Responsabilidades**:

1. ✅ Endpoints administrativos (GET /workflow-queue/jobs, etc.)
2. ✅ Endpoints de integração (GET /github/organization-name, etc.)
3. ✅ Endpoints de configuração
4. ✅ Autenticação/autorização (JWT)

**Não Faz**:

- ❌ Não recebe webhooks (webhook handler faz isso)
- ❌ Não processa jobs (worker faz isso)

**Dependências**:

- `AppModule` completo
- Todos os módulos de domínio

**Tamanho Esperado**: ~300-400MB, ~15-20s startup

---

## 🚀 Implementação Ideal

### Webhook Handler (Ultra Leve)

```typescript
// github.controller.ts
@Controller('github')
export class GithubController {
    constructor(
        private readonly enqueueWebhookUseCase: EnqueueWebhookUseCase,
        @Inject(WEBHOOK_LOG_SERVICE)
        private readonly webhookLogService: IWebhookLogService,
    ) {}

    @Post('/webhook')
    async handleWebhook(@Req() req: Request, @Res() res: Response) {
        const event = req.headers['x-github-event'] as string;
        const payload = req.body;

        // Validar signature
        if (!this.validateSignature(req, payload)) {
            return res.status(401).send('Invalid signature');
        }

        // Retornar 200 OK imediatamente
        res.status(200).send('Webhook received');

        // Processar assincronamente
        setImmediate(async () => {
            // Log webhook
            await this.webhookLogService.log(
                PlatformType.GITHUB,
                event,
                payload,
            );

            // Enfileirar payload bruto na fila
            await this.enqueueWebhookUseCase.execute({
                platformType: PlatformType.GITHUB,
                event,
                payload, // Payload bruto, sem processar
            });
        });
    }
}
```

```typescript
// enqueue-webhook.use-case.ts
@Injectable()
export class EnqueueWebhookUseCase {
    constructor(private readonly rabbitMQService: RabbitMQJobQueueService) {}

    async execute(params: {
        platformType: PlatformType;
        event: string;
        payload: any;
    }): Promise<void> {
        // Enfileirar payload bruto na fila
        await this.rabbitMQService.publish('workflow.webhooks.queue', {
            platformType: params.platformType,
            event: params.event,
            payload: params.payload, // Payload bruto
        });
    }
}
```

**Módulos Necessários**:

- `ConfigModule`
- `RabbitMQWrapperModule`
- `WebhookLogModule`
- `HealthModule`

**Tamanho**: ~10-20MB ✅

---

### Worker (Processa Tudo)

```typescript
// webhook-processor.service.ts
@Injectable()
export class WebhookProcessorService {
    constructor(
        private readonly receiveWebhookUseCase: ReceiveWebhookUseCase,
        // Handlers
        @Inject('GITHUB_WEBHOOK_HANDLER')
        private readonly githubHandler: IWebhookEventHandler,
        // ... outros handlers
    ) {}

    @RabbitSubscribe({
        exchange: 'workflow.exchange',
        routingKey: 'webhook.*',
        queue: 'workflow.webhooks.queue',
    })
    async processWebhook(message: {
        platformType: PlatformType;
        event: string;
        payload: any;
    }) {
        // Identificar plataforma e processar
        await this.receiveWebhookUseCase.execute({
            platformType: message.platformType,
            event: message.event,
            payload: message.payload,
        });
    }
}
```

```typescript
// receive-webhook.use-case.ts (no worker)
@Injectable()
export class ReceiveWebhookUseCase {
    constructor(
        @Inject('GITHUB_WEBHOOK_HANDLER')
        private readonly githubHandler: IWebhookEventHandler,
        // ... outros handlers
    ) {}

    async execute(params: IWebhookEventParams): Promise<void> {
        // Decidir qual handler usar
        const handler = this.getHandler(params.platformType);

        if (handler && handler.canHandle(params)) {
            // Processar webhook (validação, lógica de negócio, etc.)
            await handler.execute(params);
        }
    }
}
```

**Módulos Necessários**:

- `WorkflowQueueModule` completo
- `PlatformIntegrationModule` completo
- `CodebaseModule` completo
- `AutomationModule` completo
- Todos os módulos pesados

**Tamanho**: ~200-300MB ✅

---

## 📊 Comparação: Antes vs Depois

### Antes (Atual)

**Webhook Handler**:

- Recebe webhook
- Decide qual handler usar
- Valida organização/team
- Processa webhook
- Decide workflow queue ou síncrono
- Executa lógica de negócio (ou enfileira)
- **Tamanho**: ~100-120MB, ~5-7s startup

**Worker**:

- Consome jobs da fila
- Processa code review
- **Tamanho**: ~200-300MB, ~10-15s startup

---

### Depois (Ideal)

**Webhook Handler**:

- Recebe webhook
- Valida signature
- Enfileirar payload bruto
- Retorna 200 OK
- **Tamanho**: ~10-20MB, ~500ms-1s startup ✅

**Worker**:

- Consome webhooks da fila
- Identifica plataforma
- Decide qual handler usar
- Valida organização/team
- Processa webhook
- Executa lógica de negócio
- **Tamanho**: ~200-300MB, ~10-15s startup ✅

---

## 🎯 Resposta Direta

### Quem decide qual handler usar?

**RESPOSTA**: **WORKER** ✅

- Webhook handler **NÃO** decide
- Worker **decide** qual handler usar baseado na plataforma

### Quem processa lógica de negócio?

**RESPOSTA**: **WORKER** ✅

- Webhook handler **NÃO** processa
- Worker **processa** toda a lógica de negócio

### O que o webhook handler faz?

**RESPOSTA**: **Apenas recebe, valida signature, enfileira e retorna 200 OK** ✅

---

## 🚀 Próximos Passos

1. **Criar `EnqueueWebhookUseCase`** (ultra simples)
2. **Refatorar controllers** para apenas enfileirar payload bruto
3. **Mover `ReceiveWebhookUseCase`** para o worker
4. **Mover handlers** para o worker
5. **Remover `PlatformIntegrationModule`** do webhook handler
6. **Remover módulos pesados** do webhook handler
7. **Testar** que tudo funciona

---

**Quer que eu implemente essa arquitetura ideal agora?**
