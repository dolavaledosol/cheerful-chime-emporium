
-- =============================================
-- ENUMS
-- =============================================
CREATE TYPE public.app_role AS ENUM ('admin', 'vendedor', 'cliente');
CREATE TYPE public.tipo_cliente AS ENUM ('cliente', 'vendedor', 'admin');
CREATE TYPE public.status_pedido AS ENUM (
  'carrinho', 'separacao', 'aguardando_pagamento', 'pago', 'enviado', 'entregue', 'cancelado'
);
CREATE TYPE public.origem_pedido AS ENUM ('web', 'whatsapp', 'admin');
CREATE TYPE public.unidade_medida AS ENUM ('un', 'kg', 'g', 'l', 'ml', 'cx', 'pct', 'par', 'm', 'cm');

-- =============================================
-- PROFILES (linked to auth.users)
-- =============================================
CREATE TABLE public.profiles (
  profile_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = profile_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = profile_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = profile_id);

-- =============================================
-- USER ROLES (separate table for security)
-- =============================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- TRIGGER: Auto-create profile on signup
-- =============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (profile_id, nome)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- FAMILIA (with self-reference for subfamilia)
-- =============================================
CREATE TABLE public.familia (
  familia_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  descricao TEXT,
  familia_pai_id UUID REFERENCES public.familia(familia_id),
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.familia ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read familia" ON public.familia FOR SELECT USING (true);
CREATE POLICY "Admin manage familia" ON public.familia FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- FABRICANTE
-- =============================================
CREATE TABLE public.fabricante (
  fabricante_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.fabricante ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read fabricante" ON public.fabricante FOR SELECT USING (true);
CREATE POLICY "Admin manage fabricante" ON public.fabricante FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- ENDERECO (reutilizável)
-- =============================================
CREATE TABLE public.endereco (
  endereco_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cep TEXT,
  logradouro TEXT NOT NULL,
  numero TEXT,
  complemento TEXT,
  bairro TEXT,
  cidade TEXT NOT NULL,
  estado TEXT NOT NULL,
  observacao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.endereco ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read endereco" ON public.endereco FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage endereco" ON public.endereco FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- CLIENTE
-- =============================================
CREATE TABLE public.cliente (
  cliente_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  cpf_cnpj TEXT,
  email TEXT,
  tipo_cliente tipo_cliente NOT NULL DEFAULT 'cliente',
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.cliente ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own cliente" ON public.cliente FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own cliente" ON public.cliente FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admin manage clientes" ON public.cliente FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Vendedor view clientes" ON public.cliente FOR SELECT USING (public.has_role(auth.uid(), 'vendedor'));

-- =============================================
-- CLIENTE_TELEFONE
-- =============================================
CREATE TABLE public.cliente_telefone (
  cliente_telefone_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES public.cliente(cliente_id) ON DELETE CASCADE,
  telefone TEXT NOT NULL
);
ALTER TABLE public.cliente_telefone ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own telefones" ON public.cliente_telefone FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.cliente WHERE cliente_id = cliente_telefone.cliente_id AND user_id = auth.uid())
);
CREATE POLICY "Admin manage telefones" ON public.cliente_telefone FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- CLIENTE_ENDERECO (N:N)
-- =============================================
CREATE TABLE public.cliente_endereco (
  cliente_id UUID NOT NULL REFERENCES public.cliente(cliente_id) ON DELETE CASCADE,
  endereco_id UUID NOT NULL REFERENCES public.endereco(endereco_id) ON DELETE CASCADE,
  PRIMARY KEY (cliente_id, endereco_id)
);
ALTER TABLE public.cliente_endereco ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own enderecos" ON public.cliente_endereco FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.cliente WHERE cliente_id = cliente_endereco.cliente_id AND user_id = auth.uid())
);
CREATE POLICY "Admin manage cliente_endereco" ON public.cliente_endereco FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- FABRICANTE_ENDERECO (N:N)
-- =============================================
CREATE TABLE public.fabricante_endereco (
  fabricante_id UUID NOT NULL REFERENCES public.fabricante(fabricante_id) ON DELETE CASCADE,
  endereco_id UUID NOT NULL REFERENCES public.endereco(endereco_id) ON DELETE CASCADE,
  PRIMARY KEY (fabricante_id, endereco_id)
);
ALTER TABLE public.fabricante_endereco ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin manage fabricante_endereco" ON public.fabricante_endereco FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Public read fabricante_endereco" ON public.fabricante_endereco FOR SELECT USING (true);

-- =============================================
-- FORNECEDOR
-- =============================================
CREATE TABLE public.fornecedor (
  fornecedor_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.fornecedor ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin manage fornecedor" ON public.fornecedor FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Vendedor read fornecedor" ON public.fornecedor FOR SELECT USING (public.has_role(auth.uid(), 'vendedor'));

-- =============================================
-- FORNECEDOR_ENDERECO (N:N)
-- =============================================
CREATE TABLE public.fornecedor_endereco (
  fornecedor_id UUID NOT NULL REFERENCES public.fornecedor(fornecedor_id) ON DELETE CASCADE,
  endereco_id UUID NOT NULL REFERENCES public.endereco(endereco_id) ON DELETE CASCADE,
  PRIMARY KEY (fornecedor_id, endereco_id)
);
ALTER TABLE public.fornecedor_endereco ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin manage fornecedor_endereco" ON public.fornecedor_endereco FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- PRODUTO
-- =============================================
CREATE TABLE public.produto (
  produto_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  descricao TEXT,
  slug TEXT UNIQUE,
  familia_id UUID REFERENCES public.familia(familia_id),
  fabricante_id UUID REFERENCES public.fabricante(fabricante_id),
  unidade_medida unidade_medida NOT NULL DEFAULT 'un',
  peso_bruto NUMERIC(10,3),
  peso_liquido NUMERIC(10,3),
  altura NUMERIC(10,2),
  largura NUMERIC(10,2),
  profundidade NUMERIC(10,2),
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.produto ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read active produto" ON public.produto FOR SELECT USING (true);
CREATE POLICY "Admin manage produto" ON public.produto FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Validation trigger: peso_bruto >= peso_liquido
CREATE OR REPLACE FUNCTION public.validate_produto_peso()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.peso_bruto IS NOT NULL AND NEW.peso_liquido IS NOT NULL AND NEW.peso_bruto < NEW.peso_liquido THEN
    RAISE EXCEPTION 'peso_bruto deve ser maior ou igual a peso_liquido';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_produto_peso
  BEFORE INSERT OR UPDATE ON public.produto
  FOR EACH ROW EXECUTE FUNCTION public.validate_produto_peso();

-- Auto-generate slug
CREATE OR REPLACE FUNCTION public.generate_produto_slug()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := lower(regexp_replace(NEW.nome, '[^a-zA-Z0-9]+', '-', 'g'));
    -- ensure uniqueness by appending random suffix if needed
    IF EXISTS (SELECT 1 FROM public.produto WHERE slug = NEW.slug AND produto_id != NEW.produto_id) THEN
      NEW.slug := NEW.slug || '-' || substring(gen_random_uuid()::text from 1 for 8);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_generate_produto_slug
  BEFORE INSERT OR UPDATE ON public.produto
  FOR EACH ROW EXECUTE FUNCTION public.generate_produto_slug();

-- =============================================
-- PRODUTO_IMAGEM
-- =============================================
CREATE TABLE public.produto_imagem (
  produto_imagem_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id UUID NOT NULL REFERENCES public.produto(produto_id) ON DELETE CASCADE,
  url_imagem TEXT NOT NULL,
  ordem INTEGER NOT NULL DEFAULT 0
);
ALTER TABLE public.produto_imagem ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read produto_imagem" ON public.produto_imagem FOR SELECT USING (true);
CREATE POLICY "Admin manage produto_imagem" ON public.produto_imagem FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- FORNECEDOR_PRODUTO (N:N)
-- =============================================
CREATE TABLE public.fornecedor_produto (
  fornecedor_id UUID NOT NULL REFERENCES public.fornecedor(fornecedor_id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES public.produto(produto_id) ON DELETE CASCADE,
  PRIMARY KEY (fornecedor_id, produto_id)
);
ALTER TABLE public.fornecedor_produto ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin manage fornecedor_produto" ON public.fornecedor_produto FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- LOCAL DE ESTOQUE
-- =============================================
CREATE TABLE public.local_estoque (
  local_estoque_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.local_estoque ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read local_estoque" ON public.local_estoque FOR SELECT USING (true);
CREATE POLICY "Admin manage local_estoque" ON public.local_estoque FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- LOCAL_ESTOQUE_ENDERECO (N:N)
-- =============================================
CREATE TABLE public.local_estoque_endereco (
  local_estoque_id UUID NOT NULL REFERENCES public.local_estoque(local_estoque_id) ON DELETE CASCADE,
  endereco_id UUID NOT NULL REFERENCES public.endereco(endereco_id) ON DELETE CASCADE,
  PRIMARY KEY (local_estoque_id, endereco_id)
);
ALTER TABLE public.local_estoque_endereco ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin manage local_estoque_endereco" ON public.local_estoque_endereco FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- ESTOQUE_LOCAL (estoque por local, com preço)
-- =============================================
CREATE TABLE public.estoque_local (
  estoque_local_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id UUID NOT NULL REFERENCES public.produto(produto_id) ON DELETE CASCADE,
  local_estoque_id UUID NOT NULL REFERENCES public.local_estoque(local_estoque_id) ON DELETE CASCADE,
  quantidade_disponivel NUMERIC(10,3) NOT NULL DEFAULT 0,
  quantidade_pedida_nao_separada NUMERIC(10,3) NOT NULL DEFAULT 0,
  preco NUMERIC(10,2) NOT NULL DEFAULT 0,
  preco_promocional NUMERIC(10,2),
  UNIQUE (produto_id, local_estoque_id)
);
ALTER TABLE public.estoque_local ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read estoque_local" ON public.estoque_local FOR SELECT USING (true);
CREATE POLICY "Admin manage estoque_local" ON public.estoque_local FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- BANCO
-- =============================================
CREATE TABLE public.banco (
  banco_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  codigo TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true
);
ALTER TABLE public.banco ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin manage banco" ON public.banco FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- FORMA_PAGAMENTO
-- =============================================
CREATE TABLE public.forma_pagamento (
  forma_pagamento_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true
);
ALTER TABLE public.forma_pagamento ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read forma_pagamento" ON public.forma_pagamento FOR SELECT USING (true);
CREATE POLICY "Admin manage forma_pagamento" ON public.forma_pagamento FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- CARRINHO
-- =============================================
CREATE TABLE public.carrinho (
  carrinho_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.carrinho ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own carrinho" ON public.carrinho FOR ALL USING (
  auth.uid() = user_id OR (user_id IS NULL AND session_id IS NOT NULL)
);
CREATE POLICY "Anon read carrinho by session" ON public.carrinho FOR SELECT TO anon USING (session_id IS NOT NULL);
CREATE POLICY "Anon insert carrinho" ON public.carrinho FOR INSERT TO anon WITH CHECK (user_id IS NULL AND session_id IS NOT NULL);
CREATE POLICY "Anon update carrinho" ON public.carrinho FOR UPDATE TO anon USING (user_id IS NULL AND session_id IS NOT NULL);

-- =============================================
-- CARRINHO_ITEM
-- =============================================
CREATE TABLE public.carrinho_item (
  carrinho_item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  carrinho_id UUID NOT NULL REFERENCES public.carrinho(carrinho_id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES public.produto(produto_id),
  estoque_local_id UUID REFERENCES public.estoque_local(estoque_local_id),
  quantidade NUMERIC(10,3) NOT NULL DEFAULT 1
);
ALTER TABLE public.carrinho_item ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own carrinho_item" ON public.carrinho_item FOR ALL USING (
  EXISTS (SELECT 1 FROM public.carrinho WHERE carrinho_id = carrinho_item.carrinho_id AND (user_id = auth.uid() OR session_id IS NOT NULL))
);
CREATE POLICY "Anon manage carrinho_item" ON public.carrinho_item FOR ALL TO anon USING (
  EXISTS (SELECT 1 FROM public.carrinho WHERE carrinho_id = carrinho_item.carrinho_id AND session_id IS NOT NULL)
);

-- =============================================
-- PEDIDO
-- =============================================
CREATE TABLE public.pedido (
  pedido_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES public.cliente(cliente_id),
  local_estoque_id UUID REFERENCES public.local_estoque(local_estoque_id),
  data TIMESTAMPTZ NOT NULL DEFAULT now(),
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  frete NUMERIC(10,2) NOT NULL DEFAULT 0,
  status status_pedido NOT NULL DEFAULT 'carrinho',
  origem origem_pedido NOT NULL DEFAULT 'web',
  vendedor_id UUID REFERENCES public.cliente(cliente_id),
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.pedido ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own pedidos" ON public.pedido FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.cliente WHERE cliente_id = pedido.cliente_id AND user_id = auth.uid())
);
CREATE POLICY "Admin manage pedidos" ON public.pedido FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Vendedor view pedidos" ON public.pedido FOR SELECT USING (public.has_role(auth.uid(), 'vendedor'));

-- =============================================
-- PEDIDO_ITEM
-- =============================================
CREATE TABLE public.pedido_item (
  pedido_item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id UUID NOT NULL REFERENCES public.pedido(pedido_id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES public.produto(produto_id),
  quantidade NUMERIC(10,3) NOT NULL,
  preco_unitario NUMERIC(10,2) NOT NULL
);
ALTER TABLE public.pedido_item ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own pedido_item" ON public.pedido_item FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.pedido WHERE pedido_id = pedido_item.pedido_id AND EXISTS (
    SELECT 1 FROM public.cliente WHERE cliente_id = pedido.cliente_id AND user_id = auth.uid()
  ))
);
CREATE POLICY "Admin manage pedido_item" ON public.pedido_item FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- PEDIDO_STATUS_HISTORICO
-- =============================================
CREATE TABLE public.pedido_status_historico (
  pedido_status_historico_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id UUID NOT NULL REFERENCES public.pedido(pedido_id) ON DELETE CASCADE,
  status status_pedido NOT NULL,
  data TIMESTAMPTZ NOT NULL DEFAULT now(),
  usuario_id UUID REFERENCES auth.users(id)
);
ALTER TABLE public.pedido_status_historico ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own pedido_historico" ON public.pedido_status_historico FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.pedido WHERE pedido_id = pedido_status_historico.pedido_id AND EXISTS (
    SELECT 1 FROM public.cliente WHERE cliente_id = pedido.cliente_id AND user_id = auth.uid()
  ))
);
CREATE POLICY "Admin manage pedido_historico" ON public.pedido_status_historico FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- PEDIDO_PAGAMENTO
-- =============================================
CREATE TABLE public.pedido_pagamento (
  pedido_pagamento_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id UUID NOT NULL REFERENCES public.pedido(pedido_id) ON DELETE CASCADE,
  forma_pagamento_id UUID REFERENCES public.forma_pagamento(forma_pagamento_id),
  banco_id UUID REFERENCES public.banco(banco_id),
  valor NUMERIC(12,2) NOT NULL,
  data_pagamento TIMESTAMPTZ,
  comprovante_url TEXT,
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.pedido_pagamento ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin manage pedido_pagamento" ON public.pedido_pagamento FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- CONTAS A PAGAR
-- =============================================
CREATE TABLE public.contas_pagar (
  contas_pagar_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  descricao TEXT NOT NULL,
  valor NUMERIC(12,2) NOT NULL,
  data_vencimento DATE NOT NULL,
  data_pagamento DATE,
  fornecedor_id UUID REFERENCES public.fornecedor(fornecedor_id),
  banco_id UUID REFERENCES public.banco(banco_id),
  pago BOOLEAN NOT NULL DEFAULT false,
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.contas_pagar ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin manage contas_pagar" ON public.contas_pagar FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- CONTAS A RECEBER
-- =============================================
CREATE TABLE public.contas_receber (
  contas_receber_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  descricao TEXT NOT NULL,
  valor NUMERIC(12,2) NOT NULL,
  data_vencimento DATE NOT NULL,
  data_recebimento DATE,
  pedido_id UUID REFERENCES public.pedido(pedido_id),
  cliente_id UUID REFERENCES public.cliente(cliente_id),
  banco_id UUID REFERENCES public.banco(banco_id),
  recebido BOOLEAN NOT NULL DEFAULT false,
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.contas_receber ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin manage contas_receber" ON public.contas_receber FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- INTEGRACAO_LOG
-- =============================================
CREATE TABLE public.integracao_log (
  integracao_log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL,
  payload JSONB,
  resposta JSONB,
  status TEXT,
  erro TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.integracao_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin read integracao_log" ON public.integracao_log FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin insert integracao_log" ON public.integracao_log FOR INSERT WITH CHECK (true);

-- =============================================
-- CONFIGURACAO (key-value system preferences)
-- =============================================
CREATE TABLE public.configuracao (
  configuracao_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chave TEXT NOT NULL UNIQUE,
  valor TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.configuracao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own config" ON public.configuracao FOR ALL USING (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "Admin manage all config" ON public.configuracao FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- STORAGE BUCKET for product images
-- =============================================
INSERT INTO storage.buckets (id, name, public) VALUES ('produtos', 'produtos', true);

-- Storage policies for product images
CREATE POLICY "Public read product images" ON storage.objects FOR SELECT USING (bucket_id = 'produtos');
CREATE POLICY "Admin upload product images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'produtos' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin delete product images" ON storage.objects FOR DELETE USING (bucket_id = 'produtos' AND public.has_role(auth.uid(), 'admin'));

-- =============================================
-- UPDATED_AT TRIGGER FUNCTION
-- =============================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Apply updated_at triggers
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_familia_updated_at BEFORE UPDATE ON public.familia FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_fabricante_updated_at BEFORE UPDATE ON public.fabricante FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_cliente_updated_at BEFORE UPDATE ON public.cliente FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_produto_updated_at BEFORE UPDATE ON public.produto FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_carrinho_updated_at BEFORE UPDATE ON public.carrinho FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_pedido_updated_at BEFORE UPDATE ON public.pedido FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_fornecedor_updated_at BEFORE UPDATE ON public.fornecedor FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_configuracao_updated_at BEFORE UPDATE ON public.configuracao FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- =============================================
-- INDEXES for performance
-- =============================================
CREATE INDEX idx_produto_familia ON public.produto(familia_id);
CREATE INDEX idx_produto_fabricante ON public.produto(fabricante_id);
CREATE INDEX idx_produto_slug ON public.produto(slug);
CREATE INDEX idx_produto_ativo ON public.produto(ativo);
CREATE INDEX idx_estoque_local_produto ON public.estoque_local(produto_id);
CREATE INDEX idx_pedido_cliente ON public.pedido(cliente_id);
CREATE INDEX idx_pedido_status ON public.pedido(status);
CREATE INDEX idx_pedido_data ON public.pedido(data);
CREATE INDEX idx_cliente_user ON public.cliente(user_id);
CREATE INDEX idx_carrinho_user ON public.carrinho(user_id);
CREATE INDEX idx_carrinho_session ON public.carrinho(session_id);
