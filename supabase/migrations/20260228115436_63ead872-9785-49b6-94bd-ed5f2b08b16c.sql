CREATE TABLE public.movimentacao_estoque (
  movimentacao_estoque_id uuid NOT NULL DEFAULT gen_random_uuid(),
  tipo text NOT NULL,
  produto_id uuid NOT NULL REFERENCES public.produto(produto_id),
  local_estoque_id uuid NOT NULL REFERENCES public.local_estoque(local_estoque_id),
  local_estoque_destino_id uuid REFERENCES public.local_estoque(local_estoque_id),
  quantidade numeric NOT NULL DEFAULT 0,
  documento text,
  fornecedor_id uuid REFERENCES public.fornecedor(fornecedor_id),
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.movimentacao_estoque ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage movimentacao_estoque" ON public.movimentacao_estoque
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));