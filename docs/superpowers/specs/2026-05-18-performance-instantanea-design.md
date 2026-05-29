# Design: Performance Instantânea — Arquitetura Híbrida 2 Camadas

**Data:** 2026-05-18  
**Status:** Aprovado  
**Problema:** Sistema demora 5–17s para carregar Ranking e Perfil do Candidato  
**Meta:** Ranking e Perfil abrem em <150ms; drill-downs pesados em <10ms (após primeiro acesso)

---

## Diagnóstico dos Gargalos

| Gargalo | Impacto | Causa |
|---------|---------|-------|
| Cold start FastAPI (Vercel serverless Python) | +2–5s | Processo Python inicia do zero por requisição inativa |
| Conexão + query MotherDuck | +2–10s | DuckDB cloud no caminho crítico de cada clique |
| Sem pré-carregamento | +latência extra | Dados só buscados após render da página |

**Páginas mais afetadas (prioridade):** Ranking (lista de candidatos) e Perfil do Candidato.

---

## Solução: Arquitetura Híbrida em 2 Camadas

### Camada 1 — Supabase (instantâneo, ~50ms–150ms)

Materializar os dados leves e frequentes no Supabase PostgreSQL. Frontend consulta Supabase diretamente via PostgREST — sem FastAPI, sem MotherDuck no caminho crítico.

**Tabelas a criar no Supabase:**

| Tabela | Conteúdo | Tamanho estimado | Índices |
|--------|----------|-----------------|---------|
| `mv_candidatos` | Lista completa: ano, uf, municipio, cargo, turno, partido, nome_urna, nome_completo, cpf_hash, situacao, total_votos, numero_urna, genero, escolaridade, ocupacao, sequencial | ~10MB | `(ano, municipio_nome, cargo)`, `(cpf_hash)`, FTS em `nome_urna` |
| `mv_candidato_bens` | Patrimônio: cpf_hash, ano, tipo_bem, descricao, valor | ~15MB | `(cpf_hash, ano)` |
| `mv_votos_zona` | Votos agregados por zona: cpf_hash, ano, zona, municipio, total_votos | ~5MB | `(cpf_hash, ano)` |
| `mv_financeiro` | Totais financeiros: cpf_hash, ano, total_receitas, total_despesas | ~10MB | `(cpf_hash, ano)` |
| `mv_zonas` | KPIs de zonas: ano, municipio, zona, total_eleitores, total_secoes, comparecimento_pct | ~2MB | `(ano, municipio)` |
| `mv_escolas` | KPIs de escolas: ano, zona, nome_local, endereco, bairro, total_secoes, total_eleitores | ~8MB | `(ano, municipio)` |

**Total Supabase: ~50MB** — cabe no free tier (500MB).

### Camada 2 — Redis + MotherDuck (drill-downs, TTL infinito)

Para dados pesados (votos por seção, financeiro detalhado, histórico 2014–2022): manter no MotherDuck mas com cache Redis de TTL infinito.

- **Cache hit** (Upstash Redis): <10ms
- **Cache miss** (primeira vez): 3–8s + skeleton loading animado
- **TTL:** sem expiração — dados eleitorais não mudam entre eleições
- Após o primeiro acesso por qualquer usuário, todos os seguintes são instantâneos

### O que NÃO muda

- Chat IA (`/chat`) continua usando FastAPI → MotherDuck (precisa do dataset completo para Text-to-SQL)
- `api/chat_service.py` e `api/main.py` permanecem intactos para o módulo de chat

---

## Mudanças no Frontend

### Hooks a refatorar

| Hook atual | Mudança |
|-----------|---------|
| `useRanking` | Trocar `mdQuery()` por `supabase.from('mv_candidatos').select()` com filtros |
| `useCandidatoFinanceiro` | Trocar por query em `mv_financeiro` + fallback Redis/MotherDuck para detalhes |
| Hooks de zonas/escolas | Trocar por `mv_zonas` / `mv_escolas` |
| Votos por zona no perfil | Trocar por `mv_votos_zona` |
| Votos por seção/escola | Manter MotherDuck + Redis cache + skeleton loading |

### React Query — ajustes

```typescript
// staleTime: Infinity — dados eleitorais não mudam durante a sessão
// gcTime: 24h — manter em cache local persistido

queryClient.setQueryDefaults(['candidatos'], {
  staleTime: Infinity,
  gcTime: 1000 * 60 * 60 * 24,
})
```

### Skeleton Loading (drill-downs)

Quando uma query cair no MotherDuck (cache miss), exibir skeleton animado com mensagem "Carregando dados detalhados..." em vez de spinner ou tela branca.

### Prefetch on hover

No Ranking, quando o usuário passa o mouse sobre um candidato: disparar prefetch do perfil básico via `queryClient.prefetchQuery`. Quando clicar, dados já estão em cache.

---

## Script de Materialização

**Arquivo:** `scripts/materializar_supabase.py`

- Lê dados do MotherDuck via DuckDB  
- Escreve nas tabelas `mv_*` do Supabase via `supabase-py`  
- Execução: manual, após cada eleição (estimativa ~45min para GO completo)  
- Idempotente: trunca e reinsere (não faz upsert incremental)

**Quando rodar:**
- Pós-eleição quando TSE liberar dados definitivos
- Ao adicionar novo estado/município ao produto

---

## Fora de Escopo (não implementar agora)

- Multi-tenant (separação por cliente) — Fase 2 do produto
- Outros estados além de GO — Fase 2
- Atualização incremental do cache (polling pós-eleição) — não necessário no MVP

---

## Critérios de Sucesso

- [ ] Ranking abre em <200ms (medido com Network tab do Chrome)
- [ ] Mudar filtro (município/cargo/ano) responde em <200ms
- [ ] Perfil básico do candidato carrega em <200ms
- [ ] Patrimônio e votos por zona carregam em <200ms
- [ ] Votos por escola/seção: skeleton imediato, dados em <10ms (após primeiro acesso)
- [ ] Nenhum hook existente de chat quebrado
- [ ] Script de materialização roda sem erros para ano 2024, município APARECIDA DE GOIÂNIA
