# Análise de Segurança - Camada de Autenticação

**Data:** 2024  
**Escopo:** `src/core/infrastructure/adapters/services/auth`

---

## 📋 Sumário Executivo

Esta análise examina a implementação da camada de autenticação e autorização do sistema, identificando pontos fortes, vulnerabilidades e oportunidades de melhoria.

**Status Geral:** ⚠️ **Requer Atenção** - Encontradas várias vulnerabilidades e práticas que precisam ser corrigidas.

---

## ✅ Pontos Positivos

1. **Uso de bcrypt para hash de senhas** - Implementação adequada com `bcryptjs`
2. **Separação de secrets** - Access token e refresh token usam secrets diferentes
3. **Validação de expiração** - Tokens JWT têm expiração configurada
4. **Helmet e Rate Limiting** - Middlewares de segurança aplicados globalmente
5. **Refresh token rotation** - Tokens antigos são marcados como usados
6. **Validação de usuário no strategy** - Verifica existência do usuário a cada requisição

---

## 🔴 Vulnerabilidades Críticas

### 1. **Uso de Tipo `any` no Payload JWT**

**Localização:** `jwt-auth.strategy.ts:29`

```29:45:src/core/infrastructure/adapters/services/auth/jwt-auth.strategy.ts
async validate(payload: any) {
    const user = await this.authService.validateUser({
        email: payload.email,
    });

    if (!user) {
        throw new UnauthorizedException();
    }

    if (user.role !== payload.role) {
        throw new UnauthorizedException();
    }

    delete user.password;

    return user;
}
```

**Problema:**

- Tipo `any` permite acesso a propriedades não tipadas
- Violação da regra do projeto que proíbe uso de `any`
- Falta validação de estrutura do payload

**Impacto:** Alto - Pode permitir bypass de autenticação se payload malformado

**Recomendação:**

```typescript
interface JwtPayload {
    email: string;
    role: string;
    teamRole?: string;
    status: string;
    sub: string;
    organizationId: string;
    iss: string;
    aud: string;
    iat?: number;
    exp?: number;
}

async validate(payload: JwtPayload): Promise<Partial<IUser>> {
    // Validação de campos obrigatórios
    if (!payload.email || !payload.role || !payload.sub) {
        throw new UnauthorizedException('Invalid token payload');
    }
    // ... resto do código
}
```

---

### 2. **CORS Excessivamente Permissivo**

**Localização:** `apps/api/src/main.ts:48-52`

```48:52:apps/api/src/main.ts
app.enableCors({
    origin: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
});
```

**Problema:**

- `origin: true` aceita requisições de qualquer origem
- Permite ataques CSRF mesmo com JWT
- Credenciais habilitadas sem restrição de origem

**Impacto:** Alto - Vulnerável a ataques CSRF

**Recomendação:**

```typescript
app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['https://app.kodus.ai'],
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
});
```

---

### 3. **Logging Inadequado com `console.log`**

**Localização:** `auth.service.ts:99, 308, 318`

```82:101:src/core/infrastructure/adapters/services/auth/auth.service.ts
async logout(refreshToken: string): Promise<any> {
    try {
        const refreshTokenAuth = await this.authRepository.findRefreshToken(
            {
                refreshToken: refreshToken,
            },
        );

        if (refreshTokenAuth) {
            await this.authRepository.updateRefreshToken({
                ...refreshTokenAuth,
                used: true,
            });
        }

        return refreshTokenAuth;
    } catch (error) {
        console.log(error);
    }
}
```

**Problema:**

- `console.log` pode vazar informações sensíveis em produção
- Erros são silenciados sem logging adequado
- Logger já está disponível (`this.logger`) mas não é usado

**Impacto:** Médio - Pode vazar informações e dificulta debugging

**Recomendação:**

```typescript
catch (error) {
    this.logger.error({
        message: 'Failed to logout',
        context: AuthService.name,
        error,
        metadata: { hasRefreshToken: !!refreshToken },
    });
    throw new InternalServerErrorException('Failed to logout');
}
```

---

### 4. **Falta Validação de Audience (aud) no JWT**

**Localização:** `jwt-auth.strategy.ts:20-24`

```20:24:src/core/infrastructure/adapters/services/auth/jwt-auth.strategy.ts
super({
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    ignoreExpiration: false,
    secretOrKey: configService.get<JWT>('jwtConfig').secret,
});
```

**Problema:**

- Não valida o campo `aud` (audience) do token
- Tokens podem ser reutilizados em contextos diferentes
- Payload inclui `aud: 'web'` mas não é validado

**Impacto:** Médio - Tokens podem ser usados em contextos não intencionados

**Recomendação:**

