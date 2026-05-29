# Performance Instantânea — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir consultas ao MotherDuck no Ranking e Perfil do Candidato por tabelas materializadas no Supabase, reduzindo tempo de carregamento de 5–17s para <200ms.

**Architecture:** Camada 1 (Supabase, ~50MB) cobre 80% dos acessos com tabelas `mv_*` pré-computadas. Camada 2 (Redis + MotherDuck) cobre drill-downs pesados via cache permanente. Chat IA não muda.

**Tech Stack:** Python 3.11 + duckdb + supabase-py (materialização), TypeScript + @supabase/supabase-js + @tanstack/react-query v5 (frontend), Vitest (testes).

**REGRA CRÍTICA:** Nunca alterar tabelas existentes no Supabase. Apenas `CREATE TABLE IF NOT EXISTS mv_*`. O banco é compartilhado com outras aplicações.

---

## Mapa de Arquivos

| Ação | Arquivo | Responsabilidade |
|------|---------|-----------------|
| Criar | `supabase/sql/create_mv_tables.sql` | DDL completo das tabelas mv_ + índices + RLS |
| Criar | `scripts/materializar_supabase.py` | Lê MotherDuck → escreve Supabase mv_ tables |
| Criar | `src/hooks/mv/useMvRanking.ts` | Hook ranking via Supabase (substitui useRankingMD) |
| Criar | `src/hooks/mv/useMvCandidatoData.ts` | Hooks bens + votos_zona + financeiro via Supabase |
| Criar | `src/hooks/mv/__tests__/useMvRanking.test.ts` | Testes unitários do hook de ranking |
| Criar | `src/hooks/mv/__tests__/useMvCandidatoData.test.ts` | Testes unitários hooks de perfil |
| Criar | `src/components/eleicoes/SkeletonDrillDown.tsx` | Skeleton animado para drill-downs na Camada 2 |
| Modificar | `src/pages/Ranking.tsx` | Trocar useRankingMD por useMvRanking + prefetch on hover |
| Modificar | `src/pages/CandidatoPerfil.tsx` | Trocar hooks MotherDuck pelos mv_ hooks |

---

## Task 1: SQL — Criar tabelas mv_ no Supabase

**Files:**
- Create: `supabase/sql/create_mv_tables.sql`

> ⚠️ Rodar manualmente no Supabase SQL Editor (Dashboard → SQL Editor → New query → colar e executar). Não modifica tabelas existentes.

- [ ] **Step 1: Criar o arquivo SQL**

