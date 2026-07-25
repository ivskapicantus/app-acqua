-- ════════════════════════════════════════════════════════════════════════════
--  ACQUA NATACIÓN — Migración a esquema normalizado
--  Ejecuta este script UNA SOLA VEZ en Supabase → SQL Editor → New query
--  Es seguro de re-ejecutar (usa IF NOT EXISTS / ON CONFLICT), no borra nada.
-- ════════════════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────────────────
-- 1. TABLAS NUEVAS
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS students (
  id              text PRIMARY KEY,
  code            text,
  name            text NOT NULL,
  email           text DEFAULT '',
  phone           text DEFAULT '',
  documento       text DEFAULT '',
  status          text DEFAULT 'active',
  category        text DEFAULT '',
  nivel           text DEFAULT '',
  birthdate       text DEFAULT '',
  plan_type       text DEFAULT '4',
  custom_classes  text DEFAULT '',
  bonus_classes   numeric DEFAULT 0,
  classes_used    numeric DEFAULT 0,
  month_key       text DEFAULT '',
  responsible     text DEFAULT '',
  phone_acudiente text DEFAULT '',
  notes           text DEFAULT '',
  eps             text DEFAULT '',
  talla           text DEFAULT '',
  peso            text DEFAULT '',
  sangre          text DEFAULT '',
  camiseta        text DEFAULT '',
  waiver          jsonb,
  last_renewed_at timestamptz,
  plan_started_at timestamptz,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payments (
  id             text PRIMARY KEY,
  student_id     text NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  fecha          text,
  hora           text,
  valor          numeric DEFAULT 0,
  metodo         text DEFAULT '',
  concepto       text DEFAULT '',
  registrado_en  timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payments_student ON payments(student_id);

CREATE TABLE IF NOT EXISTS attendance (
  id          text PRIMARY KEY,
  student_id  text NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  at          timestamptz NOT NULL,
  month_key   text,
  source      text DEFAULT 'manual',
  extra       boolean DEFAULT false
);
CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance(student_id);

CREATE TABLE IF NOT EXISTS events (
  id          text PRIMARY KEY,
  name        text NOT NULL,
  date        text,
  place       text DEFAULT '',
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS event_attendees (
  event_id    text NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  student_id  text NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  paid        boolean DEFAULT false,
  signed      boolean DEFAULT false,
  signature   jsonb,
  added_at    timestamptz DEFAULT now(),
  PRIMARY KEY (event_id, student_id)
);

CREATE TABLE IF NOT EXISTS internal_events (
  id          text PRIMARY KEY,
  name        text NOT NULL,
  date        text,
  start_time  text,
  end_time    text,
  descripcion text DEFAULT '',
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_settings (
  id             text PRIMARY KEY DEFAULT 'main',
  business_name  text DEFAULT 'ACQUA NATACION',
  current_month  text,
  updated_at     timestamptz DEFAULT now()
);

-- ────────────────────────────────────────────────────────────────────────────
-- 2. RLS + PERMISOS (mismo criterio que ya usabas: anon + authenticated con acceso total)
-- ────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['students','payments','attendance','events','event_attendees','internal_events','app_settings']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "app_rw" ON %I', t);
    EXECUTE format('CREATE POLICY "app_rw" ON %I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO anon, authenticated', t);
  END LOOP;
END $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 3. MIGRACIÓN DE DATOS — toma el JSON actual de app_state y lo reparte en las tablas
-- ────────────────────────────────────────────────────────────────────────────

-- 3.1 Alumnos
INSERT INTO students (id, code, name, email, phone, documento, status, category, nivel,
  birthdate, plan_type, custom_classes, bonus_classes, classes_used, month_key,
  responsible, phone_acudiente, notes, eps, talla, peso, sangre, camiseta, waiver,
  last_renewed_at, plan_started_at, created_at, updated_at)
SELECT
  s->>'id', s->>'code', s->>'name', COALESCE(s->>'email',''), COALESCE(s->>'phone',''),
  COALESCE(s->>'documento',''), COALESCE(s->>'status','active'), COALESCE(s->>'category',''),
  COALESCE(s->>'nivel',''), COALESCE(s->>'birthdate',''), COALESCE(s->>'planType','4'),
  COALESCE(s->>'customClasses',''), COALESCE((s->>'bonusClasses')::numeric,0),
  COALESCE((s->>'classesUsed')::numeric,0), COALESCE(s->>'monthKey',''),
  COALESCE(s->>'responsible',''), COALESCE(s->>'phoneAcudiente',''), COALESCE(s->>'notes',''),
  COALESCE(s->>'eps',''), COALESCE(s->>'talla',''), COALESCE(s->>'peso',''),
  COALESCE(s->>'sangre',''), COALESCE(s->>'camiseta',''), s->'waiver',
  NULLIF(s->>'lastRenewedAt','')::timestamptz, NULLIF(s->>'planStartedAt','')::timestamptz,
  COALESCE(NULLIF(s->>'createdAt','')::timestamptz, now()),
  COALESCE(NULLIF(s->>'updatedAt','')::timestamptz, now())
FROM app_state, jsonb_array_elements(data->'students') AS s
WHERE id = 'acquacontrol-principal'
ON CONFLICT (id) DO NOTHING;

-- 3.2 Pagos (vienen anidados dentro de cada alumno)
INSERT INTO payments (id, student_id, fecha, hora, valor, metodo, concepto, registrado_en)
SELECT
  p->>'id', s->>'id', p->>'fecha', p->>'hora', COALESCE((p->>'valor')::numeric,0),
  COALESCE(p->>'metodo',''), COALESCE(p->>'concepto',''),
  COALESCE(NULLIF(p->>'registradoEn','')::timestamptz, now())
FROM app_state, jsonb_array_elements(data->'students') AS s,
     jsonb_array_elements(COALESCE(s->'payments','[]'::jsonb)) AS p
WHERE id = 'acquacontrol-principal'
ON CONFLICT (id) DO NOTHING;

-- 3.3 Asistencia
INSERT INTO attendance (id, student_id, at, month_key, source, extra)
SELECT
  a->>'id', a->>'studentId', (a->>'at')::timestamptz, a->>'monthKey',
  COALESCE(a->>'source','manual'), COALESCE((a->>'extra')::boolean,false)
FROM app_state, jsonb_array_elements(data->'attendance') AS a
WHERE id = 'acquacontrol-principal'
ON CONFLICT (id) DO NOTHING;

-- 3.4 Eventos
INSERT INTO events (id, name, date, place, created_at, updated_at)
SELECT
  e->>'id', e->>'name', e->>'date', COALESCE(e->>'place',''),
  COALESCE(NULLIF(e->>'createdAt','')::timestamptz, now()),
  COALESCE(NULLIF(e->>'updatedAt','')::timestamptz, now())
FROM app_state, jsonb_array_elements(data->'events') AS e
WHERE id = 'acquacontrol-principal'
ON CONFLICT (id) DO NOTHING;

-- 3.5 Asistentes de eventos
INSERT INTO event_attendees (event_id, student_id, paid, signed, signature, added_at)
SELECT
  e->>'id', a->>'studentId', COALESCE((a->>'paid')::boolean,false),
  COALESCE((a->>'signed')::boolean,false), a->'signature',
  COALESCE(NULLIF(a->>'addedAt','')::timestamptz, now())
FROM app_state, jsonb_array_elements(data->'events') AS e,
     jsonb_array_elements(COALESCE(e->'attendees','[]'::jsonb)) AS a
WHERE id = 'acquacontrol-principal'
ON CONFLICT (event_id, student_id) DO NOTHING;

-- 3.6 Eventos internos (calendario)
INSERT INTO internal_events (id, name, date, start_time, end_time, descripcion, created_at)
SELECT
  ie->>'id', ie->>'name', ie->>'date', ie->>'start', ie->>'end', COALESCE(ie->>'desc',''),
  COALESCE(NULLIF(ie->>'createdAt','')::timestamptz, now())
FROM app_state, jsonb_array_elements(data->'internalEvents') AS ie
WHERE id = 'acquacontrol-principal'
ON CONFLICT (id) DO NOTHING;

-- 3.7 Ajustes generales
INSERT INTO app_settings (id, business_name, current_month, updated_at)
SELECT 'main', COALESCE(data->'settings'->>'businessName','ACQUA NATACION'),
       COALESCE(data->>'currentMonth', to_char(now(),'YYYY-MM')), now()
FROM app_state
WHERE id = 'acquacontrol-principal'
ON CONFLICT (id) DO UPDATE SET
  business_name = EXCLUDED.business_name,
  current_month = EXCLUDED.current_month,
  updated_at    = now();

-- ────────────────────────────────────────────────────────────────────────────
-- 4. VERIFICACIÓN — compara conteos antes/después
-- ────────────────────────────────────────────────────────────────────────────
SELECT
  (SELECT jsonb_array_length(data->'students') FROM app_state WHERE id='acquacontrol-principal') AS alumnos_en_json_viejo,
  (SELECT count(*) FROM students)          AS alumnos_migrados,
  (SELECT count(*) FROM payments)          AS pagos_migrados,
  (SELECT count(*) FROM attendance)        AS asistencias_migradas,
  (SELECT count(*) FROM events)            AS eventos_migrados,
  (SELECT count(*) FROM event_attendees)   AS inscritos_migrados,
  (SELECT count(*) FROM internal_events)   AS eventos_internos_migrados;

-- ════════════════════════════════════════════════════════════════════════════
--  ✅ Si "alumnos_en_json_viejo" y "alumnos_migrados" coinciden, la migración
--     fue exitosa. La tabla app_state NO se toca ni se borra — queda como
--     respaldo de solo lectura. NO la elimines todavía.
--  Siguiente paso: reemplazar app.js por la versión que habla con las tablas
--  nuevas (te la entrego en el siguiente mensaje).
-- ════════════════════════════════════════════════════════════════════════════
