import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { PageLoader } from '@/components/eleicoes/PageLoader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatNumber } from '@/lib/eleicoes';
import {
  ShieldCheck, Users, CheckCircle2, XCircle, Clock, AlertTriangle,
  Search, RefreshCw, LogOut, ChevronRight,
} from 'lucide-react';

interface ClienteRow {
  tenant_id: string;
  tenant_name: string;
  email: string;
  full_name: string;
  role: string;
  sub_status: string | null;
  sub_end: string | null;
  created_at: string;
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <Badge variant="outline" className="text-[9px] text-muted-foreground">Sem plano</Badge>;
  const map: Record<string, { label: string; cls: string }> = {
    active:   { label: 'Ativo',       cls: 'bg-emerald-500/15 text-emerald-700 border-emerald-300/40' },
    trialing: { label: 'Trial',       cls: 'bg-amber-500/15 text-amber-700 border-amber-300/40' },
    past_due: { label: 'Vencido',     cls: 'bg-orange-500/15 text-orange-700 border-orange-300/40' },
    canceled: { label: 'Cancelado',   cls: 'bg-red-500/15 text-red-700 border-red-300/40' },
    incomplete:{ label: 'Incompleto', cls: 'bg-slate-500/15 text-slate-700 border-slate-300/40' },
  };
  const s = map[status] ?? { label: status, cls: 'bg-muted text-muted-foreground border-border' };
  return (
    <Badge variant="outline" className={`text-[9px] font-semibold border ${s.cls}`}>{s.label}</Badge>
  );
}

export default function Admin() {
  const { isSuperAdmin, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [clientes, setClientes] = useState<ClienteRow[]>([]);
  const [busca, setBusca] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !isSuperAdmin) navigate('/', { replace: true });
  }, [authLoading, isSuperAdmin]);

  useEffect(() => {
    if (!authLoading && isSuperAdmin) loadClientes();
  }, [authLoading, isSuperAdmin]);

  async function loadClientes() {
    setIsLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select(`
        id, full_name, email, role, created_at, tenant_id,
        tenants(id, name),
        subscriptions(status, current_period_end)
      `)
      .order('created_at', { ascending: false })
      .limit(200);

    const rows: ClienteRow[] = (data ?? []).map((p: any) => ({
      tenant_id: p.tenant_id ?? '',
      tenant_name: p.tenants?.name ?? '—',
      email: p.email ?? '—',
      full_name: p.full_name ?? '—',
      role: p.role,
      sub_status: p.subscriptions?.[0]?.status ?? null,
      sub_end: p.subscriptions?.[0]?.current_period_end ?? null,
      created_at: p.created_at,
    }));

    setClientes(rows);
    setIsLoading(false);
  }

  if (authLoading) return <PageLoader label="Verificando acesso…" />;
  if (!isSuperAdmin) return null;

  const filtered = busca
    ? clientes.filter(c =>
        c.email.toLowerCase().includes(busca.toLowerCase()) ||
        c.full_name.toLowerCase().includes(busca.toLowerCase()) ||
        c.tenant_name.toLowerCase().includes(busca.toLowerCase())
      )
    : clientes;

  const kpis = {
    total: clientes.length,
    ativos: clientes.filter(c => c.sub_status === 'active').length,
    trial: clientes.filter(c => c.sub_status === 'trialing').length,
    cancelados: clientes.filter(c => c.sub_status === 'canceled').length,
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 px-6 py-3 flex items-center justify-between sticky top-0 bg-background/95 backdrop-blur z-10">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
            <ShieldCheck className="w-4 h-4 text-white" />
          </div>
          <div>
            <span className="font-extrabold text-sm text-foreground">SET</span>
            <span className="font-extrabold text-sm text-primary">POLITIC</span>
            <span className="ml-2 text-xs text-muted-foreground">/ Admin</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={loadClientes} className="h-7 text-xs gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" /> Atualizar
          </Button>
          <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="h-7 text-xs gap-1.5">
            <ChevronRight className="w-3.5 h-3.5" /> App
          </Button>
          <Button variant="ghost" size="sm" onClick={() => supabase.auth.signOut().then(() => navigate('/login'))} className="h-7 text-xs gap-1.5 text-muted-foreground">
            <LogOut className="w-3.5 h-3.5" /> Sair
          </Button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        <h1 className="text-xl font-bold text-foreground">Painel Administrativo</h1>

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total usuários', value: kpis.total, icon: Users, color: 'text-primary' },
            { label: 'Assinaturas ativas', value: kpis.ativos, icon: CheckCircle2, color: 'text-emerald-600' },
            { label: 'Em trial', value: kpis.trial, icon: Clock, color: 'text-amber-600' },
            { label: 'Cancelados', value: kpis.cancelados, icon: XCircle, color: 'text-red-500' },
          ].map(k => (
            <div key={k.label} className="bg-card border border-border/50 rounded-xl p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <k.icon className={`w-4 h-4 ${k.color}`} />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase">{k.label}</p>
                <p className="text-xl font-bold">{k.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Busca */}
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar por e-mail, nome…"
            className="pl-9 h-8 text-xs"
            value={busca}
            onChange={e => setBusca(e.target.value)}
          />
        </div>

        {/* Tabela */}
        <div className="bg-card border border-border/50 rounded-xl overflow-hidden">
          {isLoading ? (
            <div className="p-12 text-center text-muted-foreground text-sm">Carregando…</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground text-sm">Nenhum usuário encontrado.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/30 bg-muted/30">
                    <th className="px-4 py-2.5 text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Usuário</th>
                    <th className="px-4 py-2.5 text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold hide-mobile">Conta</th>
                    <th className="px-4 py-2.5 text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Status</th>
                    <th className="px-4 py-2.5 text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold hide-mobile">Vencimento</th>
                    <th className="px-4 py-2.5 text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold hide-mobile">Cadastro</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c, i) => (
                    <tr key={i} className="border-b border-border/20 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-foreground text-xs">{c.full_name}</p>
                        <p className="text-[10px] text-muted-foreground">{c.email}</p>
                      </td>
                      <td className="px-4 py-2.5 hide-mobile">
                        <p className="text-xs text-muted-foreground truncate max-w-[140px]">{c.tenant_name}</p>
                        {c.role === 'super_admin' && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/15 text-primary font-bold">ADMIN</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <StatusBadge status={c.sub_status} />
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground hide-mobile">
                        {c.sub_end ? new Date(c.sub_end).toLocaleDateString('pt-BR') : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground hide-mobile">
                        {new Date(c.created_at).toLocaleDateString('pt-BR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className="text-[10px] text-muted-foreground text-right">
          {filtered.length} usuário{filtered.length !== 1 ? 's' : ''} · SETPOLITIC Admin
        </p>
      </div>
    </div>
  );
}
