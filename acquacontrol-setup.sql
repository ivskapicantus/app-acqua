-- ════════════════════════════════════════════════════════════════════════════
--  ACQUA NATACIÓN – Script de configuración Supabase
--  Ejecuta este script UNA SOLA VEZ en el SQL Editor de tu proyecto Supabase
--  (Dashboard → SQL Editor → New query → pega y corre)
-- ════════════════════════════════════════════════════════════════════════════

-- 1. Tabla principal de datos
CREATE TABLE IF NOT EXISTS app_state (
  id         text        PRIMARY KEY,
  data       jsonb       NOT NULL DEFAULT '{}'::jsonb,
  saved_at   timestamptz DEFAULT now()
);

-- 2. Seguridad: habilitar RLS
ALTER TABLE app_state ENABLE ROW LEVEL SECURITY;

-- 3. Política: la anon key puede leer y escribir
--    (apropiado para app de un solo cliente con URL privada)
CREATE POLICY "app_rw" ON app_state
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 4. Verificación – debe devolver 0 filas (tabla vacía al inicio)
SELECT count(*) AS filas_iniciales FROM app_state;

-- ════════════════════════════════════════════════════════════════════════════
--  ✅ Listo. Ahora ve a:
--     Project Settings → API
--     Copia "Project URL"  → SUPABASE_URL  en app.js
--     Copia "anon public"  → SUPABASE_ANON_KEY en app.js
-- ════════════════════════════════════════════════════════════════════════════
