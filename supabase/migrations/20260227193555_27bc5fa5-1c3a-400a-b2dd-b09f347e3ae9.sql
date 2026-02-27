
-- Add conta_corrente to banco
ALTER TABLE public.banco ADD COLUMN conta_corrente text DEFAULT NULL;

-- Update handle_new_user to also create cliente with email
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (profile_id, nome)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''));
  
  INSERT INTO public.cliente (user_id, nome, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', NEW.email),
    NEW.email
  )
  ON CONFLICT DO NOTHING;
  
  RETURN NEW;
END;
$function$;
