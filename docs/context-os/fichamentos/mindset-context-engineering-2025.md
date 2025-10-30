# Fichamento – “What Is Context Engineering And Why Should You Care?” (Mindset AI, 2025)

**Referência:** https://www.mindset.ai/blogs/in-the-loop-ep23-what-is-context-engineering  
**Data:** 10/07/2025  
**Objetivo:** Explicar o conceito de context engineering para usuários empresariais e como isso se traduz em práticas para construção de agentes/macros corporativos.

---

## 1. Visão geral
- Context engineering = orquestrar o que o modelo já sabe quando recebe o pedido (não só o que você pergunta).  
- Prompt engineering se tornou insuficiente para fluxos multi-turn; é preciso tratar contexto como pipeline contínua.

## 2. Camadas de contexto identificadas
1. **Prompt imediato** – pedido atual do usuário.  
2. **System instructions** – defina comportamento, tom, guardrails, estrutura de resposta.  
3. **Conversation history** – memória de curto prazo com condensações.  
4. **Long-term memory** – preferências do usuário, interações passadas, sumários.  
5. **External retrieval** – docs, PDFs, bancos, integrações.  
6. **Tool definitions** – esquemas de APIs, funções disponíveis.  
- Eles dividem a pipeline Mindset em **Create, Deploy, Manage** com foco em orquestração seqüencial simples (agentes compostos ainda problemáticos).

## 3. Lições do texto
- Multi-agent muitas vezes falha por falta de contexto compartilhado ou excesso de informação.  
- Simplicidade e denominação clara dos passos (planejar → executar) tem funcionado melhor que configurações multi-agentes genéricas.  
- Necessidade de monitorar contexto ao longo do tempo (observabilidade e feedback).

## 4. Aplicabilidade
- Confirma a importância de tratarmos context packs como combinação de instruções, histórico, memória, RAG e tool schemas.  
- Reforça a necessidade de UI/co-pilot para curadoria (Mindset investe em “step orchestration” e monitoramento).  
- Conteúdo mais orientado a produto; carece de métricas ou heurísticas técnicas profundas.
