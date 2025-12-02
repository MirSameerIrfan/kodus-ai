# Specification: Multi-Channel Notification System

## 📋 Summary

Implement a complete multi-channel notification system that allows users to be notified via **Email** (Customer.io), **Webhooks** (Slack, Discord, custom), and **In-App**, with granular control over preferences and blocks per user.

---

## 🎯 Objectives

1. **Replace current system** that uses only email (MailerSend)
2. **Add support for multiple channels**: Email, Webhook, In-App
3. **Allow users to control** which notifications they receive and through which channels
4. **Allow custom webhook registration** by users
5. **Implement in-app notifications** with read/unread marking
6. **Maintain complete audit** of all deliveries

---

## 🏗️ Architecture

### Architectural Decision

✅ **Module within the same application + RabbitMQ** (do not create a separate microservice)

**Justification:**

- RabbitMQ is already configured and working
- Modular architecture allows isolation without additional complexity
- Can evolve into a microservice later if needed
- Less operational overhead

### Processing Flow

```
Use Case or Service (when notification needs to be triggered)
    ↓
NotificationService.notify()
    ↓
1. Fetches notification_types
2. Determines recipient list (user/team/org)
3. For each enabled channel:
   - Checks user_notification_preferences
   - Publishes message to RabbitMQ queue (with necessary data)
    ↓
RabbitMQ Exchange: `notifications.exchange` (type: `topic`, durable: true)
    ├── Queue: `notifications.email.queue` → Email Consumer → Customer.io
    │   └── Routing Key: `notification.email.send`
    ├── Queue: `notifications.webhook.queue` → Webhook Consumer → Slack/Discord/Custom
    │   └── Routing Key: `notification.webhook.send`
    └── Queue: `notifications.inapp.queue` → In-App Consumer → Database
        └── Routing Key: `notification.inapp.send`

**RabbitMQ Configuration:**
- Exchange: `notifications.exchange` (type `topic`, durable)
- Dead Letter Exchange: `orchestrator.exchange.dlx` (already exists)
- Dead Letter Routing Key: `notification.{channel}.failed`
- Queue Options: `durable: true`, `createQueueIfNotExists: true`
```

---

## 📊 Database Structure

### Required Tables

#### 1. `notification_types`

**Purpose:** ENUM of all notification types available in the system

**Main fields:**

- `uuid` (PK)
- `createdAt`, `updatedAt`
- `type` (ENUM, UNIQUE): Unique type identifier
- `name` (varchar): Human-readable name
- `description` (text): Type description
- `category` (varchar): Category (system, code_review, automation, team, billing)
- `defaultChannels` (JSONB): Channels enabled by default `["email", "inapp"]`
- `metadata` (JSONB): Additional data (icon, color, priority)
- `active` (boolean): Whether the type is active

**`defaultChannels` Configuration:**

These fields are **configured by the development team** via **Seeder** when the system is initialized or when new notification types are added.

**Configuration examples:**

```typescript
// Seeder: src/config/database/typeorm/seed/notification-types.seeder.ts

// Common type - email and in-app by default
{
  type: NotificationType.KODY_RULES_CREATED,
  defaultChannels: ["email", "inapp"],
}

// Critical type - email only by default (user can disable if desired)
{
  type: NotificationType.PASSWORD_RESET_REQUESTED,
  defaultChannels: ["email"],
}

// Informational type - in-app only by default
{
  type: NotificationType.CODE_REVIEW_COMPLETED,
  defaultChannels: ["inapp"],
}

// Important type - all channels enabled by default
{
  type: NotificationType.QUOTA_LIMIT_REACHED,
  defaultChannels: ["email", "webhook", "inapp"],
}
```

**How it works:**

1. **`defaultChannels`**: If user hasn't configured preferences, uses these channels by default
2. **User preferences**: User can enable/disable any channel via `user_notification_preferences`
3. **If user hasn't configured**: Uses `defaultChannels`
4. **If user has configured**: Uses user preferences (can remove channels from default if desired)

**Who configures:**

- ✅ **Development team** via Seeder (versioned code)
- ✅ **System administrators** can update via migration/seeder when necessary
- ❌ **End users** do not configure these fields (they only configure their preferences in `user_notification_preferences`)

**Notification types to implement:**

