
-- Create a default stock location
INSERT INTO local_estoque (nome) VALUES ('Loja Principal');

-- Insert stock/pricing for all active products
INSERT INTO estoque_local (produto_id, local_estoque_id, preco, preco_promocional, quantidade_disponivel)
SELECT p.produto_id, le.local_estoque_id, 
  CASE p.nome
    WHEN 'Bolo de Chocolate' THEN 45.00
    WHEN 'Bolo de Cenoura' THEN 40.00
    WHEN 'Brigadeiro Gourmet' THEN 4.50
    WHEN 'Beijinho' THEN 4.00
    WHEN 'Coxinha' THEN 7.50
    WHEN 'Empada de Palmito' THEN 8.00
    WHEN 'Pão de Queijo' THEN 18.90
    WHEN 'Suco Natural de Laranja' THEN 12.00
    WHEN 'Torta de Limão' THEN 55.00
    WHEN 'Quiche de Queijo' THEN 35.00
    WHEN 'teste' THEN 10.00
    ELSE 10.00
  END as preco,
  CASE p.nome
    WHEN 'Brigadeiro Gourmet' THEN 3.50
    WHEN 'Pão de Queijo' THEN 15.90
    WHEN 'Torta de Limão' THEN 48.00
    ELSE NULL
  END as preco_promocional,
  CASE p.nome
    WHEN 'Bolo de Chocolate' THEN 15
    WHEN 'Bolo de Cenoura' THEN 12
    WHEN 'Brigadeiro Gourmet' THEN 100
    WHEN 'Beijinho' THEN 80
    WHEN 'Coxinha' THEN 50
    WHEN 'Empada de Palmito' THEN 40
    WHEN 'Pão de Queijo' THEN 30
    WHEN 'Suco Natural de Laranja' THEN 25
    WHEN 'Torta de Limão' THEN 8
    WHEN 'Quiche de Queijo' THEN 10
    WHEN 'teste' THEN 5
    ELSE 10
  END as quantidade_disponivel
FROM produto p
CROSS JOIN local_estoque le
WHERE p.ativo = true AND le.nome = 'Loja Principal';
