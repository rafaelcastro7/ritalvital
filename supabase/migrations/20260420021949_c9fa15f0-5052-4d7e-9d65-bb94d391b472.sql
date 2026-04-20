-- 1. Storage bucket privado para reportes PDF
INSERT INTO storage.buckets (id, name, public) 
VALUES ('reportes', 'reportes', false)
ON CONFLICT (id) DO NOTHING;

-- Políticas storage para bucket 'reportes'
CREATE POLICY "reportes_admin_all"
ON storage.objects FOR ALL
TO authenticated
USING (bucket_id = 'reportes' AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'reportes' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "reportes_self_read"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'reportes' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 2. Permitir a authenticated insertar agent_runs propios (para chat-analista)
CREATE POLICY "runs_self_insert"
ON public.agent_runs FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- 3. Índices de rendimiento
CREATE INDEX IF NOT EXISTS idx_irca_snap_fecha_muni 
  ON public.irca_snapshots (fecha DESC, muni_code);
CREATE INDEX IF NOT EXISTS idx_irca_snap_muni_fecha 
  ON public.irca_snapshots (muni_code, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_alertas_created 
  ON public.alertas (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alertas_muni 
  ON public.alertas (muni_code, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_runs_user_created 
  ON public.agent_runs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mensajes_conv_created 
  ON public.mensajes (conversacion_id, created_at);
CREATE INDEX IF NOT EXISTS idx_validaciones_created 
  ON public.validaciones (created_at DESC);

-- 4. Habilitar pg_cron y pg_net para los crons de agentes
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;