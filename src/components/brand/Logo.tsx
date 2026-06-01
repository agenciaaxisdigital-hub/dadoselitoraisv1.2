/**
 * Logo oficial do SETPOLITIC - Sistema Eleitoral Goiano
 * Design premium: Ícone puro CSS, degradê verde floresta e ouro eleitoral.
 */

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'dark-bg' | 'light-bg';
  showTagline?: boolean;
  showText?: boolean;
  className?: string;
}

export function Logo({
  size = 'sm',
  variant = 'dark-bg',
  showTagline = true,
  showText = true,
  className = ''
}: LogoProps) {
  const isDark = variant === 'dark-bg';
  const iconSize  = size === 'sm' ? 30 : size === 'lg' ? 52 : 40;
  const textSize  = size === 'sm' ? '0.92rem' : size === 'lg' ? '1.5rem' : '1.2rem';
  const tagSize   = size === 'sm' ? '0.52rem' : '0.62rem';
  
  // Cores institucionais do SETPOLITIC
  const nameColor = isDark ? '#ffffff' : '#0d2818';
  const accentColor = '#f5c53a'; // Ouro
  const tagColor  = isDark ? 'rgba(255,255,255,0.35)' : 'rgba(13,40,24,0.45)';

  return (
    <div className={`flex items-center select-none ${className}`} style={{ gap: 10 }}>
      {/* Premium SETPOLITIC Icon */}
      <div style={{
        width: iconSize, height: iconSize,
        background: 'linear-gradient(135deg, #2e7d22, #0d2818)',
        borderRadius: 8, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: '1.5px solid #f5c53a',
        boxShadow: '0 2px 6px rgba(46, 125, 34, 0.15)',
        overflow: 'hidden',
      }}>
        <span style={{
          color: '#f5c53a',
          fontFamily: 'Montserrat, sans-serif',
          fontWeight: 900,
          fontSize: size === 'sm' ? '1.1rem' : size === 'lg' ? '1.8rem' : '1.4rem',
          lineHeight: 1,
          transform: 'translateY(-1px)'
        }}>
          S
        </span>
      </div>
      
      {showText && (
        <div style={{ lineHeight: 1 }}>
          <p style={{
            fontFamily: 'Inter, sans-serif',
            fontWeight: 800,
            fontSize: textSize,
            letterSpacing: '-0.015em',
            color: nameColor,
            lineHeight: 1
          }}>
            SET<span style={{ color: isDark ? '#4aab1e' : '#2e7d22' }}>POLITIC</span>
          </p>
          {showTagline && (
            <p style={{
              fontFamily: 'Inter, sans-serif',
              fontWeight: 600,
              fontSize: tagSize,
              color: tagColor,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              marginTop: 3
            }}>
              Sistema Eleitoral Goiano
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// Alias para compatibilidade
export const AxisLogo = Logo;
