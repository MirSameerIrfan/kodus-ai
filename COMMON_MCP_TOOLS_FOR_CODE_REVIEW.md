# Ferramentas MCP Comuns para Code Review

## 📋 Categorias de Ferramentas

### 1. 🔴 Error Tracking & Monitoring

#### Sentry (já disponível)

- `@mcp<sentry|search_events>` - Buscar eventos de erro
- `@mcp<sentry|search_issues>` - Buscar issues agrupadas
- `@mcp<sentry|get_issue_details>` - Detalhes de issue específica
- `@mcp<sentry|find_releases>` - Buscar releases
- `@mcp<sentry|get_trace_details>` - Detalhes de trace
- `@mcp<sentry|analyze_issue_with_seer>` - Análise AI de erros

#### Outras ferramentas de erro:

- **Rollbar** - `@mcp<rollbar|get_occurrences>`, `@mcp<rollbar|get_item>`
- **Bugsnag** - `@mcp<bugsnag|get_errors>`, `@mcp<bugsnag|get_event>`
- **Honeybadger** - `@mcp<honeybadger|get_notices>`
- **Airbrake** - `@mcp<airbrake|get_errors>`

---

### 2. 📊 Monitoring & Observability

#### Datadog

- `@mcp<datadog|get_metrics>` - Buscar métricas
- `@mcp<datadog|get_alerts>` - Verificar alertas configurados
- `@mcp<datadog|get_dashboards>` - Verificar dashboards
- `@mcp<datadog|get_logs>` - Buscar logs
- `@mcp<datadog|get_incidents>` - Verificar incidentes

#### New Relic

- `@mcp<newrelic|get_alerts>` - Verificar alertas
- `@mcp<newrelic|get_metrics>` - Buscar métricas
- `@mcp<newrelic|query_nrql>` - Query NRQL
- `@mcp<newrelic|get_apm_data>` - Dados APM

#### Prometheus

- `@mcp<prometheus|query>` - Query PromQL
- `@mcp<prometheus|get_rules>` - Verificar alerting rules
- `@mcp<prometheus|get_targets>` - Verificar targets

#### Grafana

- `@mcp<grafana|get_dashboards>` - Verificar dashboards
- `@mcp<grafana|get_alerts>` - Verificar alertas
- `@mcp<grafana|get_panels>` - Verificar painéis

#### Outras:

- **CloudWatch** (AWS) - `@mcp<cloudwatch|get_metrics>`, `@mcp<cloudwatch|get_alarms>`
- **Stackdriver** (GCP) - `@mcp<stackdriver|get_metrics>`, `@mcp<stackdriver|get_alerts>`
- **Azure Monitor** - `@mcp<azure|get_metrics>`, `@mcp<azure|get_alerts>`

---

### 3. 🎫 Issue Tracking & Project Management

#### Jira

- `@mcp<jira|get_issue>` - Buscar issue específica
- `@mcp<jira|search_issues>` - Buscar issues
- `@mcp<jira|get_project>` - Informações do projeto
- `@mcp<jira|get_epic>` - Buscar epic relacionado
- `@mcp<jira|get_sprint>` - Informações de sprint

#### Linear

- `@mcp<linear|get_issue>` - Buscar issue
- `@mcp<linear|list_issues>` - Listar issues
- `@mcp<linear|get_project>` - Informações do projeto
- `@mcp<linear|get_cycle>` - Informações de ciclo

#### GitHub Issues

- `@mcp<github|get_issue>` - Buscar issue
- `@mcp<github|list_issues>` - Listar issues
- `@mcp<github|get_milestone>` - Informações de milestone

#### Outras:

- **Asana** - `@mcp<asana|get_task>`, `@mcp<asana|get_project>`
- **Trello** - `@mcp<trello|get_card>`, `@mcp<trello|get_board>`
- **Monday.com** - `@mcp<monday|get_item>`, `@mcp<monday|get_board>`
- **ClickUp** - `@mcp<clickup|get_task>`, `@mcp<clickup|get_list>`
- **Azure DevOps** - `@mcp<azure-devops|get_work_item>`
- **Pivotal Tracker** - `@mcp<pivotal|get_story>`

---

### 4. 🔒 Security & Vulnerability Scanning

#### Snyk

- `@mcp<snyk|test_project>` - Testar vulnerabilidades
- `@mcp<snyk|get_vulnerabilities>` - Listar vulnerabilidades
- `@mcp<snyk|get_licenses>` - Verificar licenças
- `@mcp<snyk|get_dependencies>` - Analisar dependências

#### SonarQube

- `@mcp<sonarqube|get_issues>` - Buscar issues de qualidade
- `@mcp<sonarqube|get_measures>` - Métricas de qualidade
- `@mcp<sonarqube|get_hotspots>` - Security hotspots
- `@mcp<sonarqube|get_coverage>` - Cobertura de testes

#### OWASP Dependency Check

