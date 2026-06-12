/**
 * Hooks rápidos para RelatorioVotacao — queries diretas ao Supabase mv_*
 * Substituem: useRankingPartidos, useVotosBrancosNulos, useDistribuicaoGenero,
 *             useVotacaoPorZona, useSituacaoFinal
 *
 * Estratégia: os 5 hooks de candidatos compartilham UMA query via React Query
 * select-transform. Zero custo extra: só 1 fetch mesmo com 5 hooks na página.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useFilterStore } from '@/stores/filterStore';

// ─── Base query compartilhada ─────────────────────────────────────────────────

interface CandBase {
  sg_partido: string;
  ds_situacao: string;
  ds_genero: string;
  total_votos: number;
}

async function fetchBase(ano: number, municipio: string): Promise<CandBase[]> {
  const { data, error } = await supabase
    .from('mv_candidatos')
    .select('sq_candidato, sg_partido, ds_situacao, ds_genero, total_votos')
    .eq('ano', ano)
    .eq('municipio_nome', municipio);

  if (error) throw new Error(error.message);

  const uniqueData: any[] = []
  const seen = new Set<string>()
  for (const item of (data ?? [])) {
    if (!seen.has(item.sq_candidato)) {
      seen.add(item.sq_candidato)
      uniqueData.push(item)
    }
  }

  return uniqueData.map((r: any) => ({
    sg_partido:  r.sg_partido  ?? 'N/A',
    ds_situacao: r.ds_situacao ?? '',
    ds_genero:   r.ds_genero   ?? '',
    total_votos: Number(r.total_votos ?? 0),
  }));
}

function baseKey(ano: number, municipio: string) {
  return ['mv_relatorio_base', ano, municipio] as const;
}

// ─── useMvRankingPartidos ────────────────────────────────────────────────────
// Retorna [{ partido, nome_partido, votos_nominais, votos_legenda }]
// compatível com partidos.data em RelatorioVotacao.tsx

export function useMvRankingPartidos(limite = 30) {
  const { ano, municipio } = useFilterStore();

  return useQuery({
    queryKey: baseKey(ano, municipio),
    queryFn:  () => fetchBase(ano, municipio),
    select: (data) => {
      const map = new Map<string, number>();
      for (const r of data) {
        map.set(r.sg_partido, (map.get(r.sg_partido) ?? 0) + r.total_votos);
      }
      return Array.from(map.entries())
        .map(([partido, votos]) => ({
          partido,
          nome_partido:   partido,
          votos_nominais: votos,
          votos_legenda:  0,
        }))
        .sort((a, b) => b.votos_nominais - a.votos_nominais)
        .slice(0, limite);
    },
    staleTime: Infinity,
    gcTime: 24 * 60 * 60 * 1000,
  });
}

// ─── useMvDistribuicaoGenero ─────────────────────────────────────────────────
// Retorna [{ genero, total }]

export function useMvDistribuicaoGenero() {
  const { ano, municipio } = useFilterStore();

  return useQuery({
    queryKey: baseKey(ano, municipio),
    queryFn:  () => fetchBase(ano, municipio),
    select: (data) => {
      const map = new Map<string, number>();
      for (const r of data) {
        const g = r.ds_genero || 'NÃO INFORMADO';
        map.set(g, (map.get(g) ?? 0) + 1);
      }
      return Array.from(map.entries())
        .map(([genero, total]) => ({ genero, total }))
        .sort((a, b) => b.total - a.total);
    },
    staleTime: Infinity,
    gcTime: 24 * 60 * 60 * 1000,
  });
}

// ─── useMvSituacaoFinal ───────────────────────────────────────────────────────
// Retorna [{ nome, total }]

export function useMvSituacaoFinal() {
  const { ano, municipio } = useFilterStore();

  return useQuery({
    queryKey: baseKey(ano, municipio),
    queryFn:  () => fetchBase(ano, municipio),
    select: (data) => {
      const map = new Map<string, number>();
      for (const r of data) {
        const s = r.ds_situacao || 'NÃO INFORMADO';
        map.set(s, (map.get(s) ?? 0) + 1);
      }
      return Array.from(map.entries())
        .map(([nome, total]) => ({ nome, total }))
        .sort((a, b) => b.total - a.total);
    },
    staleTime: Infinity,
    gcTime: 24 * 60 * 60 * 1000,
  });
}

// ─── useMvVotacaoPorZona ─────────────────────────────────────────────────────
// Retorna [{ zona, apto, comp, abst }] — compatível com zonas.data

export function useMvVotacaoPorZona(municipio?: string) {
  const { ano, municipio: munStore } = useFilterStore();
  const mun = municipio || munStore;

  return useQuery({
    queryKey: ['mv_zonaComparecimento', ano, mun],
    enabled: !!mun,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mv_comparecimento_zona')
        .select('nr_zona, qt_apto, qt_compareceu, qt_abstencao')
        .eq('ano', ano)
        .ilike('municipio_nome', mun!)
        .order('nr_zona');

      if (error) throw new Error(error.message);

      return (data ?? []).map((r: any) => ({
        zona: r.nr_zona,
        apto: Number(r.qt_apto      ?? 0),
        comp: Number(r.qt_compareceu ?? 0),
        abst: Number(r.qt_abstencao  ?? 0),
      }));
    },
    staleTime: Infinity,
    gcTime: 24 * 60 * 60 * 1000,
  });
}

// ─── useMvVotosBrancosNulos ──────────────────────────────────────────────────
// Retorna [{ brancos, nulos, pctBrancos, pctNulos }] — compatível com bnStats

export function useMvVotosBrancosNulos() {
  const { ano, municipio } = useFilterStore();

  return useQuery({
    queryKey: ['mv_brancosNulos', ano, municipio],
    enabled: !!municipio,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mv_comparecimento_zona')
        .select('qt_compareceu, qt_brancos, qt_nulos')
        .eq('ano', ano)
        .ilike('municipio_nome', municipio);

      if (error) throw new Error(error.message);

      const totals = (data ?? []).reduce(
        (acc, r: any) => ({
          comp:    acc.comp    + Number(r.qt_compareceu ?? 0),
          brancos: acc.brancos + Number(r.qt_brancos    ?? 0),
          nulos:   acc.nulos   + Number(r.qt_nulos      ?? 0),
        }),
        { comp: 0, brancos: 0, nulos: 0 }
      );

      if (totals.comp === 0) return [];

      return [{
        brancos:    totals.brancos,
        nulos:      totals.nulos,
        pctBrancos: (totals.brancos / totals.comp) * 100,
        pctNulos:   (totals.nulos   / totals.comp) * 100,
      }];
    },
    staleTime: Infinity,
    gcTime: 24 * 60 * 60 * 1000,
  });
}
