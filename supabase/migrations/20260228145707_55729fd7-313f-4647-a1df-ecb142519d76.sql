-- Agendar refresh da view a cada 5 minutos
SELECT cron.schedule(
  'refresh-produtos-catalogo',
  '*/5 * * * *',
  $$SELECT public.refresh_produtos_catalogo()$$
);