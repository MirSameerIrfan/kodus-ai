# Separação Física na Infraestrutura - Detalhamento

## 🎯 O Que Você Quer Entender

Como os componentes (Webhook Handler, API REST, Worker) são separados fisicamente na infraestrutura ideal, e como isso difere do estado atual.

---

## 📊 Estado Atual vs Estado Ideal

### Estado Atual: PM2 em EC2

```
┌─────────────────────────────────────────────────────────────┐
│              EC2 INSTANCE (1 máquina)                      │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐ │
│  │              PM2 PROCESS MANAGER                      │ │
│  │                                                       │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────┐│ │
│  │  │   PROCESS 1  │  │   PROCESS 2  │  │ PROCESS 3 ││ │
│  │  │              │  │              │  │            ││ │
│  │  │ Webhook      │  │ API REST     │  │ Worker     ││ │
│  │  │ Handler      │  │              │  │            ││ │
│  │  │              │  │              │  │            ││ │
│  │  │ Port: 3332   │  │ Port: 3331   │  │ No HTTP    ││ │
│  │  │              │  │              │  │            ││ │
│  │  │ Memory: 200MB│  │ Memory: 500MB│  │ Memory:    ││ │
│  │  │              │  │              │  │ 800MB      ││ │
│  │  └──────────────┘  └──────────────┘  └────────────┘│ │
│  │                                                       │ │
│  │  • Compartilham mesma máquina                        │ │
│  │  • Compartilham mesmo OS                             │ │
│  │  • Compartilham recursos (CPU, RAM, Disk)            │ │
│  │  • Se um crasha, pode afetar outros                  │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                             │
│  Problemas:                                                │
│  • Escala toda a máquina (não componentes individuais)     │
│  • Deploy reinicia todos os processos                     │
│  • Recursos compartilhados (competição)                   │
│  • Single point of failure                                │
└─────────────────────────────────────────────────────────────┘
```

**Limitações**:

- ❌ Não pode escalar componentes independentemente
- ❌ Deploy afeta todos os processos
- ❌ Recursos compartilhados (competição)
- ❌ Se EC2 cai, tudo cai

---

### Estado Ideal: Containers Separados (ECS Fargate)

```
┌─────────────────────────────────────────────────────────────┐
│              AWS ECS FARGATE (Container Orchestration)      │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              TASK DEFINITION 1                       │   │
│  │              Webhook Handler                         │   │
│  │                                                       │   │
│  │  ┌───────────────────────────────────────────────┐   │   │
│  │  │  CONTAINER: webhook-handler                    │   │   │
│  │  │                                               │   │   │
│  │  │  • Image: kodus-ai:webhook-handler            │   │   │
│  │  │  • CPU: 0.25 vCPU                              │   │   │
│  │  │  • Memory: 512 MB                              │   │   │
│  │  │  • Port: 3332                                   │   │   │
│  │  │  • Replicas: 3-10 (auto-scaling)               │   │   │
│  │  │                                               │   │   │
│  │  │  Isolado:                                      │   │   │
│  │  │  • Processo próprio                            │   │   │
│  │  │  • Memória própria                             │   │   │
│  │  │  • CPU própria                                 │   │   │
│  │  │  • Rede própria                                 │   │   │
│  │  └───────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────┘   │
│                            │                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              TASK DEFINITION 2                       │   │
│  │              API REST                                │   │
│  │                                                       │   │
│  │  ┌───────────────────────────────────────────────┐   │   │
│  │  │  CONTAINER: api-rest                            │   │   │
│  │  │                                               │   │   │
│  │  │  • Image: kodus-ai:api-rest                    │   │   │
│  │  │  • CPU: 0.5 vCPU                               │   │   │
│  │  │  • Memory: 1024 MB                             │   │   │
│  │  │  • Port: 3331                                   │   │   │
│  │  │  • Replicas: 5-20 (auto-scaling)               │   │   │
│  │  │                                               │   │   │
│  │  │  Isolado:                                      │   │   │
│  │  │  • Processo próprio                            │   │   │
│  │  │  • Memória própria                             │   │   │
│  │  │  • CPU própria                                 │   │   │
│  │  │  • Rede própria                                 │   │   │
│  │  └───────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────┘   │
│                            │                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              TASK DEFINITION 3                       │   │
│  │              Worker                                  │   │
│  │                                                       │   │
│  │  ┌───────────────────────────────────────────────┐   │   │
│  │  │  CONTAINER: worker                              │   │   │
│  │  │                                               │   │   │
│  │  │  • Image: kodus-ai:worker                      │   │   │
│  │  │  • CPU: 1.0 vCPU                               │   │   │
│  │  │  • Memory: 2048 MB                             │   │   │
│  │  │  • No HTTP (sem porta)                         │   │   │
│  │  │  • Replicas: 10-50 (auto-scaling)              │   │   │
│  │  │                                               │   │   │
│  │  │  Isolado:                                      │   │   │
│  │  │  • Processo próprio                            │   │   │
│  │  │  • Memória própria                             │   │   │
│  │  │  • CPU própria                                 │   │   │
│  │  │  • Rede própria                                 │   │   │
│  │  └───────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Benefícios:                                                │
│  • ✅ Escala componentes independentemente                 │
│  • ✅ Deploy independente (não afeta outros)              │
│  • ✅ Recursos isolados (sem competição)                   │
│  • ✅ Alta disponibilidade (múltiplas instâncias)         │
└─────────────────────────────────────────────────────────────┘
```

