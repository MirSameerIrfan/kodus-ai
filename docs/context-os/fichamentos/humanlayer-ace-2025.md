# Fichamento – “Advanced Context Engineering for Coding Agents” (HumanLayer, 2025)

**Referência:** https://github.com/humanlayer/advanced-context-engineering-for-coding-agents/blob/main/ace-fca.md  
**Autor:** HumanLayer (Dex Horthy / equipe) – Talk YC 2025  
**Objetivo:** Mostrar como aplicar context engineering avançado para agentes de código em codebases grandes (“brownfield”) utilizando a metodologia **Frequent Intentional Compaction (FIC)**.

---

## 1. Problema
- Agentes de código tradicionais funcionam bem em projetos novos, mas falham em repos grandes (slop, rework, inconsistência).
- Engenheiros passam muito tempo “vibing” com chatbots; prompts são descartados → falta rastreabilidade.

## 2. Proposta: Frequent Intentional Compaction
- Manter utilização de contexto em **40–60%**; antes de saturar, compactar o estado em artefatos persistentes (especificações, resumos, progress logs).  
- Fluxo **Research → Plan → Implement** com checkpoints de compactação.  
  - **Research:** mapear contexto (arquivos críticos, dependências).  
  - **Plan:** gerar especificação detalhada (markdown) que vira “código-fonte” do trabalho.  
  - **Implement:** rodar agente com spec como contexto mestre; atualizações frequentes documentadas.
- Specs se tornam fonte da verdade (similar à visão “specs são o novo código”).

## 3. Técnicas específicas
- **Context budgets** monitorados manualmente; uso de prompts para escrever progresso em `progress.md`.  
- **Token cap awareness:** se exceder, reiniciar sessão com spec atualizada (reduzir drift).  
- **Diff-driven**: feed controlado (arquivos relevantes + diff) evita “dump” total da base.  
- **Human review alavancada:** revisores humanos leem specs e testes ao invés de 100% do código gerado.  
- **Automations auxiliares:** scripts para coletar arquivos relevantes, mapeamentos AST, etc.

## 4. Resultados relatados
- Manutenção/feature em codebases 300k LOC (Rust) realizada em horas em vez de dias.  
- PRs volumosos (35k LOC) com code quality aprovado por mantenedores externos.

## 5. Pontos fortes
- Processo completo e replicável; mostra que modelos atuais (Claude Code) já são úteis quando contexto é bem gerido.  
- Ênfase em artefatos persistentes (especificações) → audit trail e colaboração humana melhor.

## 6. Limitações
- Depende de disciplina humana (compaction deliberado, spec review).  
- Pouca automação/medição formal; heurísticas qualitativas.  
- Foco em código; extrapolação para outros domínios requer adaptações.

## 7. Oportunidades para o Context OS
- Implementar FIC como estratégia padrão (packs tri-layer: core/spec/catalog + on-demand).  
- Instrumentar métricas de utilização (tokens usados vs. budget).  
- Automatizar geração/atualização de specs (ex.: `ContextService` salvando progress.md).  
- Integrar contexto do spec como camada `catalog` e code diffs como `active`.