```sql
-- supabase/sql/create_mv_tables.sql
-- SEGURO: apenas CREATE TABLE IF NOT EXISTS com prefixo mv_
-- Nunca altera tabelas existentes.

-- =====================
-- mv_candidatos
-- =====================
CREATE TABLE IF NOT EXISTS mv_candidatos (
  id             bigserial PRIMARY KEY,
  ano            smallint  NOT NULL,
  uf             char(2)   NOT NULL DEFAULT 'GO',
  municipio_nome text      NOT NULL,
  sq_candidato   text      NOT NULL,
  nr_candidato   text,
  nm_candidato   text      NOT NULL,
  nm_urna        text      NOT NULL,
  sg_partido     text      NOT NULL,
  ds_cargo       text      NOT NULL,
  nr_turno       smallint  NOT NULL DEFAULT 1,
  nr_zona        smallint,
  ds_situacao    text,
  ds_genero      text,
  ds_grau_instrucao text,
  ds_ocupacao    text,
  total_votos    integer   NOT NULL DEFAULT 0,
  votos_turno1   integer   NOT NULL DEFAULT 0,
  votos_turno2   integer   NOT NULL DEFAULT 0,
  patrimonio_total numeric(15,2) NOT NULL DEFAULT 0,
  tem_segundo_turno boolean NOT NULL DEFAULT false,
  created_at     timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mv_candidatos_filtro
  ON mv_candidatos (ano, municipio_nome, ds_cargo);
CREATE INDEX IF NOT EXISTS idx_mv_candidatos_sq
  ON mv_candidatos (sq_candidato, ano);
CREATE INDEX IF NOT EXISTS idx_mv_candidatos_partido
  ON mv_candidatos (ano, sg_partido);
CREATE INDEX IF NOT EXISTS idx_mv_candidatos_zona
  ON mv_candidatos (ano, municipio_nome, nr_zona);
CREATE INDEX IF NOT EXISTS idx_mv_candidatos_nome_trgm
  ON mv_candidatos USING gin (nm_urna gin_trgm_ops);

-- =====================
-- mv_candidato_bens
-- =====================
CREATE TABLE IF NOT EXISTS mv_candidato_bens (
  id          bigserial PRIMARY KEY,
  sq_candidato text     NOT NULL,
  ano         smallint  NOT NULL,
  nr_ordem    smallint,
  ds_tipo_bem text,
  ds_bem      text,
  vr_bem      numeric(15,2) DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_mv_bens_sq
  ON mv_candidato_bens (sq_candidato, ano);

-- =====================
-- mv_votos_zona
-- =====================
CREATE TABLE IF NOT EXISTS mv_votos_zona (
  id           bigserial PRIMARY KEY,
  sq_candidato text     NOT NULL,
  ano          smallint  NOT NULL,
  municipio_nome text   NOT NULL,
  nr_zona      smallint  NOT NULL,
  total_votos  integer   NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_mv_votos_zona_sq
  ON mv_votos_zona (sq_candidato, ano);
CREATE INDEX IF NOT EXISTS idx_mv_votos_zona_zona
  ON mv_votos_zona (ano, municipio_nome, nr_zona);

-- =====================
-- mv_financeiro
-- =====================
CREATE TABLE IF NOT EXISTS mv_financeiro (
  id             bigserial PRIMARY KEY,
  sq_candidato   text      NOT NULL,
  ano            smallint  NOT NULL,
  total_receitas numeric(15,2) DEFAULT 0,
  total_despesas numeric(15,2) DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_mv_financeiro_sq
  ON mv_financeiro (sq_candidato, ano);

-- =====================
-- mv_zonas
-- =====================
CREATE TABLE IF NOT EXISTS mv_zonas (
  id               bigserial PRIMARY KEY,
  ano              smallint  NOT NULL,
  municipio_nome   text      NOT NULL,
  nr_zona          smallint  NOT NULL,
  total_eleitores  integer   DEFAULT 0,
  total_secoes     integer   DEFAULT 0,
  total_locais     integer   DEFAULT 0,
  comparecimento_pct numeric(5,2) DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_mv_zonas_filtro
  ON mv_zonas (ano, municipio_nome);

-- =====================
-- mv_escolas
-- =====================
CREATE TABLE IF NOT EXISTS mv_escolas (
  id               bigserial PRIMARY KEY,
  ano              smallint  NOT NULL,
  municipio_nome   text      NOT NULL,
  nr_zona          smallint  NOT NULL,
  nm_local         text      NOT NULL,
  ds_endereco      text,
  nm_bairro        text,
  total_secoes     integer   DEFAULT 0,
  total_eleitores  integer   DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_mv_escolas_filtro
  ON mv_escolas (ano, municipio_nome);
CREATE INDEX IF NOT EXISTS idx_mv_escolas_zona
  ON mv_escolas (ano, nr_zona);

-- =====================
-- RLS — leitura pública (dados eleitorais são públicos)
-- =====================
ALTER TABLE mv_candidatos    ENABLE ROW LEVEL SECURITY;
ALTER TABLE mv_candidato_bens ENABLE ROW LEVEL SECURITY;
ALTER TABLE mv_votos_zona    ENABLE ROW LEVEL SECURITY;
ALTER TABLE mv_financeiro    ENABLE ROW LEVEL SECURITY;
ALTER TABLE mv_zonas         ENABLE ROW LEVEL SECURITY;
ALTER TABLE mv_escolas       ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mv_candidatos_read"   ON mv_candidatos;
DROP POLICY IF EXISTS "mv_bens_read"         ON mv_candidato_bens;
DROP POLICY IF EXISTS "mv_votos_zona_read"   ON mv_votos_zona;
DROP POLICY IF EXISTS "mv_financeiro_read"   ON mv_financeiro;
DROP POLICY IF EXISTS "mv_zonas_read"        ON mv_zonas;
DROP POLICY IF EXISTS "mv_escolas_read"      ON mv_escolas;

CREATE POLICY "mv_candidatos_read"   ON mv_candidatos    FOR SELECT USING (true);
CREATE POLICY "mv_bens_read"         ON mv_candidato_bens FOR SELECT USING (true);
CREATE POLICY "mv_votos_zona_read"   ON mv_votos_zona    FOR SELECT USING (true);
CREATE POLICY "mv_financeiro_read"   ON mv_financeiro    FOR SELECT USING (true);
CREATE POLICY "mv_zonas_read"        ON mv_zonas         FOR SELECT USING (true);
CREATE POLICY "mv_escolas_read"      ON mv_escolas       FOR SELECT USING (true);
```

- [ ] **Step 2: Executar no Supabase SQL Editor**

Abrir: Supabase Dashboard → SQL Editor → New query → colar o conteúdo de `supabase/sql/create_mv_tables.sql` → Run.

