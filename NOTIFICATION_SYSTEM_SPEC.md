# Especificação: Sistema de Notificações Multi-Canal

## 📋 Resumo

Implementar um sistema completo de notificações multi-canal que permita notificar usuários via **Email** (Customer.io), **Webhooks** (Slack, Discord, custom) e **In-App**, com controle granular de preferências e bloqueios por usuário.

---

## 🎯 Objetivos

1. **Substituir sistema atual** que usa apenas email (MailerSend)
2. **Adicionar suporte a múltiplos canais**: Email, Webhook, In-App
3. **Permitir que usuários controlem** quais notificações recebem e por quais canais
4. **Permitir cadastro de webhooks customizados** pelo usuário
5. **Implementar notificações in-app** com marcação de lida/não lida
6. **Manter auditoria completa** de todas as entregas

---

## 🏗️ Arquitetura

### Decisão Arquitetural

✅ **Módulo dentro da mesma aplicação + RabbitMQ** (não criar microserviço separado)

**Justificativa:**

- RabbitMQ já está configurado e funcionando
- Arquitetura modular permite isolamento sem complexidade adicional
- Pode evoluir para microserviço depois se necessário
- Menos overhead operacional

### Fluxo de Processamento

```
Use Case ou Service (quando precisa disparar notificação)
    ↓
NotificationService.notify()
    ↓
1. Busca notification_types
2. Determina lista de destinatários (user/team/org)
3. Para cada canal habilitado:
   - Verifica user_notification_preferences
   - Publica mensagem na fila RabbitMQ (com dados necessários)
    ↓
RabbitMQ Exchange: `notifications.exchange` (tipo: `topic`, durable: true)
    ├── Queue: `notifications.email.queue` → Email Consumer → Customer.io
    │   └── Routing Key: `notification.email.send`
    ├── Queue: `notifications.webhook.queue` → Webhook Consumer → Slack/Discord/Custom
    │   └── Routing Key: `notification.webhook.send`
    └── Queue: `notifications.inapp.queue` → In-App Consumer → Database
        └── Routing Key: `notification.inapp.send`

**Configuração RabbitMQ:**
- Exchange: `notifications.exchange` (tipo `topic`, durable)
- Dead Letter Exchange: `orchestrator.exchange.dlx` (já existe)
- Dead Letter Routing Key: `notification.{channel}.failed`
- Queue Options: `durable: true`, `createQueueIfNotExists: true`
```

---

## 📊 Estrutura de Banco de Dados

### Tabelas Necessárias

#### 1. `notification_types`

**Propósito:** ENUM de todos os tipos de notificações disponíveis no sistema

**Campos principais:**

- `uuid` (PK)
- `createdAt`, `updatedAt`
- `type` (ENUM, UNIQUE): Identificador único do tipo
- `name` (varchar): Nome legível
- `description` (text): Descrição do tipo
- `category` (varchar): Categoria (system, code_review, automation, team, billing)
- `defaultChannels` (JSONB): Canais habilitados por padrão `["email", "inapp"]`
- `metadata` (JSONB): Dados adicionais (ícone, cor, prioridade)
- `active` (boolean): Se o tipo está ativo

**Configuração de `defaultChannels`:**

Esses campos são **configurados pela equipe de desenvolvimento** via **Seeder** quando o sistema é inicializado ou quando novos tipos de notificação são adicionados.

**Exemplos de configuração:**

```typescript
// Seeder: src/config/database/typeorm/seed/notification-types.seeder.ts

// Tipo comum - email e in-app por padrão
{
  type: NotificationType.KODY_RULES_CREATED,
  defaultChannels: ["email", "inapp"],
}

// Tipo crítico - apenas email por padrão (usuário pode desabilitar se quiser)
{
  type: NotificationType.PASSWORD_RESET_REQUESTED,
  defaultChannels: ["email"],
}

// Tipo informativo - apenas in-app por padrão
{
  type: NotificationType.CODE_REVIEW_COMPLETED,
  defaultChannels: ["inapp"],
}

// Tipo importante - todos os canais habilitados por padrão
{
  type: NotificationType.QUOTA_LIMIT_REACHED,
  defaultChannels: ["email", "webhook", "inapp"],
}
```

**Lógica de funcionamento:**

1. **`defaultChannels`**: Se o usuário não configurou preferências, usa esses canais por padrão
2. **Preferências do usuário**: Usuário pode habilitar/desabilitar qualquer canal via `user_notification_preferences`
3. **Se usuário não configurou**: Usa `defaultChannels`
4. **Se usuário configurou**: Usa preferências do usuário (pode remover canais do default se quiser)

**Quem configura:**

- ✅ **Equipe de desenvolvimento** via Seeder (código versionado)
- ✅ **Administradores do sistema** podem atualizar via migration/seeder quando necessário
- ❌ **Usuários finais** não configuram esses campos (eles configuram apenas suas preferências em `user_notification_preferences`)

**Tipos de notificação a implementar:**

- `KODY_RULES_CREATED`, `KODY_RULES_UPDATED`, `KODY_RULES_DELETED`, `KODY_RULES_SYNC`
- `ISSUE_CREATED`, `ISSUE_RESOLVED`, `ISSUE_ASSIGNED`
- `LICENSE_EXPIRING`, `LICENSE_EXPIRED`
- `PASSWORD_RESET_REQUESTED`
- `EMAIL_CONFIRMATION`

**Índices:**

