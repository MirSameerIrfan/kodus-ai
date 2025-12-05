# Análise de Segurança JWT - Mapeamento de Recomendações

**Data:** 2024  
**Escopo:** `src/core/infrastructure/adapters/services/auth`

---

## 📋 Objetivo

Este documento mapeia as recomendações de segurança JWT fornecidas contra o estado atual da implementação, identificando o que está implementado, o que falta e como implementar.

---

## 🔍 Estado Atual da Implementação

### 1. Assinatura de Tokens

**Recomendação:** Use sempre assinatura, nunca token "none"

**Estado Atual:**
```20:24:src/core/infrastructure/adapters/services/auth/jwt-auth.strategy.ts
super({
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    ignoreExpiration: false,
    secretOrKey: configService.get<JWT>('jwtConfig').secret,
});
```

**Análise:**
- ✅ Tokens são assinados com secret (HS256 por padrão do @nestjs/jwt)
- ⚠️ **PROBLEMA:** Não há validação explícita do algoritmo
- ⚠️ **PROBLEMA:** Não há rejeição explícita de tokens com `alg: "none"`
- ⚠️ **PROBLEMA:** Não especifica `algorithms` na configuração do Passport Strategy

**Risco:** Um atacante poderia tentar enviar um token com `alg: "none"` e, dependendo da configuração da biblioteca, poderia ser aceito.

**O que falta:**
- Especificar explicitamente `algorithms: ['HS256']` (ou o algoritmo usado) na configuração do Strategy
- Validar que o algoritmo do token não é "none"

---

### 2. Rotação de Chaves com suporte a `kid`

**Recomendação:** Rotacione chaves periodicamente (e tenha suporte a kid no header para suportar chaves antigas)

**Estado Atual:**
```255:263:src/core/infrastructure/adapters/services/auth/auth.service.ts
const access_token = await this.jwtService.signAsync(payload, {
    secret: this.jwtConfig.secret,
    expiresIn: this.jwtConfig.expiresIn,
});

const refresh_token = await this.jwtService.signAsync(payload, {
    secret: this.jwtConfig.refreshSecret,
    expiresIn: this.jwtConfig.refreshExpiresIn,
});
```

**Análise:**
- ❌ **NÃO IMPLEMENTADO:** Não há rotação de chaves
- ❌ **NÃO IMPLEMENTADO:** Não há suporte a `kid` (Key ID) no header do JWT
- ❌ **NÃO IMPLEMENTADO:** Não há sistema de gerenciamento de múltiplas chaves
- ⚠️ Chaves são estáticas e definidas via variáveis de ambiente

**Risco:** 
- Se uma chave for comprometida, todos os tokens válidos permanecem válidos até expirarem
- Não há como invalidar tokens sem invalidar todos os usuários
- Não há histórico de chaves para suportar tokens antigos durante transição

**O que precisa ser implementado:**
1. Sistema de gerenciamento de chaves com suporte a múltiplas chaves ativas
2. Geração de `kid` único para cada chave
3. Inclusão de `kid` no header do JWT durante a assinatura
4. Rotação periódica automática de chaves
5. Suporte a múltiplas chaves na validação (chave atual + chaves antigas durante período de transição)
6. Armazenamento de chaves (pode ser em memória, Redis, ou banco de dados)

**Exemplo de estrutura necessária:**
```typescript
interface JwtKey {
    kid: string;              // Key ID único
    secret: string;           // Secret da chave
    createdAt: Date;          // Data de criação
    expiresAt?: Date;         // Data de expiração (opcional)
    isActive: boolean;        // Se está ativa
}

// Header do JWT deveria incluir:
{
    "alg": "HS256",
    "kid": "abc123..."  // Key ID
}
```

---

### 3. Validação de Issuer (`iss`)

**Recomendação:** Verificar se `iss` é o que você espera

**Estado Atual:**
```251:252:src/core/infrastructure/adapters/services/auth/auth.service.ts
iss: 'kodus-orchestrator',
aud: 'web',
```

**Análise:**
- ✅ O `iss` é definido no payload: `'kodus-orchestrator'`
- ❌ **PROBLEMA:** Não há validação do `iss` na Strategy
- ❌ **PROBLEMA:** A configuração do Passport Strategy não inclui `issuer`

**Risco:** Tokens emitidos por outros sistemas ou com `iss` diferente podem ser aceitos.

**O que falta:**
```typescript
// Na configuração do Strategy:
super({
    // ... outras opções
    issuer: 'kodus-orchestrator',  // Validar issuer
});
```

**Localização:** `jwt-auth.strategy.ts:20-24`

---

### 4. Validação de Audience (`aud`)

**Recomendação:** Verificar se `aud` contém o identificador da app/API atual

**Estado Atual:**
```252:252:src/core/infrastructure/adapters/services/auth/auth.service.ts
aud: 'web',
```

**Análise:**
- ✅ O `aud` é definido no payload: `'web'`
- ❌ **PROBLEMA:** Não há validação do `aud` na Strategy
- ❌ **PROBLEMA:** A configuração do Passport Strategy não inclui `audience`

