import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useFilterStore } from '@/stores/filterStore'
import type { RankingItem } from '@/hooks/useRanking'

export function useMvRanking() {
  const { ano, municipio, cargo, partido, turno, zona, searchText } = useFilterStore()

  return useQuery<RankingItem[]>({
    queryKey: ['mv_ranking', ano, municipio, cargo, partido, turno, zona, searchText],
    queryFn: async () => {
      // Quando zona filter ativo: busca sq_candidatos com votos nessa zona
      let sqFilter: string[] | null = null
      if (zona) {
        const { data: zonaData, error: zonaErr } = await supabase
          .from('mv_votos_zona')
          .select('sq_candidato')
          .eq('ano', ano)
          .eq('nr_zona', zona)
        if (zonaErr) throw new Error(zonaErr.message)
        sqFilter = (zonaData ?? []).map((r: any) => r.sq_candidato)
        if (sqFilter.length === 0) return []
      }

      let q = supabase
        .from('mv_candidatos')
        .select('*')
        .eq('ano', ano)
        .eq('municipio_nome', municipio)

      if (cargo)      q = q.ilike('ds_cargo', cargo.trim())
      if (partido)    q = q.eq('sg_partido', partido.trim().toUpperCase())
      if (turno)      q = q.eq('nr_turno', turno)
      if (searchText) q = q.ilike('nm_urna', `%${searchText}%`)
      if (sqFilter)   q = q.in('sq_candidato', sqFilter)

      const { data, error } = await q.order('total_votos', { ascending: false })
      if (error) throw new Error(error.message)

      const uniqueData: any[] = []
      const seen = new Set<string>()
      for (const item of (data ?? [])) {
        if (!seen.has(item.sq_candidato)) {
          seen.add(item.sq_candidato)
          uniqueData.push(item)
        }
      }

      return uniqueData.map((r: any): RankingItem => ({
        SQ_CANDIDATO:      String(r.sq_candidato),
        NM_CANDIDATO:      r.nm_candidato,
        NM_URNA_CANDIDATO: r.nm_urna,
        SG_PARTIDO:        r.sg_partido,
        DS_CARGO:          r.ds_cargo,
        NM_UE:             r.municipio_nome,
        DS_SIT_TOT_TURNO:  r.ds_situacao ?? '',
        DS_GENERO:         r.ds_genero ?? '',
        total_votos:       Number(r.total_votos || 0),
        votos_turno1:      Number(r.votos_turno1 || 0),
        votos_turno2:      Number(r.votos_turno2 || 0),
        patrimonio_total:  Number(r.patrimonio_total || 0),
        tem_segundo_turno: Boolean(r.tem_segundo_turno),
      }))
    },
    placeholderData: keepPreviousData,
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60 * 24,
  })
}
