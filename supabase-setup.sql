-- ══════════════════════════════════════════════════════════════════════
--  ACQUA NATACION — Configuracion de seguridad en Supabase
--  Ejecuta este script en: Supabase Dashboard → SQL Editor → New Query
-- ══════════════════════════════════════════════════════════════════════

-- 1. Asegurarse de que la tabla app_state existe
CREATE TABLE IF NOT EXISTS app_state (
  id TEXT PRIMARY KEY,
  data JSONB,
  saved_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Activar Row Level Security (RLS)
ALTER TABLE app_state ENABLE ROW LEVEL SECURITY;

-- 3. Eliminar politicas anteriores si existen
DROP POLICY IF EXISTS "Acceso publico" ON app_state;
DROP POLICY IF EXISTS "Public access" ON app_state;
DROP POLICY IF EXISTS "Solo autenticados SELECT" ON app_state;
DROP POLICY IF EXISTS "Solo autenticados INSERT" ON app_state;
DROP POLICY IF EXISTS "Solo autenticados UPDATE" ON app_state;

-- 4. Nueva politica: solo usuarios autenticados pueden LEER
CREATE POLICY "Solo autenticados SELECT"
  ON app_state
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- 5. Nueva politica: solo usuarios autenticados pueden INSERTAR
CREATE POLICY "Solo autenticados INSERT"
  ON app_state
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- 6. Nueva politica: solo usuarios autenticados pueden ACTUALIZAR
CREATE POLICY "Solo autenticados UPDATE"
  ON app_state
  FOR UPDATE
  USING (auth.role() = 'authenticated');

-- ══════════════════════════════════════════════════════════════════════
--  INSTRUCCIONES PARA CREAR EL USUARIO ADMINISTRADOR:
--
--  1. Ve a Supabase Dashboard → Authentication → Users
--  2. Haz clic en "Add user" → "Create new user"
--  3. Email:    admin@acquanatacion.com
--  4. Password: (la contrasena que quieras — ESTA si es secreta)
--  5. Activa "Auto Confirm User"
--  6. Haz clic en "Create User"
--
--  IMPORTANTE: La contrasena que pongas aqui es la que debes
--  ingresar en la app. No la escribas en ningun codigo.
-- ══════════════════════════════════════════════════════════════════════
