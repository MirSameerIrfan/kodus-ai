# Fichamento – “Context Engineering for Reliable AI Agents” (Kubiya, 2025)

**Referência:** https://www.kubiya.ai/blog/context-engineering-ai-agents  
**Data:** 17/07/2025  
**Objetivo:** Posicionar contexto como peça central do “Context OS” da Kubiya para agentes DevOps; apresenta princípios e melhores práticas.

---

## 1. Visão principal
- Prompt engineering está obsoleto; confiabilidade exige engenharia de contexto completa.  
- Kubiya usa o framework **12-Factor Agents** adaptado: controlar fluxo, ser stateless onde possível, modularidade.

## 2. Princípios destacados
- **“AI that Works”**: raciocínio separado de execução (LLM planeja, código executa).  
- **Tool calls = JSON**: LLM age como compilador gerando instruções estruturadas.  
- **Own your context window**: mantenha o stack de contexto sob controle (instr., histórico, dados, ferramentas).  
- **Compaction contínua**: reduzir tokens desnecessários, manter context perfeito.  
- **Human collaboration**: incorporar humanos para recuperação de falhas, co-pilot supervisionado.

## 3. Boas práticas listadas
- Catalogar ferramentas com schemas claros (inputs/outputs).  
- Dividir agentes em papéis menores (multi-agente especializado).  
- Responsabilizar times (“context contracts”), definir owners para packs.  
- Métricas: groundedness, custo/token, latência, failover rate.

## 4. Tom técnico
- Mais descritivo/estratégico do que hands-on; complementa com 12-Factor Agents e LangGraph.  
- Foco em DevOps/Infra (observabilidade, pipelines).  
- Sem benchmarks, mas reforça heurísticas úteis para governança.

## 5. Aplicabilidade
- Inspira controle rigoroso das camadas de contexto + telemetry no nosso Context OS.  
- Motiva a criação de tool schemas ricos e compaction intencional.  
- Destaque para “Context OS” e ownership → reforça visão de produto.
