-- ============================================================
-- ENUMS
-- ============================================================
CREATE TYPE public.app_role AS ENUM ('admin', 'entidad', 'analista', 'ciudadano');
CREATE TYPE public.entidad_tipo AS ENUM ('nacional', 'departamental', 'municipal');
CREATE TYPE public.riesgo_nivel AS ENUM ('Bajo', 'Medio', 'Alto', 'Crítico');
CREATE TYPE public.alerta_tipo AS ENUM ('delta_irca', 'evento_ungrd', 'brote_sivigila', 'clima_ideam', 'manual');
CREATE TYPE public.severidad AS ENUM ('info', 'baja', 'media', 'alta', 'critica');
CREATE TYPE public.reporte_tipo AS ENUM ('ejecutivo', 'tecnico', 'mensual');
CREATE TYPE public.agent_tipo AS ENUM ('vigia', 'analista', 'reportero', 'validador');
CREATE TYPE public.mensaje_role AS ENUM ('user', 'assistant', 'tool', 'system');
CREATE TYPE public.run_status AS ENUM ('running', 'success', 'error', 'timeout');

-- ============================================================
-- TIMESTAMP HELPER
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================================
-- ENTIDADES (gobernaciones, alcaldías, MinSalud, etc.)
-- ============================================================
CREATE TABLE public.entidades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  tipo public.entidad_tipo NOT NULL,
  depto_code TEXT,
  muni_code TEXT,
  contacto_email TEXT,
  api_key_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_entidades_depto ON public.entidades(depto_code);
CREATE TRIGGER trg_entidades_updated BEFORE UPDATE ON public.entidades
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- PROFILES
-- ============================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  cargo TEXT,
  telefono TEXT,
  entidad_id UUID REFERENCES public.entidades(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- USER ROLES (separado para evitar privilege escalation)
-- ============================================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- has_role function (SECURITY DEFINER → no recursive RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- ============================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  -- Default role: ciudadano
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'ciudadano')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- IRCA SNAPSHOTS (histórico temporal — datos abiertos)
-- ============================================================
CREATE TABLE public.irca_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha DATE NOT NULL,
  muni_code TEXT NOT NULL,
  muni_nombre TEXT NOT NULL,
  depto_code TEXT NOT NULL,
  depto_nombre TEXT NOT NULL,
  irca_score NUMERIC(5,4) NOT NULL,
  nivel public.riesgo_nivel NOT NULL,
  componentes JSONB NOT NULL DEFAULT '{}'::jsonb,
  pipeline_version TEXT NOT NULL DEFAULT 'v1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(fecha, muni_code)
);
CREATE INDEX idx_snapshots_muni ON public.irca_snapshots(muni_code, fecha DESC);
CREATE INDEX idx_snapshots_depto ON public.irca_snapshots(depto_code, fecha DESC);
CREATE INDEX idx_snapshots_nivel ON public.irca_snapshots(nivel, fecha DESC);

-- ============================================================
-- ALERTAS (datos abiertos)
-- ============================================================
CREATE TABLE public.alertas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo public.alerta_tipo NOT NULL,
  severidad public.severidad NOT NULL,
  muni_code TEXT,
  depto_code TEXT,
  titulo TEXT NOT NULL,
  descripcion TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  fuente TEXT,
  url_fuente TEXT,
  agent_run_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_alertas_muni ON public.alertas(muni_code, created_at DESC);
CREATE INDEX idx_alertas_tipo ON public.alertas(tipo, created_at DESC);
CREATE INDEX idx_alertas_severidad ON public.alertas(severidad, created_at DESC);

-- ============================================================
-- SUSCRIPCIONES
-- ============================================================
CREATE TABLE public.suscripciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entidad_id UUID REFERENCES public.entidades(id) ON DELETE SET NULL,
  tipo_alerta public.alerta_tipo,
  severidad_minima public.severidad NOT NULL DEFAULT 'media',
  umbral_irca NUMERIC(5,4),
  depto_filter TEXT[],
  muni_filter TEXT[],
  email_destino TEXT NOT NULL,
  activa BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_suscripciones_user ON public.suscripciones(user_id);
CREATE TRIGGER trg_suscripciones_updated BEFORE UPDATE ON public.suscripciones
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- REPORTES
-- ============================================================
CREATE TABLE public.reportes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entidad_id UUID REFERENCES public.entidades(id) ON DELETE SET NULL,
  depto_code TEXT,
  muni_code TEXT,
  tipo public.reporte_tipo NOT NULL DEFAULT 'ejecutivo',
  titulo TEXT NOT NULL,
  pdf_url TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  generado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  agent_run_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_reportes_entidad ON public.reportes(entidad_id, created_at DESC);
CREATE INDEX idx_reportes_user ON public.reportes(generado_por, created_at DESC);