**Vantagens**:

- ✅ Escala independente por componente
- ✅ Deploy independente (zero downtime)
- ✅ Recursos isolados (sem competição)
- ✅ Alta disponibilidade (múltiplas instâncias)

---

## 🔍 Detalhamento: Como Funciona na Prática

### 1. Task Definitions (Definições de Containers)

Cada componente tem sua própria **Task Definition** no ECS:

```json
// Task Definition: webhook-handler
{
  "family": "kodus-webhook-handler",
  "containerDefinitions": [
    {
      "name": "webhook-handler",
      "image": "123456789.dkr.ecr.us-east-1.amazonaws.com/kodus-ai:webhook-handler-latest",
      "cpu": 256,           // 0.25 vCPU
      "memory": 512,        // 512 MB
      "essential": true,
      "portMappings": [
        {
          "containerPort": 3332,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "COMPONENT_TYPE",
          "value": "webhook"
        },
        {
          "name": "DATABASE_URL",
          "value": "postgresql://..."
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/kodus-webhook-handler",
          "awslogs-region": "us-east-1"
        }
      }
    }
  ],
  "requiresCompatibilities": ["FARGATE"],
  "networkMode": "awsvpc",
  "cpu": "256",
  "memory": "512"
}

// Task Definition: api-rest
{
  "family": "kodus-api-rest",
  "containerDefinitions": [
    {
      "name": "api-rest",
      "image": "123456789.dkr.ecr.us-east-1.amazonaws.com/kodus-ai:api-rest-latest",
      "cpu": 512,           // 0.5 vCPU
      "memory": 1024,       // 1 GB
      "essential": true,
      "portMappings": [
        {
          "containerPort": 3331,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "COMPONENT_TYPE",
          "value": "api"
        }
      ]
    }
  ],
  "requiresCompatibilities": ["FARGATE"],
  "networkMode": "awsvpc",
  "cpu": "512",
  "memory": "1024"
}

// Task Definition: worker
{
  "family": "kodus-worker",
  "containerDefinitions": [
    {
      "name": "worker",
      "image": "123456789.dkr.ecr.us-east-1.amazonaws.com/kodus-ai:worker-latest",
      "cpu": 1024,          // 1.0 vCPU
      "memory": 2048,       // 2 GB
      "essential": true,
      "environment": [
        {
          "name": "COMPONENT_TYPE",
          "value": "worker"
        }
      ]
      // Sem portMappings (não expõe HTTP)
    }
  ],
  "requiresCompatibilities": ["FARGATE"],
  "networkMode": "awsvpc",
  "cpu": "1024",
  "memory": "2048"
}
```

