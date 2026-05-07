import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRankingMD } from '@/hooks/useRanking';
import {
  useComparecimento,
  useRankingPartidos,
  useVotosBrancosNulos,
  useDistribuicaoGenero,
  useVotacaoPorZona,
  useSituacaoFinal,
} from '@/hooks/useEleicoes';
import { useFilterStore } from '@/stores/filterStore';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { LoadingKPIs, LoadingTable } from '@/components/eleicoes/LoadingSection';
import { formatNumber, formatPercent, getPartidoCor, getSituacaoBadge } from '@/lib/eleicoes';
import { BarChart3, Users, Vote, TrendingDown, MapPin, PieChart, CheckCircle2 } from 'lucide-react';

function KPI({ icon: Icon, label, value, sub, color = 'text-primary' }: {
  icon: any; label: string; value: string; sub?: string; color?: string;
}) {
  return (
    <Card className="bg-card border-border/50">
      <CardContent className="p-3 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className={`w-4 h-4 ${color}`} />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="text-lg font-bold text-foreground">{value}</p>
          {sub && <p className="text-[10px] text-muted-foreground truncate">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="h-1.5 bg-muted rounded-full overflow-hidden w-16 sm:w-24">
      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  );
}

export default function RelatorioVotacao() {
  const navigate = useNavigate();
  const { ano, municipio } = useFilterStore();

  const ranking = useRankingMD();
  const comparecimento = useComparecimento();
  const partidos = useRankingPartidos(30);
  const brancosNulos = useVotosBrancosNulos();
  const genero = useDistribuicaoGenero();
  const situacao = useSituacaoFinal();
  const zonas = useVotacaoPorZona(municipio);

  const stats = useMemo(() => {
    if (!ranking.data?.length) return null;
    const totalVotos = ranking.data.reduce((s, d) => s + d.total_votos, 0);
    const eleitos = ranking.data.filter(d => {
      const s = (d.DS_SIT_TOT_TURNO || '').toUpperCase();
      return s.includes('ELEITO') && !s.includes('NÃO');
    }).length;
    const maxVotos = Math.max(...ranking.data.map(d => d.total_votos));
    return { totalVotos, eleitos, total: ranking.data.length, maxVotos };
  }, [ranking.data]);

  const compStats = useMemo(() => {
    if (!comparecimento.data?.length) return null;
    const acc = (comparecimento.data as any[]).reduce(
      (a, d) => ({
        aptos: a.aptos + Number(d.eleitores || 0),
        comp: a.comp + Number(d.comparecimento || 0),
        abst: a.abst + Number(d.abstencoes || 0),
      }),
      { aptos: 0, comp: 0, abst: 0 }
    );
    return { ...acc, taxa: acc.aptos > 0 ? (acc.comp / acc.aptos) * 100 : 0 };
  }, [comparecimento.data]);

  const bnStats = useMemo(() => {
    const d = brancosNulos.data as any[];
    return d?.length ? (d[0] as any) : null;
  }, [brancosNulos.data]);

  const maxPartidoVotos = useMemo(() => {
    const d = partidos.data as any[];
    return d?.length ? Math.max(...d.map(p => Number(p.votos_nominais || 0))) : 0;
  }, [partidos.data]);

  const maxZonaAptos = useMemo(() => {
    const d = zonas.data as any[];
    return d?.length ? Math.max(...d.map(z => Number(z.apto || 0))) : 0;
  }, [zonas.data]);

  return (
    <div className="space-y-3 sm:space-y-4 max-w-[1800px] mx-auto">
      <div>
        <h1 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
          <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
          Relatório de Votação
        </h1>
        <p className="text-[10px] sm:text-xs text-muted-foreground">
          {municipio || 'Goiás'} · {ano} — Análise completa: candidatos, partidos, comparecimento e perfil
        </p>
      </div>

      {/* KPIs */}
      {ranking.isLoading ? (
        <LoadingKPIs count={4} />
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
          <KPI icon={Vote} label="Total de Votos" value={formatNumber(stats?.totalVotos ?? 0)} sub={`${stats?.total ?? 0} candidatos`} />
          <KPI icon={CheckCircle2} label="Eleitos" value={formatNumber(stats?.eleitos ?? 0)} sub={`de ${stats?.total ?? 0} candidatos`} color="text-emerald-500" />
          <KPI icon={Users} label="Comparecimento" value={compStats ? formatPercent(compStats.taxa) : '—'} sub={compStats ? formatNumber(compStats.comp) + ' eleitores' : undefined} color="text-blue-500" />
          <KPI icon={TrendingDown} label="Abstenção" value={compStats ? formatPercent(100 - compStats.taxa) : '—'} sub={compStats ? formatNumber(compStats.abst) + ' eleitores' : undefined} color="text-amber-500" />
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="candidatos">
        <TabsList className="h-10 flex-wrap">
          <TabsTrigger value="candidatos" className="text-xs min-h-[36px]">Candidatos</TabsTrigger>
          <TabsTrigger value="partidos" className="text-xs min-h-[36px]">Partidos</TabsTrigger>
          <TabsTrigger value="comparecimento" className="text-xs min-h-[36px]">Comparecimento</TabsTrigger>
          <TabsTrigger value="analise" className="text-xs min-h-[36px]">Análise</TabsTrigger>
        </TabsList>

        {/* ── CANDIDATOS ── */}
        <TabsContent value="candidatos" className="mt-3">
          {ranking.isLoading ? <LoadingTable rows={15} cols={9} /> : (
            <div className="bg-card rounded-lg border border-border/50 overflow-hidden">
              <div className="overflow-x-auto">
                <Table className="w-full text-sm">
                  <TableHeader>
                    <TableRow className="bg-muted/30 border-b border-border/30">
                      <TableHead className="px-2 py-2 w-8 text-[10px] uppercase">#</TableHead>
                      <TableHead className="px-2 py-2 text-[10px] uppercase">Candidato</TableHead>
                      <TableHead className="px-2 py-2 text-[10px] uppercase">Partido</TableHead>
                      <TableHead className="px-2 py-2 text-[10px] uppercase hide-mobile">Cargo</TableHead>
                      <TableHead className="px-2 py-2 text-[10px] uppercase hide-mobile">Situação</TableHead>
                      <TableHead className="px-2 py-2 text-[10px] uppercase text-right hide-mobile">1º Turno</TableHead>
                      <TableHead className="px-2 py-2 text-[10px] uppercase text-right hide-mobile">2º Turno</TableHead>
                      <TableHead className="px-2 py-2 text-[10px] uppercase text-right">Total</TableHead>
                      <TableHead className="px-2 py-2 text-[10px] uppercase hide-mobile text-right">% Votos</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ranking.data?.map((item, idx) => {
                      const sit = getSituacaoBadge(item.DS_SIT_TOT_TURNO);
                      const pct = stats?.totalVotos ? (item.total_votos / stats.totalVotos) * 100 : 0;
                      return (
                        <TableRow
                          key={item.SQ_CANDIDATO ?? idx}
                          className="border-b border-border/20 hover:bg-primary/5 cursor-pointer transition-colors"
                          onClick={() => navigate(`/candidatos/${item.SQ_CANDIDATO}/${ano}`)}
                        >
                          <TableCell className="px-2 py-1.5 text-muted-foreground font-mono text-xs">{idx + 1}</TableCell>
                          <TableCell className="px-2 py-1.5">
                            <span className="font-semibold text-xs">{item.NM_URNA_CANDIDATO}</span>
                            <p className="text-[10px] text-muted-foreground">{item.NM_CANDIDATO}</p>
                          </TableCell>
                          <TableCell className="px-2 py-1.5">
                            <span className="text-xs font-bold px-1.5 py-0.5 rounded"
                              style={{ backgroundColor: getPartidoCor(item.SG_PARTIDO) + '20', color: getPartidoCor(item.SG_PARTIDO) }}>
                              {item.SG_PARTIDO}
                            </span>
                          </TableCell>
                          <TableCell className="px-2 py-1.5 text-xs text-muted-foreground hide-mobile">{item.DS_CARGO}</TableCell>
                          <TableCell className="px-2 py-1.5 hide-mobile">
                            <Badge className={`text-[9px] ${sit.bg} ${sit.text} border-0`}>{sit.label}</Badge>
                          </TableCell>
                          <TableCell className="px-2 py-1.5 text-right text-xs font-mono hide-mobile">
                            {item.votos_turno1 > 0 ? formatNumber(item.votos_turno1) : '—'}
                          </TableCell>
                          <TableCell className="px-2 py-1.5 text-right text-xs font-mono hide-mobile">
                            {item.votos_turno2 > 0
                              ? <span className="text-amber-400">{formatNumber(item.votos_turno2)}</span>
                              : '—'}
                          </TableCell>
                          <TableCell className="px-2 py-1.5 text-right font-bold text-primary text-xs">
                            {formatNumber(item.total_votos)}
                          </TableCell>
                          <TableCell className="px-2 py-1.5 hide-mobile">
                            <div className="flex items-center gap-1.5 justify-end">
                              <span className="text-[10px] text-muted-foreground font-mono w-10 text-right">{pct.toFixed(2)}%</span>
                              <MiniBar value={item.total_votos} max={stats?.maxVotos ?? 1} color="hsl(var(--primary))" />
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {ranking.data?.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-muted-foreground text-xs">
                          Nenhum candidato encontrado com os filtros atuais.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ── PARTIDOS ── */}
        <TabsContent value="partidos" className="mt-3">
          {partidos.isLoading ? <LoadingTable rows={12} cols={5} /> : (
            <div className="bg-card rounded-lg border border-border/50 overflow-hidden">
              <div className="overflow-x-auto">
                <Table className="w-full text-sm">
                  <TableHeader>
                    <TableRow className="bg-muted/30 border-b border-border/30">
                      <TableHead className="px-2 py-2 w-8 text-[10px] uppercase">#</TableHead>
                      <TableHead className="px-2 py-2 text-[10px] uppercase">Partido</TableHead>
                      <TableHead className="px-2 py-2 text-[10px] uppercase">Nome</TableHead>
                      <TableHead className="px-2 py-2 text-[10px] uppercase text-right">Votos Nominais</TableHead>
                      <TableHead className="px-2 py-2 text-[10px] uppercase text-right hide-mobile">Votos Legenda</TableHead>
                      <TableHead className="px-2 py-2 text-[10px] uppercase hide-mobile">Proporção</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(partidos.data as any[] || []).map((p, idx) => (
                      <TableRow key={p.partido ?? idx} className="border-b border-border/20 hover:bg-muted/20">
                        <TableCell className="px-2 py-1.5 text-muted-foreground font-mono text-xs">{idx + 1}</TableCell>
                        <TableCell className="px-2 py-1.5">
                          <span className="text-xs font-bold px-1.5 py-0.5 rounded"
                            style={{ backgroundColor: getPartidoCor(p.partido) + '20', color: getPartidoCor(p.partido) }}>
                            {p.partido}
                          </span>
                        </TableCell>
                        <TableCell className="px-2 py-1.5 text-xs text-muted-foreground max-w-[160px] truncate">{p.nome_partido}</TableCell>
                        <TableCell className="px-2 py-1.5 text-right font-bold text-primary text-xs">
                          {formatNumber(Number(p.votos_nominais || 0))}
                        </TableCell>
                        <TableCell className="px-2 py-1.5 text-right text-xs text-muted-foreground hide-mobile">
                          {formatNumber(Number(p.votos_legenda || 0))}
                        </TableCell>
                        <TableCell className="px-2 py-1.5 hide-mobile">
                          <MiniBar value={Number(p.votos_nominais || 0)} max={maxPartidoVotos} color={getPartidoCor(p.partido)} />
                        </TableCell>
                      </TableRow>
                    ))}
                    {(partidos.data as any[] || []).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-xs">
                          Nenhum dado de partido disponível.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ── COMPARECIMENTO ── */}
        <TabsContent value="comparecimento" className="mt-3 space-y-3">
          {compStats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { label: 'Eleitores Aptos', value: formatNumber(compStats.aptos) },
                { label: 'Comparecimento', value: formatNumber(compStats.comp) },
                { label: 'Abstenção', value: formatNumber(compStats.abst) },
                { label: 'Taxa de comparecimento', value: formatPercent(compStats.taxa) },
              ].map(c => (
                <div key={c.label} className="bg-card border border-border/50 rounded-lg p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{c.label}</p>
                  <p className="text-base font-bold">{c.value}</p>
                </div>
              ))}
            </div>
          )}

          {municipio ? (
            zonas.isLoading ? <LoadingTable rows={8} cols={6} /> : (
              <div className="bg-card rounded-lg border border-border/50 overflow-hidden">
                <div className="px-3 py-2 border-b border-border/30">
                  <p className="text-xs font-semibold flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-primary" />
                    Comparecimento por Zona — {municipio}
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <Table className="w-full text-sm">
                    <TableHeader>
                      <TableRow className="bg-muted/30 border-b border-border/30">
                        <TableHead className="px-2 py-2 text-[10px] uppercase">Zona</TableHead>
                        <TableHead className="px-2 py-2 text-[10px] uppercase text-right">Aptos</TableHead>
                        <TableHead className="px-2 py-2 text-[10px] uppercase text-right">Comparecimento</TableHead>
                        <TableHead className="px-2 py-2 text-[10px] uppercase text-right">Abstenção</TableHead>
                        <TableHead className="px-2 py-2 text-[10px] uppercase text-right">Taxa</TableHead>
                        <TableHead className="px-2 py-2 text-[10px] uppercase hide-mobile">Proporção</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(zonas.data as any[] || []).map((z, idx) => {
                        const taxa = z.apto > 0 ? (z.comp / z.apto) * 100 : 0;
                        return (
                          <TableRow key={z.zona ?? idx} className="border-b border-border/20">
                            <TableCell className="px-2 py-1.5 font-mono text-xs font-medium">Zona {z.zona}</TableCell>
                            <TableCell className="px-2 py-1.5 text-right text-xs">{formatNumber(z.apto)}</TableCell>
                            <TableCell className="px-2 py-1.5 text-right text-xs text-emerald-400">{formatNumber(z.comp)}</TableCell>
                            <TableCell className="px-2 py-1.5 text-right text-xs text-amber-400">{formatNumber(z.abst)}</TableCell>
                            <TableCell className="px-2 py-1.5 text-right text-xs font-bold">{formatPercent(taxa)}</TableCell>
                            <TableCell className="px-2 py-1.5 hide-mobile">
                              <div className="flex gap-1 items-center">
                                <div className="h-1.5 rounded-full bg-emerald-500/80" style={{ width: `${maxZonaAptos > 0 ? (z.comp / maxZonaAptos) * 80 : 0}px` }} />
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {(zonas.data as any[] || []).length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-6 text-muted-foreground text-xs">
                            Nenhum dado de zona disponível.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )
          ) : (
            <div className="text-center py-8 text-muted-foreground text-sm bg-card border border-border/50 rounded-lg">
              Selecione um município nos filtros para ver o comparecimento por zona.
            </div>
          )}
        </TabsContent>

        {/* ── ANÁLISE ── */}
        <TabsContent value="analise" className="mt-3 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {/* Brancos e Nulos */}
            <Card className="border-border/50">
              <CardHeader className="pb-2 pt-3 px-3">
                <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
                  <TrendingDown className="w-3.5 h-3.5 text-amber-500" /> Votos Brancos e Nulos
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3 space-y-3">
                {bnStats ? (
                  [
                    { label: 'Votos Brancos', value: bnStats.brancos, pct: bnStats.pctBrancos, color: '#94a3b8' },
                    { label: 'Votos Nulos', value: bnStats.nulos, pct: bnStats.pctNulos, color: '#f87171' },
                  ].map(item => (
                    <div key={item.label}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground">{item.label}</span>
                        <span className="font-mono font-semibold">
                          {formatNumber(item.value)} <span className="text-muted-foreground">({formatPercent(item.pct)})</span>
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(item.pct * 5, 100)}%`, backgroundColor: item.color }} />
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground">Dados não disponíveis para os filtros atuais.</p>
                )}
              </CardContent>
            </Card>

            {/* Gênero */}
            <Card className="border-border/50">
              <CardHeader className="pb-2 pt-3 px-3">
                <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
                  <PieChart className="w-3.5 h-3.5 text-primary" /> Candidatos por Gênero
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3 space-y-3">
                {genero.data && (() => {
                  const gData = genero.data as any[];
                  const totalG = gData.reduce((s: number, g: any) => s + Number(g.total || 0), 0);
                  return gData.map((g: any) => {
                    const pct = totalG > 0 ? (Number(g.total) / totalG) * 100 : 0;
                    const color = g.genero === 'FEMININO' ? '#ec4899' : g.genero === 'MASCULINO' ? '#3b82f6' : '#6b7280';
                    return (
                      <div key={g.genero}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted-foreground capitalize">{(g.genero || 'Não inf.').toLowerCase()}</span>
                          <span className="font-mono font-semibold">
                            {formatNumber(Number(g.total))} <span className="text-muted-foreground">({formatPercent(pct)})</span>
                          </span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                        </div>
                      </div>
                    );
                  });
                })()}
              </CardContent>
            </Card>

            {/* Situação Final */}
            {situacao.data && (
              <Card className="border-border/50 sm:col-span-2">
                <CardHeader className="pb-2 pt-3 px-3">
                  <CardTitle className="text-xs font-semibold">Distribuição por Situação Final</CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3 space-y-2">
                  {(() => {
                    const sData = situacao.data as any[];
                    const totalS = sData.reduce((s: number, d: any) => s + Number(d.total || 0), 0);
                    return sData.slice(0, 10).map((s: any) => {
                      const sit = getSituacaoBadge(s.nome);
                      const pct = totalS > 0 ? (Number(s.total) / totalS) * 100 : 0;
                      return (
                        <div key={s.nome} className="flex items-center gap-2">
                          <Badge className={`text-[8px] px-1.5 py-0 ${sit.bg} ${sit.text} border-0 shrink-0 w-32 justify-center`}>
                            {sit.label}
                          </Badge>
                          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-primary/60" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-[10px] font-mono text-muted-foreground w-20 text-right shrink-0">
                            {formatNumber(Number(s.total))} ({pct.toFixed(1)}%)
                          </span>
                        </div>
                      );
                    });
                  })()}
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <p className="text-[10px] text-muted-foreground text-right">
        {ranking.data?.length ?? 0} candidatos · Fonte: TSE/MotherDuck · {ano}
      </p>
    </div>
  );
}
