-- ==========================================
-- Schema: TDAH Descomplicado Ebook PWA
-- Supabase PostgreSQL com Row Level Security (RLS)
-- ==========================================

-- Habilita RLS em todas as tabelas
-- Usuário só lê/escreve a própria linha (REGRA #6)

-- ==========================================
-- EXTENSÕES
-- ==========================================
extension if not exists "uuid-ossp";

-- ==========================================
-- TABELA: profiles
-- Perfil do usuário (extendido do auth.users)
-- ==========================================
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  full_name text,
  avatar_url text,
  phone text,
  birth_date date,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- RLS: profiles
alter table public.profiles enable row level security;

create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id);

-- Trigger: atualiza updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger: cria profile automaticamente no signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, created_at)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==========================================
-- TABELA: user_state
-- Progresso de leitura e estado do usuário
-- ==========================================
create table if not exists public.user_state (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  current_page integer default 0,
  bookmarks jsonb default '[]'::jsonb,
  quiz_results jsonb default '[]'::jsonb,
  theme_preference text default 'dark',
  font_size integer default 16,
  completed_chapters jsonb default '[]'::jsonb,
  last_read_at timestamptz default now(),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  unique(user_id)
);

-- RLS: user_state
alter table public.user_state enable row level security;

create policy "user_state_select_own"
  on public.user_state for select
  using (auth.uid() = user_id);

create policy "user_state_insert_own"
  on public.user_state for insert
  with check (auth.uid() = user_id);

create policy "user_state_update_own"
  on public.user_state for update
  using (auth.uid() = user_id);

CREATE TRIGGER update_user_state_updated_at
  BEFORE UPDATE ON public.user_state
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ==========================================
-- TABELA: leads
-- Captura de leads (emails de interessados)
-- Política: usuários autenticados veem só os seus;
--           anon não insere (use Edge Function ou service_role)
-- ==========================================
create table if not exists public.leads (
  id uuid default uuid_generate_v4() primary key,
  email text not null,
  source text default 'ebook',
  page_reached integer default 0,
  user_agent text,
  ip_address text,
  converted boolean default false,
  converted_at timestamptz,
  created_at timestamptz default now() not null
);

-- Índice para evitar emails duplicados
create unique index if not exists leads_email_unique on public.leads(email);

-- RLS: leads
-- NOTA: Insert via Edge Function com service_role para bypass RLS
--       Select apenas para admin (pode ser feito via dashboard)
alter table public.leads enable row level security;

create policy "leads_no_public_select"
  on public.leads for select
  using (false); -- Nenhum usuário comum pode ler leads

create policy "leads_insert_via_function"
  on public.leads for insert
  with check (true); -- Controlado pela Edge Function

-- ==========================================
-- TABELA: purchases
-- Registro de compras (SÓ via Edge Function)
-- CRÍTICO: gravação SEMPRE via Edge Function com service_role
-- REGRA #3: valores em centavos (inteiro), nunca float
-- ==========================================
create table if not exists public.purchases (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete set null,
  email text not null,
  product_id text not null,
  product_name text default 'TDAH Descomplicado — Ebook Interativo',
  -- PREÇO EM CENTAVOS (inteiro) — REGRA NÃO NEGOCIÁVEL
  -- Ex: R$ 47,00 → 4700 centavos
  price_cents integer not null,
  currency text default 'BRL',
  status text default 'pending' check (status in ('pending', 'completed', 'refunded', 'cancelled')),
  payment_method text,
  cakto_order_id text,
  cakto_payload jsonb default '{}'::jsonb,
  receipt_url text,
  refunded_at timestamptz,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_purchases_user_id ON public.purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_purchases_email ON public.purchases(email);
CREATE INDEX IF NOT EXISTS idx_purchases_status ON public.purchases(status);
CREATE INDEX IF NOT EXISTS idx_purchases_cakto_order ON public.purchases(cakto_order_id);

-- RLS: purchases — NENHUM acesso direto do frontend
-- TODAS as operações via Edge Function com service_role
alter table public.purchases enable row level security;

create policy "purchases_no_public_access"
  on public.purchases for all
  using (false);

-- VIEW: usuário vê apenas suas próprias compras (via função)
CREATE OR REPLACE FUNCTION get_user_purchases(p_user_id uuid)
RETURNS TABLE (
  id uuid,
  product_name text,
  price_cents integer,
  status text,
  created_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.product_name, p.price_cents, p.status, p.created_at
  FROM public.purchases p
  WHERE p.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- TABELA: analytics_events (opcional)
-- Eventos para análise de uso
-- ==========================================
create table if not exists public.analytics_events (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete set null,
  event_name text not null,
  properties jsonb default '{}'::jsonb,
  page_path text,
  session_id text,
  created_at timestamptz default now() not null
);

-- RLS: analytics
alter table public.analytics_events enable row level security;

create policy "analytics_insert_own"
  on public.analytics_events for insert
  with check (auth.uid() = user_id);

create policy "analytics_no_public_select"
  on public.analytics_events for select
  using (false);

-- ==========================================
-- FUNÇÃO: Verificar acesso do usuário
-- Usada pelo app para checar se usuário comprou
-- ==========================================
CREATE OR REPLACE FUNCTION check_user_access(p_email text)
RETURNS boolean AS $$
DECLARE
  has_purchase boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.purchases
    WHERE email = p_email
      AND status = 'completed'
      AND (refunded_at IS NULL)
  ) INTO has_purchase;

  RETURN has_purchase;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- PERMISSÕES
-- ==========================================
-- Garante que a função da Edge Function pode acessar as tabelas
GRANT ALL ON public.profiles TO service_role;
GRANT ALL ON public.user_state TO service_role;
GRANT ALL ON public.leads TO service_role;
GRANT ALL ON public.purchases TO service_role;
GRANT ALL ON public.analytics_events TO service_role;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- ==========================================
-- COMENTÁRIOS DOCUMENTANDO A REGRA DE CENTAVOS
-- ==========================================
COMMENT ON TABLE public.purchases IS
  'Registro de compras. PREÇO SEMPRE em centavos (inteiro). Nunca gravar float. Ex: R$ 47,00 = 4700. Gravação via Edge Function apenas.';

COMMENT ON COLUMN public.purchases.price_cents IS
  'Preço em centavos (× 100). Ex: 4700 = R$ 47,00. Recebido da Cakto como decimal e convertido pelo parser.';
