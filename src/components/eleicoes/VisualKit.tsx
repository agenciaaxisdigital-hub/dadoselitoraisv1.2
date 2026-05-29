/**
 * VisualKit — componentes visuais compartilhados por todas as páginas.
 * KPICard · MiniBar · PartyBadge · PageHeader
 */
import { type LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { getPartidoCor } from '@/lib/eleicoes';
import { cn } from '@/lib/utils';

// ─── KPICard ──────────────────────────────────────────────────────────────────

interface KPICardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  sub?: string;
  color?: string; // tailwind text-* class, default text-primary
}

export function KPICard({ icon: Icon, label, value, sub, color = 'text-primary' }: KPICardProps) {
  return (
    <Card className="bg-card border-border/50">
      <CardContent className="p-3 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className={cn('w-4 h-4', color)} />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="text-lg font-bold text-foreground leading-tight">{value}</p>
          {sub && <p className="text-[10px] text-muted-foreground truncate">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── MiniBar ─────────────────────────────────────────────────────────────────

interface MiniBarProps {
  value: number;
  max: number;
  color?: string; // hex or css color, default uses primary
  className?: string;
}

export function MiniBar({ value, max, color, className }: MiniBarProps) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className={cn('h-1.5 bg-muted rounded-full overflow-hidden w-16 sm:w-24', className)}>
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{
          width: `${pct}%`,
          backgroundColor: color ?? 'hsl(var(--primary))',
        }}
      />
    </div>
  );
}

// ─── PartyBadge ──────────────────────────────────────────────────────────────

export function PartyBadge({ partido, className }: { partido: string; className?: string }) {
  const cor = getPartidoCor(partido);
  return (
    <span
      className={cn('text-xs font-bold px-1.5 py-0.5 rounded shrink-0', className)}
      style={{ backgroundColor: cor + '25', color: cor }}
    >
      {partido}
    </span>
  );
}

// ─── PageHeader ──────────────────────────────────────────────────────────────

interface PageHeaderProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
}

export function PageHeader({ icon: Icon, title, subtitle }: PageHeaderProps) {
  return (
    <div>
      <h1 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
        <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-primary shrink-0" />
        {title}
      </h1>
      {subtitle && (
        <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">{subtitle}</p>
      )}
    </div>
  );
}
