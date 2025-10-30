# Fichamento – “Eliciting Reasoning in Language Models with Cognitive Tools” (IBM Research, 2025)

**Referência:** https://arxiv.org/abs/2506.12115  
**Autores:** Brown Ebouky, Andrea Bartezzaghi, Mattia Rigotti (IBM Research Zurich)  
**Data:** Junho/2025  
**Objetivo:** Investigar como dotar LLMs de “ferramentas cognitivas” explícitas pode melhorar desempenho em benchmarks de raciocínio, sem depender exclusivamente de RL ou modelos proprietários.

---

## 1. Motivação
- Modelos comerciais (ex.: OpenAI o1-preview) atingem altos scores via treinamentos complexos (RL, CoT supervisionado).  
- Autores exploram alternativa: fornecer módulos de raciocínio pré-definidos que o próprio LLM invoca via tool-calling, aproximando de abordagens de psicologia cognitiva.

## 2. Abordagem
- Criam um **toolkit de operações cognitivas** (ex.: verificação de equações, decomposição, backtracking, comparação).  
- Cada ferramenta é implementada como um prompt estruturado que o modelo pode chamar via API (sem depender de código externo pesado).  
- Pipeline: LLM recebe problema → decide aplicar ferramenta → executa e incorpora resultado ao raciocínio → gera resposta/verificação.  
- Avaliam em benchmarks matemáticos (AIME 2024, AMC, MATH500) com GPT-4.1 e modelos open source (ex.: Qwen).

## 3. Resultados
- Incrementos significativos sem fine-tuning: GPT-4.1 passa de 26.7% para 43.3% em AIME 2024 (pass@1).  
- Ganhos consistentes em modelos abertos, mostrando generalidade.  
- Ferramentas de **verificação** (check result, backtrack) e **planejamento** (decompose) foram as mais impactantes.  
- O uso de prompts estruturados fornece interpretabilidade (logs de qual ferramenta foi acionada e por quê).

## 4. Implicações para Context Engineering
- Context packs podem incluir **tool schemas cognitivas** além de dados brutos, orientando o modelo sobre estratégias de raciocínio.  
- Reforça a visão “context = instruções + ferramentas + dados”, não apenas retrieval.  
- Sugere que contextos podem incorporar _recipes_ de raciocínio reutilizáveis across domínios.

## 5. Lacunas
- Trabalho foca em matemática; não explora domínios textuais/código.  
- Kit de ferramentas ainda manual; não há automatização de seleção.  
- Não aborda ingestão/governança do contexto, apenas o layer de reasoning.

## 6. Ideias para experimentos internos
- Incluir tool schemas (ex.: “check_diff”, “plan_implementation”) nos context packs para code review e medir impacto.  
- Desenvolver biblioteca de “cognitive tools” adaptada a cada domínio (financeiro, suporte) que possam ser carregadas via `ContextResourceRef`.  
- Logar invocações de ferramentas cognitivas através de `ContextTelemetry` para diagnosticar acertos/erros.