**Risco:** Tokens emitidos para outras aplicações podem ser aceitos nesta API.

**O que falta:**
```typescript
// Na configuração do Strategy:
super({
    // ... outras opções
    audience: 'web',  // Validar audience
});
```

**Localização:** `jwt-auth.strategy.ts:20-24`

---

### 5. Cookies HttpOnly + Secure + SameSite para SPA/Web App

**Recomendação:** Access token preferencialmente em cookie HttpOnly + Secure + SameSite. Protege contra XSS (JS não lê o token)

**Estado Atual:**
```grep
cookie|Cookie|setCookie
src/core/infrastructure/http/controllers
```

**Resultado:** Nenhum uso de cookies encontrado nos controllers.

**Análise:**
- ❌ **NÃO IMPLEMENTADO:** Tokens são retornados apenas no body da resposta JSON
- ❌ **NÃO IMPLEMENTADO:** Não há uso de cookies para armazenar tokens
- ⚠️ Tokens são enviados via `Authorization: Bearer <token>` header

**Risco:**
- Tokens armazenados em `localStorage` ou `sessionStorage` são acessíveis via JavaScript
- Vulnerável a ataques XSS que podem roubar tokens
- Tokens podem ser interceptados se não usar HTTPS

**O que precisa ser implementado:**

1. **No Controller de Login/Refresh:**
```typescript
@Post('login')
async login(@Body() body: LoginDTO, @Res() res: Response) {
    const tokens = await this.loginUseCase.execute(...);
    
    // Set access token em cookie HttpOnly
    res.cookie('access_token', tokens.accessToken, {
        httpOnly: true,        // JS não pode acessar
        secure: true,          // Apenas HTTPS
        sameSite: 'lax',      // Proteção CSRF
        maxAge: 15 * 60 * 1000, // 15 minutos
        path: '/',
    });
    
    // Refresh token também em cookie (ou pode manter no body para mobile)
    res.cookie('refresh_token', tokens.refreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 dias
        path: '/auth',
    });
    
    return res.json({ success: true });
}
```

2. **Atualizar Strategy para ler de cookies:**
```typescript
import { ExtractJwt } from 'passport-jwt';

// Adicionar extractor de cookie
const cookieExtractor = (req: Request) => {
    let token = null;
    if (req && req.cookies) {
        token = req.cookies['access_token'];
    }
    return token;
};

super({
    jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(), // Fallback para header
        cookieExtractor,                           // Prioridade para cookie
    ]),
    // ...
});
```

3. **Instalar cookie-parser no NestJS:**
```typescript
// main.ts
import * as cookieParser from 'cookie-parser';

app.use(cookieParser());
```

**Considerações:**
- Para aplicações mobile/SPA, pode ser necessário manter suporte a header Bearer como fallback
- `sameSite: 'lax'` permite cookies em navegação cross-site GET (útil para links)
- `sameSite: 'strict'` é mais seguro mas pode quebrar alguns fluxos

---

### 6. Proteção CSRF

**Recomendação:** Contra CSRF: usar SameSite=Lax/Strict se possível ou CSRF token/classic pattern

**Estado Atual:**
- ❌ **NÃO IMPLEMENTADO:** Não há proteção CSRF específica
- ⚠️ Helmet está configurado (pode ter algumas proteções básicas)
- ⚠️ CORS está configurado mas muito permissivo (`origin: true`)

**Análise:**
- Se usar cookies com `SameSite: 'strict'` ou `'lax'`, já há proteção básica contra CSRF
- Para proteção adicional, pode implementar CSRF tokens

**Opções de implementação:**

**Opção 1: SameSite Cookie (Mais Simples)**
- Já mencionado acima
- `SameSite: 'strict'` - Cookies não são enviados em requisições cross-site
- `SameSite: 'lax'` - Cookies são enviados apenas em GET cross-site (navegação normal)

**Opção 2: CSRF Token (Mais Robusto)**
```typescript
// Gerar CSRF token no login
const csrfToken = crypto.randomBytes(32).toString('hex');

// Enviar em cookie HttpOnly
res.cookie('csrf_token', csrfToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
});

// Retornar também no body para o frontend incluir em headers
return { csrfToken };

// Validar em todas as requisições POST/PUT/DELETE
@UseGuards(CsrfGuard)
@Post('some-endpoint')
async someEndpoint(@Headers('x-csrf-token') csrfToken: string, @Cookies('csrf_token') cookieToken: string) {
    if (csrfToken !== cookieToken) {
        throw new ForbiddenException('Invalid CSRF token');
    }
    // ...
}
```

**Recomendação:** Começar com `SameSite: 'lax'` nos cookies. Se necessário mais proteção, adicionar CSRF tokens.

---

### 7. Validação Explícita de Algoritmo

**Recomendação:** `algorithms: ['RS256']` (ou o que você usa) na verificação

**Estado Atual:**
```20:24:src/core/infrastructure/adapters/services/auth/jwt-auth.strategy.ts
super({
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    ignoreExpiration: false,
    secretOrKey: configService.get<JWT>('jwtConfig').secret,
});
```

