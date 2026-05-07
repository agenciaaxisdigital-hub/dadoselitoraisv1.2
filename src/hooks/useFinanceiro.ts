import { useQuery } from '@tanstack/react-query';
import { useFilterStore } from '@/stores/filterStore';
import { mdQuery, getTableName, getAnosDisponiveis, sqlSafe } from '@/lib/motherduck';

function getFinAno(ano: number, dataset: string): number | null {
  const anos = getAnosDisponiveis(dataset);
  if (anos.includes(ano)) return ano;
  return [...anos].sort((a, b) => Math.abs(a - ano) - Math.abs(b - ano))[0] ?? null;
}

/** Ranking de candidatos por total de receitas arrecadadas */
export function useRankingFinanciamento(limite = 50) {
  const ano = useFilterStore((s) => s.ano);
  const municipio = useFilterStore((s) => s.municipio);
  const cargo = useFilterStore((s) => s.cargo);
  const partido = useFilterStore((s) => s.partido);

  return useQuery({
    queryKey: ['ranking-financiamento', ano, municipio, cargo, partido, limite],
    queryFn: async () => {
      const finAno = getFinAno(ano, 'receitas');
      if (!finAno) return [];
      const rec = getTableName('receitas', finAno);
      const cand = getTableName('candidatos', finAno);
      const vot = getTableName('votacao', finAno);

      const conds: string[] = [];
      if (municipio) conds.push(`c.NM_UE = '${sqlSafe(municipio)}'`);
      if (cargo) conds.push(`c.DS_CARGO ILIKE '%${sqlSafe(cargo)}%'`);
      if (partido) conds.push(`c.SG_PARTIDO = '${sqlSafe(partido)}'`);
      const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

      return mdQuery(`
        SELECT
          c.SQ_CANDIDATO AS sq_candidato,
          c.NM_URNA_CANDIDATO AS candidato,
          c.SG_PARTIDO AS partido,
          c.DS_CARGO AS cargo,
          c.NM_UE AS municipio,
          c.DS_SIT_TOT_TURNO AS situacao,
          COALESCE(r.total_receitas, 0) AS total_receitas,
          COALESCE(v.total_votos, 0) AS total_votos,
          CASE WHEN COALESCE(v.total_votos, 0) > 0
            THEN ROUND(COALESCE(r.total_receitas, 0) / v.total_votos, 2)
            ELSE 0
          END AS custo_por_voto
        FROM ${cand} c
        LEFT JOIN (
          SELECT SQ_CANDIDATO, SUM(CAST(REPLACE(CAST(VR_RECEITA AS VARCHAR), ',', '.') AS DOUBLE)) AS total_receitas
          FROM ${rec}
          GROUP BY SQ_CANDIDATO
        ) r ON c.SQ_CANDIDATO = r.SQ_CANDIDATO
        LEFT JOIN (
          SELECT SQ_CANDIDATO, SUM(QT_VOTOS_NOMINAIS) AS total_votos
          FROM ${vot}
          GROUP BY SQ_CANDIDATO
        ) v ON c.SQ_CANDIDATO = v.SQ_CANDIDATO
        ${where}
        ORDER BY total_receitas DESC
        LIMIT ${limite}
      `);
    },
    staleTime: 15 * 60 * 1000,
  });
}

/** Distribuição por origem da receita */
export function useOrigemReceitas() {
  const ano = useFilterStore((s) => s.ano);
  const municipio = useFilterStore((s) => s.municipio);
  const cargo = useFilterStore((s) => s.cargo);

  return useQuery({
    queryKey: ['origem-receitas', ano, municipio, cargo],
    queryFn: async () => {
      const finAno = getFinAno(ano, 'receitas');
      if (!finAno) return [];
      const rec = getTableName('receitas', finAno);
      const cand = getTableName('candidatos', finAno);

      const conds: string[] = [];
      if (municipio) conds.push(`c.NM_UE = '${sqlSafe(municipio)}'`);
      if (cargo) conds.push(`c.DS_CARGO ILIKE '%${sqlSafe(cargo)}%'`);
      const join = conds.length ? `INNER JOIN ${cand} c ON r.SQ_CANDIDATO = c.SQ_CANDIDATO WHERE ${conds.join(' AND ')}` : '';

      return mdQuery(`
        SELECT
          DS_ORIGEM_RECEITA AS origem,
          COUNT(*) AS ocorrencias,
          SUM(CAST(REPLACE(CAST(VR_RECEITA AS VARCHAR), ',', '.') AS DOUBLE)) AS total
        FROM ${rec} r
        ${join}
        WHERE DS_ORIGEM_RECEITA IS NOT NULL
        GROUP BY DS_ORIGEM_RECEITA
        ORDER BY total DESC
      `);
    },
    staleTime: 15 * 60 * 1000,
  });
}

