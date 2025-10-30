# Knowledge Fabric (Protótipo)

Objetivo: ter um “catálogo” persistente para o Context‑OS que armazena
`KnowledgeItem` com lineage, TTL e confidencialidade. Enquanto o core ainda não
tem store oficial, simulamos aqui usando um arquivo JSON versionável.

## Componentes

| Componente | Arquivo | Função |
| --- | --- | --- |
| `KnowledgeStore` | `store/` (`index.ts`, `filesystemStore.ts`, `weaviateStore.ts`) | CRUD básico com backend modular (filesystem por padrão, opção Weaviate) |
| `ingestRule` | `ingest-rule.ts` | Normaliza regras (ex.: “lembre da regra Xyz”) para `KnowledgeItem` |
| `loadRulesForIntent` | `selector.ts` | Seleciona itens relevantes para intent `review` e devolve `Candidate` |

## Esquema de armazenamento

```json
{
  "items": {
    "rule-xyz": {
      "id": "rule-xyz",
      "domain": "code",
      "source": { "type": "manual", "location": "knowledge/rules/xyz.md" },
      "payload": { "text": "Sempre validar a regra XYZ..." },
      "metadata": {
        "version": "1.0.0",
        "tags": ["rule", "xyz"],
        "confidentiality": "internal",
        "ttlMs": null,
        "createdAt": 1737580800000,
        "updatedAt": 1737580800000,
        "lineage": [{ "timestamp": ..., "actor": "human", "action": "created" }]
      },
      "feedback": { "helpful": 0, "harmful": 0 }
    }
  },
  "updatedAt": 1737580800000
}
```

O arquivo padrão fica em `context-engineering/knowledge-fabric/store.json` e
deve ser versionado no Git para acompanhar evolução das memórias.

## Fluxo de uso

1. Executar `node ingest-rule.ts knowledge/rules/xyz.md` para adicionar/atualizar
   a regra.
2. No bundle de code review, o selector `loadRulesForIntent` consulta o store e
   injeta os trechos relevantes na camada catalog/active.
3. Para produção, escolha o backend:
   - `filesystem` (lab) – JSON versionável.
   - `weaviate` – cluster na AWS (Cloud ou self-host) com esquema criado
     automaticamente (`vectorizer: none`, índice híbrido via BM25).
   - Outros (`postgres`, `chroma`) podem ser adicionados reaproveitando o
     contrato `KnowledgeStore`.

### Deploy rápido do Weaviate (AWS)

1. **Weaviate Cloud (mais simples)**
   - Crie um cluster em https://console.weaviate.cloud escolhendo provider AWS e
     região.
   - Anote `WEAVIATE_URL` e `WEAVIATE_API_KEY` e configure no `KnowledgeStore`
     (`type: 'weaviate'`).
2. **Self-host (EKS/EC2)**
   - Provisionar EKS/EC2, instalar Docker/Helm.
   - `helm repo add weaviate https://weaviate.github.io/weaviate-helm/charts`
     e `helm install weaviate weaviate/weaviate --set vectorizer.module=none`.
   - Expor porta 8080 via Load Balancer, configurar TLS/backup (S3).
3. Após subir, o adapter cria automaticamente a classe `KnowledgeItem` com
   `vectorIndexType: none`. Ative BM25 nas configurações do cluster caso queira
   busca híbrida (lexical + semântica).

### Ambiente local com Docker Compose

1. Rode `docker compose -f context-engineering/docker-compose.weaviate.yml up -d`.
2. Ajuste os envs quando for rodar scripts/localmente:

   ```bash
   export WEAVIATE_URL=http://127.0.0.1:8080
   export WEAVIATE_API_KEY=local-dev-key
   ```

3. O serviço ficará disponível em `http://localhost:8080`. Por padrão usamos a API key
   `local-dev-key` (definida no compose). Se precisar expor uma porta gRPC diferente,
   ajuste `grpcPort` nas opções do store. Configure o store com:

   ```ts
   const store = await createKnowledgeStore({
     config: {
       type: 'weaviate',
       options: {
         url: process.env.WEAVIATE_URL ?? 'http://127.0.0.1:8080',
         apiKey: process.env.WEAVIATE_API_KEY ?? 'local-dev-key',
         grpcPort: 50051,
       },
     },
   });
   ```

4. Para desligar: `docker compose -f context-engineering/docker-compose.weaviate.yml down`.

## Próximos passos (fora do escopo imediato)

- Criar ingestores para outras fontes (Git, PR metadata, bug specs).
- Sincronizar com indexadores (vector/BM25) para seleção híbrida.
- Expor API gRPC/REST para consulta do fabric em vez de acessar arquivo.