Resultado esperado: `Success. No rows returned` (ou equivalente sem erros).

- [ ] **Step 3: Verificar criação das tabelas**

No Supabase Dashboard → Table Editor: confirmar que as 6 tabelas aparecem com prefixo `mv_`.

- [ ] **Step 4: Commit**

```bash
git add supabase/sql/create_mv_tables.sql
git commit -m "feat: add mv_ tables DDL for performance materialization"
```

---

## Task 2: Script de Materialização — mv_candidatos

**Files:**
- Create: `scripts/materializar_supabase.py`

> Requer: `MOTHERDUCK_TOKEN`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` no `.env`.  
> `SUPABASE_SERVICE_KEY` = chave **service_role** (não anon key) — bypass RLS para INSERT.

- [ ] **Step 1: Criar o script base com conexões**

```python
# scripts/materializar_supabase.py
"""
Materializa dados do MotherDuck nas tabelas mv_ do Supabase.
Requer: MOTHERDUCK_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_KEY no .env
Rodar: python scripts/materializar_supabase.py --ano 2024 --municipio "APARECIDA DE GOIÂNIA"
"""
import os
import sys
import argparse
import duckdb
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

MOTHERDUCK_TOKEN = os.environ["MOTHERDUCK_TOKEN"]
SUPABASE_URL     = os.environ["SUPABASE_URL"]
SUPABASE_KEY     = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ["SUPABASE_KEY"]
BATCH_SIZE       = 500

def get_md() -> duckdb.DuckDBPyConnection:
    return duckdb.connect(f"md:?motherduck_token={MOTHERDUCK_TOKEN}")

def get_sb() -> Client:
    return create_client(SUPABASE_URL, SUPABASE_KEY)

def upsert_batch(sb: Client, table: str, rows: list[dict]) -> None:
    for i in range(0, len(rows), BATCH_SIZE):
        sb.table(table).upsert(rows[i:i+BATCH_SIZE]).execute()
        print(f"  {table}: {min(i+BATCH_SIZE, len(rows))}/{len(rows)} linhas")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--ano",       type=int,  default=2024)
    parser.add_argument("--uf",        type=str,  default="GO")
    parser.add_argument("--municipio", type=str,  default=None,
                        help="Filtrar por município (ex: 'APARECIDA DE GOIÂNIA'). Sem filtro = todos.")
    args = parser.parse_args()

    md = get_md()
    sb = get_sb()
    print(f"Materializando ano={args.ano} uf={args.uf} municipio={args.municipio or 'TODOS'}")
```

- [ ] **Step 2: Adicionar função materializar_candidatos**

```python
def materializar_candidatos(md, sb, ano: int, uf: str, municipio: str | None) -> None:
    """Popula mv_candidatos a partir das tabelas TSE no MotherDuck."""
    mun_filter = f"AND c.NM_UE = '{municipio}'" if municipio else ""

    sql = f"""
        SELECT
            c.SQ_CANDIDATO                      AS sq_candidato,
            c.NR_CANDIDATO                      AS nr_candidato,
            c.NM_CANDIDATO                      AS nm_candidato,
            c.NM_URNA_CANDIDATO                 AS nm_urna,
            c.SG_PARTIDO                        AS sg_partido,
            c.DS_CARGO                          AS ds_cargo,
            c.NM_UE                             AS municipio_nome,
            1                                   AS nr_turno,
            c.DS_SIT_TOT_TURNO                  AS ds_situacao,
            c.DS_GENERO                         AS ds_genero,
            c.DS_GRAU_INSTRUCAO                 AS ds_grau_instrucao,
            c.DS_OCUPACAO                       AS ds_ocupacao,
            COALESCE(v1.total_votos, 0)         AS votos_turno1,
            COALESCE(v2.total_votos, 0)         AS votos_turno2,
            COALESCE(v1.total_votos, 0)
              + COALESCE(v2.total_votos, 0)     AS total_votos,
            COALESCE(b.patrimonio_total, 0)     AS patrimonio_total,
            (v2.total_votos IS NOT NULL
              AND v2.total_votos > 0)           AS tem_segundo_turno
        FROM my_db.consulta_cand_{ano}_{uf} c
        LEFT JOIN (
            SELECT SQ_CANDIDATO, SUM(QT_VOTOS_NOMINAIS) AS total_votos
            FROM my_db.votacao_candidato_munzona_{ano}_{uf}
            WHERE NR_TURNO = 1
            GROUP BY SQ_CANDIDATO
        ) v1 ON c.SQ_CANDIDATO = v1.SQ_CANDIDATO
        LEFT JOIN (
            SELECT SQ_CANDIDATO, SUM(QT_VOTOS_NOMINAIS) AS total_votos
            FROM my_db.votacao_candidato_munzona_{ano}_{uf}
            WHERE NR_TURNO = 2
            GROUP BY SQ_CANDIDATO
        ) v2 ON c.SQ_CANDIDATO = v2.SQ_CANDIDATO
        LEFT JOIN (
            SELECT SQ_CANDIDATO, SUM(VR_BEM_CANDIDATO) AS patrimonio_total
            FROM my_db.bem_candidato_{ano}_{uf}
            GROUP BY SQ_CANDIDATO
        ) b ON c.SQ_CANDIDATO = b.SQ_CANDIDATO
        WHERE 1=1 {mun_filter}
    """

    print(f"Executando query candidatos {ano}_{uf}...")
    result = md.execute(sql).fetchdf()
    print(f"  {len(result)} candidatos encontrados")

    # Apagar registros anteriores desse ano/uf (idempotente)
    sb.table("mv_candidatos").delete().eq("ano", ano).eq("uf", uf).execute()

    rows = result.assign(ano=ano, uf=uf).to_dict(orient="records")
    upsert_batch(sb, "mv_candidatos", rows)
    print(f"mv_candidatos: {len(rows)} linhas materializadas ✓")
