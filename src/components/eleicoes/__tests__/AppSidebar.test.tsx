import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AppSidebar } from '../AppSidebar';
import { SidebarProvider } from '@/components/ui/sidebar';

// Mock useSidebar hook to control state during test
vi.mock('@/components/ui/sidebar', async (importOriginal) => {
  const original = await importOriginal<any>();
  return {
    ...original,
    useSidebar: () => ({
      state: 'expanded',
      isMobile: false,
      setOpenMobile: vi.fn(),
    }),
  };
});

describe('AppSidebar', () => {
  it('renders sidebar navigation items correctly', () => {
    render(
      <BrowserRouter>
        <SidebarProvider>
          <AppSidebar />
        </SidebarProvider>
      </BrowserRouter>
    );

    // Verify main navigation items are rendered
    expect(screen.getByText('Ranking & Resultados')).toBeInTheDocument();
    expect(screen.getByText('Relatório de Votação')).toBeInTheDocument();
    expect(screen.getByText('Perfil de Candidatos')).toBeInTheDocument();
    expect(screen.getByText('Suplentes')).toBeInTheDocument();
    expect(screen.getByText('Financiamento')).toBeInTheDocument();
    
    // Verify territorial items are rendered
    expect(screen.getByText('Força por Zona')).toBeInTheDocument();
    expect(screen.getByText('Zonas Eleitorais')).toBeInTheDocument();
    expect(screen.getByText('Locais de Votação')).toBeInTheDocument();
    expect(screen.getByText('Lideranças de campo')).toBeInTheDocument();
    expect(screen.getByText('Eleitorado')).toBeInTheDocument();
  });
});