- `IDX_notification_types_type` (type)
- `IDX_notification_types_category` (category)
- `IDX_notification_types_active` (active) WHERE active = true

---

#### 2. Configuração de Templates por Canal

**Propósito:** Mapear templates e formatadores para cada tipo de notificação e canal

**Estrutura:**

```
src/shared/utils/notifications/config/
├── email-templates.config.ts      # Mapeamento: NotificationType → Customer.io templateId
├── webhook-formatters.config.ts   # Formatters para Slack/Discord/Teams
└── inapp-templates/               # Templates JSON apenas para in-app
    ├── schema.json
    ├── KODY_RULES_CREATED.json
    ├── CODE_REVIEW_COMPLETED.json
    └── ...
```

**Email (Customer.io):**

Não precisa de templates JSON! Customer.io já tem os templates próprios. Só precisamos:

1. **Mapear** `NotificationType` → `Customer.io templateId` (config)
2. **Enviar dados** via `personalization` para o Customer.io

**Exemplo de configuração (`email-templates.config.ts`):**

```typescript
// Mapeamento: NotificationType → Customer.io templateId
export const EMAIL_TEMPLATE_MAP: Record<NotificationType, string> = {
    [NotificationType.KODY_RULES_CREATED]: 'yzkq340nv50gd796',
    [NotificationType.PASSWORD_RESET_REQUESTED]: 'abc123xyz',
    [NotificationType.EMAIL_CONFIRMATION]: '7dnvo4dzko6l5r86',
    // ... outros tipos
};

// Mapeamento: NotificationType → campos esperados pelo template
// Esses campos serão passados como "attributes" para o Customer.io
export const EMAIL_TEMPLATE_FIELDS: Record<NotificationType, string[]> = {
    [NotificationType.KODY_RULES_CREATED]: [
        'organizationName',
        'rulesCount',
        'actionUrl',
    ],
    [NotificationType.PASSWORD_RESET_REQUESTED]: [
        'userName',
        'resetLink',
        'expirationMinutes',
    ],
    [NotificationType.EMAIL_CONFIRMATION]: [
        'userName',
        'confirmationLink',
        'organizationName',
    ],
    // ... outros tipos
};
```

**Como funciona:**

1. **Template no Customer.io** usa variáveis Liquid: `{{organizationName}}`, `{{rulesCount}}`, etc.
2. **Backend** recebe `data` do `NotificationService.notify()`
3. **EmailTemplateConfigService** formata os dados conforme campos esperados:
    ```typescript
    getPersonalizationData(notificationType: NotificationType, data: Record<string, unknown>) {
      // Mapeia data para formato esperado pelo Customer.io
      // Exemplo: { organizationName: data.orgName, rulesCount: data.count }
      return {
        organizationName: data.organizationName,
        rulesCount: data.rulesCount,
        actionUrl: data.actionUrl || 'https://app.kodus.io/kody-rules'
      };
    }
    ```
4. **CustomerIoService** envia email com `attributes`:
    ```typescript
    await customerIo.sendEmail({
        to: userEmail,
        transactional_message_id: templateId,
        message_data: {
            // Dados que serão usados no template
            organizationName: 'Acme Corp',
            rulesCount: 5,
            actionUrl: '/kody-rules',
        },
    });
    ```

**Webhook:**

Não precisa de templates complexos! Só precisa de formatters simples para estruturar o payload conforme a plataforma.

**Exemplo (`webhook-formatters.config.ts`):**

```typescript
export function formatSlackMessage(
  notificationType: NotificationType,
  data: Record<string, unknown>
): SlackPayload {
  // Lógica simples de formatação baseada no tipo
  // Retorna payload formatado para Slack
}

export function formatDiscordMessage(...): DiscordPayload { ... }
export function formatTeamsMessage(...): TeamsPayload { ... }
```

**In-App:**

**IMPORTANTE:** O front-end vai renderizar! Backend só precisa salvar os dados.

**Como funciona:**

- Backend salva: `templateId` (notificationType) + `data` (dados brutos)
- Front-end busca template e renderiza:
    - Substitui variáveis `{{variable}}` pelos valores de `data`
    - Renderiza Markdown usando biblioteca como `react-markdown`
- Templates podem ser atualizados sem mudar backend
- Suporte a Markdown para formatação rica (negrito, itálico, links, listas, código)

**Markdown:**

- Templates sempre usam Markdown no campo `body` para formatação rica
- Front-end sempre renderiza Markdown usando biblioteca como `react-markdown`
- Variáveis `{{variable}}` são substituídas antes de renderizar Markdown

**Estrutura de pastas para templates in-app (no backend, para referência):**

```
src/shared/utils/notifications/config/inapp-templates/
├── schema.json                    # Schema JSON para validação
├── KODY_RULES_CREATED.json
├── CODE_REVIEW_COMPLETED.json
└── ...
```

**No banco (`notifications`):**

- `templateId`: ID do template (notificationType)
- `data` (JSONB): Dados brutos para renderização
- Front-end busca template e renderiza quando exibir:
    1. Substitui variáveis `{{variable}}` pelos valores de `data`
    2. Renderiza Markdown usando biblioteca como `react-markdown`