```typescript
super({
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    ignoreExpiration: false,
    secretOrKey: configService.get<JWT>('jwtConfig').secret,
    audience: 'web', // Adicionar validação de audience
    issuer: 'kodus-orchestrator', // Adicionar validação de issuer
});
```

---

### 5. **Lista Hardcoded de Rotas Públicas**

**Localização:** `jwt-auth.guard.ts:31-82`

```31:82:src/core/infrastructure/adapters/services/auth/jwt-auth.guard.ts
const excludePaths = [
    '/health',
    '/health/simple',
    '/auth/refresh',
    '/auth/login',
    '/auth/signup',
    '/auth/forgot-password',
    '/auth/reset-password',
    '/auth/oauth',
    '/user/email',
    '/diagnostic/updateDiagnostic',
    '/github/webhook/installation',
    '/github/integration',
    '/agent/has-active-sessions',
    '/agent/create-session',
    '/agent/router',
    '/agent/memory',
    '/agent/auth-details',
    '/agent/execute-router-prompt',
    '/agent/waiting-columns',
    '/agent/guild-by-member',
    '/agent/auth-details-organization',
    '/agent/metrics',
    '/communication/create-auth-integration',
    '/communication/update-auth-integration',
    '/communication/create-or-update-integration-config',
    '/project-management/create-auth-integration',
    '/code-management/create-auth-integration',
    '/automation/run',
    '/organization/name-by-tenant',
    '/insights',
    '/interaction/users',
    '/daily-checkin-automation/generate-changelog',
    '/daily-checkin-automation/view-delivery-status-items-wip',
    '/daily-checkin-automation/get-insights',
    '/weekly-checkin-automation/get-insights',
    '/agent/has-team-config',
    '/communication/button-disabled',
    '/team/team-infos',
    '/user/invite',
    '/user/invite/complete-invitation',
    '/github/webhook',
    '/snoozed-items/slack',
    '/gitlab/webhook',
    '/bitbucket/webhook',
    '/azure-repos/webhook',
    '/mcp',
    '/user-log/status-change',
    '/kody-rules/find-library-kody-rules',
    '/kody-rules/find-library-kody-rules-buckets',
    '/auth/resend-email',
];
```

**Problema:**

- Lista extensa e difícil de manter
- Muitas rotas sensíveis sem autenticação (`/agent/*`, `/automation/run`, `/insights`)
- Falta documentação sobre por que cada rota é pública
- Risco de adicionar rotas sensíveis por engano

**Impacto:** Alto - Muitas rotas sensíveis expostas sem autenticação

**Recomendação:**

- Usar decorator `@Public()` do NestJS
- Mover rotas realmente públicas para um módulo separado
- Revisar cada rota e adicionar autenticação onde necessário
- Documentar justificativa para cada rota pública

---

### 6. **Falta Validação de Status do Usuário**

**Localização:** `jwt-auth.strategy.ts:29-45`

**Problema:**

- Não valida se o usuário está ativo (`status`)
- Usuários desativados podem continuar usando tokens válidos
- Payload inclui `status` mas não é verificado

**Impacto:** Médio - Usuários desativados podem continuar autenticados

**Recomendação:**

```typescript
async validate(payload: JwtPayload): Promise<Partial<IUser>> {
    const user = await this.authService.validateUser({
        email: payload.email,
    });

    if (!user) {
        throw new UnauthorizedException();
    }

    if (user.role !== payload.role) {
        throw new UnauthorizedException();
    }

    // Adicionar validação de status
    if (user.status !== 'active' || payload.status !== 'active') {
        throw new UnauthorizedException('User account is not active');
    }

    delete user.password;
    return user;
}
```

---

### 7. **Race Condition em Refresh Token**

**Localização:** `auth.service.ts:103-139`

```103:139:src/core/infrastructure/adapters/services/auth/auth.service.ts
async refreshToken(oldRefreshToken: string) {
    try {
        const payload = this.verifyToken(oldRefreshToken);

        const refreshTokenAuth =
            await this.getStoredRefreshToken(oldRefreshToken);

        this.validateRefreshToken(refreshTokenAuth);

        const userEntity = await this.userRepository.findOne({
            uuid: payload.sub,
        });

        const authDetails = refreshTokenAuth.authDetails;

        const teamMember = await this.teamMemberService.findOne({
            user: { uuid: userEntity?.uuid },
            organization: { uuid: userEntity?.organization?.uuid },
        });

        const tokens = await this.createToken(userEntity, teamMember);

        await this.markTokenAsUsed(refreshTokenAuth);
        await this.createAuth(
            userEntity,
            tokens,
            refreshTokenAuth.authProvider,
            authDetails,
        );

        return tokens;
    } catch (e) {
        throw new UnauthorizedException(
            'Refresh token is invalid or has expired',
        );
    }
}
```

