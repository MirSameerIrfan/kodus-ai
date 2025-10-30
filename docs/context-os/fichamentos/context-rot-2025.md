# Fichamento – “Context Rot: How Increasing Input Tokens Impacts LLM Performance” (Chroma, 2025)

**Referência:** https://research.trychroma.com/context-rot  
**Autores:** Kelly Hong, Anton Troynikov, Jeff Huber (Chroma Research)  
**Data:** Julho/2025  
**Objetivo:** Avaliar empiricamente como LLMs degradam com o aumento do comprimento de contexto e propor um benchmark replicável para medir essa degradação.

---

## 1. Motivação
- Modelos recentes anunciam janelas de contexto enormes (1M+ tokens), mas benchmarks populares (ex.: Needle in a Haystack) não capturam comportamentos reais.  
- Equipe percebeu falhas em tarefas semânticas quando contexto cresce → necessidade de medir “context rot”.

## 2. Metodologia
- Benchmark inclui três tipos de tarefas simples e controladas:  
  1. **Needle semântico** (não apenas lexical) com distractors e variação de similaridade.  
  2. **QA conversacional** estilo LongMemEval com múltiplas turns.  
  3. **Repetição de padrões** (string repetition) para medir exatidão sob carga.
- Testam **18 modelos** (open e closed) em **8 comprimentos** e **11 posições** da “agulha”.  
- Usam GPT-4.1 como judge (para casos não binários) com prompt específico.  
- Código open-source disponível em https://github.com/chroma-core/context-rot.

## 3. Principais resultados
- Performance cai consistentemente conforme aumenta a janela, mesmo em tarefas simples.  
- Quanto menor a similaridade semântica entre pergunta e resposta, mais rápida é a degradação.  
- Distratores específicos afetam modelos de forma diferente, revelando comportamentos idiossincráticos.  
- Estrutura do haystack (ordem, variação de tópicos) impacta fortemente; ordenações adversariais amplificam a rot.

## 4. Recomendações práticas
- Não confiar em NIAH isoladamente → combinar com context rot benchmark.  
- Medir modelos em cenários de produção com proximidade ao benchmark para calibrar seleção/compactação.  
- Adotar heurísticas de compaction (resumos, weighting) para desacelerar a degradação.  
- Monitorar “context health” em produção (ex.: groundedness score vs. tamanho do pack).

## 5. Lacunas e oportunidades
- Benchmark não sugere mitigação automatizada; fica a cargo do engenheiro.  
- Foca em texto; não cobre multimodal ou tool outputs.  
- Não aborda políticas de governança ou budgets dinâmicos.

## 6. Ações/Experimentos sugeridos para o nosso Context OS
- Replicar benchmark com datasets internos (code review, suportes, jurídico) para ajustar budgets de tokens.  
- Integrar resultados no `ContextTelemetry` (alertas quando packs ultrapassarem tamanhos críticos).  
- Testar diferentes estratégias de compactação (summary hierárquico, top-k adaptativo) e medir rot.  
- Usar insights para treinar modelos/heurísticas de “pre-scorer” que prevê quando contexto está perto de degradar.
