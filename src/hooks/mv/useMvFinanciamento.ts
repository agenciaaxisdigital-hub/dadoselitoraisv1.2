import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useFilterStore } from '@/stores/filterStore'

export interface FinanciamentoItem {
  sq_candidato: string
  candidato: string
  partido: string
  cargo: string
  municipio: string
  situacao: string
  total_receitas: number
  total_votos: number
  custo_por_voto: number
}

export function useMvRankingFinanciamento(limite = 100) {
  const { ano, municipio, cargo, partido } = useFilterStore()

  return useQuery<FinanciamentoItem[]>({
    queryKey: ['mv_financeiro_ranking', ano, municipio, cargo, partido, limite],
    queryFn: async () => {
      let q = supabase
        .from('mv_candidatos')
        .select('sq_candidato, nm_urna, sg_partido, ds_cargo, municipio_nome, ds_situacao, total_votos')
        .eq('ano', ano)
      if (municipio) q = q.eq('municipio_nome', municipio)
      if (cargo)     q = q.ilike('ds_cargo', `%${cargo}%`)
      if (partido)   q = q.eq('sg_partido', partido)
      const { data: cands, error: e1 } = await q.limit(5000)
      if (e1) throw new Error(e1.message)
      if (!cands?.length) return []

      const sqs = cands.map(c => c.sq_candidato)
      const batches: string[][] = []
      for (let i = 0; i < sqs.length; i += 500) batches.push(sqs.slice(i, i + 500))

      const finResults = await Promise.all(
        batches.map(batch =>
          supabase
            .from('mv_financeiro')
            .select('sq_candidato, total_receitas')
            .eq('ano', ano)
            .in('sq_candidato', batch),
        ),
      )

      const finMap = new Map<string, number>()
      for (const { data } of finResults) {
        for (const f of data ?? []) finMap.set(f.sq_candidato, Number(f.total_receitas) || 0)
      }

      return cands
        .map(c => ({
          sq_candidato: c.sq_candidato,
          candidato: c.nm_urna,
          partido: c.sg_partido,
          cargo: c.ds_cargo,
          municipio: c.municipio_nome,
          situacao: c.ds_situacao,
          total_receitas: finMap.get(c.sq_candidato) ?? 0,
          total_votos: c.total_votos ?? 0,
          custo_por_voto:
            (c.total_votos ?? 0) > 0
              ? (finMap.get(c.sq_candidato) ?? 0) / (c.total_votos ?? 1)
              : 0,
        }))
        .sort((a, b) => b.total_receitas - a.total_receitas)
        .slice(0, limite)
    },
    staleTime: Infinity,
    gcTime: 24 * 60 * 60 * 1000,
  })
}

export function useMvCustoVoto(limite = 200) {
  const baseQ = useMvRankingFinanciamento(limite * 2)
  return {
    ...baseQ,
    data: (baseQ.data ?? [])
      .filter(r => r.total_votos > 0 && r.total_receitas > 0)
      .sort((a, b) => b.custo_por_voto - a.custo_por_voto)
      .slice(0, limite),
  }
}
