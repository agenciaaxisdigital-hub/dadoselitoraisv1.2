import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { PageLoader } from '@/components/eleicoes/PageLoader';

const PUBLIC_ROUTES = ['/login', '/signup', '/billing'];

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { isLoading, isAuthenticated, hasAccess } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isPublic = PUBLIC_ROUTES.some(r => location.pathname.startsWith(r));

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated && !isPublic) {
      navigate('/login', { replace: true, state: { from: location.pathname } });
      return;
    }

    if (isAuthenticated && !hasAccess && location.pathname !== '/billing') {
      navigate('/billing', { replace: true });
      return;
    }

    if (isAuthenticated && (location.pathname === '/login' || location.pathname === '/signup')) {
      navigate('/', { replace: true });
    }
  }, [isLoading, isAuthenticated, hasAccess, location.pathname]);

  if (isLoading) return <PageLoader label="Verificando acesso…" />;

  return <>{children}</>;
}
