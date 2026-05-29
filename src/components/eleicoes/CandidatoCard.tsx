import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatNumber } from '@/lib/eleicoes';
import { SituacaoBadge } from './SituacaoBadge';
import { Badge } from '@/components/ui/badge';
import { getPartidoCor } from '@/lib/eleicoes';

interface CandidatoCardProps {
  sq: string;
  nome: string;
  partido: string;
  cargo: string;
  municipio?: string;
  numero?: string | number;
  totalVotos?: number;
  situacao?: string;
  patrimonio?: number;
  ano?: number;
  variant?: 'row' | 'card' | 'compact';
  rank?: number;
  className?: string;
}

export function CandidatoCard({
  sq, nome, partido, cargo, municipio, numero, totalVotos,
  situacao, patrimonio, ano = 2024, variant = 'row', rank, className,
}: CandidatoCardProps) {
  const cor = getPartidoCor(partido);
  const isEleito = situacao?.toUpperCase()?.includes('ELEITO') &&
    !situacao?.toUpperCase()?.includes('NÃO ELEITO');

  if (variant === 'card') {
    return (
      <Link
        to={`/candidatos/${sq}/${ano}`}
        className={cn(
          'block p-4 rounded-lg border bg-card hover:border-primary/30 hover:shadow-md transition-all group card-interactive',
          isEleito ? 'border-success/20 bg-success/5' : 'border-border/50',
          className
        )}
      >
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="min-w-0">
            <p className="font-semibold text-sm text-foreground truncate group-hover:text-primary transition-colors">
              {nome}
            </p>
            {municipio && (
              <p className="text-xs text-muted-foreground truncate">{municipio}</p>
            )}
          </div>
          {rank && (
            <span className="text-xs font-mono text-muted-foreground shrink-0">#{rank}</span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="text-xs font-bold px-1.5 py-0.5 rounded"
            style={{ backgroundColor: cor + '20', color: cor }}
          >
            {partido}
          </span>
          <span className="text-xs text-muted-foreground truncate">{cargo}</span>
        </div>
        {totalVotos !== undefined && (
          <div className="mt-3 pt-3 border-t border-border/30 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Votos</span>
            <span className="text-sm font-bold stat-number">{formatNumber(totalVotos)}</span>
          </div>
        )}
        {situacao && (
          <div className="mt-2">
            <SituacaoBadge situacao={situacao} />
          </div>
        )}
      </Link>
    );
  }

  if (variant === 'compact') {
    return (
      <div className={cn('flex items-center gap-2 py-1', className)}>
        {rank && <span className="text-xs font-mono text-muted-foreground w-6 shrink-0">{rank}</span>}
        <Link
          to={`/candidatos/${sq}/${ano}`}
          className="text-sm font-medium hover:text-primary transition-colors truncate flex-1"
        >
          {nome}
        </Link>
        <span
          className="text-xs font-bold px-1.5 py-0.5 rounded shrink-0"
          style={{ backgroundColor: cor + '20', color: cor }}
        >
          {partido}
        </span>
        {totalVotos !== undefined && (
          <span className="text-sm font-bold tabular-nums shrink-0">{formatNumber(totalVotos)}</span>
        )}
      </div>
    );
  }

  // variant === 'row' (default — used in tables)
  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <div className="min-w-0 flex-1">
        <span
          className="text-sm font-medium text-foreground group-hover:text-primary group-hover:underline underline-offset-2 transition-colors truncate block"
          title={nome}
        >
          {nome}
        </span>
        {municipio && (
          <span className="text-[10px] text-muted-foreground block truncate">
            {municipio}
          </span>
        )}
      </div>
      <ChevronRight className="w-3 h-3 text-muted-foreground/30 group-hover:text-primary transition-colors shrink-0" />
    </div>
  );
}
