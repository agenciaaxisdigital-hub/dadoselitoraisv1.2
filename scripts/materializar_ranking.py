#!/usr/bin/env python3
"""
Cria/atualiza as tabelas pré-computadas de ranking no MotherDuck.
O JOIN candidatos × votos × patrimônio é feito UMA VEZ aqui,
eliminando o custo de JOIN em cada query do frontend.

Execute após cada carga de dados novos:
    python scripts/materializar_ranking.py

Requer MOTHERDUCK_TOKEN no ambiente ou em .env na raiz do projeto.
"""

import os
import sys
import duckdb
from pathlib import Path

# Carrega .env se existir
env_path = Path(__file__).parent.parent / ".env"
if env_path.exists():
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

ANOS = [2014, 2016, 2018, 2020, 2022, 2024]
ANOS_BENS = [2014, 2016, 2018, 2020, 2022, 2024]


def materializar_ano(conn: duckdb.DuckDBPyConnection, ano: int) -> None:
    print(f"\n[{ano}] Materializando ranking_pre_{ano}_GO...", flush=True)

    has_bens = ano in ANOS_BENS

    bens_join = (
        f"""LEFT JOIN (
    SELECT SQ_CANDIDATO,
           SUM(TRY_CAST(REPLACE(VR_BEM_CANDIDATO, ',', '.') AS DOUBLE)) AS patrimonio_total
    FROM my_db.bem_candidato_{ano}_GO
    GROUP BY SQ_CANDIDATO
  ) b ON c.SQ_CANDIDATO = b.SQ_CANDIDATO"""
        if has_bens
        else ""
    )

    patrimonio_col = "COALESCE(b.patrimonio_total, 0)" if has_bens else "0"

    sql = f"""
CREATE OR REPLACE TABLE my_db.ranking_pre_{ano}_GO AS
SELECT
  c.SQ_CANDIDATO,
  c.NM_CANDIDATO,
  c.NM_URNA_CANDIDATO,
  c.SG_PARTIDO,
  c.NM_PARTIDO,
  c.DS_CARGO,
  c.NM_UE,
  c.DS_SIT_TOT_TURNO,
  c.DS_GENERO,
  c.NR_CANDIDATO,
  c.NR_TURNO,
  c.DS_GRAU_INSTRUCAO,
  c.DS_OCUPACAO,
  c.DT_NASCIMENTO,
  c.SG_UF_NASCIMENTO,
  COALESCE(SUM(v.QT_VOTOS_NOMINAIS), 0)                                                              AS total_votos,
  COALESCE(SUM(CASE WHEN v.NR_TURNO = 1 THEN v.QT_VOTOS_NOMINAIS ELSE 0 END), 0)                    AS votos_turno1,
  COALESCE(SUM(CASE WHEN v.NR_TURNO = 2 THEN v.QT_VOTOS_NOMINAIS ELSE 0 END), 0)                    AS votos_turno2,
  {patrimonio_col}                                                                                     AS patrimonio_total
FROM (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY SQ_CANDIDATO ORDER BY NR_TURNO DESC) AS rn
  FROM my_db.consulta_cand_{ano}_GO
) c
LEFT JOIN my_db.votacao_candidato_munzona_{ano}_GO v
  ON c.SQ_CANDIDATO = v.SQ_CANDIDATO
{bens_join}
WHERE c.rn = 1
GROUP BY
  c.SQ_CANDIDATO, c.NM_CANDIDATO, c.NM_URNA_CANDIDATO, c.SG_PARTIDO, c.NM_PARTIDO,
  c.DS_CARGO, c.NM_UE, c.DS_SIT_TOT_TURNO, c.DS_GENERO, c.NR_CANDIDATO, c.NR_TURNO,
  c.DS_GRAU_INSTRUCAO, c.DS_OCUPACAO, c.DT_NASCIMENTO, c.SG_UF_NASCIMENTO{', b.patrimonio_total' if has_bens else ''}
"""

    conn.execute(sql)
    count = conn.execute(f"SELECT COUNT(*) FROM my_db.ranking_pre_{ano}_GO").fetchone()[0]
    print(f"  OK  ranking_pre_{ano}_GO — {count:,} linhas", flush=True)


def main() -> None:
    token = os.getenv("MOTHERDUCK_TOKEN")
    if not token:
        print("ERRO: MOTHERDUCK_TOKEN não definido.", file=sys.stderr)
        sys.exit(1)

    anos_arg = [int(a) for a in sys.argv[1:]] if len(sys.argv) > 1 else ANOS

    print(f"Conectando ao MotherDuck...")
    conn = duckdb.connect(f"md:?motherduck_token={token}")

    for ano in anos_arg:
        try:
            materializar_ano(conn, ano)
        except Exception as e:
            print(f"  ERRO [{ano}]: {e}", file=sys.stderr)

    conn.close()
    print("\nMaterialização concluída.")


if __name__ == "__main__":
    main()