**Schema JSON para In-App (`inapp-templates/schema.json`):**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["notificationType", "version", "title", "body"],
  "properties": {
    "notificationType": {
      "type": "string",
      "enum": ["KODY_RULES_CREATED", "CODE_REVIEW_COMPLETED", ...]
    },
    "version": {
      "type": "integer",
      "minimum": 1
    },
    "title": {
      "type": "string",
      "description": "Título da notificação"
    },
    "body": {
      "type": "string",
      "description": "Corpo do template com variáveis {{variable}}. Sempre em formato Markdown para formatação rica."
    },
    "actionUrl": {
      "type": "string",
      "format": "uri",
      "description": "URL de ação (ex: link para PR)"
    },
    "actionLabel": {
      "type": "string",
      "description": "Label do botão de ação"
    },
    "priority": {
      "type": "integer",
      "enum": [0, 1, 2],
      "default": 0,
      "description": "0=normal, 1=high, 2=urgent"
    },
    "metadata": {
      "type": "object",
      "description": "Dados adicionais do template"
    },
    "active": {
      "type": "boolean",
      "default": true
    }
  }
}
```

**Exemplo de template In-App (`inapp-templates/KODY_RULES_CREATED.json`):**

```json
{
    "notificationType": "KODY_RULES_CREATED",
    "version": 1,
    "title": "New Kody Rules Generated",
    "body": "**{{organizationName}}** has {{rulesCount}} new Kody rules available.\n\n- Review the rules\n- Apply to your codebase\n- Share with your team",
    "actionUrl": "/kody-rules",
    "actionLabel": "View Rules",
    "priority": 0,
    "active": true
}
```

**Exemplo com Markdown:**

```json
{
    "notificationType": "CODE_REVIEW_COMPLETED",
    "version": 1,
    "title": "Code Review Completed",
    "body": "Code review for **{{prTitle}}** has been completed.\n\n**Reviewer:** {{reviewerName}}\n**Status:** {{status}}\n\n[View PR]({{prUrl}})",
    "actionUrl": "/pull-requests/{{prId}}",
    "actionLabel": "View PR",
    "priority": 1,
    "active": true
}
```

**Suporte a Markdown:**

- **Negrito:** `**texto**` → **texto**
- **Itálico:** `*texto*` → _texto_
- **Links:** `[texto](url)` → [texto](url)
- **Listas:** `- item` ou `1. item`
- **Código inline:** `` `código` ``
- **Código block:** ` ```código``` `
- **Quebras de linha:** `\n\n`

**Front-end:**

- Renderiza Markdown usando biblioteca como `react-markdown`, `marked`, ou similar
- Variáveis `{{variable}}` são substituídas antes de renderizar Markdown
- Suporta HTML seguro (sanitização automática)

**Vantagens desta abordagem:**

- ✅ Versionamento via Git
- ✅ Facilita edição e revisão de templates
- ✅ Validação via schema JSON
- ✅ Não precisa de migrations para mudar templates
- ✅ Pode ter múltiplas versões do mesmo template
- ✅ Cache em memória para performance

**Services responsáveis:**

- `EmailTemplateConfigService`: Mapeia NotificationType → Customer.io templateId
- `WebhookFormatterService`: Formata payloads para Slack/Discord/Teams
- `InAppTemplateLoaderService`: Carrega e valida templates JSON apenas para in-app
- `InAppTemplateCacheService`: Cache de templates in-app em memória

---

#### 3. `notifications`

**Propósito:** Notificações in-app para usuários

**Campos principais:**

- `uuid` (PK)
- `createdAt`, `updatedAt`
- `userId` (FK, nullable): Usuário destinatário específico
- `organizationId` (FK): Organização (sempre obrigatório)
- `teamId` (FK, nullable): Time destinatário específico
- `notificationType` (FK): Tipo de notificação
- `status` (ENUM): Estado (pending, sent, read)
- `templateId` (varchar): ID do template (ou pode ser o tipo de notificação)
- `data` (JSONB): Dados brutos para renderização no front-end
    ```json
    {
        "organizationName": "Acme Corp",
        "rulesCount": 5,
        "actionUrl": "/kody-rules"
    }
    ```
- `readAt` (timestamp, nullable): Quando foi lida
- `metadata` (JSONB, nullable): Dados contextuais (ex: `{prNumber: 123, rulesCount: 5}`)
- `priority` (integer): Prioridade

**Lógica de Escopo:**

- Se `userId` preenchido: Notificação para usuário específico
- Se `teamId` preenchido (e `userId` null): Notificação para todo o time
- Se ambos null: Notificação para toda a organização
- `organizationId` sempre obrigatório (todas as notificações pertencem a uma org)

**Índices:**

- `IDX_notifications_user` (userId)
- `IDX_notifications_user_status` (userId, status)
- `IDX_notifications_user_created` (userId, createdAt DESC)
- `IDX_notifications_unread` (userId, status) WHERE status = 'sent'
- `IDX_notifications_organization` (organizationId)
- `IDX_notifications_team` (teamId)
- `IDX_notifications_org_team` (organizationId, teamId)

---

#### 4. `user_notification_preferences`

**Propósito:** Preferências e bloqueios do usuário por tipo e canal

**Campos principais:**

- `uuid` (PK)
- `createdAt`, `updatedAt`
- `userId` (FK): Usuário
- `notificationType` (FK): Tipo de notificação
- `channel` (ENUM): Canal (email, webhook, inapp)
- `enabled` (boolean): Se o canal está habilitado (false = bloqueado)
- `metadata` (JSONB, nullable): Configurações adicionais (ex: quiet hours)

**Unique constraint:** `(userId, notificationType, channel)`

**Lógica:**

- Se não existe registro, usa `defaultChannels` do `notification_types`
- Se `enabled = false`, a notificação não é enviada por aquele canal
- Usuário pode habilitar/desabilitar qualquer canal via preferências

**Índices:**

- `IDX_user_notification_preferences_user` (userId)
- `IDX_user_notification_preferences_type` (notificationType)
- `IDX_user_notification_preferences_enabled` (userId, enabled) WHERE enabled = false

---

#### 5. `user_webhooks`

**Propósito:** Webhooks customizados cadastrados pelos usuários

**Campos principais:**

- `uuid` (PK)
- `createdAt`, `updatedAt`
- `userId` (FK): Usuário dono do webhook
- `organizationId` (FK): Organização (sempre obrigatório)
- `teamId` (FK, nullable): Time (opcional, para webhooks específicos de time)
- `name` (varchar): Nome descritivo (ex: "Slack #dev-team")
- `url` (varchar): URL do webhook
- `platform` (ENUM): Plataforma (slack, discord, teams, custom)
- `status` (ENUM): Estado (active, inactive, failed)
- `lastTriggeredAt` (timestamp, nullable): Última vez que foi acionado
- `lastErrorAt` (timestamp, nullable): Último erro
- `lastErrorMessage` (text, nullable): Mensagem do último erro
- `failureCount` (integer): Contador de falhas (para desabilitar após N falhas)

**Índices:**

- `IDX_user_webhooks_user` (userId)
- `IDX_user_webhooks_active` (userId, status) WHERE status = 'active'

---

#### 6. Logs (Collection `log` - MongoDB)

**Propósito:** Auditoria de todas as tentativas de entrega de notificações

**Uso da collection `log` existente:**

Ao invés de criar uma tabela separada, usamos a collection `log` (MongoDB) que já existe no sistema.

**Estrutura do log para notificações:**

```typescript
{
  level: 'info' | 'error' | 'warn',
  message: 'Notification sent successfully',
  serviceName: 'notification-service',
  metadata: {
    type: 'notification_delivery',
    userId: 'uuid',
    organizationId: 'uuid',
    teamId: 'uuid',
    notificationId: 'uuid', // Se in-app
    notificationType: 'KODY_RULES_CREATED',
    channel: 'email' | 'webhook' | 'inapp',
    status: 'pending' | 'sent' | 'delivered' | 'failed',
    recipient: 'user@example.com', // Email, webhook URL, ou user ID
    providerId: 'customer-io-message-id', // ID do provider externo
    providerResponse: {}, // Resposta completa do provider
    sentAt: '2024-01-01T00:00:00Z',
    deliveredAt: '2024-01-01T00:00:01Z',
    openedAt: '2024-01-01T00:00:05Z', // Para email (se disponível)
    clickedAt: '2024-01-01T00:00:10Z', // Para email (se disponível)
    errorMessage: null, // Se falhou
    retryCount: 0,
    webhookId: 'uuid', // Se webhook customizado
    // ... outros campos contextuais
  },
  timestamp: '2024-01-01T00:00:00Z',
  requestId: 'uuid', // Para rastreamento
  traceId: 'uuid', // Para observabilidade
}
```

**Vantagens:**

- ✅ Usa infraestrutura existente (não precisa criar nova tabela)
- ✅ Logs centralizados para observabilidade
- ✅ Suporta metadata flexível (JSON)
- ✅ Integrado com sistema de tracing (traceId, spanId)
- ✅ Facilita queries e análises de logs
- ✅ Retenção automática conforme política de logs

**Queries de exemplo:**

```typescript
// Buscar entregas de notificação por usuário
logService.find({
    'metadata.type': 'notification_delivery',
    'metadata.userId': userId,
});

