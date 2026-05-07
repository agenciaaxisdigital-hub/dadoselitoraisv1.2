import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronsUpDown, Search, Star, Trash2, UserCheck } from 'lucide-react';
import { mdQuery, getTableName } from '@/lib/motherduck';
import { useMunicipios } from '@/hooks/useEleicoes';
import { useSuplentesStore } from '@/stores/suplentesStore';
import { useFilterStore } from '@/stores/filterStore';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { getPartidoCor } from '@/lib/eleicoes';
import { cn } from '@/lib/utils';

const ANOS = [2024, 2022, 2020, 2018, 2016, 2014];


export default function Suplentes() {
  const navigate = useNavigate();
  const { suplentes, marcar, desmarcar, setObservacao } = useSuplentesStore();
  const globalFilters = useFilterStore();
  const [tab, setTab] = useState<'buscar' | 'meus'>('buscar');
  const [cidade, setCidade] = useState(globalFilters.municipio || '');
  const [openCombo, setOpenCombo] = useState(false);
  const [ano, setAno] = useState(globalFilters.ano || 2024);
  const { data: municipios = [] } = useMunicipios();

  const safe = (s: string) => s.replace(/'/g, "''");

  const suplQ = useQuery({
    queryKey: ['supls-page', ano, cidade],
    enabled: tab === 'buscar' && cidade.length >= 2,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const cidSafe = safe(cidade);
      const rs = ano === 2024 ? getTableName('rede_social', 2024) : null;
      const rsJoin = rs
        ? `LEFT JOIN (SELECT SQ_CANDIDATO, MIN(DS_URL) AS instagram_url FROM ${rs} WHERE DS_URL ILIKE '%instagram.com%' GROUP BY SQ_CANDIDATO) rs ON c.SQ_CANDIDATO = rs.SQ_CANDIDATO`
        : '';
      const rsSelect = rs ? `, rs.instagram_url` : `, NULL AS instagram_url`;

      // Tenta tabela pré-computada + rede_social
      try {
        const rows = await mdQuery(`
          SELECT p.SQ_CANDIDATO AS sq, p.NM_URNA_CANDIDATO AS nome, p.NM_CANDIDATO AS nome_completo,
                 p.SG_PARTIDO AS partido, p.DS_CARGO AS cargo, p.NM_UE AS municipio,
                 p.NR_CANDIDATO AS numero, p.total_votos${rs ? `, rs.instagram_url` : `, NULL AS instagram_url`}
          FROM my_db.ranking_pre_${ano}_GO p
          ${rs ? `LEFT JOIN (SELECT SQ_CANDIDATO, MIN(DS_URL) AS instagram_url FROM ${rs} WHERE DS_URL ILIKE '%instagram.com%' GROUP BY SQ_CANDIDATO) rs ON p.SQ_CANDIDATO = rs.SQ_CANDIDATO` : ''}
          WHERE upper(p.NM_UE) = upper('${cidSafe}')
            AND upper(p.DS_SIT_TOT_TURNO) = 'SUPLENTE'
          ORDER BY p.DS_CARGO, p.total_votos DESC
          LIMIT 300
        `);
        if (rows && (rows as any[]).length > 0) return rows;
      } catch { /* fallback abaixo */ }

      // Fallback: JOIN candidatos + votacao + rede_social
      let cand: string, vot: string;
      try { cand = getTableName('candidatos', ano); vot = getTableName('votacao', ano); } catch { return []; }
      return mdQuery(`
        SELECT c.SQ_CANDIDATO AS sq, c.NM_URNA_CANDIDATO AS nome, c.NM_CANDIDATO AS nome_completo,
               c.SG_PARTIDO AS partido, c.DS_CARGO AS cargo, c.NM_UE AS municipio,
               c.NR_CANDIDATO AS numero, COALESCE(SUM(v.QT_VOTOS_NOMINAIS), 0) AS total_votos${rsSelect}
        FROM ${cand} c
        LEFT JOIN ${vot} v ON c.SQ_CANDIDATO = v.SQ_CANDIDATO
        ${rsJoin}
        WHERE upper(c.NM_UE) = upper('${cidSafe}')
          AND upper(c.DS_SIT_TOT_TURNO) = 'SUPLENTE'
        GROUP BY c.SQ_CANDIDATO, c.NM_URNA_CANDIDATO, c.NM_CANDIDATO, c.SG_PARTIDO,
                 c.DS_CARGO, c.NM_UE, c.NR_CANDIDATO${rs ? `, rs.instagram_url` : ''}
        ORDER BY c.DS_CARGO, total_votos DESC
        LIMIT 300
      `);
    },
  });

  const meusList = useMemo(
    () => Object.values(suplentes).sort((a, b) => a.municipio.localeCompare(b.municipio) || a.cargo.localeCompare(b.cargo)),
    [suplentes]
  );

  const totalMarcados = meusList.length;

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-primary" />
            Suplentes
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">Busque suplentes por cidade e gerencie seus contatos</p>
        </div>
        {totalMarcados > 0 && (
          <Badge className="bg-amber-500 text-white border-0">
            {totalMarcados} marcado{totalMarcados !== 1 ? 's' : ''}
          </Badge>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
        <button
          onClick={() => setTab('buscar')}
          className={cn('px-4 min-h-[40px] text-sm rounded-md transition-colors flex items-center gap-1.5',
            tab === 'buscar' ? 'bg-white shadow-sm font-semibold text-foreground' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Search className="w-3.5 h-3.5" />
          Buscar por cidade
        </button>
        <button
          onClick={() => setTab('meus')}
          className={cn('px-4 min-h-[40px] text-sm rounded-md transition-colors flex items-center gap-1.5',
            tab === 'meus' ? 'bg-white shadow-sm font-semibold text-foreground' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Star className="w-3.5 h-3.5" />
          Meus suplentes
          {totalMarcados > 0 && (
            <span className="bg-amber-500 text-white text-[10px] rounded-full px-1.5 py-0.5 leading-none">{totalMarcados}</span>
          )}
        </button>
      </div>

      {/* ── TAB BUSCAR ── */}
      {tab === 'buscar' && (
        <div className="space-y-3">
          {/* Filtros */}
          <div className="bg-white rounded-xl border border-border p-3 flex flex-col sm:flex-row gap-3 items-end">
            <div className="flex-1 space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Cidade</label>
              <Popover open={openCombo} onOpenChange={setOpenCombo}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={openCombo}
                    className="w-full h-9 text-sm justify-between font-normal px-3"
                  >
                    <span className={cn('truncate', !cidade && 'text-muted-foreground')}>
                      {cidade || 'Selecione a cidade…'}
                    </span>
                    <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[min(320px,calc(100vw-24px))] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar cidade…" className="text-sm" />
                    <CommandList className="max-h-[260px]">
                      <CommandEmpty>Nenhuma cidade encontrada.</CommandEmpty>
                      <CommandGroup>
                        {municipios.map(m => (
                          <CommandItem
                            key={m}
                            value={m}
                            onSelect={() => { setCidade(m); setOpenCombo(false); }}
                            className="text-sm"
                          >
                            <Check className={cn('mr-2 h-3.5 w-3.5', cidade === m ? 'opacity-100' : 'opacity-0')} />
                            {m}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1 w-28 shrink-0">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Eleição</label>
              <select
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={ano}
                onChange={e => { setAno(Number(e.target.value)); }}
              >
                {ANOS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          </div>

          {/* Resultados */}
          {cidade.length < 2 ? (
            <div className="bg-white rounded-xl border border-border p-14 text-center">
              <UserCheck className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Selecione uma cidade para ver todos os suplentes</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Clique na ⭐ para marcar e salvar o contato</p>
            </div>
          ) : suplQ.isLoading ? (
            <div className="bg-white rounded-xl border border-border p-4 space-y-2">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-10 rounded bg-muted animate-pulse" />
              ))}
            </div>
          ) : !suplQ.data?.length ? (
            <div className="bg-white rounded-xl border border-border p-10 text-center">
              <p className="text-sm text-muted-foreground">Nenhum suplente em "{cidade}" para {ano}</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-border overflow-hidden">
              <div className="px-4 py-2.5 bg-slate-50 border-b border-border flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  {(suplQ.data as any[]).length} suplente{(suplQ.data as any[]).length !== 1 ? 's' : ''} — {cidade} · {ano}
                </span>
                {totalMarcados > 0 && (
                  <span className="text-xs text-amber-600 font-semibold">{totalMarcados} marcado{totalMarcados !== 1 ? 's' : ''}</span>
                )}
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/20">
                      <TableHead className="w-7 px-1"></TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider">Candidato</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider">Partido</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider">Cargo</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider text-right">Votos</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider">Cidade</TableHead>
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
                          onClick={() => navigate(`/candidatos/${sq}/${ano}`)}
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
                                    ano,
                                    instagramUrl: item.instagram_url ? String(item.instagram_url) : '',
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
                            <div className="font-semibold text-foreground text-sm flex items-center gap-1.5">
                              {item.nome}
                              {marcado && <span className="text-[8px] px-1 py-0.5 rounded bg-amber-500 text-white font-bold leading-none">SUPL</span>}
                            </div>
                            {item.nome_completo && item.nome_completo !== item.nome && (
                              <p className="text-[10px] text-muted-foreground">{item.nome_completo}</p>
                            )}
                          </TableCell>
                          <TableCell className="px-2 py-2">
                            <span className="text-xs font-bold px-1.5 py-0.5 rounded"
                              style={{ backgroundColor: getPartidoCor(item.partido) + '20', color: getPartidoCor(item.partido) }}>
                              {item.partido}
                            </span>
                          </TableCell>
                          <TableCell className="px-2 py-2 text-xs text-muted-foreground">{item.cargo}</TableCell>
                          <TableCell className="px-2 py-2 text-xs font-mono text-right font-semibold text-foreground">
                            {item.total_votos ? Number(item.total_votos).toLocaleString('pt-BR') : '—'}
                          </TableCell>
                          <TableCell className="px-2 py-2 text-xs text-muted-foreground">{item.municipio}</TableCell>
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

      {/* ── TAB MEUS SUPLENTES ── */}
      {tab === 'meus' && (
        <div>
          {meusList.length === 0 ? (
            <div className="bg-white rounded-xl border border-border p-14 text-center space-y-2">
              <Star className="w-8 h-8 text-muted-foreground/20 mx-auto" />
              <p className="text-sm text-muted-foreground">Nenhum suplente marcado.</p>
              <p className="text-xs text-muted-foreground/60">Use "Buscar por cidade" e clique na ⭐.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-border overflow-hidden">
              <div className="px-4 py-2.5 bg-slate-50 border-b border-border">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  {meusList.length} marcado{meusList.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[10px] text-slate-500">Nome</TableHead>
                      <TableHead className="text-[10px] text-slate-500">Partido</TableHead>
                      <TableHead className="text-[10px] text-slate-500">Cargo</TableHead>
                      <TableHead className="text-[10px] text-slate-500">Cidade</TableHead>
                      <TableHead className="text-[10px] text-slate-500">Ano</TableHead>
                      <TableHead className="text-[10px] text-slate-500">Obs.</TableHead>
                      <TableHead className="w-[60px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {meusList.map((s) => (
                      <TableRow
                        key={s.sq}
                        className="border-border/20 hover:bg-muted/20 cursor-pointer"
                        onClick={() => navigate(`/candidatos/${s.sq}/${s.ano}`)}
                      >
                        <TableCell className="py-2">
                          <div className="text-sm font-medium text-slate-900">{s.nomeUrna || s.nome}</div>
                          {s.nome && s.nomeUrna && s.nome !== s.nomeUrna && (
                            <div className="text-[10px] text-muted-foreground">{s.nome}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-xs font-mono">{s.partido}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{s.cargo}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{s.municipio}</TableCell>
                        <TableCell className="text-xs font-mono">{s.ano}</TableCell>
                        <TableCell className="py-1" onClick={e => e.stopPropagation()}>
                          <Input
                            className="h-8 text-xs w-[120px]"
                            placeholder="Anotação…"
                            value={s.observacao}
                            onChange={e => setObservacao(s.sq, e.target.value)}
                          />
                        </TableCell>
                        <TableCell className="py-1" onClick={e => e.stopPropagation()}>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs gap-1 text-red-600 border-red-200 hover:bg-red-50"
                            onClick={() => desmarcar(s.sq)}
                          >
                            <Trash2 className="w-3 h-3" />
                            Remover
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
