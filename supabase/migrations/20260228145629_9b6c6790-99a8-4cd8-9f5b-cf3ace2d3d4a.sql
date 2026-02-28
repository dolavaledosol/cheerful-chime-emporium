-- View materializada com dados consolidados dos produtos para integração n8n/WhatsApp
CREATE MATERIALIZED VIEW public.vw_produtos_catalogo AS
SELECT
  p.produto_id,
  p.nome,
  p.descricao,
  p.unidade_medida,
  p.peso_liquido,
  f.nome AS familia,
  fab.nome AS fabricante,
  COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'local', le.nome,
        'disponivel', el.quantidade_disponivel,
        'preco', el.preco,
        'preco_promocional', el.preco_promocional
      )
    ) FILTER (WHERE el.estoque_local_id IS NOT NULL),
    '[]'::jsonb
  ) AS estoques
FROM public.produto p
LEFT JOIN public.familia f ON f.familia_id = p.familia_id
LEFT JOIN public.fabricante fab ON fab.fabricante_id = p.fabricante_id
LEFT JOIN public.estoque_local el ON el.produto_id = p.produto_id
LEFT JOIN public.local_estoque le ON le.local_estoque_id = el.local_estoque_id AND le.ativo = true
WHERE p.ativo = true
GROUP BY p.produto_id, p.nome, p.descricao, p.unidade_medida, p.peso_liquido, f.nome, fab.nome;

-- Índice único para refresh concorrente
CREATE UNIQUE INDEX idx_vw_produtos_catalogo_id ON public.vw_produtos_catalogo (produto_id);

-- Função para atualizar a view (chamar via cron ou edge function)
CREATE OR REPLACE FUNCTION public.refresh_produtos_catalogo()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.vw_produtos_catalogo;
END;
$$;

-- Permissão de leitura pública na view
GRANT SELECT ON public.vw_produtos_catalogo TO anon, authenticated;