// Buscar falhas
logService.find({
    'metadata.type': 'notification_delivery',
    'level': 'error',
    'metadata.status': 'failed',
});

// Buscar por tipo de notificação
logService.find({
    'metadata.type': 'notification_delivery',
    'metadata.notificationType': 'KODY_RULES_CREATED',
});
```

---

## 🔧 Componentes a Implementar

### 1. Domain Layer

#### ENUMs

- `NotificationType` - Tipos de notificação
- `NotificationChannel` - Canais (email, webhook, inapp)
- `NotificationStatus` - Status in-app (pending, sent, read)
- `DeliveryStatus` - Status de entrega (pending, sent, delivered, failed, etc)
- `WebhookPlatform` - Plataformas de webhook (slack, discord, teams, custom)
- `WebhookStatus` - Status do webhook (active, inactive, failed)
- `NotificationCategory` - Categorias (system, code_review, automation, etc)

#### Entities

- `NotificationTypeEntity`
- `NotificationEntity`
- `UserNotificationPreferenceEntity`
- `UserWebhookEntity`

#### Interfaces

- `INotificationType`
- `INotification`
- `IUserNotificationPreference`
- `IUserWebhook`

#### Contracts

- `INotificationTypeRepository`
- `INotificationRepository`
- `IUserNotificationPreferenceRepository`
- `IUserWebhookRepository`
- `INotificationService`
- `IInAppTemplateLoaderService` - Carrega templates JSON apenas para in-app
- `IInAppTemplateCacheService` - Cache de templates in-app em memória

---

### 2. Application Layer (Use Cases)

---

#### `GetUserNotificationsUseCase`

**Responsabilidade:** Buscar notificações in-app do usuário

**Filtros:**

- `status`: pending, sent, read
- `category`: system, code_review, etc.
- `unreadOnly`: boolean
- `limit`, `offset`: paginação

---

#### `MarkNotificationAsReadUseCase`

**Responsabilidade:** Marcar notificação como lida

**Input:**

```typescript
{
    notificationId: string;
    userId: string;
}
```

**Ação:**

- Atualiza `status` para `read`
- Define `readAt` com timestamp atual

---

#### `UpdateNotificationPreferencesUseCase`

**Responsabilidade:** Atualizar preferências do usuário

**Input:**

```typescript
{
  userId: string;
  notificationType: NotificationType;
  channel: NotificationChannel;
  enabled: boolean;
  metadata?: Record<string, unknown>;
}
```

**Validação:**

- Usuário pode desabilitar qualquer canal (não há canais obrigatórios)

---

#### `CreateUserWebhookUseCase`

**Responsabilidade:** Criar webhook customizado

**Input:**

```typescript
{
  userId: string;
  organizationId?: string;
  teamId?: string;
  name: string;
  url: string;
  platform: WebhookPlatform;
}
```

**Validação:**

- Validar URL
- Validar formato do webhook (Slack, Discord, etc)

---

#### `UpdateUserWebhookUseCase`

**Responsabilidade:** Atualizar webhook existente

---

#### `DeleteUserWebhookUseCase`

**Responsabilidade:** Deletar webhook

---

#### `GetUserWebhooksUseCase`

**Responsabilidade:** Listar webhooks do usuário

---

### 3. Infrastructure Layer

#### Repositories (TypeORM)

- `NotificationTypeRepository`
- `NotificationRepository`
- `UserNotificationPreferenceRepository`
- `UserWebhookRepository`
- `LogService` (já existe) - Para auditoria de entregas

#### Template Services

- `InAppTemplateLoaderService`: Carrega templates JSON apenas para in-app do filesystem
    - Valida contra schema JSON
    - Suporta versionamento (múltiplas versões do mesmo template)
    - Cache em memória para performance
- `InAppTemplateCacheService`: Gerencia cache de templates in-app

#### Services

##### `NotificationService`

**Responsabilidade:** Service na camada Infrastructure - **ÚNICO ponto de entrada** para notificações

**Localização:** `src/core/infrastructure/adapters/services/notifications/notification.service.ts`

**Métodos:**

- `notify(params)`: Método público para disparar notificações
    - Contém toda a lógica de negócio de notificações
    - Trata erros para não quebrar fluxo principal
    - Logs para auditoria

**Fluxo interno:**

1. Recebe: `userId`, `organizationId`, `teamId`, `notificationType`, `data` (contexto)
2. Busca `notification_types` pelo tipo
3. Determina lista de destinatários:
    - Se `userId` fornecido: Lista com 1 usuário
    - Se `teamId` fornecido (sem userId): Busca todos os usuários do time via `UserRepository.findByTeamId(teamId)`
    - Se nenhum: Busca todos os usuários da organização via `UserRepository.findByOrganizationId(organizationId)`
4. Determina canais a processar:
    - Se `channels` fornecido no input: Usa esses canais (sobrescreve `defaultChannels`)
    - Caso contrário: Usa `defaultChannels` do `notification_types`
5. Para cada canal determinado:
    - Para cada usuário destinatário:
        - Verifica `user_notification_preferences` do usuário para este `notificationType` e `channel`
        - **Lógica de preferências:**
            - Se existe preferência com `enabled = false`: **pula** este canal para este usuário
            - Se existe preferência com `enabled = true`: **envia** por este canal
            - Se **não existe** preferência: **usa** `defaultChannels` (envia por este canal)
        - Se canal está habilitado (conforme lógica acima):
            - Publica mensagem na fila RabbitMQ com:
                - `userId`, `organizationId`, `teamId`
                - `notificationType`
                - `channel`
                - `data` (dados para renderizar template)
6. Retorna resultado (não propaga erros)

**Nota:** Os logs de entrega são criados pelo **Consumer** quando processa a mensagem, usando a collection `log` existente. Isso evita registros órfãos se a publicação falhar.

**Uso:**

```typescript
// Em qualquer Service (Domain ou Infrastructure)
@Injectable()
export class SomeService {
  constructor(
    private readonly notificationService: NotificationService,
  ) {}

