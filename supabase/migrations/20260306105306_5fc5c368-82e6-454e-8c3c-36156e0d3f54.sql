
-- Create permission level enum
CREATE TYPE public.permission_level AS ENUM ('sem_acesso', 'ver', 'editar');

-- Create user_permissions table
CREATE TABLE public.user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recurso text NOT NULL,
  nivel permission_level NOT NULL DEFAULT 'sem_acesso',
  UNIQUE (user_id, recurso)
);

-- Enable RLS
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- Admin can manage all permissions
CREATE POLICY "Admin manage user_permissions"
  ON public.user_permissions
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Users can view own permissions
CREATE POLICY "Users view own permissions"
  ON public.user_permissions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Security definer function to check permission level
CREATE OR REPLACE FUNCTION public.get_permission(_user_id uuid, _recurso text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT nivel::text FROM public.user_permissions WHERE user_id = _user_id AND recurso = _recurso),
    CASE WHEN public.has_role(_user_id, 'admin') THEN 'editar' ELSE 'sem_acesso' END
  )
$$;
