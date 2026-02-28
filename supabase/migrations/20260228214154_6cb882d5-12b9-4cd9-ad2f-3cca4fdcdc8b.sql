
DROP MATERIALIZED VIEW IF EXISTS public.vw_produtos_catalogo;

CREATE MATERIALIZED VIEW public.vw_produtos_catalogo AS
SELECT
  p.produto_id,
  p.nome,
  p.descricao,
  p.unidade_medida,
  p.peso_liquido,
  CASE
    WHEN fp.nome IS NOT NULL THEN fp.nome || ' > ' || f.nome
    ELSE f.nome
  END AS familia,
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
LEFT JOIN public.familia fp ON fp.familia_id = f.familia_pai_id
LEFT JOIN public.fabricante fab ON fab.fabricante_id = p.fabricante_id
LEFT JOIN public.estoque_local el ON el.produto_id = p.produto_id
LEFT JOIN public.local_estoque le ON le.local_estoque_id = el.local_estoque_id
WHERE p.ativo = true
GROUP BY p.produto_id, p.nome, p.descricao, p.unidade_medida, p.peso_liquido, f.nome, fp.nome, fab.nome;

CREATE UNIQUE INDEX ON public.vw_produtos_catalogo (produto_id);

GRANT SELECT ON public.vw_produtos_catalogo TO anon, authenticated;