  async doSomething() {
    // Lógica...
    await this.notificationService.notify({
      organizationId,
      notificationType: NotificationType.SOMETHING_HAPPENED,
      data: { ... },
    });
  }
}
```

**Input:**

```typescript
{
  userId?: string; // Opcional: se fornecido, notifica apenas este usuário
  organizationId: string; // Obrigatório: sempre precisa de uma org
  teamId?: string; // Opcional: se fornecido (sem userId), notifica todo o time
  notificationType: NotificationType;
  data: Record<string, unknown>; // Dados para renderizar template
  channels?: NotificationChannel[]; // Opcional: forçar canais específicos (sobrescreve defaultChannels)
}
```

**Lógica de Escopo:**

- Se `userId` fornecido: Cria notificação apenas para este usuário
- Se `teamId` fornecido (sem `userId`): Cria notificação para todos os usuários do time
- Se nenhum fornecido: Cria notificação para todos os usuários da organização

##### `EmailTemplateConfigService`

**Responsabilidade:** Mapear NotificationType para Customer.io templateId e formatar dados

**Métodos:**

- `getTemplateId(notificationType)`: Retorna Customer.io templateId para o tipo
- `getPersonalizationData(notificationType, data)`: Formata dados para `message_data` do Customer.io
    - Mapeia campos do `data` recebido para os campos esperados pelo template
    - Valida campos obrigatórios
    - Adiciona campos padrão se necessário

**Exemplo:**

```typescript
// Input do NotificationService
data = {
  organizationName: 'Acme Corp',
  rulesCount: 5,
  actionUrl: '/kody-rules'
}