- `@mcp<owasp|scan_dependencies>` - Escanear dependências
- `@mcp<owasp|get_vulnerabilities>` - Listar vulnerabilidades

#### Outras:

- **Dependabot** - `@mcp<dependabot|get_alerts>`
- **WhiteSource** - `@mcp<whitesource|get_vulnerabilities>`
- **Veracode** - `@mcp<veracode|get_scans>`
- **Checkmarx** - `@mcp<checkmarx|get_scans>`

---

### 5. 🚀 CI/CD & Build Systems

#### GitHub Actions

- `@mcp<github-actions|get_workflow_runs>` - Verificar execuções
- `@mcp<github-actions|get_workflow>` - Verificar workflow
- `@mcp<github-actions|get_job>` - Status de jobs

#### GitLab CI

- `@mcp<gitlab-ci|get_pipeline>` - Status de pipeline
- `@mcp<gitlab-ci|get_job>` - Status de jobs
- `@mcp<gitlab-ci|get_variables>` - Variáveis de CI

#### Jenkins

- `@mcp<jenkins|get_build>` - Status de build
- `@mcp<jenkins|get_job>` - Informações de job
- `@mcp<jenkins|get_test_results>` - Resultados de testes

#### CircleCI

- `@mcp<circleci|get_pipeline>` - Status de pipeline
- `@mcp<circleci|get_job>` - Status de job
- `@mcp<circleci|get_workflow>` - Status de workflow

#### Outras:

- **Travis CI** - `@mcp<travis|get_build>`
- **Azure Pipelines** - `@mcp<azure-pipelines|get_pipeline>`
- **Buildkite** - `@mcp<buildkite|get_build>`
- **TeamCity** - `@mcp<teamcity|get_build>`

---

### 6. 📚 Documentation & Knowledge Base

#### Confluence

- `@mcp<confluence|get_page>` - Buscar página
- `@mcp<confluence|search_pages>` - Buscar páginas
- `@mcp<confluence|get_space>` - Informações de space

#### Notion

- `@mcp<notion|get_page>` - Buscar página
- `@mcp<notion|search_pages>` - Buscar páginas
- `@mcp<notion|get_database>` - Buscar database

#### GitBook

- `@mcp<gitbook|get_page>` - Buscar página
- `@mcp<gitbook|search>` - Buscar conteúdo

#### Outras:

- **Read the Docs** - `@mcp<readthedocs|get_page>`
- **Docusaurus** - `@mcp<docusaurus|get_doc>`
- **MkDocs** - `@mcp<mkdocs|get_page>`

---

### 7. 🗄️ Database & Data Management

#### Database Tools (genéricos)

- `@mcp<database|validate_migration>` - Validar migração
- `@mcp<database|check_schema>` - Verificar schema
- `@mcp<database|get_table_info>` - Informações de tabela
- `@mcp<database|run_query>` - Executar query (read-only)

#### PostgreSQL específico

- `@mcp<postgres|get_schema>` - Schema atual
- `@mcp<postgres|validate_migration>` - Validar migração
- `@mcp<postgres|check_indexes>` - Verificar índices

#### MySQL específico

- `@mcp<mysql|get_schema>` - Schema atual
- `@mcp<mysql|validate_migration>` - Validar migração

#### Outras:

- **MongoDB** - `@mcp<mongodb|get_collections>`, `@mcp<mongodb|get_indexes>`
- **Redis** - `@mcp<redis|get_keys>`, `@mcp<redis|get_config>`
- **DynamoDB** - `@mcp<dynamodb|get_table>`, `@mcp<dynamodb|get_indexes>`

---

### 8. ☁️ Cloud Providers

#### AWS

- `@mcp<aws|get_lambda>` - Informações de Lambda
- `@mcp<aws|get_ec2>` - Instâncias EC2
- `@mcp<aws|get_s3>` - Buckets S3
- `@mcp<aws|get_rds>` - Instâncias RDS
- `@mcp<aws|get_iam_policy>` - Políticas IAM

#### Google Cloud Platform

- `@mcp<gcp|get_cloud_function>` - Cloud Functions
- `@mcp<gcp|get_compute>` - Instâncias Compute
- `@mcp<gcp|get_storage>` - Cloud Storage
- `@mcp<gcp|get_sql>` - Cloud SQL

#### Azure

- `@mcp<azure|get_function>` - Azure Functions
- `@mcp<azure|get_vm>` - Virtual Machines
- `@mcp<azure|get_storage>` - Storage Accounts
- `@mcp<azure|get_sql>` - SQL Databases

---

### 9. 🔌 API Testing & Documentation

#### Postman

- `@mcp<postman|get_collection>` - Buscar collection
- `@mcp<postman|get_environment>` - Variáveis de ambiente
- `@mcp<postman|run_collection>` - Executar testes

#### Insomnia

- `@mcp<insomnia|get_request>` - Buscar request
- `@mcp<insomnia|get_collection>` - Buscar collection

#### OpenAPI/Swagger

