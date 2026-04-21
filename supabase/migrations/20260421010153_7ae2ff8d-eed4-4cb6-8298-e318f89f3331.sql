-- Habilitar pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Tabla de chunks de normativa
CREATE TABLE public.normativa_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  norma text NOT NULL,
  titulo text NOT NULL,
  articulo text,
  contenido text NOT NULL,
  url_fuente text,
  tokens integer,
  embedding vector(768),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_normativa_norma ON public.normativa_chunks(norma);
CREATE INDEX idx_normativa_embedding ON public.normativa_chunks
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);

ALTER TABLE public.normativa_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "normativa_public_read" ON public.normativa_chunks
  FOR SELECT USING (true);

CREATE POLICY "normativa_admin_write" ON public.normativa_chunks
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- RPC para búsqueda semántica
CREATE OR REPLACE FUNCTION public.match_normativa(
  query_embedding vector(768),
  match_count integer DEFAULT 5,
  filter_norma text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  norma text,
  titulo text,
  articulo text,
  contenido text,
  url_fuente text,
  similarity float
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    nc.id, nc.norma, nc.titulo, nc.articulo, nc.contenido, nc.url_fuente,
    1 - (nc.embedding <=> query_embedding) AS similarity
  FROM public.normativa_chunks nc
  WHERE nc.embedding IS NOT NULL
    AND (filter_norma IS NULL OR nc.norma = filter_norma)
  ORDER BY nc.embedding <=> query_embedding
  LIMIT match_count;
$$;