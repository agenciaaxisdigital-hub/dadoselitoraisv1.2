import { useState, useMemo, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { mdQuery, getTableName, getAnosDisponiveis, isEleicaoGeral } from '@/lib/motherduck';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Search, User, Landmark, GraduationCap, ChevronRight, Star, MessageCircle, Copy, Check, Trash2, UserCheck } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useSuplentesStore } from '@/stores/suplentesStore';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { traduzirSituacao } from '@/lib/eleicoes';
import CandidatoPerfil from './CandidatoPerfil';

/**
 * Busca candidatos de UM ano específico (rápido).
 * Para eleições gerais: mostra todos de GO.
 * Para municipais: filtra pelo município selecionado.
 */
function useCandidatos(ano: number, municipio: string, cargo: string | null, partido: string | null, busca: string) {
  return useQuery({
    queryKey: ['candidatos-md', ano, municipio, cargo, partido],
    queryFn: async () => {
      const tab = getTableName('candidatos', ano);
      const geral = isEleicaoGeral(ano);
      const conds: string[] = [`SG_UF = 'GO'`, `NR_TURNO = 1`];

      const b = busca.toLowerCase().trim();
      // Quando há busca textual, expande para Goiás inteiro (ignora filtro de município)
      const ignorarMunicipio = !!b;

      if (!geral && municipio !== '_todos' && !ignorarMunicipio) conds.push(`NM_UE = '${municipio}'`);
      if (cargo) conds.push(`DS_CARGO = '${cargo}'`);
      if (partido) conds.push(`SG_PARTIDO = '${partido}'`);

      if (b) {
        const normalizeSQL = (str: string) => str.replace(/['"]/g, '');
        const val = normalizeSQL(b);
        conds.push(`(NM_URNA_CANDIDATO ILIKE '%${val}%' OR NM_CANDIDATO ILIKE '%${val}%' OR NR_CANDIDATO::VARCHAR LIKE '%${val}%' OR SG_PARTIDO ILIKE '%${val}%')`);
      }

      const sql = `
        SELECT
          SQ_CANDIDATO AS id,
          NM_CANDIDATO AS nome_completo,
          NM_URNA_CANDIDATO AS nome_urna,
          DS_CARGO AS cargo,
          NR_CANDIDATO AS numero_urna,
          SG_PARTIDO AS sigla_partido,
          DS_SIT_TOT_TURNO AS situacao_final,
          DS_GRAU_INSTRUCAO AS grau_instrucao,
          DS_GENERO AS genero,
          DS_COR_RACA AS cor_raca,
          DS_OCUPACAO AS ocupacao,
          DT_NASCIMENTO AS data_nascimento,
          NM_PARTIDO AS nome_partido,
          NM_UE AS municipio_candidato,
          ${ano} AS ano_eleicao
        FROM ${tab}
        WHERE ${conds.join(' AND ')}
        ORDER BY NM_URNA_CANDIDATO
        LIMIT ${b ? 1000 : 300}
      `;

      return await mdQuery<any>(sql);
    },
    enabled: !!municipio,
    staleTime: 15 * 60 * 1000,
  });
}


// Anos disponíveis para candidatos, do mais recente ao mais antigo
const ANOS_CANDIDATOS = [2024, 2022, 2020, 2018, 2016, 2014];

// Cargos por tipo de eleição
const CARGOS_MUNICIPAIS = ['PREFEITO', 'VICE-PREFEITO', 'VEREADOR'];
const CARGOS_GERAIS = ['GOVERNADOR', 'VICE-GOVERNADOR', 'SENADOR', 'DEPUTADO FEDERAL', 'DEPUTADO ESTADUAL'];

function PerfilCandidatosList() {
  const [ano, setAno] = useState(2024);
  const [municipio, setMunicipio] = useState('APARECIDA DE GOIÂNIA');
  const [cargo, setCargo] = useState<string | null>(null);
  const [partido, setPartido] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [buscaDebounced, setBuscaDebounced] = useState('');

  // Debounce manual do campo busca para a query no banco
  useEffect(() => {
    const handler = setTimeout(() => setBuscaDebounced(busca), 400);
    return () => clearTimeout(handler);
  }, [busca]);

  const { data: candidatos, isLoading, isError } = useCandidatos(ano, municipio, cargo, partido, buscaDebounced);

  const geral = isEleicaoGeral(ano);
  const cargosDisponiveis = geral ? CARGOS_GERAIS : CARGOS_MUNICIPAIS;

  // Reset cargo when switching year type
  const handleAnoChange = (novoAno: string) => {
    const a = Number(novoAno);
    const eraGeral = isEleicaoGeral(ano);
    const seraGeral = isEleicaoGeral(a);
    if (eraGeral !== seraGeral) setCargo(null);
    setAno(a);
  };

  const filtered = useMemo(() => {
    if (!candidatos) return [];
    if (!busca) return candidatos;
    const q = busca.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return candidatos.filter((c: any) => {
      const normalize = (s: string | null) =>
        s ? s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') : '';
      return (
        normalize(c.nome_completo).includes(q) ||
        normalize(c.nome_urna).includes(q) ||
        normalize(c.sigla_partido).includes(q) ||
        normalize(c.cargo).includes(q) ||
        c.numero_urna?.toString().includes(busca)
      );
    });
  }, [candidatos, busca]);

  const porCargo = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const c of filtered) {
      const cargo = c.cargo || 'Outros';
      if (!map.has(cargo)) map.set(cargo, []);
      map.get(cargo)!.push(c);
    }
    const order = ['PREFEITO', 'VICE-PREFEITO', 'VEREADOR', 'GOVERNADOR', 'VICE-GOVERNADOR', 'SENADOR', 'DEPUTADO FEDERAL', 'DEPUTADO ESTADUAL'];
    return Array.from(map.entries()).sort((a, b) => {
      const ia = order.indexOf(a[0].toUpperCase());
      const ib = order.indexOf(b[0].toUpperCase());
      if (ia >= 0 && ib >= 0) return ia - ib;
      if (ia >= 0) return -1;
      if (ib >= 0) return 1;
      return a[0].localeCompare(b[0]);
    });
  }, [filtered]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="h-8 w-64 rounded bg-muted animate-pulse" />
        <div className="h-9 w-full rounded bg-muted animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[...Array(9)].map((_, i) => (
            <div key={i} className="h-28 rounded-xl bg-card border border-border/50 p-3 space-y-2 animate-fade-in" style={{ animationDelay: `${i * 50}ms` }}>
              <div className="h-4 w-3/4 rounded bg-muted animate-pulse" />
              <div className="h-3 w-1/2 rounded bg-muted animate-pulse" />
              <div className="flex gap-2"><div className="h-4 w-12 rounded bg-muted animate-pulse" /><div className="h-4 w-16 rounded bg-muted animate-pulse" /></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-3">
        <h1 className="text-lg font-bold text-foreground">Painel de Candidatos</h1>
        <Card><CardContent className="p-8 text-center">
          <User className="w-10 h-10 mx-auto text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground">Erro ao carregar candidatos. Tente novamente.</p>
        </CardContent></Card>
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-base sm:text-lg font-bold text-foreground">Painel de Candidatos</h1>
          <p className="text-[10px] sm:text-xs text-muted-foreground">
            {geral ? 'Goiás (eleição geral)' : municipio === '_todos' ? 'Goiás (todos os municípios)' : municipio} — {ano} • Fonte: TSE / MotherDuck
          </p>
        </div>
        <Badge variant="secondary" className="text-[10px]">
          {filtered.length >= 1000 ? '+1000 candidatos' : `${filtered.length} candidato${filtered.length !== 1 ? 's' : ''}`}
        </Badge>
      </div>

      <div className="bg-card text-card-foreground p-3 rounded-xl border shadow-sm flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="space-y-1 w-full md:w-auto">
          <Label htmlFor="perfil-ano" className="text-xs">Ano</Label>
          <Select value={String(ano)} onValueChange={handleAnoChange}>
            <SelectTrigger id="perfil-ano" className="h-9 text-sm w-full sm:w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ANOS_CANDIDATOS.filter(a => getAnosDisponiveis('candidatos').includes(a)).map(a => (
                <SelectItem key={a} value={String(a)}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {!geral && (
          <div className="space-y-1 flex-1">
            <Label htmlFor="perfil-municipio" className="text-xs">Município</Label>
            <Select value={municipio} onValueChange={setMunicipio}>
              <SelectTrigger id="perfil-municipio" className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_todos">Todos de Goiás</SelectItem>
                <SelectItem value="APARECIDA DE GOIÂNIA">Aparecida de Goiânia</SelectItem>
                <SelectItem value="GOIÂNIA">Goiânia</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="space-y-1 flex-1">
          <Label htmlFor="perfil-cargo" className="text-xs">Cargo</Label>
          <Select value={cargo || 'todos'} onValueChange={(v) => setCargo(v === 'todos' ? null : v)}>
            <SelectTrigger id="perfil-cargo" className="h-9 text-sm">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {cargosDisponiveis.map(c => (
                <SelectItem key={c} value={c}>{c.charAt(0) + c.slice(1).toLowerCase()}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1 flex-[2]">
          <Label htmlFor="perfil-busca" className="text-xs">Buscar candidato</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="perfil-busca"
              placeholder="Nome, partido ou número..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>
        </div>
      </div>

      {porCargo.length === 0 ? (
        <Card><CardContent className="p-8 text-center">
          <User className="w-10 h-10 mx-auto text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground">Nenhum candidato encontrado.</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-5">
          {porCargo.map(([cargo, lista]) => (
            <div key={cargo}>
              <div className="flex items-center gap-2 mb-2">
                <Landmark className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-bold text-foreground">{cargo}</h2>
                <Badge variant="outline" className="text-[9px] h-4">{lista.length}</Badge>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {lista.map((c: any) => (
                  <CandidatoCard key={`${c.id}-${c.ano_eleicao}`} c={c} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function getSitColor(sit: string | null) {
  if (!sit) return 'bg-muted text-muted-foreground';
  const s = sit.toUpperCase();
  if (s.includes('ELEIT') || s.includes('MÉDIA')) return 'bg-green-100 text-green-700 border-green-200';
  if (s.includes('TURNO') || s.includes('2º')) return 'bg-blue-100 text-blue-700 border-blue-200';
  if (s.includes('SUPLENTE')) return 'bg-amber-100 text-amber-700 border-amber-200';
  if (s.includes('NÃO ELEIT')) return 'bg-red-100 text-red-700 border-red-200';
  return 'bg-muted text-muted-foreground';
}

function calcIdade(nasc: string | null): number | null {
  if (!nasc) return null;
  try {
    const parts = nasc.split('/');
    if (parts.length === 3) {
      const dt = new Date(+parts[2], +parts[1] - 1, +parts[0]);
      return Math.floor((Date.now() - dt.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    }
    const dt = new Date(nasc);
    if (!isNaN(dt.getTime())) return Math.floor((Date.now() - dt.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    return null;
  } catch { return null; }
}

function CandidatoCard({ c }: { c: any }) {
  const idade = calcIdade(c.data_nascimento);
  const { suplentes, marcar, desmarcar } = useSuplentesStore();
  const sq = String(c.id);
  const marcado = !!suplentes[sq];

  function handleToggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (marcado) {
      desmarcar(sq);
    } else {
      marcar({
        sq,
        nome: String(c.nome_completo || ''),
        nomeUrna: String(c.nome_urna || ''),
        partido: String(c.sigla_partido || ''),
        cargo: String(c.cargo || ''),
        municipio: String(c.municipio_candidato || ''),
        numero: c.numero_urna,
        situacao: String(c.situacao_final || ''),
        ano: c.ano_eleicao,
      });
    }
  }

  return (
    <div className="relative">
      <Link to={`/candidatos/${c.id}/${c.ano_eleicao}`} className="block">
        <Card className={cn(
          "border-border/50 hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer group",
          marcado && "border-amber-300/70 bg-amber-50/30"
        )}>
          <CardContent className="p-3 pr-8">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                <User className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <p className="text-xs font-bold truncate group-hover:text-primary transition-colors">
                    {c.nome_urna || c.nome_completo}
                  </p>
                  <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                {c.nome_urna && c.nome_completo && c.nome_completo !== c.nome_urna && (
                  <p className="text-[10px] text-muted-foreground truncate">{c.nome_completo}</p>
                )}
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <Badge variant="outline" className="text-[9px] h-4 font-bold">{c.sigla_partido}</Badge>
                  <span className="text-[10px] text-muted-foreground font-mono">Nº {c.numero_urna}</span>
                  {c.municipio_candidato && (
                    <span className="text-[9px] text-muted-foreground truncate max-w-[100px]">{c.municipio_candidato}</span>
                  )}
                  {c.situacao_final && (
                    <Badge className={cn("text-[8px] h-4 border", getSitColor(c.situacao_final))}>
                      {traduzirSituacao(c.situacao_final)}
                    </Badge>
                  )}
                  {marcado && (
                    <Badge className="text-[8px] h-4 bg-amber-500 text-white border-0">SUPLENTE</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground flex-wrap">
                  {c.genero && <span>{c.genero}</span>}
                  {idade && <span>• {idade} anos</span>}
                  {c.grau_instrucao && (
                    <span className="flex items-center gap-0.5">
                      <GraduationCap className="w-3 h-3" />{c.grau_instrucao}
                    </span>
                  )}
                </div>
                {c.ocupacao && (
                  <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{c.ocupacao}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>
      <button
        onClick={handleToggle}
        className="absolute top-2 right-2 z-10 p-1 rounded-full hover:bg-amber-100 transition-colors"
        title={marcado ? 'Remover suplente' : 'Marcar como suplente'}
      >
        <Star className={cn(
          "w-3.5 h-3.5 transition-colors",
          marcado ? "fill-amber-500 text-amber-500" : "text-muted-foreground/25 hover:text-amber-400"
        )} />
      </button>
    </div>
  );
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
      title="Copiar"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function MeusSuplentesTab() {
  const { suplentes, desmarcar, setTelefone, setObservacao } = useSuplentesStore();
  const list = useMemo(
    () => Object.values(suplentes).sort((a, b) => a.municipio.localeCompare(b.municipio) || a.cargo.localeCompare(b.cargo)),
    [suplentes]
  );

  if (list.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <UserCheck className="w-10 h-10 text-muted-foreground/20 mb-3" />
        <p className="text-sm text-muted-foreground">Nenhum suplente marcado ainda.</p>
        <p className="text-xs text-muted-foreground/60 mt-1">
          Clique na ☆ no canto de qualquer card para marcar como suplente.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-border overflow-hidden">
      <div className="px-4 py-2.5 bg-slate-50 border-b border-border">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          {list.length} suplente{list.length !== 1 ? 's' : ''} marcado{list.length !== 1 ? 's' : ''}
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
              <TableHead className="text-[10px] text-slate-500">Telefone</TableHead>
              <TableHead className="text-[10px] text-slate-500">Observação</TableHead>
              <TableHead className="text-[10px] text-slate-500 w-[90px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map((s) => (
              <TableRow key={s.sq} className="border-border/20">
                <TableCell className="py-2">
                  <Link to={`/candidatos/${s.sq}/${s.ano}`} className="text-sm font-medium text-slate-900 hover:text-primary transition-colors">
                    {s.nomeUrna || s.nome}
                  </Link>
                  {s.nome && s.nomeUrna && s.nome !== s.nomeUrna && (
                    <div className="text-[10px] text-muted-foreground">{s.nome}</div>
                  )}
                </TableCell>
                <TableCell className="text-xs font-mono text-slate-600">{s.partido}</TableCell>
                <TableCell className="text-xs text-slate-600">{s.cargo}</TableCell>
                <TableCell className="text-xs text-slate-600">{s.municipio}</TableCell>
                <TableCell className="text-xs font-mono text-slate-600">{s.ano}</TableCell>
                <TableCell className="py-1">
                  <div className="flex items-center gap-1">
                    <Input
                      className="h-7 text-xs w-[120px]"
                      placeholder="(62) 99999-9999"
                      value={s.telefone}
                      onChange={e => setTelefone(s.sq, e.target.value)}
                    />
                    {s.telefone && (
                      <>
                        <CopyBtn text={s.telefone} />
                        <a
                          href={`https://wa.me/55${s.telefone.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 rounded hover:bg-green-50 text-green-600 transition-colors"
                          title="Abrir WhatsApp"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                        </a>
                      </>
                    )}
                  </div>
                </TableCell>
                <TableCell className="py-1">
                  <Input
                    className="h-7 text-xs w-[140px]"
                    placeholder="Anotação…"
                    value={s.observacao}
                    onChange={e => setObservacao(s.sq, e.target.value)}
                  />
                </TableCell>
                <TableCell className="py-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1 text-red-600 border-red-200 hover:bg-red-50"
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
  );
}

export default function PerfilCandidatos() {
  const { id } = useParams<{ id?: string }>();
  const [tab, setTab] = useState<'buscar' | 'suplentes'>('buscar');
  const { suplentes } = useSuplentesStore();
  const totalMarcados = Object.keys(suplentes).length;

  if (id) return <CandidatoPerfil />;

  return (
    <div className="space-y-4">
      <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
        <button
          onClick={() => setTab('buscar')}
          className={cn(
            'px-4 py-1.5 text-sm rounded-md transition-colors',
            tab === 'buscar' ? 'bg-white shadow-sm font-semibold text-foreground' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          Buscar Candidatos
        </button>
        <button
          onClick={() => setTab('suplentes')}
          className={cn(
            'px-4 py-1.5 text-sm rounded-md transition-colors flex items-center gap-1.5',
            tab === 'suplentes' ? 'bg-white shadow-sm font-semibold text-foreground' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <UserCheck className="w-3.5 h-3.5" />
          Meus Suplentes
          {totalMarcados > 0 && (
            <span className="bg-amber-500 text-white text-[10px] rounded-full px-1.5 py-0.5 leading-none">
              {totalMarcados}
            </span>
          )}
        </button>
      </div>

      {tab === 'buscar' ? <PerfilCandidatosList /> : <MeusSuplentesTab />}
    </div>
  );
}
