import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMvPainelGeral, useMvComparecimento, useMvVotosRegional } from '@/hooks/mv/useMvDashboard';
import { useFilterStore } from '@/stores/filterStore';
import { KPICard, MiniBar, PartyBadge } from '@/components/eleicoes/VisualKit';
import { formatNumber, formatPercent } from '@/lib/eleicoes';
import { exportToCSV } from '@/lib/export';
import { SituacaoBadge } from '@/components/eleicoes/SituacaoBadge';
import { GeoFilterBadge } from '@/components/eleicoes/GeoFilterBadge';
import { VotosRegionalTable } from '@/components/eleicoes/VotosRegionalTable';
import { CandidatoCard } from '@/components/eleicoes/CandidatoCard';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Users, Vote, XCircle, BarChart3,
  ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
  Download,
} from 'lucide-react';
import { cn } from '@/lib/utils';

function KPISkeleton4() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="bg-card rounded-lg border border-border/40 p-4 flex items-start gap-3">
          <Skeleton className="w-10 h-10 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-7 w-24" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

// Competitivity score badge

function CompetitividadeBadge({ totalCandidatos }: { totalCandidatos: number }) {
  if (!totalCandidatos) return null;

  let label: string;
  let cls: string;

  if (totalCandidatos > 100) {
    label = 'Alta Disputa';
    cls = 'bg-red-500/15 text-red-600 border-red-300/40';
  } else if (totalCandidatos >= 50) {
    label = 'Moderada';
    cls = 'bg-yellow-500/15 text-yellow-700 border-yellow-300/40';
  } else {
    label = 'Baixa';
    cls = 'bg-green-500/15 text-green-700 border-green-300/40';
  }

  return (
    <Badge
      variant="outline"
      className={cn('text-[10px] h-5 px-2 font-semibold border', cls)}
    >
      {label}
    </Badge>
  );
}

// Sort types

type SortKey = 'total_votos' | 'candidato' | 'partido';
type CargoTab = 'Todos' | 'Prefeito' | 'Vereador';

const PAGE_SIZE = 30;