**Problema:**

- Entre `getStoredRefreshToken` e `markTokenAsUsed`, o token pode ser usado múltiplas vezes
- Falta lock/transação para prevenir uso simultâneo
- Token pode ser reutilizado em requisições paralelas

**Impacto:** Médio - Permite reutilização de refresh tokens

**Recomendação:**

- Usar transação de banco de dados
- Implementar lock distribuído (Redis) para refresh tokens
- Verificar `used` novamente antes de marcar como usado

---

### 8. **Falta Rate Limiting Específico para Auth**

**Problema:**

- Rate limiting global pode não ser suficiente para endpoints de autenticação
- Endpoints `/auth/login` e `/auth/forgot-password` são alvos comuns de ataques
- Falta proteção contra brute force

**Impacto:** Médio - Vulnerável a ataques de força bruta

**Recomendação:**

```typescript
// Rate limiting específico para login
const loginLimiter = expressRateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 5, // 5 tentativas
    message: 'Too many login attempts, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
});

// Aplicar no controller
@Post('login')
@UseGuards(ThrottlerGuard)
@Throttle(5, 900) // 5 tentativas por 15 minutos
async login(@Body() body: LoginDTO) {
    // ...
}
```

---

### 9. **Tratamento de Erro Genérico**

**Localização:** `login.use-case.ts:15-38`

```15:38:src/core/application/use-cases/auth/login.use-case.ts
async execute(email: string, password: string) {
    try {
        const user = await this.authService.validateUser({
            email,
        });

        if (!user) {
            throw new UnauthorizedException('api.users.unauthorized');
        }

        if (!(await this.authService.match(password, user.password))) {
            throw new UnauthorizedException('api.users.unauthorized');
        }

        const { accessToken, refreshToken } = await this.authService.login(
            user,
            AuthProvider.CREDENTIALS,
        );

        return { accessToken, refreshToken };
    } catch (error) {
        throw new UnauthorizedException('api.users.unauthorized');
    }
}
```

**Problema:**

- Todos os erros retornam a mesma mensagem genérica
- Pode vazar informações sobre existência de usuários (timing attack)
- Dificulta debugging em produção

**Impacto:** Baixo-Médio - Timing attacks e dificuldade de debugging

**Recomendação:**

- Usar delay constante para evitar timing attacks
- Logar erros detalhados internamente
- Manter mensagens genéricas para usuário final

---

### 10. **Falta Validação de Força de Senha**

**Problema:**

- Não há validação de complexidade de senha no registro
- Senhas fracas podem ser aceitas

**Impacto:** Médio - Senhas fracas comprometem segurança

**Recomendação:**

- Implementar validação de senha forte
- Usar biblioteca como `class-validator` com regras customizadas
- Exigir mínimo de 8 caracteres, maiúsculas, minúsculas, números e símbolos

---

## ⚠️ Problemas de Segurança Adicionais

### 11. **RabbitMQ Authentication Desabilitada**

**Localização:** `jwt-auth.guard.ts:92-100`

```92:100:src/core/infrastructure/adapters/services/auth/jwt-auth.guard.ts
handleRpcRequest(context: ExecutionContext) {
    const message = context.switchToRpc().getData();

    // if (this.verifyRabbitMQMessage(message)) {
    return true;
    // }

    //throw new ForbiddenException('Forbidden resource');
}
```

**Problema:**

- Validação de mensagens RabbitMQ está comentada
- Todas as mensagens são aceitas sem verificação

**Impacto:** Alto - Mensagens não autenticadas podem ser processadas

---

### 12. **Falta Validação de Email Token Reutilização**

**Problema:**

- Tokens de email podem ser reutilizados múltiplas vezes
- Não há tracking de uso de tokens de verificação

**Impacto:** Baixo - Tokens podem ser reutilizados

---

### 13. **Secrets em Variáveis de Ambiente**

**Localização:** `jwt.config.loader.ts:8-11`

```8:11:src/config/loaders/jwt.config.loader.ts
secret: process.env.API_JWT_SECRET,
expiresIn: process.env.API_JWT_EXPIRES_IN as StringValue,
refreshSecret: process.env.API_JWT_REFRESH_SECRET,
refreshExpiresIn: process.env.API_JWT_REFRESH_EXPIRES_IN as StringValue,
```

**Problema:**

- Falta validação de que secrets estão definidos
- Secrets podem estar vazios ou fracos

**Recomendação:**

- Validar que secrets existem e têm tamanho mínimo
- Usar secrets manager (AWS Secrets Manager, HashiCorp Vault)
- Gerar secrets automaticamente se não existirem

