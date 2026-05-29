-- ============================================================
-- SETPOLITIC SaaS Schema
-- Executa no Supabase SQL Editor
-- ============================================================

-- 1. PLANOS
CREATE TABLE IF NOT EXISTS public.plans (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,                      -- 'Anual'
  stripe_price_id text,                           -- price_xxx do Stripe
  price_brl   numeric(10,2) NOT NULL DEFAULT 99,
  interval    text NOT NULL DEFAULT 'year',       -- 'year' | 'month'
  features    jsonb DEFAULT '{}',
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

-- Plano inicial
INSERT INTO public.plans (name, price_brl, interval, features)
VALUES ('Anual', 99.00, 'year', '{"municipios": ["Goiânia", "Aparecida de Goiânia"], "anos": [2014,2016,2018,2020,2022,2024], "modulos": "todos"}')
ON CONFLICT DO NOTHING;

-- 2. TENANTS (clientes/empresas)
CREATE TABLE IF NOT EXISTS public.tenants (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                text NOT NULL,
  stripe_customer_id  text UNIQUE,
  plan_id             uuid REFERENCES public.plans(id),
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

-- 3. PERFIS (ligado ao auth.users do Supabase)
CREATE TABLE IF NOT EXISTS public.profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id   uuid REFERENCES public.tenants(id),
  role        text NOT NULL DEFAULT 'owner',      -- 'owner' | 'member' | 'super_admin'
  full_name   text,
  email       text,
  created_at  timestamptz DEFAULT now()
);

-- Trigger: cria profile automaticamente ao signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. ASSINATURAS
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               uuid NOT NULL REFERENCES public.tenants(id),
  plan_id                 uuid REFERENCES public.plans(id),
  stripe_subscription_id  text UNIQUE,
  stripe_customer_id      text,
  status                  text NOT NULL DEFAULT 'incomplete',
  -- active | trialing | past_due | canceled | incomplete | unpaid
  current_period_start    timestamptz,
  current_period_end      timestamptz,
  cancel_at_period_end    boolean NOT NULL DEFAULT false,
  canceled_at             timestamptz,
  created_at              timestamptz DEFAULT now(),
  updated_at              timestamptz DEFAULT now()
);

-- ============================================================
-- RLS (Row Level Security)
-- ============================================================

ALTER TABLE public.plans         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Plans: leitura pública
CREATE POLICY "plans_public_read" ON public.plans
  FOR SELECT USING (true);

-- Profiles: cada usuário vê/edita o próprio perfil
CREATE POLICY "profiles_own" ON public.profiles
  FOR ALL USING (auth.uid() = id);

-- Tenants: usuário vê apenas o seu tenant
CREATE POLICY "tenants_own" ON public.tenants
  FOR SELECT USING (
    id IN (
      SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- Subscriptions: usuário vê apenas a do seu tenant
CREATE POLICY "subscriptions_own" ON public.subscriptions
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- Super admin: acesso total via service_role (bypass RLS no backend)
-- Não criar policy — usar supabase.admin no backend com service key

-- ============================================================
-- ÍNDICES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_profiles_tenant ON public.profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant ON public.subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe ON public.subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_tenants_stripe ON public.tenants(stripe_customer_id);

-- ============================================================
-- HELPER: retorna status de acesso do usuário logado
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_my_subscription_status()
RETURNS text LANGUAGE sql SECURITY DEFINER AS $$
  SELECT s.status
  FROM public.subscriptions s
  JOIN public.profiles p ON p.tenant_id = s.tenant_id
  WHERE p.id = auth.uid()
    AND s.status IN ('active', 'trialing')
  ORDER BY s.created_at DESC
  LIMIT 1;
$$;
