
-- Insert sample families
INSERT INTO familia (nome, descricao) VALUES
  ('Bolos', 'Bolos caseiros e confeitados'),
  ('Doces', 'Doces variados e sobremesas'),
  ('Salgados', 'Salgados e petiscos'),
  ('Bebidas', 'Sucos, refrigerantes e bebidas');

-- Insert sample manufacturers
INSERT INTO fabricante (nome) VALUES
  ('Produção Própria'),
  ('Fornecedor A'),
  ('Fornecedor B');

-- Insert sample products
INSERT INTO produto (nome, descricao, unidade_medida, familia_id, fabricante_id) VALUES
  ('Bolo de Chocolate', 'Bolo de chocolate com cobertura de brigadeiro', 'un',
    (SELECT familia_id FROM familia WHERE nome = 'Bolos' LIMIT 1),
    (SELECT fabricante_id FROM fabricante WHERE nome = 'Produção Própria' LIMIT 1)),
  ('Bolo de Cenoura', 'Bolo de cenoura com calda de chocolate', 'un',
    (SELECT familia_id FROM familia WHERE nome = 'Bolos' LIMIT 1),
    (SELECT fabricante_id FROM fabricante WHERE nome = 'Produção Própria' LIMIT 1)),
  ('Brigadeiro Gourmet', 'Brigadeiro artesanal - unidade', 'un',
    (SELECT familia_id FROM familia WHERE nome = 'Doces' LIMIT 1),
    (SELECT fabricante_id FROM fabricante WHERE nome = 'Produção Própria' LIMIT 1)),
  ('Beijinho', 'Beijinho tradicional - unidade', 'un',
    (SELECT familia_id FROM familia WHERE nome = 'Doces' LIMIT 1),
    (SELECT fabricante_id FROM fabricante WHERE nome = 'Produção Própria' LIMIT 1)),
  ('Coxinha', 'Coxinha de frango cremosa', 'un',
    (SELECT familia_id FROM familia WHERE nome = 'Salgados' LIMIT 1),
    (SELECT fabricante_id FROM fabricante WHERE nome = 'Produção Própria' LIMIT 1)),
  ('Empada de Palmito', 'Empada recheada com palmito', 'un',
    (SELECT familia_id FROM familia WHERE nome = 'Salgados' LIMIT 1),
    (SELECT fabricante_id FROM fabricante WHERE nome = 'Produção Própria' LIMIT 1)),
  ('Pão de Queijo', 'Pão de queijo mineiro - pacote 500g', 'pct',
    (SELECT familia_id FROM familia WHERE nome = 'Salgados' LIMIT 1),
    (SELECT fabricante_id FROM fabricante WHERE nome = 'Produção Própria' LIMIT 1)),
  ('Suco Natural de Laranja', 'Suco natural de laranja - 500ml', 'ml',
    (SELECT familia_id FROM familia WHERE nome = 'Bebidas' LIMIT 1),
    (SELECT fabricante_id FROM fabricante WHERE nome = 'Fornecedor A' LIMIT 1)),
  ('Torta de Limão', 'Torta de limão com merengue', 'un',
    (SELECT familia_id FROM familia WHERE nome = 'Doces' LIMIT 1),
    (SELECT fabricante_id FROM fabricante WHERE nome = 'Produção Própria' LIMIT 1)),
  ('Quiche de Queijo', 'Quiche de queijo com bacon', 'un',
    (SELECT familia_id FROM familia WHERE nome = 'Salgados' LIMIT 1),
    (SELECT fabricante_id FROM fabricante WHERE nome = 'Fornecedor B' LIMIT 1));
