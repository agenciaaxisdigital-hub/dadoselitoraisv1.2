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


def _require_env(key: str) -> str:
    val = os.environ.get(key)
    if not val:
        sys.exit(f"[ERRO] Variável de ambiente obrigatória não encontrada: {key}")
    return val


MOTHERDUCK_TOKEN = _require_env("MOTHERDUCK_TOKEN")
SUPABASE_URL     = _require_env("SUPABASE_URL")
SUPABASE_KEY     = os.environ.get("SUPABASE_SERVICE_KEY") or _require_env("SUPABASE_KEY")
BATCH_SIZE       = 500


def get_md() -> duckdb.DuckDBPyConnection:
    return duckdb.connect(f"md:?motherduck_token={MOTHERDUCK_TOKEN}")

def get_sb() -> Client:
    return create_client(SUPABASE_URL, SUPABASE_KEY)

def upsert_batch(sb: Client, table: str, rows: list[dict]) -> None:
    for i in range(0, len(rows), BATCH_SIZE):
        sb.table(table).upsert(rows[i:i+BATCH_SIZE]).execute()
        print(f"  {table}: {min(i+BATCH_SIZE, len(rows))}/{len(rows)} linhas")

def materializar_candidatos(md, sb, ano: int, uf: str, municipio: str | None) -> None:
    """Popula mv_candidatos a partir das tabelas TSE no MotherDuck."""
    params = []
    mun_filter = ""
    if municipio:
        mun_filter = "AND c.NM_UE = ?"
        params.append(municipio)

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
    try:
        result = md.execute(sql, params).fetchdf()
    except Exception as e:
        sys.exit(f"[ERRO] Falha ao consultar MotherDuck (tabela consulta_cand_{ano}_{uf}): {e}")
    print(f"  {len(result)} candidatos encontrados")

    # Apagar registros anteriores (idempotente)
    delete_q = sb.table("mv_candidatos").delete().eq("ano", ano).eq("uf", uf)
    if municipio:
        delete_q = delete_q.eq("municipio_nome", municipio)
    delete_q.execute()

    rows = result.assign(ano=ano, uf=uf).to_dict(orient="records")
    upsert_batch(sb, "mv_candidatos", rows)
    print(f"mv_candidatos: {len(rows)} linhas materializadas ✓")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--ano",       type=int, default=2024)
    parser.add_argument("--uf",        type=str, default="GO")
    parser.add_argument("--municipio", type=str, default=None,
                        help="Filtrar por município. Sem filtro = todos.")
    args = parser.parse_args()

    md = get_md()
    sb = get_sb()
    print(f"Materializando ano={args.ano} uf={args.uf} municipio={args.municipio or 'TODOS'}")
    materializar_candidatos(md, sb, args.ano, args.uf, args.municipio)
    print("Materialização completa ✓")
