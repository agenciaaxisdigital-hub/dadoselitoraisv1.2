import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface SuplenteEntry {
  sq: string;
  nome: string;
  nomeUrna: string;
  partido: string;
  cargo: string;
  municipio: string;
  numero: string | number;
  situacao: string;
  ano: number;
  instagramUrl: string;
  observacao: string;
  marcadoEm: string;
}

interface SuplentesStore {
  suplentes: Record<string, SuplenteEntry>;
  marcar: (entry: Omit<SuplenteEntry, 'instagramUrl' | 'observacao' | 'marcadoEm'> & { instagramUrl?: string }) => void;
  desmarcar: (sq: string) => void;
  setObservacao: (sq: string, obs: string) => void;
}

export const useSuplentesStore = create<SuplentesStore>()(
  persist(
    (set) => ({
      suplentes: {},
      marcar: (entry) =>
        set((state) => ({
          suplentes: {
            ...state.suplentes,
            [entry.sq]: {
              ...entry,
              instagramUrl: entry.instagramUrl ?? state.suplentes[entry.sq]?.instagramUrl ?? '',
              observacao: state.suplentes[entry.sq]?.observacao ?? '',
              marcadoEm: state.suplentes[entry.sq]?.marcadoEm ?? new Date().toISOString(),
            },
          },
        })),
      desmarcar: (sq) =>
        set((state) => {
          const next = { ...state.suplentes };
          delete next[sq];
          return { suplentes: next };
        }),
      setObservacao: (sq, obs) =>
        set((state) => ({
          suplentes: { ...state.suplentes, [sq]: { ...state.suplentes[sq], observacao: obs } },
        })),
    }),
    { name: 'eleicoes-suplentes' }
  )
);
