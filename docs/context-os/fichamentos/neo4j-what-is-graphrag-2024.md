# Fichamento – “What Is GraphRAG?” (Neo4j, 2024)

**Referência:** https://neo4j.com/blog/what-is-graphrag/  
**Autor:** Equipe Neo4j (publicado em 05/12/2024)  
**Objetivo:** Explicar o conceito de GraphRAG, justificar o uso de grafos em pipelines de RAG e ilustrar uma implementação prática com Neo4j.

---

## 1. Problema abordado
- RAG baseado apenas em vetores falha em perguntas multi-hop e em manter coesão entre chunks isolados.
- Empresas precisam de respostas confiáveis e explicáveis → vetores sozinhos não fornecem relações explícitas.

## 2. Conceitos chave
- **GraphRAG:** combina indexação vetorial (para localizar chunks) com knowledge graphs (para expandir relações entre entidades).
- Diagramas mostram fases de RAG (retrieval, augmentation, generation) e onde o grafo agrega contexto.
- Grafos permitem multi-hop, path finding, e explicabilidade (fornecem trilhas entre entidades).

## 3. Pipeline demonstrado
- Usa **SimpleKGPipeline** (Neo4j + LLM) para extrair entidades/relacionamentos de PDFs e salvar no grafo.
- Configuração: LLM (gpt-4o-mini), embedding model, splitter de texto, schema (labels e tipos de relacionamento).
- Após indexação, executa **VectorCypherRetriever**:  
  - Faz busca vetorial por chunks relevantes.  
  - Em seguida expande no grafo (`MATCH ...` up to 2 hops) para coletar entidades/relacionamentos relacionados.  
  - Retorna texto + pares entidade-relação-entidade para formar o contexto enviado ao LLM.

## 4. Benefícios citados
- **Melhor qualidade**: mais informação relevante, evita respostas fragmentadas.  
- **Explainability**: pode citar caminhos no grafo, fácil visualizar com Neo4j Bloom.  
- **Atualização contínua**: grafos podem ser atualizados incrementais sem re-embed de todo corpus.

## 5. Desafios / avisos
- Indexação em grafo é custosa (uso intensivo de LLM para extrair entidades).  
- Requer definição de schema (labels, tipos de relação) e tuning do prompt da pipeline.  
- Não cobre governança, TTL ou políticas – foca no retriever.

## 6. Insights para o nosso Context OS
- Explica vantagens de grafos, mas também evidencia custo alto de ingestão.  
- Serve como referência caso seja necessário explicar o “porquê” dos grafos em auditoria.

## 7. Limitações para nosso contexto
- Indexação pesada e cara → não se encaixa no objetivo de manter custos baixos.  
- Alternativa: extrair conceitos/topologia com heurísticas locais (AST, dependências) para enriquecer seleção sem construir grafo completo.
