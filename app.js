(() => {
  const STORAGE_KEY      = "aquacontrol.state.v1";
  const DEFAULT_BUSINESS = "ACQUA NATACION";

  /* Email del admin (no es secreto — la contrasena se valida en Supabase) */
  const ADMIN_EMAIL = "admin@acquanatacion.com";

  /* Supabase config */
  const SUPABASE_URL      = "https://sokfsbzzmrpijkmlpmag.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNva2ZzYnp6bXJwaWprbWxwbWFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2MzYyNDgsImV4cCI6MjA5NDIxMjI0OH0.bor86ohZ-u9sUl_Lr85vDHhaw7rMyCRuNiX1ZAHVSaM";
  const CLOUD_ROW_ID      = "acquacontrol-principal";
  const CLOUD_ENABLED     = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

  const PLAN_LABELS = {
    "1_practica":    "1 practica libre",
    "1_grupal":      "1 clase grupal",
    "1_matronat":    "1 clase de matronatacion",
    "4":             "4 clases/mes",
    "9":             "9 clases/mes",
    "8_practicas":   "8 practicas libres",
    "13":            "13 clases/mes",
    "13_equipo":     "13 clases equipo",
    "5_vacacional":  "5 clases vacacional",
    "matronat_4":    "Matronatacion 4 clases/mes",
    "matronat_8":    "Matronatacion 8 clases/mes",
    "matronat_personalizada_4": "4 clases de Matronatacion personalizadas",
    "anual_4":       "Plan anual 4 clases/mes",
    "anual_9":       "Plan anual 9 clases/mes",
    "anual_13":      "Plan anual 13 clases/mes",
    "personalizado_4": "Personalizado 4 clases",
    "personalizado_8": "Personalizado 8 clases",
    "anual":         "Plan anual (sin definir)",
    "obsequio_1":    "Obsequio 1 clase",
    "obsequio_2":    "Obsequio 2 clases",
    "obsequio_3":    "Obsequio 3 clases",
    custom:          "Personalizado",
  };
  const PLAN_CLASSES = { "1_practica":1,"1_grupal":1,"1_matronat":1,"4":4,"9":9,"8_practicas":8,"13":13,"13_equipo":13,"5_vacacional":5,"matronat_4":4,"matronat_8":8,"matronat_personalizada_4":4,"anual_4":48,"anual_9":108,"anual_13":156,"personalizado_4":4,"personalizado_8":8,"anual":100,"obsequio_1":1,"obsequio_2":2,"obsequio_3":3 };
  /* Planes de "practica libre" — usan 30 dias de vigencia en el carnet en vez de 35 */
  const PRACTICA_LIBRE_PLANS = ["1_practica","8_practicas"];
  function diasVigenciaPlan(planType){ return (typeof DIAS_PLAN_VIGENCIA!=="undefined"&&DIAS_PLAN_VIGENCIA[planType]) || 30; }
  /* Planes anuales: 12 meses x 4, 9 o 13 clases. Se descuentan del total del
     año con cada clase y NO se reinician con la renovacion mensual. */
  const PLANES_ANUALES = ["anual_4","anual_9","anual_13","anual"];
  function esPlanAnual(student){ return !!student && PLANES_ANUALES.includes(student.planType); }

  const app               = document.querySelector("#app");
  const toast             = document.querySelector("#toast");
  const globalMonth       = document.querySelector("#globalMonth");
  const businessNameLabel = document.querySelector("#businessNameLabel");

  let activeView          = "checkin";
  let editingStudentId    = null;
  let activeEventId       = null;
  let signatureDraft      = null;
  let eventEditId         = null;
  let attendeeDataDraft   = null;
  let waiverEditId = "travesia", plantillasCache = null, plantillasLoading = false, plantillasError = "";
  let studentsFormVisible = false;
  let cloudStatus         = CLOUD_ENABLED ? "connecting" : "disabled";
  let state               = loadState();
  let studentFilters      = { search: "", plan: "all", status: "active" };
  let checkinSearch       = "";
  let cardSearch          = "";
  let reportsSearch       = "";
  let eventEnrollSearch   = "";
  let expiringFilter      = "all";
  let expiringSearch      = "";
  let useJsQr             = false;

  // Cliente Supabase JS (cargado vía CDN en index.html)
  let _supa = null;
  if (window.supabase && CLOUD_ENABLED) {
    _supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, storageKey: "acqua.auth" }
    });
  }
  let isAuthenticated   = false;   // Se verifica via sesion de Supabase
  let loginModalVisible = true;    // Abre login al inicio
  let renewModalStudentId  = null;
  let renewModalChangePlan = false;
  let settingsUnlocked     = false;
  let _renderPrevView      = null;   // Rastrea la vista anterior para preservar formularios
  let calendarView         = 'list'; // Vista de eventos: 'list' | 'calendar'
  let calendarMonth        = null;   // Mes visible en el calendario  // Ajustes requiere reautenticacion

  let scanner = { detector: null, stream: null, timer: null, busy: false, lastPayload: "", lastPayloadAt: 0 };

  const icons = {
    plus:      '<path d="M12 5v14M5 12h14" />',
    save:      '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" /><path d="M17 21v-8H7v8" /><path d="M7 3v5h8" />',
    edit:      '<path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />',
    refresh:   '<path d="M21 12a9 9 0 0 1-15 6.7L3 16" /><path d="M3 21v-5h5" /><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M21 3v5h-5" />',
    check:     '<path d="m20 6-11 11-5-5" />',
    scan:      '<path d="M3 7V5a2 2 0 0 1 2-2h2" /><path d="M17 3h2a2 2 0 0 1 2 2v2" /><path d="M21 17v2a2 2 0 0 1-2 2h-2" /><path d="M7 21H5a2 2 0 0 1-2-2v-2" /><path d="M7 12h10" />',
    stop:      '<rect x="6" y="6" width="12" height="12" rx="2" />',
    arrowLeft: '<path d="M19 12H5" /><path d="m12 19-7-7 7-7" />',
    x:         '<path d="M18 6 6 18" /><path d="m6 6 12 12" />',
    print:     '<path d="M6 9V2h12v7" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><path d="M6 14h12v8H6z" />',
    download:  '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5 5 5-5" /><path d="M12 15V3" />',
    upload:    '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M17 8l-5-5-5 5" /><path d="M12 3v12" />',
    calendar:  '<path d="M8 2v4" /><path d="M16 2v4" /><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M3 10h18" />',
    map:       '<path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="3" />',
    dollar:    '<path d="M12 2v20" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7H14a3.5 3.5 0 0 1 0 7H6" />',
    signature: '<path d="M3 21c3-5 6-5 9-1 2 2 5 1 8-2" /><path d="M14.5 4.5a2.1 2.1 0 0 1 3 3L9 16l-4 1 1-4Z" />',
    message:   '<path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 20l1.3-5.2A8.4 8.4 0 1 1 21 11.5Z" />',
    trash:     '<path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" />',
    user:      '<path d="M20 21a8 8 0 0 0-16 0" /><circle cx="12" cy="7" r="4" />',
    file:      '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6" />',
    lock:      '<rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />',
    search:    '<circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />',
    alert:     '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4" /><path d="M12 17h.01" />',
    clock:     '<circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />',
    zap:       '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z" />',
    activity:  '<path d="M22 12h-4l-3 9L9 3l-3 9H2" />',
    chart:     '<path d="M3 3v18h18" /><path d="M7 15l4-4 3 3 5-6" />',
    users:     '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />',
    userPlus:  '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M19 8v6M22 11h-6" />',
    card:      '<rect x="2" y="4" width="20" height="16" rx="3" /><circle cx="8.5" cy="11" r="2.5" /><path d="M5 16.5c.8-1.5 2-2.2 3.5-2.2s2.7.7 3.5 2.2M15 9h4M15 13h3" />',
    more:      '<circle cx="5" cy="12" r="1.4" /><circle cx="12" cy="12" r="1.4" /><circle cx="19" cy="12" r="1.4" />',
    pause:     '<rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" />',
    play:      '<path d="m7 4 13 8-13 8Z" />',
    camera:    '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3Z" /><circle cx="12" cy="13" r="3.5" />',
    info:      '<circle cx="12" cy="12" r="9" /><path d="M12 16v-4" /><path d="M12 8h.01" />',
    qr:        '<rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3" />',
    chevronLeft:  '<path d="m15 18-6-6 6-6" />',
    chevronRight: '<path d="m9 18 6-6-6-6" />',
    list:      '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />',
    sparkles:  '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9Z" /><path d="M19 16v4M17 18h4" />',
    flag:      '<path d="M4 22V4" /><path d="M4 4h12l-2 4 2 4H4" />',
    copy:      '<rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />',
    eye:       '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" />',
    trophy:    '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0Z" /><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" />',
    shield:    '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" />',
    shuffle:   '<path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />',
    gift:      '<rect x="3" y="8" width="18" height="4" rx="1" /><path d="M12 8v13M19 12v9H5v-9" /><path d="M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5" />',
    minus:     '<path d="M5 12h14" />',
    undo:      '<path d="M9 14 4 9l5-5" /><path d="M4 9h11a5 5 0 0 1 0 10h-3" />',
    sliders:   '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />',
  };

  function icon(name) {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || ""}</svg>`;
  }
  function initials(name){ const p=String(name||"").trim().split(/\s+/).filter(Boolean); return (((p[0]||"?")[0]||"?")+(p[1]?p[1][0]:"")).toUpperCase(); }
  function avatar(name,cls=""){ const s=String(name||""); let h=0; for(let i=0;i<s.length;i++) h=(h*31+s.charCodeAt(i))>>>0; const hue=[205,218,192,232,176,256,24,40,198,212][h%10]; return `<span class="avatar ${cls}" style="--h:${hue}" aria-hidden="true">${escapeHtml(initials(s))}</span>`; }
  function shortDate(d){ return new Intl.DateTimeFormat("es-CO",{day:"2-digit",month:"short",year:"numeric"}).format(d); }
  function parseLocalDate(str){ if(!str) return null; const [y,m,d]=String(str).split("-").map(Number); if(!y||!m||!d) return null; return new Date(y,m-1,d); }
  function prettyDate(str){ const d=parseLocalDate(str); if(!d) return str||"Sin fecha"; return new Intl.DateTimeFormat("es-CO",{weekday:"short",day:"numeric",month:"short",year:"numeric"}).format(d); }
  function dateTile(str,cls=""){ const d=parseLocalDate(str); if(!d) return `<div class="date-tile ${cls}"><b>?</b><small>s/f</small></div>`; const past=d<new Date(new Date().toDateString()); const mon=new Intl.DateTimeFormat("es-CO",{month:"short"}).format(d).replace(".",""); return `<div class="date-tile ${cls} ${past?"is-past":""}" title="${escapeHtml(prettyDate(str))}"><b>${d.getDate()}</b><small>${escapeHtml(mon)}</small></div>`; }
  function wavesSvg(cls="hero-waves"){ return `<svg class="${cls}" viewBox="0 0 800 120" preserveAspectRatio="none" aria-hidden="true"><path d="M0 50 C130 20 270 80 400 50 S670 20 800 50 V120 H0Z" fill="rgba(34,195,240,.16)"/><path d="M0 82 C130 57 270 107 400 82 S670 57 800 82 V120 H0Z" fill="rgba(255,255,255,.07)"/></svg>`; }
  function panelHead(title,sub,iconName,tone="",actions=""){ return `<div class="panel-header"><div class="panel-title">${iconName?`<span class="icon-badge ${tone}">${icon(iconName)}</span>`:""}<div><h3>${title}</h3>${sub?`<p>${sub}</p>`:""}</div></div>${actions}</div>`; }
  function searchBox(attrs,placeholder,value){ return `<div class="search-wrap">${icon("search")}<input class="search" type="search" ${attrs} placeholder="${escapeHtml(placeholder)}" value="${escapeHtml(value)}"></div>`; }
  /* ── Ayudantes visuales del rediseño (solo presentacion) ── */

  /* ESTADO */
  function loadState() {
    const fallback = { version:1, currentMonth: monthKey(new Date()), settings:{ businessName: DEFAULT_BUSINESS }, students:[], attendance:[], events:[], internalEvents:[] };
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return fallback;
      const p = JSON.parse(raw);
      return { ...fallback, ...p, settings:{ ...fallback.settings, ...(p.settings||{}) },
        students: Array.isArray(p.students) ? p.students : [],
        attendance: Array.isArray(p.attendance) ? p.attendance : [],
        events: Array.isArray(p.events) ? p.events : [] };
    } catch(e){ console.error(e); return fallback; }
  }
  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (CLOUD_ENABLED) debouncedCloudSave();
  }
  /* Para acciones importantes y poco frecuentes (registrar clase, registrar
     alumno, pagos, ajustes de plan) NO conviene esperar el "ratito" del
     guardado normal: si el celular se bloquea o cambia de app justo despues
     (por ejemplo, para mandar el codigo por WhatsApp), ese guardado pendiente
     se puede perder sin que nadie se de cuenta. Esta version espera la
     confirmacion real de la nube antes de continuar. */
  async function saveStateImmediate(){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (!CLOUD_ENABLED || !isAuthenticated) return true;
    clearTimeout(_cloudSaveTimer);
    return await cloudSave();
  }

  /* NUBE ────────────────────────────────────────────────────────────────────
     A partir de la migración, la app ya NO guarda un JSON gigante en una sola
     fila. Cada entidad (alumno, pago, asistencia, evento...) vive en su propia
     tabla y se sincroniza con UPSERT: esto INSERTA o ACTUALIZA filas, pero
     JAMAS borra una fila que no venga en el paquete. Por eso ya no es posible
     que un dispositivo con datos desactualizados borre el trabajo de otro:
     en el peor caso pisa una fila puntual, nunca el negocio completo.       */
  function updateSyncDot() {
    const dot = document.querySelector("#syncDot");
    if (!dot) return;
    const cfg = { disabled:{cls:"sync-off",tip:"Sin nube configurada"}, connecting:{cls:"sync-wait",tip:"Conectando..."}, syncing:{cls:"sync-wait",tip:"Guardando en la nube..."}, ok:{cls:"sync-ok",tip:"Datos en la nube OK"}, error:{cls:"sync-err",tip:"Sin conexion - datos en local"} };
    const c = cfg[cloudStatus] || cfg.disabled;
    dot.title = c.tip; dot.className = `sync-dot ${c.cls}`;
  }
  async function getAuthHeader(){
    if(_supa){
      const { data:{ session } } = await _supa.auth.getSession().catch(()=>({ data:{ session:null } }));
      if(session?.access_token) return "Bearer "+session.access_token;
    }
    return "Bearer "+SUPABASE_ANON_KEY;
  }
  /* Helper generico: upsert de un arreglo de filas contra una tabla.
     No hace nada si el arreglo esta vacio (evita llamadas innecesarias). */
  async function upsertRows(table, rows, conflictCols){
    if (!rows || !rows.length) return true;
    const authH = await getAuthHeader();
    const url = SUPABASE_URL+"/rest/v1/"+table+"?on_conflict="+encodeURIComponent(conflictCols);
    const res = await fetch(url, { method:"POST", headers:{ "Content-Type":"application/json", "apikey":SUPABASE_ANON_KEY, "Authorization":authH, "Prefer":"resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(rows) });
    if (!res.ok){ console.error("upsertRows",table,res.status, await res.text().catch(()=>"")); return false; }
    return true;
  }
  /* Si la base todavia no tiene las columnas nuevas (falta correr el SQL), se
     guarda con las columnas de siempre para que NUNCA se rompa el guardado. */
  async function upsertWithFallback(table, fullRows, baseRows, conflictCols){
    if (await upsertRows(table, fullRows, conflictCols)) return true;
    return await upsertRows(table, baseRows, conflictCols);
  }
  /* Helper generico: DELETE puntual de una fila. Se usa en las acciones
     explicitas de borrado (eliminar alumno, quitar pago, anular clase...). */
  async function deleteRow(table, column, value){
    if (!CLOUD_ENABLED || !isAuthenticated) return true;
    try {
      const authH = await getAuthHeader();
      const url = SUPABASE_URL+"/rest/v1/"+table+"?"+encodeURIComponent(column)+"=eq."+encodeURIComponent(value);
      const res = await fetch(url, { method:"DELETE", headers:{ "apikey":SUPABASE_ANON_KEY, "Authorization":authH } });
      if (!res.ok) console.error("deleteRow",table,res.status);
      return res.ok;
    } catch(e){ console.error("deleteRow:",e); return false; }
  }

  /* Mapea el `state` en memoria (mismo formato de siempre) a filas por tabla */
  function studentToRow(s){
    return { id:s.id, code:s.code||"", name:s.name||"", email:s.email||"", phone:s.phone||"",
      documento:s.documento||"", status:s.status||"active", category:s.category||"", nivel:s.nivel||"",
      birthdate:s.birthdate||"", plan_type:s.planType||"4", custom_classes:s.customClasses||"",
      bonus_classes:Number(s.bonusClasses||0), classes_used:Number(s.classesUsed||0), month_key:s.monthKey||"",
      responsible:s.responsible||"", phone_acudiente:s.phoneAcudiente||"", notes:s.notes||"", eps:s.eps||"",
      talla:s.talla||"", peso:s.peso||"", sangre:s.sangre||"", camiseta:s.camiseta||"", waiver:s.waiver||null,
      last_renewed_at:s.lastRenewedAt||null, plan_started_at:s.planStartedAt||null,
      created_at:s.createdAt||new Date().toISOString(), updated_at:s.updatedAt||new Date().toISOString() };
  }
  function rowToAttendee(r){
    return { id:r.id, studentId:r.student_id||null, guestName:r.guest_name||undefined, guestAge:r.guest_age||undefined, guestPhone:r.guest_phone||undefined, paid:Boolean(r.paid), signed:Boolean(r.signed), signature:r.signature||null, datos:r.datos||undefined, addedAt:r.added_at, updatedAt:r.updated_at||r.added_at };
  }
  function rowToStudent(r){
    return { id:r.id, code:r.code||"", name:r.name||"", email:r.email||"", phone:r.phone||"",
      documento:r.documento||"", status:r.status||"active", category:r.category||"", nivel:r.nivel||"",
      birthdate:r.birthdate||"", planType:r.plan_type||"4", customClasses:r.custom_classes||"",
      bonusClasses:Number(r.bonus_classes||0), classesUsed:Number(r.classes_used||0), monthKey:r.month_key||"",
      responsible:r.responsible||"", phoneAcudiente:r.phone_acudiente||"", notes:r.notes||"", eps:r.eps||"",
      talla:r.talla||"", peso:r.peso||"", sangre:r.sangre||"", camiseta:r.camiseta||"", waiver:r.waiver||undefined,
      lastRenewedAt:r.last_renewed_at||undefined, planStartedAt:r.plan_started_at||undefined,
      createdAt:r.created_at, updatedAt:r.updated_at, payments:[] };
  }

  /* Antes de subir cambios, se trae lo mas reciente de la nube para alumnos
     e inscritos de eventos (las unicas tablas que se editan campo por campo
     despues de creadas) y se conserva el que tenga el "updatedAt" mas nuevo,
     registro por registro. Esto evita que un dispositivo con datos viejos
     (ej. una pestana abierta hace rato en otro celular/computador) pise sin
     querer cambios mas recientes hechos desde otro dispositivo — como clases
     bonus sumadas ahi mismo — al guardar cualquier cosa, aunque sea de un
     alumno totalmente distinto. */
  /* Refresca UN alumno puntual desde la nube antes de tocarlo (registrar
     clase, abrir el modal de renovar). Es la protección más importante:
     evita que un dispositivo que no sabía de un cambio reciente en ESE
     alumno (ej. clases bonus sumadas hace un momento desde otro celular)
     lo pise al guardar su propia edición sobre ese mismo alumno. */
  async function refreshStudentFromCloud(studentId){
    if(!CLOUD_ENABLED || !isAuthenticated) return getStudent(studentId);
    try{
      const authH = await getAuthHeader();
      const res = await fetch(SUPABASE_URL+"/rest/v1/students?id=eq."+encodeURIComponent(studentId)+"&select=*", { cache:"no-store", headers:{ "apikey":SUPABASE_ANON_KEY, "Authorization":authH } });
      if(!res.ok) return getStudent(studentId);
      const rows = await res.json();
      const fresh = rows[0];
      const idx = state.students.findIndex(s=>s.id===studentId);
      const local = idx>=0?state.students[idx]:null;
      if(!fresh) return local;
      const freshTime = new Date(fresh.updated_at||0).getTime();
      const localTime = local?new Date(local.updatedAt||0).getTime():0;
      if(!local || freshTime >= localTime){
        const freshStudent = rowToStudent(fresh);
        freshStudent.payments = local?.payments||[];
        if(idx>=0) state.students[idx]=freshStudent; else state.students.push(freshStudent);
        return freshStudent;
      }
      return local;
    } catch(e){ console.error("refreshStudentFromCloud:",e); return getStudent(studentId); }
  }
  async function mergeFreshStudents(){
    try{
      const authH = await getAuthHeader();
      const res = await fetch(SUPABASE_URL+"/rest/v1/students?select=*", { cache:"no-store", headers:{ "apikey":SUPABASE_ANON_KEY, "Authorization":authH } });
      if(!res.ok) return;
      const freshRows = await res.json();
      const freshById = {}; freshRows.forEach(r=>{ freshById[r.id]=r; });
      const seen = new Set();
      const merged = state.students.map(local=>{
        seen.add(local.id);
        const fresh = freshById[local.id];
        if(fresh){
          const freshTime = new Date(fresh.updated_at||0).getTime();
          const localTime = new Date(local.updatedAt||0).getTime();
          if(freshTime > localTime){
            const freshStudent = rowToStudent(fresh);
            freshStudent.payments = local.payments||[]; // los pagos se sincronizan aparte
            return freshStudent;
          }
        }
        return local;
      });
      // Alumnos que ya existen en la nube pero esta pestana todavia no conocia
      freshRows.forEach(fresh=>{ if(!seen.has(fresh.id)) merged.push(rowToStudent(fresh)); });
      state.students = merged;
    } catch(e){ console.error("mergeFreshStudents:",e); }
  }
  async function mergeFreshAttendees(){
    try{
      const authH = await getAuthHeader();
      const res = await fetch(SUPABASE_URL+"/rest/v1/event_attendees?select=*", { cache:"no-store", headers:{ "apikey":SUPABASE_ANON_KEY, "Authorization":authH } });
      if(!res.ok) return;
      const freshRows = await res.json();
      const freshById = {}; freshRows.forEach(r=>{ freshById[r.id]=r; });
      state.events.forEach(ev=>{
        ev.attendees = ev.attendees||[];
        const seen = new Set();
        ev.attendees = ev.attendees.map(local=>{
          seen.add(local.id);
          const fresh = freshById[local.id];
          if(fresh){
            const freshTime = new Date(fresh.updated_at||fresh.added_at||0).getTime();
            const localTime = new Date(local.updatedAt||local.addedAt||0).getTime();
            if(freshTime > localTime){
              return rowToAttendee(fresh);
            }
          }
          return local;
        });
        freshRows.filter(f=>f.event_id===ev.id && !seen.has(f.id)).forEach(f=>{
          ev.attendees.push(rowToAttendee(f));
        });
      });
    } catch(e){ console.error("mergeFreshAttendees:",e); }
  }
  async function cloudSave() {
    if (!CLOUD_ENABLED || !isAuthenticated) return true;
    if (_syncInFlight) await _syncInFlight; // Nunca guardar mientras hay un sync desde la nube en curso
    cloudStatus = "syncing"; updateSyncDot();
    let exito = false;
    try {
      await Promise.all([ mergeFreshStudents(), mergeFreshAttendees() ]);

      const studentRows = state.students.map(studentToRow);
      const paymentRows = state.students.flatMap(s => (s.payments||[]).map(p => ({
        id:p.id, student_id:s.id, fecha:p.fecha||"", hora:p.hora||"", valor:Number(p.valor||0),
        metodo:p.metodo||"", concepto:p.concepto||"", registrado_en:p.registradoEn||new Date().toISOString() })));
      const attendanceRows = state.attendance.map(a => ({
        id:a.id, student_id:a.studentId, at:a.at, month_key:a.monthKey||"", source:a.source||"manual", extra:Boolean(a.extra) }));
      const eventRowsBase = state.events.map(e => ({
        id:e.id, name:e.name, date:e.date||"", place:e.place||"",
        created_at:e.createdAt||new Date().toISOString(), updated_at:e.updatedAt||new Date().toISOString() }));
      const eventRows = eventRowsBase.map((r,i) => { const e = state.events[i]; return { ...r,
        horario:e.horario||"", tipo:e.tipo||"", competitivo:e.competitivo||"", valor:e.valor||"", incluye:e.incluye||"", organizador:e.organizador||"" }; });
      const attendeeRows = state.events.flatMap(e => (e.attendees||[]).map(a => ({
        id:a.id, event_id:e.id, student_id:a.studentId||null,
        guest_name:a.guestName||null, guest_age:a.guestAge||null, guest_phone:a.guestPhone||null,
        paid:Boolean(a.paid), signed:Boolean(a.signed),
        signature:a.signature||null, datos:a.datos||null, added_at:a.addedAt||new Date().toISOString(),
        updated_at:a.updatedAt||a.addedAt||new Date().toISOString() })));
      const attendeeRowsBase = attendeeRows.map(({datos, ...resto}) => resto);
      const internalEventRows = (state.internalEvents||[]).map(ie => ({
        id:ie.id, name:ie.name, date:ie.date||"", start_time:ie.start||"", end_time:ie.end||"",
        descripcion:ie.desc||"", created_at:ie.createdAt||new Date().toISOString() }));

      const ok = (await Promise.all([
        upsertRows("students", studentRows, "id"),
        upsertRows("payments", paymentRows, "id"),
        upsertRows("attendance", attendanceRows, "id"),
        upsertWithFallback("events", eventRows, eventRowsBase, "id"),
        upsertWithFallback("event_attendees", attendeeRows, attendeeRowsBase, "id"),
        upsertRows("internal_events", internalEventRows, "id"),
        upsertRows("app_settings", [{ id:"main", business_name:state.settings?.businessName||DEFAULT_BUSINESS, current_month:state.currentMonth, updated_at:new Date().toISOString() }], "id"),
      ])).every(Boolean);
      if (!ok) throw new Error("upsert_failed");
      cloudStatus = "ok"; exito = true;
    } catch(err){ console.error("cloudSave:",err); cloudStatus = "error"; exito = false; }
    updateSyncDot();
    return exito;
  }
  let _cloudSaveTimer = null;
  function debouncedCloudSave(){ clearTimeout(_cloudSaveTimer); _cloudSaveTimer = setTimeout(cloudSave, 800); }

  async function cloudLoad() {
    if (!CLOUD_ENABLED || !isAuthenticated) return null;
    try {
      const authH = await getAuthHeader();
      const headers = { "apikey":SUPABASE_ANON_KEY, "Authorization":authH };
      const [studentsRes, paymentsRes, attendanceRes, eventsRes, attendeesRes, internalRes, settingsRes] = await Promise.all([
        fetch(SUPABASE_URL+"/rest/v1/students?select=*", { cache:"no-store", headers }),
        fetch(SUPABASE_URL+"/rest/v1/payments?select=*", { cache:"no-store", headers }),
        fetch(SUPABASE_URL+"/rest/v1/attendance?select=*", { cache:"no-store", headers }),
        fetch(SUPABASE_URL+"/rest/v1/events?select=*", { cache:"no-store", headers }),
        fetch(SUPABASE_URL+"/rest/v1/event_attendees?select=*", { cache:"no-store", headers }),
        fetch(SUPABASE_URL+"/rest/v1/internal_events?select=*", { cache:"no-store", headers }),
        fetch(SUPABASE_URL+"/rest/v1/app_settings?id=eq.main&select=*", { cache:"no-store", headers }),
      ]);
      if (![studentsRes,paymentsRes,attendanceRes,eventsRes,attendeesRes,internalRes,settingsRes].every(r=>r.ok)) {
        console.warn("cloudLoad: alguna tabla respondio con error");
        return null;
      }
      const [studentRows, paymentRows, attendanceRows, eventRows, attendeeRows, internalRows, settingsRows] = await Promise.all([
        studentsRes.json(), paymentsRes.json(), attendanceRes.json(), eventsRes.json(), attendeesRes.json(), internalRes.json(), settingsRes.json()
      ]);

      const students = studentRows.map(rowToStudent);
      const byId = Object.fromEntries(students.map(s => [s.id, s]));
      paymentRows.forEach(p => { const s = byId[p.student_id]; if (s) s.payments.push({ id:p.id, fecha:p.fecha, hora:p.hora, valor:Number(p.valor||0), metodo:p.metodo, concepto:p.concepto, registradoEn:p.registrado_en }); });

      const attendance = attendanceRows.map(a => ({ id:a.id, studentId:a.student_id, at:a.at, monthKey:a.month_key, source:a.source, extra:Boolean(a.extra) }));

      const events = eventRows.map(e => ({ id:e.id, name:e.name, date:e.date, place:e.place, horario:e.horario||"", tipo:e.tipo||"", competitivo:e.competitivo||"", valor:e.valor||"", incluye:e.incluye||"", organizador:e.organizador||"", createdAt:e.created_at, updatedAt:e.updated_at, attendees:[] }));
      const eventById = Object.fromEntries(events.map(e => [e.id, e]));
      attendeeRows.forEach(a => { const e = eventById[a.event_id]; if (e) e.attendees.push(rowToAttendee(a)); });

      const internalEvents = internalRows.map(ie => ({ id:ie.id, name:ie.name, date:ie.date, start:ie.start_time, end:ie.end_time, desc:ie.descripcion, createdAt:ie.created_at }));

      const settingsRow = settingsRows[0];
      const businessName = settingsRow?.business_name || DEFAULT_BUSINESS;
      const currentMonth  = settingsRow?.current_month || monthKey(new Date());

      return { version:1, currentMonth, settings:{ businessName }, students, attendance, events, internalEvents };
    } catch(e){ console.error("cloudLoad:",e); return null; }
  }
  let _syncInFlight = null; // Promise activa de syncFromCloud, evita carreras con saveState()
  async function syncFromCloud() {
    if (_syncInFlight) return _syncInFlight; // Si ya hay un sync corriendo, reusar esa promesa
    _syncInFlight = (async () => {
      const cloudData = await cloudLoad();
      if (cloudData && Array.isArray(cloudData.students)) {
        state = cloudData;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        cloudStatus = "ok";
        if (!studentsFormVisible && !editingStudentId && !loginModalVisible && !isTypingInApp()) render();
      } else if (CLOUD_ENABLED) { cloudStatus = "ok"; }
      updateSyncDot();
    })();
    try { await _syncInFlight; } finally { _syncInFlight = null; }
  }

  /* UTILIDADES */
  function monthKey(date){ return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}`; }
  function localDateStr(iso){ if(!iso) return ""; const d=new Date(iso); if(isNaN(d.getTime())) return ""; return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); }
  function dayKey(date)  { return date.toISOString().slice(0,10); }
  function monthLabel(key){ const [y,m]=key.split("-").map(Number); return new Intl.DateTimeFormat("es-CO",{month:"long",year:"numeric"}).format(new Date(y,m-1,1)); }
  /* Dias de vigencia de cada plan desde la primera clase tomada (fecha real, no mes calendario) */
  /* Vigencia: TODOS los planes duran 30 dias desde la primera clase (el plan
     anual dura 1 año). Pedido del cliente el 24-nov-2026. Los planes que ya
     habian empezado antes de esa fecha conservan los 35 dias con los que se
     vendieron (DIAS_PLAN_VIGENCIA_ANTES), para no vencerle a nadie de golpe. */
  const DIAS_PLAN_VIGENCIA = {
    "1_practica":30, "1_grupal":30, "1_matronat":30, "8_practicas":30, "5_vacacional":30,
    "4":30, "9":30, "13":30, "13_equipo":30,
    "matronat_4":30, "matronat_8":30, "matronat_personalizada_4":30,
    "personalizado_4":30, "personalizado_8":30,
    "anual":365, "anual_4":365, "anual_9":365, "anual_13":365,
    "obsequio_1":30, "obsequio_2":30, "obsequio_3":30,
    "custom":30
  };
  const VIGENCIA_30_DESDE = new Date(2026,10,24); // 24 de noviembre de 2026 (hora local)
  const DIAS_PLAN_VIGENCIA_ANTES = { "4":35, "9":35, "13":35, "13_equipo":35, "matronat_4":35, "matronat_8":35, "matronat_personalizada_4":35, "personalizado_4":35, "personalizado_8":35, "custom":35 };
  function textoVigencia(planType){ const d=diasVigenciaPlan(planType); return d>=365?"1 año":d+" días"; }
  /* El plan SIEMPRE empieza a contar desde la primera clase que el alumno toma,
     no desde que se registra, paga o se renueva. Versiones anteriores de la app
     guardaban como "inicio" el momento de la renovacion; esas fechas se
     reconocen (coinciden con lastRenewedAt) y se reemplazan por la primera
     clase tomada despues de renovar. */
  function inicioEsDeRenovacion(student){
    if(!student||!student.planStartedAt||!student.lastRenewedAt) return false;
    const a=new Date(student.planStartedAt).getTime(), b=new Date(student.lastRenewedAt).getTime();
    return !isNaN(a)&&!isNaN(b)&&Math.abs(a-b)<120000;
  }
  function inicioPlan(student){
    if(!student) return null;
    if(student.planStartedAt&&!inicioEsDeRenovacion(student)){ const d=new Date(student.planStartedAt); return isNaN(d.getTime())?null:d; }
    const desde=student.lastRenewedAt?new Date(student.lastRenewedAt).getTime()-60000:null;
    const asistencias=state.attendance.filter(a=>a.studentId===student.id&&(desde===null||new Date(a.at).getTime()>=desde)).sort((a,b)=>new Date(a.at)-new Date(b.at));
    return asistencias.length?new Date(asistencias[0].at):null;
  }
  function calcularVencimiento(student){
    // El plan vence por fecha (inicio + dias del plan), nunca por mes calendario
    const primeraClase=inicioPlan(student);
    if(!primeraClase||isNaN(primeraClase.getTime())) return null;
    let dias=DIAS_PLAN_VIGENCIA[student.planType]||30;
    if(primeraClase<VIGENCIA_30_DESDE&&DIAS_PLAN_VIGENCIA_ANTES[student.planType]) dias=DIAS_PLAN_VIGENCIA_ANTES[student.planType];
    const vence=new Date(primeraClase);
    vence.setDate(vence.getDate()+dias);
    return vence;
  }
  function planVencido(student){
    const v=calcularVencimiento(student);
    if(!v) return false;
    return new Date()>v;
  }
  function calcularEdad(birthdate){
    if(!birthdate) return null;
    const hoy=new Date(), nac=new Date(birthdate);
    if(isNaN(nac.getTime())) return null;
    let edad=hoy.getFullYear()-nac.getFullYear();
    const m=hoy.getMonth()-nac.getMonth();
    if(m<0||(m===0&&hoy.getDate()<nac.getDate())) edad--;
    return edad>=0?edad:null;
  }
  function formatDateTime(iso){ return new Intl.DateTimeFormat("es-CO",{dateStyle:"medium",timeStyle:"short"}).format(new Date(iso)); }
  function escapeHtml(v){return String(v??"").replace(/[&<>"']/g,function(c){switch(c){case "&":return"&amp;";case "<":return"&lt;";case ">":return"&gt;";case '"':return"&quot;";default:return"&#039;";}});}
  function uid(prefix="id"){ return window.crypto?.randomUUID ? `${prefix}_${crypto.randomUUID()}` : `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`; }
  function nextStudentCode(){ const max=state.students.reduce((h,s)=>{ const m=String(s.code||"").match(/(\d+)$/); return Math.max(h,m?Number(m[1]):0); },0); return `AC-${String(max+1).padStart(4,"0")}`; }
  /* Version robusta: antes de asignar el codigo, consulta los codigos MAS
     RECIENTES directamente en la nube (no solo lo que hay en memoria de este
     dispositivo). Esto evita que dos registros casi simultaneos desde sitios
     distintos (ej. el formulario publico y la app al mismo tiempo) calculen
     el mismo "siguiente numero" y terminen con el mismo codigo en dos
     alumnos diferentes. */
  async function nextStudentCodeFresh(){
    let codes = state.students.map(s=>s.code);
    if(CLOUD_ENABLED && isAuthenticated){
      try{
        const authH = await getAuthHeader();
        const res = await fetch(SUPABASE_URL+"/rest/v1/students?select=code", { cache:"no-store", headers:{ "apikey":SUPABASE_ANON_KEY, "Authorization":authH } });
        if(res.ok){ const rows = await res.json(); codes = codes.concat(rows.map(r=>r.code)); }
      } catch(e){ console.error("nextStudentCodeFresh:",e); }
    }
    const codeSet = new Set(codes.filter(Boolean).map(c=>String(c).toUpperCase()));
    let max = 0;
    codes.forEach(c=>{ const m=String(c||"").match(/(\d+)$/); if(m) max=Math.max(max,Number(m[1])); });
    let candidate = `AC-${String(max+1).padStart(4,"0")}`;
    while(codeSet.has(candidate.toUpperCase())){ max++; candidate = `AC-${String(max+1).padStart(4,"0")}`; }
    return candidate;
  }

  /* LOGICA DE NEGOCIO */
  function planTotal(student){ if(!student)return 0; const base=student.planType==="custom"?Math.max(0,Number(student.customClasses||0)):Math.max(0,Number(PLAN_CLASSES[student.planType]||0)); return Math.max(0, base+Number(student.bonusClasses||0)); }
  function planBaseClasses(student){ if(!student)return 0; return student.planType==="custom"?Math.max(0,Number(student.customClasses||0)):Math.max(0,Number(PLAN_CLASSES[student.planType]||0)); }
  function remainingClasses(student){ return planTotal(student)-Number(student.classesUsed||0); }
  function isRenewed(student){
    if(esPlanAnual(student)){ const v=calcularVencimiento(student); return !v || v.getTime()>=Date.now(); }
    return student.monthKey===state.currentMonth;
  }
  function studentStatusBadge(student){
    if(student.status!=="active") return '<span class="badge danger">Pausado</span>';
    if(planVencido(student)) return '<span class="badge danger">Plan vencido</span>';
    const r=remainingClasses(student);
    if(r<=0) return '<span class="badge danger">Sin clases</span>';
    if(r<=2) return '<span class="badge warn">Pocas clases</span>';
    if(!isRenewed(student)) return '<span class="badge warn">Renovar</span>';
    return '<span class="badge ok">Activo</span>';
  }
  function planBadge(student){ const total=planTotal(student); const label=student.planType==="custom"?`${total} clases`:PLAN_LABELS[student.planType]; return `<span class="badge info">${escapeHtml(label||"Sin plan")}</span>`; }
  function getStudent(id){ return state.students.find(s=>s.id===id); }
  function filteredStudents({search="",plan="all",status="all"}={}){
    const q=search.trim().toLowerCase();
    return state.students.filter(s=>{
      if(plan!=="all"&&s.planType!==plan)return false;
      if(status!=="all"&&s.status!==status)return false;
      if(!q)return true;
      return [s.name,s.code,s.phone,s.email,s.responsible,s.category].join(" ").toLowerCase().includes(q);
    }).sort((a,b)=>a.name.localeCompare(b.name,"es"));
  }
  function getAlertStudents(){
    // Alumnos con plan que vence en los proximos 7 dias o ya vencio, y aun tienen clases sin usar
    const hoy = new Date();
    return state.students
      .filter(s => s.status === "active")
      .map(s => {
        const v = calcularVencimiento(s);
        if(!v) return null;
        const diff = Math.ceil((v - hoy) / (1000*60*60*24));
        const r = remainingClasses(s);
        return { student: s, vence: v, diasRestantes: diff, clasesRestantes: r };
      })
      .filter(x => x && x.diasRestantes <= 7 && x.clasesRestantes > 0)
      .sort((a,b) => a.diasRestantes - b.diasRestantes);
  }
  function monthAttendance(month=state.currentMonth){ return state.attendance.filter(e=>e.monthKey===month); }
  function todayAttendance(){ const today=dayKey(new Date()); return state.attendance.filter(e=>dayKey(new Date(e.at))===today); }
  function stats(){
    const active=state.students.filter(s=>s.status==="active");
    const renewed=active.filter(s=>isRenewed(s));
    const totalClasses=renewed.reduce((sum,s)=>sum+planTotal(s),0);
    const usedClasses=renewed.reduce((sum,s)=>sum+Number(s.classesUsed||0),0);
    return { active:active.length, renewed:renewed.length, pendingRenewal:active.length-renewed.length, totalClasses, usedClasses, remaining:totalClasses-usedClasses, today:todayAttendance().length, monthAttendance:monthAttendance().length, events:state.events.length };
  }

  /* AUTENTICACION con Supabase Auth */
  /* Contraseña local de respaldo para uso offline/local */
  const LOCAL_PASS = "AcquaNatacion!";

  async function login(email, pass){
    // Si Supabase no está disponible (local/offline), usar verificación local
    if(!_supa){
      if(pass === LOCAL_PASS){
        isAuthenticated=true; loginModalVisible=false;
        const lm=document.getElementById("loginModal"); if(lm) lm.remove();
        if(activeView==="checkin") activeView="dashboard";
        render(); setToast("Modo local — datos no sincronizados con la nube.");
      } else {
        setToast("Contrasena incorrecta.");
        const form=document.getElementById("loginForm");
        if(form){ form.style.animation="none"; requestAnimationFrame(()=>{ form.style.animation="shake .35s ease"; }); }
      }
      return;
    }
    const btnLogin=document.getElementById("btnLogin");
    const btnLoginHtml=btnLogin?btnLogin.innerHTML:""; if(btnLogin){ btnLogin.disabled=true; btnLogin.textContent="Verificando..."; }
    try {
      const { data, error } = await _supa.auth.signInWithPassword({ email, password: pass });
      if(error){
        setToast("Contrasena incorrecta. Intentalo de nuevo.");
        const form=document.getElementById("loginForm");
        if(form){ form.style.animation="none"; requestAnimationFrame(()=>{ form.style.animation="shake .35s ease"; }); }
        if(btnLogin){ btnLogin.disabled=false; btnLogin.innerHTML=btnLoginHtml; }
        return;
      }
      isAuthenticated=true; loginModalVisible=false;
      const lm=document.getElementById("loginModal"); if(lm) lm.remove();
      if(activeView==="checkin") activeView="dashboard";
      render(); setToast("Bienvenido al panel de administracion");
      await syncFromCloud();   // ← esperar SIEMPRE la nube antes de tocar el estado local
      autoCheckMonth();
    } catch(e){
      console.error("login:",e);
      setToast("Error de conexion. Verifica tu internet.");
      if(btnLogin){ btnLogin.disabled=false; btnLogin.innerHTML=btnLoginHtml; }
    }
  }
  async function logout(){
    if(_supa) await _supa.auth.signOut().catch(()=>{});
    isAuthenticated=false; loginModalVisible=true; settingsUnlocked=false; activeView="checkin"; render(); setToast("Sesion cerrada.");
  }

  /* TOAST */
  function setToast(msg){ toast.textContent=msg; toast.classList.add("is-visible"); window.clearTimeout(setToast.timer); setToast.timer=window.setTimeout(()=>toast.classList.remove("is-visible"),3200); }

  /* PESTANAS */
  function setActiveTab(){
    document.querySelectorAll(".tab").forEach(tab=>{
      tab.classList.toggle("is-active",tab.dataset.view===activeView);
      if(tab.dataset.admin) tab.hidden=!isAuthenticated;
    });
    const logoutBtn=document.querySelector("#logoutBtn");
    const moPicker=document.querySelector("#monthPickerWrap");
    if(logoutBtn) logoutBtn.hidden=!isAuthenticated;
    if(moPicker) moPicker.hidden=!isAuthenticated;
  }

  /* RENDER PRINCIPAL */
  function render(){
    const scannerEstabaActivo=!!(scanner.stream);  // guardar ANTES de destruir DOM
    if(!isAuthenticated){ loginModalVisible=true; }
    setActiveTab();
    updateNavCounts();
    globalMonth.value=state.currentMonth;
    businessNameLabel.textContent=isAuthenticated?"Control de clases, QR y eventos":"Registro de asistencia";
    if(activeView!=="checkin") stopScanner(false);
    const renderers={ dashboard:renderDashboard, students:renderStudents, checkin:renderCheckin, cards:renderCards, events:renderEvents, reports:renderReports, settings:renderSettings, register:renderRegister, expiring:renderExpiring };
    // Guardar la vista anterior para saber si el render es del mismo formulario
    const mismaVista = (_renderPrevView === activeView);
    _renderPrevView = activeView;

    // Capturar TODOS los valores de TODOS los formularios visibles
    const inputVals = {};
    if(mismaVista){
      document.querySelectorAll('input,select,textarea').forEach(el=>{
        if(!el.name || el.type==="hidden") return;
        const key = (el.closest('form')?.id||"_")+":"+el.name;
        inputVals[key] = { value: el.value, checked: el.checked, type: el.type };
      });
    }

    let html=(renderers[activeView]||renderCheckin)()+renderOverlay();
    if(renewModalStudentId) html+=renderRenewalModal();
    if(payModalStudentId) { const pmDiv=document.getElementById('payModal'); if(!pmDiv){ const d=document.createElement('div'); d.innerHTML=renderPayModal(payModalStudentId); document.body.appendChild(d.firstElementChild); } }
    try {
      app.innerHTML=html||"";
    } catch(e) {
      console.error("app.innerHTML error:", e);
      app.innerHTML='<div style="padding:2rem;text-align:center;color:red"><p>Error al renderizar: '+e.message+'</p></div>';
    }

    // Restaurar valores solo si seguimos en la misma vista
    if(mismaVista && Object.keys(inputVals).length){
      document.querySelectorAll('input,select,textarea').forEach(el=>{
        if(!el.name || el.type==="hidden") return;
        const key = (el.closest('form')?.id||"_")+":"+el.name;
        const saved = inputVals[key];
        if(!saved) return;
        if(el.type==="checkbox" || el.type==="radio") el.checked = saved.checked;
        else if(el.value !== saved.value) el.value = saved.value;
      });
    }

    // Editores visuales (documento de exoneracion y "que incluye")
    try{ initDocEditor(); initInclEditor(app); }catch(e){ console.error("editores:",e); }

    // Modal de login: inyectar en body directamente para que cubra todo
    const existingLoginModal=document.getElementById("loginModal");
    if(loginModalVisible && !existingLoginModal){
      const div=document.createElement("div");
      div.innerHTML=renderLoginModal();
      document.body.appendChild(div.firstElementChild);
      window.requestAnimationFrame(()=>document.querySelector("#loginForm [name='password']")?.focus());
    } else if(!loginModalVisible && existingLoginModal){
      existingLoginModal.remove();
    }

    // Si el scanner estaba activo y seguimos en checkin, reiniciarlo
    // (render() destruye el DOM incluyendo el video element)
    if(scannerEstabaActivo && activeView==="checkin"){
      setTimeout(()=>startScanner(),120);
    }
  }
  function renderOverlay(){ if(attendeeDataDraft) return renderAttendeeDataModal(attendeeDataDraft); if(!signatureDraft)return ""; return renderSignatureModal(signatureDraft); }
  function renderHeader(title,subtitle,actions=""){ return `<div class="view-header"><div><h2>${escapeHtml(title)}</h2><p>${escapeHtml(subtitle)}</p></div>${actions?`<div class="toolbar">${actions}</div>`:""}</div>`; }

  /* DASHBOARD */
  /* ── VENCIMIENTOS ─────────────────────────────────────────────────────── */
  const EXP_GROUPS=[
    {key:"vencido",  label:"Vencidos",   title:"Vencidos con clases sin usar", tone:"danger", icon:"alert"},
    {key:"hoy",      label:"Vencen hoy", title:"Vencen hoy",                   tone:"danger", icon:"clock"},
    {key:"pronto",   label:"1 a 3 dias", title:"Proximos 3 dias",              tone:"warn",   icon:"clock"},
    {key:"semana",   label:"4 a 7 dias", title:"Esta semana (4 a 7 dias)",     tone:"info",   icon:"calendar"},
    {key:"sinclases",label:"Sin clases", title:"Sin clases disponibles",       tone:"muted",  icon:"x"},
  ];
  function expiringData(){
    const hoy=new Date(), DAY=1000*60*60*24;
    const items=[];
    state.students.filter(s=>s.status==="active").forEach(s=>{
      const v=calcularVencimiento(s); const r=remainingClasses(s);
      const dias=v?Math.ceil((v-hoy)/DAY):null;
      let group=null;
      if(dias!==null&&dias<=7&&r>0) group=dias<0?"vencido":dias===0?"hoy":dias<=3?"pronto":"semana";
      else if(r<=0) group="sinclases";
      if(group) items.push({student:s,vence:v,dias,restantes:r,group});
    });
    items.sort((a,b)=>(a.dias??9999)-(b.dias??9999)||a.student.name.localeCompare(b.student.name,"es"));
    const counts={}; EXP_GROUPS.forEach(g=>counts[g.key]=items.filter(i=>i.group===g.key).length);
    const urgent=items.filter(i=>i.group!=="sinclases").length;
    return {items,counts,urgent};
  }
  function updateNavCounts(){
    const n=isAuthenticated?expiringData().urgent:0;
    document.querySelectorAll('[data-count="expiring"]').forEach(el=>{ el.textContent=n>99?"99+":String(n); el.hidden=!n; });
  }
  function expCountdown(it){
    if(it.group==="sinclases") return `<div class="exp-count tone-muted"><b>0</b><small>clases</small></div>`;
    if(it.dias<0) return `<div class="exp-count tone-danger"><b>${Math.abs(it.dias)}</b><small>${Math.abs(it.dias)===1?"dia vencido":"dias vencido"}</small></div>`;
    if(it.dias===0) return `<div class="exp-count tone-danger is-today"><b>HOY</b><small>vence</small></div>`;
    const g=EXP_GROUPS.find(x=>x.key===it.group);
    return `<div class="exp-count tone-${g.tone}"><b>${it.dias}</b><small>${it.dias===1?"dia":"dias"}</small></div>`;
  }
  function expCard(it){
    const s=it.student, id=escapeHtml(s.id);
    const total=planTotal(s), used=Number(s.classesUsed||0);
    const pct=total?Math.min(100,Math.max(0,(Math.max(0,it.restantes)/total)*100)):0;
    const ini=inicioPlan(s); const inicio=ini?shortDate(ini):"Con la 1ra clase";
    const vence=it.vence?shortDate(it.vence):"Sin fecha";
    const aviso=it.group==="sinclases"
      ? `<button class="btn wa" type="button" data-action="notify-student" data-id="${id}">${icon("message")}Avisar</button>`
      : `<button class="btn wa" type="button" data-action="notify-vencimiento" data-id="${id}">${icon("message")}Avisar</button>`;
    return `<article class="exp-card g-${it.group}">
      <div class="exp-head">${avatar(s.name)}<div class="exp-who"><strong>${escapeHtml(s.name)}</strong><small>${escapeHtml(s.code)} · ${escapeHtml(PLAN_LABELS[s.planType]||planTotal(s)+" clases")}</small></div>${expCountdown(it)}</div>
      <div class="exp-body">
        <div class="exp-row"><span>${it.group==="sinclases"?"Clases":"Sin usar"}</span><strong class="num">${Math.max(0,it.restantes)} <em>de ${total}</em></strong></div>
        <div class="progress ${it.restantes<=0?"is-out":it.restantes<=2?"is-low":""}"><span style="width:${it.group==="sinclases"?100:pct}%"></span></div>
        <div class="exp-dates"><span>${icon("play")}Inicio ${inicio}</span><span>${icon("flag")}Vence ${vence}</span></div>
      </div>
      <div class="exp-actions">${aviso}<button class="btn accent" type="button" data-action="renew-student" data-id="${id}">${icon("refresh")}Renovar</button><button class="btn icon ghost" type="button" title="Ver ficha" aria-label="Ver ficha de ${escapeHtml(s.name)}" data-action="go-to-student" data-id="${id}">${icon("user")}</button></div>
    </article>`;
  }
  function renderExpiring(){
    const {items,counts,urgent}=expiringData();
    const q=expiringSearch.trim().toLowerCase();
    const match=it=>!q||[it.student.name,it.student.code,it.student.phone].join(" ").toLowerCase().includes(q);
    const tiles=`<div class="exp-tiles" role="tablist" aria-label="Filtrar vencimientos">
      <button class="exp-tile ${expiringFilter==="all"?"is-active":""}" type="button" role="tab" aria-selected="${expiringFilter==="all"}" data-action="expiring-filter" data-filter="all"><span class="exp-tile-ic">${icon("list")}</span><b class="num">${urgent+counts.sinclases}</b><small>Todos</small></button>
      ${EXP_GROUPS.map(g=>`<button class="exp-tile tone-${g.tone} ${expiringFilter===g.key?"is-active":""}" type="button" role="tab" aria-selected="${expiringFilter===g.key}" data-action="expiring-filter" data-filter="${g.key}"><span class="exp-tile-ic">${icon(g.icon)}</span><b class="num">${counts[g.key]}</b><small>${g.label}</small></button>`).join("")}
    </div>`;
    const toolbar=`<div class="toolbar filter-bar" style="margin-top:16px">${searchBox('data-filter="expiring-search"',"Buscar alumno por nombre, codigo o telefono…",expiringSearch)}</div>`;
    let list="";
    if(expiringFilter==="all"){
      list=EXP_GROUPS.map(g=>{
        const arr=items.filter(i=>i.group===g.key&&match(i)); if(!arr.length) return "";
        return `<section class="exp-group"><header class="exp-group-head tone-${g.tone}"><span class="exp-dot"></span><h3>${g.title}</h3><span class="badge no-dot">${arr.length}</span></header><div class="exp-grid">${arr.map(expCard).join("")}</div></section>`;
      }).join("");
    } else {
      const arr=items.filter(i=>i.group===expiringFilter&&match(i));
      list=arr.length?`<div class="exp-grid">${arr.map(expCard).join("")}</div>`:"";
    }
    if(!list) list=`<div class="empty">${q?"No hay alumnos que coincidan con la busqueda.":"Nada pendiente aqui. Todo al dia."}</div>`;
    return `${renderHeader("Vencimientos","Planes que vencen esta semana, vencidos con clases sin usar y alumnos sin clases disponibles.")}
      <section class="panel">${tiles}${toolbar}</section>
      <div class="exp-list">${list}</div>`;
  }

  /* ── PANEL ──────────────────────────────────────────────────────────── */
  function renderAttendanceChart(){
    const days=14, today=new Date(); today.setHours(0,0,0,0);
    const buckets=[];
    for(let i=days-1;i>=0;i--){ const d=new Date(today); d.setDate(d.getDate()-i); buckets.push({d,key:localDateStr(d.toISOString()),n:0}); }
    const idx={}; buckets.forEach((b,i)=>idx[b.key]=i);
    state.attendance.forEach(e=>{ const k=localDateStr(e.at); if(k in idx) buckets[idx[k]].n++; });
    const max=Math.max(1,...buckets.map(b=>b.n));
    const total=buckets.reduce((s,b)=>s+b.n,0);
    const prom=(total/days).toFixed(1).replace(".",",");
    const best=buckets.reduce((a,b)=>b.n>a.n?b:a,buckets[0]);
    const fmtD=new Intl.DateTimeFormat("es-CO",{weekday:"short",day:"numeric",month:"short"});
    const wk=new Intl.DateTimeFormat("es-CO",{weekday:"narrow"});
    const bars=buckets.map((b,i)=>{ const h=b.n?Math.max(4,b.n/max*100):0; const isToday=i===days-1; const lbl=`${fmtD.format(b.d)}: ${b.n} clase${b.n===1?"":"s"}`; return `<div class="ac-col ${isToday?"is-today":""}" tabindex="0" aria-label="${escapeHtml(lbl)}"><div class="ac-tip">${escapeHtml(lbl)}</div><div class="ac-bar-wrap"><div class="ac-bar" style="height:${h}%">${(b===best&&b.n)||isToday?`<span class="ac-val num">${b.n}</span>`:""}</div></div><span class="ac-day">${isToday?"Hoy":escapeHtml(wk.format(b.d).toUpperCase())}</span></div>`; }).join("");
    return `<div class="ac-meta"><div><span>Total 14 dias</span><strong class="num">${total}</strong></div><div><span>Promedio diario</span><strong class="num">${prom}</strong></div><div><span>Mejor dia</span><strong>${best.n?escapeHtml(fmtD.format(best.d)):"—"}</strong></div></div><div class="ac-chart" role="img" aria-label="Clases registradas por dia en los ultimos 14 dias">${bars}</div><table class="sr-only"><caption>Clases por dia</caption><tbody>${buckets.map(b=>`<tr><td>${escapeHtml(fmtD.format(b.d))}</td><td>${b.n}</td></tr>`).join("")}</tbody></table>`;
  }
  function renderExpiringSummary(){
    const {items,counts,urgent}=expiringData();
    const top=items.filter(i=>i.group!=="sinclases").slice(0,5);
    const chips=EXP_GROUPS.map(g=>`<button class="exp-mini tone-${g.tone}" type="button" data-action="expiring-filter" data-filter="${g.key}"><b class="num">${counts[g.key]}</b><span>${g.label}</span></button>`).join("");
    const lista=top.length?`<div class="exp-peek">${top.map(it=>`<div class="exp-peek-row">${avatar(it.student.name,"sm")}<span>${escapeHtml(it.student.name)}</span>${expCountdown(it)}</div>`).join("")}</div>`:`<div class="empty" style="padding:18px">Ningun plan vence esta semana.</div>`;
    return `<div class="panel exp-summary">
      ${panelHead("Vencimientos",urgent?`${urgent} plan${urgent===1?"":"es"} requiere${urgent===1?"":"n"} atencion esta semana.`:"Todo al dia esta semana.","alert",urgent?"warn":"ok",`<button class="btn" type="button" data-action="go-expiring">Ver todo${icon("chevronRight")}</button>`)}
      <div class="exp-minis">${chips}</div>
      ${lista}
    </div>`;
  }
  function renderDashboard(){
    const summary=stats();
    const recent=[...state.attendance].sort((a,b)=>new Date(b.at)-new Date(a.at)).slice(0,7);
    const hora=new Date().getHours();
    const saludo=hora<12?"Buenos dias":hora<19?"Buenas tardes":"Buenas noches";
    const hoyTxt=new Intl.DateTimeFormat("es-CO",{weekday:"long",day:"numeric",month:"long"}).format(new Date());
    const totalCupos=summary.usedClasses+summary.remaining;
    const usoPct=totalCupos?Math.min(100,Math.round(summary.usedClasses/totalCupos*100)):0;
    const renovPct=summary.active?Math.round(summary.renewed/summary.active*100):0;
    const pendPct=summary.active?Math.round(summary.pendingRenewal/summary.active*100):0;
    const exp=expiringData();
    return `
      <section class="hero">
        ${wavesSvg()}
        <div>
          <span class="eyebrow">${escapeHtml(hoyTxt)}</span>
          <h2>${saludo}, equipo ACQUA</h2>
          <p>Panel de ${escapeHtml(monthLabel(state.currentMonth))}: cupos, asistencia y renovaciones en un vistazo.</p>
          <div class="hero-actions">
            <button class="btn primary lg" type="button" data-action="go-checkin">${icon("scan")}Abrir escaner QR</button>
            <button class="btn glass lg" type="button" data-action="go-register">${icon("userPlus")}Nuevo alumno</button>
            ${exp.urgent?`<button class="btn glass lg" type="button" data-action="go-expiring">${icon("alert")}${exp.urgent} por vencer</button>`:""}
          </div>
        </div>
        <div class="hero-today"><span>Check-ins hoy</span><strong class="num">${summary.today}</strong><small>${summary.monthAttendance} en el mes</small></div>
      </section>
      <section class="grid cols-4">
        ${statCard("Alumnos activos",summary.active,summary.renewed+" renovados este mes","users",renovPct,"is-featured")}
        ${statCard("Clases usadas",summary.usedClasses,summary.remaining+" disponibles · "+usoPct+"% del cupo","check",usoPct,"")}
        ${statCard("Por renovar",summary.pendingRenewal,pendPct+"% de los activos","refresh",pendPct,"tone-warn")}
        ${statCard("Eventos",summary.events,"competencias y travesias","calendar",null,"")}
      </section>
      <section class="grid cols-2" style="margin-top:16px">
        <div class="panel">${panelHead("Asistencia","Clases registradas por dia · ultimos 14 dias.","activity","",`<button class="btn ghost" type="button" data-action="go-reports">${icon("chart")}Reportes</button>`)}${renderAttendanceChart()}</div>
        ${renderExpiringSummary()}
      </section>
      <section class="grid cols-2" style="margin-top:16px">
        <div class="panel">
          ${panelHead("Check-in rapido","Busca por nombre, telefono o codigo de carnet.","zap","",`<button class="btn" type="button" data-action="go-checkin">${icon("scan")}QR</button>`)}
          ${renderQuickSearch()}
        </div>
        <div class="panel">
          ${panelHead("Renovacion mensual",escapeHtml(monthLabel(state.currentMonth)),"refresh","warn",`<button class="btn accent" type="button" data-action="renew-all">${icon("refresh")}Renovar activos</button>`)}
          ${renderRenewalSummary()}
        </div>
      </section>
      <section class="panel" style="margin-top:16px">
        ${panelHead("Ultimas clases registradas","Movimientos recientes del control de asistencia.","activity","",`<button class="btn" type="button" data-action="go-reports">${icon("chart")}Ver reportes</button>`)}
        ${renderAttendanceTable(recent)}
      </section>`;
  }
  function statCard(label,value,detail,iconName="",pct=null,cls=""){ return `<article class="stat-card ${cls}"><span>${escapeHtml(label)}</span>${iconName?`<span class="icon-badge stat-icon">${icon(iconName)}</span>`:""}<strong class="num">${escapeHtml(value)}</strong>${pct!==null&&pct!==undefined?`<div class="meter" aria-hidden="true"><i style="width:${Math.max(0,Math.min(100,pct))}%"></i></div>`:""}<small>${escapeHtml(detail)}</small></article>`; }

  /* BUSQUEDA RAPIDA */
  function renderQuickSearch(){
    const matches=filteredStudents({search:checkinSearch,status:"active"}).slice(0,5);
    return `<form class="toolbar" data-form="quick-search" style="margin-bottom:12px">${searchBox('data-filter="checkin-search"',"Buscar alumno",checkinSearch)}<button class="btn primary" type="submit">${icon("check")}Registrar</button></form>${renderStudentPickList(matches)}`;
  }
  function miniRing(rem,total,size=46){
    const r=(size-6)/2, C=2*Math.PI*r, frac=total?Math.max(0,Math.min(1,rem/total)):0;
    const col=rem<=0?"var(--danger)":rem<=2?"var(--accent)":"var(--success)";
    return `<span class="mini-ring" style="width:${size}px;height:${size}px"><svg viewBox="0 0 ${size} ${size}"><circle cx="${size/2}" cy="${size/2}" r="${r}" class="trk"/><circle cx="${size/2}" cy="${size/2}" r="${r}" stroke="${col}" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${(C*(1-frac)).toFixed(1)}" class="val"/></svg><b style="color:${col}">${Math.max(0,rem)}</b></span>`;
  }
  function planFechas(student){
    const ini=inicioPlan(student), ven=calcularVencimiento(student);
    const dias=ven?Math.ceil((ven-new Date())/(1000*60*60*24)):null;
    return {ini,ven,dias};
  }
  function renderStudentPickList(students){
    if(!students.length) return '<div class="empty">No hay alumnos que coincidan.</div>';
    const featured=checkinSearch.trim()?students[0]:null;
    const rest=featured?students.slice(1):students;
    let html="";
    if(featured){
      const s=featured, id=escapeHtml(s.id);
      const total=planTotal(s), used=Number(s.classesUsed||0), rem=remainingClasses(s);
      const {ini,ven,dias}=planFechas(s);
      const venTxt=ven?shortDate(ven):"—";
      const venSub=dias===null?"Se calcula con la 1ra clase":dias<0?`Vencio hace ${Math.abs(dias)} dia${Math.abs(dias)===1?"":"s"}`:dias===0?"Vence hoy":`Faltan ${dias} dia${dias===1?"":"s"}`;
      const venTone=dias===null?"":dias<0||dias===0?"is-danger":dias<=5?"is-warn":"";
      const sinClases=rem<=0;
      html+=`<article class="pick-hero ${sinClases?"is-blocked":""}">
        <div class="pick-hero-top">${avatar(s.name)}<div class="pick-hero-who"><strong>${escapeHtml(s.name)}</strong><small>${escapeHtml(s.code)} · ${escapeHtml(PLAN_LABELS[s.planType]||total+" clases")}</small></div>${studentStatusBadge(s)}</div>
        <div class="pick-hero-body">
          ${miniRing(rem,total,92)}
          <div class="pick-stats">
            <div><span>${icon("play")}Inicio</span><strong>${ini?shortDate(ini):"Hoy, con esta clase"}</strong><small>${ini?"Primera clase del plan":"El plan arranca al registrar"}</small></div>
            <div class="${venTone}"><span>${icon("flag")}Vence</span><strong>${venTxt}</strong><small>${venSub}</small></div>
            <div><span>${icon("check")}Clases</span><strong>Lleva ${used} de ${total}</strong><small>${Math.max(0,rem)} disponible${rem===1?"":"s"}</small></div>
          </div>
        </div>
        ${sinClases?`<div class="checkin-warning danger" style="margin:0">Sin clases disponibles: renueva el plan antes de registrar.</div>`:""}
        <div class="pick-hero-actions">${sinClases?`<button class="btn primary lg" type="button" data-action="renew-student" data-id="${id}">${icon("refresh")}Renovar plan</button>`:`<button class="btn primary lg" type="button" data-action="register-class" data-id="${id}">${icon("check")}Registrar clase</button>`}<button class="btn outline" type="button" data-action="go-to-student" data-id="${id}">${icon("user")}Ver ficha</button></div>
      </article>`;
      if(rest.length) html+=`<p class="pick-more">Otros resultados</p>`;
    }
    html+=`<div class="student-list">${rest.map(student=>{
      const total=planTotal(student), used=Number(student.classesUsed||0), rem=remainingClasses(student);
      const {ini,ven,dias}=planFechas(student);
      const venCls=dias===null?"":dias<=0?"is-danger":dias<=5?"is-warn":"";
      return `<article class="student-card pick-row" data-action="go-to-student" data-id="${escapeHtml(student.id)}">${avatar(student.name)}<div class="sc-body"><strong>${escapeHtml(student.name)}</strong><div class="meta"><span>${escapeHtml(student.code)}</span><span>${escapeHtml(PLAN_LABELS[student.planType]||total+" clases")}</span></div><div class="pick-facts"><span>${icon("play")}${ini?shortDate(ini):"Sin iniciar"}</span><span class="${venCls}">${icon("flag")}${ven?shortDate(ven):"—"}</span><span>${icon("check")}${used}/${total}</span></div></div>${miniRing(rem,total,44)}<button class="btn primary" type="button" data-action="register-class" data-id="${escapeHtml(student.id)}">${icon("check")}Registrar</button></article>`;
    }).join("")}</div>`;
    return html;
  }
  function renderRenewalSummary(){
    const pending=state.students.filter(s=>s.status==="active"&&!isRenewed(s));
    if(!state.students.length) return '<div class="empty">Agrega alumnos para activar las renovaciones.</div>';
    if(!pending.length) return '<div class="empty">Todos los alumnos activos ya estan renovados.</div>';
    return `<div class="student-list">${pending.slice(0,5).map(student=>`<article class="student-card" data-action="go-to-student" data-id="${escapeHtml(student.id)}">${avatar(student.name)}<div class="sc-body"><strong>${escapeHtml(student.name)}</strong><div class="meta"><span>${escapeHtml(student.code)}</span><span>Ultimo mes: ${escapeHtml(student.monthKey||"sin registro")}</span></div></div><button class="btn accent" type="button" data-action="renew-student" data-id="${escapeHtml(student.id)}">${icon("refresh")}Renovar</button></article>`).join("")}</div>${pending.length>5?`<p class="muted">Hay ${pending.length-5} alumnos mas por renovar.</p>`:""}`;
  }

  /* ALUMNOS */
  function renderStudents(){
    const students=filteredStudents(studentFilters);
    const editing=editingStudentId?getStudent(editingStudentId):null;
    const headActions=`<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn wa-soft" type="button" data-action="share-register-link">${icon("message")}Enviar formulario WA</button><button class="btn primary" type="button" data-action="new-student">${icon("plus")}Nuevo alumno</button></div>`;
    const listPanel=`<div class="panel students-list-panel">${panelHead("Listado de alumnos",`${students.length} alumno${students.length===1?"":"s"} encontrado${students.length===1?"":"s"}.`,"users","","")}${renderStudentFilters()}${renderStudentsTable(students)}</div>`;
    const sinDefinir=state.students.filter(x=>x.planType==="anual"&&x.status==="active").length;
    const avisoAnual=sinDefinir&&studentFilters.plan!=="anual"?`<div class="callout warn" style="margin-bottom:16px;align-items:center">${icon("alert")}<span style="flex:1"><strong>${sinDefinir} alumno${sinDefinir===1?"":"s"} con "Plan anual" sin definir.</strong> Ese plan no dice cuantas clases al mes tiene (la app le da 100 al año). Edita su ficha y elige Plan anual 4, 9 o 13 clases/mes: las clases que ya vio se conservan.</span><button class="btn accent" type="button" data-action="filter-plan-anual">Ver cuales</button></div>`:"";
    if(studentsFormVisible){
      return `${renderHeader("Alumnos","Ficha unica por estudiante: plan, clases, pagos y firma.",headActions)}${avisoAnual}<section class="panel student-form-panel ${editing?"is-edit":""}" style="margin-bottom:16px">${panelHead(editing?"Editar alumno":"Nuevo alumno",editing?escapeHtml(editing.code)+" · "+escapeHtml(editing.name):"El codigo se asigna automaticamente.",editing?"edit":"userPlus","",`<button class="btn icon ghost" type="button" title="Cerrar formulario" aria-label="Cerrar formulario" data-action="toggle-students-form">${icon("x")}</button>`)}${renderStudentForm(editing)}</section>${listPanel}`;
    }
    return `${renderHeader("Alumnos","Ficha unica por estudiante: plan, clases, pagos y firma.",headActions)}${avisoAnual}${listPanel}`;
  }
  function renderStudentForm(student){
    const data=student||{name:"",category:"Infantil",birthdate:"",documento:"",responsible:"",phoneAcudiente:"",talla:"",peso:"",sangre:"",eps:"",camiseta:"",nivel:"",phone:"",email:"",planType:"4",customClasses:1,status:"active",notes:""};
    const showCustom=data.planType==="custom";
    return `<form id="studentForm" class="field-grid">
      <input type="hidden" name="studentId" value="${escapeHtml(student?.id||"")}">
      <div class="field-section">Datos personales</div>
      <label class="field wide">Nombre completo del alumno<input name="name" required autocomplete="name" value="${escapeHtml(data.name)}"></label>
      <label class="field">Documento de identidad<input name="documento" inputmode="numeric" placeholder="CC / TI / CE" value="${escapeHtml(data.documento||'')}"></label>
      <label class="field">Tipo<select name="category">${so("Infantil",data.category,"Infantil")}${so("Adulto",data.category,"Adulto")}${so("Matronatacion",data.category,"Matronatacion")}</select></label>
      <label class="field">Fecha de nacimiento<input name="birthdate" type="date" value="${escapeHtml(data.birthdate||'')}"></label>
      <label class="field">Telefono<input name="phone" inputmode="tel" value="${escapeHtml(data.phone)}"></label>
      <label class="field">Acudiente o contacto<input name="responsible" value="${escapeHtml(data.responsible)}"></label>
      <label class="field">Telefono del acudiente<input name="phoneAcudiente" inputmode="tel" placeholder="300 000 0000" value="${escapeHtml(data.phoneAcudiente||'')}"></label>
      <label class="field">Correo<input name="email" type="email" value="${escapeHtml(data.email)}"></label>
      <div class="field-section">Plan y nivel</div>
      <label class="field">Plan mensual<select name="planType" data-plan-select>
        ${so("1_practica",data.planType,PLAN_LABELS["1_practica"])}${so("1_grupal",data.planType,PLAN_LABELS["1_grupal"])}${so("1_matronat",data.planType,PLAN_LABELS["1_matronat"])}${so("4",data.planType,PLAN_LABELS["4"])}${so("9",data.planType,PLAN_LABELS["9"])}${so("8_practicas",data.planType,PLAN_LABELS["8_practicas"])}${so("13",data.planType,PLAN_LABELS["13"])}${so("13_equipo",data.planType,PLAN_LABELS["13_equipo"])}${so("5_vacacional",data.planType,PLAN_LABELS["5_vacacional"])}${so("matronat_4",data.planType,PLAN_LABELS["matronat_4"])}${so("matronat_8",data.planType,PLAN_LABELS["matronat_8"])}${so("matronat_personalizada_4",data.planType,PLAN_LABELS["matronat_personalizada_4"])}${so("anual_4",data.planType,PLAN_LABELS["anual_4"])}${so("anual_9",data.planType,PLAN_LABELS["anual_9"])}${so("anual_13",data.planType,PLAN_LABELS["anual_13"])}${so("personalizado_4",data.planType,PLAN_LABELS["personalizado_4"])}${so("personalizado_8",data.planType,PLAN_LABELS["personalizado_8"])}${so("obsequio_1",data.planType,PLAN_LABELS["obsequio_1"])}${so("obsequio_2",data.planType,PLAN_LABELS["obsequio_2"])}${so("obsequio_3",data.planType,PLAN_LABELS["obsequio_3"])}${so("custom",data.planType,PLAN_LABELS.custom)}</select></label>
      <div class="callout wide" style="font-size:.8rem">${icon("clock")}<span><strong>Todos los planes duran 30 dias</strong> contados desde la primera clase (el plan anual dura 1 año).</span></div>
      <label class="field" data-custom-classes ${showCustom?"":"hidden"}>Clases del plan<input name="customClasses" type="number" min="1" max="80" value="${escapeHtml(data.customClasses||1)}"></label>
      ${student?`<label class="field">Fecha de inicio del plan actual<input name="planStartedAt" type="date" value="${escapeHtml((()=>{ const ini=inicioPlan(data); return ini?localDateStr(ini.toISOString()):""; })())}"><small style="color:var(--muted);font-weight:500">Vacia = el plan empieza solo con la primera clase. Desde esta fecha corren los 30 dias del plan (1 año si es anual). Solo cambiala si sabes la fecha real en que inicio.</small></label>`:""}
      <label class="field">Estado<select name="status">${so("active",data.status,"Activo")}${so("paused",data.status,"Pausado")}</select></label><label class="field">Nivel del alumno<select name="nivel">${so("",data.nivel||"","Sin nivel asignado")}${[1,2,3,4,5,6,7,8].map(n=>so(String(n),data.nivel||"","Nivel "+n)).join("")}</select></label>
      <div class="field-section">Salud y dotacion</div>
      <label class="field">Estatura (cm)<input name="talla" type="number" min="30" max="250" placeholder="Ej: 120" value="${escapeHtml(data.talla||'')}"></label><label class="field">Peso (kg)<input name="peso" type="number" min="1" max="300" placeholder="Ej: 45" value="${escapeHtml(data.peso||'')}"></label><label class="field">Tipo de sangre<select name="sangre">${so("",data.sangre||"","Seleccionar")}${["O+","O-","A+","A-","B+","B-","AB+","AB-"].map(t=>so(t,data.sangre||"",t)).join("")}</select></label><label class="field">EPS<input name="eps" placeholder="Ej: Sura, Sanitas..." value="${escapeHtml(data.eps||'')}"></label><label class="field">Talla camiseta<select name="camiseta">${so("",data.camiseta||"","Seleccionar")}${["2","4","6","8","10","12","14","XS","S","M","L","XL","XXL"].map(t=>so(t,data.camiseta||"",t)).join("")}</select></label><label class="field wide">Notas<textarea name="notes">${escapeHtml(data.notes)}</textarea></label>
      <div class="split-actions wide">${student?`<button class="btn" type="button" data-action="cancel-edit">Cancelar</button>`:""}<button class="btn primary" type="submit">${icon("save")}${student?"Guardar cambios":"Guardar alumno"}</button></div>
    </form>`;
  }
  function so(value,current,label=value){ return `<option value="${escapeHtml(value)}" ${value===current?"selected":""}>${escapeHtml(label)}</option>`; }
  function renderStudentFilters(){
    return `<div class="toolbar filter-bar">${searchBox('data-filter="students-search"',"Buscar por nombre, codigo, telefono…",studentFilters.search)}<select class="compact-input" data-filter="students-plan" aria-label="Filtrar por plan">${so("all",studentFilters.plan,"Todos los planes")}${Object.entries(PLAN_LABELS).map(([k,v])=>so(k,studentFilters.plan,v)).join("")}</select><select class="compact-input" data-filter="students-status" aria-label="Filtrar por estado">${so("all",studentFilters.status,"Todos")}${so("active",studentFilters.status,"Activos")}${so("paused",studentFilters.status,"Pausados")}</select></div>`;
  }
  function planEndDate(student){ return calcularVencimiento(student); }
  function renderStudentsTable(students){
    if(!students.length) return '<div class="empty">No hay alumnos para mostrar.</div>';
    return `<div class="table-wrap"><table><thead><tr><th>Alumno</th><th>Plan</th><th>Vigencia</th><th>Clases</th><th>Estado</th><th><span class="sr-only">Acciones</span></th></tr></thead><tbody>${students.map(student=>{
      const total=planTotal(student), used=Number(student.classesUsed||0), remaining=remainingClasses(student);
      const progress=total?Math.min(100,Math.max(0,(used/total)*100)):0;
      const progCls=remaining<=0?"is-out":remaining<=2?"is-low":"";
      const endDate=calcularVencimiento(student);
      const vencido=endDate&&endDate.getTime()<Date.now();
      const diasParaVencer=endDate?Math.ceil((endDate-Date.now())/(1000*60*60*24)):null;
      const venceCls=vencido?"is-late":(diasParaVencer!==null&&diasParaVencer<=5)?"is-soon":"";
      const id=escapeHtml(student.id);
      const menu=`<details class="menu"><summary class="btn icon" title="Mas acciones" aria-label="Mas acciones para ${escapeHtml(student.name)}">${icon("more")}</summary><div class="menu-list" role="menu">
          <button type="button" data-action="edit-student" data-id="${id}">${icon("edit")}Editar ficha</button>
          <button type="button" class="is-wa" data-action="notify-student" data-id="${id}">${icon("message")}Recordatorio por WhatsApp</button>
          <button type="button" class="is-wa" data-action="send-carnet-whatsapp" data-id="${id}">${icon("card")}Enviar carnet por WhatsApp</button>
          <button type="button" class="${student.waiver?"is-done":"is-wa"}" data-action="send-waiver-whatsapp" data-id="${id}">${icon("signature")}${student.waiver?"Firma registrada ✓":"Enviar firma por WhatsApp"}</button>
          <hr>
          ${student.status==="active"?`<button type="button" class="is-warn" data-action="pause-student" data-id="${id}">${icon("pause")}Pausar alumno</button>`:`<button type="button" data-action="activate-student" data-id="${id}">${icon("play")}Activar alumno</button>`}
          <button type="button" class="is-danger" data-action="delete-student" data-id="${id}">${icon("trash")}Eliminar definitivamente</button>
        </div></details>`;
      return `<tr>
        <td data-label=""><div class="student-name">${avatar(student.name)}<div><strong>${escapeHtml(student.name)}</strong><small>${escapeHtml(student.code)} · ${escapeHtml(student.phone||"sin telefono")}</small></div></div></td>
        <td data-label="Plan"><div class="badges">${planBadge(student)}${student.nivel?`<span class="badge level">Nivel ${escapeHtml(student.nivel)}</span>`:""}</div></td>
        <td data-label="Vigencia"><div class="date-cell ${venceCls}">${endDate?"Vence "+shortDate(endDate):"Sin iniciar"}</div><small class="date-cell" style="font-size:.72rem">${(()=>{ const ini=inicioPlan(student); return ini?"Desde "+shortDate(ini):"Inicia con la 1ra clase"; })()}</small></td>
        <td data-label="Clases"><div class="classes-cell"><strong>${remaining}</strong><small>de ${total} · ${used} usadas</small></div><div class="progress ${progCls}" aria-hidden="true"><span style="width:${progress}%"></span></div></td>
        <td data-label="Estado">${studentStatusBadge(student)}</td>
        <td class="actions" data-label=""><button class="btn icon go" type="button" title="Registrar clase" aria-label="Registrar clase" data-action="register-class" data-id="${id}">${icon("check")}</button><button class="btn icon" type="button" title="Registrar pago" aria-label="Registrar pago" data-action="open-pay-modal" data-id="${id}">${icon("dollar")}</button><button class="btn icon" type="button" title="Renovar" aria-label="Renovar" data-action="renew-student" data-id="${id}">${icon("refresh")}</button><button class="btn icon wa" type="button" title="Enviar carnet por WhatsApp" aria-label="Enviar carnet por WhatsApp" data-action="send-carnet-whatsapp" data-id="${id}">${icon("card")}</button>${menu}</td>
      </tr>`;
    }).join("")}</tbody></table></div>`;
  }

  /* CHECK-IN QR - VISTA PUBLICA */
  function renderCheckin(){
    const matches=filteredStudents({search:checkinSearch,status:"active"}).slice(0,7);
    return `
      ${renderHeader("Asistencia QR","Escanea el carnet del alumno para registrar la clase de hoy.")}
      <section class="scan-layout">
        <div class="panel scan-panel">
          <div class="scan-actions">
            <button class="btn primary lg" type="button" data-action="start-scanner">${icon("camera")}Abrir camara</button>
            <button class="btn outline lg" type="button" data-action="stop-scanner">${icon("stop")}Detener</button>
          </div>
          <div class="scanner-box">
            <video id="scanVideo" playsinline muted></video>
            <div id="scannerPlaceholder" class="scanner-placeholder">
              <div class="scan-illustration"><svg class="qr-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons.qr}</svg></div>
              <p>Toca <strong>Abrir camara</strong> y apunta al codigo QR del carnet.</p>
            </div>
            <div id="scanCrosshair" class="scan-frame" hidden><div class="scan-window"><i></i><i></i><i></i><i></i><span class="scan-line"></span></div></div>
          </div>
          <p class="scan-hint">${icon("info")}Compatible con Chrome, Safari y Firefox · requiere permiso de camara</p>
        </div>
        ${isAuthenticated?`
        <aside class="panel">
          ${panelHead("Registro manual","Codigo, nombre o telefono.","edit")}
          <form class="toolbar" data-form="quick-search" style="margin-bottom:12px">
            ${searchBox('data-filter="checkin-search"',"Buscar alumno o codigo",checkinSearch)}
            <button class="btn primary" type="submit">${icon("check")}Registrar</button>
          </form>
          ${renderStudentPickList(matches)}
        </aside>`:`
        <aside class="panel lock-card">
          <span class="icon-badge" style="width:56px;height:56px;border-radius:18px">${icon("lock")}</span>
          <div><p style="font-weight:700;margin:0 0 4px;color:var(--ink)">Registro manual solo para administradores</p><p style="font-size:.84rem;color:var(--muted)">Usa el escaner QR para registrar asistencia.</p></div>
          <button class="btn primary" type="button" data-action="open-login">${icon("lock")}Administrar</button>
        </aside>`}
      </section>`;
  }

  
  /* REGISTRO PUBLICO DE ALUMNO */
  function renderRegister(){
    return `
      ${renderHeader("Registrar nuevo alumno","Completa el formulario para agregar un alumno a ACQUA NATACION.")}
      <section class="panel" style="max-width:760px;margin:0 auto">
        ${panelHead("Datos del alumno","El codigo de carnet se asigna automaticamente.","userPlus")}
        <form id="studentFormPublic" class="field-grid">
          <div class="field-section">Datos personales</div>
          <label class="field wide">Nombre completo <span class="req">*</span><input name="name" required autocomplete="name" placeholder="Nombre y apellidos"></label>
          <label class="field">Documento de identidad<input name="documento" inputmode="numeric" placeholder="CC / TI / CE"></label>
          <label class="field">Tipo
            <select name="category">
              <option value="Infantil">Infantil</option>
              <option value="Adulto">Adulto</option>
              <option value="Matronatacion">Matronatacion</option>
            </select>
          </label>
          <label class="field">Fecha de nacimiento<input name="birthdate" type="date"></label>
          <label class="field">Telefono <span class="req">*</span><input name="phone" inputmode="tel" required placeholder="300 000 0000"></label>
          <label class="field">Acudiente o contacto<input name="responsible" placeholder="Nombre del acudiente"></label>
          <label class="field">Telefono del acudiente<input name="phoneAcudiente" inputmode="tel" placeholder="300 000 0000"></label>
          <label class="field">Correo<input name="email" type="email" placeholder="correo@ejemplo.com"></label>
          <label class="field">Nivel del alumno<select name="nivel"><option value="">Sin nivel asignado</option><option value="1">Nivel 1</option><option value="2">Nivel 2</option><option value="3">Nivel 3</option><option value="4">Nivel 4</option><option value="5">Nivel 5</option><option value="6">Nivel 6</option><option value="7">Nivel 7</option><option value="8">Nivel 8</option></select></label>
          <div class="field-section">Plan y nivel</div>
          <label class="field">Plan mensual
            <select name="planType" data-plan-select>
              <option value="1_practica">1 practica libre</option>
              <option value="1_grupal">1 clase grupal</option>
              <option value="1_matronat">1 clase de matronatacion</option>
              <option value="4" selected>4 clases/mes</option>
              <option value="9">9 clases/mes</option>
              <option value="8_practicas">8 practicas libres</option>
              <option value="13">13 clases/mes</option>
              <option value="13_equipo">13 clases equipo</option>
              <option value="5_vacacional">5 clases vacacional</option>
              <option value="matronat_4">Matronatacion 4 clases/mes</option>
              <option value="matronat_8">Matronatacion 8 clases/mes</option>
              <option value="matronat_personalizada_4">4 clases de Matronatacion personalizadas</option>
              <option value="anual_4">Plan anual 4 clases/mes</option>
              <option value="anual_9">Plan anual 9 clases/mes</option>
              <option value="anual_13">Plan anual 13 clases/mes</option>
              <option value="personalizado_4">Personalizado 4 clases</option>
              <option value="personalizado_8">Personalizado 8 clases</option>
              <option value="obsequio_1">Obsequio 1 clase</option>
              <option value="obsequio_2">Obsequio 2 clases</option>
              <option value="obsequio_3">Obsequio 3 clases</option>
              <option value="custom">Personalizado</option>
            </select>
          </label>
          <div class="callout wide" style="font-size:.8rem">${icon("clock")}<span><strong>Todos los planes duran 30 dias</strong> contados desde la primera clase (el plan anual dura 1 año).</span></div>
          <label class="field" data-custom-classes hidden>Numero de clases<input name="customClasses" type="number" min="1" max="80" value="1"></label>
          <div class="field-section">Salud y dotacion</div>
          <label class="field">Estatura (cm)<input name="talla" type="number" min="30" max="250" placeholder="Ej: 120"></label>          <label class="field">Peso (kg)<input name="peso" type="number" min="1" max="300" placeholder="Ej: 45"></label>          <label class="field">Tipo de sangre<select name="sangre"><option value="">Seleccionar</option><option>O+</option><option>O-</option><option>A+</option><option>A-</option><option>B+</option><option>B-</option><option>AB+</option><option>AB-</option></select></label>          <label class="field">EPS<input name="eps" placeholder="Ej: Sura, Sanitas..."></label>          <label class="field">Talla camiseta<select name="camiseta"><option value="">Seleccionar</option><option>2</option><option>4</option><option>6</option><option>8</option><option>10</option><option>12</option><option>14</option><option>XS</option><option>S</option><option>M</option><option>L</option><option>XL</option><option>XXL</option></select></label>          <label class="field wide">Notas u observaciones<textarea name="notes" placeholder="Alergias, condiciones medicas, horario preferido..."></textarea></label>
          <div class="split-actions wide" style="margin-top:4px">
            <button class="btn primary lg" type="submit" style="flex:1">${icon("save")} Registrar alumno</button>
          </div>
        </form>
      </section>`;
  }

/* CARNETS QR */
  function renderCards(){
    const students=filteredStudents({search:cardSearch,status:"active"});
    return `${renderHeader("Carnets QR","Cada alumno conserva el mismo codigo. Solo se renueva el cupo al cambiar de mes.",`<button class="btn primary no-print" type="button" data-action="print-cards">${icon("print")}Imprimir todos</button>`)}<section class="panel print-area"><div class="toolbar filter-bar no-print">${searchBox('data-filter="cards-search"',"Buscar carnet por nombre o codigo",cardSearch)}<span class="badge info">${students.length} carnet${students.length===1?"":"s"}</span></div>${students.length?`<div class="qr-grid">${students.map(renderQrCard).join("")}</div>`:'<div class="empty">No hay carnets para mostrar.</div>'}</section>`;
  }
  function renderQrCard(student){
    const qr=qrSvg(qrPayload(student));
    const diasRestantesMes=diasVigenciaPlan(student.planType);
    const parts=student.name.toUpperCase().trim().split(/\s+/);
    let splitIdx=parts.length>=4?2:1;
    const nombres=parts.slice(0,splitIdx).join(' ');
    const apellidos=parts.slice(splitIdx).join(' ');
    return `<div class="carnet-item">
    <article style="position:relative;width:270px;height:450px;border-radius:20px;overflow:hidden;box-shadow:0 18px 40px -16px rgba(4,15,38,.55);break-inside:avoid;page-break-inside:avoid" id="card-${escapeHtml(student.id)}">
      <img src="assets/carnet-Acqua.jpg" style="position:absolute;inset:0;width:100%;height:100%;object-fit:fill;display:block" alt="">
      <div style="position:absolute;top:15%;left:50%;transform:translateX(-50%);width:71%;border-radius:12px;overflow:hidden;background:#fff;line-height:0;box-shadow:0 6px 18px rgba(10,36,114,.25)">${qr}</div>
      <div style="position:absolute;top:67%;left:0;right:0;text-align:center;padding:0 10px;color:#0a2472;font-family:var(--font-display);font-weight:800;letter-spacing:.01em;line-height:1.12">
        <div style="font-size:1.12rem">${escapeHtml(nombres)}</div>
        ${apellidos?`<div style="font-size:1.12rem">${escapeHtml(apellidos)}</div>`:''}
        <div style="display:inline-block;font-family:var(--font-body);font-size:.68rem;font-weight:800;color:#fff;background:#FF6B00;margin-top:6px;padding:2px 10px;border-radius:999px;letter-spacing:.08em;text-transform:uppercase">${{Nino:'Infantil',Adulto:'Adulto',Matronatacion:'Matronatacion','Practica libre':'Practica libre'}[student.category]||escapeHtml(student.category||'')}</div>
        <div style="font-family:var(--font-body);font-size:.72rem;font-weight:800;color:#0a2472;margin-top:5px;letter-spacing:.14em">${escapeHtml(student.code)}</div>
        <div style="font-family:var(--font-body);font-size:.64rem;font-weight:600;color:#33508f;margin-top:2px;max-width:150px;margin-left:auto;margin-right:auto">${diasRestantesMes>=365?"Vigencia: 1 año":"Vigencia: "+diasRestantesMes+" días"}<br><span style="font-weight:500;opacity:.85">desde tu primera clase</span></div>
      </div>
      <div style="position:absolute;bottom:3%;left:0;right:0;text-align:center;font-size:.6rem;color:#6688bb;letter-spacing:.22em;font-weight:800">DESDE 2015</div>
    </article>
    <div class="carnet-btns no-print"><button class="btn wa" type="button" data-action="send-carnet-whatsapp" data-id="${escapeHtml(student.id)}">${icon("message")}Enviar por WhatsApp</button><button class="btn outline" type="button" data-action="print-one-card" data-id="${escapeHtml(student.id)}">${icon("print")}Imprimir</button></div>
    </div>`;
  }

  /* EVENTOS */
  function getCalMonth(){
    if(!calendarMonth) calendarMonth=new Date();
    return calendarMonth;
  }

  function renderCalendar(){
    const cm=getCalMonth();
    const year=cm.getFullYear(), month=cm.getMonth();
    const firstDay=new Date(year,month,1).getDay();
    const daysInMonth=new Date(year,month+1,0).getDate();
    const todayStr=localDateStr(new Date().toISOString());
    const allEvts=[
      ...state.events.map(function(e){ return Object.assign({},e,{tipo:"externo"}); }),
      ...(state.internalEvents||[]).map(function(e){ return Object.assign({},e,{tipo:"interno"}); })
    ];
    const label=new Intl.DateTimeFormat("es-CO",{month:"long",year:"numeric"}).format(new Date(year,month,1));
    const dias=["Dom","Lun","Mar","Mie","Jue","Vie","Sab"];
    let cells="";
    for(let i=0;i<firstDay;i++) cells+='<div class="cal-cell empty"></div>';
    for(let d=1;d<=daysInMonth;d++){
      const dateStr=year+"-"+String(month+1).padStart(2,"0")+"-"+String(d).padStart(2,"0");
      const dayEvts=allEvts.filter(function(e){ return e.date===dateStr; });
      const isToday=dateStr===todayStr;
      let evtHtml="";
      dayEvts.forEach(function(e){
        const cls=e.tipo==="interno"?"cal-evt-int":"cal-evt-ext";
        evtHtml+='<div class="cal-evt '+cls+'" title="'+escapeHtml(e.name)+'">'+escapeHtml(e.name)+'</div>';
      });
      cells+='<div class="cal-cell'+(isToday?" today":"")+'"><span class="cal-day-num">'+d+'</span>'+evtHtml+'</div>';
    }
    const diasHtml=dias.map(function(d){ return '<div class="cal-head">'+d+'</div>'; }).join("");
    return '<div class="cal-toolbar">'
      +'<button class="btn icon" type="button" aria-label="Mes anterior" data-action="cal-prev">'+icon("chevronLeft")+'</button>'
      +'<strong>'+escapeHtml(label)+'</strong>'
      +'<button class="btn icon" type="button" aria-label="Mes siguiente" data-action="cal-next">'+icon("chevronRight")+'</button>'
      +'</div>'
      +'<div class="cal-grid">'+diasHtml+cells+'</div>'
      +'<div class="cal-legend"><span><i style="background:#FFF1E0;box-shadow:inset 3px 0 0 var(--coral)"></i>Externo</span><span><i style="background:var(--teal-tint);box-shadow:inset 3px 0 0 var(--cyan-500)"></i>Interno</span></div>';
  }

  function renderEvents(){
    try {
      const ev=activeEventId?getEvent(activeEventId):null;
      if(ev) return renderEventDetail(ev);
      const ordered=[...state.events].sort((a,b)=>(a.date||"").localeCompare(b.date||""));
      const internal=[...(state.internalEvents||[])].sort((a,b)=>(a.date||"").localeCompare(b.date||""));
      const viewBtns='<div class="seg" role="tablist">'
        +'<button class="btn '+(calendarView==="list"?"primary":"")+'" type="button" data-action="events-view-list">'+icon("list")+'Lista</button>'
        +'<button class="btn '+(calendarView==="calendar"?"primary":"")+'" type="button" data-action="events-view-calendar">'+icon("calendar")+'Calendario</button>'
        +'</div>';
      let calBlock="";
      if(calendarView==="calendar"){
        try{ calBlock='<div class="panel" style="margin-bottom:16px">'+renderCalendar()+'</div>'; }
        catch(ce){ calBlock='<div class="panel"><div class="callout danger">Error calendario: '+escapeHtml(ce.message)+'</div></div>'; }
      }
      const extHtml=ordered.length?'<div class="event-list">'+ordered.map(renderEventCard).join("")+'</div>':'<div class="empty">No hay eventos externos todavia.</div>';
      const intHtml=internal.length?'<div class="event-list">'+internal.map(renderInternalEventCard).join("")+'</div>':'<div class="empty">No hay eventos internos todavia.</div>';
      return renderHeader("Eventos y calendario","Gestiona competencias, travesias y actividades internas.",viewBtns)
        + calBlock
        + '<section class="events-layout">'
        + '<div class="panel">'
        +   panelHead("Nuevo evento externo","Competencia, travesia o salida.","map")
        +   '<form id="eventForm" class="field-grid">'
        +     renderEventFields(null)
        +     '<div class="split-actions wide"><button class="btn primary" type="submit">'+icon("plus")+'Crear evento externo</button></div>'
        +   '</form>'
        +   '<div class="panel-divider">'
        +     panelHead("Nuevo evento interno","Fiestas y actividades en instalaciones.","sparkles")
        +     '<form id="internalEventForm" class="field-grid">'
        +       '<label class="field wide">Nombre<input name="iEventName" required placeholder="Fiesta, Cumpleanos..."></label>'
        +       '<label class="field">Fecha<input name="iEventDate" type="date" required></label>'
        +       '<label class="field">Hora inicio<input name="iEventStart" type="time"></label>'
        +       '<label class="field">Hora fin<input name="iEventEnd" type="time"></label>'
        +       '<label class="field wide">Descripcion<input name="iEventDesc" placeholder="Detalles adicionales..."></label>'
        +       '<div class="split-actions wide"><button class="btn" type="submit">'+icon("plus")+'Agregar al calendario</button></div>'
        +     '</form>'
        +   '</div>'
        + '</div>'
        + '<div class="panel">'
        +   panelHead('Externos <span class="badge info" style="margin-left:6px;vertical-align:middle">'+state.events.length+'</span>',"Competencias y travesias.","flag")
        +   extHtml
        +   '<div class="panel-divider">'
        +   panelHead('Internos <span class="badge info" style="margin-left:6px;vertical-align:middle">'+(state.internalEvents||[]).length+'</span>',"Fiestas y actividades.","sparkles")
        +   intHtml
        +   '</div>'
        + '</div>'
        + '</section>';
    } catch(e) {
      console.error("renderEvents error:", e);
      return '<div class="panel" style="text-align:center"><div class="callout danger" style="justify-content:center"><strong>Error al cargar Eventos:</strong> '+escapeHtml(e.message)+'</div><button class="btn primary" style="margin-top:14px" onclick="location.reload()">Recargar</button></div>';
    }
  }
  function renderInternalEventCard(event){
    const horario=event.start?(event.start+(event.end?" - "+event.end:"")):"Sin horario";
    const descHtml=event.desc?'<p style="font-size:.8rem;color:var(--muted);margin:4px 0 0">'+escapeHtml(event.desc)+'</p>':"";
    return '<article class="event-card is-internal">'
      +dateTile(event.date,"is-internal")
      +'<div style="min-width:0">'
      +'<strong>'+escapeHtml(event.name)+'</strong>'
      +'<div class="meta"><span>'+icon("calendar")+escapeHtml(prettyDate(event.date))+'</span><span>'+icon("clock")+escapeHtml(horario)+'</span></div>'
      +descHtml
      +'</div>'
      +'<div class="event-actions">'
      +'<button class="btn icon danger" type="button" title="Eliminar" aria-label="Eliminar evento interno" data-action="delete-internal-event" data-id="'+escapeHtml(event.id)+'">'+icon("trash")+'</button>'
      +'</div>'
      +'</article>';
  }

  function renderEventCard(event){
    const attendees=event.attendees||[];
    const paid=attendees.filter(a=>a.paid).length, signed=attendees.filter(a=>a.signed).length;
    const id=escapeHtml(event.id);
    return `<article class="event-card">${dateTile(event.date)}<div style="min-width:0"><strong>${escapeHtml(event.name)}</strong><div class="meta"><span>${icon("calendar")}${escapeHtml(prettyDate(event.date))}</span><span>${icon("map")}${escapeHtml(event.place||"Sin lugar")}</span></div><div class="event-metrics"><span><b>${attendees.length}</b> inscritos</span><span><b>${paid}</b> pagos</span><span><b>${signed}</b> firmas</span></div></div><div class="event-actions"><button class="btn primary" type="button" data-action="view-event" data-id="${id}">Gestionar${icon("chevronRight")}</button><button class="btn icon wa-soft" type="button" title="Enviar enlace de inscripcion por WhatsApp" aria-label="Enviar enlace por WhatsApp" data-action="share-event-link" data-id="${id}">${icon("message")}</button><button class="btn icon" type="button" title="Exportar listado a Excel" aria-label="Exportar a Excel" data-action="export-event-xlsx" data-id="${id}">${icon("download")}</button><button class="btn icon danger" type="button" title="Eliminar" aria-label="Eliminar evento" data-action="delete-event" data-id="${id}">${icon("trash")}</button></div></article>`;
  }
  function renderEventDetail(event){
    const attendees=event.attendees||[];
    const available=state.students.filter(s=>s.status==="active"&&!attendees.some(a=>a.studentId===s.id)).sort((a,b)=>a.name.localeCompare(b.name,"es"));
    const paid=attendees.filter(a=>a.paid).length, signed=attendees.filter(a=>a.signed).length;
    const id=escapeHtml(event.id);
    return `<div class="detail-shell">
      <div class="detail-bar"><button class="btn ghost" type="button" data-action="back-events">${icon("arrowLeft")}Volver a eventos</button>
        <div><button class="btn wa" type="button" data-action="share-event-link" data-id="${id}">${icon("message")}Enviar enlace de inscripcion</button><button class="btn" type="button" data-action="export-event-xlsx" data-id="${id}">${icon("download")}Excel</button><button class="btn" type="button" data-action="edit-event" data-id="${id}">${icon("edit")}Editar</button><button class="btn" type="button" data-action="duplicate-event" data-id="${id}">${icon("copy")}Duplicar</button><button class="btn ghost" type="button" data-action="preview-event-link" data-id="${id}">${icon("eye")}Ver formulario</button></div>
      </div>
      ${eventEditId===event.id?renderEventEditPanel(event):""}
      <section class="event-hero">${wavesSvg()}<div><img class="section-logo" src="assets/logo-acqua-blanco.png" alt="${escapeHtml(DEFAULT_BUSINESS)}"><span class="eyebrow">Evento activo</span><h2>${escapeHtml(event.name)}</h2><p><span>${icon("calendar")}${escapeHtml(prettyDate(event.date))}</span><span>${icon("map")}${escapeHtml(event.place||"Sin lugar")}</span></p></div><div class="event-hero-stats"><span><strong>${attendees.length}</strong>inscritos</span><span><strong>${paid}</strong>pagados</span><span><strong>${signed}</strong>firmados</span></div></section>
      <section class="grid cols-2">
        <div class="panel">${panelHead("Inscribir alumno","Solo aparecen alumnos activos no inscritos.","userPlus")}${renderEventEnrollPicker(event,available)}
          <div class="panel-divider">${panelHead("Inscribir persona particular","Alguien que solo asiste a este evento, sin ser alumno de la academia.","user")}<form id="eventGuestForm" class="field-grid"><input type="hidden" name="eventId" value="${id}"><label class="field wide">Nombre completo<input name="guestName" required placeholder="Nombre y apellidos"></label><label class="field">Edad<input name="guestAge" type="number" min="0" max="120" placeholder="Ej: 28"></label><label class="field">Telefono<input name="guestPhone" inputmode="tel" placeholder="300 000 0000"></label><div class="split-actions wide"><button class="btn accent" type="submit">${icon("plus")}Inscribir particular</button></div></form></div>
        </div>
        <div class="panel">${panelHead("Control de inscritos","Actualiza pagos y firmas antes del evento.","check","ok")}${attendees.length?`<div class="attendee-list">${attendees.map(a=>renderAttendeeRow(event,a)).join("")}</div>`:'<div class="empty">Aun no hay inscritos.</div>'}</div>
      </section></div>`;
  }
  function renderEventEnrollPicker(event,available){
    const q=eventEnrollSearch.trim().toLowerCase();
    const filtered=q?available.filter(s=>[s.name,s.code,s.phone].join(" ").toLowerCase().includes(q)):available;
    const shown=filtered.slice(0,8);
    const box=`<div class="toolbar filter-bar">${searchBox('data-filter="event-enroll-search"',"Buscar alumno para inscribir",eventEnrollSearch)}</div>`;
    if(!available.length) return box+'<div class="empty">No hay alumnos activos disponibles para inscribir.</div>';
    if(!shown.length) return box+'<div class="empty">No hay alumnos que coincidan con la busqueda.</div>';
    const list=`<div class="student-list">${shown.map(s=>`<article class="student-card">${avatar(s.name,"sm")}<div class="sc-body"><strong>${escapeHtml(s.name)}</strong><div class="meta"><span>${escapeHtml(s.code)}</span><span>${escapeHtml(s.phone||"sin telefono")}</span></div></div><button class="btn primary" type="button" data-action="enroll-event-pick" data-event-id="${escapeHtml(event.id)}" data-id="${escapeHtml(s.id)}">${icon("plus")}Inscribir</button></article>`).join("")}</div>`;
    const more=filtered.length>shown.length?`<p class="muted">Hay ${filtered.length-shown.length} alumno(s) mas. Sigue escribiendo para filtrar.</p>`:"";
    return box+list+more;
  }
  function renderAttendeeRow(event,attendee){
    const info=attendeeDisplay(attendee);
    const badge=info.isGuest?'<span class="badge info" style="margin-left:6px">Particular</span>':"";
    const eid=escapeHtml(event.id), aid=escapeHtml(attendee.id);
    return `<article class="attendee-row"><div class="attendee-who">${avatar(info.name,"sm")}<div style="min-width:0"><strong>${escapeHtml(info.name)}${badge}</strong><small>${escapeHtml(info.phone||"sin telefono")}${info.sub?" · "+escapeHtml(info.sub):""}</small></div></div><div class="attendee-actions"><button class="btn ${attendee.paid?"ok":"outline"}" type="button" data-action="toggle-event-paid" data-event-id="${eid}" data-attendee-id="${aid}">${icon("dollar")}${attendee.paid?"Pagado":"Pendiente"}</button>${attendee.datos?`<button class="btn icon" type="button" title="Ver datos de inscripcion" aria-label="Ver datos de inscripcion" data-action="view-attendee-data" data-event-id="${eid}" data-attendee-id="${aid}">${icon("file")}</button>`:""}<button class="btn ${attendee.signed?"ok":"outline"}" type="button" data-action="open-signature" data-event-id="${eid}" data-attendee-id="${aid}">${icon("signature")}${attendee.signed?"Firmado":"Sin firmar"}</button><button class="btn icon danger" type="button" title="Quitar" aria-label="Quitar inscrito" data-action="remove-event-attendee" data-event-id="${eid}" data-attendee-id="${aid}">${icon("trash")}</button></div></article>`;
  }
  function renderSignatureModal(draft){
    const event=getEvent(draft.eventId);
    const attendee=event?.attendees?.find(a=>a.id===draft.attendeeId);
    if(!event||!attendee) return "";
    const info=attendeeDisplay(attendee);
    return `<div class="modal-backdrop" role="dialog" aria-modal="true" aria-label="Firma de exoneracion"><div class="modal-panel signature-panel"><div class="modal-header"><div><img class="modal-logo" src="assets/logo-acqua-blanco.png" alt="${escapeHtml(DEFAULT_BUSINESS)}"><span class="eyebrow">Documento digital</span><h3>Firma de exoneracion</h3></div><button class="btn icon" type="button" title="Cerrar" aria-label="Cerrar" data-action="close-signature">${icon("x")}</button></div><div class="waiver-copy"><p><strong>${info.isGuest?"Participante":"Estudiante"}:</strong> ${escapeHtml(info.name)}<br><strong>Evento:</strong> ${escapeHtml(event.name)}</p><p style="font-weight:700;margin:12px 0 6px">DECLARACIONES Y AUTORIZACION</p><ol><li><strong>Conocimiento del Evento:</strong> Declaro conocer las condiciones de participacion del evento y autorizo la asistencia del participante. Entiendo que las actividades fuera de la sede tienen condiciones muy diferentes a una clase regular, como corrientes, profundidad variable, oleaje y cambios de clima.</li><li><strong>Estado de Salud:</strong> Certifico que el participante se encuentra en buen estado de salud. Me comprometo a informar cualquier novedad medica, alergia o malestar relevante antes del inicio del evento.</li><li><strong>Supervision y Seguridad:</strong> Acepto que la participacion se realizara bajo la supervision del equipo de ACQUA NATACION, y me aseguro de que el participante acatara todas sus instrucciones y normas de seguridad.</li><li><strong>Exoneracion:</strong> Acepto los riesgos naturales de la actividad deportiva en exteriores y exonero de responsabilidad a ACQUA NATACION por cualquier incidente o lesion que ocurra durante el evento, siempre que la academia haya cumplido con las medidas de seguridad correspondientes.</li><li><strong>Atencion Medica:</strong> En caso de emergencia, autorizo al personal a brindar primeros auxilios o a trasladar al participante al centro medico mas cercano si es necesario.</li><li><strong>Uso de Imagen:</strong> Autorizo a ACQUA NATACION a tomar fotografias y/o videos del participante durante el evento y a publicarlos en sus redes sociales y demas medios promocionales, sin que esto genere ninguna contraprestacion economica.</li></ol></div><form id="signatureForm" class="field-grid"><input type="hidden" name="eventId" value="${escapeHtml(event.id)}"><input type="hidden" name="attendeeId" value="${escapeHtml(attendee.id)}"><label class="field wide consent"><input name="accepted" type="checkbox" required>Confirmo que lei y acepto los terminos de exoneracion y responsabilidad.</label><label class="field">Nombre de quien firma<input name="signatureName" required placeholder="Acudiente o participante mayor de edad" value="${escapeHtml(info.isGuest?info.name:"")}"></label><label class="field">Documento<input name="signatureDocument" required inputmode="numeric" placeholder="CC / TI / CE"></label><div class="split-actions wide"><button class="btn" type="button" data-action="close-signature">Cancelar</button><button class="btn primary" type="submit">${icon("signature")}Firmar documento</button></div></form></div></div>`;
  }

  /* REPORTES */
  /* BALANCE DE PLANES: cuantos se vendieron/renovaron este mes y cuantos activos hay, por tipo */
  function planTypeLabel(type){ return PLAN_LABELS[type] || (type==="custom"?"Personalizado":(type||"Sin plan")); }
  function planSalesReport(){
    const soldByType={}, activeByType={};
    state.students.forEach(s=>{
      const type=s.planType||"custom";
      if(s.monthKey===state.currentMonth){ (soldByType[type]=soldByType[type]||[]).push(s); }
      if(s.status==="active"){ (activeByType[type]=activeByType[type]||[]).push(s); }
    });
    const allTypes=Array.from(new Set([...Object.keys(soldByType),...Object.keys(activeByType)]))
      .sort((a,b)=>planTypeLabel(a).localeCompare(planTypeLabel(b),"es"));
    return { soldByType, activeByType, allTypes };
  }
  function renderPlanSalesPanel(){
    const {soldByType,activeByType,allTypes}=planSalesReport();
    if(!allTypes.length) return '<div class="empty">Aun no hay alumnos registrados.</div>';
    const totalSold=Object.values(soldByType).reduce((sum,arr)=>sum+arr.length,0);
    const totalActive=Object.values(activeByType).reduce((sum,arr)=>sum+arr.length,0);
    const maxActive=Math.max(1,...allTypes.map(t=>(activeByType[t]||[]).length));
    const maxSold=Math.max(1,...allTypes.map(t=>(soldByType[t]||[]).length));
    const rows=allTypes.map(type=>{
      const sold=soldByType[type]||[], active=activeByType[type]||[];
      const soldNames=sold.length?sold.map(s=>escapeHtml(s.name)).join(", "):"—";
      return `<tr><td><strong>${escapeHtml(planTypeLabel(type))}</strong></td><td style="min-width:150px"><div style="display:flex;align-items:center;gap:10px"><span class="num" style="font-weight:800;min-width:22px;color:var(--ink)">${sold.length}</span><div class="bar" style="flex:1"><i style="width:${sold.length/maxSold*100}%"></i></div></div></td><td style="font-size:.78rem;color:var(--muted);max-width:340px">${soldNames}</td><td style="min-width:150px"><div style="display:flex;align-items:center;gap:10px"><span class="num" style="font-weight:800;min-width:22px;color:var(--ink)">${active.length}</span><div class="bar ok" style="flex:1"><i style="width:${active.length/maxActive*100}%"></i></div></div></td></tr>`;
    }).join("");
    return `<div class="sum-strip" style="margin:0 0 16px"><div><span>Vendidos o renovados · ${escapeHtml(monthLabel(state.currentMonth))}</span><strong class="num">${totalSold}</strong></div><div><span>Planes activos ahora</span><strong class="num">${totalActive}</strong></div><div><span>Tipos de plan en uso</span><strong class="num">${allTypes.length}</strong></div></div><div class="table-wrap"><table class="plan-bars"><thead><tr><th>Plan</th><th>Vendidos / renovados</th><th>Quien</th><th>Activos ahora</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }
  /* Entradas de asistencia que se estan mostrando actualmente en Reportes:
     con busqueda activa, TODO el historial de ese alumno; sin busqueda, solo
     el mes operativo. Se usa tanto para pintar la tabla como para exportar,
     asi el CSV siempre coincide exactamente con lo que se ve en pantalla. */
  function reportEntries(){
    const q=reportsSearch.trim().toLowerCase();
    const baseEntries = q ? state.attendance : monthAttendance();
    return baseEntries.filter(entry=>{
      if(!q) return true;
      const student=getStudent(entry.studentId);
      return [student?.name,student?.code,student?.phone].filter(Boolean).join(" ").toLowerCase().includes(q);
    }).sort((a,b)=>new Date(b.at)-new Date(a.at));
  }
  function renderReports(){
    const entries = reportEntries();
    const byStudent=monthAttendance().reduce((map,entry)=>{ const student=getStudent(entry.studentId); const key=student?.id||entry.studentId; if(!map.has(key))map.set(key,{name:student?.name||"Alumno eliminado",code:student?.code||"",count:0}); map.get(key).count+=1; return map; },new Map());
    const ranking=[...byStudent.values()].sort((a,b)=>b.count-a.count).slice(0,8);
    const maxCount=ranking.length?ranking[0].count:1;
    const q=reportsSearch.trim();
    const bitacoraTitulo = q ? `Historial completo de ${escapeHtml(entries.length ? (getStudent(entries[0].studentId)?.name||"este alumno") : "ese alumno")}` : "Bitacora";
    const bitacoraSub = q ? `${entries.length} clase${entries.length===1?"":"s"} registrada${entries.length===1?"":"s"} en total, desde el primer dia.` : "Registro cronologico del mes operativo.";
    return `${renderHeader("Reportes de "+monthLabel(state.currentMonth),"Asistencia registrada, consumo de clases y exportacion de datos.")}
      <section class="panel" style="margin-bottom:16px">${panelHead("Balance de planes","Cuantos planes se vendieron o renovaron este mes, y cuantos tienes activos ahora mismo, por tipo.","chart")}${renderPlanSalesPanel()}</section>
      <section class="grid cols-2 reports-grid">
        <div class="panel">${panelHead("Top asistencia","Alumnos con mas clases en el mes.","trophy","warn")}${ranking.length?ranking.map((row,i)=>`<div class="report-row"><span class="rank">${i+1}</span><div class="rank-body"><strong>${escapeHtml(row.name)}</strong><small>${escapeHtml(row.code||"Sin codigo")}</small><div class="bar"><i style="width:${row.count/maxCount*100}%"></i></div></div><span class="badge info">${row.count} clase${row.count===1?"":"s"}</span></div>`).join(""):'<div class="empty">No hay asistencia en este mes.</div>'}</div>
        <div class="panel">${panelHead(bitacoraTitulo,bitacoraSub,"activity","",`<button class="btn" type="button" data-action="export-csv">${icon("download")}CSV asistencia</button>`)}<div class="toolbar filter-bar">${searchBox('data-filter="reports-search"',"Buscar alumno para ver su historial completo…",reportsSearch)}</div><div class="scroll-area">${renderAttendanceTable(entries)}</div></div>
      </section>`;
  }
  function renderAttendanceTable(entries){
    if(!entries.length) return '<div class="empty">Aun no hay clases registradas.</div>';
    return `<div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Alumno</th><th>Origen</th><th>Tipo</th><th><span class="sr-only">Anular</span></th></tr></thead><tbody>${entries.map(entry=>{ const student=getStudent(entry.studentId); const name=student?.name||"Alumno no encontrado"; const isQr=(entry.source==="qr"||entry.source==="qr-url"); return `<tr><td class="date-cell" style="color:var(--ink-2)">${escapeHtml(formatDateTime(entry.at))}</td><td><div class="student-name">${avatar(name,"sm")}<div><strong>${escapeHtml(name)}</strong><small>${escapeHtml(student?.code||entry.studentId)}</small></div></div></td><td><span class="chip">${icon(isQr?"scan":"edit")}${isQr?"QR":"Manual"}</span></td><td>${entry.extra?'<span class="badge warn">Extra</span>':'<span class="badge ok">Plan</span>'}</td><td class="actions"><button class='btn icon danger' title='Anular' aria-label='Anular registro' type='button' data-action='delete-attendance' data-att-id='${entry.id}'>${icon('x')}</button></td></tr>`; }).join("")}</tbody></table></div>`;
  }

  /* AJUSTES (sin campo de nombre de empresa) */
  function renderSettings(){
    if(!settingsUnlocked){
      return `${renderHeader("Ajustes","Ingresa la contrasena para acceder a esta seccion.")}
        <section class="panel" style="max-width:420px;margin:0 auto">
          ${panelHead("Acceso restringido","Los ajustes requieren verificacion adicional.","lock")}
          <form id="settingsAuthForm" style="display:grid;gap:14px">
            <label class="field">Contrasena de administrador<input name="settingsPass" type="password" autocomplete="current-password" placeholder="••••••••" autofocus></label>
            <button class="btn primary lg" type="submit">${icon("lock")}Verificar acceso</button>
          </form>
        </section>`;
    }
    const lastBackup=localStorage.getItem("acquacontrol.lastBackup");
    const lastBackupHtml=lastBackup?`<p class="note ok">${icon("check")} Ultimo respaldo descargado: ${escapeHtml(new Intl.DateTimeFormat("es-CO",{dateStyle:"medium",timeStyle:"short"}).format(new Date(lastBackup)))}</p>`:`<p class="note">Aun no has descargado ningun respaldo desde este dispositivo.</p>`;
    return `${renderHeader("Ajustes","Respaldos y utilidades de operacion.")}<section class="settings-grid"><div class="panel">${panelHead("Mes operativo","Cambia el mes activo para el control de clases.","calendar")}<form id="settingsForm" class="field-grid"><label class="field wide">Mes operativo<input name="currentMonth" type="month" value="${escapeHtml(state.currentMonth)}"></label><div class="split-actions wide"><button class="btn primary" type="submit">${icon("save")}Guardar mes</button></div></form></div><div class="panel">${panelHead("Respaldo completo del sistema","Descarga o restaura TODA la informacion: alumnos, planes, clases usadas, pagos, firmas, asistencia y eventos.","shield","ok")}<div class="toolbar"><button class="btn primary" type="button" data-action="export-json">${icon("download")}Descargar respaldo (Excel)</button><button class="btn outline" type="button" data-action="trigger-import">${icon("upload")}Restaurar desde respaldo</button><input class="file-input" id="importFile" type="file" accept=".xlsx,.json,application/json"></div>${lastBackupHtml}<div class="callout" style="margin-top:12px">${icon("info")}<span>Descarga un respaldo con frecuencia (por ejemplo cada semana) y guardalo en un lugar seguro (correo, Google Drive, USB). Si algun dia se pierden los datos, usa "Restaurar desde respaldo" con el ultimo archivo para dejar la app exactamente como estaba.</span></div><div class="panel-divider" style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap"><span style="font-size:.82rem;color:var(--muted)">Zona de peligro: borra la informacion de este navegador.</span><button class="btn danger" type="button" data-action="clear-data">${icon("trash")}Borrar datos</button></div></div></section>${renderWaiverEditor()}`;
  }

  /* MODAL DE LOGIN */
  function renderLoginModal(){
    return `<div class="modal-backdrop" role="dialog" aria-modal="true" aria-label="Acceso administrativo" id="loginModal" style="z-index:10000;align-items:center"><div class="login-card"><img class="login-logo" src="assets/logo-acqua-blanco.png" alt="ACQUA NATACION"><div class="modal-panel"><span class="eyebrow" style="color:var(--primary);opacity:1">Area administrativa</span><h3>Acceso al control</h3><p class="login-sub">Acceso exclusivo para administradores.</p><form id="loginForm" style="display:grid;gap:14px"><label class="field">Contrasena<input name="password" type="password" autocomplete="current-password" placeholder="Contrasena de administrador" autofocus></label><button id="btnLogin" class="btn primary lg block" type="submit">${icon("lock")} Ingresar</button></form></div><p class="login-foot">ACQUA NATACION · DESDE 2015 · CHIA</p></div></div><style>@keyframes shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-8px)}40%{transform:translateX(8px)}60%{transform:translateX(-5px)}80%{transform:translateX(5px)}}</style>`;
  }

  /* MODAL DE RENOVACION */
  function renderRenewalModal(){
    const student=getStudent(renewModalStudentId);
    if(!student) return "";
    const planBtns=Object.entries(PLAN_LABELS).filter(([value])=>value!=="anual"||student.planType==="anual").map(([value,label])=>`<button class="renewal-plan-btn ${value===student.planType?"current":""}" data-action="confirm-renewal-plan" data-plan="${escapeHtml(value)}"><span>${escapeHtml(label)}</span>${value===student.planType?'<span class="renewal-plan-current-badge">actual</span>':""}</button>`).join("");
    const riesgoHtml=(()=>{ const r=remainingClasses(student); const b=Number(student.bonusClasses||0); if(r<=0&&b<=0) return ""; return `<div class="callout danger" style="margin-bottom:14px;font-size:.8rem">${icon("alert")}<span><strong>Ojo:</strong> este alumno tiene ${r} clase(s) sin usar${b>0?` (${b} son de regalo/bonus)`:""}. "Mismo plan", "Plan diferente" y "Clase individual" reinician su plan a cero y las borran. Si quieres sumar o quitar clases al TOTAL sin perder lo que ya tiene, o corregir cuantas ya vio, usa las opciones de ajuste.</span></div>`; })();
    const planActual=escapeHtml(PLAN_LABELS[student.planType]||"Personalizado");
    const opt=(cls,action,ic,title,sub)=>`<button class="renewal-opt-btn ${cls}" data-action="${action}"><span class="renewal-opt-icon">${icon(ic)}</span><span><strong>${title}</strong><small>${sub}</small></span></button>`;
    const body=renewModalChangePlan
      ? `<p style="margin:0 0 14px;color:var(--muted);font-size:.88rem">Selecciona el nuevo plan:</p><div class="plan-pick-grid">${planBtns}</div><div class="split-actions"><button class="btn ghost" data-action="renewal-back-options">${icon("arrowLeft")}Volver</button></div>`
      : `<div class="renew-meta"><span>Plan actual: <strong>${planActual}</strong></span><span>Mes: <strong>${escapeHtml(monthLabel(state.currentMonth))}</strong></span><span>Restantes: <strong>${remainingClasses(student)} de ${planTotal(student)}</strong></span></div>${riesgoHtml}
         <div class="renew-group" style="margin-top:0">Renovar plan</div>
         <div style="display:grid;gap:8px">
           ${opt("success","confirm-renewal-same","refresh","Mismo plan",planActual+" · sin cambios")}
           ${opt("","show-renewal-change-plan","shuffle","Plan diferente","Elige otro plan para este mes")}
           ${opt("accent","confirm-renewal-individual","user","Clase individual","Solo 1 clase · practica suelta")}
         </div>
         <div class="renew-group">Ajustar sin reiniciar</div>
         <div style="display:grid;gap:8px">
           ${opt("gift","add-one-class","gift","Regalar 1 clase (sumar al plan)","Usa ESTE boton para regalar clases. Sube el total, nunca toca lo ya visto.")}
           ${opt("minus","remove-one-class","minus","Quitar 1 clase al plan","Reduce el TOTAL del plan (ej. deshacer un regalo). No toca lo ya visto.")}
           ${opt("tool","adjust-total-classes","sliders","Ajustar clases totales manualmente","NO es para regalar clases: recalcula las usadas para mantener fijo lo que le falta por ver.")}
           ${opt("eye","adjust-used-classes","eye","Corregir cuantas clases ya vio","Usa esto si el historial real no coincide (clase sin registrar o registrada de mas)")}
         </div>
         <div class="split-actions"><button class="btn ghost" data-action="close-renewal-modal">Cancelar</button></div>`;
    return `<div class="modal-backdrop" role="dialog" aria-modal="true" aria-label="Renovacion" style="z-index:9998"><div class="modal-panel" style="max-width:520px"><div class="modal-header"><div style="display:flex;gap:14px;align-items:center">${avatar(student.name)}<div><span class="eyebrow">Renovacion mensual</span><h3>${escapeHtml(student.name)}</h3></div></div><button class="btn icon" type="button" aria-label="Cerrar" data-action="close-renewal-modal">${icon("x")}</button></div><div class="modal-body">${body}</div></div></div>`;
  }

  /* OVERLAY DE CHECK-IN (escaneo exitoso) */
  async function showCheckinScreen(studentParam,source="qr"){
    // Traer la version mas fresca de este alumno ANTES de tocarlo, para no
    // pisar cambios recientes hechos desde otro dispositivo (ej. clases
    // bonus sumadas hace un momento).
    await refreshStudentFromCloud(studentParam.id);
    const student=getStudent(studentParam.id);
    if(!student){ setToast("Este alumno ya no existe (puede que se haya eliminado desde otro dispositivo)."); return; }
    // ── BLOQUEO: si ya no tiene clases disponibles, NO se registra el
    // ingreso ni se toca nada del plan. Solo tu, renovando manualmente
    // (o sumando clases) desde el modal de "Renovar", puede habilitarlo
    // de nuevo. Esto es distinto del caso "vencido por fecha con clases
    // sin usar", que sigue siendo solo un aviso (esas clases ya las pago
    // y no las ha gastado).
    if(remainingClasses(student)<=0){
      if((source==="qr"||source==="qr-url")) stopScanner(false);
      showBlockedCheckin(student);
      return;
    }
    // ── Registrar la clase inmediatamente, sin pedir confirmacion ──────────
    // IMPORTANTE: aqui NUNCA se debe renovar ni reiniciar el plan del alumno.
    // El plan de cada alumno es independiente y vence por fecha (inicio + dias
    // segun su tipo de plan), no por mes calendario. La renovacion SOLO ocurre
    // cuando el administrador la hace manualmente desde el boton "Renovar".
    const extra=false;
    student.classesUsed=Number(student.classesUsed||0)+1;
    student.updatedAt=new Date().toISOString();
    // El plan inicia a contar desde la primera clase tomada, sin importar si
    // tiene nivel u otros datos opcionales asignados.
    let arrancaHoy=false;
    if(!student.planStartedAt||inicioEsDeRenovacion(student)){
      const ini=inicioPlan(student);
      arrancaHoy=!ini;
      student.planStartedAt=(ini||new Date()).toISOString();
    }
    state.attendance.push({ id:uid("attendance"), studentId:student.id, at:new Date().toISOString(), monthKey:state.currentMonth, source, extra });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    const guardadoOk = await saveStateImmediate();
    if(!guardadoOk) debouncedCloudSave(); // reintentar en segundo plano si la confirmacion inmediata fallo (ej. sin señal)

    // Cuantas clases lleva hoy este alumno
    const clasesHoy=state.attendance.filter(e=>e.studentId===student.id&&dayKey(new Date(e.at))===dayKey(new Date())).length;
    const remainingNow=remainingClasses(student);
    const totalNow=planTotal(student);
    const usedNow=Number(student.classesUsed||0);

    // ── Mostrar confirmacion visual que se cierra sola ─────────────────────
    const existing=document.getElementById("checkin-overlay");
    if(existing) existing.remove();

    const remainColor=remainingNow<=0?"var(--danger)":remainingNow<=2?"var(--warning)":"var(--success)";
    const vencidoHoy=planVencido(student);
    const vencDate=calcularVencimiento(student);
    const diasParaVencerCk=vencDate?Math.ceil((vencDate-new Date())/(1000*60*60*24)):null;
    const vencColor=vencidoHoy?"var(--danger-ink)":(diasParaVencerCk!==null&&diasParaVencerCk<=5)?"var(--accent-dark)":"var(--ink)";
    const vencText=vencDate?new Intl.DateTimeFormat("es-CO",{day:"2-digit",month:"short",year:"numeric"}).format(vencDate):"Sin definir";
    let extraHtml="";
    if(vencidoHoy) extraHtml='<div class="checkin-warning danger">El plan de este alumno ya vencio por fecha — esta clase se registra fuera del periodo del plan.</div>';
    if(!guardadoOk) extraHtml+='<div class="checkin-warning danger">No se pudo confirmar en la nube (revisa la conexion). Se reintentara automaticamente — no cierres la app hasta que el indicador vuelva a verde.</div>';
    const avisarBtnHtml=(student.phone&&remainingNow<=1)
      ? `<button class="btn wa block" type="button" data-action="notify-student" data-id="${escapeHtml(student.id)}" style="margin-bottom:4px">${icon("message")}Avisar por WhatsApp que le quedan pocas clases</button>`
      : "";
    const C=2*Math.PI*52, frac=totalNow?Math.max(0,Math.min(1,remainingNow/totalNow)):0;

    const overlay=document.createElement("div");
    overlay.id="checkin-overlay";
    overlay.innerHTML=`
      <div class="checkin-modal" role="alertdialog" aria-label="Clase registrada">
        <div class="checkin-top">
          <div class="checkin-check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg></div>
          <h2 class="checkin-name">${escapeHtml(student.name)}</h2>
          <p class="checkin-code">${escapeHtml(student.code)} · CLASE REGISTRADA</p>
          <svg class="wave" viewBox="0 0 400 34" preserveAspectRatio="none"><path d="M0 18 C70 2 130 34 200 18 S330 2 400 18 V34 H0Z" fill="#fff"/></svg>
        </div>
        <div class="checkin-body">
          <div class="checkin-ring">
            <svg viewBox="0 0 120 120"><circle class="trk" cx="60" cy="60" r="52"/><circle class="val" cx="60" cy="60" r="52" stroke="${remainColor}" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${C.toFixed(1)}" data-target="${(C*(1-frac)).toFixed(1)}"/></svg>
            <div><b style="color:${remainColor}">${remainingNow<=0?"0":remainingNow}</b><small>restantes</small></div>
          </div>
          <div class="checkin-clases-hoy">${icon("check")}${clasesHoy === 1 ? "1 clase registrada hoy" : clasesHoy+" clases registradas hoy"}</div>
          <div class="checkin-stats">
            <div class="checkin-stat">Usadas del plan<strong>${usedNow} <span style="font-weight:600;color:var(--muted)">de ${totalNow}</span></strong></div>
            <div class="checkin-stat">Su plan vence<strong style="color:${vencColor}">${vencText}</strong></div>
          </div>
          ${arrancaHoy?`<div class="callout ok" style="margin-bottom:10px;text-align:left;font-size:.8rem">${icon("play")}<span><strong>Hoy empieza su plan.</strong> Tiene ${textoVigencia(student.planType)} desde hoy, hasta el ${vencText}.</span></div>`:""}
          ${extraHtml}
          ${avisarBtnHtml}
        </div>
        <div class="checkin-auto" title="Se cierra solo"><i></i></div>
      </div>`;
    document.body.appendChild(overlay);
    requestAnimationFrame(()=>requestAnimationFrame(()=>{ const v=overlay.querySelector(".checkin-ring .val"); if(v) v.style.strokeDashoffset=v.dataset.target; }));

    // Cerrar automaticamente tras 2.8s y reactivar camara
    const closeTimer=setTimeout(()=>{
      overlay.remove();
      if((source==="qr"||source==="qr-url")&&activeView==="checkin") startScanner();
    },4000);

    // Tambien cerrar si el usuario toca el overlay
    overlay.addEventListener("click",()=>{
      clearTimeout(closeTimer);
      overlay.remove();
      if((source==="qr"||source==="qr-url")&&activeView==="checkin") setTimeout(()=>startScanner(),200);
    });

    // El aviso de "pocas clases" ya NO se envia solo: queda como boton
    // opcional arriba (avisarBtnHtml). El check-in se registra normal
    // sin interrumpir con WhatsApp, sea cual sea el numero de clases.
    if(activeView==="students"||activeView==="dashboard") render();
  }

  /* PANTALLA DE BLOQUEO: se muestra cuando un alumno ya no tiene clases
     disponibles. NO registra nada (ni clase ni asistencia), y NO se cierra
     sola — hay que cerrarla o renovar a proposito, para asegurarse de que
     alguien realmente la vio antes de que el escaner siga funcionando. */
  function showBlockedCheckin(student){
    document.getElementById("checkin-overlay")?.remove();
    document.getElementById("checkin-blocked-overlay")?.remove();
    const total=planTotal(student);
    const overlay=document.createElement("div");
    overlay.id="checkin-blocked-overlay";
    overlay.innerHTML=`
      <div class="checkin-modal blocked" role="alertdialog" aria-label="Sin clases disponibles">
        <div class="checkin-top is-blocked">
          <div class="checkin-check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M7 7l10 10M17 7 7 17"/></svg></div>
          <h2 class="checkin-name">${escapeHtml(student.name)}</h2>
          <p class="checkin-code">${escapeHtml(student.code)} · INGRESO NO REGISTRADO</p>
          <svg class="wave" viewBox="0 0 400 34" preserveAspectRatio="none"><path d="M0 18 C70 2 130 34 200 18 S330 2 400 18 V34 H0Z" fill="#fff"/></svg>
        </div>
        <div class="checkin-body" style="margin-top:6px">
          <div class="checkin-warning danger" style="text-align:center;font-weight:700;font-size:.88rem">Sin clases disponibles (0 de ${total}).</div>
          <p style="font-size:.84rem;color:var(--muted);text-align:center;margin:4px 0 16px">Este alumno no puede tomar el servicio hasta que confirmes el pago y renueves su plan.</p>
        </div>
        <div class="checkin-actions">
          <button class="btn primary lg" type="button" data-action="renew-from-block" data-id="${escapeHtml(student.id)}">${icon("refresh")} Renovar ahora</button>
          <button class="btn ghost" type="button" data-action="close-blocked-checkin">Cerrar</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
  }


  /* PAGOS DE ALUMNOS */
  let payModalStudentId = null;
  let studentWaiverModalId = null;

  function renderPayModal(studentId){
    const student=getStudent(studentId);
    if(!student) return "";
    const pagos=(student.payments||[]).slice().reverse();
    const total=pagos.reduce((s,p)=>s+Number(p.valor||0),0);
    const cop=v=>new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0}).format(Number(v||0));
    return `<div class="modal-backdrop" role="dialog" aria-modal="true" aria-label="Pagos" id="payModal" style="z-index:9997"><div class="modal-panel" style="max-width:560px;margin:auto"><div class="modal-header"><div style="display:flex;gap:14px;align-items:center">${avatar(student.name)}<div><span class="eyebrow">Historial de pagos</span><h3>${escapeHtml(student.name)}</h3></div></div><button class="btn icon" type="button" aria-label="Cerrar" data-action="close-pay-modal">${icon("x")}</button></div><div class="modal-body">
      <form id="payForm" class="field-grid" style="background:var(--surface-soft);border:1px solid var(--line-opaque);border-radius:16px;padding:16px;margin-bottom:18px">
        <input type="hidden" name="studentId" value="${escapeHtml(studentId)}">
        <label class="field">Valor pagado (COP)<input name="valor" type="number" min="0" inputmode="numeric" placeholder="Ej: 150000" required></label>
        <label class="field">Metodo de pago<select name="metodo">
          <optgroup label="Digital"><option>Nequi</option><option>Daviplata</option><option>Llave</option><option>PSE</option></optgroup>
          <optgroup label="Tarjeta"><option>Tarjeta debito</option><option>Tarjeta credito</option><option>Datafono</option></optgroup>
          <optgroup label="Bancos"><option value="Bancolombia">Bancolombia</option><option value="BBVA">BBVA</option><option value="Banco de Bogota">Banco de Bogota</option><option value="Banco Popular">Banco Popular</option><option value="Banco Caja Social">Banco Caja Social</option><option value="Banco de Occidente">Banco de Occidente</option><option value="Banco AV Villas">Banco AV Villas</option><option value="Colpatria">Colpatria</option><option value="GNB Sudameris">GNB Sudameris</option><option value="Itau">Itau</option><option value="Citibank">Citibank</option><option value="Scotiabank">Scotiabank</option><option value="Falabella">Falabella</option><option value="Serfinanza">Serfinanza</option><option value="Coopcentral">Coopcentral</option><option value="Bancamia">Bancamia</option><option value="Banco Agrario">Banco Agrario</option><option value="Finandina">Finandina</option><option value="Nu Colombia">Nu Colombia</option></optgroup>
          <option>Efectivo</option><option>Otro</option>
        </select></label>
        <label class="field">Fecha<input name="fechaPago" type="date" value="${new Date().toISOString().slice(0,10)}" required></label>
        <label class="field">Hora<input name="horaPago" type="time" value="${new Date().toTimeString().slice(0,5)}"></label>
        <label class="field wide">Concepto (opcional)<input name="concepto" placeholder="Ej: Mensualidad mayo, Inscripcion..."></label>
        <div class="split-actions wide"><button class="btn primary" type="submit">${icon("dollar")}Registrar pago</button></div>
      </form>
      ${pagos.length?`<div class="sum-strip" style="margin:0 0 12px"><div><span>Total registrado</span><strong class="num" style="color:var(--success-ink)">${cop(total)}</strong></div><div><span>Pagos</span><strong class="num">${pagos.length}</strong></div></div>
      <div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Valor</th><th>Metodo</th><th>Concepto</th><th><span class="sr-only">Eliminar</span></th></tr></thead><tbody>
        ${pagos.map((p,i)=>`<tr><td class="date-cell">${escapeHtml(p.fecha+(p.hora?" "+p.hora:""))}</td><td class="num" style="font-weight:800;color:var(--success-ink)">${cop(p.valor)}</td><td>${escapeHtml(p.metodo||"")}</td><td style="font-size:.78rem">${escapeHtml(p.concepto||"-")}</td><td class="actions"><button class="btn icon danger" type="button" aria-label="Eliminar pago" data-action="delete-payment" data-student-id="${escapeHtml(studentId)}" data-pay-idx="${pagos.length-1-i}">${icon("trash")}</button></td></tr>`).join("")}
      </tbody></table></div>`:"<div class=\"empty\">Sin pagos registrados todavia.</div>"}
    </div></div></div>`;
  }

  async function savePayment(form){
    const fd=new FormData(form);
    const studentId=String(fd.get("studentId")||"");
    const student=getStudent(studentId);
    if(!student) return;
    const valor=Number(fd.get("valor")||0);
    if(!valor){ setToast("Ingresa un valor valido."); return; }
    if(!student.payments) student.payments=[];
    student.payments.push({
      id:uid("pay"),
      valor,
      metodo:String(fd.get("metodo")||""),
      fecha:String(fd.get("fechaPago")||""),
      hora:String(fd.get("horaPago")||""),
      concepto:String(fd.get("concepto")||"").trim(),
      registradoEn:new Date().toISOString()
    });
    student.updatedAt=new Date().toISOString();
    setToast("Pago registrado correctamente.");
    // Re-render el modal
    const existing=document.getElementById("payModal");
    if(existing){
      const div=document.createElement("div");
      div.innerHTML=renderPayModal(studentId);
      existing.replaceWith(div.firstElementChild);
    }
    const guardadoOk=await saveStateImmediate();
    if(!guardadoOk){ debouncedCloudSave(); setToast("Pago guardado localmente, pero no se pudo confirmar en la nube todavia. Se reintentara solo."); }
  }

  function deletePayment(studentId,idx){
    const student=getStudent(studentId);
    if(!student||!student.payments) return;
    if(!window.confirm("Eliminar este pago?")) return;
    const [removed]=student.payments.splice(idx,1);
    student.updatedAt=new Date().toISOString();
    saveState(); setToast("Pago eliminado.");
    if(removed?.id) deleteRow("payments","id",removed.id);
    const existing=document.getElementById("payModal");
    if(existing){
      const div=document.createElement("div");
      div.innerHTML=renderPayModal(studentId);
      existing.replaceWith(div.firstElementChild);
    }
  }


  function renderStudentWaiverModal(studentId){
    const student=getStudent(studentId);
    if(!student) return "";
    const existingWaiver=student.waiver;
    return `<div class="modal-backdrop" role="dialog" aria-modal="true" id="studentWaiverModal" style="z-index:9996"><div class="modal-panel" style="max-width:560px;margin:auto"><div class="modal-header"><div><img class="modal-logo" src="assets/logo-acqua-blanco.png" alt="ACQUA NATACION"><span class="eyebrow">Documento digital</span><h3>Firma de exoneracion</h3></div><button class="btn icon" type="button" aria-label="Cerrar" data-action="close-student-waiver">${icon("x")}</button></div>
      <div class="modal-body">
        <div class="waiver-copy">
          <p><strong>Estudiante:</strong> ${escapeHtml(student.name)}<br><strong>Documento:</strong> ${escapeHtml(student.documento||"No registrado")}</p>
          <p style="font-weight:700;margin:10px 0 6px;font-size:.92rem">DECLARACIONES Y AUTORIZACION</p>
          <ol>
            <li><strong>Conocimiento del Riesgo:</strong> Declaro conocer las condiciones de la actividad de natacion, que incluye medio acuatico, y autorizo la participacion del estudiante bajo la supervision de ACQUA NATACION.</li>
            <li><strong>Estado de Salud:</strong> Certifico que el estudiante se encuentra en buen estado de salud. Me comprometo a informar al equipo cualquier novedad medica, alergia o condicion relevante que pueda afectar su participacion.</li>
            <li><strong>Supervision y Normas:</strong> Acepto que la actividad se realizara bajo supervision de los entrenadores de ACQUA NATACION, y me aseguro de que el estudiante acatara todas las instrucciones y normas de seguridad.</li>
            <li><strong>Exoneracion:</strong> Acepto los riesgos naturales de la actividad deportiva acuatica y exonero de responsabilidad a ACQUA NATACION y su personal por incidentes o lesiones que ocurran durante las clases, siempre que la academia haya cumplido con las medidas de seguridad correspondientes.</li>
            <li><strong>Atencion Medica:</strong> En caso de emergencia, autorizo al personal a brindar primeros auxilios o a trasladar al estudiante al centro medico mas cercano.</li>
            <li><strong>Uso de Imagen:</strong> Autorizo a ACQUA NATACION a tomar fotografias y/o videos del estudiante durante las clases y actividades, y a publicarlos en sus redes sociales y demas medios promocionales, sin que esto genere ninguna contraprestacion economica.</li>
          </ol>
        </div>
        ${existingWaiver?`<div class="callout ok" style="margin-top:12px">${icon("check")}<span>Firmado por <strong>${escapeHtml(existingWaiver.name)}</strong> (${escapeHtml(existingWaiver.document)}) el ${escapeHtml(existingWaiver.signedAt)}</span></div>`:""}
        ${!existingWaiver?`<form id="studentWaiverForm" class="field-grid" style="margin-top:14px">
          <input type="hidden" name="studentId" value="${escapeHtml(studentId)}">
          <label class="field wide consent"><input name="accepted" type="checkbox" required>Confirmo que lei y acepto los terminos de exoneracion y responsabilidad.</label>
          <label class="field">Nombre de quien firma<input name="signatureName" required placeholder="Acudiente o estudiante mayor de edad"></label>
          <label class="field">Documento<input name="signatureDocument" required inputmode="numeric" placeholder="CC / TI / CE"></label>
          <div class="split-actions wide"><button class="btn" type="button" data-action="close-student-waiver">Cancelar</button><button class="btn primary" type="submit">${icon("signature")}Firmar documento</button></div>
        </form>`:"<div style='margin-top:12px;text-align:center'><button class='btn ghost' type='button' data-action='reset-student-waiver' data-id='"+studentId+"'>Restablecer firma</button></div>"}
      </div></div></div>`;
  }

  function saveStudentWaiver(form){
    const fd=new FormData(form);
    const studentId=String(fd.get("studentId")||"");
    const student=getStudent(studentId);
    if(!student){ setToast("No encontre al alumno."); return; }
    student.waiver={
      name:String(fd.get("signatureName")||"").trim(),
      document:String(fd.get("signatureDocument")||"").trim(),
      signedAt:new Intl.DateTimeFormat("es-CO",{dateStyle:"medium",timeStyle:"short"}).format(new Date())
    };
    student.updatedAt=new Date().toISOString();
    saveState(); setToast("Firma guardada correctamente.");
    document.getElementById("studentWaiverModal")?.remove();
  }

  /* CRUD DE ALUMNOS */

  async function saveStudentPublic(form){
    const fd=new FormData(form);
    const name=String(fd.get("name")||"").trim();
    const phone=String(fd.get("phone")||"").trim();
    if(!name){ setToast("El nombre del alumno es obligatorio."); return; }
    if(!phone){ setToast("El telefono es obligatorio."); return; }
    const nameNorm=name.toLowerCase().replace(/\s+/g," ");
    const duplicado=state.students.find(s=>s.name.toLowerCase().replace(/\s+/g," ")===nameNorm);
    if(duplicado){ setToast("Ya existe un alumno con el nombre \""+duplicado.name+"\" ("+duplicado.code+"). Verifica antes de registrar."); return; }
    const planType=String(fd.get("planType")||"4");
    const customClasses=Math.max(1,Number(fd.get("customClasses")||1));
    const now=new Date().toISOString();
    const code=await nextStudentCodeFresh();
    const student={ id:uid("student"), code, name, category:String(fd.get("category")||"Infantil"), birthdate:String(fd.get("birthdate")||"").trim(), documento:String(fd.get("documento")||"").trim(), responsible:String(fd.get("responsible")||"").trim(), phoneAcudiente:String(fd.get("phoneAcudiente")||"").trim(), phone, email:String(fd.get("email")||"").trim(), planType, customClasses:planType==="custom"?customClasses:"", status:"active", talla:String(fd.get("talla")||"").trim(),peso:String(fd.get("peso")||"").trim(),sangre:String(fd.get("sangre")||"").trim(),eps:String(fd.get("eps")||"").trim(),camiseta:String(fd.get("camiseta")||"").trim(),nivel:String(fd.get("nivel")||""),notes:String(fd.get("notes")||"").trim(), monthKey:state.currentMonth, classesUsed:0, createdAt:now, updatedAt:now };
    state.students.push(student);
    const submitBtn=form.querySelector('button[type="submit"]');
    if(submitBtn){ submitBtn.disabled=true; submitBtn.dataset.origText=submitBtn.innerHTML; submitBtn.textContent="Guardando..."; }
    const guardadoOk=await saveStateImmediate();
    if(!guardadoOk){
      // No se pudo confirmar en la nube: se deja en cola para reintentar,
      // pero se avisa claramente en vez de mostrar un "exito" falso.
      debouncedCloudSave();
      if(submitBtn){ submitBtn.disabled=false; submitBtn.innerHTML=submitBtn.dataset.origText||"Registrar alumno"; }
      setToast("No se pudo confirmar el registro en la nube (revisa tu conexion). Se reintentara solo, pero verifica en unos minutos que "+name+" ya aparezca en Alumnos.");
      return;
    }
    if(submitBtn){ submitBtn.disabled=false; submitBtn.innerHTML=submitBtn.dataset.origText||"Registrar alumno"; }
    // Mostrar confirmacion y limpiar formulario
    form.reset();
    const cf=form.querySelector("[data-custom-classes]");
    if(cf) cf.hidden=true;
    // Overlay de confirmacion - el botón recarga la vista limpia
    const overlayConf=document.createElement("div");
    overlayConf.id="confirm-overlay";
    overlayConf.innerHTML=`<div class="confirm-layer"><div class="checkin-modal"><div class="checkin-top"><div class="checkin-check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg></div><h2 class="checkin-name">Alumno registrado</h2><p class="checkin-code">${escapeHtml(name)}</p><svg class="wave" viewBox="0 0 400 34" preserveAspectRatio="none"><path d="M0 18 C70 2 130 34 200 18 S330 2 400 18 V34 H0Z" fill="#fff"/></svg></div><div class="checkin-body" style="margin-top:8px"><p style="font-size:.9rem;color:var(--muted);margin:0 0 6px">Codigo de carnet asignado</p><p style="font-family:var(--font-display);font-size:2rem;font-weight:700;letter-spacing:.04em;color:var(--navy-900);margin:0 0 18px">${escapeHtml(code)}</p></div><div class="checkin-actions" style="display:grid;gap:10px"><button class="btn wa lg" type="button" data-action="send-carnet-whatsapp" data-id="${escapeHtml(student.id)}">${icon("message")}Enviar carnet por WhatsApp</button><button id="btnRegisterAnother" class="btn primary lg" type="button">${icon("userPlus")}Registrar otro alumno</button></div></div></div>`;
    document.body.appendChild(overlayConf);
    document.getElementById("btnRegisterAnother").onclick=function(){
      document.getElementById("confirm-overlay")?.remove();
    };
  }

  async function saveStudent(form){
    const fd=new FormData(form);
    const studentId=fd.get("studentId");
    const name=String(fd.get("name")||"").trim();
    if(!name){ setToast("El nombre del alumno es obligatorio."); return; }
    const planType=String(fd.get("planType")||"4");
    const customClasses=Math.max(1,Number(fd.get("customClasses")||1));
    const now=new Date().toISOString();
    const existing=studentId?getStudent(studentId):null;
    // Solo verificar duplicado si es un alumno NUEVO (no al editar)
    if(!existing){
      const nameNorm2=name.toLowerCase().replace(/\s+/g," ");
      const dup2=state.students.find(s=>s.name.toLowerCase().replace(/\s+/g," ")===nameNorm2);
      if(dup2){ setToast("Ya existe un alumno con el nombre \""+dup2.name+"\" ("+dup2.code+"). Verifica antes de guardar."); return; }
    }
    const code = existing?.code || await nextStudentCodeFresh();
    const student={ ...(existing||{}), id:existing?.id||uid("student"), code, name, category:String(fd.get("category")||"Infantil"), birthdate:String(fd.get("birthdate")||"").trim(), documento:String(fd.get("documento")||"").trim(), responsible:String(fd.get("responsible")||"").trim(), phoneAcudiente:String(fd.get("phoneAcudiente")||"").trim(), phone:String(fd.get("phone")||"").trim(), email:String(fd.get("email")||"").trim(),talla:String(fd.get("talla")||"").trim(),peso:String(fd.get("peso")||"").trim(),sangre:String(fd.get("sangre")||"").trim(),eps:String(fd.get("eps")||"").trim(),camiseta:String(fd.get("camiseta")||"").trim(),planType, customClasses:planType==="custom"?customClasses:"", status:String(fd.get("status")||"active"), nivel:String(fd.get("nivel")||""), notes:String(fd.get("notes")||"").trim(), monthKey:existing?.monthKey||state.currentMonth, classesUsed:Number(existing?.classesUsed||0),
      // El plan NUNCA inicia solo por crear/editar el alumno: solo se toca si
      // el administrador escribe una fecha manual en "Fecha de inicio del plan"
      // (para corregir un dato); de lo contrario se respeta lo que ya tenia,
      // o queda vacio hasta que tome su primera clase.
      planStartedAt: (()=>{ const v=fd.has("planStartedAt")?String(fd.get("planStartedAt")||"").trim():""; if(!v) return existing?.planStartedAt||null; if(existing&&(v===localDateStr(existing.planStartedAt)||(()=>{ const ini=inicioPlan(existing); return ini&&v===localDateStr(ini.toISOString()); })())) return existing.planStartedAt||null; return new Date(v+"T00:00:00").toISOString(); })(),
      createdAt:existing?.createdAt||now, updatedAt:now };
    if(existing){ state.students=state.students.map(s=>s.id===existing.id?student:s); setToast("Alumno actualizado."); }
    else{ state.students.push(student); setToast(`Alumno creado con codigo ${student.code}.`); }
    editingStudentId=null; studentsFormVisible=false;
    render();
    const guardadoOk=await saveStateImmediate();
    if(!guardadoOk){ debouncedCloudSave(); setToast("Guardado localmente, pero no se pudo confirmar en la nube todavia (revisa tu conexion). Se reintentara solo."); }
  }

  function renewStudent(studentId,silent=false,newPlanType=null){
    const student=getStudent(studentId);
    if(!student) return;
    if(newPlanType) student.planType=newPlanType;
    student.monthKey=state.currentMonth; student.classesUsed=0; student.bonusClasses=0; student.planStartedAt=null; // el plan arranca con la primera clase
    student.lastRenewedAt=new Date().toISOString(); student.updatedAt=student.lastRenewedAt;
    if(!silent) setToast(`${student.name} renovado para ${monthLabel(state.currentMonth)}.`);
  }
  /* Antes de renovar (lo que SIEMPRE reinicia clases usadas, clases de regalo
     y la fecha de inicio del plan a cero), avisa si el alumno todavia tiene
     algo que perderia. Devuelve true si es seguro continuar. */
  function confirmRenewalDataLoss(student){
    if(!student) return true;
    const remaining=remainingClasses(student);
    const bonus=Number(student.bonusClasses||0);
    if(remaining<=0 && bonus<=0) return true;
    let msg=`${student.name} todavia tiene ${remaining} clase(s) sin usar`;
    if(bonus>0) msg+=` (de las cuales ${bonus} son de regalo/bonus que le sumaste)`;
    msg+=`.\n\nRenovar reinicia su plan por completo: las clases usadas vuelven a 0, las clases de regalo se BORRAN y la fecha de inicio del plan se reinicia a hoy.\n\n¿Seguro que quieres continuar? Si solo querias sumarle mas clases, cancela y usa "Sumar 1 clase" en vez de renovar.`;
    return window.confirm(msg);
  }
  function renewAllActive(){
    const anualesVigentes=state.students.filter(s=>s.status==="active"&&esPlanAnual(s)&&isRenewed(s)).length;
    const active=state.students.filter(s=>s.status==="active"&&!(esPlanAnual(s)&&isRenewed(s)));
    if(!active.length){ setToast("No hay alumnos activos para renovar."); return; }
    const conDatos=active.filter(s=>remainingClasses(s)>0||Number(s.bonusClasses||0)>0);
    let msg=`Vas a renovar ${active.length} alumno(s) activos para ${monthLabel(state.currentMonth)}.\n\n`;
    if(anualesVigentes) msg+=`Los ${anualesVigentes} alumno(s) con plan anual vigente NO se tocan: siguen descontando de las clases de su año.\n\n`;
    if(conDatos.length){
      msg+=`⚠️ ATENCION: ${conDatos.length} de ellos todavia tienen clases sin usar y/o clases de regalo sumadas, aunque su plan no haya vencido por fecha. Renovar se las va a BORRAR y a reiniciar su plan a cero.\n\n`;
      msg+=`Alumnos afectados: ${conDatos.slice(0,15).map(s=>s.name).join(", ")}${conDatos.length>15?` y ${conDatos.length-15} mas`:""}.\n\n`;
    }
    msg+=`¿Seguro que quieres continuar?`;
    const ok=window.confirm(msg);
    if(!ok) return;
    active.forEach(s=>renewStudent(s.id,true));
    saveState(); setToast("Renovacion mensual completada."); render();
  }
  function registerClass(studentId,source="manual"){
    const student=getStudent(studentId);
    if(!student){ setToast("No encontre ese alumno."); return false; }
    if(student.status!=="active"){ setToast("El alumno esta pausado."); return false; }
    showCheckinScreen(student,source); return true;
  }
  function deleteAttendance(attId){
    const att=state.attendance.find(a=>a.id===attId);
    if(!att){ setToast("No encontre ese registro."); return; }
    const student=getStudent(att.studentId);
    if(!window.confirm("Anular la clase de "+(student?.name||"este alumno")+"? Se devolvera 1 clase a su plan.")) return;
    state.attendance=state.attendance.filter(a=>a.id!==attId);
    if(student && Number(student.classesUsed||0)>0){
      student.classesUsed=Number(student.classesUsed)-1;
      student.updatedAt=new Date().toISOString();
    }
    saveState(); setToast("Clase anulada correctamente."); render();
    deleteRow("attendance","id",attId);
  }
  function notifyWhatsApp(student){
    if(!student?.phone){ setToast("Este alumno no tiene telefono guardado."); return; }
    const rawPh=String(student.phone).trim();
    const hasPl=rawPh.startsWith("+");
    const digits=rawPh.replace(/\D/g,"");
    if(!digits){ setToast("El telefono del alumno no parece valido."); return; }
    let phone;
    if(hasPl||digits.length>10){ phone=digits; }
    else if(digits.length===10&&digits.startsWith("3")){ phone="57"+digits; }
    else { phone=digits; }
    const remaining=remainingClasses(student);
    let message=`Hola ${student.name}. Te escribimos de ${DEFAULT_BUSINESS}. `;
    if(remaining<=0) message+="Queremos recordarte que tu plan se ha culminado. Te esperamos para renovarlo y continuar con nosotros. Muchas gracias!";
    else { const v=calcularVencimiento(student); message+="Queremos recordarte que tu plan esta proximo a vencer"+(v?" (vence el "+new Intl.DateTimeFormat("es-CO",{day:"numeric",month:"long"}).format(v)+")":"")+". Recuerda que cada plan tiene "+textoVigencia(student.planType)+" de vigencia desde la primera clase. No olvides renovarlo a tiempo para seguir nadando."; }
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`,"_blank","noopener");
  }
  function notifyVencimiento(student){
    if(!student){ setToast("No encontre al alumno."); return; }
    const v = calcularVencimiento(student);
    const r = remainingClasses(student);
    const rawPhone = String(student.phone||"").trim();
    if(!rawPhone){ setToast("Este alumno no tiene telefono guardado."); return; }
    const hasPlus = rawPhone.startsWith("+");
    const digits = rawPhone.replace(/\D/g,"");
    if(!digits){ setToast("El telefono del alumno no parece valido."); return; }
    let phone;
    if(hasPlus || digits.length > 10){ phone = digits; }
    else if(digits.length===10&&digits.startsWith("3")){ phone = "57"+digits; }
    else { phone = digits; }
    const diasRestantes = v ? Math.ceil((v - new Date())/(1000*60*60*24)) : null;
    let msg = "Hola "+student.name.split(" ")[0]+"! Te escribimos de ACQUA NATACION. ";
    if(diasRestantes!==null && diasRestantes<=0){
      msg += "Esperamos que estes muy bien. Queremos recordarte que tu plan esta proximo a su fin. Comunicate con nosotros para renovarlo y seguir nadando.";
    } else if(diasRestantes!==null && diasRestantes<=3){
      msg += "Tu plan vence en "+diasRestantes+" dia(s). Te invitamos a agendar pronto o comunicarte con nosotros para renovarlo.";
    } else {
      msg += "Te recordamos que tu plan vence"+(v?" el "+new Intl.DateTimeFormat("es-CO",{day:"numeric",month:"long"}).format(v):" pronto")+" y aun tienes "+r+" clase(s) por usar. Recuerda que cada plan tiene "+textoVigencia(student.planType)+" de vigencia desde la primera clase. No olvides renovarlo a tiempo para seguir nadando.";
    }
    window.open("https://wa.me/"+phone+"?text="+encodeURIComponent(msg),"_blank","noopener");
  }
  function deleteStudent(studentId){
    const student=getStudent(studentId);
    if(!student) return;
    if(!window.confirm(`Eliminar a ${student.name} definitivamente?\nEsto borrara su historial de asistencia y no se puede deshacer.`)) return;
    state.students=state.students.filter(s=>s.id!==studentId);
    state.attendance=state.attendance.filter(a=>a.studentId!==studentId);
    saveState(); setToast("Alumno eliminado definitivamente."); render();
    deleteRow("students","id",studentId); // ON DELETE CASCADE limpia pagos/asistencia/inscripciones relacionadas
  }
  function pauseStudent(studentId){ const student=getStudent(studentId); if(!student)return; if(!window.confirm(`Pausar a ${student.name}? No se borrara su historial.`))return; student.status="paused"; student.updatedAt=new Date().toISOString(); saveState(); setToast("Alumno pausado."); render(); }
  function activateStudent(studentId){ const student=getStudent(studentId); if(!student)return; student.status="active"; student.updatedAt=new Date().toISOString(); saveState(); setToast("Alumno activado."); render(); }

  /* QR */
  function qrPayload(student){ return `https://app-acqua.netlify.app/?checkin=${encodeURIComponent(student.code)}`; }
  function findByQrPayload(payload){
    const clean=String(payload||"").trim();
    let code=clean;
    if(clean.toUpperCase().startsWith("AQUA:")) code=clean.slice(5);
    if(clean.toUpperCase().startsWith("SWIM:")) code=clean.slice(5);
    const urlMatch=clean.match(/[?&]checkin=([^&]+)/i);
    if(urlMatch) code=decodeURIComponent(urlMatch[1]);
    return state.students.find(s=>s.id===code||String(s.code||"").toUpperCase()===code.toUpperCase());
  }
  function handleQrPayload(payload){
    const now=Date.now();
    if(payload===scanner.lastPayload&&now-scanner.lastPayloadAt<4500) return;
    scanner.lastPayload=payload; scanner.lastPayloadAt=now;
    const student=findByQrPayload(payload);
    if(!student){ setToast("QR leido, pero no corresponde a ningun alumno registrado."); return; }
    stopScanner(false);
    showCheckinScreen(student,"qr");
  }

  /* ESCANER DE CAMARA */
  async function startScanner(){
    const video=document.querySelector("#scanVideo");
    const placeholder=document.querySelector("#scannerPlaceholder");
    const crosshair=document.querySelector("#scanCrosshair");
    if(!video) return;

    // Detener cualquier stream previo
    stopScanner(false);

    // Configurar detector de QR
    const hasBarcodeDetector="BarcodeDetector" in window;
    if(hasBarcodeDetector){
      try{
        const formats=await BarcodeDetector.getSupportedFormats();
        if(formats.includes("qr_code")){ scanner.detector=new BarcodeDetector({formats:["qr_code"]}); useJsQr=false; }
        else { useJsQr=true; }
      } catch(e){ useJsQr=true; }
    } else { useJsQr=true; }

    // Abrir camara — primero intenta trasera, luego cualquiera
    try {
      let stream;
      try {
        stream=await navigator.mediaDevices.getUserMedia({ video:{facingMode:"environment"}, audio:false });
      } catch(e1) {
        stream=await navigator.mediaDevices.getUserMedia({ video:true, audio:false });
      }
      scanner.stream=stream;
      video.srcObject=stream;
      await video.play().catch(()=>{});
      if(placeholder) placeholder.hidden=true;
      if(crosshair) crosshair.hidden=false;
      scanner.timer=window.setInterval(scanFrame,280);
      setToast("Camara activa — apunta al QR del carnet.");
    } catch(error){
      console.error("startScanner:",error);
      const esPermisos=error.name==="NotAllowedError"||error.name==="PermissionDeniedError";
      const msg=esPermisos
        ? "Permiso de camara denegado. Toca el icono de candado en tu navegador, activa Camara y recarga la pagina."
        : "No se pudo abrir la camara ("+error.name+"). Verifica que ningun otra app la este usando.";
      const ph=document.querySelector("#scannerPlaceholder");
      if(ph){
        ph.hidden=false;
        ph.innerHTML=`<span class="icon-badge danger" style="width:60px;height:60px;border-radius:20px;background:rgba(229,72,77,.2);color:#FECACA">${icon("camera")}</span><p style="font-weight:800;color:#fff">No se pudo abrir la camara</p><p style="font-size:.82rem;color:rgba(255,255,255,.75)">${escapeHtml(msg)}</p><button class="btn primary" type="button" data-action="start-scanner" style="background:#fff;color:var(--navy-900)">${icon("refresh")}Intentar de nuevo</button>`;
      }
    }
  }
  async function scanFrame(){
    const video=document.querySelector("#scanVideo");
    if(!video||scanner.busy||video.readyState<2) return;
    scanner.busy=true;
    try {
      if(useJsQr&&typeof jsQR!=="undefined"){
        const canvas=document.createElement("canvas");
        canvas.width=video.videoWidth||640; canvas.height=video.videoHeight||480;
        const ctx=canvas.getContext("2d");
        ctx.drawImage(video,0,0,canvas.width,canvas.height);
        const imageData=ctx.getImageData(0,0,canvas.width,canvas.height);
        const code=jsQR(imageData.data,imageData.width,imageData.height,{inversionAttempts:"dontInvert"});
        if(code) handleQrPayload(code.data);
      } else if(scanner.detector){
        const codes=await scanner.detector.detect(video);
        if(codes.length) handleQrPayload(codes[0].rawValue);
      }
    } catch(e){ console.error(e); }
    finally { scanner.busy=false; }
  }
  function stopScanner(showToast=true){
    if(scanner.timer){ window.clearInterval(scanner.timer); scanner.timer=null; }
    if(scanner.stream){ scanner.stream.getTracks().forEach(t=>t.stop()); scanner.stream=null; }
    scanner.detector=null;
    const video=document.querySelector("#scanVideo");
    const placeholder=document.querySelector("#scannerPlaceholder");
    const crosshair=document.querySelector("#scanCrosshair");
    if(video) video.srcObject=null;
    if(placeholder) placeholder.hidden=false;
    if(crosshair) crosshair.hidden=true;
    if(showToast) setToast("Lector QR detenido.");
  }

  /* CRUD EVENTOS */
  function getEvent(eventId){ return state.events.find(e=>e.id===eventId); }
  /* Devuelve nombre/telefono/subtitulo de un inscrito, sea alumno o persona particular */
  function attendeeDisplay(attendee){
    if(attendee.studentId){
      const s=getStudent(attendee.studentId);
      return { name:s?s.name:"Alumno eliminado", phone:s?s.phone||"":"", sub:s?s.code:"", isGuest:false };
    }
    const edad=attendee.guestAge?("Edad: "+attendee.guestAge):"";
    return { name:attendee.guestName||"Particular", phone:attendee.guestPhone||"", sub:edad, isGuest:true };
  }
  /*PLANTILLAS_START*/
  const PLANTILLAS_ORIGINALES = {"travesia": "# Exoneración de Responsabilidad y Condiciones de Participación – {{nombre}}\n\n**ACQUA NATACIÓN Escuela de Natación** (Chía, Cundinamarca) invita a nadadores de la escuela y a participantes externos a la **{{nombre}}**, que se realizará el {{fecha:día por confirmar}} en {{lugar:lugar por confirmar}}. Este documento explica en qué consiste el evento, qué incluye la inscripción y bajo qué condiciones participa cada persona. Léalo completo antes de inscribirse y firmar.\n\n## 1. Sobre el evento\n- **Naturaleza:** no es una competencia, es una travesía. No hay clasificación, premios por posición ni cronometraje oficial; el objetivo es completar el recorrido a ritmo propio, de forma segura y en compañía.\n- **Fecha y lugar:** {{fecha:por confirmar}}, {{lugar:por confirmar}}. Punto de encuentro y recorrido: serán confirmados por la organización.\n- **Horario exclusivo:** el espacio estará reservado para ACQUA NATACIÓN de {{horario}}, lo que permite realizar la travesía sin tráfico de otros usuarios.\n- **Organizador:** {{organizador}}.\n- **Valor de la inscripción:** {{valor}}.\n\n## 2. Qué incluye la inscripción\n{{incluye}}\n\n## 3. Condiciones de participación y exoneración de responsabilidad\n**3.1 Requisitos del participante.** Saber nadar en aguas abiertas y estar en condiciones físicas y de salud aptas para una travesía en mar. Cada participante es responsable de conocer su estado de salud y de consultar a su médico antes del evento. Debe informar a la organización cualquier condición médica relevante, seguir las indicaciones de salvavidas, buzos y personal de apoyo, y detener o abandonar la travesía cuando se le indique.\n**3.2 Menores de edad.** Los menores solo participan con autorización escrita de su padre, madre o representante legal, quien firma este documento en su nombre.\n**3.3 Naturaleza y riesgos de la actividad.** El participante entiende que nadar en mar abierto implica riesgos inherentes, entre ellos: oleaje y corrientes, cambios de clima, fatiga o agotamiento, hipotermia, calambres, picaduras o contacto con fauna marina, deshidratación, lesiones, y problemas de salud súbitos. Aun con las medidas de seguridad descritas, estos riesgos no pueden eliminarse por completo. El participante los conoce y los asume voluntariamente.\n**3.4 Medidas de seguridad.** La organización dispone de {{seguridad:personal capacitado y de las medidas de seguridad y cobertura propias del evento, que se informan en la sección 2 cuando aplican}}. Estas medidas buscan reducir los riesgos, pero no garantizan que no ocurran incidentes. El alcance y las condiciones de la póliza se rigen por el contrato con la aseguradora.\n**3.5 Cancelación, suspensión o modificación por causas ajenas a la organización.** La organización, de acuerdo con las autoridades y los equipos de seguridad, puede suspender, aplazar, acortar o modificar el recorrido o el horario cuando considere que hay riesgo para los participantes. Esto incluye tormenta eléctrica, mal estado del mar, sismo o falla geológica, avistamiento de tiburones u otra fauna peligrosa, orden de autoridad competente, o cualquier hecho de fuerza mayor o caso fortuito.\n**3.5.1 Política de no devolución.** Si el evento se suspende, se aplaza, se acorta o se cancela por las causas anteriores, **no habrá devolución del dinero de la inscripción**. Tampoco se devuelve el valor por no asistencia, retiro voluntario o abandono durante la travesía. La organización procurará, cuando sea posible, reprogramar la actividad o entregar el kit y la medalla a quienes se hayan inscrito.\n**3.6 Exoneración de responsabilidad.** Con la firma de este documento, el participante (o su representante legal, si es menor) declara que participa de manera libre y voluntaria, y exonera a ACQUA NATACIÓN, a sus administradores, instructores, empleados, colaboradores y patrocinadores de responsabilidad por daños, lesiones, pérdidas o perjuicios que se deriven de los riesgos inherentes descritos en este documento, o de su propia imprudencia o incumplimiento de las instrucciones de seguridad. Esta exoneración se otorga en la medida permitida por la ley colombiana y no cubre los daños causados por dolo o culpa grave de la organización.\n**3.7 Pertenencias personales.** Cada participante cuida sus objetos personales. La organización no se hace responsable por pérdida o daño de elementos no entregados formalmente en custodia.\n**3.8 Uso de imagen.** El participante autoriza el uso de fotografías y videos del evento tomados por la organización, con fines informativos y promocionales de ACQUA NATACIÓN, sin compensación económica. Si no lo autoriza, debe indicarlo por escrito antes del evento.\n**3.9 Tratamiento de datos personales.** Los datos suministrados en la inscripción se tratan conforme a la Ley 1581 de 2012 y a la política de tratamiento de datos de ACQUA NATACIÓN, para la gestión del evento, la póliza, la comunicación con los participantes y la entrega del certificado.\n\n---declaracion---\nDeclaro que he leído y entendido este documento, que conozco qué incluye el evento y los riesgos de nadar en mar abierto, que mi participación es voluntaria y que acepto las condiciones, la política de no devolución y la exoneración de responsabilidad aquí descritas.\n", "general": "# Exoneración de Responsabilidad y Condiciones de Participación – Eventos ACQUA NATACIÓN\n\n**ACQUA NATACIÓN Escuela de Natación** (Chía, Cundinamarca) organiza eventos acuáticos para su comunidad y para participantes externos. Este documento explica en qué consiste cada evento, qué incluye la inscripción y bajo qué condiciones participa cada persona. Léalo completo antes de inscribirse y firmar.\n\n## 1. Datos del evento\n| Nombre del evento | {{nombre}} |\n| Fecha y horario | {{fecha_horario:Por confirmar}} |\n| Lugar | {{lugar:Por confirmar}} |\n| Tipo de actividad | {{tipo}} |\n| ¿Es competitivo? | {{competitivo}} |\n| Organizador | {{organizador}} |\n| Valor de la inscripción | {{valor:Por confirmar}} |\n\n## 2. Qué incluye la inscripción\n{{incluye}}\n\n## 3. Condiciones de participación y exoneración de responsabilidad\n**3.1 Requisitos del participante.** Estar en condiciones físicas y de salud aptas para la actividad y contar con el nivel de natación que el evento requiere. Cada participante es responsable de conocer su estado de salud y de consultar a su médico antes del evento. Debe informar a la organización cualquier condición médica relevante, seguir las indicaciones del personal de la escuela y de seguridad, y detener la actividad cuando se le indique.\n**3.2 Menores de edad.** Los menores solo participan con autorización escrita de su padre, madre o representante legal, quien firma este documento en su nombre. Los menores deben estar bajo supervisión de un adulto responsable según lo indique la organización.\n**3.3 Naturaleza y riesgos de la actividad.** El participante entiende que las actividades acuáticas implican riesgos inherentes, entre ellos: fatiga o agotamiento, calambres, resbalones en áreas húmedas, lesiones, deshidratación, cambios de clima, problemas de salud súbitos y, en aguas abiertas, oleaje, corrientes y contacto con fauna. Aun con las medidas de seguridad dispuestas, estos riesgos no pueden eliminarse por completo. El participante los conoce y los asume voluntariamente.\n**3.4 Medidas de seguridad.** La organización dispone de personal capacitado y de las medidas de seguridad y cobertura propias de cada evento, que se informan en la sección 2 cuando aplican. Estas medidas buscan reducir los riesgos, pero no garantizan que no ocurran incidentes.\n**3.5 Suspensión, aplazamiento o modificación.** La organización puede suspender, aplazar, acortar o modificar el evento cuando considere que hay riesgo para los participantes, por ejemplo por mal clima, tormenta eléctrica, condiciones del agua, sismo, orden de autoridad competente, o cualquier hecho de fuerza mayor o caso fortuito.\n**3.6 Política de no devolución.** Si el evento se suspende, se aplaza, se acorta o se cancela por las causas anteriores, o si el participante no asiste o se retira, **no habrá devolución del dinero de la inscripción**. Cuando sea posible, la organización procurará reprogramar la actividad.\n**3.7 Exoneración de responsabilidad.** Con la firma de este documento, el participante (o su representante legal, si es menor) declara que participa de manera libre y voluntaria, y exonera a ACQUA NATACIÓN, a sus administradores, instructores, empleados, colaboradores y patrocinadores de responsabilidad por daños, lesiones, pérdidas o perjuicios que se deriven de los riesgos inherentes descritos en este documento, o de su propia imprudencia o incumplimiento de las instrucciones de seguridad. Esta exoneración se otorga en la medida permitida por la ley colombiana y no cubre los daños causados por dolo o culpa grave de la organización.\n**3.8 Pertenencias personales.** Cada participante cuida sus objetos personales. La organización no se hace responsable por pérdida o daño de elementos no entregados formalmente en custodia.\n**3.9 Uso de imagen.** El participante autoriza el uso de fotografías y videos del evento tomados por la organización, con fines informativos y promocionales de ACQUA NATACIÓN, sin compensación económica. Si no lo autoriza, debe indicarlo por escrito antes del evento.\n**3.10 Tratamiento de datos personales.** Los datos suministrados en la inscripción se tratan conforme a la Ley 1581 de 2012 y a la política de tratamiento de datos de ACQUA NATACIÓN, para la gestión del evento, la comunicación con los participantes y la entrega de reconocimientos.\n\n---declaracion---\nDeclaro que he leído y entendido este documento, que conozco qué incluye el evento y los riesgos de la actividad, que mi participación es voluntaria y que acepto las condiciones, la política de no devolución y la exoneración de responsabilidad aquí descritas.\n"};
  /*PLANTILLAS_END*/
  /* ── Documentos de exoneracion editables (Ajustes) ── */
  function textoPlantilla(id){ const p=plantillasCache&&plantillasCache[id]; return p?p.contenido:PLANTILLAS_ORIGINALES[id]; }
  async function loadPlantillas(){
    if(plantillasLoading) return; plantillasLoading=true;
    try{
      const authH=await getAuthHeader();
      const res=await fetch(SUPABASE_URL+"/rest/v1/exoneracion_plantillas?select=id,contenido,updated_at",{cache:"no-store",headers:{apikey:SUPABASE_ANON_KEY,Authorization:authH}});
      if(!res.ok) throw new Error("http_"+res.status);
      const rows=await res.json(); plantillasCache={};
      rows.forEach(r=>{ plantillasCache[r.id]={contenido:r.contenido,updatedAt:r.updated_at}; });
      plantillasError="";
    }catch(e){
      console.error("loadPlantillas:",e); plantillasCache=plantillasCache||{};
      plantillasError="No se pudieron cargar los documentos guardados. Si es la primera vez, corre el SQL nuevo (acqua-publico-v2.sql) en Supabase y recarga.";
    }
    plantillasLoading=false; if(activeView==="settings") render();
  }
  async function guardarPlantillaNube(id,text){
    const authH=await getAuthHeader();
    const res=await fetch(SUPABASE_URL+"/rest/v1/exoneracion_plantillas?on_conflict=id",{method:"POST",
      headers:{"Content-Type":"application/json",apikey:SUPABASE_ANON_KEY,Authorization:authH,Prefer:"resolution=merge-duplicates,return=minimal"},
      body:JSON.stringify({id,contenido:text,updated_at:new Date().toISOString()})});
    if(!res.ok) throw new Error("http_"+res.status);
  }
  function previewDocumento(){
    const id=waiverEditId, esT=e=>e.tipo==="travesia";
    const lista=state.events.filter(e=>id==="travesia"?esT(e):!esT(e)).sort((a,b)=>(b.date||"").localeCompare(a.date||""));
    if(!lista.length){ setToast(id==="travesia"?"Crea un evento de tipo Travesia a nado para ver como queda este documento.":"Crea un evento (que no sea Travesia) para ver como queda este documento."); return; }
    window.open("https://app-acqua.netlify.app/evento-acqua.html?evento="+encodeURIComponent(lista[0].id),"_blank","noopener");
  }
  /* ── EDITOR VISUAL DE DOCUMENTOS DE EXONERACION ─────────────────────────
     Se edita como en Word. Por dentro se guarda el mismo formato de texto
     que ya usa evento-acqua.html (no cambia nada para quien se inscribe). */
  const WZ_DATOS=[["nombre","Nombre del evento"],["fecha","Fecha"],["horario","Horario"],["fecha_horario","Fecha y horario"],["lugar","Lugar"],["tipo","Tipo de actividad"],["competitivo","¿Es competitivo?"],["organizador","Organizador"],["valor","Valor de la inscripcion"],["seguridad","Medidas de seguridad"]];
  const WZ_NOMBRES=Object.fromEntries(WZ_DATOS);
  let waiverDraft=null, wzRange=null;
  function normDoc(t){ return String(t||"").replace(/\r\n/g,"\n").split("\n").map(l=>l.trim()).filter(Boolean).join("\n"); }
  function wzChip(key,def){
    const k=String(key||"").toLowerCase(), known=Object.prototype.hasOwnProperty.call(WZ_NOMBRES,k);
    const label=known?WZ_NOMBRES[k]:("Dato desconocido: "+k);
    return `<span class="wz-chip${known?"":" is-bad"}" contenteditable="false" data-ph="${escapeHtml(k)}"${def!==undefined?` data-def="${escapeHtml(def)}"`:""} title="${known?"Se llena solo con el dato del evento. Toca para elegir que mostrar si el evento no lo tiene.":"Este dato no existe: revisa o borralo."}">${escapeHtml(label)}</span>`;
  }
  function wzInline(txt){
    const chips=[];
    const tok=String(txt).replace(/\{\{\s*([a-z_]+)\s*(?::([^}]*))?\}\}/gi,(m,k,d)=>{ chips.push(wzChip(k,d)); return "\u0000"+(chips.length-1)+"\u0000"; });
    return escapeHtml(tok).replace(/\*\*(.+?)\*\*/g,"<b>$1</b>").replace(/\u0000(\d+)\u0000/g,(m,n)=>chips[Number(n)]);
  }
  function docToHtml(cuerpo){
    const out=[]; let modo="";
    const cerrar=()=>{ if(modo==="ul") out.push("</ul>"); else if(modo==="table") out.push("</tbody></table>"); modo=""; };
    String(cuerpo||"").replace(/\r\n/g,"\n").split("\n").forEach(raw=>{
      const l=raw.trim(); if(!l) return; let m;
      if(l==="{{incluye}}"){ cerrar(); out.push(`<div class="wz-incluye" contenteditable="false">${icon("list")}<span><strong>Lista de lo que incluye el evento</strong><small>Se llena sola con lo que escribas en cada evento (seccion "Que incluye la inscripcion").</small></span></div>`); return; }
      if(l[0]==="|"){ const cells=l.replace(/^\||\|$/g,"").split("|").map(c=>c.trim()); if(modo!=="table"){ cerrar(); out.push('<table class="wz-table"><tbody>'); modo="table"; } out.push("<tr>"+cells.map(c=>"<td>"+(wzInline(c)||"<br>")+"</td>").join("")+"</tr>"); return; }
      if((m=l.match(/^(#{1,2})\s+(.*)$/))){ cerrar(); out.push(m[1].length===1?"<h4>"+wzInline(m[2])+"</h4>":"<h5>"+wzInline(m[2])+"</h5>"); return; }
      if((m=l.match(/^-\s+(.*)$/))){ if(modo!=="ul"){ cerrar(); out.push("<ul>"); modo="ul"; } out.push("<li>"+wzInline(m[1])+"</li>"); return; }
      cerrar(); out.push("<p>"+wzInline(l)+"</p>");
    });
    cerrar();
    return out.join("")||"<p><br></p>";
  }
  function wzInlineOut(node){
    let s="";
    node.childNodes.forEach(n=>{
      if(n.nodeType===3){ s+=n.nodeValue.replace(/ /g," ").replace(/\n/g," "); return; }
      if(n.nodeType!==1) return;
      const tag=n.tagName;
      if(n.classList.contains("wz-chip")){ s+="{{"+n.dataset.ph+(n.dataset.def!==undefined?":"+n.dataset.def:"")+"}}"; return; }
      if(tag==="BR"){ s+="\n"; return; }
      const fw=n.style&&n.style.fontWeight;
      const bold=tag==="B"||tag==="STRONG"||fw==="bold"||Number(fw)>=600;
      const inner=wzInlineOut(n);
      if(bold&&inner.trim()){ const lead=inner.match(/^\s*/)[0], trail=inner.match(/\s*$/)[0]; s+=lead+"**"+inner.trim().replace(/\*\*/g,"")+"**"+trail; }
      else s+=inner;
    });
    return s;
  }
  function htmlToDoc(root){
    const lines=[];
    const pushPara=(txt,prefix="")=>txt.split("\n").map(t=>t.replace(/\s+/g," ").trim()).filter(Boolean).forEach(t=>lines.push(prefix+t));
    root.childNodes.forEach(n=>{
      if(n.nodeType===3){ pushPara(n.nodeValue); return; }
      if(n.nodeType!==1) return;
      const tag=n.tagName;
      if(n.classList.contains("wz-incluye")){ lines.push(""); lines.push("{{incluye}}"); return; }
      if(n.classList.contains("wz-chip")){ lines.push("{{"+n.dataset.ph+(n.dataset.def!==undefined?":"+n.dataset.def:"")+"}}"); return; }
      if(tag==="H1"||tag==="H4"){ const t=wzInlineOut(n).replace(/\s+/g," ").trim(); if(t){ lines.push("# "+t); } return; }
      if(/^H[2356]$/.test(tag)){ const t=wzInlineOut(n).replace(/\s+/g," ").trim(); if(t){ lines.push(""); lines.push("## "+t); } return; }
      if(tag==="UL"||tag==="OL"){ n.querySelectorAll(":scope > li").forEach(li=>{ const t=wzInlineOut(li).replace(/\s+/g," ").trim(); if(t) lines.push("- "+t); }); return; }
      if(tag==="TABLE"){ n.querySelectorAll("tr").forEach(tr=>{ const cells=[...tr.children].map(td=>wzInlineOut(td).replace(/\s+/g," ").replace(/\|/g,"/").trim()); if(cells.some(Boolean)) lines.push("| "+cells.join(" | ")+" |"); }); return; }
      pushPara(wzInlineOut(n));
    });
    return lines.join("\n").replace(/\n{3,}/g,"\n\n").trim();
  }
  function splitPlantilla(t){ const p=String(t||"").split(/^\s*-{3}\s*declaracion\s*-{3}\s*$/im); return { cuerpo:p[0]||"", decl:(p[1]||"").trim().replace(/\s*\n\s*/g," ") }; }
  function wzCurrentText(){
    const ed=document.getElementById("wzEditor"), dc=document.getElementById("wzDecl");
    if(!ed) return null;
    const decl=(dc?dc.value:"").trim().replace(/\s*\n\s*/g," ");
    return htmlToDoc(ed)+"\n\n---declaracion---\n"+decl+"\n";
  }
  function wzDirty(){ const t=wzCurrentText(); return t!==null && normDoc(t)!==normDoc(textoPlantilla(waiverEditId)); }
  function renderWaiverEditor(){
    if(plantillasCache===null&&!plantillasLoading) setTimeout(loadPlantillas,0);
    const id=waiverEditId, custom=plantillasCache&&plantillasCache[id];
    const estado=plantillasCache===null?"Cargando…":(custom?"Personalizado · guardado "+formatDateTime(custom.updatedAt):"Original (el que vino de fabrica)");
    const uso=id==="travesia"?"Se usa en los eventos de tipo Travesia a nado.":"Se usa en todos los demas eventos.";
    const btn=(k,t)=>'<button class="btn'+(id===k?" primary":"")+'" type="button" data-action="waiver-select" data-id="'+k+'">'+t+'</button>';
    const base=splitPlantilla(textoPlantilla(id));
    const draft=waiverDraft&&waiverDraft.id===id?waiverDraft:null;
    const cuerpoHtml=draft?draft.html:docToHtml(base.cuerpo);
    const decl=draft?draft.decl:base.decl;
    const tb=(cmd,ic,label,extra="")=>`<button class="wz-btn" type="button" data-wz="${cmd}" title="${label}" ${extra}>${ic}<span>${label}</span></button>`;
    return '<section class="panel" style="margin-top:16px">'+panelHead("Documentos de exoneracion de eventos","Lo que cambies aqui lo ven quienes se inscriban desde que guardes. Quienes ya firmaron conservan una copia del texto exacto que firmaron.","file")
      +(plantillasError?'<div class="callout danger" style="margin-bottom:12px">'+escapeHtml(plantillasError)+'</div>':'')
      +'<div class="wz-top"><div class="seg">'+btn("travesia","Travesia a nado")+btn("general","Eventos generales")+'</div><span class="wz-status"><span class="badge '+(custom?"info":"no-dot")+'">'+escapeHtml(estado)+'</span> '+uso+'</span><span class="wz-dirty" id="wzDirty" '+(draft?"":"hidden")+'>Cambios sin guardar</span></div>'
      +'<div class="callout" style="margin:14px 0">'+icon("info")+'<span>Escribe y corrige como en Word. Los <span class="wz-chip wz-chip-demo">recuadros azules</span> son datos que se llenan solos con la informacion de cada evento (nombre, fecha, lugar…). Puedes moverlos, borrarlos o insertar nuevos con <strong>Insertar dato</strong>.</span></div>'
      +'<form id="waiverForm" class="wz">'
      +'<div class="wz-toolbar" role="toolbar" aria-label="Formato del documento">'
      +  tb("h4",'<b class="wz-ic">T</b>',"Titulo")+tb("h5",'<b class="wz-ic sm">T</b>',"Subtitulo")+tb("p",'<b class="wz-ic xs">¶</b>',"Texto normal")
      +  '<i class="wz-sep"></i>'+tb("bold",'<b class="wz-ic">B</b>',"Negrita")+tb("ul",icon("list"),"Lista")
      +  '<i class="wz-sep"></i>'+tb("row-add",icon("plus"),"Fila de datos")+tb("row-del",icon("minus"),"Quitar fila")
      +  '<i class="wz-sep"></i><details class="menu wz-ins"><summary class="wz-btn wz-btn-ins">'+icon("sparkles")+'<span>Insertar dato</span>'+icon("chevronRight")+'</summary><div class="menu-list">'
      +     WZ_DATOS.map(([k,l])=>'<button type="button" data-wz-ins="'+k+'">'+icon("tag")+escapeHtml(l)+'</button>').join("")
      +     '<hr><button type="button" data-wz-ins="incluye">'+icon("list")+'Lista de lo que incluye</button></div></details>'
      +  '<span class="wz-undo">'+tb("undo",icon("undo"),"Deshacer")+'</span>'
      +'</div>'
      +'<div class="wz-paper"><div id="wzEditor" class="wz-editor" contenteditable="true" spellcheck="true" aria-label="Texto del documento">'+cuerpoHtml+'</div></div>'
      +'<label class="field wz-decl">'+icon("check")+' Texto de la casilla que marca quien firma<textarea id="wzDecl" rows="3" placeholder="Ej: Declaro que he leido y entendido este documento…">'+escapeHtml(decl)+'</textarea></label>'
      +'<div class="split-actions"><button class="btn ghost" type="button" data-action="waiver-restore">'+icon("refresh")+'Restaurar el original</button><button class="btn outline" type="button" data-action="waiver-preview">'+icon("eye")+'Ver como queda</button><button class="btn primary" type="submit">'+icon("save")+'Guardar cambios</button></div></form></section>';
  }
  function initDocEditor(){
    const ed=document.getElementById("wzEditor"); if(!ed||ed.dataset.ready) return; ed.dataset.ready="1";
    const form=ed.closest("form"), dc=document.getElementById("wzDecl"), dirtyEl=document.getElementById("wzDirty");
    try{ document.execCommand("defaultParagraphSeparator",false,"p"); }catch(e){}
    const saveDraft=()=>{ waiverDraft={id:waiverEditId,html:ed.innerHTML,decl:dc?dc.value:""}; if(dirtyEl) dirtyEl.hidden=!wzDirty(); };
    const keepRange=()=>{ const sel=window.getSelection(); if(sel.rangeCount&&ed.contains(sel.getRangeAt(0).commonAncestorContainer)) wzRange=sel.getRangeAt(0).cloneRange(); };
    const restoreRange=()=>{ const r=wzRange; ed.focus(); if(r){ const sel=window.getSelection(); sel.removeAllRanges(); sel.addRange(r); wzRange=r; } };
    ed.addEventListener("input",saveDraft); if(dc) dc.addEventListener("input",saveDraft);
    ["keyup","mouseup","focus"].forEach(ev=>ed.addEventListener(ev,keepRange));
    ed.addEventListener("paste",e=>{ e.preventDefault(); const t=(e.clipboardData||window.clipboardData).getData("text/plain"); document.execCommand("insertText",false,t); });
    ed.addEventListener("click",e=>{
      const chip=e.target.closest(".wz-chip"); if(!chip||chip.dataset.ph==="incluye") return;
      const nombre=WZ_NOMBRES[chip.dataset.ph]||chip.dataset.ph;
      const v=window.prompt(`"${nombre}" se llena solo con el dato del evento.\n\nSi un evento NO tiene este dato, ¿que texto quieres mostrar en su lugar?\n(Dejalo vacio para que esa linea simplemente no aparezca.)`, chip.dataset.def||"");
      if(v===null) return; if(v.trim()) chip.dataset.def=v.trim(); else delete chip.dataset.def; saveDraft();
    });
    const curBlock=()=>{ const sel=window.getSelection(); if(!sel.rangeCount) return null; let n=sel.getRangeAt(0).startContainer; while(n&&n!==ed&&n.parentNode!==ed) n=n.parentNode; return n&&n!==ed?n:null; };
    const curRow=()=>{ const sel=window.getSelection(); if(!sel.rangeCount) return null; const n=sel.getRangeAt(0).startContainer; const el=n.nodeType===1?n:n.parentElement; return el&&el.closest&&ed.contains(el)?el.closest("tr"):null; };
    const toolbar=form.querySelector(".wz-toolbar");
    toolbar.addEventListener("mousedown",e=>{ if(e.target.closest("[data-wz],[data-wz-ins],summary")) e.preventDefault(); });
    toolbar.addEventListener("click",e=>{
      const b=e.target.closest("[data-wz]"), ins=e.target.closest("[data-wz-ins]");
      if(b){
        restoreRange(); const c=b.dataset.wz;
        if(c==="bold") document.execCommand("bold");
        else if(c==="ul") document.execCommand("insertUnorderedList");
        else if(c==="undo") document.execCommand("undo");
        else if(c==="h4"||c==="h5"||c==="p"){ const blk=curBlock(); if(blk&&(blk.tagName==="UL"||blk.tagName==="OL")) document.execCommand("insertUnorderedList"); document.execCommand("formatBlock",false,c); }
        else if(c==="row-add"){
          const tr=curRow();
          if(tr){ const nr=document.createElement("tr"); nr.innerHTML=[...tr.children].map(()=>"<td><br></td>").join(""); tr.after(nr); const sel=window.getSelection(); const r=document.createRange(); r.setStart(nr.firstChild,0); r.collapse(true); sel.removeAllRanges(); sel.addRange(r); }
          else { const blk=curBlock(); const t=document.createElement("table"); t.className="wz-table"; t.innerHTML="<tbody><tr><td>Dato</td><td><br></td></tr></tbody>"; if(blk) blk.after(t); else ed.appendChild(t); }
        }
        else if(c==="row-del"){ const tr=curRow(); if(!tr){ setToast("Pon el cursor dentro de la fila que quieres quitar."); return; } const tb=tr.closest("table"); tr.remove(); if(tb&&!tb.querySelector("tr")) tb.remove(); }
        keepRange(); saveDraft(); return;
      }
      if(ins){
        const k=ins.dataset.wzIns; ins.closest("details").removeAttribute("open"); restoreRange();
        if(k==="incluye"){
          if(ed.querySelector(".wz-incluye")){ setToast("La lista de lo que incluye ya esta en el documento."); return; }
          const blk=curBlock(); const d=document.createElement("div"); d.innerHTML=docToHtml("{{incluye}}"); const node=d.firstChild; if(blk) blk.after(node); else ed.appendChild(node);
        } else {
          const tmp=document.createElement("span"); tmp.innerHTML=wzChip(k); const chip=tmp.firstChild;
          const sel=window.getSelection(); let r=sel.rangeCount?sel.getRangeAt(0):null;
          if(!r||!ed.contains(r.commonAncestorContainer)){ ed.lastElementChild?ed.lastElementChild.appendChild(chip):ed.appendChild(chip); }
          else { r.deleteContents(); r.insertNode(chip); const sp=document.createTextNode(" "); chip.after(sp); r=document.createRange(); r.setStartAfter(sp); r.collapse(true); sel.removeAllRanges(); sel.addRange(r); }
        }
        keepRange(); saveDraft();
      }
    });
  }
  async function guardarDocumentoForm(form){
    const id=waiverEditId; const text=wzCurrentText();
    if(text===null) return;
    const {cuerpo}=splitPlantilla(text);
    if(cuerpo.trim().length<50){ setToast("El documento esta casi vacio. Escribe el texto completo o usa Restaurar el original."); return; }
    if(text.length>60000){ setToast("El documento es demasiado largo (maximo 60.000 caracteres)."); return; }
    try{
      if(normDoc(text)===normDoc(PLANTILLAS_ORIGINALES[id])){
        if(plantillasCache&&plantillasCache[id]){ if(!(await deleteRow("exoneracion_plantillas","id",id))) throw new Error("borrar"); delete plantillasCache[id]; }
        setToast("Este texto es igual al original: se usa el original.");
      } else {
        await guardarPlantillaNube(id,text); plantillasCache=plantillasCache||{};
        plantillasCache[id]={contenido:text,updatedAt:new Date().toISOString()};
        setToast("Documento guardado. Ya lo ven quienes se inscriban desde ahora.");
      }
    }catch(e){ console.error("guardarDocumento:",e); setToast("No se pudo guardar. Revisa tu conexion y que hayas corrido el SQL nuevo en Supabase."); return; }
    waiverDraft=null; render();
  }
  async function restaurarDocumento(){
    const id=waiverEditId;
    if(!(plantillasCache&&plantillasCache[id])){
      if(waiverDraft&&waiverDraft.id===id){ if(!window.confirm("Descartar los cambios que no has guardado?")) return; waiverDraft=null; render(); setToast("Cambios descartados."); return; }
      setToast("Ya estas usando el documento original."); return;
    }
    if(!window.confirm("Restaurar el documento original? Se pierden los cambios que guardaste en este documento.")) return;
    if(!(await deleteRow("exoneracion_plantillas","id",id))){ setToast("No se pudo restaurar. Revisa tu conexion e intenta de nuevo."); return; }
    delete plantillasCache[id]; waiverDraft=null;
    setToast("Listo: se restauro el documento original."); render();
  }

  /* ── EDITOR VISUAL DE "QUE INCLUYE" ─────────────────────────────────── */
  function inclParse(txt){
    const groups=[]; let cur={title:"",items:[]};
    String(txt||"").split(/\r?\n/).forEach(raw=>{ const line=raw.trim(); if(!line) return;
      if(!/^[-•*]/.test(line)&&/:\s*$/.test(line)){ if(cur.items.length||cur.title) groups.push(cur); cur={title:line.replace(/:\s*$/,""),items:[]}; }
      else cur.items.push(line.replace(/^[-•*]\s*/,"")); });
    if(cur.items.length||cur.title) groups.push(cur);
    return groups;
  }
  function inclSerialize(box){
    const out=[];
    box.querySelectorAll(".incl-group").forEach(g=>{
      const title=g.querySelector(".incl-title").value.trim().replace(/:+\s*$/,"");
      const items=[...g.querySelectorAll(".incl-item input")].map(i=>i.value.trim()).filter(Boolean);
      if(!title&&!items.length) return;
      if(title) out.push(title+":");
      items.forEach(i=>out.push("- "+i));
    });
    return out.join("\n");
  }
  function inclItemHtml(v){ return `<div class="incl-item"><span class="incl-dot"></span><input type="text" value="${escapeHtml(v)}" placeholder="Escribe un elemento (ej: Medalla conmemorativa)"><button type="button" class="incl-x" data-incl="del-item" title="Quitar" aria-label="Quitar elemento">${icon("x")}</button></div>`; }
  function inclGroupHtml(g){ return `<div class="incl-group"><div class="incl-head"><input class="incl-title" type="text" value="${escapeHtml(g.title||"")}" placeholder="Titulo del grupo (opcional) — ej: Kit del participante"><button type="button" class="incl-x" data-incl="del-group" title="Quitar grupo" aria-label="Quitar grupo">${icon("trash")}</button></div><div class="incl-items">${(g.items.length?g.items:[""]).map(inclItemHtml).join("")}</div><button type="button" class="incl-add" data-incl="add-item">${icon("plus")}Agregar elemento</button></div>`; }
  function initInclEditor(scope){
    (scope||document).querySelectorAll('textarea[name="eventIncluye"]').forEach(ta=>{
      let box=ta.parentElement.querySelector(".incl-editor");
      if(!box){ box=document.createElement("div"); box.className="incl-editor"; ta.after(box); ta.hidden=true;
        const sync=()=>{ ta.value=inclSerialize(box); };
        box.addEventListener("input",sync);
        box.addEventListener("click",e=>{
          const b=e.target.closest("[data-incl]"); if(!b) return; e.preventDefault();
          const a=b.dataset.incl, g=b.closest(".incl-group");
          if(a==="add-item"){ g.querySelector(".incl-items").insertAdjacentHTML("beforeend",inclItemHtml("")); g.querySelector(".incl-item:last-child input").focus(); }
          else if(a==="del-item"){ const it=b.closest(".incl-item"); if(g.querySelectorAll(".incl-item").length>1) it.remove(); else it.querySelector("input").value=""; }
          else if(a==="del-group"){ if(box.querySelectorAll(".incl-group").length>1) g.remove(); else { g.querySelector(".incl-title").value=""; g.querySelector(".incl-items").innerHTML=inclItemHtml(""); } }
          else if(a==="add-group"){ box.querySelector(".incl-groups").insertAdjacentHTML("beforeend",inclGroupHtml({title:"",items:[]})); box.querySelector(".incl-group:last-child .incl-title").focus(); }
          sync();
        });
        box.addEventListener("keydown",e=>{
          const inp=e.target; if(!(inp instanceof HTMLInputElement)) return;
          const it=inp.closest(".incl-item");
          if(e.key==="Enter"){ e.preventDefault(); if(it){ it.insertAdjacentHTML("afterend",inclItemHtml("")); it.nextElementSibling.querySelector("input").focus(); } else { const first=inp.closest(".incl-group").querySelector(".incl-item input"); if(first) first.focus(); } sync(); }
          else if(e.key==="Backspace"&&it&&!inp.value){ const prev=it.previousElementSibling; if(prev){ e.preventDefault(); it.remove(); const pi=prev.querySelector("input"); pi.focus(); pi.setSelectionRange(pi.value.length,pi.value.length); sync(); } }
        });
      }
      const groups=inclParse(ta.value);
      box.innerHTML=`<div class="incl-groups">${(groups.length?groups:[{title:"",items:[]}]).map(inclGroupHtml).join("")}</div><button type="button" class="btn ghost incl-add-group" data-incl="add-group">${icon("plus")}Agregar grupo</button>`;
    });
  }
  const EVENT_TIPOS=[["travesia","Travesía a nado"],["festival","Festival"],["clinica","Clínica"],["exhibicion","Exhibición"],["otro","Otro"]];
  const INCLUYE_TRAVESIA=["Kit del participante:","- Gorro de natación en tela","- Tula","- Botilito","- Toalla","- Medalla conmemorativa del evento",
    "Durante el evento:","- Hidratación durante todo el evento","- Refrigerio al finalizar","- Espacio exclusivo para ACQUA NATACIÓN de 5:00 a. m. a 10:00 a. m.",
    "Seguridad y acompañamiento:","- Salvavidas certificados acompañando la travesía","- Bote de apoyo para el nadador que se sienta agotado","- Acompañamiento de la Cruz Roja","- Acompañamiento de la Armada y buzos","- Póliza del evento con cobertura tanto en San Andrés como en Bogotá",
    "Después del evento:","- Entrega del certificado de participación 15 días después, en la sede campestre de ACQUA NATACIÓN, con una caminata ecológica de 6 km en familia incluida."].join("\n");
  function renderEventFields(ev){
    const v=ev||{};
    const tipoOpts=EVENT_TIPOS.map(([val,lab])=>'<option value="'+val+'"'+((v.tipo||"otro")===val?" selected":"")+'>'+lab+'</option>').join("");
    return '<label class="field wide">Nombre<input name="eventName" required placeholder="Travesia San Andres 2027" value="'+escapeHtml(v.name||"")+'"></label>'
      +'<label class="field">Fecha<input name="eventDate" type="date" required value="'+escapeHtml(v.date||"")+'"></label>'
      +'<label class="field">Lugar<input name="eventPlace" required placeholder="Piscina, ciudad..." value="'+escapeHtml(v.place||"")+'"></label>'
      +'<div class="field-section">Se llena solo en la exoneracion de WhatsApp</div>'
      +'<label class="field">Horario<input name="eventHorario" placeholder="5:00 a. m. a 10:00 a. m." value="'+escapeHtml(v.horario||"")+'"></label>'
      +'<label class="field">Tipo de actividad<select name="eventTipo">'+tipoOpts+'</select></label>'
      +'<label class="field">¿Es competitivo?<select name="eventCompetitivo"><option value="No"'+((v.competitivo||"No")==="No"?" selected":"")+'>No</option><option value="Si"'+(v.competitivo==="Si"?" selected":"")+'>Sí</option></select></label>'
      +'<label class="field">Valor de la inscripcion<input name="eventValor" placeholder="$250.000" value="'+escapeHtml(v.valor||"")+'"></label>'
      +'<label class="field wide">Organizador<input name="eventOrganizador" placeholder="ACQUA NATACIÓN Escuela de Natación" value="'+escapeHtml(v.organizador||"")+'"></label>'
      +'<div class="field wide incl-field"><span>Que incluye la inscripcion <small style="font-weight:500;color:var(--muted)">· agrupa por temas (opcional) y agrega un elemento por renglon</small></span><textarea name="eventIncluye" rows="7" placeholder="Un item por linea. Para agrupar, escribe un titulo que termine en dos puntos (ej. Kit del participante:)">'+escapeHtml(v.incluye||"")+'</textarea></div>'
      +'<div class="wide"><button class="btn ghost" type="button" data-action="fill-includes-travesia">Usar la lista de la Travesia</button></div>';
  }
  function renderEventEditPanel(ev){
    return '<section class="panel is-edit">'+panelHead("Editar evento","Lo que cambies aqui se actualiza solo en el formulario que reciben por WhatsApp.","edit")
      +'<form id="eventEditForm" class="field-grid">'+renderEventFields(ev)
      +'<div class="split-actions wide"><button class="btn" type="button" data-action="cancel-edit-event">Cancelar</button><button class="btn primary" type="submit">'+icon("save")+'Guardar cambios</button></div></form></section>';
  }
  function readEventFields(fd){
    const g=k=>String(fd.get(k)||"").trim();
    return { name:g("eventName"), date:g("eventDate"), place:g("eventPlace"), horario:g("eventHorario"), tipo:g("eventTipo")||"otro",
      competitivo:g("eventCompetitivo")||"No", valor:g("eventValor"), organizador:g("eventOrganizador"), incluye:g("eventIncluye") };
  }
  function guardarEventoEnNube(){ (async()=>{ const ok=await saveStateImmediate(); if(!ok){ debouncedCloudSave(); setToast("Guardado localmente; confirmando en la nube..."); } })(); }
  function saveEvent(form){
    const f=readEventFields(new FormData(form));
    if(!f.name||!f.date||!f.place){ setToast("Completa nombre, fecha y lugar del evento."); return; }
    const now=new Date().toISOString();
    const event={ id:uid("event"), ...f, attendees:[], createdAt:now, updatedAt:now };
    state.events.push(event); activeEventId=event.id;
    setToast("Evento creado."); render(); guardarEventoEnNube();
  }
  function updateEvent(form){
    const ev=getEvent(eventEditId);
    if(!ev){ eventEditId=null; render(); return; }
    const f=readEventFields(new FormData(form));
    if(!f.name||!f.date||!f.place){ setToast("Completa nombre, fecha y lugar del evento."); return; }
    Object.assign(ev,f); ev.updatedAt=new Date().toISOString();
    eventEditId=null; setToast("Evento actualizado."); render(); guardarEventoEnNube();
  }
  function duplicateEvent(id){
    const src=getEvent(id); if(!src) return;
    const now=new Date().toISOString();
    const copy={ id:uid("event"), name:(src.name||"")+" (copia)", date:"", place:src.place||"", horario:src.horario||"", tipo:src.tipo||"otro",
      competitivo:src.competitivo||"No", valor:src.valor||"", incluye:src.incluye||"", organizador:src.organizador||"", attendees:[], createdAt:now, updatedAt:now };
    state.events.push(copy); activeView="events"; activeEventId=copy.id; eventEditId=copy.id;
    setToast("Copia creada: cambia el nombre, la fecha y lo que incluye, y guarda."); render(); guardarEventoEnNube();
  }
  function renderAttendeeDataModal(draft){
    const ev=getEvent(draft.eventId); const at=ev&&(ev.attendees||[]).find(a=>a.id===draft.attendeeId);
    if(!at) return "";
    const info=attendeeDisplay(at), d=at.datos||{}, s=at.signature||{};
    const rows=[["Participante",info.name],["Documento",d.documento],["Fecha de nacimiento",d.nacimiento],["Telefono",d.telefono||info.phone],["Correo",d.correo],
      ["Contacto de emergencia",[d.emergencia_nombre,d.emergencia_telefono].filter(Boolean).join(" - ")],
      ["Tutor o representante",[d.tutor_nombre,d.tutor_parentesco&&("("+d.tutor_parentesco+")"),d.tutor_documento&&("Doc "+d.tutor_documento),d.tutor_telefono].filter(Boolean).join(" ")],
      ["EPS",d.eps],["Tipo de sangre",d.sangre],["Talla de camiseta",d.camiseta],["Estatura (cm)",d.estatura],["Peso (kg)",d.peso],
      ["Alergias o condiciones medicas",d.notas],["Autoriza uso de imagen",d.imagen],
      ["Firmo",s.name?(s.name+(s.document?" - "+s.document:"")):""],["Fecha de firma",s.signedAt],
      ["Documento firmado",d.plantilla==="travesia"?"Travesia (completo)":d.plantilla==="general"?"General de eventos":""]].filter(r=>r[1]);
    return '<div class="modal-backdrop" role="dialog" aria-modal="true" data-action="close-attendee-data"><div class="modal-panel"><div class="modal-header" style="position:sticky;top:0;z-index:1"><div><span class="eyebrow">Datos de inscripcion</span><h3>'+escapeHtml(info.name)+'</h3></div><button class="btn icon" type="button" title="Cerrar" aria-label="Cerrar" data-action="close-attendee-data">'+icon("x")+'</button></div>'
      +'<div style="padding:14px 20px 20px;display:grid;gap:2px">'+rows.map(r=>'<div class="kv"><span>'+escapeHtml(r[0])+'</span><strong>'+escapeHtml(r[1])+'</strong></div>').join("")
      +(d.texto_firmado?'<details style="margin-top:12px"><summary style="cursor:pointer;font-weight:700;font-size:.88rem">Ver el documento que firmo</summary><p style="font-size:.76rem;color:var(--muted);margin:6px 0">Texto exacto que vio al firmar ('+(d.plantilla_origen==="personalizada"?"version personalizada":"version original")+').</p><pre style="white-space:pre-wrap;font-family:inherit;font-size:.8rem;line-height:1.5;background:var(--bg);border-radius:10px;padding:12px;max-height:50vh;overflow:auto;margin:0">'+escapeHtml(d.texto_firmado)+'</pre></details>':'')
      +'<div class="split-actions" style="margin-top:16px"><button class="btn primary" type="button" data-action="close-attendee-data">Cerrar</button></div>'
      +'</div></div></div>';
  }
  /* Solo protege lo que se esta escribiendo en un FORMULARIO (evento, alumno, pago...) para que la
     sincronizacion automatica no lo borre. Los buscadores NO cuentan: ahi la pantalla si debe refrescarse. */
  function isTypingInApp(){ const el=document.activeElement; if(el&&el.isContentEditable&&el.closest&&el.closest("#app")) return true; return !!(el&&/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)&&el.closest&&el.closest("#app form[id]")); }
  function saveInternalEvent(form){
    const fd=new FormData(form);
    const name=String(fd.get("iEventName")||"").trim();
    const date=String(fd.get("iEventDate")||"").trim();
    if(!name||!date){ setToast("Completa nombre y fecha del evento."); return; }
    if(!state.internalEvents) state.internalEvents=[];
    // Verificar cruce con eventos externos
    const cruce=state.events.find(e=>e.date===date);
    if(cruce&&!window.confirm("Hay un evento externo el "+date+" ("+cruce.name+"). Continuar de todas formas?")) return;
    state.internalEvents.push({
      id:uid("ievt"), name, date,
      start:String(fd.get("iEventStart")||"").trim(),
      end:String(fd.get("iEventEnd")||"").trim(),
      desc:String(fd.get("iEventDesc")||"").trim(),
      createdAt:new Date().toISOString()
    });
    saveState(); setToast("Evento interno agregado al calendario."); render();
  }
  function deleteEvent(eventId){ const event=getEvent(eventId); if(!event)return; if(!window.confirm(`Eliminar "${event.name}" y sus inscritos?`))return; state.events=state.events.filter(e=>e.id!==eventId); if(activeEventId===eventId)activeEventId=null; saveState(); setToast("Evento eliminado."); render(); deleteRow("events","id",eventId); }
  function enrollEventStudent(eventId,studentId){ const event=getEvent(eventId), student=getStudent(studentId); if(!event||!student){ setToast("No encontre el evento o el alumno."); return; } event.attendees=event.attendees||[]; if(event.attendees.some(a=>a.studentId===student.id)){ setToast("Ese alumno ya esta inscrito."); return; } const nowIso=new Date().toISOString(); event.attendees.push({id:uid("eatt"),studentId:student.id,paid:false,signed:false,signature:null,addedAt:nowIso,updatedAt:nowIso}); event.updatedAt=new Date().toISOString(); saveState(); setToast(`${student.name} inscrito en el evento.`); render(); }
  function enrollEventGuest(eventId,name,age,phone){
    const event=getEvent(eventId);
    if(!event){ setToast("No encontre el evento."); return; }
    const nm=String(name||"").trim();
    if(!nm){ setToast("El nombre de la persona es obligatorio."); return; }
    event.attendees=event.attendees||[];
    const nowIso2=new Date().toISOString();
    event.attendees.push({ id:uid("eatt"), studentId:null, guestName:nm, guestAge:String(age||"").trim(), guestPhone:String(phone||"").trim(), paid:false, signed:false, signature:null, addedAt:nowIso2, updatedAt:nowIso2 });
    event.updatedAt=new Date().toISOString();
    saveState(); setToast(`${nm} inscrito(a) como particular en el evento.`); render();
  }
  function toggleEventPaid(eventId,attendeeId){ const attendee=findEventAttendeeById(eventId,attendeeId); if(!attendee)return; attendee.paid=!attendee.paid; attendee.updatedAt=new Date().toISOString(); touchEvent(eventId); saveState(); render(); }
  function removeEventAttendee(eventId,attendeeId){
    const event=getEvent(eventId); const attendee=findEventAttendeeById(eventId,attendeeId);
    if(!event||!attendee) return;
    const info=attendeeDisplay(attendee);
    if(!window.confirm(`Quitar a ${info.name} de "${event.name}"?`))return;
    event.attendees=(event.attendees||[]).filter(a=>a.id!==attendeeId);
    touchEvent(eventId); saveState(); setToast(info.isGuest?"Persona retirada del evento.":"Alumno retirado del evento."); render();
    deleteRow("event_attendees","id",attendeeId);
  }
  function findEventAttendeeById(eventId,attendeeId){ return getEvent(eventId)?.attendees?.find(a=>a.id===attendeeId); }
  function touchEvent(eventId){ const event=getEvent(eventId); if(event)event.updatedAt=new Date().toISOString(); }
  function saveSignature(form){
    const fd=new FormData(form);
    const eventId=String(fd.get("eventId")||""), attendeeId=String(fd.get("attendeeId")||"");
    const attendee=findEventAttendeeById(eventId,attendeeId);
    if(!attendee){ setToast("No encontre la inscripcion para firmar."); return; }
    attendee.signed=true; attendee.signature={ name:String(fd.get("signatureName")||"").trim(), document:String(fd.get("signatureDocument")||"").trim(), signedAt:new Intl.DateTimeFormat("es-CO",{dateStyle:"medium",timeStyle:"short"}).format(new Date()) };
    attendee.updatedAt=new Date().toISOString();
    touchEvent(eventId); signatureDraft=null;
    saveState(); setToast("Firma guardada."); render();
  }

  /* EXPORTAR / IMPORTAR */
  function exportJson(){
    if(typeof XLSX==="undefined"){ setToast("Libreria Excel no disponible. Recarga la pagina."); return; }
    try {
      const wb=XLSX.utils.book_new();
      const fmtDate=iso=>{ try{ return iso?new Intl.DateTimeFormat("es-CO",{dateStyle:"short"}).format(new Date(iso)):""; }catch(e){return iso||"";} };
      const fmtPesos=v=>{ try{ return v?new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0}).format(Number(v)):""; }catch(e){return v||"";} };
      const studentRows=state.students.map(s=>{
        const pagos=(s.payments||[]);
        const totalPagado=pagos.reduce((sum,p)=>sum+Number(p.valor||0),0);
        const ultimoPago=pagos.length?pagos[pagos.length-1]:null;
        return {
          "Codigo":s.code||"",
          "Nombre":s.name||"",
          "Documento":s.documento||"",
          "Categoria":s.category||"",
          "Fecha nacimiento":s.birthdate||"",
          "Estatura (cm)":s.talla||"",
          "Peso (kg)":s.peso||"",
          "Tipo de sangre":s.sangre||"",
          "EPS":s.eps||"",
          "Talla camiseta":s.camiseta||"",
          "Nivel":s.nivel||"Sin nivel", "Plan":PLAN_LABELS[s.planType]||s.planType||"",
          "Clases totales":planTotal(s),
          "Clases usadas":Number(s.classesUsed||0),
          "Clases restantes":remainingClasses(s),
          "Inicio del plan":fmtDate(s.planStartedAt),
          "Vence el":(()=>{ try{ const end=planEndDate(s); return end?fmtDate(end):""; }catch(e){ return ""; } })(),
          "Estado":s.status==="active"?"Activo":"Inactivo",
          "Telefono alumno":s.phone||"",
          "Acudiente":s.responsible||"",
          "Tel acudiente":s.phoneAcudiente||"",
          "Email":s.email||"",
          "Notas":s.notes||"",
          "Mes renovacion":s.monthKey||"",
          "Total pagado":fmtPesos(totalPagado),
          "No. pagos":pagos.length,
          "Ultimo pago":ultimoPago?fmtDate(ultimoPago.fecha):"",
          "Metodo ultimo pago":ultimoPago?ultimoPago.metodo||"":"",
        };
      });
      const wsStudents=XLSX.utils.json_to_sheet(studentRows.length?studentRows:[{"Codigo":"","Nombre":""}]);
      wsStudents["!cols"]=[8,26,14,12,14,8,7,8,10,16,10,20,10,10,10,12,12,10,14,20,14,24,24,12,14,7,12,16].map(w=>({wch:w}));

      // Hoja extra: historial de pagos de todos los alumnos
      const pagoRows=[];
      state.students.forEach(s=>{
        (s.payments||[]).forEach(p=>{
          pagoRows.push({
            "Codigo":s.code||"","Nombre":s.name||"","Categoria":s.category||"",
            "Fecha pago":p.fecha||"","Hora":p.hora||"",
            "Valor":fmtPesos(p.valor),"Metodo":p.metodo||"","Concepto":p.concepto||""
          });
        });
      });
      if(pagoRows.length){
        const wsPagos=XLSX.utils.json_to_sheet(pagoRows);
        wsPagos["!cols"]=[8,26,12,12,8,16,18,24].map(w=>({wch:w}));
        XLSX.utils.book_append_sheet(wb,wsPagos,"Pagos");
      }
      XLSX.utils.book_append_sheet(wb,wsStudents,"Alumnos");
      const attendanceRows=[...state.attendance].sort((a,b)=>new Date(b.at)-new Date(a.at)).map(entry=>{ const s=getStudent(entry.studentId)||{}; return { "Fecha y hora":formatDateTime(entry.at), "Mes":entry.monthKey||"", "Nombre":s.name||"", "Codigo":s.code||entry.studentId, "Plan":PLAN_LABELS[s.planType]||"", "Origen":(entry.source==="qr"||entry.source==="qr-url")?"QR":"Manual", "Tipo":entry.extra?"Extra":"Plan" }; });
      const wsAttendance=XLSX.utils.json_to_sheet(attendanceRows.length?attendanceRows:[{"Fecha y hora":"","Nombre":""}]);
      wsAttendance["!cols"]=[18,8,24,10,16,8,6].map(w=>({wch:w}));
      XLSX.utils.book_append_sheet(wb,wsAttendance,"Asistencia");
      // El JSON completo puede superar el limite de 32,767 caracteres por celda
      // de Excel (pasa facil con ~100 alumnos + pagos + asistencia + eventos),
      // asi que se parte en pedazos y cada uno va en su propia fila.
      const datosJson=JSON.stringify(state);
      const CHUNK=30000;
      const datosChunks=[];
      for(let i=0;i<datosJson.length;i+=CHUNK) datosChunks.push([datosJson.slice(i,i+CHUNK)]);
      const wsDatos=XLSX.utils.aoa_to_sheet(datosChunks.length?datosChunks:[[""]]);
      XLSX.utils.book_append_sheet(wb,wsDatos,"_datos");
      const wbOut=XLSX.write(wb,{bookType:"xlsx",type:"array"});
      const blob=new Blob([wbOut],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
      const url=URL.createObjectURL(blob);
      const link=document.createElement("a"); link.href=url; link.download=`acqua-respaldo-${state.currentMonth}.xlsx`;
      document.body.append(link); link.click(); link.remove(); URL.revokeObjectURL(url);
      try{ localStorage.setItem("acquacontrol.lastBackup",new Date().toISOString()); }catch(e){}
      setToast("Respaldo Excel descargado.");
    } catch(err){ console.error(err); setToast("Error al generar el Excel."); }
  }
  function exportCsv(){
    const q=reportsSearch.trim();
    const header=["fecha","alumno","codigo","plan","origen","tipo"];
    const rows=reportEntries().map(entry=>{ const s=getStudent(entry.studentId)||{}; return [formatDateTime(entry.at),s.name||"",s.code||entry.studentId,PLAN_LABELS[s.planType]||"",(entry.source==="qr"||entry.source==="qr-url")?"QR":"Manual",entry.extra?"extra":"plan"]; });
    const csv=[header,...rows].map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8"});
    const url=URL.createObjectURL(blob);
    const link=document.createElement("a"); link.href=url;
    link.download = q
      ? `acqua-historial-${(rows[0]?.[2]||"alumno").toString().replace(/[^a-z0-9-]/gi,"")||"alumno"}.csv`
      : `acqua-asistencia-${state.currentMonth}.csv`;
    document.body.append(link); link.click(); link.remove(); URL.revokeObjectURL(url);
    setToast(q ? "CSV con el historial completo del alumno descargado." : "CSV de asistencia descargado.");
  }
  function exportEventXlsx(eventId){
    if(typeof XLSX==="undefined"){ setToast("Libreria Excel no disponible. Recarga la pagina."); return; }
    const ev=getEvent(eventId);
    if(!ev){ setToast("No encontre ese evento."); return; }
    const attendees=[...(ev.attendees||[])];
    try {
      const wb=XLSX.utils.book_new();
      const paid=attendees.filter(a=>a.paid).length;
      const signed=attendees.filter(a=>a.signed).length;

      const participantRows=attendees.map(a=>{
        const info=attendeeDisplay(a); const d=a.datos||{}; const stu=a.studentId?getStudent(a.studentId):null;
        return {
          "Nombre":info.name,
          "Tipo":info.isGuest?"Particular":"Alumno",
          "Codigo / Edad":info.isGuest?(a.guestAge||""):(stu?.code||a.studentId),
          "Documento":d.documento||stu?.documento||"",
          "Fecha nacimiento":d.nacimiento||stu?.birthdate||"",
          "Telefono":info.phone,
          "Correo":d.correo||stu?.email||"",
          "Contacto emergencia":d.emergencia_nombre||"",
          "Tel emergencia":d.emergencia_telefono||"",
          "Tutor / representante":d.tutor_nombre||(info.isGuest?"":(stu?.responsible||"")),
          "Parentesco":d.tutor_parentesco||"",
          "Documento tutor":d.tutor_documento||"",
          "Tel tutor":d.tutor_telefono||(info.isGuest?"":(stu?.phoneAcudiente||"")),
          "EPS":d.eps||stu?.eps||"",
          "Tipo sangre":d.sangre||stu?.sangre||"",
          "Talla camiseta":d.camiseta||stu?.camiseta||"",
          "Estatura (cm)":d.estatura||stu?.talla||"",
          "Peso (kg)":d.peso||stu?.peso||"",
          "Alergias / condiciones":d.notas||"",
          "Autoriza imagen":d.imagen||"",
          "Pagado":a.paid?"Si":"No",
          "Firmado":a.signed?"Si":"No",
          "Firmado por":a.signature?.name||"",
          "Documento firma":a.signature?.document||"",
          "Fecha firma":a.signature?.signedAt||"",
          "Inscrito el":a.addedAt?formatDateTime(a.addedAt):"",
        };
      });
      const wsParticipants=XLSX.utils.json_to_sheet(participantRows.length?participantRows:[{"Nombre":"Aun no hay inscritos"}]);
      wsParticipants["!cols"]=Object.keys(participantRows[0]||{"Nombre":1}).map(k=>({wch:Math.min(34,Math.max(10,k.length+2,...participantRows.map(r=>String(r[k]||"").length)))}));
      XLSX.utils.book_append_sheet(wb,wsParticipants,"Participantes");

      const infoRows=[
        {"Campo":"Evento","Valor":ev.name||""},
        {"Campo":"Fecha","Valor":ev.date||""},
        {"Campo":"Lugar","Valor":ev.place||""},
        {"Campo":"Horario","Valor":ev.horario||""},
        {"Campo":"Tipo de actividad","Valor":(EVENT_TIPOS.find(t=>t[0]===ev.tipo)||[0,ev.tipo||""])[1]},
        {"Campo":"Valor de la inscripcion","Valor":ev.valor||""},
        {"Campo":"Inscritos","Valor":attendees.length},
        {"Campo":"Pagados","Valor":paid},
        {"Campo":"Firmados","Valor":signed},
        {"Campo":"Pendientes de pago","Valor":attendees.length-paid},
        {"Campo":"Pendientes de firma","Valor":attendees.length-signed},
      ];
      const wsInfo=XLSX.utils.json_to_sheet(infoRows,{skipHeader:true});
      wsInfo["!cols"]=[22,30].map(w=>({wch:w}));
      XLSX.utils.book_append_sheet(wb,wsInfo,"Datos del evento");

      const wbOut=XLSX.write(wb,{bookType:"xlsx",type:"array"});
      const blob=new Blob([wbOut],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
      const url=URL.createObjectURL(blob);
      const safeName=(ev.name||"evento").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9]+/g,"-").replace(/^-+|-+$/g,"").toLowerCase()||"evento";
      const link=document.createElement("a"); link.href=url; link.download=`acqua-evento-${safeName}${ev.date?"-"+ev.date:""}.xlsx`;
      document.body.append(link); link.click(); link.remove(); URL.revokeObjectURL(url);
      setToast("Excel del evento descargado.");
    } catch(err){ console.error(err); setToast("Error al generar el Excel del evento."); }
  }
  function importJson(file){
    const ok=window.confirm("Esto reemplazara TODOS los datos actuales de la app (alumnos, pagos, firmas, asistencia y eventos) por los que traiga el archivo de respaldo. Esta accion no se puede deshacer.\n\n¿Deseas continuar?");
    if(!ok) return;
    if(file.name.endsWith(".xlsx")){
      const reader=new FileReader();
      reader.onload=()=>{ try { const wb=XLSX.read(reader.result,{type:"array"}); const wsName=wb.SheetNames.find(n=>n==="_datos"); if(!wsName)throw new Error("Hoja _datos no encontrada"); const ws=wb.Sheets[wsName]; const raw=XLSX.utils.sheet_to_json(ws,{header:1}); const jsonCompleto=raw.map(r=>r[0]||"").join(""); const imported=JSON.parse(jsonCompleto); if(!Array.isArray(imported.students))throw new Error("Invalid"); state={ version:1, currentMonth:imported.currentMonth||monthKey(new Date()), settings:{businessName:DEFAULT_BUSINESS}, students:imported.students, attendance:imported.attendance||[], events:Array.isArray(imported.events)?imported.events:[], internalEvents:Array.isArray(imported.internalEvents)?imported.internalEvents:[] }; saveState(); setToast(`Respaldo restaurado: ${imported.students.length} alumno(s) recuperados.`); render(); } catch(e){ console.error(e); setToast("El archivo Excel no es un respaldo valido de ACQUA."); } };
      reader.readAsArrayBuffer(file);
    } else {
      const reader=new FileReader();
      reader.onload=()=>{ try { const imported=JSON.parse(String(reader.result||"{}")); if(!Array.isArray(imported.students))throw new Error("Invalid"); state={ version:1, currentMonth:imported.currentMonth||monthKey(new Date()), settings:{businessName:DEFAULT_BUSINESS}, students:imported.students, attendance:imported.attendance||[], events:Array.isArray(imported.events)?imported.events:[], internalEvents:Array.isArray(imported.internalEvents)?imported.internalEvents:[] }; saveState(); setToast(`Respaldo restaurado: ${imported.students.length} alumno(s) recuperados.`); render(); } catch(e){ console.error(e); setToast("El archivo no parece ser un respaldo valido."); } };
      reader.readAsText(file);
    }
  }
  function loadDemoData(){
    const ok=state.students.length?window.confirm("Esto agregara alumnos de ejemplo. Continuar?"):true;
    if(!ok) return;
    const demos=[["Mariana Lopez","Nino","8","Laura Lopez","300 111 2222"],["Tomas Rincon","Nino","4","Andres Rincon","300 333 4444"],["Valeria Gomez","Adulto","13","","300 555 6666"],["Carlos Mejia","Adulto","custom","","300 777 8888"]];
    demos.forEach(([name,category,planType,responsible,phone])=>{ state.students.push({ id:uid("student"), code:nextStudentCode(), name, category, age:"", responsible, phone, email:"", planType, customClasses:planType==="custom"?6:"", status:"active", notes:"", monthKey:state.currentMonth, classesUsed:0, createdAt:new Date().toISOString(), updatedAt:new Date().toISOString() }); });
    saveState(); setToast("Datos demo cargados."); render();
  }
  function clearData(){
    if(!window.confirm("Borrar todos los alumnos y asistencias guardadas en este navegador?")) return;
    state={ version:1, currentMonth:monthKey(new Date()), settings:{businessName:DEFAULT_BUSINESS}, students:[], attendance:[], events:[], internalEvents:[] };
    saveState(); editingStudentId=null; activeEventId=null; signatureDraft=null; checkinSearch=""; studentFilters={search:"",plan:"all",status:"active"}; cardSearch=""; reportsSearch="";
    setToast("Datos borrados."); render();
  }

  /* MANEJADORES DE EVENTOS */
  function preserveFocus(selector,renderFn=render){ renderFn(); window.requestAnimationFrame(()=>{ const el=document.querySelector(selector); if(!el)return; el.focus(); if(el.setSelectionRange)el.setSelectionRange(el.value.length,el.value.length); }); }
  /* Los buscadores en vivo (alumnos, check-in, carnets, reportes, eventos)
     antes reconstruian TODA la pantalla en cada tecla para refiltrar la
     lista. Eso destruye y vuelve a crear el campo de texto, y en celulares
     el teclado no vuelve a abrirse solo (los navegadores moviles solo abren
     el teclado ante un toque real, no ante un focus() hecho por JavaScript).
     Por eso "se escondia con cada letra". Ahora se espera una pausa breve
     antes de refiltrar, para no destruir el campo mientras se sigue
     escribiendo. */
  let _filterRenderTimer=null;
  function debouncedPreserveFocus(selector,renderFn=render,delay=350){
    clearTimeout(_filterRenderTimer);
    _filterRenderTimer=setTimeout(()=>preserveFocus(selector,renderFn),delay);
  }

  document.addEventListener("click",event=>{
    const viewButton=event.target.closest("[data-view]");
    if(viewButton){
      if(!isAuthenticated){ loginModalVisible=true; render(); return; }
      activeView=viewButton.dataset.view;
      if(activeView!=="events"){ activeEventId=null; signatureDraft=null; eventEditId=null; attendeeDataDraft=null; }
      render(); return;
    }
    const action=event.target.closest("[data-action]");
    if(!action) return;
    const id=action.dataset.id, eventId=action.dataset.eventId, studentId=action.dataset.studentId, attendeeId=action.dataset.attendeeId;
    switch(action.dataset.action){
      case "open-login":  loginModalVisible=true; render(); break;
      case "close-login": loginModalVisible=false; const lmClose=document.getElementById("loginModal"); if(lmClose)lmClose.remove(); render(); break;
      case "logout":      logout(); break;

      case "renew-student":           renewModalStudentId=id; renewModalChangePlan=false; render(); (async()=>{ await refreshStudentFromCloud(id); if(renewModalStudentId===id) render(); })(); break;
      case "go-to-student": {
        const stGo=getStudent(id);
        activeView="students"; editingStudentId=null; studentsFormVisible=false;
        studentFilters={ search: stGo?stGo.code:"", plan:"all", status:"all" };
        render();
        break;
      }
      case "close-blocked-checkin": {
        document.getElementById("checkin-blocked-overlay")?.remove();
        if(activeView==="checkin") setTimeout(()=>startScanner(),150);
        break;
      }
      case "renew-from-block": {
        document.getElementById("checkin-blocked-overlay")?.remove();
        renewModalStudentId=id; renewModalChangePlan=false; render();
        (async()=>{ await refreshStudentFromCloud(id); if(renewModalStudentId===id) render(); })();
        break;
      }
      case "close-renewal-modal":     renewModalStudentId=null; renewModalChangePlan=false; render(); break;
      case "confirm-renewal-same":    { const stSame=getStudent(renewModalStudentId); if(!confirmRenewalDataLoss(stSame)) break; renewStudent(renewModalStudentId); renewModalStudentId=null; renewModalChangePlan=false; render(); (async()=>{ const ok=await saveStateImmediate(); if(!ok){ debouncedCloudSave(); setToast("Guardado localmente; confirmando en la nube..."); } })(); break; }
      case "show-renewal-change-plan":renewModalChangePlan=true; render(); break;
      case "renewal-back-options":    renewModalChangePlan=false; render(); break;
      case "confirm-renewal-plan":    { const stPlan=getStudent(renewModalStudentId); if(!confirmRenewalDataLoss(stPlan)) break; renewStudent(renewModalStudentId,false,action.dataset.plan); renewModalStudentId=null; renewModalChangePlan=false; render(); (async()=>{ const ok=await saveStateImmediate(); if(!ok){ debouncedCloudSave(); setToast("Guardado localmente; confirmando en la nube..."); } })(); break; }
      case "confirm-renewal-individual": { const stInd=getStudent(renewModalStudentId); if(!confirmRenewalDataLoss(stInd)) break; renewStudent(renewModalStudentId,false,"1_practica"); renewModalStudentId=null; renewModalChangePlan=false; render(); (async()=>{ const ok=await saveStateImmediate(); if(!ok){ debouncedCloudSave(); setToast("Guardado localmente; confirmando en la nube..."); } })(); break; }
      case "add-one-class": { const stAdd=getStudent(renewModalStudentId); if(stAdd){ stAdd.bonusClasses=(Number(stAdd.bonusClasses||0)+1); stAdd.updatedAt=new Date().toISOString(); setToast("1 clase extra sumada a "+stAdd.name+". Total disponibles: "+(remainingClasses(stAdd)+1)); } renewModalStudentId=null; renewModalChangePlan=false; render(); (async()=>{ const ok=await saveStateImmediate(); if(!ok){ debouncedCloudSave(); setToast("Guardado localmente; confirmando en la nube..."); } })(); break; }
      case "remove-one-class": { const stRem=getStudent(renewModalStudentId); if(stRem){ stRem.bonusClasses=(Number(stRem.bonusClasses||0)-1); stRem.updatedAt=new Date().toISOString(); setToast("1 clase quitada del plan de "+stRem.name+". Clases disponibles: "+remainingClasses(stRem)); } renewModalStudentId=null; renewModalChangePlan=false; render(); (async()=>{ const ok=await saveStateImmediate(); if(!ok){ debouncedCloudSave(); setToast("Guardado localmente; confirmando en la nube..."); } })(); break; }
      case "adjust-used-classes": {
        const stUso=getStudent(renewModalStudentId);
        if(stUso){
          const usadasActuales=Number(stUso.classesUsed||0);
          const total=planTotal(stUso);
          const input=window.prompt(`¿Cuantas clases ha visto REALMENTE ${stUso.name} hasta ahora? (revisa su historial en Reportes si tienes dudas)\n\nAhora mismo el sistema tiene registradas ${usadasActuales} de ${total} totales. El total del plan (${total}) NO cambia, solo se corrige cuantas de esas ya vio.`, String(usadasActuales));
          if(input!==null && input.trim()!==""){
            const nuevasUsadas=Math.round(Number(input));
            if(!isNaN(nuevasUsadas) && nuevasUsadas>=0){
              stUso.classesUsed=nuevasUsadas;
              stUso.updatedAt=new Date().toISOString();
              setToast(`${stUso.name}: ahora ${nuevasUsadas}/${total} vistas, ${remainingClasses(stUso)} por ver.`);
              (async()=>{ const ok=await saveStateImmediate(); if(!ok){ debouncedCloudSave(); setToast("Guardado localmente; confirmando en la nube..."); } })();
            } else {
              setToast("Ingresa un numero valido (0 o mas).");
            }
          }
        }
        renewModalStudentId=null; renewModalChangePlan=false; render(); break;
      }
      case "adjust-total-classes": {
        const stAdj=getStudent(renewModalStudentId);
        if(stAdj){
          const base=planBaseClasses(stAdj);
          const actual=planTotal(stAdj);
          const faltantesActuales=remainingClasses(stAdj);
          const input=window.prompt(`⚠️ Si quieres REGALAR clases, cancela y usa el boton "Regalar 1 clase" en su lugar.\n\nEsta opcion es solo para corregir el total cuando ya no coincide con la realidad (ej. quedo mal por un error anterior).\n\n¿Cuantas clases en TOTAL debe tener ${stAdj.name} en su plan actual? (ahora mismo tiene ${actual})\n\nLas clases que le FALTAN por ver (ahora mismo ${faltantesActuales}) se mantienen igual. Solo se recalculan las "usadas" para que el total cuadre.\n\nEl plan "${PLAN_LABELS[stAdj.planType]||stAdj.planType}" trae ${base} clases de base.`, String(actual));
          if(input!==null && input.trim()!==""){
            const nuevoTotal=Math.round(Number(input));
            if(!isNaN(nuevoTotal) && nuevoTotal>=0){
              const nuevasUsadas=Math.max(0, nuevoTotal-faltantesActuales);
              stAdj.classesUsed=nuevasUsadas;
              stAdj.bonusClasses=nuevoTotal-base;
              stAdj.updatedAt=new Date().toISOString();
              setToast(`${stAdj.name}: ahora ${nuevoTotal} clases en total, ${remainingClasses(stAdj)} por ver (sin cambiar lo que aun le falta).`);
              (async()=>{ const ok=await saveStateImmediate(); if(!ok){ debouncedCloudSave(); setToast("Guardado localmente; confirmando en la nube..."); } })();
            } else {
              setToast("Ingresa un numero valido (0 o mas).");
            }
          }
        }
        renewModalStudentId=null; renewModalChangePlan=false; render(); break;
      }

      case "go-checkin": activeView="checkin"; render(); break;
      case "filter-plan-anual": activeView="students"; studentFilters={search:"",plan:"anual",status:"all"}; render(); break;
      case "go-expiring": activeView="expiring"; expiringFilter="all"; render(); window.scrollTo({top:0}); break;
      case "expiring-filter": activeView="expiring"; expiringFilter=action.dataset.filter||"all"; render(); break;
      case "go-register": activeView="register"; render(); break;
      case "go-events":  activeView="events";  render(); break;
      case "go-reports": activeView="reports"; render(); break;

      case "share-register-link": {
        const regUrl="https://app-acqua.netlify.app/registro-acqua.html";
        const regMsg="Hola! Para inscribirte en ACQUA NATACION por favor llena el formulario de registro en el siguiente enlace:\n\n"+regUrl+"\n\nCon esto quedas registrado en nuestro sistema y te asignamos tu codigo de carnet.\n\nRecuerda: todos los planes tienen 30 dias de vigencia contados a partir de tu primera clase.\n\nCualquier duda estamos a tu disposicion.";
        window.open("https://wa.me/?text="+encodeURIComponent(regMsg),"_blank","noopener");
        break;
      }
      case "new-student":    editingStudentId=null; studentsFormVisible=true; render(); window.requestAnimationFrame(()=>{ const el=document.querySelector('#studentForm [name="name"]'); if(el){el.focus();el.select();} }); break;
      case "edit-student":   editingStudentId=id; studentsFormVisible=true; activeView="students"; render(); window.requestAnimationFrame(()=>document.querySelector('#studentForm [name="name"]')?.focus()); break;
      case "cancel-edit":    editingStudentId=null; studentsFormVisible=false; render(); break;
      case "toggle-students-form": studentsFormVisible=!studentsFormVisible; if(!studentsFormVisible)editingStudentId=null; render(); break;
      case "register-class":  registerClass(id,"manual"); break;
      case "notify-student":  notifyWhatsApp(getStudent(id)); break;
      case "notify-vencimiento": notifyVencimiento(getStudent(id)); break;
      case "send-carnet-whatsapp": {
        const stC=getStudent(id); if(!stC) break;
        const carnetUrl="https://app-acqua.netlify.app/carnet-acqua.html?alumno="+encodeURIComponent(stC.code);
        const rawC=String(stC.phone||"").trim(); const hasC=rawC.startsWith("+"); const digC=rawC.replace(/\D/g,""); let phoneC; if(hasC||digC.length>10){phoneC=digC;}else if(digC.length===10&&digC.startsWith("3")){phoneC="57"+digC;}else{phoneC=digC;}
        const msgC="Hola "+stC.name.split(" ")[0]+"! Te enviamos tu carnet digital de ACQUA NATACION:\n\n"+carnetUrl+"\n\nAbre el enlace para ver tu carnet y guardarlo como imagen en tu celular. Con el codigo QR registras tu asistencia a clases.\n\nRecuerda: tu plan tiene "+textoVigencia(stC.planType)+" de vigencia a partir de tu primera clase"+(()=>{ const v=calcularVencimiento(stC); return v?" (vence el "+new Intl.DateTimeFormat("es-CO",{day:"numeric",month:"long"}).format(v)+")":""; })()+".";
        if(phoneC) window.open("https://wa.me/"+phoneC+"?text="+encodeURIComponent(msgC),"_blank","noopener");
        else { navigator.clipboard?.writeText(carnetUrl).catch(()=>{}); setToast("Sin telefono. Enlace copiado: "+carnetUrl); }
        break;
      }
      case "renew-all":       renewAllActive(); break;
      case "pause-student":   pauseStudent(id); break;
      case "open-pay-modal":  { payModalStudentId=id; const d=document.createElement("div"); d.innerHTML=renderPayModal(id); document.body.appendChild(d.firstElementChild); break; }
      case "close-pay-modal": { payModalStudentId=null; document.getElementById("payModal")?.remove(); break; }
      case "delete-payment":  { deletePayment(action.dataset.studentId,Number(action.dataset.payIdx)); break; }
      case "delete-student":   deleteStudent(id); break;
      case "delete-attendance": deleteAttendance(action.dataset.attId); break;
      case "open-student-waiver": { const wDiv=document.createElement("div"); wDiv.innerHTML=renderStudentWaiverModal(id); document.body.appendChild(wDiv.firstElementChild); break; }
      case "close-student-waiver": document.getElementById("studentWaiverModal")?.remove(); break;
      case "send-waiver-whatsapp": {
        const stWA=getStudent(id); if(!stWA) break;
        if(stWA.waiver){ setToast("Este alumno ya firmo el "+stWA.waiver.signedAt); break; }
        const firmaUrl="https://app-acqua.netlify.app/firma-acqua.html?alumno="+encodeURIComponent(stWA.code);
        const rawWA=String(stWA.phone||"").trim(); const hasWA=rawWA.startsWith("+"); const digWA=rawWA.replace(/\D/g,""); let phoneWA; if(hasWA||digWA.length>10){phoneWA=digWA;}else if(digWA.length===10&&digWA.startsWith("3")){phoneWA="57"+digWA;}else{phoneWA=digWA;}
        const msgWA="Hola "+stWA.name+". Te enviamos el documento de exoneracion y autorizacion de ACQUA NATACION. Por favor revisalo y firmalo digitalmente en el siguiente enlace:\n\n"+firmaUrl+"\n\nEste documento es obligatorio para participar en las clases.";
        if(phoneWA) window.open("https://wa.me/"+phoneWA+"?text="+encodeURIComponent(msgWA),"_blank","noopener");
        else { setToast("El alumno no tiene telefono registrado. Copia: "+firmaUrl); }
        break;
      }
      case "reset-student-waiver": { const stW=getStudent(action.dataset.id||id); if(stW&&window.confirm("Restablecer la firma de "+stW.name+"?")){ delete stW.waiver; saveState(); document.getElementById("studentWaiverModal")?.remove(); setToast("Firma restablecida."); } break; }
      case "activate-student":activateStudent(id); break;

      case "start-scanner": startScanner(); break;
      case "stop-scanner":  stopScanner(true); break;
      case "print-cards":   window.print(); break;
      case "print-one-card": imprimirCarnet(id); break;

      case "view-event":           activeView="events"; activeEventId=id; eventEditId=null; eventEnrollSearch=""; render(); break;
      case "back-events":          activeEventId=null; signatureDraft=null; eventEditId=null; attendeeDataDraft=null; eventEnrollSearch=""; render(); break;
      case "edit-event":           eventEditId=id; render(); break;
      case "waiver-select": { const nuevo=(id==="general"?"general":"travesia"); if(nuevo===waiverEditId) break; if(wzDirty()&&!window.confirm("Tienes cambios sin guardar. Cambiar de documento y perderlos?")) break; waiverDraft=null; waiverEditId=nuevo; render(); break; }
      case "waiver-restore":       restaurarDocumento(); break;
      case "waiver-preview":       previewDocumento(); break;
      case "cancel-edit-event":    eventEditId=null; render(); break;
      case "duplicate-event":      duplicateEvent(id); break;
      case "preview-event-link":   window.open("https://app-acqua.netlify.app/evento-acqua.html?evento="+encodeURIComponent(id),"_blank","noopener"); break;
      case "fill-includes-travesia": { const fm=action.closest("form"); const ta=fm&&fm.querySelector('[name="eventIncluye"]'); if(ta&&(!ta.value.trim()||window.confirm("Reemplazar lo que ya escribiste por la lista de la Travesia?"))){ ta.value=INCLUYE_TRAVESIA; const sel=fm.querySelector('[name="eventTipo"]'); if(sel) sel.value="travesia"; initInclEditor(fm); } break; }
      case "view-attendee-data":   attendeeDataDraft={eventId:action.dataset.eventId,attendeeId:action.dataset.attendeeId}; render(); break;
      case "close-attendee-data":  if(action.classList.contains("modal-backdrop")&&event.target!==action) break; attendeeDataDraft=null; render(); break;
      case "enroll-event-pick":    enrollEventStudent(eventId,id); break;
      case "events-view-list":     calendarView="list"; render(); break;
      case "events-view-calendar": calendarView="calendar"; render(); break;
      case "cal-prev":             { const cm=getCalMonth(); calendarMonth=new Date(cm.getFullYear(),cm.getMonth()-1,1); render(); break; }
      case "cal-next":             { const cm2=getCalMonth(); calendarMonth=new Date(cm2.getFullYear(),cm2.getMonth()+1,1); render(); break; }
      case "delete-internal-event":{ if(!window.confirm("Eliminar este evento interno?")) break; state.internalEvents=(state.internalEvents||[]).filter(e=>e.id!==id); saveState(); setToast("Evento interno eliminado."); render(); deleteRow("internal_events","id",id); break; }
      case "delete-event":         deleteEvent(id); break;
      case "toggle-event-paid":    toggleEventPaid(eventId,attendeeId); break;
      case "remove-event-attendee": removeEventAttendee(eventId,attendeeId); break;
      case "open-signature":       signatureDraft={eventId,attendeeId}; render(); break;
      case "close-signature":      signatureDraft=null; render(); break;

      case "export-json":    exportJson(); if(activeView==="settings") render(); break;
      case "export-csv":     exportCsv(); break;
      case "export-event-xlsx": exportEventXlsx(id); break;
      case "share-event-link": {
        const evShare=getEvent(id); if(!evShare) break;
        // Asegurar que el evento ya este en la nube antes de que alguien abra el enlace (sin esperar, para no perder el permiso de abrir WhatsApp)
        saveStateImmediate();
        const linkEv="https://app-acqua.netlify.app/evento-acqua.html?evento="+encodeURIComponent(evShare.id);
        const detalleEv=[evShare.date,evShare.place].filter(Boolean).join(", ");
        const msgEv="Hola! Te invitamos al evento *"+evShare.name+"* de ACQUA NATACION"+(detalleEv?" ("+detalleEv+")":"")+".\n\nPara inscribirte y firmar el documento de exoneracion, llena el formulario en este enlace:\n\n"+linkEv+"\n\nCon esto quedas inscrito y firmado. Cualquier duda estamos a tu disposicion.";
        window.open("https://wa.me/?text="+encodeURIComponent(msgEv),"_blank","noopener");
        break;
      }
      case "trigger-import": document.querySelector("#importFile")?.click(); break;
      case "load-demo":      loadDemoData(); break;
      case "clear-data":     clearData(); break;
    }
  });

  document.addEventListener("submit",event=>{
    event.preventDefault();
    const form=event.target;
    if(form.id==="loginForm"){ const fd=new FormData(form); login(ADMIN_EMAIL,String(fd.get("password")||"")); return; }
    if(form.id==="studentForm")       { saveStudent(form); return; }
    if(form.id==="studentFormPublic") { saveStudentPublic(form); return; }
    if(form.id==="eventForm")         { saveEvent(form); return; }
    if(form.id==="eventEditForm")     { updateEvent(form); return; }
    if(form.id==="waiverForm")        { guardarDocumentoForm(form); return; }
    if(form.id==="eventGuestForm")    { const fd=new FormData(form); enrollEventGuest(String(fd.get("eventId")||""),String(fd.get("guestName")||""),String(fd.get("guestAge")||""),String(fd.get("guestPhone")||"")); form.reset(); return; }
    if(form.id==="internalEventForm") { saveInternalEvent(form); return; }
    if(form.id==="signatureForm")  { saveSignature(form); return; }
    if(form.id==="settingsAuthForm"){
      const fd=new FormData(form); const pass=String(fd.get("settingsPass")||"");
      if(!_supa){ setToast("Sin conexion. No se puede verificar."); return; }
      _supa.auth.signInWithPassword({ email:ADMIN_EMAIL, password:pass })
        .then(({ error })=>{ if(error) setToast("Contrasena incorrecta."); else { settingsUnlocked=true; setToast("Acceso a ajustes concedido."); render(); } })
        .catch(()=>setToast("Error de conexion al verificar."));
      return;
    }
    if(form.id==="payForm"){ savePayment(form); return; }
    if(form.id==="studentWaiverForm"){ saveStudentWaiver(form); return; }
    if(form.id==="settingsForm")   { const fd=new FormData(form); state.currentMonth=String(fd.get("currentMonth")||monthKey(new Date())); saveState(); setToast("Ajustes guardados."); render(); return; }
    if(form.dataset.form==="quick-search"){
      const match=filteredStudents({search:checkinSearch,status:"active"})[0];
      if(match) showCheckinScreen(match,"manual");
      else { const byPayload=findByQrPayload(checkinSearch); if(byPayload)showCheckinScreen(byPayload,"manual"); else setToast("No encontre un alumno para registrar."); }
    }
  });

  document.addEventListener("keydown",e=>{ if(e.key==="Escape"&&attendeeDataDraft){ attendeeDataDraft=null; render(); } });

  document.addEventListener("input",event=>{
    const target=event.target;
    if(target.matches("[data-filter='students-search']")){ studentFilters.search=target.value; debouncedPreserveFocus("[data-filter='students-search']"); return; }
    if(target.matches("[data-filter='checkin-search']")){ checkinSearch=target.value; debouncedPreserveFocus("[data-filter='checkin-search']"); return; }
    if(target.matches("[data-filter='cards-search']")){ cardSearch=target.value; debouncedPreserveFocus("[data-filter='cards-search']"); return; }
    if(target.matches("[data-filter='reports-search']")){ reportsSearch=target.value; debouncedPreserveFocus("[data-filter='reports-search']"); return; }
    if(target.matches("[data-filter='expiring-search']")){ expiringSearch=target.value; debouncedPreserveFocus("[data-filter='expiring-search']"); return; }
    if(target.matches("[data-filter='event-enroll-search']")){ eventEnrollSearch=target.value; debouncedPreserveFocus("[data-filter='event-enroll-search']"); }
  });

  document.addEventListener("change",event=>{
    const target=event.target;
    if(target===globalMonth){ state.currentMonth=target.value||monthKey(new Date()); saveState(); render(); return; }
    if(target.matches("[data-filter='students-plan']"))  { studentFilters.plan=target.value; render(); return; }
    if(target.matches("[data-filter='students-status']")){ studentFilters.status=target.value; render(); return; }
    if(target.matches("[data-plan-select]")){ const cf=document.querySelector("[data-custom-classes]"); if(cf)cf.hidden=target.value!=="custom"; return; }
    if(target.id==="importFile"&&target.files?.[0]){ importJson(target.files[0]); target.value=""; }
  });

  /* (el cambio de mes operativo se maneja en el listener "change" general) */
  window.addEventListener("beforeunload",()=>{ stopScanner(false); if(_cloudSaveTimer){ clearTimeout(_cloudSaveTimer); _cloudSaveTimer=null; cloudSave(); } });

  /* Boton flotante "volver arriba": aparece en cualquier vista despues de
     bajar un poco, y sube suavemente al inicio de la pagina al tocarlo. */
  (function initScrollTopBtn(){
    const btn=document.getElementById("scrollTopBtn");
    if(!btn) return;
    window.addEventListener("scroll",()=>{
      if(window.scrollY>320) btn.classList.add("is-visible");
      else btn.classList.remove("is-visible");
    }, { passive:true });
    btn.addEventListener("click",()=>{
      window.scrollTo({ top:0, behavior:"smooth" });
    });
  })();

  /* GENERACION DE QR (no modificar) */
  function qrSvg(text){ const modules=qrMatrix(text); const border=4; const size=modules.length+border*2; const dark=[]; for(let y=0;y<modules.length;y++)for(let x=0;x<modules.length;x++)if(modules[y][x])dark.push(`M${x+border},${y+border}h1v1h-1z`); return `<svg viewBox="0 0 ${size} ${size}" role="img" aria-label="Codigo QR"><rect width="${size}" height="${size}" fill="#fff"></rect><path d="${dark.join(" ")}" fill="#111827"></path></svg>`; }
  function qrMatrix(text){ const masks=Array.from({length:8},(_,mask)=>buildQrMatrix(text,mask)); masks.sort((a,b)=>penaltyScore(a)-penaltyScore(b)); return masks[0]; }
  function buildQrMatrix(text,mask){
    const version=4,size=version*4+17,dataCodewords=80,eccCodewords=20;
    const modules=Array.from({length:size},()=>Array(size).fill(false));
    const reserved=Array.from({length:size},()=>Array(size).fill(false));
    function setFunction(x,y,dark){modules[y][x]=Boolean(dark);reserved[y][x]=true;}
    function reserve(x,y){reserved[y][x]=true;}
    drawFinder(0,0);drawFinder(size-7,0);drawFinder(0,size-7);drawAlignment(26,26);drawTiming();reserveFormat();setFunction(8,size-8,true);
    const data=encodeQrData(text,dataCodewords);
    const ecc=reedSolomonRemainder(data,eccCodewords);
    const codewords=data.concat(ecc);
    placeData(codewords);drawFormatBits(mask);
    return modules;
    function drawFinder(left,top){for(let dy=-1;dy<=7;dy++)for(let dx=-1;dx<=7;dx++){const x=left+dx,y=top+dy;if(x<0||y<0||x>=size||y>=size)continue;const dark=dx>=0&&dx<=6&&dy>=0&&dy<=6&&(dx===0||dx===6||dy===0||dy===6||(dx>=2&&dx<=4&&dy>=2&&dy<=4));setFunction(x,y,dark);}}
    function drawAlignment(cx,cy){for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)setFunction(cx+dx,cy+dy,Math.max(Math.abs(dx),Math.abs(dy))!==1);}
    function drawTiming(){for(let i=8;i<size-8;i++){setFunction(i,6,i%2===0);setFunction(6,i,i%2===0);}}
    function reserveFormat(){for(let i=0;i<=8;i++)if(i!==6){reserve(8,i);reserve(i,8);}for(let i=0;i<8;i++)reserve(size-1-i,8);for(let i=0;i<7;i++)reserve(8,size-1-i);}
    function placeData(codewords){let bitIndex=0,upward=true;for(let right=size-1;right>=1;right-=2){if(right===6)right-=1;for(let vertical=0;vertical<size;vertical++){const y=upward?size-1-vertical:vertical;for(let column=0;column<2;column++){const x=right-column;if(reserved[y][x])continue;const bit=bitIndex<codewords.length*8?((codewords[Math.floor(bitIndex/8)]>>>(7-(bitIndex%8)))&1)===1:false;modules[y][x]=bit!==maskBit(mask,x,y);bitIndex++;}}upward=!upward;}}
    function drawFormatBits(maskValue){const bits=formatBits(1,maskValue);for(let i=0;i<=5;i++)setFunction(8,i,bitAt(bits,i));setFunction(8,7,bitAt(bits,6));setFunction(8,8,bitAt(bits,7));setFunction(7,8,bitAt(bits,8));for(let i=9;i<15;i++)setFunction(14-i,8,bitAt(bits,i));for(let i=0;i<8;i++)setFunction(size-1-i,8,bitAt(bits,i));for(let i=8;i<15;i++)setFunction(8,size-15+i,bitAt(bits,i));setFunction(8,size-8,true);}
  }
  function encodeQrData(text,dataCodewords){const bytes=Array.from(new TextEncoder().encode(text));if(bytes.length>78)throw new Error("QR payload too long");const bits=[];appendBits(bits,0b0100,4);appendBits(bits,bytes.length,8);bytes.forEach(b=>appendBits(bits,b,8));const capacity=dataCodewords*8;appendBits(bits,0,Math.min(4,capacity-bits.length));while(bits.length%8)bits.push(0);const codewords=[];for(let i=0;i<bits.length;i+=8){let v=0;for(let j=0;j<8;j++)v=(v<<1)|bits[i+j];codewords.push(v);}for(let pad=0xec;codewords.length<dataCodewords;pad=pad===0xec?0x11:0xec)codewords.push(pad);return codewords;}
  function appendBits(target,value,length){for(let i=length-1;i>=0;i--)target.push((value>>>i)&1);}
  function formatBits(ecBits,mask){const data=(ecBits<<3)|mask;let r=data<<10;for(let i=14;i>=10;i--)if(((r>>>i)&1)!==0)r^=0x537<<(i-10);return((data<<10)|r)^0x5412;}
  function bitAt(value,index){return((value>>>index)&1)!==0;}
  function maskBit(mask,x,y){switch(mask){case 0:return(x+y)%2===0;case 1:return y%2===0;case 2:return x%3===0;case 3:return(x+y)%3===0;case 4:return(Math.floor(y/2)+Math.floor(x/3))%2===0;case 5:return((x*y)%2)+((x*y)%3)===0;case 6:return(((x*y)%2)+((x*y)%3))%2===0;case 7:return(((x+y)%2)+((x*y)%3))%2===0;default:return false;}}
  function penaltyScore(modules){const size=modules.length;let score=0;for(let y=0;y<size;y++){let rc=modules[y][0],rl=1;for(let x=1;x<size;x++){if(modules[y][x]===rc){rl++;if(rl===5)score+=3;else if(rl>5)score+=1;}else{rc=modules[y][x];rl=1;}}}for(let x=0;x<size;x++){let rc=modules[0][x],rl=1;for(let y=1;y<size;y++){if(modules[y][x]===rc){rl++;if(rl===5)score+=3;else if(rl>5)score+=1;}else{rc=modules[y][x];rl=1;}}}for(let y=0;y<size-1;y++)for(let x=0;x<size-1;x++){const c=modules[y][x];if(c===modules[y][x+1]&&c===modules[y+1][x]&&c===modules[y+1][x+1])score+=3;}const pattern=[true,false,true,true,true,false,true,false,false,false,false];for(let y=0;y<size;y++)for(let x=0;x<=size-pattern.length;x++)if(pattern.every((c,i)=>modules[y][x+i]===c))score+=40;for(let x=0;x<size;x++)for(let y=0;y<=size-pattern.length;y++)if(pattern.every((c,i)=>modules[y+i][x]===c))score+=40;const dark=modules.flat().filter(Boolean).length;score+=Math.floor(Math.abs((dark*100)/(size*size)-50)/5)*10;return score;}
  const gfExp=Array(512).fill(0),gfLog=Array(256).fill(0);
  let gfValue=1;
  for(let i=0;i<255;i++){gfExp[i]=gfValue;gfLog[gfValue]=i;gfValue<<=1;if(gfValue&0x100)gfValue^=0x11d;}
  for(let i=255;i<gfExp.length;i++)gfExp[i]=gfExp[i-255];
  function gfMultiply(l,r){if(l===0||r===0)return 0;return gfExp[gfLog[l]+gfLog[r]];}
  function reedSolomonDivisor(degree){const result=Array(degree).fill(0);result[degree-1]=1;let root=1;for(let i=0;i<degree;i++){for(let j=0;j<result.length;j++){result[j]=gfMultiply(result[j],root);if(j+1<result.length)result[j]^=result[j+1];}root=gfMultiply(root,0x02);}return result;}
  function reedSolomonRemainder(data,degree){const divisor=reedSolomonDivisor(degree),result=Array(degree).fill(0);data.forEach(byte=>{const factor=byte^result.shift();result.push(0);divisor.forEach((c,i)=>{result[i]^=gfMultiply(c,factor);});});return result;}

  /* IMPRIMIR CARNET INDIVIDUAL */
  function imprimirCarnet(studentId){
    const article=document.getElementById("card-"+studentId);
    if(!article){ setToast("No se encontro el carnet."); return; }
    const imgSrc=article.querySelector("img")?.src||"";
    const svgEl=article.querySelector("svg");
    const svgHtml=svgEl?svgEl.outerHTML:"";
    const student=getStudent(studentId);
    if(!student){ setToast("Alumno no encontrado."); return; }
    const parts=student.name.toUpperCase().trim().split(/\s+/);
    const splitIdx=parts.length>=4?2:1;
    const nombres=parts.slice(0,splitIdx).join(" ");
    const apellidos=parts.slice(splitIdx).join(" ");
    const cat={Nino:"Infantil",Adulto:"Adulto",Matronatacion:"Matronatacion","Practica libre":"Practica libre"}[student.category]||student.category||"";
    const win=window.open("","_blank","width=360,height=620");
    if(!win){ setToast("Permite ventanas emergentes en tu navegador para imprimir carnets."); return; }
    const html="<!DOCTYPE html><html><head><meta charset='utf-8'><title>Carnet "+student.name+"</title>"
      +"<style>*{margin:0;padding:0;box-sizing:border-box}"
      +"body{background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;padding:16px;gap:14px;font-family:sans-serif}"
      +"@media print{body{padding:0} .noprint{display:none!important} @page{size:270px 480px;margin:0}}"
      +"article{position:relative;width:270px;height:450px;border-radius:18px;overflow:hidden;flex-shrink:0}"
      +".bg{position:absolute;inset:0;width:100%;height:100%;object-fit:fill}"
      +".qr{position:absolute;top:15%;left:50%;transform:translateX(-50%);width:71%;border-radius:10px;overflow:hidden;background:#fff;line-height:0}"
      +".qr svg{width:100%;height:auto;display:block}"
      +".nombre{position:absolute;top:71%;left:0;right:0;text-align:center;padding:0 8px;color:#0a2472;font-weight:800;letter-spacing:.04em;line-height:1.3}"
      +".n1,.n2{font-size:1.15rem;display:block}"
      +".cat{font-size:.78rem;font-weight:600;color:#1565c0;margin-top:3px;display:block}"
      +".cod{font-size:.68rem;font-weight:700;color:#0a2472;margin-top:3px;display:block;letter-spacing:.08em}"
      +".dias{font-size:.68rem;font-weight:600;color:#0a2472;margin:3px auto 0;display:block;max-width:150px}"
      +".fund{position:absolute;bottom:3%;left:0;right:0;text-align:center;font-size:.62rem;color:#6688bb;letter-spacing:.18em;font-weight:700}"
      +"button{padding:11px 28px;background:#0a2472;color:#fff;border:none;border-radius:12px;font-size:.95rem;font-weight:700;cursor:pointer}"
      +"</style></head><body>"
      +"<article>"
      +"<img class='bg' src='"+imgSrc+"' alt=''>"
      +"<div class='qr'>"+svgHtml+"</div>"
      +"<div class='nombre'>"
      +"<span class='n1'>"+nombres+"</span>"
      +(apellidos?"<span class='n2'>"+apellidos+"</span>":"")
      +"<span class='cat'>"+cat+"</span>"
      +"<span class='cod'>"+student.code+"</span>"
      +"<span class='dias'>"+(diasVigenciaPlan(student.planType)>=365?"Vigencia: 1 año":"Vigencia: "+diasVigenciaPlan(student.planType)+" días")+"<br><span style='font-weight:500'>desde tu primera clase</span></span>"
      +"</div>"
      +"<span class='fund'>DESDE 2015</span>"
      +"</article>"
      +"<button class='noprint' onclick='window.print()'>Guardar PDF / Imprimir</button>"
      +"</body></html>";
    win.document.write(html);
    win.document.close();
  }

  /* AUTO-CAMBIO DE MES ─────────────────────────────────────────────────────
     Si el mes real del computador es diferente al mes operativo, actualiza
     automáticamente y traslada las clases restantes de cada alumno          */
  function autoCheckMonth(){
    // El "mes operativo" es solo para efectos de reportes. Los planes de cada
    // alumno vencen por fecha real (inicio + dias de su plan), NUNCA por mes
    // calendario, asi que aqui ya NO se trasladan ni se suman clases: eso fue
    // lo que causaba que a algunos alumnos les aparecieran clases de mas.
    const realMonth = monthKey(new Date());
    if(state.currentMonth === realMonth) return;
    state.currentMonth = realMonth;
    saveState();
    setToast("Mes de reporte actualizado a "+monthLabel(realMonth)+".");
    render();
  }
  /* NOTA: la limpieza automatica de "clases bonus historicas" que existia aqui
     se elimino porque guardaba su bandera de "ya se corrio" en el navegador
     de cada dispositivo por separado. Como la app se usa desde varios
     dispositivos con la misma nube, volvia a ejecutarse en cada dispositivo
     nuevo y borraba clases bonus legitimas (ej. las 4 clases de regalo al
     equipo de 13). La causa original de datos corruptos (el auto-traslado de
     clases por cambio de mes) ya esta eliminada desde la raiz, asi que ya no
     hace falta ninguna limpieza automatica en cada arranque. */

  /* ARRANQUE — verificar sesion activa en Supabase antes de renderizar */
  (async function iniciar(){
    if(_supa){
      try {
        const { data:{ session } } = await _supa.auth.getSession();
        if(session){ isAuthenticated=true; loginModalVisible=false; }
      } catch(e){ console.error("getSession:",e); }
    }
    render();
    updateSyncDot();
    if(isAuthenticated){ await syncFromCloud(); }
    // Un unico listener de visibilidad: SIEMPRE espera a que la nube sincronice
    // antes de correr autoCheckMonth(), para nunca operar sobre datos viejos.
    document.addEventListener("visibilitychange", async ()=>{
      if(document.visibilityState==="visible"&&CLOUD_ENABLED&&isAuthenticated){
        await syncFromCloud();
        autoCheckMonth();
      } else if(document.visibilityState==="hidden"&&CLOUD_ENABLED&&isAuthenticated&&_cloudSaveTimer){
        // Si se cambia de app o se bloquea el celular con un guardado pendiente
        // en cola (ej. justo despues de registrar una clase o un alumno),
        // se fuerza de inmediato en vez de arriesgarse a que el navegador
        // suspenda la pestana antes de que el guardado normal se dispare solo.
        clearTimeout(_cloudSaveTimer); _cloudSaveTimer=null;
        cloudSave();
      }
    });
    if(CLOUD_ENABLED) setInterval(()=>{ if(isAuthenticated) syncFromCloud(); },30_000);
    // Verificar cambio de mes cada hora (tambien espera sync primero)
    setInterval(async ()=>{ if(isAuthenticated){ await syncFromCloud(); autoCheckMonth(); } },3_600_000);
  })();

  /* Datos de solo lectura para el buscador rapido (Ctrl+K) de la navegacion */
  window.acquaPalette={
    ready:()=>isAuthenticated,
    students:()=>state.students.map(st=>({ id:st.id, name:st.name, code:st.code, phone:st.phone||"", active:st.status==="active", remaining:remainingClasses(st), plan:PLAN_LABELS[st.planType]||"" })),
    expiring:()=>isAuthenticated?expiringData().urgent:0
  };

  /* CHECK-IN POR URL (?checkin=AC-0001) */
  (function handleUrlCheckin(){
    const params=new URLSearchParams(window.location.search);
    const code=params.get("checkin");
    if(!code) return;
    window.history.replaceState({},"",window.location.pathname);
    function showNotFound(code){
      const overlay=document.createElement("div");
      overlay.id="checkin-overlay";
      overlay.innerHTML=`<div class="checkin-modal"><div class="checkin-top is-neutral"><div class="checkin-check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8v5M12 16.5v.5"/></svg></div><h2 class="checkin-name">Carnet no encontrado</h2><p class="checkin-code">CODIGO: ${escapeHtml(code)}</p><svg class="wave" viewBox="0 0 400 34" preserveAspectRatio="none"><path d="M0 18 C70 2 130 34 200 18 S330 2 400 18 V34 H0Z" fill="#fff"/></svg></div><div class="checkin-body" style="margin-top:6px"><p style="color:var(--muted);font-size:.88rem;margin:0 0 16px">Verifica que el alumno este registrado en el sistema.</p></div><div class="checkin-actions"><button class="btn primary lg" onclick="document.getElementById('checkin-overlay').remove()">Cerrar</button></div></div>`;
      document.body.appendChild(overlay);
    }
    function tryFind(attemptsLeft){
      const student=state.students.find(s=>String(s.code||"").toUpperCase()===code.toUpperCase());
      if(student) showCheckinScreen(student,"qr-url");
      else if(attemptsLeft>0) setTimeout(()=>tryFind(attemptsLeft-1),500);
      else showNotFound(code);
    }
    setTimeout(()=>tryFind(12),1000);
  })();

})();
