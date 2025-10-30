## ACE Pipeline (Agentic Context Engineering)

Implementação de laboratório inspirada no paper _Agentic Context Engineering_.

### Fluxo

1. **Generator** (`generator.ts`) transforma `ExecutionTraceEntry[]` em lições
   candidatas (`GeneratedLesson`).
2. **Reflector** (`reflector.ts`) avalia cada lição e decide se deve ser
   mantida, descartada ou revisada.
3. **Curator** (`curator.ts`) deduplica, versiona e grava bullets no
   `KnowledgeStore` usando tags `ace-bullet`.
4. **Pipeline** (`pipeline.ts`) integra tudo e impõe orçamento (`maxBullets`),
   registrando lineage quando há compactação.

### Uso rápido

```ts
import { createKnowledgeStore } from '../store/index.js';
import { ACEPipeline } from './pipeline.js';

const store = await createKnowledgeStore();
const pipeline = new ACEPipeline(store, {
  generator: { domain: 'code', intent: 'review' },
  curator: { domain: 'code', intent: 'review' }
});

await pipeline.run([
  { id: 'trace-1', description: 'Validar regra XYZ antes de aprovar', outcome: 'success' },
  { id: 'trace-2', description: 'Faltou atualizar testes de carga', outcome: 'failure' }
]);
```

O pipeline adicionará bullets ao store (`context-engineering/knowledge-fabric/store.json`)
que podem ser consumidos pelo selector ou outras camadas do bundle.