- `KODY_RULES_CREATED`, `KODY_RULES_UPDATED`, `KODY_RULES_DELETED`, `KODY_RULES_SYNC`
- `ISSUE_CREATED`, `ISSUE_RESOLVED`, `ISSUE_ASSIGNED`
- `LICENSE_EXPIRING`, `LICENSE_EXPIRED`
- `PASSWORD_RESET_REQUESTED`
- `EMAIL_CONFIRMATION`

**Indexes:**

- `IDX_notification_types_type` (type)
- `IDX_notification_types_category` (category)
- `IDX_notification_types_active` (active) WHERE active = true

---

#### 2. Template Configuration by Channel

**Purpose:** Map templates and formatters for each notification type and channel

**Structure:**

```
src/shared/utils/notifications/config/
├── email-templates.config.ts      # Mapping: NotificationType → Customer.io templateId
├── webhook-formatters.config.ts   # Formatters for Slack/Discord/Teams
└── inapp-templates/               # JSON templates only for in-app
    ├── schema.json
    ├── KODY_RULES_CREATED.json
    ├── CODE_REVIEW_COMPLETED.json
    └── ...
```

**Email (Customer.io):**

No JSON templates needed! Customer.io already has its own templates. We only need:

1. **Map** `NotificationType` → `Customer.io templateId` (config)
2. **Send data** via `personalization` to Customer.io

**Configuration example (`email-templates.config.ts`):**

```typescript
// Mapping: NotificationType → Customer.io templateId
export const EMAIL_TEMPLATE_MAP: Record<NotificationType, string> = {
    [NotificationType.KODY_RULES_CREATED]: 'yzkq340nv50gd796',
    [NotificationType.PASSWORD_RESET_REQUESTED]: 'abc123xyz',
    [NotificationType.EMAIL_CONFIRMATION]: '7dnvo4dzko6l5r86',
    // ... other types
};

// Mapping: NotificationType → fields expected by template
// These fields will be passed as "attributes" to Customer.io
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
    // ... other types
};
```

**How it works:**

1. **Template in Customer.io** uses Liquid variables: `{{organizationName}}`, `{{rulesCount}}`, etc.
2. **Backend** receives `data` from `NotificationService.notify()`
3. **EmailTemplateConfigService** formats data according to expected fields:
    ```typescript
    getPersonalizationData(notificationType: NotificationType, data: Record<string, unknown>) {
      // Maps data to format expected by Customer.io
      // Example: { organizationName: data.orgName, rulesCount: data.count }
      return {
        organizationName: data.organizationName,
        rulesCount: data.rulesCount,
        actionUrl: data.actionUrl || 'https://app.kodus.io/kody-rules'
      };
    }
    ```
4. **CustomerIoService** sends email with `attributes`:
    ```typescript
    await customerIo.sendEmail({
        to: userEmail,
        transactional_message_id: templateId,
        message_data: {
            // Data that will be used in the template
            organizationName: 'Acme Corp',
            rulesCount: 5,
            actionUrl: '/kody-rules',
        },
    });
    ```

**Webhook:**

No complex templates needed! Only simple formatters to structure the payload according to the platform.

**Example (`webhook-formatters.config.ts`):**

```typescript
export function formatSlackMessage(
  notificationType: NotificationType,
  data: Record<string, unknown>
): SlackPayload {
  // Simple formatting logic based on type
  // Returns formatted payload for Slack
}

export function formatDiscordMessage(...): DiscordPayload { ... }
export function formatTeamsMessage(...): TeamsPayload { ... }
```

**In-App:**

**IMPORTANT:** The front-end will render! Backend only needs to save the data.

**How it works:**

- Backend saves: `templateId` (notificationType) + `data` (raw data)
- Front-end fetches template and renders:
    - Substitutes variables `{{variable}}` with values from `data`
    - Renders Markdown using library like `react-markdown`
- Templates can be updated without changing backend
- Markdown support for rich formatting (bold, italic, links, lists, code)

**Markdown:**

- Templates always use Markdown in the `body` field for rich formatting
- Front-end always renders Markdown using library like `react-markdown`
- Variables `{{variable}}` are substituted before rendering Markdown

**Folder structure for in-app templates (in backend, for reference):**