```

- [ ] **Step 3: Adicionar chamada no __main__ e testar**

```python
# Adicionar no bloco if __name__ == "__main__": (após print inicial)
    materializar_candidatos(md, sb, args.ano, args.uf, args.municipio)
```

Rodar:
```bash
cd dadoselitoraisv1.2
python scripts/materializar_supabase.py --ano 2024 --municipio "APARECIDA DE GOIÂNIA"
```

Resultado esperado: linhas impressas mostrando progresso + `mv_candidatos: N linhas materializadas ✓`

- [ ] **Step 4: Verificar no Supabase**

```bash
# No Supabase SQL Editor:
SELECT COUNT(*), ds_cargo FROM mv_candidatos WHERE ano = 2024 GROUP BY ds_cargo;
```

Resultado esperado: linhas com contagem de candidatos por cargo.

- [ ] **Step 5: Commit**

```bash
git add scripts/materializar_supabase.py
git commit -m "feat: add materializar_supabase script - mv_candidatos"
```

---

## Task 3: Script — Restante das tabelas mv_

**Files:**
- Modify: `scripts/materializar_supabase.py`

- [ ] **Step 1: Adicionar materializar_bens**

```python
def materializar_bens(md, sb, ano: int, uf: str, municipio: str | None) -> None:
    mun_join = f"""
        INNER JOIN my_db.consulta_cand_{ano}_{uf} c
          ON b.SQ_CANDIDATO = c.SQ_CANDIDATO
         AND c.NM_UE = '{municipio}'
    """ if municipio else ""

    sql = f"""
        SELECT
            b.SQ_CANDIDATO              AS sq_candidato,
            b.NR_ORDEM_BEM_CANDIDATO    AS nr_ordem,
            b.DS_TIPO_BEM_CANDIDATO     AS ds_tipo_bem,
            b.DS_BEM_CANDIDATO          AS ds_bem,
            b.VR_BEM_CANDIDATO          AS vr_bem
        FROM my_db.bem_candidato_{ano}_{uf} b
        {mun_join}
    """
    result = md.execute(sql).fetchdf()
    sb.table("mv_candidato_bens").delete().eq("ano", ano).execute()
    rows = result.assign(ano=ano).to_dict(orient="records")
    upsert_batch(sb, "mv_candidato_bens", rows)
    print(f"mv_candidato_bens: {len(rows)} linhas ✓")


def materializar_votos_zona(md, sb, ano: int, uf: str, municipio: str | None) -> None:
    mun_filter = f"AND v.NM_MUNICIPIO = '{municipio}'" if municipio else ""
    sql = f"""
        SELECT
            v.SQ_CANDIDATO              AS sq_candidato,
            v.NM_MUNICIPIO              AS municipio_nome,
            v.NR_ZONA                   AS nr_zona,
            SUM(v.QT_VOTOS_NOMINAIS)    AS total_votos
        FROM my_db.votacao_candidato_munzona_{ano}_{uf} v
        WHERE v.NR_TURNO = 1 {mun_filter}
        GROUP BY v.SQ_CANDIDATO, v.NM_MUNICIPIO, v.NR_ZONA
    """
    result = md.execute(sql).fetchdf()
    sb.table("mv_votos_zona").delete().eq("ano", ano).execute()
    rows = result.assign(ano=ano).to_dict(orient="records")
    upsert_batch(sb, "mv_votos_zona", rows)
    print(f"mv_votos_zona: {len(rows)} linhas ✓")


