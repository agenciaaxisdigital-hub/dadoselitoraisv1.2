import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useFilterStore } from '@/stores/filterStore'

export interface EscolaItem {
  escola: string
  setor: string
  zona: number
  qtd_secoes: number
  total_eleitores: number
}

export function useMvEscolas() {
  const { ano, municipio, zona } = useFilterStore()

  return useQuery<{ status: string; total: number; dados: EscolaItem[] }>({
    queryKey: ['mv_escolas', ano, municipio, zona],
    enabled: !!municipio,
    staleTime: Infinity,
    gcTime: 24 * 60 * 60 * 1000,
    queryFn: async () => {
      let q = supabase
        .from('mv_escolas')
        .select('nm_local, nm_bairro, nr_zona, total_secoes, total_eleitores')
        .eq('ano', ano)
        .eq('municipio_nome', municipio!)
        .order('total_eleitores', { ascending: false })

      if (zona) q = q.eq('nr_zona', zona)

      const { data, error } = await q.limit(500)
      if (error) throw new Error(error.message)

      const dados: EscolaItem[] = (data || []).map(r => ({
        escola: r.nm_local,
        setor: r.nm_bairro ?? '',
        zona: r.nr_zona,
        qtd_secoes: r.total_secoes ?? 0,
        total_eleitores: r.total_eleitores ?? 0,
      }))

      return { status: 'ok', total: dados.length, dados }
    },
  })
}
