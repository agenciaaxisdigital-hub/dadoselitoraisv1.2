import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid } from 'recharts';
import { Download, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { exportToCSV } from '@/lib/export';
import { useFilterStore } from '@/stores/filterStore';
import { Skeleton } from '@/components/ui/skeleton';
import { useMvPerfilEleitorado, useMvTotalEleitores } from '@/hooks/mv/useMvEleitorado';

const COLORS = ['hsl(var(--primary))', '#34d399', '#f59e0b', '#f87171', '#a78bfa', '#60a5fa', '#fb923c', '#4ade80'];

function PieChartCard({ title, data }: { title: string; data: { name: string; value: number }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">{title}</h3>
      <div className="flex items-center gap-4">
        <PieChart width={120} height={120}>
          <Pie data={data} cx={55} cy={55} innerRadius={30} outerRadius={55} dataKey="value" stroke="none">
            {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
        </PieChart>
        <div className="flex-1 space-y-1.5">
          {data.slice(0, 6).map((d, i) => (
            <div key={d.name} className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
              <span className="text-[11px] text-foreground flex-1 truncate">{d.name}</span>
              <span className="text-[11px] font-mono text-muted-foreground">
                {total > 0 ? `${((d.value / total) * 100).toFixed(1)}%` : '—'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Eleitorado() {
  const { ano, municipio } = useFilterStore();
  const perfilQ = useMvPerfilEleitorado();
  const totalQ = useMvTotalEleitores();

  const perfil = perfilQ.data;
  const totalEleitores = totalQ.data || 0;

  const faixaOrdenada = useMemo(() => {
    if (!perfil?.faixaEtaria) return [];
    const ordem = ['16 anos', '17 anos', '18 a 20 anos', '21 a 24 anos', '25 a 34 anos',
      '35 a 44 anos', '45 a 59 anos', '60 a 69 anos', '70 a 79 anos', '80 a 89 anos', '90 a 98 anos', '99 anos'];
    return [...perfil.faixaEtaria].sort((a, b) => {
      const ia = ordem.findIndex(o => a.name.includes(o.split(' ')[0]));
      const ib = ordem.findIndex(o => b.name.includes(o.split(' ')[0]));
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
  }, [perfil]);

  if (perfilQ.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-64" />
        <div className="grid md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-48" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-base font-bold text-foreground">Perfil do Eleitorado</h1>
          <p className="text-xs text-muted-foreground">
            {municipio || 'Goiás'} — referência {perfil?.anoReferencia ?? ano}
          </p>
        </div>
        {perfil && (
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={() => exportToCSV(
            (perfil.genero || []).map((d: any) => ({
              Dimensão: 'Gênero', Categoria: d.name, Total: d.value,
            })).concat(
              (perfil.faixaEtaria || []).map((d: any) => ({
                Dimensão: 'Faixa Etária', Categoria: d.name, Total: d.value,
              }))
            ).concat(
              (perfil.estadoCivil || []).map((d: any) => ({
                Dimensão: 'Estado Civil', Categoria: d.name, Total: d.value,
              }))
            ).concat(
              (perfil.escolaridade || []).map((d: any) => ({
                Dimensão: 'Escolaridade', Categoria: d.name, Total: d.value,
              }))
            ),
            'perfil-eleitorado'
          )}>
            <Download className="w-3 h-3" /> CSV
          </Button>
        )}
      </div>

      {/* Total */}
      {totalEleitores > 0 && (
        <div className="rounded-xl border border-border bg-primary/5 p-4 flex items-center gap-3">
          <Users className="w-6 h-6 text-primary" />
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Total de Eleitores</div>
            <div className="text-2xl font-bold text-foreground">{totalEleitores.toLocaleString('pt-BR')}</div>
          </div>
        </div>
      )}

      {!perfil ? (
        <div className="rounded-xl border border-border p-8 text-center text-muted-foreground text-sm">
          Dados de perfil do eleitorado não disponíveis para a combinação selecionada.
        </div>
      ) : (
        <>
          {/* Gênero + Estado Civil */}
          <div className="grid md:grid-cols-2 gap-4">
            {perfil.genero.length > 0 && <PieChartCard title="Por Gênero" data={perfil.genero} />}
            {perfil.estadoCivil.length > 0 && <PieChartCard title="Por Estado Civil" data={perfil.estadoCivil} />}
          </div>

          {/* Faixa Etária */}
          {faixaOrdenada.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Faixa Etária</h3>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={faixaOrdenada} margin={{ bottom: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-30} textAnchor="end" interval={0} />
                    <YAxis tickFormatter={(v) => `${(v / 1e3).toFixed(0)}k`} tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v: number) => v.toLocaleString('pt-BR')} />
                    <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Eleitores" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Escolaridade */}
          {perfil.escolaridade.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Por Escolaridade</h3>
              <div className="space-y-2">
                {(() => {
                  const total = perfil.escolaridade.reduce((s, d) => s + d.value, 0);
                  return perfil.escolaridade.map((d, i) => {
                    const pct = total > 0 ? (d.value / total) * 100 : 0;
                    return (
                      <div key={d.name} className="flex items-center gap-3">
                        <div className="w-40 text-[11px] text-foreground truncate shrink-0" title={d.name}>{d.name}</div>
                        <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${pct}%`, background: COLORS[i % COLORS.length] }}
                          />
                        </div>
                        <div className="text-[11px] font-mono w-12 text-right text-muted-foreground">{pct.toFixed(1)}%</div>
                        <div className="text-[11px] font-mono w-20 text-right font-medium">{d.value.toLocaleString('pt-BR')}</div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