// Output formatado para Customer.io
{
  organizationName: 'Acme Corp',
  rulesCount: 5,
  actionUrl: 'https://app.kodus.io/kody-rules'
}
```

---

##### `CustomerIoService`

**Responsabilidade:** Integração com Customer.io para emails

**Métodos:**

- `sendEmail(params)`: Envia email usando template do Customer.io
    ```typescript
    sendEmail({
        to: string, // Email do destinatário
        transactional_message_id: string, // Template ID do Customer.io
        message_data: Record<string, unknown>, // Dados para o template (attributes)
    });
    ```

**Como funciona:**

1. **Customer.io** já tem templates criados na plataforma com variáveis Liquid (ex: `{{organizationName}}`)
2. **Backend** envia:
    - `to`: Email do destinatário
    - `transactional_message_id`: ID do template
    - `message_data`: Objeto com os dados que serão usados no template
3. **Customer.io** renderiza o template substituindo as variáveis pelos valores de `message_data`
4. **Customer.io** envia o email renderizado

**Exemplo de chamada:**

```typescript
await customerIoService.sendEmail({
    to: 'user@example.com',
    transactional_message_id: 'yzkq340nv50gd796', // KODY_RULES_CREATED template
    message_data: {
        organizationName: 'Acme Corp',
        rulesCount: 5,
        actionUrl: 'https://app.kodus.io/kody-rules',
    },
});
```

**Template no Customer.io usa:**

```
Subject: New Kody Rules for {{organizationName}}

