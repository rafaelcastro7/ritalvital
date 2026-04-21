-- Crear schema extensions y mover pgvector
CREATE SCHEMA IF NOT EXISTS extensions;
ALTER EXTENSION vector SET SCHEMA extensions;

-- Permitir uso del schema
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;