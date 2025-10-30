## Telemetria de Ações (`ACTION_*`)

Ferramentas provisórias para registrar eventos `ACTION_STARTED`,
`ACTION_COMPLETED`, `ACTION_FAILED` e derivar métricas simples.

- `action-logger.ts` – `ActionTelemetryRecorder` persiste eventos em
  `context-engineering/telemetry/action-events.json`.
- `computeActionMetrics` – agrega taxa de sucesso e latência média por `actionId`.

### Exemplo

```ts
import { ActionTelemetryRecorder, computeActionMetrics } from './action-logger.js';

const recorder = new ActionTelemetryRecorder();
await recorder.record({
  type: 'ACTION_COMPLETED',
  sessionId: 'session-1',
  tenantId: 'tenant',
  timestamp: Date.now(),
  metadata: { actionId: 'load-bugspec' },
  latencyMs: 420,
});

const metrics = computeActionMetrics(await recorder.list());
// => { 'load-bugspec': { success: 1, failure: 0, avgLatencyMs: 420 } }
```

Na operação real, basta plugar o `recorder.record(event)` nos pontos do
`MCPOrchestrator` ou executor de workflows. O arquivo resultante alimenta os
relatórios e pode ser versionado/limpo conforme necessário.
