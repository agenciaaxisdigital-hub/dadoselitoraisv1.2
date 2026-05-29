import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ChevronsUpDown, Download, Search, Star, Trash2, UserCheck } from 'lucide-react';
import { exportToCSV } from '@/lib/export';
import { useMunicipios } from '@/hooks/useEleicoes';
import { useMvSuplentes } from '@/hooks/mv/useMvSuplentes';
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

  const suplQ = useMvSuplentes(cidade, ano);

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
                <div className="flex items-center gap-2">
                  {totalMarcados > 0 && (
                    <span className="text-xs text-amber-600 font-semibold">{totalMarcados} marcado{totalMarcados !== 1 ? 's' : ''}</span>
                  )}
                  <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={() => exportToCSV(
                    (suplQ.data as any[]).map((s: any) => ({
                      Nome: s.nome || '',
                      Partido: s.partido || '',
                      Cargo: s.cargo || '',
                      Município: s.municipio || '',
                      Número: s.numero || '',
                      Votos: s.total_votos || 0,
                      Situação: s.situacao || '',
                    })),
                    'suplentes'
                  )}>
                    <Download className="w-3 h-3" /> CSV
                  </Button>
                </div>
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
