import { useNavigate } from 'react-router-dom';
import { useMvRanking } from '@/hooks/mv/useMvRanking';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { formatNumber, formatBRLCompact, getPartidoCor, getSituacaoBadge } from '@/lib/eleicoes';
import { Trophy, TrendingUp, Users, Landmark, Star, Search, X, Download, ChevronRight } from 'lucide-react';
import { exportToCSV } from '@/lib/export';
import { useFilterStore } from '@/stores/filterStore';
import { KPICard, MiniBar, PartyBadge, PageHeader } from '@/components/eleicoes/VisualKit';
import { useMemo, useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LoadingKPIs, LoadingTable } from '@/components/eleicoes/LoadingSection';
import { useSuplentesStore } from '@/stores/suplentesStore';
import { cn } from '@/lib/utils';
import { mdQuery, getTableName } from '@/lib/motherduck';
import { usePartidos } from '@/hooks/useEleicoes';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';


export default function Ranking() {
  const navigate = useNavigate();
  const { data, isLoading, isError, error } = useMvRanking();
  const { ano, municipio } = useFilterStore();
  const { suplentes, marcar, desmarcar } = useSuplentesStore();
  const queryClient = useQueryClient();

  const prefetchCandidatoBens = (sqCandidato: string) => {
    queryClient.prefetchQuery({
      queryKey: ['mv_bens', sqCandidato, ano],
      queryFn: async () => {
        const { data } = await supabase
          .from('mv_candidato_bens')
          .select('*')
          .eq('sq_candidato', sqCandidato)
          .eq('ano', ano)
          .order('nr_ordem');
        return data ?? [];
      },
      staleTime: Infinity,
    });
  };
  const [apenasSupl, setApenasSupl] = useState(false);
  const [suplCidade, setSuplCidade] = useState('');
  const [suplCidadeDb, setSuplCidadeDb] = useState('');
  const [suplAno, setSuplAno] = useState<number>(ano || 2024);
  const [suplPartido, setSuplPartido] = useState<string | null>(null);
  const { data: partidos = [] } = usePartidos();

  useEffect(() => {
    const t = setTimeout(() => setSuplCidadeDb(suplCidade.trim()), 350);
    return () => clearTimeout(t);
  }, [suplCidade]);

  const safe = (s: string) => s.replace(/'/g, "''");

  const suplQ = useQuery({
    queryKey: ['supls-cidade', suplAno, suplCidadeDb, suplPartido],
    enabled: apenasSupl && suplCidadeDb.length >= 2,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      let t: string;
      try { t = getTableName('candidatos', suplAno); } catch { return []; }
      let queryText = `
        SELECT SQ_CANDIDATO AS sq, NM_URNA_CANDIDATO AS nome, NM_CANDIDATO AS nome_completo,
               SG_PARTIDO AS partido, DS_CARGO AS cargo, NM_UE AS municipio, NR_CANDIDATO AS numero
        FROM ${t}
        WHERE NM_UE ILIKE '%${safe(suplCidadeDb)}%'
          AND upper(DS_SIT_TOT_TURNO) = 'SUPLENTE'
      `;
      if (suplPartido) {
        queryText += ` AND SG_PARTIDO = '${safe(suplPartido)}'`;
      }
      queryText += ` ORDER BY DS_CARGO, NM_URNA_CANDIDATO LIMIT 300`;
      return mdQuery(queryText);
    },
  });

  const totalMarcados = Object.keys(suplentes).length;

  function handleExport() {
    exportToCSV(
      displayData.map((r: any, idx: number) => ({
        Posição: idx + 1,
        Candidato: r.NM_URNA_CANDIDATO || r.nm_urna || r.candidato || '',
        'Nome Completo': r.NM_CANDIDATO || r.nm_candidato || '',
        Número: r.NR_CANDIDATO || r.nr_candidato || '',
        Partido: r.SG_PARTIDO || r.sg_partido || r.partido || '',
        Cargo: r.DS_CARGO || r.ds_cargo || r.cargo || '',
        Município: r.NM_UE || r.municipio_nome || r.municipio || '',
        Votos: r.total_votos || 0,
        Situação: r.DS_SIT_TOT_TURNO || r.ds_situacao || r.situacao || '',
        Patrimônio: r.patrimonio_total || 0,
      })),
      'ranking-candidatos'
    );
  }

  const displayData = useMemo(() => {
    if (!data) return [];
    if (!apenasSupl) return data;
    return data.filter(d => (d.DS_SIT_TOT_TURNO || '').toUpperCase().includes('SUPLENTE'));
  }, [data, apenasSupl]);

  const stats = useMemo(() => {
    if (!data?.length) return null;
    const totalVotos = data.reduce((s, d) => s + d.total_votos, 0);
    const totalPatrimonio = data.reduce((s, d) => s + d.patrimonio_total, 0);
    const partidos = new Set(data.map(d => d.SG_PARTIDO)).size;
    const eleitos = data.filter(d => {
      const s = (d.DS_SIT_TOT_TURNO || '').toUpperCase();
      return s.includes('ELEITO') && !s.includes('NÃO');
    }).length;
    return { totalVotos, totalPatrimonio, partidos, eleitos, total: data.length };
  }, [data]);

  const maxVotos = useMemo(() => data ? Math.max(...data.map(d => d.total_votos), 1) : 1, [data]);

  return (
    <div className="space-y-3 sm:space-y-4 max-w-[1800px] mx-auto">
      <PageHeader
        icon={Trophy}
        title="Ranking de Candidatos"
        subtitle={`${municipio} · ${ano} — Ranking por votos com patrimônio e situação`}
      />

      {isLoading ? (
        <LoadingKPIs count={4} />
      ) : stats && (
        <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
          <KPICard icon={Users} label="Candidatos" value={formatNumber(stats.total)} sub={`${stats.partidos} partidos`} />
          <KPICard icon={TrendingUp} label="Total de Votos" value={formatNumber(stats.totalVotos)} />
          <KPICard icon={Landmark} label="Patrimônio Total" value={formatBRLCompact(stats.totalPatrimonio)} />
          <KPICard icon={Trophy} label="Eleitos" value={formatNumber(stats.eleitos)} sub={`de ${stats.total} candidatos`} color="text-emerald-500" />
        </div>
      )}

      {isError && (
        <Alert variant="destructive">
          <AlertTitle>Erro</AlertTitle>
          <AlertDescription>{(error as Error).message || 'Falha ao carregar ranking.'}</AlertDescription>
        </Alert>
      )}

      {/* Toggle suplentes por cidade */}
      {!isLoading && (
        <button
          onClick={() => { setApenasSupl(v => !v); if (!apenasSupl) setSuplCidade(''); }}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-colors font-medium w-fit',
            apenasSupl
              ? 'bg-amber-50 border-amber-300 text-amber-700'
              : 'border-border text-muted-foreground hover:text-foreground hover:border-amber-300'
          )}
        >
          <Star className={cn('w-3.5 h-3.5', apenasSupl ? 'fill-amber-500 text-amber-500' : '')} />
          {apenasSupl ? 'Fechar busca de suplentes' : 'Buscar suplentes por cidade'}
          {totalMarcados > 0 && !apenasSupl && (
            <span className="ml-1 bg-amber-500 text-white text-[9px] rounded-full px-1.5 leading-4">{totalMarcados}</span>
          )}
        </button>
      )}

      {/* ── Painel suplentes por cidade ── */}
      {apenasSupl && (
        <div className="space-y-3">
          <div className="bg-card rounded-lg border border-border/50 p-3 flex flex-col sm:flex-row gap-3 items-end">
            <div className="flex-1 space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Cidade</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  autoFocus
                  className="pl-9 h-9 text-sm"
                  placeholder="Digite o nome da cidade…"
                  value={suplCidade}
                  onChange={e => setSuplCidade(e.target.value)}
                />
                {suplCidade && (
                  <button onClick={() => setSuplCidade('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-muted">
                    <X className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                )}
              </div>
            </div>
            <div className="space-y-1 w-28 shrink-0">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Eleição</label>
              <select
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={suplAno}
                onChange={e => setSuplAno(Number(e.target.value))}
              >
                {[2024, 2022, 2020, 2018, 2016, 2014].map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div className="space-y-1 w-32 shrink-0">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Partido</label>
              <select
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={suplPartido || ''}
                onChange={e => setSuplPartido(e.target.value || null)}
              >
                <option value="">Todos</option>
                {partidos.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          {suplCidadeDb.length < 2 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">
              Digite o nome da cidade para ver todos os suplentes
            </div>
          ) : suplQ.isLoading ? (
            <LoadingTable rows={8} cols={5} />
          ) : !suplQ.data?.length ? (
            <div className="text-center py-10 text-muted-foreground text-sm">
              Nenhum suplente encontrado para "{suplCidadeDb}" em {suplAno}
            </div>
          ) : (
            <div className="bg-card rounded-lg border border-border/50 overflow-hidden">
              <div className="px-3 py-2 bg-muted/30 border-b border-border/30 flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {suplQ.data.length} suplente{suplQ.data.length !== 1 ? 's' : ''} — {suplCidadeDb} · {suplAno}
                </span>
                {totalMarcados > 0 && (
                  <span className="text-xs text-amber-600 font-semibold">{totalMarcados} marcado{totalMarcados !== 1 ? 's' : ''}</span>
                )}
              </div>
              <div className="overflow-x-auto">
                <Table className="w-full text-sm">
                  <TableHeader>
                    <TableRow className="bg-muted/20 border-b border-border/30">
                      <TableHead className="w-7 px-1"></TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider">Candidato</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider">Partido</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider hide-mobile">Cargo</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider hide-mobile">Cidade</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(suplQ.data as any[]).map((item) => {
                      const sq = String(item.sq);
                      const marcado = !!suplentes[sq];
                      return (
                        <TableRow
                          key={sq}
                          className={cn('border-b border-border/20 hover:bg-primary/5 cursor-pointer transition-colors', marcado && 'bg-amber-50/50')}
                          onClick={() => navigate(`/candidatos/${sq}/${suplAno}`)}
                        >
                          <TableCell className="px-1 py-2 w-7">
                            <button
                               onClick={(e) => {
                                 e.stopPropagation();
                                 if (marcado) {
                                   desmarcar(sq);
                                 } else {
                                   marcar({
                                     sq,
                                     nome: String(item.nome_completo || ''),
                                     nomeUrna: String(item.nome || ''),
                                     partido: String(item.partido || ''),
                                     cargo: String(item.cargo || ''),
                                     municipio: String(item.municipio || ''),
                                     numero: item.numero ?? '',
                                     situacao: 'SUPLENTE',
                                     ano: suplAno,
                                   });
                                 }
                               }}
                               className="p-0.5 rounded hover:bg-amber-100 transition-colors"
                               title={marcado ? 'Remover' : 'Marcar como suplente'}
                            >
                               <Star className={cn('w-3.5 h-3.5 transition-colors', marcado ? 'fill-amber-500 text-amber-500' : 'text-muted-foreground/25 hover:text-amber-400')} />
                            </button>
                          </TableCell>
                          <TableCell className="px-2 py-2">
                            <div className="font-semibold text-foreground text-xs sm:text-sm flex items-center gap-1.5">
                              {item.nome}
                              {marcado && <span className="text-[8px] px-1 py-0.5 rounded bg-amber-500 text-white font-bold leading-none">SUPL</span>}
                            </div>
                            {item.nome_completo && item.nome_completo !== item.nome && (
                              <p className="text-[10px] text-muted-foreground">{item.nome_completo}</p>
                            )}
                            <div className="sm:hidden text-[9px] text-muted-foreground mt-0.5">
                              {item.cargo} · {item.municipio}
                            </div>
                          </TableCell>
                          <TableCell className="px-2 py-2">
                            <span className="text-xs font-bold px-1.5 py-0.5 rounded"
                              style={{ backgroundColor: getPartidoCor(item.partido) + '20', color: getPartidoCor(item.partido) }}>
                              {item.partido}
                            </span>
                          </TableCell>
                          <TableCell className="px-2 py-2 text-xs text-muted-foreground hide-mobile">{item.cargo}</TableCell>
                          <TableCell className="px-2 py-2 text-xs text-muted-foreground hide-mobile">{item.municipio}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Ranking normal ── */}
      {!apenasSupl && isLoading ? (
        <LoadingTable rows={15} cols={9} />
      ) : !apenasSupl && (
        <div className="bg-card rounded-lg border border-border/50 overflow-hidden animate-fade-in">
          <div className="overflow-x-auto">
            <Table className="w-full text-sm table-auto">
              <TableHeader>
                <TableRow className="bg-muted/30 border-b border-border/30 text-left">
                  <TableHead className="px-1 py-2 w-7"></TableHead>
                  <TableHead className="px-2 py-2 w-8 text-[10px] uppercase tracking-wider">#</TableHead>
                  <TableHead className="px-2 py-2 text-[10px] uppercase tracking-wider">Candidato</TableHead>
                  <TableHead className="px-2 py-2 text-[10px] uppercase tracking-wider">Partido</TableHead>
                  <TableHead className="px-2 py-2 text-[10px] uppercase tracking-wider hide-mobile">Cargo</TableHead>
                  <TableHead className="px-2 py-2 text-[10px] uppercase tracking-wider hide-mobile">Município</TableHead>
                  <TableHead className="px-2 py-2 text-[10px] uppercase tracking-wider hide-mobile">Situação</TableHead>
                  <TableHead className="px-2 py-2 text-[10px] uppercase tracking-wider text-right hide-mobile">Patrimônio</TableHead>
                  <TableHead className="px-2 py-2 text-[10px] uppercase tracking-wider text-right">Votos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayData.map((item, idx) => {
                  const sit = getSituacaoBadge(item.DS_SIT_TOT_TURNO);
                  const sq = String(item.SQ_CANDIDATO);
                  const marcado = !!suplentes[sq];
                  return (
                    <TableRow
                      key={item.SQ_CANDIDATO ?? idx}
                      className={cn(
                        'group border-b border-border/20 hover:bg-primary/5 cursor-pointer transition-colors',
                        marcado && 'bg-amber-50/40'
                      )}
                      onMouseEnter={() => prefetchCandidatoBens(sq)}
                      onClick={() => navigate(`/candidatos/${item.SQ_CANDIDATO}/${ano}`)}
                    >
                      <TableCell className="px-1 py-1.5 w-7">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (marcado) {
                              desmarcar(sq);
                            } else {
                              marcar({
                                sq,
                                nome: String(item.NM_CANDIDATO || ''),
                                nomeUrna: String(item.NM_URNA_CANDIDATO || ''),
                                partido: String(item.SG_PARTIDO || ''),
                                cargo: String(item.DS_CARGO || ''),
                                municipio: String(item.NM_UE || municipio || ''),
                                numero: item.NR_CANDIDATO ?? '',
                                situacao: String(item.DS_SIT_TOT_TURNO || ''),
                                ano,
                              });
                            }
                          }}
                          className="p-0.5 rounded hover:bg-amber-100 transition-colors"
                          title={marcado ? 'Remover suplente' : 'Marcar como suplente'}
                        >
                          <Star className={cn(
                            'w-3.5 h-3.5 transition-colors',
                            marcado ? 'fill-amber-500 text-amber-500' : 'text-muted-foreground/20 hover:text-amber-400'
                          )} />
                        </button>
                      </TableCell>
                      <TableCell className="px-2 py-1.5 text-muted-foreground font-mono text-xs">{idx + 1}</TableCell>
                      <TableCell className="px-2 py-1.5">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-foreground text-xs sm:text-sm group-hover:text-primary group-hover:underline underline-offset-2 transition-colors">{item.NM_URNA_CANDIDATO}</span>
                            {marcado && <span className="text-[8px] px-1 py-0.5 rounded bg-amber-500 text-white font-bold leading-none">SUPL</span>}
                            <ChevronRight className="w-3 h-3 text-muted-foreground/30 group-hover:text-primary transition-colors shrink-0" />
                          </div>
                          <p className="text-[10px] text-muted-foreground truncate max-w-[140px] sm:max-w-[200px]">{item.NM_CANDIDATO}</p>
                          <div className="sm:hidden flex items-center gap-1 mt-0.5">
                            <span className="text-[9px] text-muted-foreground">{item.DS_CARGO}</span>
                            <Badge className={`text-[8px] px-1 py-0 ${sit.bg} ${sit.text} border-0`}>{sit.label}</Badge>
                          </div>
                          {item.tem_segundo_turno && (
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 font-medium">
                                1º T: {formatNumber(item.votos_turno1)}
                              </span>
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 font-medium">
                                2º T: {formatNumber(item.votos_turno2)}
                              </span>
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-medium">
                                Total: {formatNumber(item.total_votos)}
                              </span>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="px-2 py-1.5">
                        <PartyBadge partido={item.SG_PARTIDO} />
                      </TableCell>
                      <TableCell className="px-2 py-1.5 text-xs text-muted-foreground hide-mobile">{item.DS_CARGO}</TableCell>
                      <TableCell className="px-2 py-1.5 text-xs text-muted-foreground hide-mobile">{item.NM_UE}</TableCell>
                      <TableCell className="px-2 py-1.5 hide-mobile">
                        <Badge className={`text-[9px] ${sit.bg} ${sit.text} border-0`}>{sit.label}</Badge>
                      </TableCell>
                      <TableCell className="px-2 py-1.5 text-right text-xs font-mono text-muted-foreground hide-mobile">
                        {item.patrimonio_total > 0 ? formatBRLCompact(item.patrimonio_total) : '—'}
                      </TableCell>
                      <TableCell className="px-2 py-1.5">
                        <div className="flex flex-col items-end gap-1">
                          <span className="font-bold text-primary text-xs font-mono">{formatNumber(item.total_votos)}</span>
                          <MiniBar value={item.total_votos} max={maxVotos} />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {displayData.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      {apenasSupl ? 'Nenhum suplente encontrado com os filtros atuais.' : 'Nenhum candidato encontrado.'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {!apenasSupl && data && data.length > 0 && (
        <div className="flex items-center justify-end gap-3">
          <p className="text-[10px] text-muted-foreground">
            {displayData.length} candidatos · Fonte: TSE · {ano}
          </p>
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs border border-border text-muted-foreground hover:text-foreground hover:border-primary/50 hover:bg-primary/5 transition-colors font-medium"
            title="Exportar para CSV"
          >
            <Download className="w-3 h-3" />
            Exportar CSV
          </button>
        </div>
      )}
    </div>
  );
}
