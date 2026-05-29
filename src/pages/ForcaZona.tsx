import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFilterStore } from '@/stores/filterStore';
import { useMvForcaZona, type ZonaForça, type CandZona } from '@/hooks/mv/useMvForcaZona';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LoadingKPIs, LoadingCards } from '@/components/eleicoes/LoadingSection';
import { formatNumber, formatPercent, getPartidoCor, getSituacaoBadge } from '@/lib/eleicoes';
import { MapPin, Trophy, Users, ChevronDown, ChevronRight, TrendingUp, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type CargoFilter = 'Todos' | 'Prefeito' | 'Vereador';

function MiniBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-1.5 bg-muted rounded-full overflow-hidden w-full">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }}
      />
    </div>
  );
}

function ZonaCard({
  zona,
  expanded,
  onToggle,
}: {
  zona: ZonaForça;
  expanded: boolean;
  onToggle: () => void;
}) {
  const navigate = useNavigate();
  const { ano } = useFilterStore();
  const [busca, setBusca] = useState('');
  const lider = zona.candidatos[0];
  const liderColor = lider ? getPartidoCor(lider.partido) : '#6b7280';
  const taxaComp = zona.qt_apto > 0 ? (zona.qt_compareceu / zona.qt_apto) * 100 : 0;

  return (
    <div
      className={cn(
        'bg-card border rounded-xl overflow-hidden transition-all duration-200',
        expanded ? 'border-primary/40 shadow-md shadow-primary/5' : 'border-border/50 hover:border-border'
      )}
    >
      {/* Cabeçalho clicável */}
      <button
        className="w-full text-left p-3 flex items-start gap-3"
        onClick={onToggle}
      >
        {/* Ícone de zona */}
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
          style={{ backgroundColor: liderColor + '20' }}
        >
          <MapPin className="w-4 h-4" style={{ color: liderColor }} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-foreground">Zona {zona.zona}</span>
            {zona.qt_apto > 0 && (
              <span className="text-[10px] text-muted-foreground">
                {formatPercent(taxaComp)} comp.
              </span>
            )}
            <span className="ml-auto text-[10px] text-muted-foreground">
              {formatNumber(zona.total_votos_zona)} votos
            </span>
          </div>

          {/* Top 3 mini preview */}
          <div className="space-y-1">
            {zona.candidatos.slice(0, 3).map((c, i) => (
              <div key={c.sq_candidato} className="flex items-center gap-1.5">
                <span className="text-[10px] text-muted-foreground w-3 shrink-0">{i + 1}</span>
                <span
                  className="text-[9px] font-bold px-1 rounded shrink-0"
                  style={{
                    backgroundColor: getPartidoCor(c.partido) + '25',
                    color: getPartidoCor(c.partido),
                  }}
                >
                  {c.partido}
                </span>
                <span className="text-[10px] font-medium truncate flex-1">{c.candidato}</span>
                <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                  {formatPercent(c.pct)}
                </span>
              </div>
            ))}
          </div>

          {/* Barra do líder */}
          {lider && (
            <div className="mt-2">
              <MiniBar pct={lider.pct} color={liderColor} />
            </div>
          )}
        </div>

        <div className="shrink-0 mt-1">
          {expanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Detalhe expandido */}
      {expanded && (
        <div className="border-t border-border/40 p-3 space-y-2">
          {/* Cabeçalho + busca */}
          <div className="flex items-center gap-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex-1">
              Ranking — Zona {zona.zona} · {zona.candidatos.length} candidatos
            </p>
          </div>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
            <Input
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar candidato…"
              className="pl-7 h-7 text-xs bg-muted/40 border-border/40"
            />
          </div>

          {/* Lista filtrada */}
          {zona.candidatos
            .filter(c => !busca || c.candidato.toLowerCase().includes(busca.toLowerCase()) || c.partido.toLowerCase().includes(busca.toLowerCase()))
            .map((c, i) => {
              const cor = getPartidoCor(c.partido);
              return (
                <div
                  key={c.sq_candidato}
                  className="flex items-center gap-2 group cursor-pointer rounded-md px-1 py-0.5 hover:bg-primary/5 transition-colors"
                  onClick={() => navigate(`/candidatos/${c.sq_candidato}/${ano}`)}
                  title="Clique para ver perfil completo"
                >
                  <span className="text-[11px] text-muted-foreground font-mono w-4 shrink-0 text-right">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[9px] font-bold px-1 rounded shrink-0" style={{ backgroundColor: cor + '25', color: cor }}>
                        {c.partido}
                      </span>
                      <span className="text-xs font-medium truncate group-hover:text-primary group-hover:underline underline-offset-2 transition-colors">
                        {c.candidato}
                      </span>
                      {i === 0 && <Trophy className="w-3 h-3 text-amber-400 shrink-0" />}
                    </div>
                    <MiniBar pct={c.pct} color={cor} />
                  </div>
                  <div className="text-right shrink-0 ml-1">
                    <p className="text-xs font-bold text-foreground font-mono">{formatNumber(c.votos)}</p>
                    <p className="text-[10px] text-muted-foreground">{formatPercent(c.pct)}</p>
                  </div>
                  <ChevronRight className="w-3 h-3 text-muted-foreground/40 group-hover:text-primary transition-colors shrink-0" />
                </div>
              );
            })}

          {zona.qt_apto > 0 && (
            <div className="pt-2 border-t border-border/20 grid grid-cols-3 gap-2">
              {[
                { label: 'Aptos', value: formatNumber(zona.qt_apto) },
                { label: 'Compareceu', value: formatNumber(zona.qt_compareceu) },
                { label: 'Taxa', value: formatPercent(taxaComp) },
              ].map(s => (
                <div key={s.label} className="text-center">
                  <p className="text-[9px] text-muted-foreground uppercase">{s.label}</p>
                  <p className="text-xs font-bold">{s.value}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ForcaZona() {
  const { municipio, ano } = useFilterStore();
  const [cargoFilter, setCargoFilter] = useState<CargoFilter>('Todos');
  const [expandedZona, setExpandedZona] = useState<number | null>(null);

  const cargo =
    cargoFilter === 'Prefeito' ? 'PREFEITO' :
    cargoFilter === 'Vereador' ? 'VEREADOR' : null;

  const { data: zonas, isLoading } = useMvForcaZona(cargo);

  const kpis = (() => {
    if (!zonas?.length) return null;
    const maisDisputada = [...zonas].sort((a, b) => {
      const margA = a.candidatos.length >= 2 ? a.candidatos[0].pct - a.candidatos[1].pct : 100;
      const margB = b.candidatos.length >= 2 ? b.candidatos[0].pct - b.candidatos[1].pct : 100;
      return margA - margB;
    })[0];
    const maisDominada = [...zonas].sort((a, b) => {
      const margA = a.candidatos.length >= 2 ? a.candidatos[0].pct - a.candidatos[1].pct : 0;
      const margB = b.candidatos.length >= 2 ? b.candidatos[0].pct - b.candidatos[1].pct : 0;
      return margB - margA;
    })[0];
    return { total: zonas.length, maisDisputada, maisDominada };
  })();

  function toggleZona(zona: number) {
    setExpandedZona(prev => (prev === zona ? null : zona));
  }

  const CARGO_TABS: CargoFilter[] = ['Todos', 'Prefeito', 'Vereador'];

  return (
    <div className="space-y-3 sm:space-y-4 max-w-[1800px] mx-auto">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
          <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
          Força por Zona
        </h1>
        <p className="text-[10px] sm:text-xs text-muted-foreground">
          {municipio || 'Goiás'} · {ano} — Dominância eleitoral por zona e colégio
        </p>
      </div>

      {/* Tabs de cargo */}
      <div className="flex gap-1">
        {CARGO_TABS.map(tab => (
          <button
            key={tab}
            onClick={() => { setCargoFilter(tab); setExpandedZona(null); }}
            className={cn(
              'px-3 py-1 text-xs rounded-md font-medium transition-colors',
              cargoFilter === tab
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* KPIs */}
      {isLoading ? (
        <LoadingKPIs count={3} />
      ) : kpis && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
          <Card className="border-border/50">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <MapPin className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-[10px] uppercase text-muted-foreground">Zonas analisadas</p>
                <p className="text-xl font-bold">{kpis.total}</p>
              </div>
            </CardContent>
          </Card>

          {kpis.maisDisputada && (
            <Card className="border-amber-500/30">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <Users className="w-4 h-4 text-amber-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase text-muted-foreground">Mais disputada</p>
                  <p className="text-sm font-bold">Zona {kpis.maisDisputada.zona}</p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {kpis.maisDisputada.candidatos[0]?.candidato}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {kpis.maisDominada && (
            <Card className="border-emerald-500/30">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <Trophy className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase text-muted-foreground">Mais dominada</p>
                  <p className="text-sm font-bold">Zona {kpis.maisDominada.zona}</p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {kpis.maisDominada.candidatos[0]?.candidato}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Grid de zonas */}
      {!municipio ? (
        <div className="text-center py-12 text-muted-foreground text-sm bg-card border border-border/50 rounded-xl">
          Selecione um município para ver a força por zona.
        </div>
      ) : isLoading ? (
        <LoadingCards count={6} />
      ) : !zonas?.length ? (
        <div className="text-center py-12 text-muted-foreground text-sm bg-card border border-border/50 rounded-xl">
          Nenhum dado encontrado para os filtros selecionados.
        </div>
      ) : (
        <div className="grid gap-2 sm:gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {zonas.map(zona => (
            <ZonaCard
              key={zona.zona}
              zona={zona}
              expanded={expandedZona === zona.zona}
              onToggle={() => toggleZona(zona.zona)}
            />
          ))}
        </div>
      )}

      <p className="text-[10px] text-muted-foreground text-right">
        {zonas?.length ?? 0} zonas · Fonte: TSE · {ano}
      </p>
    </div>
  );
}