---

## 📊 Resumo de Prioridades

| Prioridade | Vulnerabilidade              | Impacto | Esforço |
| ---------- | ---------------------------- | ------- | ------- |
| 🔴 Crítica | CORS permissivo              | Alto    | Baixo   |
| 🔴 Crítica | Rotas públicas hardcoded     | Alto    | Médio   |
| 🔴 Crítica | Tipo `any` no payload        | Alto    | Baixo   |
| 🟡 Alta    | RabbitMQ auth desabilitada   | Alto    | Baixo   |
| 🟡 Alta    | Falta validação de audience  | Médio   | Baixo   |
| 🟡 Alta    | Falta validação de status    | Médio   | Baixo   |
| 🟡 Alta    | Race condition refresh token | Médio   | Médio   |
| 🟠 Média   | Console.log em produção      | Médio   | Baixo   |
| 🟠 Média   | Rate limiting auth           | Médio   | Médio   |
| 🟠 Média   | Tratamento de erro genérico  | Baixo   | Baixo   |

---

## 🛠️ Plano de Ação Recomendado

### Fase 1 - Correções Críticas (1-2 semanas)

1. ✅ Corrigir CORS para usar lista de origens permitidas
2. ✅ Substituir `any` por interface tipada no JWT payload
3. ✅ Implementar decorator `@Public()` e revisar rotas públicas
4. ✅ Habilitar validação de RabbitMQ

### Fase 2 - Melhorias Importantes (2-3 semanas)

5. ✅ Adicionar validação de audience e issuer no JWT
6. ✅ Adicionar validação de status do usuário
7. ✅ Corrigir race condition em refresh token
8. ✅ Substituir `console.log` por logger adequado

### Fase 3 - Melhorias Adicionais (1-2 semanas)

9. ✅ Implementar rate limiting específico para auth
10. ✅ Melhorar tratamento de erros
11. ✅ Adicionar validação de força de senha
12. ✅ Validar secrets na inicialização

---

## 🔐 Recomendações Específicas de Segurança JWT

### Validação de Algoritmo e Assinatura

**Problema Atual:**

- Não há validação explícita do algoritmo usado no token
- Não há rejeição explícita de tokens com `alg: "none"`

**Recomendação:**

```typescript
// Na Strategy, especificar algoritmos permitidos
super({
    algorithms: ['HS256'], // NUNCA aceitar "none"
    // ...
});
```

### Rotação de Chaves com `kid`

**Problema Atual:**

- Chaves são estáticas e não rotacionam
- Não há suporte a `kid` (Key ID) no header do JWT
- Se uma chave for comprometida, todos os tokens permanecem válidos

**Recomendação:**

- Implementar sistema de rotação periódica de chaves
- Incluir `kid` no header do JWT: `{ "alg": "HS256", "kid": "abc123" }`
- Suportar múltiplas chaves durante período de transição
- Ver documento detalhado: `ANALISE-JWT-SECURITY-RECOMMENDATIONS.md`

### Validação de `iss` e `aud`

**Problema Atual:**

- `iss` e `aud` são definidos no payload mas não validados na Strategy

**Recomendação:**

```typescript
super({
    issuer: 'kodus-orchestrator', // Validar issuer
    audience: 'web', // Validar audience
    // ...
});
```

### Cookies HttpOnly + Secure + SameSite

**Problema Atual:**

- Tokens são retornados apenas no body JSON
- Tokens podem ser armazenados em localStorage (vulnerável a XSS)

**Recomendação:**

- Para SPA/Web App, usar cookies HttpOnly + Secure + SameSite
- Protege contra XSS (JS não pode ler o token)
- Protege contra CSRF com SameSite=Lax/Strict
- Ver documento detalhado: `ANALISE-JWT-SECURITY-RECOMMENDATIONS.md`

---

## 📚 Referências

- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [NestJS Security Best Practices](https://docs.nestjs.com/security/authentication)
- [JWT Best Practices (RFC 8725)](https://datatracker.ietf.org/doc/html/rfc8725)
- [OWASP JWT Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html)

---

## ✅ Checklist de Segurança

- [ ] CORS configurado com origens específicas
- [ ] Payload JWT tipado (sem `any`)
- [ ] Audience e Issuer validados
- [ ] Status do usuário verificado
- [ ] Rate limiting em endpoints de auth
- [ ] Refresh token com proteção contra race condition
- [ ] Logging adequado (sem console.log)
- [ ] Rotas públicas documentadas e revisadas
- [ ] RabbitMQ authentication habilitada
- [ ] Validação de força de senha
- [ ] Secrets validados na inicialização
- [ ] Tratamento de erro sem vazamento de informações