- `@mcp<openapi|validate_spec>` - Validar spec
- `@mcp<openapi|get_endpoints>` - Listar endpoints
- `@mcp<openapi|compare_specs>` - Comparar specs

---

### 10. 💬 Communication & Collaboration

#### Slack

- `@mcp<slack|search_messages>` - Buscar mensagens
- `@mcp<slack|get_channel>` - Informações de canal
- `@mcp<slack|get_thread>` - Thread de mensagens

#### Microsoft Teams

- `@mcp<teams|get_channel>` - Informações de canal
- `@mcp<teams|search_messages>` - Buscar mensagens

#### Discord

- `@mcp<discord|get_channel>` - Informações de canal
- `@mcp<discord|search_messages>` - Buscar mensagens

---

### 11. 📦 Package & Dependency Management

#### npm

- `@mcp<npm|get_package>` - Informações de pacote
- `@mcp<npm|check_vulnerabilities>` - Verificar vulnerabilidades
- `@mcp<npm|get_dependencies>` - Dependências de pacote

#### PyPI

- `@mcp<pypi|get_package>` - Informações de pacote
- `@mcp<pypi|check_vulnerabilities>` - Verificar vulnerabilidades

#### Maven Central

- `@mcp<maven|get_artifact>` - Informações de artefato
- `@mcp<maven|check_vulnerabilities>` - Verificar vulnerabilidades

---

### 12. 🧪 Testing & Quality

#### TestRail

- `@mcp<testrail|get_test>` - Buscar teste
- `@mcp<testrail|get_run>` - Informações de test run
- `@mcp<testrail|get_results>` - Resultados de testes

#### Zephyr

- `@mcp<zephyr|get_test>` - Buscar teste
- `@mcp<zephyr|get_execution>` - Execução de teste

---

### 13. 🔐 Secrets & Configuration Management

#### HashiCorp Vault

- `@mcp<vault|get_secret>` - Buscar secret (read-only)
- `@mcp<vault|list_secrets>` - Listar secrets disponíveis
- `@mcp<vault|check_policy>` - Verificar políticas

#### AWS Secrets Manager

- `@mcp<aws-secrets|get_secret>` - Buscar secret
- `@mcp<aws-secrets|list_secrets>` - Listar secrets

#### Azure Key Vault

- `@mcp<azure-keyvault|get_secret>` - Buscar secret
- `@mcp<azure-keyvault|list_secrets>` - Listar secrets

---

### 14. 📈 Analytics & Metrics

#### Google Analytics

- `@mcp<ga|get_metrics>` - Buscar métricas
- `@mcp<ga|get_events>` - Eventos

#### Mixpanel

- `@mcp<mixpanel|get_events>` - Buscar eventos
- `@mcp<mixpanel|get_funnels>` - Funnels

#### Amplitude

- `@mcp<amplitude|get_events>` - Buscar eventos
- `@mcp<amplitude|get_cohorts>` - Cohorts

---

## 🎯 Casos de Uso Comuns em Code Review

### Validação de Segurança

- Verificar vulnerabilidades em dependências (`@mcp<snyk|test_project>`)
- Validar configurações de segurança (`@mcp<vault|check_policy>`)
- Verificar exposição de secrets (`@mcp<github|search_secrets>`)

### Validação de Performance

- Verificar métricas de produção (`@mcp<datadog|get_metrics>`)
- Validar alertas configurados (`@mcp<newrelic|get_alerts>`)
- Verificar queries lentas (`@mcp<database|get_slow_queries>`)

### Validação de Integração

- Verificar APIs documentadas (`@mcp<openapi|validate_spec>`)
- Validar contratos de API (`@mcp<postman|get_collection>`)
- Verificar webhooks configurados (`@mcp<slack|get_webhooks>`)

### Validação de Deploy

- Verificar pipelines CI/CD (`@mcp<github-actions|get_workflow_runs>`)
- Validar releases (`@mcp<sentry|find_releases>`)
- Verificar deployments (`@mcp<aws|get_deployments>`)

### Validação de Documentação

- Verificar docs atualizados (`@mcp<confluence|get_page>`)
- Validar ADRs (`@mcp<notion|search_pages>`)
- Verificar README (`@mcp<kodus|kodus_get_repository_content>`)

---

## 📝 Notas Importantes

1. **Ferramentas padrão do Kodus** (sempre disponíveis):
    - `@mcp<kodus|kodus_get_repository_files>`
    - `@mcp<kodus|kodus_get_repository_content>`
    - `@mcp<kodus|kodus_get_pull_request>`
    - `@mcp<kodus|kodus_get_diff_for_file>`
    - E outras ferramentas Kodus

2. **Ferramentas customizadas**: Usuários podem conectar seus próprios MCPs via interface

3. **Sintaxe**: Sempre use `@mcp<provider|tool_name>` no texto da regra

4. **Variáveis de contexto**: Combine com variáveis como `pr_title`, `pr_description`, `fileDiff`, etc.
