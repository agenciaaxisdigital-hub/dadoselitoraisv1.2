import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

// ---------------------------------------------------------------------------
// useMvCidadeKPIs
// ---------------------------------------------------------------------------
export function useMvCidadeKPIs(municipio: string, ano: number) {
  return useQuery({
    queryKey: ['mv_cidadeKPIs', municipio, ano],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mv_candidatos')
        .select('ds_situacao, ds_genero, sg_partido, ds_cargo')
        .eq('municipio_nome', municipio)
        .eq('ano', ano)

      if (error) throw error

      const rows = data ?? []

      const totalCandidatos = rows.length

      const eleitos = rows.filter(
        r =>
          r.ds_situacao?.toUpperCase().includes('ELEITO') &&
          !r.ds_situacao?.toUpperCase().includes('NÃO ELEITO')
      ).length

      const mulheres = rows.filter(
        r => r.ds_genero?.toUpperCase() === 'FEMININO'
      ).length

      const partidos = new Set(rows.map(r => r.sg_partido).filter(Boolean)).size

      const cargos = new Set(rows.map(r => r.ds_cargo).filter(Boolean)).size

      return { totalCandidatos, eleitos, mulheres, partidos, cargos }
    },
    enabled: !!municipio,
    staleTime: Infinity,
    gcTime: 24 * 60 * 60 * 1000,
  })
}

// ---------------------------------------------------------------------------
// useMvTopVotadosCidade
// ---------------------------------------------------------------------------
export function useMvTopVotadosCidade(
  municipio: string,
  ano: number,
  cargo?: string
) {
  return useQuery({
    queryKey: ['mv_topVotadosCidade', municipio, ano, cargo ?? null],
    queryFn: async () => {
      let query = supabase
        .from('mv_candidatos')
        .select('nm_urna, sg_partido, ds_cargo, nr_candidato, total_votos')
        .eq('municipio_nome', municipio)
        .eq('ano', ano)
        .order('total_votos', { ascending: false })
        .limit(20)

      if (cargo) {
        query = query.ilike('ds_cargo', `%${cargo}%`)
      }

      const { data, error } = await query

      if (error) throw error

      return (data ?? []).map(r => ({
        nome: r.nm_urna,
        partido: r.sg_partido,
        cargo: r.ds_cargo,
        numero: r.nr_candidato,
        votos: Number(r.total_votos ?? 0),
      }))
    },
    enabled: !!municipio,
    staleTime: Infinity,
    gcTime: 24 * 60 * 60 * 1000,
  })
}

// ---------------------------------------------------------------------------
// useMvPartidosCidade
// ---------------------------------------------------------------------------
export function useMvPartidosCidade(municipio: string, ano: number) {
  return useQuery({
    queryKey: ['mv_partidosCidade', municipio, ano],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mv_candidatos')
        .select('sg_partido, ds_situacao, ds_genero')
        .eq('municipio_nome', municipio)
        .eq('ano', ano)

      if (error) throw error

      const rows = data ?? []

      const map = new Map<
        string,
        { partido: string; candidatos: number; eleitos: number; mulheres: number }
      >()

      for (const r of rows) {
        const key = r.sg_partido ?? 'N/I'
        if (!map.has(key)) {
          map.set(key, { partido: key, candidatos: 0, eleitos: 0, mulheres: 0 })
        }
        const entry = map.get(key)!
        entry.candidatos++

        if (
          r.ds_situacao?.toUpperCase().includes('ELEITO') &&
          !r.ds_situacao?.toUpperCase().includes('NÃO ELEITO')
        ) {
          entry.eleitos++
        }

        if (r.ds_genero?.toUpperCase() === 'FEMININO') {
          entry.mulheres++
        }
      }

      return Array.from(map.values()).sort(
        (a, b) => b.candidatos - a.candidatos
      )
    },
    enabled: !!municipio,
    staleTime: Infinity,
    gcTime: 24 * 60 * 60 * 1000,
  })
}

// ---------------------------------------------------------------------------
// useMvCandidatosPatrimonio
// ---------------------------------------------------------------------------
export function useMvCandidatosPatrimonio(municipio: string, ano: number) {
  return useQuery({
    queryKey: ['mv_candidatosPatrimonio', municipio, ano],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mv_candidatos')
        .select(
          'sq_candidato, nm_urna, sg_partido, ds_cargo, ds_situacao, ds_genero, nr_candidato, patrimonio_total, total_votos'
        )
        .eq('municipio_nome', municipio)
        .eq('ano', ano)
        .order('patrimonio_total', { ascending: false })

      if (error) throw error

      return (data ?? []).map(r => ({
        id: r.sq_candidato,
        nome_urna: r.nm_urna,
        sigla_partido: r.sg_partido,
        cargo: r.ds_cargo,
        situacao_final: r.ds_situacao,
        genero: r.ds_genero,
        numero_urna: r.nr_candidato,
        patrimonio: Number(r.patrimonio_total ?? 0),
        votos: Number(r.total_votos ?? 0),
      }))
    },
    enabled: !!municipio,
    staleTime: Infinity,
    gcTime: 24 * 60 * 60 * 1000,
  })
}
