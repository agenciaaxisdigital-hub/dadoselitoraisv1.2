import { useIsFetching } from '@tanstack/react-query';

export function FetchingBar() {
  const fetching = useIsFetching();

  if (!fetching) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[60] h-[2px] overflow-hidden pointer-events-none">
      <div
        className="h-full rounded-full"
        style={{
          background: 'linear-gradient(90deg, hsl(var(--primary)), hsl(var(--primary) / 0.4), hsl(var(--primary)))',
          backgroundSize: '200% 100%',
          animation: 'fetching-bar 1.2s linear infinite',
        }}
      />
      <style>{`
        @keyframes fetching-bar {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}
