/**
 * Hooks rápidos para Dashboard — queries diretas ao Supabase mv_*
 * Substituem: usePainelGeral, useKPIs, useComparecimento, useVotosRegional
 * Latência: ~150ms vs 2–8s do MotherDuck (sem cold start de edge function)
 */
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useFilterStore } from '@/stores/filterStore';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PainelRow {
  sq_candidato: string;
  candidato: string;
  nome_completo: string;
  partido: string;
  cargo: string;
  municipio: string;
  situacao: string;
  genero: string;
  numero: string;
  total_votos: number;
  votos_turno1: number;
  votos_turno2: number;
  patrimonio_total: number;
  tem_segundo_turno: boolean;
}

// ─── useMvPainelGeral ────────────────────────────────────────────────────────
// Substitui usePainelGeral (useEleicoes.ts) — mesma forma de retorno.
// Elimina 1 round-trip ao MotherDuck (~2–6s).

export function useMvPainelGeral(limite = 200) {
  const { ano, municipio, cargo, partido, turno, zona, searchText } = useFilterStore();

  return useQuery<PainelRow[]>({
    queryKey: ['mv_painelGeral', ano, municipio, cargo, partido, turno, zona, searchText, limite],
    queryFn: async () => {
      // Zona filter: busca candidatos com votos nessa zona primeiro
      let sqFilter: string[] | null = null;
      if (zona) {
        const { data: zonaData } = await supabase
          .from('mv_votos_zona')
          .select('sq_candidato')
          .eq('ano', ano)
          .eq('nr_zona', zona);
        sqFilter = (zonaData ?? []).map((r: any) => r.sq_candidato);
        if (sqFilter.length === 0) return [];
      }

      let q = supabase
        .from('mv_candidatos')
        .select(
          'sq_candidato, nm_urna, nm_candidato, sg_partido, ds_cargo, municipio_nome, ' +
          'nr_candidato, total_votos, votos_turno1, votos_turno2, ds_situacao, ds_genero, ' +
          'patrimonio_total, tem_segundo_turno'
        )
        .eq('ano', ano);

      if (municipio)  q = q.eq('municipio_nome', municipio);
      if (cargo)      q = q.ilike('ds_cargo', `%${cargo}%`);
      if (partido)    q = q.eq('sg_partido', partido);
      if (turno)      q = q.eq('nr_turno', turno);
      if (searchText) q = q.ilike('nm_urna', `%${searchText}%`);
      if (sqFilter)   q = q.in('sq_candidato', sqFilter);

      const { data, error } = await q
        .order('total_votos', { ascending: false })
        .limit(limite);

      if (error) throw new Error(error.message);

      const uniqueData: any[] = []
      const seen = new Set<string>()
      for (const item of (data ?? [])) {
        if (!seen.has(item.sq_candidato)) {
          seen.add(item.sq_candidato)
          uniqueData.push(item)
        }
      }

      return uniqueData.map((r: any): PainelRow => ({
        sq_candidato:     String(r.sq_candidato),
        candidato:        r.nm_urna ?? '',
        nome_completo:    r.nm_candidato ?? '',
        partido:          r.sg_partido ?? '',
        cargo:            r.ds_cargo ?? '',
        municipio:        r.municipio_nome ?? '',
        situacao:         r.ds_situacao ?? '',
        genero:           r.ds_genero ?? '',
        numero:           r.nr_candidato ?? '',
        total_votos:      Number(r.total_votos ?? 0),
        votos_turno1:     Number(r.votos_turno1 ?? 0),
        votos_turno2:     Number(r.votos_turno2 ?? 0),
        patrimonio_total: Number(r.patrimonio_total ?? 0),
        tem_segundo_turno: Boolean(r.tem_segundo_turno),
      }));
    },
    placeholderData: keepPreviousData,
    staleTime: Infinity,
    gcTime: 24 * 60 * 60 * 1000,
  });
}

// ─── useMvComparecimento ─────────────────────────────────────────────────────
// Agrega mv_comparecimento_zona por município.
// Retorna [{ eleitores, comparecimento, abstencoes, taxa_comparecimento }]
// — mesma forma usada por Dashboard.tsx (comp[0].comparecimento / comp[0].taxa_comparecimento).

export function useMvComparecimento() {
  const { ano, municipio } = useFilterStore();

  return useQuery({
    queryKey: ['mv_comparecimento', ano, municipio],
    queryFn: async () => {
      if (!municipio) return [];

      const { data, error } = await supabase
        .from('mv_comparecimento_zona')
        .select('qt_apto, qt_compareceu, qt_abstencao')
        .eq('ano', ano)
        .ilike('municipio_nome', municipio);

      if (error) throw new Error(error.message);

      const totals = (data ?? []).reduce(
        (acc, r: any) => ({
          aptos: acc.aptos + Number(r.qt_apto ?? 0),
          comp:  acc.comp  + Number(r.qt_compareceu ?? 0),
          abst:  acc.abst  + Number(r.qt_abstencao ?? 0),
        }),
        { aptos: 0, comp: 0, abst: 0 }
      );

      if (totals.aptos === 0) return [];

      return [{
        eleitores:           totals.aptos,
        comparecimento:      totals.comp,
        abstencoes:          totals.abst,
        taxa_comparecimento: (totals.comp / totals.aptos) * 100,
      }];
    },
    staleTime: Infinity,
    gcTime: 24 * 60 * 60 * 1000,
  });
}

// ─── useMvVotosRegional ──────────────────────────────────────────────────────
// Comparecimento por zona — compatível com VotosRegionalTable ({ zona, total_votos }).

export function useMvVotosRegional() {
  const { ano, municipio } = useFilterStore();

  return useQuery({
    queryKey: ['mv_votosRegional', ano, municipio],
    queryFn: async () => {
      if (!municipio) return [];

      const { data, error } = await supabase
        .from('mv_comparecimento_zona')
        .select('nr_zona, qt_compareceu')
        .eq('ano', ano)
        .ilike('municipio_nome', municipio)
        .order('qt_compareceu', { ascending: false });

      if (error) throw new Error(error.message);

      return (data ?? []).map((r: any) => ({
        zona:        r.nr_zona,
        total_votos: Number(r.qt_compareceu ?? 0),
      }));
    },
    staleTime: Infinity,
    gcTime: 24 * 60 * 60 * 1000,
  });
}
