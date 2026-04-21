-- Búsqueda léxica en español sobre normativa (sin necesidad de embeddings externos)
ALTER TABLE public.normativa_chunks
  ADD COLUMN IF NOT EXISTS search_tsv tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('spanish', coalesce(norma,'')), 'A') ||
    setweight(to_tsvector('spanish', coalesce(titulo,'')), 'A') ||
    setweight(to_tsvector('spanish', coalesce(articulo,'')), 'B') ||
    setweight(to_tsvector('spanish', coalesce(contenido,'')), 'C')
  ) STORED;

CREATE INDEX IF NOT EXISTS normativa_chunks_search_idx
  ON public.normativa_chunks USING GIN (search_tsv);

-- Función de búsqueda léxica (reemplaza el RAG vectorial con FTS español)
CREATE OR REPLACE FUNCTION public.buscar_normativa_fts(
  query_text text,
  match_count integer DEFAULT 5,
  filter_norma text DEFAULT NULL
) RETURNS TABLE (
  id uuid, norma text, titulo text, articulo text, contenido text,
  url_fuente text, rank real
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    nc.id, nc.norma, nc.titulo, nc.articulo, nc.contenido, nc.url_fuente,
    ts_rank(nc.search_tsv, plainto_tsquery('spanish', query_text)) AS rank
  FROM public.normativa_chunks nc
  WHERE nc.search_tsv @@ plainto_tsquery('spanish', query_text)
    AND (filter_norma IS NULL OR nc.norma = filter_norma)
  ORDER BY rank DESC
  LIMIT match_count;
$$;