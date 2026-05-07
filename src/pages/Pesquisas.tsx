import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { mdQuery, getTableName, getAnosDisponiveis, sqlSafe } from '@/lib/motherduck';
import { useFilterStore } from '@/stores/filterStore';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { FlaskConical } from 'lucide-react';

function usePesquisas(municipio: string) {
  return useQuery({
    queryKey: ['pesquisas', municipio],
    enabled: getAnosDisponiveis('pesquisa_eleitoral').includes(2024),
    staleTime: 60 * 60 * 1000,
    queryFn: async () => {
      const tab = getTableName('pesquisa_eleitoral', 2024);
      const munCond = municipio ? `AND NM_MUNICIPIO = '${sqlSafe(municipio)}'` : '';
      return mdQuery(`
        SELECT *
        FROM ${tab}
        WHERE SG_UF = 'GO' ${munCond}
        ORDER BY DT_FIM_PESQUISA DESC
        LIMIT 200
      `);
    },
  });
}

function usePesquisaContratantes(municipio: string) {
  return useQuery({
    queryKey: ['pesquisa-contratantes', municipio],
    enabled: getAnosDisponiveis('pesquisa_contratante').includes(2024),
    staleTime: 60 * 60 * 1000,
    queryFn: async () => {
      const tab = getTableName('pesquisa_contratante', 2024);
      const pesqTab = getTableName('pesquisa_eleitoral', 2024);
      const munCond = municipio ? `AND p.NM_MUNICIPIO = '${sqlSafe(municipio)}'` : '';
      return mdQuery(`
        SELECT c.*, p.NM_MUNICIPIO, p.DS_CARGO, p.DT_FIM_PESQUISA
        FROM ${tab} c
        INNER JOIN ${pesqTab} p ON c.ID_PESQUISA = p.ID_PESQUISA
        WHERE p.SG_UF = 'GO' ${munCond}
        ORDER BY p.DT_FIM_PESQUISA DESC
        LIMIT 200
      `);
    },
  });
}

function formatDate(val: string | null | undefined) {
  if (!val) return '—';
  const s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const [y, m, d] = s.split('-');
    return `${d.slice(0, 2)}/${m}/${y}`;
  }
  return s;
}

function getColValue(row: any, candidates: string[]): string {
  for (const c of candidates) {
    if (row[c] !== undefined && row[c] !== null && row[c] !== '') return String(row[c]);
    const lower = c.toLowerCase();
    const key = Object.keys(row).find(k => k.toLowerCase() === lower);
    if (key && row[key] !== undefined && row[key] !== null && row[key] !== '') return String(row[key]);
  }
  return '—';
}

