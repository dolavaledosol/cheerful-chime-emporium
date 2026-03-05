
CREATE OR REPLACE FUNCTION public.find_or_link_cliente_by_cpf(
  _cpf_cnpj text,
  _user_id uuid,
  _email text,
  _nome text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _cliente_id uuid;
BEGIN
  -- Try to find existing cliente by cpf_cnpj
  SELECT cliente_id INTO _cliente_id
  FROM public.cliente
  WHERE cpf_cnpj = _cpf_cnpj
  LIMIT 1;

  IF _cliente_id IS NOT NULL THEN
    -- Link to current user and update email
    UPDATE public.cliente
    SET user_id = _user_id,
        email = COALESCE(_email, email),
        updated_at = now()
    WHERE cliente_id = _cliente_id;
    RETURN _cliente_id;
  END IF;

  -- Try to find existing cliente by user_id
  SELECT cliente_id INTO _cliente_id
  FROM public.cliente
  WHERE user_id = _user_id
  LIMIT 1;

  IF _cliente_id IS NOT NULL THEN
    -- Update cpf_cnpj on existing record
    UPDATE public.cliente
    SET cpf_cnpj = _cpf_cnpj,
        email = COALESCE(_email, email),
        updated_at = now()
    WHERE cliente_id = _cliente_id;
    RETURN _cliente_id;
  END IF;

  -- Create new cliente
  INSERT INTO public.cliente (nome, email, user_id, cpf_cnpj)
  VALUES (_nome, _email, _user_id, _cpf_cnpj)
  RETURNING cliente_id INTO _cliente_id;

  RETURN _cliente_id;
END;
$$;
