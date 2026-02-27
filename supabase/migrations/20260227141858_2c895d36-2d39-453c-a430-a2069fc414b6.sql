
-- Fix function search_path for validate_produto_peso
CREATE OR REPLACE FUNCTION public.validate_produto_peso()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.peso_bruto IS NOT NULL AND NEW.peso_liquido IS NOT NULL AND NEW.peso_bruto < NEW.peso_liquido THEN
    RAISE EXCEPTION 'peso_bruto deve ser maior ou igual a peso_liquido';
  END IF;
  RETURN NEW;
END;
$$;

-- Fix function search_path for generate_produto_slug
CREATE OR REPLACE FUNCTION public.generate_produto_slug()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := lower(regexp_replace(NEW.nome, '[^a-zA-Z0-9]+', '-', 'g'));
    IF EXISTS (SELECT 1 FROM public.produto WHERE slug = NEW.slug AND produto_id != NEW.produto_id) THEN
      NEW.slug := NEW.slug || '-' || substring(gen_random_uuid()::text from 1 for 8);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Fix function search_path for update_updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Fix permissive RLS on integracao_log: restrict INSERT to authenticated or service_role
DROP POLICY "Admin insert integracao_log" ON public.integracao_log;
CREATE POLICY "Service insert integracao_log" ON public.integracao_log FOR INSERT TO authenticated WITH CHECK (true);
