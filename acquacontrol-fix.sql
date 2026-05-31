-- ════════════════════════════════════════════════════════════════════════════
--  ACQUA NATACIÓN – Script de CORRECCIÓN Supabase
--  Ejecuta esto en SQL Editor → New query si ya corriste el script anterior
--  Esto añade los permisos que faltaban para que el rol anon pueda escribir
-- ════════════════════════════════════════════════════════════════════════════

-- 1. Permisos de tabla para el rol anon (lectura + escritura)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE app_state TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE app_state TO authenticated;

-- 2. Elimina políticas anteriores si existen (para recrearlas limpias)
DROP POLICY IF EXISTS "app_rw"  ON app_state;
DROP POLICY IF EXISTS "Allow all operations" ON app_state;

-- 3. Política única: acceso total con la anon key
CREATE POLICY "app_rw" ON app_state
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- 4. Verificación – debe mostrar los datos actuales de la app
SELECT id, saved_at,
       jsonb_array_length(data->'students')   AS alumnos,
       jsonb_array_length(data->'attendance') AS asistencias
FROM   app_state;

-- ════════════════════════════════════════════════════════════════════════════
--  ✅ Listo. Recarga la app en todos los dispositivos.
--     El punto debe quedar VERDE y los datos sincronizarse solos.
-- ════════════════════════════════════════════════════════════════════════════
