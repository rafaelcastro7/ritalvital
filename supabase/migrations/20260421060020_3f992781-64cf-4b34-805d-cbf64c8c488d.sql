
-- 1) CONVERSACIONES: acceso público para crear/ver/editar
DROP POLICY IF EXISTS conv_self_all ON public.conversaciones;
ALTER TABLE public.conversaciones ALTER COLUMN user_id DROP NOT NULL;
CREATE POLICY conv_public_all ON public.conversaciones
  FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);

-- 2) MENSAJES: acceso público
DROP POLICY IF EXISTS msg_self_select ON public.mensajes;
DROP POLICY IF EXISTS msg_self_insert ON public.mensajes;
CREATE POLICY msg_public_all ON public.mensajes
  FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);

-- 3) REPORTES: acceso público
DROP POLICY IF EXISTS reportes_select ON public.reportes;
DROP POLICY IF EXISTS reportes_insert ON public.reportes;
ALTER TABLE public.reportes ALTER COLUMN generado_por DROP NOT NULL;
CREATE POLICY reportes_public_select ON public.reportes
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY reportes_public_insert ON public.reportes
  FOR INSERT TO anon, authenticated WITH CHECK (true);

-- 4) AGENT_RUNS: lectura pública
DROP POLICY IF EXISTS runs_admin_select ON public.agent_runs;
DROP POLICY IF EXISTS runs_self_insert ON public.agent_runs;
CREATE POLICY runs_public_select ON public.agent_runs
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY runs_public_insert ON public.agent_runs
  FOR INSERT TO anon, authenticated WITH CHECK (true);

-- 5) VALIDACIONES: lectura pública
DROP POLICY IF EXISTS val_admin_select ON public.validaciones;
CREATE POLICY val_public_select ON public.validaciones
  FOR SELECT TO anon, authenticated USING (true);

-- 6) NORMATIVA: escritura pública (además de la lectura ya pública)
DROP POLICY IF EXISTS normativa_admin_write ON public.normativa_chunks;
CREATE POLICY normativa_public_write ON public.normativa_chunks
  FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);

-- 7) STORAGE: hacer el bucket de reportes público
UPDATE storage.buckets SET public = true WHERE id = 'reportes';

-- Políticas de storage para acceso público al bucket reportes
DROP POLICY IF EXISTS "reportes_public_read" ON storage.objects;
DROP POLICY IF EXISTS "reportes_public_write" ON storage.objects;
CREATE POLICY "reportes_public_read" ON storage.objects
  FOR SELECT TO anon, authenticated USING (bucket_id = 'reportes');
CREATE POLICY "reportes_public_write" ON storage.objects
  FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'reportes');
