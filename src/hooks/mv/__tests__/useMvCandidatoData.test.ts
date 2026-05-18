import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { useMvBens, useMvVotosZona, useMvFinanceiro } from '../useMvCandidatoData'

// Fábrica de mock para cada chamada from() retornar encadeamento fresco
const makeMockChain = (resolvedValue: unknown) => ({
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  order: vi.fn().mockResolvedValue(resolvedValue),
})

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
  },
}))

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return createElement(QueryClientProvider, { client: qc }, children)
}

describe('useMvBens', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('retorna lista de bens quando sqCandidato fornecido', async () => {
    const { supabase } = await import('@/integrations/supabase/client')
    vi.mocked(supabase.from).mockReturnValue(
      makeMockChain({
        data: [{ sq_candidato: '123', vr_bem: 50000, ds_tipo_bem: 'IMÓVEL', ds_bem: 'Casa', nr_ordem: 1, ano: 2024 }],
        error: null,
      }) as any
    )
    const { result } = renderHook(() => useMvBens('123', 2024), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
    expect(result.current.data![0].ds_tipo_bem).toBe('IMÓVEL')
  })

  it('não executa query quando sqCandidato é null', () => {
    const { result } = renderHook(() => useMvBens(null, 2024), { wrapper })
    expect(result.current.fetchStatus).toBe('idle')
  })
})

describe('useMvVotosZona', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('retorna votos por zona quando sqCandidato fornecido', async () => {
    const { supabase } = await import('@/integrations/supabase/client')
    vi.mocked(supabase.from).mockReturnValue(
      makeMockChain({
        data: [{ sq_candidato: '123', nr_zona: 1, total_votos: 500, municipio_nome: 'APARECIDA DE GOIÂNIA', ano: 2024 }],
        error: null,
      }) as any
    )
    const { result } = renderHook(() => useMvVotosZona('123', 2024), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
    expect(result.current.data![0].nr_zona).toBe(1)
  })
})

describe('useMvFinanceiro', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('retorna totais financeiros quando sqCandidato fornecido', async () => {
    const { supabase } = await import('@/integrations/supabase/client')
    vi.mocked(supabase.from).mockReturnValue(
      makeMockChain({
        data: [{ sq_candidato: '123', total_receitas: 100000, total_despesas: 80000, ano: 2024 }],
        error: null,
      }) as any
    )
    const { result } = renderHook(() => useMvFinanceiro('123', 2024), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.total_receitas).toBe(100000)
  })

  it('retorna null quando não há dados financeiros', async () => {
    const { supabase } = await import('@/integrations/supabase/client')
    vi.mocked(supabase.from).mockReturnValue(
      makeMockChain({ data: [], error: null }) as any
    )
    const { result } = renderHook(() => useMvFinanceiro('123', 2024), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toBeNull()
  })
})