---

### 2. ECS Services (Serviços que Gerenciam Tasks)

Cada componente roda como um **Service** separado:

```yaml
# Service: webhook-handler
Service: kodus-webhook-handler-service
├── Task Definition: kodus-webhook-handler
├── Desired Count: 3                    # 3 containers rodando
├── Min Count: 2                        # Mínimo 2 (alta disponibilidade)
├── Max Count: 10                       # Máximo 10 (auto-scaling)
├── Auto Scaling:
│   ├── Target: 70% CPU
│   ├── Scale Up: +1 container quando CPU > 70%
│   └── Scale Down: -1 container quando CPU < 30%
└── Load Balancer: webhook-handler-alb

# Service: api-rest
Service: kodus-api-rest-service
├── Task Definition: kodus-api-rest
├── Desired Count: 5
├── Min Count: 3
├── Max Count: 20
├── Auto Scaling:
│   ├── Target: 70% CPU
│   └── Target: Request count > 1000/min
└── Load Balancer: api-rest-alb

# Service: worker
Service: kodus-worker-service
├── Task Definition: kodus-worker
├── Desired Count: 10
├── Min Count: 5
├── Max Count: 50
├── Auto Scaling:
│   ├── Target: Queue depth < 100
│   └── Scale Up: +5 quando queue depth > 500
└── No Load Balancer (não expõe HTTP)
```

---

### 3. Comunicação Entre Componentes

```
┌─────────────────────────────────────────────────────────────┐
│              FLUXO DE COMUNICAÇÃO                           │
│                                                             │
│  1. WEBHOOK CHEGA                                           │
│     ↓                                                       │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Application Load Balancer                          │   │
│  │  • Health checks                                     │   │
│  │  • SSL termination                                   │   │
│  │  • Routing para webhook-handler containers           │   │
│  └─────────────────────────────────────────────────────┘   │
│     ↓                                                       │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Webhook Handler Container (1 de 3)                │   │
│  │  • Recebe webhook                                    │   │
│  │  • Valida signature                                  │   │
│  │  • Enfileira job no RabbitMQ                         │   │
│  │  • Responde 202 Accepted                             │   │
│  └─────────────────────────────────────────────────────┘   │
│     ↓                                                       │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  RabbitMQ (Message Queue)                            │   │
│  │  • Queue: workflow.jobs.queue                         │   │
│  │  • Message: { jobId, payload, ... }                   │   │
│  └─────────────────────────────────────────────────────┘   │
│     ↓                                                       │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Worker Container (1 de 10)                          │   │
│  │  • Consome mensagem da fila                          │   │
│  │  • Processa code review                              │   │
│  │  • Chama LLM, AST, etc.                             │   │
│  │  • Atualiza status no PostgreSQL                     │   │
│  └─────────────────────────────────────────────────────┘   │
│     ↓                                                       │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  PostgreSQL                                          │   │
│  │  • Tabela: workflow_jobs                             │   │
│  │  • Status atualizado                                 │   │
│  └─────────────────────────────────────────────────────┘   │
│     ↓                                                       │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  API REST Container (1 de 5)                         │   │
│  │  • Usuário consulta status via GET /jobs/:id        │   │
│  │  • Lê do PostgreSQL                                  │   │
│  │  • Retorna status atualizado                         │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

### 4. Escalabilidade Independente

#### Cenário: Pico de Webhooks

```
Situação: GitHub envia 1000 webhooks/minuto