```
src/shared/utils/notifications/config/inapp-templates/
├── schema.json                    # JSON schema for validation
├── KODY_RULES_CREATED.json
├── CODE_REVIEW_COMPLETED.json
└── ...
```

**In database (`notifications`):**

- `templateId`: Template ID (notificationType)
- `data` (JSONB): Raw data for rendering
- Front-end fetches template and renders when displaying:
    1. Substitutes variables `{{variable}}` with values from `data`
    2. Renders Markdown using library like `react-markdown`

**JSON Schema for In-App (`inapp-templates/schema.json`):**

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
      "description": "Notification title"
    },
    "body": {
      "type": "string",
      "description": "Template body with variables {{variable}}. Always in Markdown format for rich formatting."
    },
    "actionUrl": {
      "type": "string",
      "format": "uri",
      "description": "Action URL (e.g., link to PR)"
    },
    "actionLabel": {
      "type": "string",
      "description": "Action button label"
    },
    "priority": {
      "type": "integer",
      "enum": [0, 1, 2],
      "default": 0,
      "description": "0=normal, 1=high, 2=urgent"
    },
    "metadata": {
      "type": "object",
      "description": "Additional template data"
    },
    "active": {
      "type": "boolean",
      "default": true
    }
  }
}
```

**In-App template example (`inapp-templates/KODY_RULES_CREATED.json`):**

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

**Example with Markdown:**

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

**Markdown Support:**

- **Bold:** `**text**` → **text**
- **Italic:** `*text*` → _text_
- **Links:** `[text](url)` → [text](url)
- **Lists:** `- item` or `1. item`
- **Inline code:** `` `code` ``
- **Code block:** ` ```code``` `
- **Line breaks:** `\n\n`

**Front-end:**

- Renders Markdown using library like `react-markdown`, `marked`, or similar
- Variables `{{variable}}` are substituted before rendering Markdown
- Supports safe HTML (automatic sanitization)

**Advantages of this approach:**

- ✅ Versioning via Git
- ✅ Facilitates template editing and review
- ✅ Validation via JSON schema
- ✅ No migrations needed to change templates
- ✅ Can have multiple versions of the same template
- ✅ In-memory cache for performance

**Responsible services:**

- `EmailTemplateConfigService`: Maps NotificationType → Customer.io templateId
- `WebhookFormatterService`: Formats payloads for Slack/Discord/Teams
- `InAppTemplateLoaderService`: Loads and validates JSON templates only for in-app
- `InAppTemplateCacheService`: In-memory cache of in-app templates

---

#### 3. `notifications`

**Purpose:** In-app notifications for users

**Main fields:**

- `uuid` (PK)
- `createdAt`, `updatedAt`
- `userId` (FK, nullable): Specific recipient user
- `organizationId` (FK): Organization (always required)
- `teamId` (FK, nullable): Specific recipient team
- `notificationType` (FK): Notification type
- `status` (ENUM): State (pending, sent, read)
- `templateId` (varchar): Template ID (or can be notification type)
- `data` (JSONB): Raw data for front-end rendering
    ```json
    {
        "organizationName": "Acme Corp",
        "rulesCount": 5,
        "actionUrl": "/kody-rules"
    }
    ```
- `readAt` (timestamp, nullable): When it was read
- `metadata` (JSONB, nullable): Contextual data (e.g., `{prNumber: 123, rulesCount: 5}`)
- `priority` (integer): Priority

**Scope Logic:**

- If `userId` filled: Notification for specific user
- If `teamId` filled (and `userId` null): Notification for entire team
- If both null: Notification for entire organization
- `organizationId` always required (all notifications belong to an org)

**Indexes:**

- `IDX_notifications_user` (userId)
- `IDX_notifications_user_status` (userId, status)
- `IDX_notifications_user_created` (userId, createdAt DESC)
- `IDX_notifications_unread` (userId, status) WHERE status = 'sent'
- `IDX_notifications_organization` (organizationId)
- `IDX_notifications_team` (teamId)
- `IDX_notifications_org_team` (organizationId, teamId)

---

#### 4. `user_notification_preferences`

**Purpose:** User preferences and blocks by type and channel

**Main fields:**

- `uuid` (PK)
- `createdAt`, `updatedAt`
- `userId` (FK): User
- `notificationType` (FK): Notification type
- `channel` (ENUM): Channel (email, webhook, inapp)
- `enabled` (boolean): Whether channel is enabled (false = blocked)
- `metadata` (JSONB, nullable): Additional settings (e.g., quiet hours)

**Unique constraint:** `(userId, notificationType, channel)`

**Logic:**

- If no record exists, uses `defaultChannels` from `notification_types`
- If `enabled = false`, notification is not sent through that channel
- User can enable/disable any channel via preferences

**Indexes:**

- `IDX_user_notification_preferences_user` (userId)
- `IDX_user_notification_preferences_type` (notificationType)
- `IDX_user_notification_preferences_enabled` (userId, enabled) WHERE enabled = false

---

#### 5. `user_webhooks`

**Purpose:** Custom webhooks registered by users

**Main fields:**

- `uuid` (PK)
- `createdAt`, `updatedAt`
- `userId` (FK): Webhook owner user
- `organizationId` (FK): Organization (always required)
- `teamId` (FK, nullable): Team (optional, for team-specific webhooks)
- `name` (varchar): Descriptive name (e.g., "Slack #dev-team")
- `url` (varchar): Webhook URL
- `platform` (ENUM): Platform (slack, discord, teams, custom)
- `status` (ENUM): State (active, inactive, failed)
- `lastTriggeredAt` (timestamp, nullable): Last time it was triggered
- `lastErrorAt` (timestamp, nullable): Last error
- `lastErrorMessage` (text, nullable): Last error message
- `failureCount` (integer): Failure counter (to disable after N failures)

**Indexes:**

- `IDX_user_webhooks_user` (userId)
- `IDX_user_webhooks_active` (userId, status) WHERE status = 'active'

---

#### 6. Logs (Collection `log` - MongoDB)

**Purpose:** Audit of all notification delivery attempts

**Using existing `log` collection:**

Instead of creating a separate table, we use the existing `log` collection (MongoDB) in the system.

**Log structure for notifications:**

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
    notificationId: 'uuid', // If in-app
    notificationType: 'KODY_RULES_CREATED',
    channel: 'email' | 'webhook' | 'inapp',
    status: 'pending' | 'sent' | 'delivered' | 'failed',
    recipient: 'user@example.com', // Email, webhook URL, or user ID
    providerId: 'customer-io-message-id', // External provider ID
    providerResponse: {}, // Complete provider response
    sentAt: '2024-01-01T00:00:00Z',
    deliveredAt: '2024-01-01T00:00:01Z',
    openedAt: '2024-01-01T00:00:05Z', // For email (if available)
    clickedAt: '2024-01-01T00:00:10Z', // For email (if available)
    errorMessage: null, // If failed
    retryCount: 0,
    webhookId: 'uuid', // If custom webhook
    // ... other contextual fields
  },
  timestamp: '2024-01-01T00:00:00Z',
  requestId: 'uuid', // For tracking
  traceId: 'uuid', // For observability
}
```

