import { Link, useLocation } from 'react-router-dom';
import {
  Trophy, School, Hash, User, Users, UserCheck,
  Wallet, UsersRound, Settings,
  HelpCircle, BarChart2, TrendingUp, ShieldCheck,
} from 'lucide-react';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';

const mainItems = [
  { title: 'Ranking & Resultados', url: '/', icon: Trophy },
  { title: 'Relatório de Votação', url: '/relatorio', icon: BarChart2 },
  { title: 'Perfil de Candidatos', url: '/candidatos', icon: User },
  { title: 'Suplentes', url: '/suplentes', icon: UserCheck },
  { title: 'Financiamento', url: '/financiamento', icon: Wallet },
];

const territorialItems = [
  { title: 'Força por Zona', url: '/forca-zona', icon: TrendingUp },
  { title: 'Zonas Eleitorais', url: '/zonas', icon: Hash },
  { title: 'Locais de Votação', url: '/escolas', icon: School },
  { title: 'Mesários por Seção', url: '/mesarios', icon: Users },
  { title: 'Eleitorado', url: '/eleitorado', icon: UsersRound },
];


export function AppSidebar() {
  const location = useLocation();
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === 'collapsed';

  function isActive(url: string) {
    if (url === '/') return location.pathname === '/' || location.pathname === '/ranking';
    return location.pathname === url || location.pathname.startsWith(`${url}/`);
  }

  const MenuItem = ({ item }: { item: typeof mainItems[0] }) => {
    const active = isActive(item.url);
    return (
      <SidebarMenuItem>
        <SidebarMenuButton asChild>
          <Link
            to={item.url}
            onClick={() => isMobile && setOpenMobile(false)}
            className={cn(
              'group flex items-center gap-2.5 px-2.5 py-2 rounded-md transition-all text-sm font-medium',
              active
                ? 'bg-sidebar-primary/15 text-white'
                : 'text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent'
            )}
          >
            <item.icon className={cn(
              'w-4 h-4 shrink-0 transition-colors',
              active ? 'text-sidebar-primary' : 'text-sidebar-foreground/40 group-hover:text-sidebar-foreground/70'
            )} />
            {!collapsed && <span className="truncate">{item.title}</span>}
            {active && !collapsed && (
              <span className="ml-auto w-1.5 h-1.5 rounded-full bg-sidebar-primary shrink-0" />
            )}
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  const GroupLabel = ({ label }: { label: string }) =>
    collapsed ? null : (
      <SidebarGroupLabel className="text-[9px] font-semibold text-sidebar-foreground/25 uppercase tracking-[0.12em] px-2.5 mb-0.5 mt-1">
        {label}
      </SidebarGroupLabel>
    );

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="p-3 border-b border-sidebar-border/50">
        <Link to="/" className="flex items-center gap-2.5 px-0.5 overflow-hidden">
          {/* Container branco para a logo JPG ficar visível na sidebar escura */}
          <div style={{
            width: collapsed ? 30 : 34,
            height: collapsed ? 30 : 34,
            background: '#fff',
            borderRadius: 7,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}>
            <img
              src="/logo-axis.jpg"
              alt="Axis"
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          </div>
          {!collapsed && (
            <div style={{ lineHeight: 1, overflow: 'hidden' }}>
              <p style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: '0.92rem', letterSpacing: '-0.01em', color: '#fff', whiteSpace: 'nowrap' }}>
                AXIS<span style={{ color: '#4A9EE8' }}>POLITIC</span>
              </p>
              <p style={{ fontSize: '0.55rem', letterSpacing: '0.16em', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', marginTop: 2, whiteSpace: 'nowrap' }}>
                Sistema Eleitoral
              </p>
            </div>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-1.5 py-2 gap-0">
        <SidebarGroup className="p-0">
          <GroupLabel label="Principal" />
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {mainItems.map(item => <MenuItem key={item.url} item={item} />)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="p-0 mt-2">
          <GroupLabel label="Territorial" />
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {territorialItems.map(item => <MenuItem key={item.url} item={item} />)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>


      </SidebarContent>

      <SidebarFooter className="px-1.5 py-2 border-t border-sidebar-border/50">
        <SidebarMenu className="gap-0.5">
          <MenuItem item={{ title: 'Configurações', url: '/config', icon: Settings }} />
          <MenuItem item={{ title: 'Ajuda', url: '/ajuda', icon: HelpCircle }} />
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
