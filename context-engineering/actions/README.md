# Ações assíncronas / Sub-agents

Com os novos gatilhos `async` e `background` em
`ContextActionDescriptor.trigger`, conseguimos modelar execuções que
acontecem fora do loop principal do pack.

| Trigger | Uso | Exemplo |
| --- | --- | --- |
| `async` | Ação roda em paralelo e o resultado volta para a sessão quando pronto. | Disparar um agente de pesquisa que retorna contexto adicional para o pack. |
| `background` | Fire-and-forget, apenas telemetria/estado é atualizado. | Slash command que inicia *crawler* externo enquanto o agente continua a análise. |

## Contrato sugerido

```ts
if (action.trigger === 'async') {
  // registrar ACTION_STARTED
  schedule(async () => {
    const result = await executor.run(action);
    telemetry.record({ type: 'ACTION_COMPLETED', metadata: { actionId: action.id } });
    contextStore.append(result);
  });
}

if (action.trigger === 'background') {
  fireAndForget(action);
}
```

- **Telemetria**: use `ActionTelemetryRecorder` para persistir
  `ACTION_STARTED/COMPLETED/FAILED` e monitorar a fila.
- **Pack metadata**: inclua `pendingActions` em `RuntimeContextSnapshot.state`
  para sinalizar ao usuário quais tarefas ainda estão rodando.
- **Skills/Bundles**: uma skill pode declarar `requiredActions` com
  `trigger: 'async'` para acoplar sub-agents especializados (ex.: crawling).

Em produção, o executor dessas ações pode ser um worker separado; o pack
apenas registra a intenção e mantém o estado coerente via telemetria.