**Advantages:**

- ✅ Uses existing infrastructure (no need to create new table)
- ✅ Centralized logs for observability
- ✅ Supports flexible metadata (JSON)
- ✅ Integrated with tracing system (traceId, spanId)
- ✅ Facilitates queries and log analysis
- ✅ Automatic retention according to log policy

**Example queries:**

```typescript
// Find notification deliveries by user
logService.find({
    'metadata.type': 'notification_delivery',
    'metadata.userId': userId,
});

// Find failures
logService.find({
    'metadata.type': 'notification_delivery',
    'level': 'error',
    'metadata.status': 'failed',
});

// Find by notification type
logService.find({
    'metadata.type': 'notification_delivery',
    'metadata.notificationType': 'KODY_RULES_CREATED',
});
```

---

## 🔧 Components to Implement

### 1. Domain Layer

#### ENUMs

- `NotificationType` - Notification types
- `NotificationChannel` - Channels (email, webhook, inapp)
- `NotificationStatus` - In-app status (pending, sent, read)
- `DeliveryStatus` - Delivery status (pending, sent, delivered, failed, etc)
- `WebhookPlatform` - Webhook platforms (slack, discord, teams, custom)
- `WebhookStatus` - Webhook status (active, inactive, failed)
- `NotificationCategory` - Categories (system, code_review, automation, etc)

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
- `IInAppTemplateLoaderService` - Loads JSON templates only for in-app
- `IInAppTemplateCacheService` - In-memory cache of in-app templates