┌─────────────────────────────────────────────────────────────┐
│              ANTES (PM2)                                     │
│                                                             │
│  • Todos os processos competem por recursos                 │
│  • Se webhook handler precisa de mais CPU, afeta API        │
│  • Não pode escalar só webhook handler                      │
│  • Solução: Escalar EC2 inteira (mais caro)                 │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│              DEPOIS (ECS Fargate)                            │
│                                                             │
│  Webhook Handler:                                           │
│  • Auto-scaling detecta alta carga                         │
│  • Escala de 3 → 10 containers                              │
│  • Cada container isolado (não afeta outros)                │
│                                                             │
│  API REST:                                                  │
│  • Continua com 5 containers (sem mudança)                 │
│  • Não é afetado pelo pico de webhooks                      │
│                                                             │
│  Workers:                                                   │
│  • Continua com 10 containers                              │
│  • Processa jobs normalmente                                │
│                                                             │
│  Resultado:                                                 │
│  • Escala só o que precisa                                  │
│  • Custo otimizado (paga só pelo que usa)                   │
│  • Performance isolada                                       │
└─────────────────────────────────────────────────────────────┘
```

#### Cenário: Processamento Pesado de Code Reviews

```
Situação: Muitos PRs grandes precisam de análise

┌─────────────────────────────────────────────────────────────┐
│              ANTES (PM2)                                     │
│                                                             │
│  • Workers consomem muita CPU/RAM                           │
│  • Afeta API REST (lentidão)                                │
│  • Afeta Webhook Handler (timeout)                          │
│  • Solução: Escalar EC2 inteira                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│              DEPOIS (ECS Fargate)                            │
│                                                             │
│  Workers:                                                   │
│  • Auto-scaling detecta queue depth alta                    │
│  • Escala de 10 → 50 containers                             │
│  • Cada worker isolado (CPU/RAM próprios)                   │
│                                                             │
│  API REST:                                                  │
│  • Continua com 5 containers (sem impacto)                 │
│  • Performance mantida                                      │
│                                                             │
│  Webhook Handler:                                           │
│  • Continua com 3 containers                                │
│  • Responde rápido (sem impacto)                            │
│                                                             │
│  Resultado:                                                 │
│  • Escala só workers                                         │
│  • API e Webhook não são afetados                           │
│  • Custo otimizado                                          │
└─────────────────────────────────────────────────────────────┘
```

---

### 5. Deploy Independente

#### Cenário: Deploy de Nova Versão do Worker

```
┌─────────────────────────────────────────────────────────────┐
│              ANTES (PM2)                                     │
│                                                             │
│  1. Build nova versão                                       │
│  2. Parar todos os processos (PM2 stop all)                │
│  3. Atualizar código                                        │
│  4. Iniciar todos os processos (PM2 start all)            │
│                                                             │
│  Problemas:                                                 │
│  • Downtime de todos os componentes                         │
│  • Webhooks perdidos durante deploy                         │
│  • API REST indisponível                                    │
│  • Jobs em processamento são interrompidos                  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│              DEPOIS (ECS Fargate)                            │
│                                                             │
│  1. Build nova imagem (worker:v2)                          │
│  2. Push para ECR                                           │
│  3. ECS atualiza Task Definition                            │
│  4. ECS faz Rolling Update:                                 │
│                                                             │
│     Passo 1:                                                │
│     • Inicia 1 novo container (worker:v2)                  │
│     • Aguarda health check                                 │
│     • Para 1 container antigo (worker:v1)                  │
│                                                             │
│     Passo 2:                                                │
│     • Inicia mais 1 novo container                          │
│     • Para mais 1 container antigo                         │
│                                                             │
│     ... (repetir até todos atualizados)                     │
│                                                             │
│  Resultado:                                                 │
│  • Zero downtime                                            │
│  • Webhooks continuam sendo processados                    │
│  • API REST continua disponível                             │
│  • Jobs não são interrompidos                               │
│  • Rollback automático se health check falhar              │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 Comparação: Recursos e Custos

