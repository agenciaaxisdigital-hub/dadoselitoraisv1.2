/** Logo da Agência Axis — usa a imagem /logo-axis.jpg */

interface AxisLogoProps {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'dark-bg' | 'light-bg';
  showTagline?: boolean;
  className?: string;
}

export function AxisLogo({ size = 'sm', variant = 'dark-bg', showTagline = true, className = '' }: AxisLogoProps) {
  const isDark = variant === 'dark-bg';
  const iconSize  = size === 'sm' ? 30 : size === 'lg' ? 56 : 42;
  const textSize  = size === 'sm' ? '0.92rem' : size === 'lg' ? '1.6rem' : '1.2rem';
  const tagSize   = size === 'sm' ? '0.54rem' : '0.65rem';
  const nameColor = isDark ? '#ffffff' : '#1e3a5f';
  const accentColor = '#2b76c0';
  const tagColor  = isDark ? 'rgba(255,255,255,0.3)' : 'rgba(30,58,95,0.4)';

  return (
    <div className={`flex items-center select-none ${className}`} style={{ gap: 10 }}>
      <div style={{
        width: iconSize, height: iconSize,
        background: isDark ? '#fff' : 'transparent',
        borderRadius: 7, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
      }}>
        <img
          src="/logo-axis.jpg"
          alt="Axis"
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />
      </div>
      <div style={{ lineHeight: 1 }}>
        <p style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: textSize, letterSpacing: '-0.01em', color: nameColor, lineHeight: 1 }}>
          AXIS<span style={{ color: accentColor }}>POLITIC</span>
        </p>
        {showTagline && (
          <p style={{ fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: tagSize, color: tagColor, letterSpacing: '0.18em', textTransform: 'uppercase', marginTop: 3 }}>
            Sistema Eleitoral Goiano
          </p>
        )}
      </div>
    </div>
  );
}