---

### 2. Application Layer (Use Cases)

---

#### `GetUserNotificationsUseCase`

**Responsibility:** Fetch in-app notifications for user

**Filters:**

- `status`: pending, sent, read
- `category`: system, code_review, etc.
- `unreadOnly`: boolean
- `limit`, `offset`: pagination

---

#### `MarkNotificationAsReadUseCase`

**Responsibility:** Mark notification as read

**Input:**

```typescript
{
    notificationId: string;
    userId: string;
}
```

**Action:**

- Updates `status` to `read`
- Sets `readAt` with current timestamp

---

#### `UpdateNotificationPreferencesUseCase`

**Responsibility:** Update user preferences

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

**Validation:**

- User can disable any channel (no required channels)

---

#### `CreateUserWebhookUseCase`

**Responsibility:** Create custom webhook

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

**Validation:**

- Validate URL
- Validate webhook format (Slack, Discord, etc)

---

#### `UpdateUserWebhookUseCase`

**Responsibility:** Update existing webhook

---

#### `DeleteUserWebhookUseCase`

**Responsibility:** Delete webhook

---

#### `GetUserWebhooksUseCase`

**Responsibility:** List user webhooks

---

### 3. Infrastructure Layer

#### Repositories (TypeORM)

- `NotificationTypeRepository`
- `NotificationRepository`
- `UserNotificationPreferenceRepository`
- `UserWebhookRepository`
- `LogService` (already exists) - For delivery audit

#### Template Services

- `InAppTemplateLoaderService`: Loads JSON templates only for in-app from filesystem
    - Validates against JSON schema
    - Supports versioning (multiple versions of same template)
    - In-memory cache for performance
- `InAppTemplateCacheService`: Manages in-app template cache

#### Services

##### `NotificationService`

**Responsibility:** Service in Infrastructure layer - **ONLY entry point** for notifications

**Location:** `src/core/infrastructure/adapters/services/notifications/notification.service.ts`

**Methods:**

- `notify(params)`: Public method to trigger notifications
    - Contains all notification business logic
    - Handles errors to not break main flow
    - Logs for audit

**Internal flow:**

1. Receives: `userId`, `organizationId`, `teamId`, `notificationType`, `data` (context)
2. Fetches `notification_types` by type
3. Determines recipient list:
    - If `userId` provided: List with 1 user
    - If `teamId` provided (without userId): Fetches all team users via `UserRepository.findByTeamId(teamId)`
    - If none: Fetches all organization users via `UserRepository.findByOrganizationId(organizationId)`
4. Determines channels to process:
    - If `channels` provided in input: Uses these channels (overrides `defaultChannels`)
    - Otherwise: Uses `defaultChannels` from `notification_types`
5. For each determined channel:
    - For each recipient user:
        - Checks `user_notification_preferences` for this `notificationType` and `channel`
        - **Preference logic:**
            - If preference exists with `enabled = false`: **skips** this channel for this user
            - If preference exists with `enabled = true`: **sends** through this channel
            - If **no preference** exists: **uses** `defaultChannels` (sends through this channel)
        - If channel is enabled (according to logic above):
            - Publishes message to RabbitMQ queue with:
                - `userId`, `organizationId`, `teamId`
                - `notificationType`
                - `channel`
                - `data` (data to render template)
6. Returns result (does not propagate errors)

**Note:** Delivery logs are created by the **Consumer** when processing the message, using the existing `log` collection. This avoids orphaned records if publishing fails.

**Usage:**

```typescript
// In any Service (Domain or Infrastructure)
@Injectable()
export class SomeService {
  constructor(
    private readonly notificationService: NotificationService,
  ) {}

  async doSomething() {
    // Logic...
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
  userId?: string; // Optional: if provided, notifies only this user
  organizationId: string; // Required: always needs an org
  teamId?: string; // Optional: if provided (without userId), notifies entire team
  notificationType: NotificationType;
  data: Record<string, unknown>; // Data to render template
  channels?: NotificationChannel[]; // Optional: force specific channels (overrides defaultChannels)
}
```

**Scope Logic:**

- If `userId` provided: Creates notification only for this user
- If `teamId` provided (without `userId`): Creates notification for all team users
- If none provided: Creates notification for all organization users

