
-- Drop all existing restrictive policies on pedido
DROP POLICY IF EXISTS "Admin manage pedidos" ON public.pedido;
DROP POLICY IF EXISTS "Users can insert own pedidos" ON public.pedido;
DROP POLICY IF EXISTS "Users view own pedidos" ON public.pedido;
DROP POLICY IF EXISTS "Vendedor view pedidos" ON public.pedido;

-- Recreate as PERMISSIVE
CREATE POLICY "Admin manage pedidos" ON public.pedido
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can insert own pedidos" ON public.pedido
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.cliente WHERE cliente.cliente_id = pedido.cliente_id AND cliente.user_id = auth.uid()));

CREATE POLICY "Users view own pedidos" ON public.pedido
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.cliente WHERE cliente.cliente_id = pedido.cliente_id AND cliente.user_id = auth.uid()));

CREATE POLICY "Vendedor view pedidos" ON public.pedido
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'vendedor'));

-- Also fix pedido_item policies
DROP POLICY IF EXISTS "Admin manage pedido_item" ON public.pedido_item;
DROP POLICY IF EXISTS "Users can insert own pedido_item" ON public.pedido_item;
DROP POLICY IF EXISTS "Users view own pedido_item" ON public.pedido_item;

CREATE POLICY "Admin manage pedido_item" ON public.pedido_item
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can insert own pedido_item" ON public.pedido_item
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM pedido JOIN cliente ON cliente.cliente_id = pedido.cliente_id WHERE pedido.pedido_id = pedido_item.pedido_id AND cliente.user_id = auth.uid()));

CREATE POLICY "Users view own pedido_item" ON public.pedido_item
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM pedido JOIN cliente ON cliente.cliente_id = pedido.cliente_id WHERE pedido.pedido_id = pedido_item.pedido_id AND cliente.user_id = auth.uid()));

-- Also fix pedido_status_historico policies
DROP POLICY IF EXISTS "Admin manage pedido_historico" ON public.pedido_status_historico;
DROP POLICY IF EXISTS "Users can insert own pedido_historico" ON public.pedido_status_historico;
DROP POLICY IF EXISTS "Users view own pedido_historico" ON public.pedido_status_historico;

CREATE POLICY "Admin manage pedido_historico" ON public.pedido_status_historico
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can insert own pedido_historico" ON public.pedido_status_historico
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM pedido JOIN cliente ON cliente.cliente_id = pedido.cliente_id WHERE pedido.pedido_id = pedido_status_historico.pedido_id AND cliente.user_id = auth.uid()));

CREATE POLICY "Users view own pedido_historico" ON public.pedido_status_historico
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM pedido JOIN cliente ON cliente.cliente_id = pedido.cliente_id WHERE pedido.pedido_id = pedido_status_historico.pedido_id AND cliente.user_id = auth.uid()));
