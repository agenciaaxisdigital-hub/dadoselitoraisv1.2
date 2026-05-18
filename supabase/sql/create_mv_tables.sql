-- =============================================================
-- create_mv_tables.sql
-- SEGURO: apenas CREATE TABLE IF NOT EXISTS com prefixo mv_
-- Nunca altera tabelas existentes. Banco compartilhado com outras apps.
-- Rodar no Supabase SQL Editor (Dashboard → SQL Editor → Run)
-- =============================================================

-- =====================
-- mv_candidatos
-- =====================
CREATE TABLE IF NOT EXISTS mv_candidatos (
  id               bigserial PRIMARY KEY,
  ano              smallint  NOT NULL,
  uf               char(2)   NOT NULL DEFAULT 'GO',
  municipio_nome   text      NOT NULL,
  sq_candidato     text      NOT NULL,
  nr_candidato     text,
  nm_candidato     text      NOT NULL,
  nm_urna          text      NOT NULL,
  sg_partido       text      NOT NULL,
  ds_cargo         text      NOT NULL,
  nr_turno         smallint  NOT NULL DEFAULT 1,
  nr_zona          smallint,
  ds_situacao      text,
  ds_genero        text,
  ds_grau_instrucao text,
  ds_ocupacao      text,
  total_votos      integer   NOT NULL DEFAULT 0,
  votos_turno1     integer   NOT NULL DEFAULT 0,
  votos_turno2     integer   NOT NULL DEFAULT 0,
  patrimonio_total numeric(15,2) NOT NULL DEFAULT 0,
  tem_segundo_turno boolean  NOT NULL DEFAULT false,
  created_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mv_candidatos_filtro
  ON mv_candidatos (ano, municipio_nome, ds_cargo);
CREATE INDEX IF NOT EXISTS idx_mv_candidatos_sq
  ON mv_candidatos (sq_candidato, ano);
CREATE INDEX IF NOT EXISTS idx_mv_candidatos_partido
  ON mv_candidatos (ano, sg_partido);
CREATE INDEX IF NOT EXISTS idx_mv_candidatos_zona
  ON mv_candidatos (ano, municipio_nome, nr_zona);

-- =====================
-- mv_candidato_bens
-- =====================
CREATE TABLE IF NOT EXISTS mv_candidato_bens (
  id           bigserial PRIMARY KEY,
  sq_candidato text      NOT NULL,
  ano          smallint  NOT NULL,
  nr_ordem     smallint,
  ds_tipo_bem  text,
  ds_bem       text,
  vr_bem       numeric(15,2) DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_mv_bens_sq
  ON mv_candidato_bens (sq_candidato, ano);

-- =====================
-- mv_votos_zona
-- =====================
CREATE TABLE IF NOT EXISTS mv_votos_zona (
  id             bigserial PRIMARY KEY,
  sq_candidato   text      NOT NULL,
  ano            smallint  NOT NULL,
  municipio_nome text      NOT NULL,
  nr_zona        smallint  NOT NULL,
  total_votos    integer   NOT NULL DEFAULT 0
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
  id                 bigserial PRIMARY KEY,
  ano                smallint  NOT NULL,
  municipio_nome     text      NOT NULL,
  nr_zona            smallint  NOT NULL,
  total_eleitores    integer   DEFAULT 0,
  total_secoes       integer   DEFAULT 0,
  total_locais       integer   DEFAULT 0,
  comparecimento_pct numeric(5,2) DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_mv_zonas_filtro
  ON mv_zonas (ano, municipio_nome);

-- =====================
-- mv_escolas
-- =====================
CREATE TABLE IF NOT EXISTS mv_escolas (
  id             bigserial PRIMARY KEY,
  ano            smallint  NOT NULL,
  municipio_nome text      NOT NULL,
  nr_zona        smallint  NOT NULL,
  nm_local       text      NOT NULL,
  ds_endereco    text,
  nm_bairro      text,
  total_secoes   integer   DEFAULT 0,
  total_eleitores integer  DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_mv_escolas_filtro
  ON mv_escolas (ano, municipio_nome);
CREATE INDEX IF NOT EXISTS idx_mv_escolas_zona
  ON mv_escolas (ano, nr_zona);

-- =====================
-- RLS (DROP + CREATE = idempotente em qualquer versão PostgreSQL)
-- =====================
ALTER TABLE mv_candidatos     ENABLE ROW LEVEL SECURITY;
ALTER TABLE mv_candidato_bens ENABLE ROW LEVEL SECURITY;
ALTER TABLE mv_votos_zona     ENABLE ROW LEVEL SECURITY;
ALTER TABLE mv_financeiro     ENABLE ROW LEVEL SECURITY;
ALTER TABLE mv_zonas          ENABLE ROW LEVEL SECURITY;
ALTER TABLE mv_escolas        ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mv_candidatos_read"   ON mv_candidatos;
DROP POLICY IF EXISTS "mv_bens_read"         ON mv_candidato_bens;
DROP POLICY IF EXISTS "mv_votos_zona_read"   ON mv_votos_zona;
DROP POLICY IF EXISTS "mv_financeiro_read"   ON mv_financeiro;
DROP POLICY IF EXISTS "mv_zonas_read"        ON mv_zonas;
DROP POLICY IF EXISTS "mv_escolas_read"      ON mv_escolas;

CREATE POLICY "mv_candidatos_read"   ON mv_candidatos     FOR SELECT USING (true);
CREATE POLICY "mv_bens_read"         ON mv_candidato_bens FOR SELECT USING (true);
CREATE POLICY "mv_votos_zona_read"   ON mv_votos_zona     FOR SELECT USING (true);
CREATE POLICY "mv_financeiro_read"   ON mv_financeiro     FOR SELECT USING (true);
CREATE POLICY "mv_zonas_read"        ON mv_zonas          FOR SELECT USING (true);
CREATE POLICY "mv_escolas_read"      ON mv_escolas        FOR SELECT USING (true);