##### `EmailTemplateConfigService`

**Responsibility:** Map NotificationType to Customer.io templateId and format data

**Methods:**

- `getTemplateId(notificationType)`: Returns Customer.io templateId for the type
- `getPersonalizationData(notificationType, data)`: Formats data for Customer.io `message_data`
    - Maps fields from received `data` to fields expected by template
    - Validates required fields
    - Adds default fields if necessary

**Example:**

```typescript
// Input from NotificationService
data = {
  organizationName: 'Acme Corp',
  rulesCount: 5,
  actionUrl: '/kody-rules'
}

// Output formatted for Customer.io
{
  organizationName: 'Acme Corp',
  rulesCount: 5,
  actionUrl: 'https://app.kodus.io/kody-rules'
}
```

---

##### `CustomerIoService`

**Responsibility:** Integration with Customer.io for emails

**Methods:**

- `sendEmail(params)`: Sends email using Customer.io template
    ```typescript
    sendEmail({
        to: string, // Recipient email
        transactional_message_id: string, // Customer.io template ID
        message_data: Record<string, unknown>, // Data for template (attributes)
    });
    ```

**How it works:**

1. **Customer.io** already has templates created on the platform with Liquid variables (e.g., `{{organizationName}}`)
2. **Backend** sends:
    - `to`: Recipient email
    - `transactional_message_id`: Template ID
    - `message_data`: Object with data that will be used in the template
3. **Customer.io** renders the template substituting variables with values from `message_data`
4. **Customer.io** sends the rendered email

**Call example:**

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

**Template in Customer.io uses:**

```
Subject: New Kody Rules for {{organizationName}}

Body:
{{organizationName}} has {{rulesCount}} new Kody rules available.
[View Rules]({{actionUrl}})
```

---

##### `WebhookFormatterService`

**Responsibility:** Format payloads for different webhook platforms

**Methods:**

- `formatSlackMessage(notificationType, data)`: Formats payload for Slack
- `formatDiscordMessage(notificationType, data)`: Formats payload for Discord
- `formatTeamsMessage(notificationType, data)`: Formats payload for Teams
- `formatCustomWebhook(notificationType, data)`: Formats generic payload

**Logic:**

- Each method receives `notificationType` and `data`
- Returns formatted payload according to structure expected by platform
- No complex templates needed, just simple formatting

---

##### `WebhookService`

**Responsibility:** Send notifications via webhook

**Methods:**

- `sendWebhook(webhook, payload)`: Sends HTTP POST to webhook
- `retryWithBackoff(webhook, payload)`: Retry with exponential backoff

**Validation:**

- Retry with exponential backoff
- Disable webhook after N consecutive failures

---

##### `InAppNotificationService`

**Responsibility:** Create/update in-app notifications

**Methods:**

- `createNotification(data)`
- `updateNotificationStatus(notificationId, status)`

---

##### `InAppTemplateLoaderService`

**Responsibility:** Loads JSON templates only for in-app

**Methods:**

- `loadTemplate(notificationType)`: Loads JSON template from filesystem
- `validateTemplate(template)`: Validates against JSON schema
- Supports versioning (multiple versions of same template)
- In-memory cache for performance

---

##### `InAppTemplateCacheService`

**Responsibility:** Manages in-app template cache

**Methods:**

- `get(notificationType)`: Fetches template from cache
- `set(notificationType, template)`: Adds to cache
- `clear()`: Clears cache

---

**Note:** `TemplateRendererService` is not necessary, as rendering is done on the front-end. Email and Webhook don't need rendering (Customer.io has its own templates, webhooks are formatted via `WebhookFormatterService`).

---

#### RabbitMQ Consumers

##### `EmailNotificationConsumer`

**Queue:** `notifications.email.queue`
**Exchange:** `notifications.exchange` (type `topic`)
**Routing Key:** `notification.email.send`
**Dead Letter:** `orchestrator.exchange.dlx` with routing key `notification.email.failed`

**Flow:**

1. Receives message from queue (with userId, organizationId, notificationType, channel, data)
2. **Creates log** via `LogService` (status: pending)
3. Fetches `Customer.io templateId` via `EmailTemplateConfigService.getTemplateId(notificationType)`
4. Formats data via `EmailTemplateConfigService.getPersonalizationData(notificationType, data)`
    - Maps fields from `data` to format expected by Customer.io template
    - Validates required fields
