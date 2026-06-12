import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { useMvSuplentes } from '../useMvSuplentes'

const mockData = [
  {
    sq_candidato: '1001',
    nr_candidato: '22222',
    nm_candidato: 'CANDIDATO SUPLENTE 1',
    nm_urna: 'SUPLENTE 1',
    sg_partido: 'PL',
    ds_cargo: 'VEREADOR',
    municipio_nome: 'GOIÂNIA',
    nr_turno: 1,
    ds_situacao: 'SUPLENTE',
    total_votos: 1200,
  },
  {
    sq_candidato: '1002',
    nr_candidato: '33333',
    nm_candidato: 'CANDIDATO SUPLENTE 2',
    nm_urna: 'SUPLENTE 2',
    sg_partido: 'PT',
    ds_cargo: 'VEREADOR',
    municipio_nome: 'GOIÂNIA',
    nr_turno: 1,
    ds_situacao: 'SUPLENTE',
    total_votos: 900,
  },
  // Item duplicado por turno
  {
    sq_candidato: '1001',
    nr_candidato: '22222',
    nm_candidato: 'CANDIDATO SUPLENTE 1',
    nm_urna: 'SUPLENTE 1',
    sg_partido: 'PL',
    ds_cargo: 'VEREADOR',
    municipio_nome: 'GOIÂNIA',
    nr_turno: 2,
    ds_situacao: 'SUPLENTE',
    total_votos: 1200,
  },
]

const mockQuery = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  ilike: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockResolvedValue({ data: mockData, error: null }),
}

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: vi.fn(() => mockQuery) },
}))

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return createElement(QueryClientProvider, { client: qc }, children)
}

describe('useMvSuplentes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset para retorno padrão
    mockQuery.limit.mockResolvedValue({ data: mockData, error: null })
  })

  it('busca suplentes desduplicados e ordena por votos', async () => {
    const { result } = renderHook(() => useMvSuplentes('GOIÂNIA', 2024), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toHaveLength(2) // Removido duplicado com sq_candidato '1001'
    expect(result.current.data![0].sq).toBe('1001')
    expect(result.current.data![0].nome).toBe('SUPLENTE 1')
    expect(result.current.data![1].sq).toBe('1002')
  })

  it('aplica filtro de partido quando fornecido', async () => {
    const { result } = renderHook(() => useMvSuplentes('GOIÂNIA', 2024, 'PL'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    // Verifica se eq foi chamado com 'sg_partido' e 'PL'
    expect(mockQuery.eq).toHaveBeenCalledWith('sg_partido', 'PL')
  })

  it('retorna array vazio quando Supabase retorna nulo ou vazio', async () => {
    mockQuery.limit.mockResolvedValueOnce({ data: [], error: null })
    const { result } = renderHook(() => useMvSuplentes('GOIÂNIA', 2024), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(0)
  })

  it('trata erros de banco de dados do Supabase', async () => {
    mockQuery.limit.mockResolvedValueOnce({ data: null, error: { message: 'Erro de Banco' } })
    const { result } = renderHook(() => useMvSuplentes('GOIÂNIA', 2024), { wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toBe('Erro de Banco')
  })
})