-- ============================================================
-- CONVERSACIONES + MENSAJES (chat con Agente Analista)
-- ============================================================
CREATE TABLE public.conversaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entidad_id UUID REFERENCES public.entidades(id) ON DELETE SET NULL,
  titulo TEXT NOT NULL DEFAULT 'Nueva conversación',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_conv_user ON public.conversaciones(user_id, updated_at DESC);
CREATE TRIGGER trg_conv_updated BEFORE UPDATE ON public.conversaciones
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.mensajes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversacion_id UUID NOT NULL REFERENCES public.conversaciones(id) ON DELETE CASCADE,
  role public.mensaje_role NOT NULL,
  content TEXT NOT NULL,
  tool_calls JSONB,
  tool_name TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_msg_conv ON public.mensajes(conversacion_id, created_at);

-- ============================================================
-- AGENT RUNS (auditoría total)
-- ============================================================
CREATE TABLE public.agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agente public.agent_tipo NOT NULL,
  trigger TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  conversacion_id UUID REFERENCES public.conversaciones(id) ON DELETE SET NULL,
  input JSONB NOT NULL DEFAULT '{}'::jsonb,
  output JSONB,
  herramientas_usadas JSONB NOT NULL DEFAULT '[]'::jsonb,
  modelo TEXT NOT NULL,
  tokens_in INTEGER,
  tokens_out INTEGER,
  duracion_ms INTEGER,
  error TEXT,
  status public.run_status NOT NULL DEFAULT 'running',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_runs_agente ON public.agent_runs(agente, created_at DESC);
CREATE INDEX idx_runs_status ON public.agent_runs(status, created_at DESC);

-- ============================================================
-- VALIDACIONES (anomalías detectadas)
-- ============================================================
CREATE TABLE public.validaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  muni_code TEXT,
  depto_code TEXT,
  fuente TEXT NOT NULL,
  tipo_anomalia TEXT NOT NULL,
  descripcion TEXT NOT NULL,
  severidad public.severidad NOT NULL DEFAULT 'media',
  resuelta BOOLEAN NOT NULL DEFAULT false,
  agent_run_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_val_muni ON public.validaciones(muni_code, created_at DESC);
CREATE INDEX idx_val_resuelta ON public.validaciones(resuelta, severidad);

-- ============================================================
-- RLS — habilitar en todas
-- ============================================================
ALTER TABLE public.entidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.irca_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alertas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suscripciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reportes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mensajes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.validaciones ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- POLÍTICAS RLS
-- ============================================================

-- ENTIDADES: lectura pública, escritura solo admin
CREATE POLICY "entidades_select_all" ON public.entidades FOR SELECT USING (true);
CREATE POLICY "entidades_admin_all" ON public.entidades FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- PROFILES: cada quien ve y edita el suyo; admin ve todo
CREATE POLICY "profiles_self_select" ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "profiles_self_update" ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_self_insert" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

-- USER_ROLES: el usuario ve sus propios roles; solo admin escribe
CREATE POLICY "roles_self_select" ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "roles_admin_write" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- IRCA_SNAPSHOTS: lectura pública (datos abiertos), escritura solo backend
CREATE POLICY "snapshots_public_read" ON public.irca_snapshots FOR SELECT USING (true);

-- ALERTAS: lectura pública, escritura solo backend
CREATE POLICY "alertas_public_read" ON public.alertas FOR SELECT USING (true);

-- SUSCRIPCIONES: privadas por usuario
CREATE POLICY "susc_self_all" ON public.suscripciones FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- REPORTES: el creador ve los suyos; miembros de la entidad también
CREATE POLICY "reportes_select" ON public.reportes FOR SELECT TO authenticated
  USING (
    auth.uid() = generado_por
    OR public.has_role(auth.uid(), 'admin')
    OR (entidad_id IS NOT NULL AND entidad_id IN (
      SELECT entidad_id FROM public.profiles WHERE id = auth.uid()
    ))
  );
CREATE POLICY "reportes_insert" ON public.reportes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = generado_por);

-- CONVERSACIONES: privadas
CREATE POLICY "conv_self_all" ON public.conversaciones FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- MENSAJES: visible si la conversación es del usuario
CREATE POLICY "msg_self_select" ON public.mensajes FOR SELECT TO authenticated
  USING (conversacion_id IN (SELECT id FROM public.conversaciones WHERE user_id = auth.uid()));
CREATE POLICY "msg_self_insert" ON public.mensajes FOR INSERT TO authenticated
  WITH CHECK (conversacion_id IN (SELECT id FROM public.conversaciones WHERE user_id = auth.uid()));

-- AGENT_RUNS: solo admin
CREATE POLICY "runs_admin_select" ON public.agent_runs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR auth.uid() = user_id);

-- VALIDACIONES: solo admin
CREATE POLICY "val_admin_select" ON public.validaciones FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));