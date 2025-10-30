# Context Revision Lab

Protótipo simples de versionamento para requisitos de contexto. A ideia é
experimentar commits, histórico e rollback antes de levar o fluxo para o
back‑end definitivo (Postgres/Mongo).

## Estrutura

- `revision-log.json`: arquivo append-only com todas as revisões
  (`ContextRevisionLogEntry`).
- `commit-revision.ts`: script que gera uma nova revisão a partir de um arquivo
  de requirements (JSON) e adiciona ao log.

## Como usar

1. Prepare um arquivo JSON contendo a lista final de `ContextRequirement`
   (ex.: `context-revisions/samples/review-requirements.json`).
2. Execute:

   ```bash
   npx tsx context-engineering/context-revisions/commit-revision.ts \
     --input context-engineering/context-revisions/samples/review-requirements.json \
     --scope global \
     --entity-type prompt \
     --entity-id code-review-v2 \
     --origin-kind human \
     --origin-id ops@kodus \
     --message "Ajusta contexto padrão de review"
   ```

   Argumentos disponíveis:

   | Flag | Descrição |
   | --- | --- |
   | `--input` | Caminho para o JSON com os requisitos (obrigatório). |
   | `--scope` | `global`, `repository:<id>`, `directory:<repoId>:<dirId>` ou `prompt:<repoId>:<promptId>` |
| `--entity-type` | Categoria da entidade (ex.: `prompt`, `workflow`, `knowledge`). |
| `--entity-id` | Identificador estável da entidade (ex.: `code-review-v2`). |
| `--origin-kind` | Tipo de origem (ex.: `human`, `automation`, `system`). |
| `--origin-id` | Identificador da origem (e-mail, serviço, etc.). |
| `--origin-name` | Nome amigável da origem (opcional). |
| `--origin-contact` | Meio de contato (opcional). |
   | `--message` | Mensagem/descrição da revisão (opcional). |
   | `--parent` | `revisionId` da revisão anterior (opcional). |

3. O script gera um `revisionId` baseado no timestamp (`rev_YYYYMMDDTHHMMSSmmmZ`),
   calcula `payloadHash` e adiciona ao `revision-log.json`. O payload registrado
   inclui `{ requirements: [...] }`, mas você pode passar qualquer objeto via
   `--entity-type/--entity-id` e `payload` personalizado no futuro.

## Próximos passos

- Expor comandos para listar histórico (`history`), comparar (`diff`) e fazer
  rollback (criar nova revisão copiando uma anterior).
- Substituir o JSON por uma tabela/coleção real (Postgres/Mongo) preservando o
  mesmo formato.
- Integrar esse fluxo ao loader das configs e ao Context Composer.