export default function Dashboard() {
  const navigate = useNavigate();
  const { ano, municipio } = useFilterStore();
  const { data: painel, isLoading: loadingPainel, isFetching: fetchingPainel } = useMvPainelGeral(200);
  const { data: comparecimento } = useMvComparecimento();
  const { data: votosRegional, isLoading: loadingRegional } = useMvVotosRegional();

  const [sortKey, setSortKey] = useState<SortKey>('total_votos');
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(0);
  const [cargoTab, setCargoTab] = useState<CargoTab>('Todos');

  const comp = comparecimento?.[0] as any;

  // KPIs derivados do painel — zero query extra
  const kpis = useMemo(() => {
    if (!painel?.length) return null;
    const total = painel.length;
    const eleitos = painel.filter(r => {
      const s = (r.situacao ?? '').toUpperCase();
      return s.includes('ELEITO') && !s.includes('NÃO');
    }).length;
    const mulheres = painel.filter(r => (r.genero ?? '').toUpperCase() === 'FEMININO').length;
    const partidos = new Set(painel.map(r => r.partido).filter(Boolean)).size;
    return {
      totalCandidatos: total,
      totalEleitos: eleitos,
      totalMulheres: mulheres,
      pctMulheres: total > 0 ? (mulheres / total) * 100 : 0,
      totalPartidos: partidos,
      totalMunicipios: 1,
    };
  }, [painel]);

  const loadingKpis = loadingPainel;

  const votosValidos = useMemo(() => {
    if (!painel) return 0;
    return painel.reduce((sum: number, r: any) => sum + Number(r.total_votos || 0), 0);
  }, [painel]);

  // Sort all data
  const sorted = useMemo(() => {
    if (!painel) return [];
    const arr = [...painel];
    arr.sort((a: any, b: any) => {
      let va: any, vb: any;
      if (sortKey === 'total_votos') { va = Number(a.total_votos || 0); vb = Number(b.total_votos || 0); }
      else if (sortKey === 'candidato') { va = a.candidato || ''; vb = b.candidato || ''; }
      else { va = a.partido || ''; vb = b.partido || ''; }
      if (typeof va === 'string') return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
      return sortAsc ? va - vb : vb - va;
    });
    return arr;
  }, [painel, sortKey, sortAsc]);

  // Filter by cargo tab (local state only — does not affect filterStore)
  const filteredByCargo = useMemo(() => {
    if (cargoTab === 'Todos') return sorted;
    return sorted.filter((r: any) =>
      r.cargo?.toUpperCase()?.includes(cargoTab.toUpperCase())
    );
  }, [sorted, cargoTab]);

  const totalPages = Math.ceil(filteredByCargo.length / PAGE_SIZE);
  const pageData = filteredByCargo.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(key !== 'total_votos'); }
    setPage(0);
  }

  function handleCargoTab(tab: CargoTab) {
    setCargoTab(tab);
    setPage(0);
  }

  function handleExportCSV() {
    exportToCSV(
      sorted.map(r => ({
        'Posição': sorted.indexOf(r) + 1,
        Candidato: (r as any).candidato || '',
        Número: (r as any).numero || '',
        Partido: (r as any).partido || '',
        Cargo: (r as any).cargo || '',
        Município: (r as any).municipio || '',
        Votos: (r as any).total_votos || 0,
        Situação: (r as any).situacao || '',
      })),
      'ranking-candidatos'
    );
  }

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return null;
    return sortAsc
      ? <ChevronUp className="w-3 h-3 inline ml-0.5" />
      : <ChevronDown className="w-3 h-3 inline ml-0.5" />;
  };

  return (
    <div className="max-w-[1800px] mx-auto space-y-4">
      {/* HEADER */}
      <div className="flex items-center gap-2 flex-wrap">
        <h1 className="text-xl font-bold tracking-tight">Painel de Resultados</h1>
        {municipio && (
          <Badge variant="outline" className="text-xs font-medium">
            {municipio}
          </Badge>
        )}
        {ano && (
          <Badge variant="secondary" className="text-xs font-medium">
            {ano}
          </Badge>
        )}
        {!loadingKpis && kpis?.totalCandidatos > 0 && (
          <CompetitividadeBadge totalCandidatos={kpis.totalCandidatos} />
        )}
      </div>

      {/* KPIs */}
      {loadingKpis ? <KPISkeleton4 /> : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KPICard icon={Users} label="Total Candidatos" value={formatNumber(kpis?.totalCandidatos)} sub={`${formatNumber(kpis?.totalPartidos)} partidos`} />
          <KPICard icon={Vote} label="Votos Nominais" value={formatNumber(votosValidos)} sub={painel ? `${painel.length} candidatos listados` : undefined} />
          <KPICard icon={BarChart3} label="Eleitos" value={formatNumber(kpis?.totalEleitos)} sub={kpis ? `${formatPercent(kpis.totalCandidatos > 0 ? (kpis.totalEleitos / kpis.totalCandidatos) * 100 : 0)} do total` : undefined} color="text-emerald-500" />
          <KPICard icon={XCircle} label="Comparecimento" value={comp ? formatNumber(Number(comp.comparecimento)) : '—'} sub={comp ? `${formatPercent(Number(comp.taxa_comparecimento))} dos aptos` : 'Sem dados'} color="text-amber-500" />
        </div>
      )}

      {/* DATA TABLE */}
      <div className="bg-card rounded-lg border border-border/40 overflow-hidden">
        {/* Table header */}
        <div className="px-4 py-2.5 border-b border-border/30 space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold">Ranking de Candidatos</h2>
              <Badge variant="outline" className="text-[10px] h-5 px-1.5 font-mono">
                {filteredByCargo.length} resultados
              </Badge>
            </div>
            <div className="text-[10px] text-muted-foreground">
              Página {page + 1} de {totalPages || 1}
            </div>
          </div>

          {/* Tabs + Export */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <Tabs value={cargoTab} onValueChange={v => handleCargoTab(v as CargoTab)}>
              <TabsList className="h-7">
                <TabsTrigger value="Todos" className="text-[11px] px-2.5 h-6">Todos</TabsTrigger>
                <TabsTrigger value="Prefeito" className="text-[11px] px-2.5 h-6">Prefeito</TabsTrigger>
                <TabsTrigger value="Vereador" className="text-[11px] px-2.5 h-6">Vereador</TabsTrigger>
              </TabsList>
            </Tabs>

            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[11px] gap-1.5"
              onClick={handleExportCSV}
              disabled={sorted.length === 0}
            >
              <Download className="w-3.5 h-3.5" />
              Exportar CSV
            </Button>
          </div>

          <GeoFilterBadge />
        </div>

        {loadingPainel ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : filteredByCargo.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            Nenhum candidato encontrado para os filtros selecionados.
          </div>
        ) : (
          <>
            <div className={`overflow-x-auto transition-opacity duration-150 ${fetchingPainel ? 'opacity-60' : 'opacity-100'}`}>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-border/30">
                    <TableHead className="w-[50px] text-[10px] font-semibold text-muted-foreground">#</TableHead>
                    <TableHead
                      className="text-[10px] font-semibold text-muted-foreground cursor-pointer select-none hover:text-foreground"
                      onClick={() => handleSort('candidato')}
                    >
                      Candidato <SortIcon col="candidato" />
                    </TableHead>
                    <TableHead className="w-[60px] text-[10px] font-semibold text-muted-foreground text-center">Nº</TableHead>
                    <TableHead
                      className="w-[80px] text-[10px] font-semibold text-muted-foreground cursor-pointer select-none hover:text-foreground"
                      onClick={() => handleSort('partido')}
                    >
                      Partido <SortIcon col="partido" />
                    </TableHead>
                    <TableHead className="w-[120px] text-[10px] font-semibold text-muted-foreground">Cargo</TableHead>
                    <TableHead
                      className="w-[100px] text-[10px] font-semibold text-muted-foreground text-right cursor-pointer select-none hover:text-foreground"
                      onClick={() => handleSort('total_votos')}
                    >
                      Votos <SortIcon col="total_votos" />
                    </TableHead>
                    <TableHead className="w-[60px] text-[10px] font-semibold text-muted-foreground text-right">%</TableHead>
                    <TableHead className="w-[100px] text-[10px] font-semibold text-muted-foreground text-center">Situação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageData.map((row: any, idx: number) => {
                    const votos = Number(row.total_votos || 0);
                    const pct = votosValidos > 0 ? (votos / votosValidos) * 100 : 0;
                    const pos = page * PAGE_SIZE + idx + 1;
                    const isEleito = row.situacao?.toUpperCase()?.includes('ELEITO') &&
                      !row.situacao?.toUpperCase()?.includes('NÃO ELEITO');

                    return (
                      <TableRow
                        key={row.sq_candidato || idx}
                        className={cn(
                          'group border-border/20 hover:bg-primary/5 cursor-pointer transition-colors',
                          isEleito && 'bg-success/5'
                        )}
                        onClick={() => navigate(`/candidatos/${row.sq_candidato}/${ano}`)}
                      >
                        <TableCell className="text-xs text-muted-foreground font-mono tabular-nums py-1.5">
                          {pos}
                        </TableCell>
                        <TableCell className="py-1.5 max-w-[220px]">
                          <CandidatoCard
                            variant="row"
                            sq={row.sq_candidato}
                            nome={row.candidato || ''}
                            partido={row.partido || ''}
                            cargo={row.cargo || ''}
                            municipio={row.municipio !== municipio ? row.municipio : undefined}
                            ano={ano}
                          />
                        </TableCell>
                        <TableCell className="text-xs text-center font-mono tabular-nums text-muted-foreground py-1.5">
                          {row.numero}
                        </TableCell>
                        <TableCell className="py-1.5">
                          <PartyBadge partido={row.partido || ''} />
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground truncate max-w-[120px] py-1.5">
                          {row.cargo}
                        </TableCell>
                        <TableCell className="py-1.5">
                          <div className="flex flex-col items-end gap-1">
                            <span className="text-sm font-bold tabular-nums text-primary">{votos > 0 ? formatNumber(votos) : '—'}</span>
                            {votos > 0 && <MiniBar value={votos} max={votosValidos > 0 ? Math.max(...(painel ?? []).map(r => Number(r.total_votos) || 0), 1) : 1} />}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-right tabular-nums text-muted-foreground py-1.5">
                          {pct > 0 ? formatPercent(pct, 2) : '—'}
                        </TableCell>
                        <TableCell className="text-center py-1.5">
                          <SituacaoBadge situacao={row.situacao || '—'} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-4 py-2 border-t border-border/30 flex items-center justify-between">
                <p className="text-[10px] text-muted-foreground">
                  {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filteredByCargo.length)} de {filteredByCargo.length}
                </p>
                <div className="flex gap-1">
                  <Button
                    variant="ghost" size="sm"
                    disabled={page === 0}
                    onClick={() => setPage(p => p - 1)}
                    className="h-7 w-7 p-0"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  {Array.from({ length: Math.min(totalPages, 7) }).map((_, i) => {
                    const p = totalPages <= 7
                      ? i
                      : page < 4
                        ? i
                        : page > totalPages - 4
                          ? totalPages - 7 + i
                          : page - 3 + i;
                    if (p < 0 || p >= totalPages) return null;
                    return (
                      <Button
                        key={p} variant={p === page ? 'default' : 'ghost'}
                        size="sm" onClick={() => setPage(p)}
                        className="h-7 w-7 p-0 text-xs"
                      >
                        {p + 1}
                      </Button>
                    );
                  })}
                  <Button
                    variant="ghost" size="sm"
                    disabled={page >= totalPages - 1}
                    onClick={() => setPage(p => p + 1)}
                    className="h-7 w-7 p-0"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* VOTOS POR REGIÃO */}
      <VotosRegionalTable
        data={votosRegional || []}
        isLoading={loadingRegional}
        title={`Votos por Zona / Bairro / Escola — ${municipio}`}
      />
    </div>
  );
}
