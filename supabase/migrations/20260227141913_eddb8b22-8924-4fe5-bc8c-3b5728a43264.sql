
-- Fix remaining permissive RLS: restrict integracao_log INSERT to admins only
DROP POLICY "Service insert integracao_log" ON public.integracao_log;
CREATE POLICY "Admin insert integracao_log" ON public.integracao_log FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
