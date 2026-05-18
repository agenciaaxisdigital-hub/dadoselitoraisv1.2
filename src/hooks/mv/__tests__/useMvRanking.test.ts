import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { useMvRanking } from '../useMvRanking'

const mockData = [
  {
    sq_candidato: '123',
    nr_candidato: '11111',
    nm_candidato: 'FULANO DA SILVA',
    nm_urna: 'FULANO SILVA',
    sg_partido: 'PT',
    ds_cargo: 'VEREADOR',
    municipio_nome: 'APARECIDA DE GOIÂNIA',
    nr_turno: 1,
    ds_situacao: 'ELEITO',
    ds_genero: 'MASCULINO',
    ds_grau_instrucao: 'SUPERIOR COMPLETO',
    ds_ocupacao: 'VEREADOR',
    total_votos: 1500,
    votos_turno1: 1500,
    votos_turno2: 0,
    patrimonio_total: 50000,
    tem_segundo_turno: false,
  },
]

// Mock supabase — retorna encadeamento fluente
const mockQuery = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  ilike: vi.fn().mockReturnThis(),
  in: vi.fn().mockReturnThis(),
  order: vi.fn().mockResolvedValue({ data: mockData, error: null }),
}

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: vi.fn(() => mockQuery) },
}))

vi.mock('@/stores/filterStore', () => ({
  useFilterStore: () => ({
    ano: 2024,
    municipio: 'APARECIDA DE GOIÂNIA',
    cargo: 'VEREADOR',
    partido: null,
    turno: null,
    zona: null,
    searchText: '',
  }),
}))

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return createElement(QueryClientProvider, { client: qc }, children)
}

describe('useMvRanking', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('retorna candidatos mapeados para RankingItem', async () => {
    const { result } = renderHook(() => useMvRanking(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
    expect(result.current.data![0].NM_URNA_CANDIDATO).toBe('FULANO SILVA')
    expect(result.current.data![0].total_votos).toBe(1500)
    expect(result.current.data![0].SQ_CANDIDATO).toBe('123')
  })

  it('retorna array vazio quando Supabase retorna data: []', async () => {
    mockQuery.order.mockResolvedValueOnce({ data: [], error: null })
    const { result } = renderHook(() => useMvRanking(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(0)
  })

  it('lança erro quando Supabase retorna error', async () => {
    mockQuery.order.mockResolvedValueOnce({ data: null, error: { message: 'DB error' } })
    const { result } = renderHook(() => useMvRanking(), { wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toBe('DB error')
  })
})