### Estado Atual (PM2 em EC2)

```
┌─────────────────────────────────────────────────────────────┐
│              EC2 INSTANCE: t3.xlarge                        │
│                                                             │
│  • vCPU: 4                                                  │
│  • RAM: 16 GB                                               │
│  • Custo: ~$150/mês                                         │
│                                                             │
│  Uso:                                                       │
│  • Webhook Handler: 0.5 vCPU, 200 MB                       │
│  • API REST: 1 vCPU, 500 MB                                │
│  • Workers: 2.5 vCPU, 800 MB                               │
│  • Sistema: 0.5 vCPU, 500 MB                               │
│                                                             │
│  Problemas:                                                 │
│  • Recursos fixos (não escala)                             │
│  • Paga mesmo quando não usa tudo                           │
│  • Se precisa escalar, paga por instância maior            │
└─────────────────────────────────────────────────────────────┘
```

### Estado Ideal (ECS Fargate)

```
┌─────────────────────────────────────────────────────────────┐
│              ECS FARGATE (Pay per use)                      │
│                                                             │
│  Webhook Handler:                                           │
│  • 3 containers × 0.25 vCPU × 512 MB                       │
│  • Custo: ~$15/mês (uso médio)                              │
│  • Escala até 10 quando necessário                          │
│                                                             │
│  API REST:                                                  │
│  • 5 containers × 0.5 vCPU × 1024 MB                      │
│  • Custo: ~$50/mês (uso médio)                              │
│  • Escala até 20 quando necessário                         │
│                                                             │
│  Workers:                                                   │
│  • 10 containers × 1 vCPU × 2048 MB                        │
│  • Custo: ~$200/mês (uso médio)                              │
│  • Escala até 50 quando necessário                          │
│                                                             │
│  Total: ~$265/mês (uso médio)                                │
│                                                             │
│  Benefícios:                                                 │
│  • Escala sob demanda (paga só quando usa)                  │
│  • Custo otimizado (não paga por recursos ociosos)          │
│  • Alta disponibilidade (múltiplas instâncias)             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 Resumo: Por Que Separar Físicamente?

### Benefícios da Separação Física

1. **Escalabilidade Independente**
    - Escala só o componente que precisa
    - Não escala recursos desnecessários

2. **Deploy Independente**
    - Atualiza um componente sem afetar outros
    - Zero downtime
    - Rollback granular

3. **Isolamento de Recursos**
    - Cada componente tem seus próprios recursos
    - Sem competição por CPU/RAM
    - Performance isolada

4. **Alta Disponibilidade**
    - Múltiplas instâncias de cada componente
    - Se uma instância cai, outras continuam
    - Sem single point of failure

5. **Custo Otimizado**
    - Paga só pelo que usa
    - Escala sob demanda
    - Não paga por recursos ociosos

6. **Monitoramento Granular**
    - Métricas por componente
    - Alertas específicos
    - Debugging mais fácil

---

## 🚀 Próximos Passos Práticos

### Migração Gradual

1. **Fase 1: Containerização**
    - Criar Dockerfiles para cada componente
    - Testar localmente com Docker Compose
    - Validar separação física

2. **Fase 2: ECS Fargate (Staging)**
    - Deploy em staging
    - Configurar auto-scaling
    - Testar deploys independentes

3. **Fase 3: ECS Fargate (Production)**
    - Migração gradual (blue-green)
    - Monitorar métricas
    - Otimizar recursos

---

## 📚 Referências

- **AWS ECS Fargate**: https://aws.amazon.com/ecs/
- **Container Orchestration**: https://kubernetes.io/
- **Microservices Patterns**: Sam Newman

---

**Conclusão**: A separação física permite escalabilidade, deploys independentes e isolamento de recursos, resultando em maior flexibilidade, performance e custo otimizado.
