import { useEffect, useState } from 'react';
import { Logo } from '@/components/brand/Logo';

const MESSAGES = [
  'Carregando dados eleitorais…',
  'Processando resultados…',
  'Preparando visualizações…',
  'Quase lá…',
];

export function PageLoader({ label }: { label?: string }) {
  const [msgIdx, setMsgIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setMsgIdx(i => (i + 1) % MESSAGES.length), 1800);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background gap-6">
      {/* Logo SETPOLITIC */}
      <div className="flex flex-col items-center gap-3">
        <Logo size="lg" variant="light-bg" showTagline={true} />
      </div>

      {/* Barra de progresso */}
      <div className="w-48 h-[3px] rounded-full bg-muted overflow-hidden relative">
        <div
          className="absolute inset-y-0 rounded-full"
          style={{
            background: 'linear-gradient(90deg, hsl(var(--primary)), hsl(var(--primary) / 0.5))',
            animation: 'loader-bar 1.6s ease-in-out infinite',
          }}
        />
      </div>

      <p className="text-xs text-muted-foreground min-h-[1rem] transition-opacity duration-300">
        {label ?? MESSAGES[msgIdx]}
      </p>

      {/* Skeleton */}
      <div className="w-full max-w-2xl px-6 mt-2 space-y-3 opacity-40">
        <div className="grid grid-cols-4 gap-2">
          {[80, 64, 72, 56].map((w, i) => (
            <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" style={{ animationDelay: `${i * 100}ms` }} />
          ))}
        </div>
        <div className="space-y-2">
          {[100, 85, 90, 70, 80].map((w, i) => (
            <div key={i} className="h-7 rounded bg-muted animate-pulse"
              style={{ width: `${w}%`, animationDelay: `${i * 80}ms` }} />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes loader-bar {
          0%   { left: -40%; width: 40%; }
          50%  { left: 30%; width: 50%; }
          100% { left: 110%; width: 40%; }
        }
      `}</style>
    </div>
  );
}