def materializar_financeiro(md, sb, ano: int, uf: str, municipio: str | None) -> None:
    # Finanças disponíveis a partir de 2018
    if ano < 2018:
        print(f"mv_financeiro: pulando ano {ano} (finanças disponíveis a partir de 2018)")
        return

    mun_join = f"""
        INNER JOIN my_db.consulta_cand_{ano}_{uf} c
          ON r.SQ_CANDIDATO = c.SQ_CANDIDATO
         AND c.NM_UE = '{municipio}'
    """ if municipio else ""

    sql = f"""
        SELECT
            r.SQ_CANDIDATO              AS sq_candidato,
            COALESCE(SUM(r.VR_RECEITA), 0) AS total_receitas
        FROM my_db.receitas_candidatos_{ano}_{uf} r
        {mun_join}
        GROUP BY r.SQ_CANDIDATO
    """
    result = md.execute(sql).fetchdf()
    sb.table("mv_financeiro").delete().eq("ano", ano).execute()
    rows = result.assign(ano=ano, total_despesas=0).to_dict(orient="records")
    upsert_batch(sb, "mv_financeiro", rows)
    print(f"mv_financeiro: {len(rows)} linhas ✓")


def materializar_zonas(md, sb, ano: int, uf: str, municipio: str | None) -> None:
    mun_filter = f"AND NM_MUNICIPIO = '{municipio}'" if municipio else ""
    sql = f"""
        SELECT
            NM_MUNICIPIO                AS municipio_nome,
            NR_ZONA                     AS nr_zona,
            COUNT(DISTINCT NR_LOCAL_VOTACAO) AS total_locais,
            COUNT(DISTINCT NR_SECAO)    AS total_secoes,
            SUM(QT_ELEITORES_PERFIL)    AS total_eleitores
        FROM my_db.eleitorado_local_votacao_{ano}
        WHERE SG_UF = '{uf}' {mun_filter}
        GROUP BY NM_MUNICIPIO, NR_ZONA
    """
    result = md.execute(sql).fetchdf()
    result["comparecimento_pct"] = 0.0
    sb.table("mv_zonas").delete().eq("ano", ano).execute()
    rows = result.assign(ano=ano).to_dict(orient="records")
    upsert_batch(sb, "mv_zonas", rows)
    print(f"mv_zonas: {len(rows)} linhas ✓")
```

- [ ] **Step 2: Adicionar chamadas no __main__**

```python
# Substituir o bloco if __name__ == "__main__": por:
if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--ano",       type=int, default=2024)
    parser.add_argument("--uf",        type=str, default="GO")
    parser.add_argument("--municipio", type=str, default=None)
    args = parser.parse_args()

    md = get_md()
    sb = get_sb()
    label = f"ano={args.ano} uf={args.uf} municipio={args.municipio or 'TODOS'}"
    print(f"Iniciando materialização: {label}")

    materializar_candidatos(md, sb, args.ano, args.uf, args.municipio)
    materializar_bens(md, sb, args.ano, args.uf, args.municipio)
    materializar_votos_zona(md, sb, args.ano, args.uf, args.municipio)
    materializar_financeiro(md, sb, args.ano, args.uf, args.municipio)
    materializar_zonas(md, sb, args.ano, args.uf, args.municipio)

    print(f"\nMaterialização completa ✓  ({label})")
```

- [ ] **Step 3: Rodar script completo**

```bash
python scripts/materializar_supabase.py --ano 2024 --municipio "APARECIDA DE GOIÂNIA"
```

Resultado esperado: todas as 5 funções completam sem erro.

- [ ] **Step 4: Commit**

```bash
git add scripts/materializar_supabase.py
git commit -m "feat: complete materializar_supabase with bens, votos_zona, financeiro, zonas"
```

---

## Task 4: Hook useMvRanking

**Files:**
- Create: `src/hooks/mv/useMvRanking.ts`
- Create: `src/hooks/mv/__tests__/useMvRanking.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