5. Fetches user email (via userId)
6. Sends via `CustomerIoService.sendEmail({ to, transactional_message_id, message_data })`
7. **Creates log** with result (status: delivered, providerId, providerResponse, sentAt, deliveredAt)
8. If fails, creates error log (status: failed, errorMessage, retryCount)

---

##### `WebhookNotificationConsumer`

**Queue:** `notifications.webhook.queue`
**Exchange:** `notifications.exchange` (type `topic`)
**Routing Key:** `notification.webhook.send`
**Dead Letter:** `orchestrator.exchange.dlx` with routing key `notification.webhook.failed`

**Flow:**

1. Receives message from queue (with userId, organizationId, notificationType, channel, data)
2. **Creates log** via `LogService` (status: pending)
3. Fetches active `user_webhooks` for this organization/team:
    - Filters by `userId`, `organizationId` (and `teamId` if provided)
    - Filters by `status = 'active'`
    - If no custom webhooks found, **does not send** (webhook is optional)
    - For each webhook found:
      a. Formats payload via `WebhookFormatterService` according to webhook platform: - `formatSlackMessage(notificationType, data)` → Slack payload - `formatDiscordMessage(notificationType, data)` → Discord payload - `formatTeamsMessage(notificationType, data)` → Teams payload - `formatCustomWebhook(notificationType, data)` → Generic payload
      b. Sends via HTTP POST to `webhook.url`
      c. **Updates log** with result (status: delivered, providerResponse, sentAt, deliveredAt, webhookId)
      d. Updates `user_webhooks`: - `lastTriggeredAt` = now - `failureCount` = 0 (if success) or increments (if failed) - `status` = 'failed' (if many consecutive failures, e.g., > 5) - `lastErrorAt`, `lastErrorMessage` (if failed)
      e. If fails, creates error log (status: failed, errorMessage, retryCount, webhookId)

---

##### `InAppNotificationConsumer`

**Queue:** `notifications.inapp.queue`
**Exchange:** `notifications.exchange` (type `topic`)
**Routing Key:** `notification.inapp.send`
**Dead Letter:** `orchestrator.exchange.dlx` with routing key `notification.inapp.failed`

**Flow:**

1. Receives message from queue (with userId, organizationId, teamId, notificationType, channel, data)
2. **Creates log** via `LogService` (status: pending)
3. Creates record in `notifications`:
    - `status`: sent
    - `templateId`: notificationType (used by front-end to fetch template)
    - `data`: JSONB with raw data (data from payload, used for front-end rendering)
    - `organizationId`: Always filled
    - `userId`, `teamId`: According to payload scope
    - **Note:** If `teamId` provided without `userId`, creates a record for each team user
4. **Creates log** with result (status: delivered, notificationId, deliveredAt)
5. If fails, creates error log (status: failed, errorMessage, retryCount)

---

### 4. Controllers/Endpoints

#### `GET /notifications`

List authenticated user's notifications

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

Mark notification as read

---

#### `GET /notifications/preferences`

Fetch user preferences

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

Update preferences

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

List user webhooks

---

#### `POST /notifications/webhooks`

Create webhook

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

Update webhook

---

#### `DELETE /notifications/webhooks/:id`

Delete webhook

---

#### `GET /notifications/templates/:templateId` (Optional)

Fetch JSON template for front-end rendering

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

**Alternative:** Front-end can load templates locally (faster, no API call)

**Front-end Rendering:**

```typescript
// 1. Fetch template and data
const template = await getTemplate(notification.templateId);
const renderedBody = renderTemplate(template.body, notification.data);
// renderedBody = "**Acme Corp** has 5 new Kody rules available.\n\n- Review the rules"

// 2. Render Markdown (always)
return <ReactMarkdown>{renderedBody}</ReactMarkdown>;
```

**Recommended libraries for Markdown:**

- `react-markdown` (React) - most popular and secure
- `marked` + `DOMPurify` (sanitization)
- `markdown-it` (more control and extensible)

---

## 🔄 Migration from Current System

### Existing Notifications

1. **`sendKodyRulesNotification`** → Migrate to `NotificationService`
    - Type: `KODY_RULES_CREATED`
    - Channels: email, inapp