Body:
{{organizationName}} has {{rulesCount}} new Kody rules available.
[View Rules]({{actionUrl}})
```

---

##### `WebhookFormatterService`

**Responsabilidade:** Formatar payloads para diferentes plataformas de webhook

**Métodos:**

- `formatSlackMessage(notificationType, data)`: Formata payload para Slack
- `formatDiscordMessage(notificationType, data)`: Formata payload para Discord
- `formatTeamsMessage(notificationType, data)`: Formata payload para Teams
- `formatCustomWebhook(notificationType, data)`: Formata payload genérico

**Lógica:**

- Cada método recebe `notificationType` e `data`
- Retorna payload formatado conforme estrutura esperada pela plataforma
- Não precisa de templates complexos, apenas formatação simples

---

##### `WebhookService`

**Responsabilidade:** Enviar notificações via webhook

**Métodos:**

- `sendWebhook(webhook, payload)`: Envia HTTP POST para webhook
- `retryWithBackoff(webhook, payload)`: Retry com exponential backoff

**Validação:**

- Retry com exponential backoff
- Desabilitar webhook após N falhas consecutivas

---

##### `InAppNotificationService`

**Responsabilidade:** Criar/atualizar notificações in-app

**Métodos:**

- `createNotification(data)`
- `updateNotificationStatus(notificationId, status)`

---

##### `InAppTemplateLoaderService`

**Responsabilidade:** Carrega templates JSON apenas para in-app

**Métodos:**

- `loadTemplate(notificationType)`: Carrega template JSON do filesystem
- `validateTemplate(template)`: Valida contra schema JSON
- Suporta versionamento (múltiplas versões do mesmo template)
- Cache em memória para performance

---

##### `InAppTemplateCacheService`

**Responsabilidade:** Gerencia cache de templates in-app

**Métodos:**

- `get(notificationType)`: Busca template do cache
- `set(notificationType, template)`: Adiciona ao cache
- `clear()`: Limpa cache

---

**Nota:** `TemplateRendererService` não é necessário, pois a renderização é feita no front-end. Email e Webhook não precisam de renderização (Customer.io tem templates próprios, webhooks são formatados via `WebhookFormatterService`).

---

#### RabbitMQ Consumers

##### `EmailNotificationConsumer`

**Queue:** `notifications.email.queue`
**Exchange:** `notifications.exchange` (tipo `topic`)
**Routing Key:** `notification.email.send`
**Dead Letter:** `orchestrator.exchange.dlx` com routing key `notification.email.failed`

**Fluxo:**

1. Recebe mensagem da fila (com userId, organizationId, notificationType, channel, data)
2. **Cria log** via `LogService` (status: pending)
3. Busca `Customer.io templateId` via `EmailTemplateConfigService.getTemplateId(notificationType)`
4. Formata dados via `EmailTemplateConfigService.getPersonalizationData(notificationType, data)`
    - Mapeia campos do `data` para formato esperado pelo template Customer.io
    - Valida campos obrigatórios
5. Busca email do usuário (via userId)
6. Envia via `CustomerIoService.sendEmail({ to, transactional_message_id, message_data })`
7. **Cria log** com resultado (status: delivered, providerId, providerResponse, sentAt, deliveredAt)
8. Se falhar, cria log de erro (status: failed, errorMessage, retryCount)

---

##### `WebhookNotificationConsumer`

**Queue:** `notifications.webhook.queue`
**Exchange:** `notifications.exchange` (tipo `topic`)
**Routing Key:** `notification.webhook.send`
**Dead Letter:** `orchestrator.exchange.dlx` com routing key `notification.webhook.failed`

**Fluxo:**

1. Recebe mensagem da fila (com userId, organizationId, notificationType, channel, data)
2. **Cria log** via `LogService` (status: pending)
3. Busca `user_webhooks` ativos do usuário para esta organização/team:
    - Filtra por `userId`, `organizationId` (e `teamId` se fornecido)
    - Filtra por `status = 'active'`
    - Se não encontrar webhooks customizados, **não envia** (webhook é opcional)
    - Para cada webhook encontrado:
      a. Formata payload via `WebhookFormatterService` conforme plataforma do webhook: - `formatSlackMessage(notificationType, data)` → Slack payload - `formatDiscordMessage(notificationType, data)` → Discord payload - `formatTeamsMessage(notificationType, data)` → Teams payload - `formatCustomWebhook(notificationType, data)` → Payload genérico
      b. Envia via HTTP POST para `webhook.url`
      c. **Atualiza log** com resultado (status: delivered, providerResponse, sentAt, deliveredAt, webhookId)
      d. Atualiza `user_webhooks`: - `lastTriggeredAt` = agora - `failureCount` = 0 (se sucesso) ou incrementa (se falhou) - `status` = 'failed' (se muitas falhas consecutivas, ex: > 5) - `lastErrorAt`, `lastErrorMessage` (se falhou)
      e. Se falhar, cria log de erro (status: failed, errorMessage, retryCount, webhookId)

---

##### `InAppNotificationConsumer`

**Queue:** `notifications.inapp.queue`
**Exchange:** `notifications.exchange` (tipo `topic`)
**Routing Key:** `notification.inapp.send`
**Dead Letter:** `orchestrator.exchange.dlx` com routing key `notification.inapp.failed`

**Fluxo:**

1. Recebe mensagem da fila (com userId, organizationId, teamId, notificationType, channel, data)
2. **Cria log** via `LogService` (status: pending)
3. Cria registro em `notifications`:
    - `status`: sent
    - `templateId`: notificationType (usado pelo front-end para buscar template)
    - `data`: JSONB com dados brutos (data do payload, usado para renderização no front-end)
    - `organizationId`: Sempre preenchido
    - `userId`, `teamId`: Conforme escopo do payload
    - **Nota:** Se `teamId` fornecido sem `userId`, cria um registro para cada usuário do time
4. **Cria log** com resultado (status: delivered, notificationId, deliveredAt)
5. Se falhar, cria log de erro (status: failed, errorMessage, retryCount)

---

### 4. Controllers/Endpoints

#### `GET /notifications`

Listar notificações do usuário autenticado

**Query params:**

- `status`: pending | sent | read
- `category`: system | code_review | etc
- `unreadOnly`: boolean
- `limit`: number
- `offset`: number

**Response:**

```json
{
  "notifications": [...],
  "total": 100,
  "unreadCount": 5
}
```

---

#### `PATCH /notifications/:id/read`

Marcar notificação como lida

---

#### `GET /notifications/preferences`

Buscar preferências do usuário

**Response:**

```json
{
    "preferences": [
        {
            "notificationType": "KODY_RULES_CREATED",
            "channels": {
                "email": { "enabled": true },
                "webhook": { "enabled": false },
                "inapp": { "enabled": true }
            }
        }
    ]
}
```

---

#### `PUT /notifications/preferences`

Atualizar preferências

**Body:**

```json
{
    "notificationType": "KODY_RULES_CREATED",
    "channel": "email",
    "enabled": false
}
```

---

#### `GET /notifications/webhooks`

Listar webhooks do usuário

---

#### `POST /notifications/webhooks`

Criar webhook

**Body:**

```json
{
    "name": "Slack #dev-team",
    "url": "https://hooks.slack.com/...",
    "platform": "slack"
}
```

---

#### `PUT /notifications/webhooks/:id`

Atualizar webhook

---

#### `DELETE /notifications/webhooks/:id`

Deletar webhook

---

#### `GET /notifications/templates/:templateId` (Opcional)

Buscar template JSON para renderização no front-end

**Response:**

```json
{
    "templateId": "KODY_RULES_CREATED",
    "version": 1,
    "title": "New Kody Rules Generated",
    "body": "**{{organizationName}}** has {{rulesCount}} new Kody rules available.\n\n- Review the rules\n- Apply to your codebase",
    "actionUrl": "/kody-rules",
    "actionLabel": "View Rules",
    "priority": 0
}
```

**Alternativa:** Front-end pode carregar templates localmente (mais rápido, sem chamada API)

**Renderização no Front-end:**

```typescript
// 1. Buscar template e dados
const template = await getTemplate(notification.templateId);
const renderedBody = renderTemplate(template.body, notification.data);
// renderedBody = "**Acme Corp** has 5 new Kody rules available.\n\n- Review the rules"

