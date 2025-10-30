# Fichamento – “A Survey of Context Engineering for Large Language Models” (Mei et al., 2025)

**Referência:** https://arxiv.org/abs/2507.13334  
**Autores:** Lingrui Mei, Jiayu Yao, Yuyao Ge, Yiwei Wang, Baolong Bi, Yujun Cai, Jiazhi Liu, Mingyu Li, Zhong-Zhi Li, Duzhen Zhang, Chenlin Zhou, Jiayi Mao, Tianze Xia, Jiafeng Guo, Shenghua Liu  
**Data:** 21/07/2025  
**Objetivo do paper:** Consolidar a disciplina de *context engineering* como campo formal, organizar literatura (1400+ artigos) em uma taxonomia unificada e evidenciar lacunas de pesquisa.

---

## 1. Problema e motivação
- Contexto determina a performance dos LLMs; prompt engineering isolado não cobre a complexidade atual (agentes, RAG, memórias).
- Pesquisas sobre RAG, memórias, ferramentas, multi-agent surgiram de forma fragmentada → faltava uma visão integrada.
- Modelos conseguem interpretar contextos complexos, mas ainda têm limitações ao gerar saídas longas e sofisticadas → assimetria entre input/output.

## 2. Estrutura / Metodologia
- Revisão sistemática de mais de 1400 trabalhos (2020–2025).
- Taxonomia dividida em:
  1. **Componentes Fundamentais:**  
     - *Context Retrieval & Generation* (prompting, RAG, context synthesis).  
     - *Context Processing* (long context, self-refinement, multimodal).  
     - *Context Management* (memória hierárquica, compressão, otimização).
  2. **Implementações Sistêmicas:**  
     - RAG modular/agentic/graph-enhanced.  
     - Sistemas de memória persistente.  
     - Raciocínio com ferramentas (tool-integrated).  
     - Multi-agent orchestration.
  3. **Avaliação:** benchmarks e métricas para componentes e sistemas.
  4. **Direções futuras:** lacunas e desafios (segurança, escalabilidade, ética).

## 3. Principais achados / técnicas
- **Context Retrieval:** evolução de prompting ➜ RAG ➜ Dynamic Context Assembly (on-demand, multi-fonte).  
- **Processamento:** atenção eficiente (flash attention, sparse), técnicas de *self contextualization* (model refina o próprio contexto), integração multimodal.  
- **Gestão:** memórias hierárquicas (curto, médio, longo prazo), compressão (map-reduce summarization, token pruning), políticas de TTL.  
- **RAG avançado:** grafos semânticos (GraphRAG), agentic RAG (encadeamento de retrieval + reasoning).  
- **Memória:** arquiteturas que combinam cache neural, vector stores, knowledge graphs, scratchpads.  
- **Ferramentas:** frameworks de tool calling, padrões MCP/A2A/ACP, protocolos para interop entre agentes.  
- **Multi-agent:** coordenação, comunicação, isolamento de contexto e mitigação de conflitos.

## 4. Lacunas e desafios apontados
- **Assimetria Input vs Output:** modelos entendem bem contextos enriquecidos mas não conseguem produzir relatórios longos/estruturados com igual qualidade.  
- **Governança:** escassez de frameworks para segurança, compliance, políticas de acesso dentro do fluxo de contexto.  
- **Avaliação padronizada:** benchmarks existentes não capturam bem dinâmicas multi-hop, temporalidade, RAG + agentes.  
- **Eficiência:** necessidade de técnicas de compressão mais adaptativas (orçamento dinâmico, degradação controlada).  
- **Aplicações específicas:** falta maturidade em domínios críticos (saúde, financeiro) com requisitos rígidos.

## 5. Recomendações / direções futuras
- Desenvolver **protocolos de contexto** interoperáveis (MCP, etc.).  
- Investir em **memórias híbridas** (vetor + grafo + caches neurais).  
- Criar **testbeds realistas** que incluam multi-agent, raciocínio e confiança.  
- Pesquisar formas de **seleção adaptativa** (qual informação realmente precisa entrar no pack).  
- Promover **governança e observabilidade** incorporadas (auditoria, lineage, métricas).

## 6. Ideias para experimentos internos
- Construir dataset multi-hop/temporal para avaliar selectors → medir groundedness vs custo.  
- Implementar budgets dinâmicos em context packs e comparar com baseline fixo.  
- Prototipar memórias hierárquicas (curto/médio/longo prazo) usando `ContextResourceRef`.  
- Integrar grafos + tool calling e monitorar impacto em tarefas com reasoning mais profundo.

## 7. Aplicabilidade para o nosso Context OS
- O paper valida a arquitetura modular que estamos propondo (ingestão → gestão → entrega).  
- Servirá como mapa de referências para cada componente (permite importar técnicas específicas).  
- Evidencia a necessidade de métricas padronizadas e de resolver assimetria input/output → direcionar futuras pesquisas.  
- Apoia iniciativa de Context OS com diferencial em governança, budgets dinâmicos e integração grafo + memória.
