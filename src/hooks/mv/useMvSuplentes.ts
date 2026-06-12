import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

export interface SuplementeItem {
  sq: string
  nome: string
  nome_completo: string
  partido: string
  cargo: string
  municipio: string
  numero: string
  total_votos: number
  instagram_url: string | null
}

export function useMvSuplentes(cidade: string, ano: number, partido?: string | null) {
  return useQuery<SuplementeItem[]>({
    queryKey: ['mv_suplentes', ano, cidade, partido],
    enabled: cidade.length >= 2,
    staleTime: Infinity,
    gcTime: 24 * 60 * 60 * 1000,
    queryFn: async () => {
      let q = supabase
        .from('mv_candidatos')
        .select('sq_candidato, nm_urna, nm_candidato, sg_partido, ds_cargo, municipio_nome, nr_candidato, total_votos, ds_situacao')
        .eq('ano', ano)
        .ilike('municipio_nome', cidade)
        .ilike('ds_situacao', '%SUPLENTE%')

      if (partido) {
        q = q.eq('sg_partido', partido.trim().toUpperCase())
      }

      const { data, error } = await q
        .order('ds_cargo')
        .order('total_votos', { ascending: false })
        .limit(300)

      if (error) throw new Error(error.message)

      const uniqueData: any[] = []
      const seen = new Set<string>()
      for (const item of (data ?? [])) {
        if (!seen.has(item.sq_candidato)) {
          seen.add(item.sq_candidato)
          uniqueData.push(item)
        }
      }

      return uniqueData.map(r => ({
        sq: r.sq_candidato,
        nome: r.nm_urna,
        nome_completo: r.nm_candidato,
        partido: r.sg_partido,
        cargo: r.ds_cargo,
        municipio: r.municipio_nome,
        numero: r.nr_candidato,
        total_votos: r.total_votos ?? 0,
        instagram_url: null,
      }))
    },
  })
}

