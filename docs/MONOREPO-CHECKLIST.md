# Checklist: Monorepo + Monolito Modular

## ✅ Configuração NestJS Monorepo

- [x] `nest-cli.json` na raiz com `"monorepo": true`
- [x] `nest-cli.json` com `"projects"` configurado
- [x] `nest-cli.json` dos apps removidos
- [x] Scripts de build atualizados (`nest build <project>`)

---

## ✅ Estrutura de Código

- [x] `apps/` separados (organização)
- [x] `src/` compartilhado (código comum)
- [x] `ecosystem.config.js` gerencia processos via PM2

---

## ⚠️ Pendências (Opcional - Simplificar)

### Dockerfiles Separados (Não Necessários para Monolito Modular)

- [ ] `Dockerfile.webhook-handler.dev` (pode remover)
- [ ] `Dockerfile.api-rest.dev` (pode remover)
- [ ] `Dockerfile.worker.dev` (pode remover)
- [ ] Manter apenas `Dockerfile.dev` e `Dockerfile.prod`

**Razão**: Monolito modular = 1 deploy = 1 Dockerfile

---

### Docker Compose Separado (Não Necessário)

- [ ] `docker-compose.dev.monorepo.yml` (pode remover)
- [ ] Manter apenas `docker-compose.dev.yml` (1 serviço via PM2)

**Razão**: Monolito modular = 1 container = 1 serviço

---

### Scripts Individuais (Opcional - Simplificar)

- [ ] Scripts `build:webhook-handler`, `build:api-rest`, `build:worker` (podem manter para desenvolvimento)
- [ ] Scripts `start:webhook-handler`, etc. (podem remover se não usados)

**Razão**: Para produção, sempre usa `build:apps` e PM2

---

## 🎯 Status Atual

### ✅ Completo

- ✅ NestJS monorepo configurado corretamente
- ✅ Estrutura de código organizada
- ✅ PM2 gerencia processos
- ✅ `Dockerfile.prod` único (produção)
- ✅ `docker-compose.prod.yml` único (produção)

---

### ⚠️ Opcional (Simplificar)

- ⚠️ Dockerfiles separados para desenvolvimento (podem remover)
- ⚠️ docker-compose separado (pode remover)
- ⚠️ Scripts individuais (podem manter se úteis para desenvolvimento)

---

## 💡 Recomendação

**Para Monorepo + Monolito Modular**:

✅ **Já está correto!** A estrutura atual funciona perfeitamente.

⚠️ **Opcional**: Remover Dockerfiles e docker-compose separados para simplificar, mas não é obrigatório se forem úteis para desenvolvimento/testes.

---

## 🎯 Resposta Direta

**SIM, estamos de acordo com monorepo!** ✅

**Não precisa mexer em mais nada** para funcionar, mas pode simplificar removendo Dockerfiles separados se quiser.