```typescript
// src/hooks/mv/__tests__/useMvRanking.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { useMvRanking } from '../useMvRanking'

// Mock supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({
      data: [
        {
          sq_candidato: '123',
          nm_urna: 'FULANO DA SILVA',
          sg_partido: 'PT',
          ds_cargo: 'VEREADOR',
          total_votos: 1500,
          patrimonio_total: 50000,
        },
      ],
      error: null,
    }),
  },
}))

// Mock filterStore
vi.mock('@/stores/filterStore', () => ({
  useFilterStore: () => ({
    ano: 2024,
    municipio: 'APARECIDA DE GOIÂNIA',
    cargo: 'VEREADOR',
    partido: null,
    turno: null,
    zona: null,
    searchText: '',
  }),
}))

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return createElement(QueryClientProvider, { client: qc }, children)
}

describe('useMvRanking', () => {
  it('retorna lista de candidatos do Supabase', async () => {
    const { result } = renderHook(() => useMvRanking(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
    expect(result.current.data![0].NM_URNA_CANDIDATO).toBe('FULANO DA SILVA')
    expect(result.current.data![0].total_votos).toBe(1500)
  })

  it('retorna array vazio quando não há candidatos', async () => {
    const { supabase } = await import('@/integrations/supabase/client')
    vi.mocked(supabase.from('mv_candidatos').select('*').eq('', '').order('')).mockResolvedValueOnce({
      data: [], error: null,
    })
    const { result } = renderHook(() => useMvRanking(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Rodar teste para confirmar que falha**

```bash
npx vitest run src/hooks/mv/__tests__/useMvRanking.test.ts
```

Esperado: `FAIL — Cannot find module '../useMvRanking'`

- [ ] **Step 3: Implementar o hook**

```typescript
// src/hooks/mv/useMvRanking.ts
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useFilterStore } from '@/stores/filterStore'
import type { RankingItem } from '@/hooks/useRanking'

export function useMvRanking() {
  const { ano, municipio, cargo, partido, turno, zona, searchText } = useFilterStore()

  return useQuery<RankingItem[]>({
    queryKey: ['mv_ranking', ano, municipio, cargo, partido, turno, zona, searchText],
    queryFn: async () => {
      // Se zona filter ativo: buscar sq_candidatos que têm votos nessa zona
      let sqFilter: string[] | null = null
      if (zona) {
        const { data: zonaData } = await supabase
          .from('mv_votos_zona')
          .select('sq_candidato')
          .eq('ano', ano)
          .eq('nr_zona', zona)
        sqFilter = (zonaData ?? []).map((r) => r.sq_candidato)
        if (sqFilter.length === 0) return []
      }

      let q = supabase
        .from('mv_candidatos')
        .select('*')
        .eq('ano', ano)
        .eq('municipio_nome', municipio)
        .order('total_votos', { ascending: false })

      if (cargo)      q = q.eq('ds_cargo', cargo)
      if (partido)    q = q.eq('sg_partido', partido)
      if (turno)      q = q.eq('nr_turno', turno)
      if (searchText) q = q.ilike('nm_urna', `%${searchText}%`)
      if (sqFilter)   q = q.in('sq_candidato', sqFilter)

      const { data, error } = await q
      if (error) throw new Error(error.message)

      // Mapear para RankingItem (compatibilidade com código existente)
      return (data ?? []).map((r) => ({
        SQ_CANDIDATO:     r.sq_candidato,
        NM_CANDIDATO:     r.nm_candidato,
        NM_URNA_CANDIDATO: r.nm_urna,
        SG_PARTIDO:       r.sg_partido,
        DS_CARGO:         r.ds_cargo,
        NM_UE:            r.municipio_nome,
        DS_SIT_TOT_TURNO: r.ds_situacao ?? '',
        DS_GENERO:        r.ds_genero ?? '',
        total_votos:      r.total_votos,
        votos_turno1:     r.votos_turno1,
        votos_turno2:     r.votos_turno2,
        patrimonio_total: Number(r.patrimonio_total),
        tem_segundo_turno: r.tem_segundo_turno,
      }))
    },
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60 * 24,
  })
}
```

- [ ] **Step 4: Rodar teste para confirmar que passa**

```bash
npx vitest run src/hooks/mv/__tests__/useMvRanking.test.ts
```

Esperado: `PASS — 2 testes`

- [ ] **Step 5: Commit**

```bash
git add src/hooks/mv/useMvRanking.ts src/hooks/mv/__tests__/useMvRanking.test.ts
git commit -m "feat: add useMvRanking hook - reads ranking from Supabase mv_candidatos"
```

---

## Task 5: Atualizar Ranking.tsx

**Files:**
- Modify: `src/pages/Ranking.tsx`

- [ ] **Step 1: Trocar import do hook**

Em `src/pages/Ranking.tsx`, localizar o import do hook de ranking atual:

```typescript
// REMOVER (exemplo — adaptar ao nome exato encontrado no arquivo):
import { useRankingMD } from '@/hooks/useRanking'
// ou: import { useRanking } from '@/hooks/useRanking'

// ADICIONAR:
import { useMvRanking } from '@/hooks/mv/useMvRanking'
```

- [ ] **Step 2: Trocar uso do hook no componente**

Localizar a linha onde o hook é chamado (ex: `const { data, isLoading } = useRankingMD()`) e substituir:

```typescript
// REMOVER:
const { data: rankingData, isLoading, error } = useRankingMD()
// (adaptar ao nome exato encontrado)

