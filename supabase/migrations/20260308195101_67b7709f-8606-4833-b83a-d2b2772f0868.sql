
ALTER TABLE public.producao ADD COLUMN custo_total numeric NOT NULL DEFAULT 0;
ALTER TABLE public.producao ADD COLUMN cancelado boolean NOT NULL DEFAULT false;
