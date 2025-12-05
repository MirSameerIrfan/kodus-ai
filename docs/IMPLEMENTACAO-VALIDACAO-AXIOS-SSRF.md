# Implementação de Validação Axios SSRF

**Objetivo:** Prevenir SSRF e credential leakage em serviços axios com baseURL

---

## 📦 Componentes Criados

### 1. `AxiosUrlValidator` - Validador de URLs

**Localização:** `src/shared/utils/axios-url-validator.ts`

Valida se URLs são relativas (não absolutas ou protocol-relative).

**Uso:**
```typescript
import { AxiosUrlValidator } from '@/shared/utils/axios-url-validator';

// Validar URL
AxiosUrlValidator.validateRelativeUrl('/api/users'); // ✅ OK
AxiosUrlValidator.validateRelativeUrl('http://attacker.com'); // ❌ Erro
```

### 2. `BaseSecureAxiosService` - Classe Base Segura

**Localização:** `src/config/axios/base-secure-axios.service.ts`

Classe base que todos os serviços axios devem estender. Inclui:
- Validação automática via interceptor
- Métodos `secureGet()`, `securePost()`, etc. com validação explícita

---

## 🔧 Como Atualizar Serviços Existentes

### Opção 1: Usar Classe Base (Recomendado)

**Antes:**
```typescript
import axios, { AxiosInstance } from 'axios';

export class AxiosMCPManagerService {
    private axiosInstance: AxiosInstance;

    constructor() {
        this.axiosInstance = axios.create({
            baseURL: process.env.API_KODUS_SERVICE_MCP_MANAGER,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }

    public async get(url: string, config = {}) {
        const { data } = await this.axiosInstance.get(url, config);
        return data;
    }
}
```

**Depois:**
```typescript
import { BaseSecureAxiosService } from '@/config/axios/base-secure-axios.service';

export class AxiosMCPManagerService extends BaseSecureAxiosService {
    constructor() {
        super(
            process.env.API_KODUS_SERVICE_MCP_MANAGER || '',
            { 'Content-Type': 'application/json' }
        );
    }

    public async get(url: string, config = {}) {
        return this.secureGet(url, config);
    }

    public async post(url: string, body = {}, config = {}) {
        return this.securePost(url, body, config);
    }
}
```

**Vantagens:**
- ✅ Validação automática via interceptor
- ✅ Métodos `secure*` com validação explícita
- ✅ Código mais limpo

### Opção 2: Adicionar Validação Manual

Se não quiser usar a classe base, adicione validação manual:

```typescript
import axios, { AxiosInstance } from 'axios';
import { AxiosUrlValidator } from '@/shared/utils/axios-url-validator';

export class AxiosMCPManagerService {
    private axiosInstance: AxiosInstance;

    constructor() {
        this.axiosInstance = axios.create({
            baseURL: process.env.API_KODUS_SERVICE_MCP_MANAGER,
            headers: {
                'Content-Type': 'application/json',
            },
        });
        
        // Adicionar interceptor de validação
        this.setupSecurityInterceptor();
    }

    private setupSecurityInterceptor() {
        this.axiosInstance.interceptors.request.use(
            (config) => {
                if (config.url) {
                    AxiosUrlValidator.validateRelativeUrl(config.url);
                }
                return config;
            },
            (error) => Promise.reject(error),
        );
    }

    public async get(url: string, config = {}) {
        AxiosUrlValidator.validateRelativeUrl(url); // Validação explícita também
        const { data } = await this.axiosInstance.get(url, config);
        return data;
    }
}
```

---

## 📝 Exemplo Completo: Atualizando AxiosASTService

**Arquivo:** `src/config/axios/microservices/ast.axios.ts`

