import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useFilterStore } from '@/stores/filterStore'

interface DemografiaItem { name: string; value: number }

interface PerfilEleitorado {
  genero: DemografiaItem[]
  faixaEtaria: DemografiaItem[]
  escolaridade: DemografiaItem[]
  estadoCivil: DemografiaItem[]
  anoReferencia: number
}

export function useMvPerfilEleitorado() {
  const { ano, municipio } = useFilterStore()

  return useQuery<PerfilEleitorado>({
    queryKey: ['mv_eleitorado', ano, municipio],
    enabled: !!municipio,
    staleTime: Infinity,
    gcTime: 24 * 60 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mv_eleitorado')
        .select('tipo, categoria, total')
        .eq('ano', ano)
        .eq('municipio_nome', municipio!)

      if (error) throw new Error(error.message)

      const rows = data ?? []
      const byTipo = (tipo: string): DemografiaItem[] =>
        rows
          .filter(r => r.tipo === tipo)
          .map(r => ({ name: r.categoria, value: r.total }))
          .sort((a, b) => b.value - a.value)

      return {
        genero:      byTipo('genero'),
        faixaEtaria: byTipo('faixa_etaria'),
        escolaridade: byTipo('escolaridade'),
        estadoCivil: byTipo('estado_civil'),
        anoReferencia: ano,
      }
    },
  })
}

export function useMvTotalEleitores() {
  const { ano, municipio } = useFilterStore()

  return useQuery<number>({
    queryKey: ['mv_eleitorado_total', ano, municipio],
    enabled: !!municipio,
    staleTime: Infinity,
    gcTime: 24 * 60 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mv_eleitorado')
        .select('total')
        .eq('ano', ano)
        .eq('municipio_nome', municipio!)
        .eq('tipo', 'genero')

      if (error) throw new Error(error.message)
      return (data ?? []).reduce((sum, r) => sum + (r.total ?? 0), 0)
    },
  })
}