// ADICIONAR:
const { data: rankingData, isLoading, error } = useMvRanking()
```

- [ ] **Step 3: Adicionar prefetch on hover**

No componente de linha da tabela (onde o candidato é renderizado), adicionar prefetch:

```typescript
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

// Dentro do componente:
const queryClient = useQueryClient()

const handleRowHover = (sqCandidato: string, ano: number) => {
  queryClient.prefetchQuery({
    queryKey: ['mv_bens', sqCandidato, ano],
    queryFn: async () => {
      const { data } = await supabase
        .from('mv_candidato_bens')
        .select('*')
        .eq('sq_candidato', sqCandidato)
        .eq('ano', ano)
      return data ?? []
    },
    staleTime: Infinity,
  })
}

// No JSX da linha da tabela — adicionar onMouseEnter:
// <TableRow onMouseEnter={() => handleRowHover(item.SQ_CANDIDATO, ano)} ...>
```

- [ ] **Step 4: Testar no browser**

```bash
npm run dev
```

Abrir `http://localhost:5173` → verificar no Network tab do Chrome:
- Primeira abertura: request para `supabase.co` com status 200
- Tempo de resposta: <200ms
- Sem requests para `api/dados/ranking`

- [ ] **Step 5: Commit**

```bash
git add src/pages/Ranking.tsx
git commit -m "feat: Ranking page now reads from Supabase mv_candidatos (<200ms)"
```

---

## Task 6: Hooks para Perfil do Candidato

**Files:**
- Create: `src/hooks/mv/useMvCandidatoData.ts`
- Create: `src/hooks/mv/__tests__/useMvCandidatoData.test.ts`

- [ ] **Step 1: Escrever testes que falham**

```typescript
// src/hooks/mv/__tests__/useMvCandidatoData.test.ts
import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { useMvBens, useMvVotosZona, useMvFinanceiro } from '../useMvCandidatoData'

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [{ sq_candidato: '123', vr_bem: 50000, ds_tipo_bem: 'IMÓVEL', ds_bem: 'Casa', nr_ordem: 1, ano: 2024 }],
        error: null,
      }),
    })),
  },
}))

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return createElement(QueryClientProvider, { client: qc }, children)
}

describe('useMvBens', () => {
  it('retorna lista de bens do candidato', async () => {
    const { result } = renderHook(() => useMvBens('123', 2024), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
    expect(result.current.data![0].ds_tipo_bem).toBe('IMÓVEL')
  })
})

describe('useMvVotosZona', () => {
  it('retorna votos por zona do candidato', async () => {
    const { result } = renderHook(() => useMvVotosZona('123', 2024), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })
})
```

- [ ] **Step 2: Rodar testes para confirmar falha**

```bash
npx vitest run src/hooks/mv/__tests__/useMvCandidatoData.test.ts
```

Esperado: `FAIL — Cannot find module '../useMvCandidatoData'`

- [ ] **Step 3: Implementar os hooks**

```typescript
// src/hooks/mv/useMvCandidatoData.ts
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

export function useMvBens(sqCandidato: string | null, ano: number) {
  return useQuery({
    queryKey: ['mv_bens', sqCandidato, ano],
    enabled: !!sqCandidato,
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mv_candidato_bens')
        .select('*')
        .eq('sq_candidato', sqCandidato!)
        .eq('ano', ano)
        .order('nr_ordem')
      if (error) throw new Error(error.message)
      return data ?? []
    },
  })
}

export function useMvVotosZona(sqCandidato: string | null, ano: number) {
  return useQuery({
    queryKey: ['mv_votos_zona', sqCandidato, ano],
    enabled: !!sqCandidato,
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mv_votos_zona')
        .select('*')
        .eq('sq_candidato', sqCandidato!)
        .eq('ano', ano)
        .order('total_votos', { ascending: false })
      if (error) throw new Error(error.message)
      return data ?? []
    },
  })
}

export function useMvFinanceiro(sqCandidato: string | null, ano: number) {
  return useQuery({
    queryKey: ['mv_financeiro', sqCandidato, ano],
    enabled: !!sqCandidato,
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mv_financeiro')
        .select('*')
        .eq('sq_candidato', sqCandidato!)
        .eq('ano', ano)
      if (error) throw new Error(error.message)
      return data?.[0] ?? null
    },
  })
}
```

- [ ] **Step 4: Rodar testes para confirmar que passam**

```bash
npx vitest run src/hooks/mv/__tests__/useMvCandidatoData.test.ts
```

