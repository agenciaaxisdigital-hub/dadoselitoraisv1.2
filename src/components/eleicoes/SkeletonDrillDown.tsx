// src/components/eleicoes/SkeletonDrillDown.tsx
import { Skeleton } from '@/components/ui/skeleton'

interface SkeletonDrillDownProps {
  rows?: number
  label?: string
}

export function SkeletonDrillDown({ rows = 5, label = 'Carregando dados...' }: SkeletonDrillDownProps) {
  return (
    <div className="space-y-3 p-4">
      <p className="text-sm text-muted-foreground animate-pulse">{label}</p>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  )
}