// 2. Renderizar Markdown (sempre)
return <ReactMarkdown>{renderedBody}</ReactMarkdown>;
```

**Bibliotecas recomendadas para Markdown:**

- `react-markdown` (React) - mais popular e seguro
- `marked` + `DOMPurify` (sanitização)
- `markdown-it` (mais controle e extensível)

---

## 🔄 Migração do Sistema Atual

### Notificações Existentes

1. **`sendKodyRulesNotification`** → Migrar para `NotificationService`
    - Tipo: `KODY_RULES_CREATED`
    - Canais: email, inapp

2. **`sendInvite`** → Migrar para `NotificationService`
    - Tipo: `TEAM_MEMBER_INVITED`
    - Canais: email

3. **`sendForgotPasswordEmail`** → Migrar para `NotificationService`
    - Tipo: `PASSWORD_RESET_REQUESTED`
    - Canais: email (required)

4. **`sendConfirmationEmail`** → Migrar para `NotificationService`
    - Tipo: `EMAIL_CONFIRMATION`
    - Canais: email (required)

---

## 📝 Seeding Inicial

### 1. Popular `notification_types`

Criar seeder (`src/config/database/typeorm/seed/notification-types.seeder.ts`) que popula todos os tipos de notificação.

**Exemplo de seeder:**

```typescript
const notificationTypes = [
    // Tipos comuns - email e in-app por padrão
    {
        type: NotificationType.KODY_RULES_CREATED,
        name: 'Kody Rules Created',
        description: 'Triggered when new Kody rules are generated',
        category: NotificationCategory.CODE_REVIEW,
        defaultChannels: ['email', 'inapp'],
        metadata: { icon: 'kody', color: 'blue', priority: 0 },
        active: true,
    },

    // Tipos críticos - email obrigatório
    {
        type: NotificationType.PASSWORD_RESET_REQUESTED,
        name: 'Password Reset Requested',
        description: 'Triggered when user requests password reset',
        category: NotificationCategory.SYSTEM,
        defaultChannels: ['email'],
        metadata: { icon: 'lock', color: 'red', priority: 2 },
        active: true,
    },

    {
        type: NotificationType.EMAIL_CONFIRMATION,
        name: 'Email Confirmation',
        description: 'Triggered when user needs to confirm email',
        category: NotificationCategory.SYSTEM,
        defaultChannels: ['email'],
        metadata: { icon: 'mail', color: 'blue', priority: 2 },
        active: true,
    },

    // Tipos informativos - apenas in-app por padrão
    {
        type: NotificationType.CODE_REVIEW_COMPLETED,
        name: 'Code Review Completed',
        description: 'Triggered when code review is finished',
        category: NotificationCategory.CODE_REVIEW,
        defaultChannels: ['inapp'],
        metadata: { icon: 'code', color: 'green', priority: 0 },
        active: true,
    },

    // Tipos de alerta - todos os canais por padrão, email obrigatório
    {
        type: NotificationType.QUOTA_LIMIT_REACHED,
        name: 'Quota Limit Reached',
        description: 'Triggered when organization reaches quota limit',
        category: NotificationCategory.BILLING,
        defaultChannels: ['email', 'webhook', 'inapp'],
        metadata: { icon: 'warning', color: 'red', priority: 2 },
        active: true,
    },

    // ... outros tipos
];
```

**Regras de configuração:**

- **Tipos críticos** (senha, confirmação de email): `defaultChannels: ["email"]`
- **Tipos informativos** (code review, issues): `defaultChannels: ["inapp"]` ou `["email", "inapp"]`
- **Tipos de alerta** (quota, license): `defaultChannels: ["email", "webhook", "inapp"]`
- **Tipos comuns**: `defaultChannels: ["email", "inapp"]`

### 2. Configurar Templates e Formatters

**Email (Customer.io):**

- Criar `EmailTemplateConfigService` com mapeamento `NotificationType` → `Customer.io templateId`
- Templates são criados diretamente no Customer.io (não em código)
- Exemplo:
    ```typescript
    EMAIL_TEMPLATE_MAP = {
        KODY_RULES_CREATED: 'yzkq340nv50gd796',
        PASSWORD_RESET_REQUESTED: 'abc123xyz',
        // ...
    };
    ```

**Webhook:**

- Criar `WebhookFormatterService` com métodos de formatação para cada plataforma
- Não precisa de templates JSON, apenas lógica de formatação simples
- Exemplo:
    ```typescript
    formatSlackMessage(KODY_RULES_CREATED, { rulesCount: 5 })
    → { text: "5 new Kody rules created", blocks: [...] }
    ```

**In-App:**

- Criar arquivos JSON apenas para in-app em `src/shared/utils/notifications/config/inapp-templates/*.json`
- Cada template deve:
    - Seguir o schema JSON definido
    - Ter `title` e `body` com variáveis `{{variable}}`
    - Usar variáveis para interpolação

---

## 📊 Observabilidade

### Logs

- Todas as tentativas de envio
- Erros de providers
- Falhas de webhooks

---

## ✅ Checklist de Aceitação

- [ ] Todas as tabelas criadas e migradas (exceto notification_templates)
- [ ] ENUMs populados com tipos iniciais
- [ ] Estrutura de pastas para templates JSON criada
- [ ] Schema JSON de validação criado
- [ ] InAppTemplateLoaderService e InAppTemplateCacheService implementados
- [ ] Templates JSON criados para tipos principais
- [ ] `NotificationService` funcionando (único ponto de entrada)
- [ ] Consumers RabbitMQ processando mensagens
- [ ] Customer.io integrado e enviando emails
- [ ] Webhooks customizados funcionando
- [ ] Notificações in-app sendo criadas
- [ ] Preferências de usuário funcionando
- [ ] Bloqueios respeitados
- [ ] Endpoints REST criados
- [ ] Migração de notificações antigas concluída
- [ ] Documentação atualizada
