# CLAUDE.md — EleiçõesGO (Inteligência Eleitoral SaaS)

## Visão do Produto
Plataforma B2B de inteligência eleitoral — dados TSE (1200+ tabelas, 2014-2024) + IA generativa.
**MVP atual:** Goiás (Goiânia + Aparecida de Goiânia).
**Visão:** SaaS multi-tenant white-label, revendável para qualquer estado/município do Brasil e mercados internacionais (LATAM, Portugal, EUA).

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 18 + Vite + TypeScript + Tailwind + shadcn/ui |
| State | Zustand (`filterStore.ts`) + React Query v5 |
| Backend | FastAPI + Mangum (Python serverless via Vercel) |
| Analytics DB | MotherDuck (DuckDB cloud) — 1200+ tabelas TSE |
| Relacional | Supabase PostgreSQL + pgvector (RLS habilitado) |
| Cache | Upstash Redis REST |
| IA | Google Gemini 1.5-flash (Text-to-SQL + Embeddings) |
| Deploy | Vercel (static frontend + serverless Python) |
| Testes | Vitest (unit) + Playwright (E2E) |

---

## Comandos

```bash
# Dev
npm run dev          # Vite dev server
uvicorn api.main:app --reload  # FastAPI local

# Build
npm run build        # Produção
npm run build:dev    # Debug mode

# Testes
npm test             # Vitest unit
npx playwright test  # E2E

# Lint
npm run lint         # ESLint
```

---

## Arquivos Críticos

| Arquivo | Responsabilidade |
|---------|-----------------|
| `src/lib/motherduck.ts` | Roteador de tabelas + SQL templates — fonte única de verdade para nomes de tabelas |
| `src/stores/filterStore.ts` | Estado global (ano, município, cargo, zona, bairro, escola) |
| `src/lib/queryCache.ts` | React Query client + persister localStorage |
| `api/main.py` | FastAPI app + endpoints `/api/dados/ranking` e `/api/bd-eleicoes-chat` |
| `api/chat_service.py` | Pipeline IA: embedding → busca vetorial → Text-to-SQL → Gemini → Redis cache |
| `fase1_parte3_seguranca.sql` | RLS Supabase — sempre aplicar antes de expor novas tabelas |
| `DOCUMENTACAO.md` | Referência de módulos e motor de consultas |
| `PRODUCAO.md` | Deploy checklist + env vars necessários |

---

## Convenções Obrigatórias

### Nomes de Tabelas MotherDuck
**NUNCA hardcode nomes de tabela.** Use sempre `getTableName()` em `src/lib/motherduck.ts`:
```typescript
getTableName('candidatos', 2024, 'GO')  // → my_db.consulta_cand_2024_GO
getTableName('eleitorado_local', 2024)   // → my_db.eleitorado_local_votacao_2024
```

### SQL — Zero IA em Produção (Determinístico)
O motor de consultas usa SQL templates pré-definidos, não LLM gerado em runtime (exceto no módulo Chat). Não misture os padrões.

### Nomenclatura de UI (Branding Sarelli)
- "Mesários" → exibir como **"Lideranças de campo"**
- "Bairros" → exibir como **"Setores"**
- Números monetários → formatação BRL premium (sem abreviar em exibição principal)

### Filtros Cascata
Ordem obrigatória: Ano → Município → Cargo → Turno → Partido → Zona → Bairro → Escola.
Mudar ordem quebra dependências no `filterStore`.

### Segurança
- Toda tabela nova no Supabase → adicionar RLS imediatamente (`fase1_parte3_seguranca.sql`)
- CPF nunca exposto completo — sempre mascarado (`***.XXX.XXX-**`)
- Rate limiting ativo em `/api/bd-eleicoes-chat` (useRateLimit)

---

## Variáveis de Ambiente

```env
MOTHERDUCK_TOKEN=         # MotherDuck cloud token
GEMINI_API_KEY=           # Google Gemini API
SUPABASE_URL=             # Supabase project URL
SUPABASE_KEY=             # Supabase anon/service key
UPSTASH_REDIS_REST_URL=   # Upstash Redis URL
UPSTASH_REDIS_REST_TOKEN= # Upstash Redis token
```

---

## Gotchas & Bugs Conhecidos

- **Tabelas nacionais de eleitorado** não têm sufixo `_GO` — filtrar por UF no SQL
- **CandidatoPerfil.tsx** (59KB) tem alto tempo de parse — não adicionar mais lógica inline, extrair hooks
- **bun.lockb** e **package-lock.json** coexistem — usar `npm` para consistência no CI
- **Vercel Python runtime** limita cold start a ~30s — manter `api/main.py` enxuto
- **React Query persister** usa localStorage (5MB limit) — queries grandes podem silhar sem avisar

---

## Roadmap para Escala Global (SaaS Multi-Tenant)

### Fase 2 — Multi-Estado BR
- [ ] Parametrizar UF em todo o `motherduck.ts` (hoje hardcoded `GO` em partes)
- [ ] Multi-tenant: tabela `tenants` no Supabase + RLS por tenant_id
- [ ] Auth própria com planos (Stripe) — remover acesso direto a dados sem auth
- [ ] Dashboard admin para gestão de tenants

### Fase 3 — White-label
- [ ] `DESIGN.md` com tokens configuráveis por tenant
- [ ] Subdomínio por tenant (`cliente.eleicoesdata.com`)
- [ ] API pública documentada (OpenAPI) para integrações

### Fase 4 — Internacional
- [ ] i18n (react-i18next) — PT/ES/EN
- [ ] Adaptar schema para dados eleitorais de outros países (LATAM, Portugal)
- [ ] Compliance: LGPD (BR), GDPR (EU), CCPA (EUA)

### Débito Técnico Prioritário (antes de revender)
1. Testes unitários em `src/lib/motherduck.ts` (zero cobertura atualmente)
2. Extrair lógica de `CandidatoPerfil.tsx` para hooks separados
3. OpenAPI spec completo para `api/main.py`
4. Monitoramento: Sentry + OpenTelemetry
5. README.md real (atual é template Lovable)
