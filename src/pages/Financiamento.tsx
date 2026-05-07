import { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ScatterChart, Scatter, CartesianGrid } from 'recharts';
import { DollarSign, TrendingUp, Users, Award } from 'lucide-react';
import { useRankingFinanciamento, useOrigemReceitas, useTopDoadores, useCustoVoto } from '@/hooks/useFinanceiro';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatBRL, traduzirSituacao } from '@/lib/eleicoes';
import { useFilterStore } from '@/stores/filterStore';
import { getAnosDisponiveis } from '@/lib/motherduck';

function KpiCard({ icon: Icon, label, value, sub }: { icon: React.ElementType; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</div>
        <div className="text-lg font-bold text-foreground leading-tight">{value}</div>
        {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
      </div>
    </div>
  );
}

function getSitColor(sit: string | null) {
  if (!sit) return 'bg-muted text-muted-foreground';
  const s = sit.toUpperCase();
  if (s.includes('ELEIT')) return 'bg-green-100 text-green-800 border-green-300';
  if (s.includes('TURNO')) return 'bg-blue-100 text-blue-800 border-blue-300';
  if (s.includes('NÃO ELEIT')) return 'bg-red-100 text-red-800 border-red-300';
  return 'bg-muted text-muted-foreground';
}

export default function Financiamento() {
  const ano = useFilterStore((s) => s.ano);
  const [tab, setTab] = useState('ranking');

  const finAnosDisponiveis = getAnosDisponiveis('receitas');
  const anoDisponivel = finAnosDisponiveis.includes(ano);

  const rankingQ = useRankingFinanciamento(100);
  const origemQ = useOrigemReceitas();
  const doadoresQ = useTopDoadores(50);
  const custoQ = useCustoVoto(200);

  const ranking = (rankingQ.data || []) as any[];
  const origem = (origemQ.data || []) as any[];
  const doadores = (doadoresQ.data || []) as any[];
  const custoData = (custoQ.data || []) as any[];

  const totalArrecadado = useMemo(() => ranking.reduce((s, r) => s + Number(r.total_receitas || 0), 0), [ranking]);
  const totalCandidatos = ranking.length;
  const mediaArrecadacao = totalCandidatos > 0 ? totalArrecadado / totalCandidatos : 0;
  const maxCusto = useMemo(() => Math.max(...custoData.map((r: any) => Number(r.custo_por_voto || 0))), [custoData]);

  if (!anoDisponivel) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <DollarSign className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p className="text-sm">Dados financeiros não disponíveis para {ano}.</p>
        <p className="text-xs mt-1">Anos com dados: {finAnosDisponiveis.join(', ')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-base font-bold text-foreground">Financiamento de Campanhas</h1>
        <p className="text-xs text-muted-foreground">Receitas, doadores e custo por voto — {ano}</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard icon={DollarSign} label="Total arrecadado" value={rankingQ.isLoading ? '…' : formatBRL(totalArrecadado)} />
        <KpiCard icon={Users} label="Candidatos c/ receitas" value={rankingQ.isLoading ? '…' : String(totalCandidatos)} />
        <KpiCard icon={TrendingUp} label="Média por candidato" value={rankingQ.isLoading ? '…' : formatBRL(mediaArrecadacao)} />
        <KpiCard icon={Award} label="Maior arrecadador" value={rankingQ.isLoading ? '…' : formatBRL(Number(ranking[0]?.total_receitas || 0))} sub={ranking[0]?.candidato} />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-8">
          <TabsTrigger value="ranking" className="text-xs h-7">Ranking</TabsTrigger>
          <TabsTrigger value="origem" className="text-xs h-7">Origem</TabsTrigger>
          <TabsTrigger value="doadores" className="text-xs h-7">Doadores</TabsTrigger>
          <TabsTrigger value="custo" className="text-xs h-7">Custo/Voto</TabsTrigger>
        </TabsList>

        {/* ── RANKING ── */}
        <TabsContent value="ranking">
          {rankingQ.isLoading ? (
            <div className="space-y-2">{Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[10px] w-[40px]">#</TableHead>
                      <TableHead className="text-[10px]">Candidato</TableHead>
                      <TableHead className="text-[10px]">Partido</TableHead>
                      <TableHead className="text-[10px]">Cargo</TableHead>
                      <TableHead className="text-[10px] text-right">Receitas</TableHead>
                      <TableHead className="text-[10px] text-right">Votos</TableHead>
                      <TableHead className="text-[10px] text-right">R$/Voto</TableHead>
                      <TableHead className="text-[10px]">Resultado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ranking.map((r: any, i: number) => (
                      <TableRow key={i} className="border-border/20">
                        <TableCell className="text-xs text-muted-foreground font-mono">{i + 1}</TableCell>
                        <TableCell className="text-sm font-medium">{r.candidato}</TableCell>
                        <TableCell><Badge variant="outline" className="text-[9px] h-5">{r.partido}</Badge></TableCell>
                        <TableCell className="text-xs text-muted-foreground">{r.cargo}</TableCell>
                        <TableCell className="text-sm font-mono text-right font-bold">{formatBRL(Number(r.total_receitas || 0))}</TableCell>
                        <TableCell className="text-sm font-mono text-right">{Number(r.total_votos || 0).toLocaleString('pt-BR')}</TableCell>
                        <TableCell className="text-sm font-mono text-right text-muted-foreground">
                          {Number(r.total_votos) > 0 ? formatBRL(Number(r.custo_por_voto)) : '—'}
                        </TableCell>
                        <TableCell>
                          <Badge className={`text-[9px] h-5 border ${getSitColor(r.situacao)}`}>{traduzirSituacao(r.situacao)}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ── ORIGEM ── */}
        <TabsContent value="origem">
          {origemQ.isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl border border-border p-4 h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={origem.slice(0, 10)} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" tickFormatter={(v) => `R$${(v / 1e6).toFixed(1)}M`} className="text-[10px]" />
                    <YAxis type="category" dataKey="origem" width={180} className="text-[10px]" tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v: number) => formatBRL(v)} />
                    <Bar dataKey="total" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="rounded-xl border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[10px]">Origem</TableHead>
                      <TableHead className="text-[10px] text-right">Ocorrências</TableHead>
                      <TableHead className="text-[10px] text-right">Total</TableHead>
                      <TableHead className="text-[10px] text-right">%</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(() => {
                      const total = origem.reduce((s: number, r: any) => s + Number(r.total || 0), 0);
                      return origem.map((r: any, i: number) => (
                        <TableRow key={i} className="border-border/20">
                          <TableCell className="text-sm">{r.origem}</TableCell>
                          <TableCell className="text-sm font-mono text-right">{Number(r.ocorrencias).toLocaleString('pt-BR')}</TableCell>
                          <TableCell className="text-sm font-mono text-right font-bold">{formatBRL(Number(r.total))}</TableCell>
                          <TableCell className="text-xs text-muted-foreground text-right">
                            {total > 0 ? `${((Number(r.total) / total) * 100).toFixed(1)}%` : '—'}
                          </TableCell>
                        </TableRow>
                      ));
                    })()}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ── DOADORES ── */}
        <TabsContent value="doadores">
          {doadoresQ.isLoading ? (
            <div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[10px] w-[40px]">#</TableHead>
                    <TableHead className="text-[10px]">Doador</TableHead>
                    <TableHead className="text-[10px]">Origem</TableHead>
                    <TableHead className="text-[10px] text-right">Candidatos</TableHead>
                    <TableHead className="text-[10px] text-right">Total Doado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {doadores.map((r: any, i: number) => (
                    <TableRow key={i} className="border-border/20">
                      <TableCell className="text-xs text-muted-foreground font-mono">{i + 1}</TableCell>
                      <TableCell className="text-sm font-medium">{r.doador || '—'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.origem || '—'}</TableCell>
                      <TableCell className="text-sm font-mono text-right">{Number(r.candidatos)}</TableCell>
                      <TableCell className="text-sm font-mono text-right font-bold">{formatBRL(Number(r.total_doado))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* ── CUSTO/VOTO ── */}
        <TabsContent value="custo">
          {custoQ.isLoading ? (
            <Skeleton className="h-80 w-full" />
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl border border-border p-4 h-80">
                <p className="text-[10px] text-muted-foreground mb-2">Eixo X: Receitas totais · Eixo Y: Votos obtidos · Tamanho: custo por voto</p>
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="total_receitas" name="Receitas" tickFormatter={(v) => `R$${(v / 1e3).toFixed(0)}k`} className="text-[10px]" />
                    <YAxis dataKey="total_votos" name="Votos" tickFormatter={(v) => v.toLocaleString('pt-BR')} className="text-[10px]" />
                    <Tooltip
                      content={({ payload }) => {
                        const d = payload?.[0]?.payload as any;
                        if (!d) return null;
                        return (
                          <div className="rounded-lg border border-border bg-card shadow-md p-3 text-xs space-y-1">
                            <div className="font-bold">{d.candidato}</div>
                            <div className="text-muted-foreground">{d.partido} · {d.cargo}</div>
                            <div>Receitas: <span className="font-mono font-bold">{formatBRL(d.total_receitas)}</span></div>
                            <div>Votos: <span className="font-mono font-bold">{Number(d.total_votos).toLocaleString('pt-BR')}</span></div>
                            <div>Custo/Voto: <span className="font-mono font-bold">{formatBRL(d.custo_por_voto)}</span></div>
                          </div>
                        );
                      }}
                    />
                    <Scatter
                      data={custoData}
                      fill="hsl(var(--primary))"
                      fillOpacity={0.6}
                      r={4}
                    />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>

              {/* Top custo/voto */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="rounded-xl border border-border overflow-hidden">
                  <div className="px-3 py-2 bg-muted/40 border-b text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Maior Custo por Voto
                  </div>
                  <Table>
                    <TableBody>
                      {[...custoData].sort((a: any, b: any) => b.custo_por_voto - a.custo_por_voto).slice(0, 10).map((r: any, i: number) => (
                        <TableRow key={i} className="border-border/20">
                          <TableCell className="text-xs font-mono text-muted-foreground w-[28px]">{i + 1}</TableCell>
                          <TableCell className="text-xs font-medium">{r.candidato}</TableCell>
                          <TableCell className="text-xs font-mono text-right font-bold">{formatBRL(Number(r.custo_por_voto))}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="rounded-xl border border-border overflow-hidden">
                  <div className="px-3 py-2 bg-muted/40 border-b text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Menor Custo por Voto (eleitos)
                  </div>
                  <Table>
                    <TableBody>
                      {[...custoData]
                        .filter((r: any) => r.situacao?.toUpperCase().includes('ELEIT') && !r.situacao?.toUpperCase().includes('NÃO'))
                        .sort((a: any, b: any) => a.custo_por_voto - b.custo_por_voto)
                        .slice(0, 10)
                        .map((r: any, i: number) => (
                          <TableRow key={i} className="border-border/20">
                            <TableCell className="text-xs font-mono text-muted-foreground w-[28px]">{i + 1}</TableCell>
                            <TableCell className="text-xs font-medium">{r.candidato}</TableCell>
                            <TableCell className="text-xs font-mono text-right font-bold text-green-700">{formatBRL(Number(r.custo_por_voto))}</TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
