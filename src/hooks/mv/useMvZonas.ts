import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

// ─── Types (mirrors ZonasEleitorais internal types) ───────────────────────────

export interface CandidatoOption {
  sq_candidato: string
  candidato: string
  nome_completo: string
  partido: string
  cargo: string
  numero: number
  ano: number
  municipio: string
}

export interface ComparativoCandidatoMv {
  sq: string
  label: string
}

// Row shape: { zona: number; votos_0: number; votos_1: number; ... }
export type ComparativoZonaRow = { zona: number; [key: `votos_${number}`]: number }

// ─── useMvBuscarCandidatos ─────────────────────────────────────────────────────
/**
 * Busca candidatos em mv_candidatos por nm_urna ILIKE '%search%' e ano.
 * Retorna no mesmo formato que useBuscarCandidatos (CandidatoOption[]).
 */
export function useMvBuscarCandidatos(search: string, ano: number) {
  return useQuery<CandidatoOption[]>({
    queryKey: ['mv_buscar_candidatos', search, ano],
    queryFn: async () => {
      if (!search || search.length < 3) return []

      const { data, error } = await supabase
        .from('mv_candidatos')
        .select('sq_candidato, nm_urna, nm_candidato, sg_partido, ds_cargo, nr_candidato, municipio_nome, ano')
        .ilike('nm_urna', `%${search}%`)
        .eq('ano', ano)
        .order('nm_urna', { ascending: true })
        .limit(80)

      if (error) throw new Error(error.message)

      return (data ?? []).map((r: any): CandidatoOption => ({
        sq_candidato: String(r.sq_candidato),
        candidato: r.nm_urna,
        nome_completo: r.nm_candidato,
        partido: r.sg_partido,
        cargo: r.ds_cargo,
        numero: Number(r.nr_candidato),
        ano: r.ano,
        municipio: r.municipio_nome,
      }))
    },
    enabled: search.length >= 3 && !!ano,
    staleTime: Infinity,
  })
}

// ─── useMvComparativoZona ──────────────────────────────────────────────────────
/**
 * Busca mv_votos_zona para os sq_candidatos fornecidos, pivotando para o formato
 * esperado pela tabela de comparativo: { zona: number; votos_0: number; votos_1: number; ... }
 */
export function useMvComparativoZona(
  candidatos: ComparativoCandidatoMv[],
  ano: number,
  municipio: string
) {
  const sqList = candidatos.map(c => c.sq)

  return useQuery<ComparativoZonaRow[]>({
    queryKey: ['mv_comparativo_zona', sqList, ano, municipio],
    queryFn: async () => {
      if (candidatos.length === 0 || !municipio) return []

      const { data, error } = await supabase
        .from('mv_votos_zona')
        .select('sq_candidato, nr_zona, total_votos')
        .eq('ano', ano)
        .eq('municipio_nome', municipio)
        .in('sq_candidato', sqList)

      if (error) throw new Error(error.message)

      // Pivot: zona → { votos_0, votos_1, ... } indexed by candidatos array position
      const map = new Map<number, ComparativoZonaRow>()

      for (const r of data ?? []) {
        const idx = candidatos.findIndex(c => c.sq === String(r.sq_candidato))
        if (idx === -1) continue
        const zona = Number(r.nr_zona)
        if (!map.has(zona)) map.set(zona, { zona })
        const entry = map.get(zona)!
        ;(entry as any)[`votos_${idx}`] = Number(r.total_votos)
      }

      return Array.from(map.values()).sort((a, b) => a.zona - b.zona)
    },
    enabled: candidatos.length > 0 && !!municipio && !!ano,
    staleTime: Infinity,
  })
}
