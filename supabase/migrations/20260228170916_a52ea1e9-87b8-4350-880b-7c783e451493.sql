
CREATE POLICY "Users insert own telefone"
ON public.cliente_telefone
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.cliente
    WHERE cliente.cliente_id = cliente_telefone.cliente_id
    AND cliente.user_id = auth.uid()
  )
);

CREATE POLICY "Users update own telefone"
ON public.cliente_telefone
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.cliente
    WHERE cliente.cliente_id = cliente_telefone.cliente_id
    AND cliente.user_id = auth.uid()
  )
);