2. **`sendInvite`** → Migrate to `NotificationService`
    - Type: `TEAM_MEMBER_INVITED`
    - Channels: email

3. **`sendForgotPasswordEmail`** → Migrate to `NotificationService`
    - Type: `PASSWORD_RESET_REQUESTED`
    - Channels: email (required)

4. **`sendConfirmationEmail`** → Migrate to `NotificationService`
    - Type: `EMAIL_CONFIRMATION`
    - Channels: email (required)

---

## 📝 Initial Seeding

### 1. Populate `notification_types`

Create seeder (`src/config/database/typeorm/seed/notification-types.seeder.ts`) that populates all notification types.

**Seeder example:**

```typescript
const notificationTypes = [
    // Common types - email and in-app by default
    {
        type: NotificationType.KODY_RULES_CREATED,
        name: 'Kody Rules Created',
        description: 'Triggered when new Kody rules are generated',
        category: NotificationCategory.CODE_REVIEW,
        defaultChannels: ['email', 'inapp'],
        metadata: { icon: 'kody', color: 'blue', priority: 0 },
        active: true,
    },

    // Critical types - email required
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

    // Informational types - in-app only by default
    {
        type: NotificationType.CODE_REVIEW_COMPLETED,
        name: 'Code Review Completed',
        description: 'Triggered when code review is finished',
        category: NotificationCategory.CODE_REVIEW,
        defaultChannels: ['inapp'],
        metadata: { icon: 'code', color: 'green', priority: 0 },
        active: true,
    },

    // Alert types - all channels by default, email required
    {
        type: NotificationType.QUOTA_LIMIT_REACHED,
        name: 'Quota Limit Reached',
        description: 'Triggered when organization reaches quota limit',
        category: NotificationCategory.BILLING,
        defaultChannels: ['email', 'webhook', 'inapp'],
        metadata: { icon: 'warning', color: 'red', priority: 2 },
        active: true,
    },

    // ... other types
];
```

**Configuration rules:**

- **Critical types** (password, email confirmation): `defaultChannels: ["email"]`
- **Informational types** (code review, issues): `defaultChannels: ["inapp"]` or `["email", "inapp"]`
- **Alert types** (quota, license): `defaultChannels: ["email", "webhook", "inapp"]`
- **Common types**: `defaultChannels: ["email", "inapp"]`

### 2. Configure Templates and Formatters

**Email (Customer.io):**

- Create `EmailTemplateConfigService` with mapping `NotificationType` → `Customer.io templateId`
- Templates are created directly in Customer.io (not in code)
- Example:
    ```typescript
    EMAIL_TEMPLATE_MAP = {
        KODY_RULES_CREATED: 'yzkq340nv50gd796',
        PASSWORD_RESET_REQUESTED: 'abc123xyz',
        // ...
    };
    ```

**Webhook:**

- Create `WebhookFormatterService` with formatting methods for each platform
- No JSON templates needed, just simple formatting logic
- Example:
    ```typescript
    formatSlackMessage(KODY_RULES_CREATED, { rulesCount: 5 })
    → { text: "5 new Kody rules created", blocks: [...] }
    ```

**In-App:**

- Create JSON files only for in-app in `src/shared/utils/notifications/config/inapp-templates/*.json`
- Each template must:
    - Follow the defined JSON schema
    - Have `title` and `body` with variables `{{variable}}`
    - Use variables for interpolation

---

## 📊 Observability

### Logs

- All send attempts
- Provider errors
- Webhook failures

---

## ✅ Acceptance Checklist

- [ ] All tables created and migrated (except notification_templates)
- [ ] ENUMs populated with initial types
- [ ] Folder structure for JSON templates created
- [ ] JSON validation schema created
- [ ] InAppTemplateLoaderService and InAppTemplateCacheService implemented
- [ ] JSON templates created for main types
- [ ] `NotificationService` working (single entry point)
- [ ] RabbitMQ consumers processing messages
- [ ] Customer.io integrated and sending emails
- [ ] Custom webhooks working
- [ ] In-app notifications being created
- [ ] User preferences working
- [ ] Blocks respected
- [ ] REST endpoints created
- [ ] Migration of old notifications completed
- [ ] Documentation updated