/** Top doadores (receitas_candidatos_doador_originario) */
export function useTopDoadores(limite = 30) {
  const ano = useFilterStore((s) => s.ano);
  const municipio = useFilterStore((s) => s.municipio);

  return useQuery({
    queryKey: ['top-doadores', ano, municipio, limite],
    queryFn: async () => {
      const finAno = getFinAno(ano, 'receitas_doador');
      if (!finAno) return [];
      const tab = getTableName('receitas_doador', finAno);
      const cand = getTableName('candidatos', finAno);

      const munCond = municipio ? `AND c.NM_UE = '${sqlSafe(municipio)}'` : '';

      return mdQuery(`
        SELECT
          d.NM_DOADOR_ORIGINARIO AS doador,
          d.DS_ORIGEM_RECEITA AS origem,
          COUNT(DISTINCT d.SQ_CANDIDATO) AS candidatos,
          SUM(CAST(REPLACE(CAST(d.VR_RECEITA AS VARCHAR), ',', '.') AS DOUBLE)) AS total_doado
        FROM ${tab} d
        INNER JOIN ${cand} c ON d.SQ_CANDIDATO = c.SQ_CANDIDATO
        WHERE d.NM_DOADOR_ORIGINARIO IS NOT NULL
          ${munCond}
        GROUP BY d.NM_DOADOR_ORIGINARIO, d.DS_ORIGEM_RECEITA
        ORDER BY total_doado DESC
        LIMIT ${limite}
      `);
    },
    staleTime: 15 * 60 * 1000,
  });
}

/** Receitas de um candidato específico */
export function useReceitasCandidato(sqCandidato: string | null, ano: number) {
  return useQuery({
    queryKey: ['receitas-candidato', sqCandidato, ano],
    enabled: !!sqCandidato && getAnosDisponiveis('receitas').includes(ano),
    queryFn: async () => {
      const tab = getTableName('receitas', ano);
      return mdQuery(`
        SELECT
          DS_ORIGEM_RECEITA AS origem,
          NM_DOADOR AS doador,
          CAST(REPLACE(CAST(VR_RECEITA AS VARCHAR), ',', '.') AS DOUBLE) AS valor,
          DT_RECEITA AS data
        FROM ${tab}
        WHERE SQ_CANDIDATO = '${sqlSafe(sqCandidato!)}'
        ORDER BY valor DESC
      `);
    },
    staleTime: 15 * 60 * 1000,
  });
}

/** Despesas de um candidato específico */
export function useDespesasCandidato(sqCandidato: string | null, ano: number) {
  return useQuery({
    queryKey: ['despesas-candidato', sqCandidato, ano],
    enabled: !!sqCandidato && getAnosDisponiveis('despesas_pagas').includes(ano),
    queryFn: async () => {
      const tab = getTableName('despesas_pagas', ano);
      return mdQuery(`
        SELECT
          DS_ORIGEM_DESPESA AS origem,
          NM_FORNECEDOR AS fornecedor,
          DS_ESPECIE_RECURSO AS especie,
          CAST(REPLACE(CAST(VR_DESPESA_CONTRATADA AS VARCHAR), ',', '.') AS DOUBLE) AS valor,
          DT_DESPESA AS data
        FROM ${tab}
        WHERE SQ_CANDIDATO = '${sqlSafe(sqCandidato!)}'
        ORDER BY valor DESC
      `);
    },
    staleTime: 15 * 60 * 1000,
  });
}

/** Comparativo financeiro: candidatos com receitas vs votos (scatter) */
export function useCustoVoto(limite = 100) {
  const ano = useFilterStore((s) => s.ano);
  const municipio = useFilterStore((s) => s.municipio);
  const cargo = useFilterStore((s) => s.cargo);

  return useQuery({
    queryKey: ['custo-voto', ano, municipio, cargo, limite],
    queryFn: async () => {
      const finAno = getFinAno(ano, 'receitas');
      if (!finAno) return [];
      const rec = getTableName('receitas', finAno);
      const cand = getTableName('candidatos', finAno);
      const vot = getTableName('votacao', finAno);

      const conds: string[] = ['v.total_votos > 0', 'r.total_receitas > 0'];
      if (municipio) conds.push(`c.NM_UE = '${sqlSafe(municipio)}'`);
      if (cargo) conds.push(`c.DS_CARGO ILIKE '%${sqlSafe(cargo)}%'`);
      const where = `WHERE ${conds.join(' AND ')}`;

      return mdQuery(`
        SELECT
          c.NM_URNA_CANDIDATO AS candidato,
          c.SG_PARTIDO AS partido,
          c.DS_CARGO AS cargo,
          c.DS_SIT_TOT_TURNO AS situacao,
          r.total_receitas,
          v.total_votos,
          ROUND(r.total_receitas / v.total_votos, 2) AS custo_por_voto
        FROM ${cand} c
        INNER JOIN (
          SELECT SQ_CANDIDATO, SUM(CAST(REPLACE(CAST(VR_RECEITA AS VARCHAR), ',', '.') AS DOUBLE)) AS total_receitas
          FROM ${rec} GROUP BY SQ_CANDIDATO
        ) r ON c.SQ_CANDIDATO = r.SQ_CANDIDATO
        INNER JOIN (
          SELECT SQ_CANDIDATO, SUM(QT_VOTOS_NOMINAIS) AS total_votos
          FROM ${vot} GROUP BY SQ_CANDIDATO
        ) v ON c.SQ_CANDIDATO = v.SQ_CANDIDATO
        ${where}
        ORDER BY r.total_receitas DESC
        LIMIT ${limite}
      `);
    },
    staleTime: 15 * 60 * 1000,
  });
}