```typescript
import { AxiosRequestConfig } from 'axios';
import { BaseSecureAxiosService } from '@/config/axios/base-secure-axios.service';

export class AxiosASTService extends BaseSecureAxiosService {
    constructor() {
        super(
            process.env.API_SERVICE_AST_URL || '',
            { 'Content-Type': 'application/json' }
        );
        
        // Configurar timeout
        this.getAxiosInstance().defaults.timeout = 120000;
        
        // Manter interceptors customizados se necessário
        this.setupCustomInterceptors();
    }

    private setupCustomInterceptors() {
        const instance = this.getAxiosInstance();
        
        instance.interceptors.response.use(
            (response) => {
                return response;
            },
            (error) => {
                return Promise.reject(error);
            },
        );
    }

    // Métodos públicos com validação automática
    public async get<T = any>(
        url: string,
        config: AxiosRequestConfig = {},
    ): Promise<T> {
        return this.secureGet<T>(url, config);
    }

    public async post<T = any>(
        url: string,
        body: Record<string, unknown> = {},
        config: AxiosRequestConfig = {},
    ): Promise<T> {
        return this.securePost<T>(url, body, config);
    }

    public async delete<T = any>(
        url: string,
        config: AxiosRequestConfig = {},
    ): Promise<T> {
        return this.secureDelete<T>(url, config);
    }

    public async put<T = any>(
        url: string,
        body: Record<string, unknown> = {},
        config: AxiosRequestConfig = {},
    ): Promise<T> {
        return this.securePut<T>(url, body, config);
    }
}
```

---

## ✅ Checklist de Migração

Para cada serviço axios:

- [ ] Estender `BaseSecureAxiosService` ou adicionar validação manual
- [ ] Atualizar métodos `get()`, `post()`, etc. para usar `secure*` ou validar manualmente
- [ ] Manter interceptors customizados se necessário
- [ ] Testar que URLs relativas funcionam
- [ ] Testar que URLs absolutas são rejeitadas
- [ ] Verificar que não há regressões

---

## 🧪 Testes

### Teste Unitário Exemplo

```typescript
import { AxiosUrlValidator } from '@/shared/utils/axios-url-validator';

describe('AxiosUrlValidator', () => {
    describe('validateRelativeUrl', () => {
        it('should accept relative URLs', () => {
            expect(() => {
                AxiosUrlValidator.validateRelativeUrl('/api/users');
            }).not.toThrow();
            
            expect(() => {
                AxiosUrlValidator.validateRelativeUrl('users/123');
            }).not.toThrow();
        });

        it('should reject absolute URLs', () => {
            expect(() => {
                AxiosUrlValidator.validateRelativeUrl('http://attacker.com');
            }).toThrow('Absolute URLs are not allowed');
            
            expect(() => {
                AxiosUrlValidator.validateRelativeUrl('https://evil.com');
            }).toThrow('Absolute URLs are not allowed');
        });

        it('should reject protocol-relative URLs', () => {
            expect(() => {
                AxiosUrlValidator.validateRelativeUrl('//attacker.com');
            }).toThrow('Protocol-relative URLs are not allowed');
        });
    });
});
```

### Teste de Integração

```typescript
describe('AxiosMCPManagerService', () => {
    it('should reject absolute URLs', async () => {
        const service = new AxiosMCPManagerService();
        
        await expect(
            service.get('http://attacker.com')
        ).rejects.toThrow('SSRF Protection');
    });

    it('should accept relative URLs', async () => {
        const service = new AxiosMCPManagerService();
        
        // Mock axios para não fazer requisição real
        jest.spyOn(service['axiosInstance'], 'get').mockResolvedValue({
            data: { success: true }
        });
        
        const result = await service.get('/api/connections');
        expect(result).toEqual({ success: true });
    });
});
```

---

## 🚀 Plano de Implementação

### Fase 1: Criar Infraestrutura (✅ Feito)
- [x] Criar `AxiosUrlValidator`
- [x] Criar `BaseSecureAxiosService`

### Fase 2: Migrar Serviços (Próximo passo)
- [ ] Migrar `AxiosASTService`
- [ ] Migrar `AxiosMCPManagerService`
- [ ] Migrar `AxiosLicenseService`
- [ ] Migrar `AxiosMSTeamsService`
- [ ] Migrar `AxiosAzureReposService`

### Fase 3: Testes
- [ ] Testes unitários para validador
- [ ] Testes de integração para cada serviço
- [ ] Testes de regressão

---

## 📚 Referências

- [Axios Issue #6463](https://github.com/axios/axios/issues/6463)
- [OWASP SSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)

