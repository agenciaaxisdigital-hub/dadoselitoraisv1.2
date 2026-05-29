import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useFilterStore } from '@/stores/filterStore'

export interface CandZona {
  sq_candidato: string
  candidato: string
  partido: string
  cargo: string
  situacao: string
  votos: number
  pct: number
}

export interface ZonaForça {
  zona: number
  total_votos_zona: number
  qt_apto: number
  qt_compareceu: number
  candidatos: CandZona[]
}

export function useMvForcaZona(cargo?: string | null) {
  const { ano, municipio } = useFilterStore()

  return useQuery<ZonaForça[]>({
    queryKey: ['mv_forca_zona', ano, municipio, cargo ?? ''],
    enabled: !!municipio,
    staleTime: Infinity,
    gcTime: 24 * 60 * 60 * 1000,
    queryFn: async () => {
      // 1. Candidatos filtrados por cargo
      let q = supabase
        .from('mv_candidatos')
        .select('sq_candidato, nm_urna, sg_partido, ds_cargo, ds_situacao')
        .eq('ano', ano)
        .eq('municipio_nome', municipio!)
      if (cargo) q = q.ilike('ds_cargo', `%${cargo}%`)

      const { data: cands, error: e1 } = await q.limit(2000)
      if (e1) throw new Error(e1.message)
      if (!cands?.length) return []

      const candMap = new Map(cands.map((c: any) => [String(c.sq_candidato), c]))
      const sqs = cands.map((c: any) => c.sq_candidato)

      // 2. Votos por zona
      const batches: string[][] = []
      for (let i = 0; i < sqs.length; i += 500) batches.push(sqs.slice(i, i + 500))

      const zonaResults = await Promise.all(
        batches.map(batch =>
          supabase
            .from('mv_votos_zona')
            .select('sq_candidato, nr_zona, total_votos')
            .eq('ano', ano)
            .in('sq_candidato', batch)
        )
      )

      // 3. Comparecimento por zona
      const { data: turnout } = await supabase
        .from('mv_comparecimento_zona')
        .select('nr_zona, qt_apto, qt_compareceu')
        .eq('ano', ano)
        .ilike('municipio_nome', municipio!)

      const turnoutMap = new Map(
        (turnout ?? []).map((t: any) => [Number(t.nr_zona), t])
      )

      // 4. Agrupa por zona
      const zonaMap = new Map<number, { total: number; cands: Map<string, number> }>()
      for (const { data } of zonaResults) {
        for (const v of data ?? []) {
          const zona = Number(v.nr_zona)
          if (!zonaMap.has(zona)) zonaMap.set(zona, { total: 0, cands: new Map() })
          const entry = zonaMap.get(zona)!
          const votos = Number(v.total_votos)
          entry.total += votos
          const sq = String(v.sq_candidato)
          entry.cands.set(sq, (entry.cands.get(sq) ?? 0) + votos)
        }
      }

      // 5. Monta resultado
      return Array.from(zonaMap.entries())
        .map(([zona, { total, cands: candVotos }]) => {
          const t = turnoutMap.get(zona)
          const candidatos: CandZona[] = Array.from(candVotos.entries())
            .map(([sq, votos]) => {
              const c = candMap.get(sq) as any
              return {
                sq_candidato: sq,
                candidato: c?.nm_urna ?? sq,
                partido: c?.sg_partido ?? '—',
                cargo: c?.ds_cargo ?? '',
                situacao: c?.ds_situacao ?? '',
                votos,
                pct: total > 0 ? (votos / total) * 100 : 0,
              }
            })
            .sort((a, b) => b.votos - a.votos)
            .slice(0, 50)

          return {
            zona,
            total_votos_zona: total,
            qt_apto: Number(t?.qt_apto ?? 0),
            qt_compareceu: Number(t?.qt_compareceu ?? 0),
            candidatos,
          }
        })
        .sort((a, b) => a.zona - b.zona)
    },
  })
}
