
-- Comprehensive deduplication: handle cpf_cnpj duplicates
-- The user_id dedup was already done. Now handle cpf_cnpj dups.

DO $$
DECLARE
  rec RECORD;
  keeper_id uuid;
BEGIN
  -- For each duplicated cpf_cnpj, find the keeper (prefer one with user_id, then oldest)
  FOR rec IN 
    SELECT cpf_cnpj, 
           array_agg(cliente_id ORDER BY (user_id IS NOT NULL) DESC, created_at ASC) as ids
    FROM public.cliente 
    WHERE cpf_cnpj IS NOT NULL 
    GROUP BY cpf_cnpj 
    HAVING count(*) > 1
  LOOP
    keeper_id := rec.ids[1];
    
    -- Reassign all FK references from duplicates to keeper
    FOR i IN 2..array_length(rec.ids, 1) LOOP
      UPDATE public.pedido SET cliente_id = keeper_id WHERE cliente_id = rec.ids[i];
      UPDATE public.contas_receber SET cliente_id = keeper_id WHERE cliente_id = rec.ids[i];
      UPDATE public.clientewhats SET cliente_id = keeper_id WHERE cliente_id = rec.ids[i];
      
      -- Move enderecos that don't conflict
      UPDATE public.cliente_endereco SET cliente_id = keeper_id 
      WHERE cliente_id = rec.ids[i]
      AND NOT EXISTS (SELECT 1 FROM public.cliente_endereco ce2 WHERE ce2.cliente_id = keeper_id AND ce2.endereco_id = cliente_endereco.endereco_id);
      DELETE FROM public.cliente_endereco WHERE cliente_id = rec.ids[i];
      
      -- Move telefones
      UPDATE public.cliente_telefone SET cliente_id = keeper_id WHERE cliente_id = rec.ids[i];
      
      -- Delete duplicate
      DELETE FROM public.cliente WHERE cliente_id = rec.ids[i];
    END LOOP;
  END LOOP;
END $$;

-- Create unique index on cpf_cnpj
CREATE UNIQUE INDEX IF NOT EXISTS idx_cliente_cpf_unique ON public.cliente(cpf_cnpj) WHERE cpf_cnpj IS NOT NULL;

-- Also ensure user_id unique index exists
CREATE UNIQUE INDEX IF NOT EXISTS idx_cliente_user_unique ON public.cliente(user_id) WHERE user_id IS NOT NULL;

-- Update handle_new_user() to prevent duplicates
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _cliente_id uuid;
BEGIN
  INSERT INTO public.profiles (profile_id, nome)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''))
  ON CONFLICT (profile_id) DO NOTHING;

  SELECT cliente_id INTO _cliente_id
  FROM public.cliente
  WHERE user_id = NEW.id
  LIMIT 1;

  IF _cliente_id IS NULL THEN
    INSERT INTO public.cliente (user_id, nome, email)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', NEW.email),
      NEW.email
    );
  END IF;

  RETURN NEW;
END;
$function$;

-- Update find_or_link_cliente_by_cpf to handle unique constraint properly
CREATE OR REPLACE FUNCTION public.find_or_link_cliente_by_cpf(_cpf_cnpj text, _user_id uuid, _email text, _nome text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _cliente_id uuid;
  _existing_user_cliente_id uuid;
BEGIN
  -- 1. Try to find existing cliente by cpf_cnpj
  SELECT cliente_id INTO _cliente_id
  FROM public.cliente
  WHERE cpf_cnpj = _cpf_cnpj
  LIMIT 1;

  IF _cliente_id IS NOT NULL THEN
    -- Check if user already has a different cliente record
    SELECT cliente_id INTO _existing_user_cliente_id
    FROM public.cliente
    WHERE user_id = _user_id AND cliente_id != _cliente_id
    LIMIT 1;
    
    IF _existing_user_cliente_id IS NOT NULL THEN
      -- Merge: move all references from user's old cliente to the CPF-matched one
      UPDATE public.pedido SET cliente_id = _cliente_id WHERE cliente_id = _existing_user_cliente_id;
      UPDATE public.contas_receber SET cliente_id = _cliente_id WHERE cliente_id = _existing_user_cliente_id;
      UPDATE public.cliente_telefone SET cliente_id = _cliente_id WHERE cliente_id = _existing_user_cliente_id;
      -- Move enderecos without conflicts
      UPDATE public.cliente_endereco SET cliente_id = _cliente_id 
      WHERE cliente_id = _existing_user_cliente_id
      AND NOT EXISTS (SELECT 1 FROM public.cliente_endereco ce2 WHERE ce2.cliente_id = _cliente_id AND ce2.endereco_id = cliente_endereco.endereco_id);
      DELETE FROM public.cliente_endereco WHERE cliente_id = _existing_user_cliente_id;
      DELETE FROM public.cliente WHERE cliente_id = _existing_user_cliente_id;
    END IF;
    
    -- Link CPF-matched cliente to current user
    UPDATE public.cliente
    SET user_id = _user_id,
        email = COALESCE(_email, email),
        updated_at = now()
    WHERE cliente_id = _cliente_id;
    RETURN _cliente_id;
  END IF;

  -- 2. Try to find existing cliente by user_id
  SELECT cliente_id INTO _cliente_id
  FROM public.cliente
  WHERE user_id = _user_id
  LIMIT 1;

  IF _cliente_id IS NOT NULL THEN
    UPDATE public.cliente
    SET cpf_cnpj = _cpf_cnpj,
        email = COALESCE(_email, email),
        updated_at = now()
    WHERE cliente_id = _cliente_id;
    RETURN _cliente_id;
  END IF;

  -- 3. Create new cliente
  INSERT INTO public.cliente (nome, email, user_id, cpf_cnpj)
  VALUES (_nome, _email, _user_id, _cpf_cnpj)
  RETURNING cliente_id INTO _cliente_id;

  RETURN _cliente_id;
END;
$function$;
