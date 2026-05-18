import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

export function useMvBens(sqCandidato: string | null, ano: number) {
  return useQuery({
    queryKey: ['mv_bens', sqCandidato, ano],
    enabled: !!sqCandidato,
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60 * 24,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mv_candidato_bens')
        .select('*')
        .eq('sq_candidato', sqCandidato!)
        .eq('ano', ano)
        .order('nr_ordem')
      if (error) throw new Error(error.message)
      return data ?? []
    },
  })
}

export function useMvVotosZona(sqCandidato: string | null, ano: number) {
  return useQuery({
    queryKey: ['mv_votos_zona', sqCandidato, ano],
    enabled: !!sqCandidato,
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60 * 24,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mv_votos_zona')
        .select('*')
        .eq('sq_candidato', sqCandidato!)
        .eq('ano', ano)
        .order('total_votos', { ascending: false })
      if (error) throw new Error(error.message)
      return data ?? []
    },
  })
}

export function useMvFinanceiro(sqCandidato: string | null, ano: number) {
  return useQuery({
    queryKey: ['mv_financeiro', sqCandidato, ano],
    enabled: !!sqCandidato,
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60 * 24,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mv_financeiro')
        .select('*')
        .eq('sq_candidato', sqCandidato!)
        .eq('ano', ano)
        .order('ano')
      if (error) throw new Error(error.message)
      return data?.[0] ?? null
    },
  })
}