Esperado: `PASS — 3 testes`

- [ ] **Step 5: Commit**

```bash
git add src/hooks/mv/useMvCandidatoData.ts src/hooks/mv/__tests__/useMvCandidatoData.test.ts
git commit -m "feat: add useMvBens, useMvVotosZona, useMvFinanceiro hooks"
```

---

## Task 7: Skeleton Loading + Atualizar CandidatoPerfil.tsx

**Files:**
- Create: `src/components/eleicoes/SkeletonDrillDown.tsx`
- Modify: `src/pages/CandidatoPerfil.tsx`

- [ ] **Step 1: Criar componente SkeletonDrillDown**

```typescript
// src/components/eleicoes/SkeletonDrillDown.tsx
import { Skeleton } from '@/components/ui/skeleton'

interface SkeletonDrillDownProps {
  rows?: number
  label?: string
}

export function SkeletonDrillDown({ rows = 5, label = 'Carregando dados...' }: SkeletonDrillDownProps) {
  return (
    <div className="space-y-3 p-4">
      <p className="text-sm text-muted-foreground animate-pulse">{label}</p>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Localizar seção de bens em CandidatoPerfil.tsx**

Abrir `src/pages/CandidatoPerfil.tsx`. Localizar onde os bens (patrimônio) são carregados e renderizados (buscar por `bem_candidato` ou `patrimonio` ou `VR_BEM`).

- [ ] **Step 3: Substituir hook de bens**

```typescript
// ADICIONAR imports no topo do arquivo:
import { useMvBens, useMvVotosZona, useMvFinanceiro } from '@/hooks/mv/useMvCandidatoData'
import { SkeletonDrillDown } from '@/components/eleicoes/SkeletonDrillDown'

// SUBSTITUIR o hook de bens existente (ex: useCandidatoBens ou mdQuery para bens):
// REMOVER: const bensQuery = useMotherDuckQuery(sqlBens)
// ADICIONAR:
const bensQuery = useMvBens(sqCandidato, ano)

// SUBSTITUIR o hook de votos por zona:
// REMOVER: const votosZonaQuery = useMotherDuckQuery(sqlVotosZona)
// ADICIONAR:
const votosZonaQuery = useMvVotosZona(sqCandidato, ano)

// SUBSTITUIR o hook de financeiro:
// REMOVER: const financeiroQuery = useMotherDuckQuery(sqlFinanceiro)
// ADICIONAR:
const financeiroQuery = useMvFinanceiro(sqCandidato, ano)
```

- [ ] **Step 4: Adicionar skeleton nos estados de loading**

Nas seções de bens, votos_zona e financeiro, substituir spinners por `SkeletonDrillDown`:

```typescript
// Onde havia: {bensQuery.isLoading && <Spinner />}
// Substituir por:
{bensQuery.isLoading && (
  <SkeletonDrillDown rows={4} label="Carregando patrimônio..." />
)}

// Idem para votos_zona e financeiro:
{votosZonaQuery.isLoading && (
  <SkeletonDrillDown rows={6} label="Carregando votos por zona..." />
)}
{financeiroQuery.isLoading && (
  <SkeletonDrillDown rows={3} label="Carregando dados financeiros..." />
)}
```

- [ ] **Step 5: Testar no browser**

```bash
npm run dev
```

- Abrir Ranking → clicar em qualquer candidato
- Verificar no Network tab: requests para `supabase.co/rest/v1/mv_candidato_bens`, `mv_votos_zona`, `mv_financeiro`
- Tempo esperado: <200ms para cada seção do perfil
- Skeleton visível brevemente na primeira abertura

- [ ] **Step 6: Commit final**

```bash
git add src/components/eleicoes/SkeletonDrillDown.tsx src/pages/CandidatoPerfil.tsx
git commit -m "feat: CandidatoPerfil uses Supabase mv_ hooks + skeleton loading"
```

---

## Critérios de Sucesso (verificação final)

Executar após todas as tasks:

```bash
# 1. Todos os testes passam
npx vitest run

# 2. Build sem erros de TypeScript
npm run build

# 3. Lint limpo
npm run lint
```

No Chrome DevTools → Network tab com o app rodando:
- [ ] Ranking abre: request para `mv_candidatos` em <200ms
- [ ] Mudança de filtro: nova request <200ms
- [ ] Perfil de candidato: `mv_candidato_bens` + `mv_votos_zona` + `mv_financeiro` todas <200ms
- [ ] Hover sobre candidato: prefetch de bens dispara antes do clique
- [ ] Nenhum request para `api/dados/ranking` (FastAPI) em nenhuma dessas telas
- [ ] Chat IA (`/chat`) continua funcionando normalmente