export default function Pesquisas() {
  const municipio = useFilterStore((s) => s.municipio);
  const ano = useFilterStore((s) => s.ano);

  const pesqQ = usePesquisas(municipio);
  const contQ = usePesquisaContratantes(municipio);

  const pesquisas = (pesqQ.data || []) as any[];
  const contratantes = (contQ.data || []) as any[];

  const available = getAnosDisponiveis('pesquisa_eleitoral').includes(2024);

  const registrosPorMes = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of pesquisas) {
      const dt = getColValue(p, ['DT_FIM_PESQUISA', 'dt_fim_pesquisa']);
      if (dt === '—') continue;
      const mes = dt.length >= 7 ? dt.slice(0, 7) : dt.slice(0, 7);
      map.set(mes, (map.get(mes) || 0) + 1);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([mes, total]) => ({ mes, total }));
  }, [pesquisas]);

  const cargoStats = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of pesquisas) {
      const cargo = getColValue(p, ['DS_CARGO', 'ds_cargo']);
      if (cargo === '—') continue;
      map.set(cargo, (map.get(cargo) || 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]).map(([cargo, total]) => ({ cargo, total }));
  }, [pesquisas]);

  if (!available || ano !== 2024) {
    return (
      <div className="p-8 text-center text-muted-foreground space-y-3">
        <FlaskConical className="w-10 h-10 mx-auto opacity-30" />
        <p className="text-sm font-medium">Pesquisas eleitorais disponíveis apenas para 2024</p>
        <p className="text-xs">Selecione o ano 2024 no filtro global para acessar este módulo.</p>
      </div>
    );
  }

  if (pesqQ.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-base font-bold text-foreground">Pesquisas Eleitorais</h1>
        <p className="text-xs text-muted-foreground">Registro TSE de pesquisas — {municipio || 'Goiás'} · 2024</p>
      </div>

      {/* Summary badges */}
      <div className="flex gap-2 flex-wrap">
        <Badge variant="outline" className="text-xs">{pesquisas.length} pesquisas registradas</Badge>
        {municipio && <Badge variant="outline" className="text-xs">{municipio}</Badge>}
        <Badge className="bg-primary/10 text-primary text-xs">{contratantes.length} contratos</Badge>
      </div>

      {pesquisas.length === 0 ? (
        <div className="rounded-xl border border-border p-8 text-center text-muted-foreground text-sm">
          Nenhuma pesquisa encontrada {municipio ? `para ${municipio}` : 'para Goiás'} em 2024.
        </div>
      ) : (
        <>
          {/* Charts */}
          <div className="grid md:grid-cols-2 gap-4">
            {registrosPorMes.length > 0 && (
              <div className="rounded-xl border border-border bg-card p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Pesquisas por Mês</h3>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={registrosPorMes}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Pesquisas" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
            {cargoStats.length > 0 && (
              <div className="rounded-xl border border-border bg-card p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Por Cargo Disputado</h3>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={cargoStats.slice(0, 8)} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                      <YAxis type="category" dataKey="cargo" width={120} tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="total" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} name="Pesquisas" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>

          {/* Tabela de pesquisas */}
          <div className="rounded-xl border border-border overflow-hidden">
            <div className="px-3 py-2 bg-muted/40 border-b text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Registro de Pesquisas
            </div>
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead className="text-[10px]">ID</TableHead>
                    <TableHead className="text-[10px]">Município</TableHead>
                    <TableHead className="text-[10px]">Cargo</TableHead>
                    <TableHead className="text-[10px]">Início</TableHead>
                    <TableHead className="text-[10px]">Fim</TableHead>
                    <TableHead className="text-[10px]">Instituto</TableHead>
                    <TableHead className="text-[10px] text-right">Entrevistados</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pesquisas.map((p: any, i: number) => (
                    <TableRow key={i} className="border-border/20">
                      <TableCell className="text-xs font-mono text-muted-foreground">{getColValue(p, ['ID_PESQUISA', 'id_pesquisa'])}</TableCell>
                      <TableCell className="text-xs">{getColValue(p, ['NM_MUNICIPIO', 'nm_municipio'])}</TableCell>
                      <TableCell className="text-xs">{getColValue(p, ['DS_CARGO', 'ds_cargo'])}</TableCell>
                      <TableCell className="text-xs font-mono">{formatDate(getColValue(p, ['DT_INICIO_PESQUISA', 'dt_inicio_pesquisa']))}</TableCell>
                      <TableCell className="text-xs font-mono">{formatDate(getColValue(p, ['DT_FIM_PESQUISA', 'dt_fim_pesquisa']))}</TableCell>
                      <TableCell className="text-sm max-w-[200px] truncate" title={getColValue(p, ['NM_EMPRESA_PESQUISA', 'nm_empresa_pesquisa'])}>
                        {getColValue(p, ['NM_EMPRESA_PESQUISA', 'nm_empresa_pesquisa'])}
                      </TableCell>
                      <TableCell className="text-xs font-mono text-right">
                        {(() => {
                          const v = getColValue(p, ['QT_ENTREVISTADOS', 'qt_entrevistados']);
                          return v !== '—' ? Number(v).toLocaleString('pt-BR') : '—';
                        })()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Contratantes */}
          {contratantes.length > 0 && (
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="px-3 py-2 bg-muted/40 border-b text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Contratantes
              </div>
              <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead className="text-[10px]">ID Pesquisa</TableHead>
                      <TableHead className="text-[10px]">Contratante</TableHead>
                      <TableHead className="text-[10px]">Município</TableHead>
                      <TableHead className="text-[10px]">Cargo</TableHead>
                      <TableHead className="text-[10px]">Data Fim</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contratantes.map((c: any, i: number) => (
                      <TableRow key={i} className="border-border/20">
                        <TableCell className="text-xs font-mono text-muted-foreground">{getColValue(c, ['ID_PESQUISA', 'id_pesquisa'])}</TableCell>
                        <TableCell className="text-sm max-w-[200px] truncate">{getColValue(c, ['NM_CONTRATANTE', 'nm_contratante'])}</TableCell>
                        <TableCell className="text-xs">{getColValue(c, ['NM_MUNICIPIO', 'nm_municipio'])}</TableCell>
                        <TableCell className="text-xs">{getColValue(c, ['DS_CARGO', 'ds_cargo'])}</TableCell>
                        <TableCell className="text-xs font-mono">{formatDate(getColValue(c, ['DT_FIM_PESQUISA', 'dt_fim_pesquisa']))}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