**Análise:**
- ❌ **PROBLEMA:** Não especifica `algorithms` na configuração
- ⚠️ Por padrão, `passport-jwt` pode aceitar qualquer algoritmo se não especificado
- ⚠️ Atualmente usando HS256 (simétrico), mas não está explícito

**O que falta:**
```typescript
super({
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    ignoreExpiration: false,
    secretOrKey: configService.get<JWT>('jwtConfig').secret,
    algorithms: ['HS256'],  // Especificar explicitamente
});
```

**Nota:** Se no futuro migrar para RS256 (assimétrico), precisará:
- Gerar par de chaves (privada/pública)
- Usar chave privada para assinar
- Usar chave pública para validar
- Configurar `algorithms: ['RS256']`

---

## 📊 Resumo de Implementação

| Recomendação | Status | Prioridade | Complexidade |
|--------------|--------|------------|--------------|
| Assinatura sempre (nunca "none") | ⚠️ Parcial | 🔴 Alta | 🟢 Baixa |
| Rotação de chaves com `kid` | ❌ Não implementado | 🔴 Alta | 🔴 Alta |
| Validar `iss` | ❌ Não implementado | 🟡 Média | 🟢 Baixa |
| Validar `aud` | ❌ Não implementado | 🟡 Média | 🟢 Baixa |
| Cookies HttpOnly + Secure + SameSite | ❌ Não implementado | 🔴 Alta | 🟡 Média |
| Proteção CSRF | ❌ Não implementado | 🟡 Média | 🟡 Média |
| Validar algoritmo explicitamente | ❌ Não implementado | 🔴 Alta | 🟢 Baixa |

---

## 🎯 Plano de Implementação Sugerido

### Fase 1 - Correções Rápidas (1-2 dias)
1. ✅ Adicionar validação de algoritmo explícita (`algorithms: ['HS256']`)
2. ✅ Adicionar validação de `iss` e `aud` na Strategy
3. ✅ Rejeitar explicitamente tokens com `alg: "none"`

### Fase 2 - Cookies Seguros (3-5 dias)
4. ✅ Implementar cookies HttpOnly + Secure + SameSite
5. ✅ Atualizar Strategy para ler de cookies (com fallback para header)
6. ✅ Atualizar controllers de login/refresh para setar cookies

### Fase 3 - Rotação de Chaves (1-2 semanas)
7. ✅ Criar sistema de gerenciamento de chaves com `kid`
8. ✅ Implementar rotação periódica automática
9. ✅ Suportar múltiplas chaves na validação
10. ✅ Adicionar `kid` no header dos tokens

### Fase 4 - Proteção CSRF (opcional, se necessário)
11. ✅ Implementar CSRF tokens se `SameSite` não for suficiente

---

## 🔧 Arquivos que Precisam ser Modificados

### Correções Imediatas:
1. `src/core/infrastructure/adapters/services/auth/jwt-auth.strategy.ts`
   - Adicionar `algorithms`, `issuer`, `audience`
   - Melhorar validação do payload

2. `src/config/types/jwt/jwt.ts`
   - Adicionar campos para issuer, audience, algorithm

3. `src/config/loaders/jwt.config.loader.ts`
   - Adicionar configuração de issuer, audience, algorithm

### Implementação de Cookies:
4. `src/core/infrastructure/http/controllers/auth.controller.ts`
   - Modificar métodos de login/refresh para setar cookies

5. `apps/api/src/main.ts` ou `src/main.ts`
   - Adicionar `cookie-parser` middleware

6. `src/core/infrastructure/adapters/services/auth/jwt-auth.strategy.ts`
   - Adicionar extractor de cookies

### Rotação de Chaves:
7. `src/core/infrastructure/adapters/services/auth/jwt-key-manager.service.ts` (NOVO)
   - Serviço para gerenciar chaves e rotação

8. `src/core/infrastructure/adapters/services/auth/auth.service.ts`
   - Usar key manager para assinar tokens com `kid`

9. `src/modules/auth.module.ts`
   - Registrar JwtKeyManagerService

---

## 📚 Referências

- [RFC 8725 - JSON Web Token Best Current Practices](https://datatracker.ietf.org/doc/html/rfc8725)
- [OWASP JWT Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html)
- [NestJS Passport JWT](https://docs.nestjs.com/security/authentication#jwt-functionality)
- [Cookie Security](https://owasp.org/www-community/HttpOnly)

---

## ❓ Questões para Decisão

1. **Algoritmo:** Continuar com HS256 ou migrar para RS256?
   - HS256: Mais simples, mas secret compartilhado
   - RS256: Mais seguro, chave privada/pública separadas

2. **Cookies vs Headers:** 
   - Usar cookies para web app?
   - Manter headers como fallback para mobile/API clients?

3. **Rotação de Chaves:**
   - Frequência de rotação? (ex: 90 dias)
   - Onde armazenar chaves? (memória, Redis, banco)

4. **CSRF:**
   - `SameSite: 'lax'` é suficiente?
   - Precisa de CSRF tokens adicionais?

5. **Backward Compatibility:**
   - Tokens antigos sem `kid` devem continuar funcionando?
   - Período de transição para novas validações?

