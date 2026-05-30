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
    "matronat_4":    "Matronatacion 4 clases/mes",
    "matronat_8":    "Matronatacion 8 clases/mes",
    "anual":         "Plan anual",
    "obsequio_1":    "Obsequio 1 clase",
    "obsequio_2":    "Obsequio 2 clases",
    "obsequio_3":    "Obsequio 3 clases",
    custom:          "Personalizado",
  };
  const PLAN_CLASSES = { "1_practica":1,"1_grupal":1,"1_matronat":1,"4":4,"9":9,"8_practicas":8,"13":13,"matronat_4":4,"matronat_8":8,"anual":100,"obsequio_1":1,"obsequio_2":2,"obsequio_3":3 };

  const app               = document.querySelector("#app");
  const toast             = document.querySelector("#toast");
  const globalMonth       = document.querySelector("#globalMonth");
  const businessNameLabel = document.querySelector("#businessNameLabel");

  let activeView          = "checkin";
  let editingStudentId    = null;
  let activeEventId       = null;
  let signatureDraft      = null;
  let studentsFormVisible = false;
  let cloudStatus         = CLOUD_ENABLED ? "connecting" : "disabled";
  let state               = loadState();
  let studentFilters      = { search: "", plan: "all", status: "active" };
  let checkinSearch       = "";
  let cardSearch          = "";
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
  };

  function icon(name) {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || ""}</svg>`;
  }

  /* ESTADO */
  function loadState() {
    const fallback = { version:1, currentMonth: monthKey(new Date()), settings:{ businessName: DEFAULT_BUSINESS }, students:[], attendance:[], events:[] };
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
    if (CLOUD_ENABLED) debouncedCloudSave(state);
  }

  /* NUBE */
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
  async function cloudSave(snapshot) {
    if (!CLOUD_ENABLED || !isAuthenticated) return;
    cloudStatus = "syncing"; updateSyncDot();
    try {
      const authH = await getAuthHeader();
      const res = await fetch(SUPABASE_URL+"/rest/v1/app_state", { method:"POST", headers:{ "Content-Type":"application/json", "apikey":SUPABASE_ANON_KEY, "Authorization":authH, "Prefer":"resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ id:CLOUD_ROW_ID, data:snapshot, saved_at:new Date().toISOString() }) });
      if (!res.ok) throw new Error(res.status);
      cloudStatus = "ok";
    } catch(err){ console.error("cloudSave:",err); cloudStatus = "error"; }
    updateSyncDot();
  }
  let _cloudSaveTimer = null;
  function debouncedCloudSave(snapshot){ clearTimeout(_cloudSaveTimer); _cloudSaveTimer = setTimeout(()=>cloudSave(snapshot), 800); }
  async function cloudLoad() {
    if (!CLOUD_ENABLED || !isAuthenticated) return null;
    try {
      const authH = await getAuthHeader();
      const res = await fetch(SUPABASE_URL+"/rest/v1/app_state?id=eq."+encodeURIComponent(CLOUD_ROW_ID)+"&select=data", { cache:"no-store", headers:{ "apikey":SUPABASE_ANON_KEY, "Authorization":authH } });
      if (!res.ok){ console.warn("cloudLoad HTTP",res.status); return null; }
      const rows = await res.json();
      return rows[0]?.data ?? null;
    } catch(e){ console.error("cloudLoad:",e); return null; }
  }
  async function syncFromCloud() {
    const cloudData = await cloudLoad();
    if (cloudData && Array.isArray(cloudData.students)) {
      state = { version:1, currentMonth: cloudData.currentMonth||state.currentMonth, settings:{ businessName:DEFAULT_BUSINESS, ...(cloudData.settings||{}) }, students:cloudData.students, attendance:cloudData.attendance||[], events:Array.isArray(cloudData.events)?cloudData.events:[] };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      cloudStatus = "ok";
      if (!studentsFormVisible && !editingStudentId && !loginModalVisible) render();
    } else if (CLOUD_ENABLED) { cloudStatus = "ok"; }
    updateSyncDot();
  }

  /* UTILIDADES */
  function monthKey(date){ return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}`; }
  function dayKey(date)  { return date.toISOString().slice(0,10); }
  function monthLabel(key){ const [y,m]=key.split("-").map(Number); return new Intl.DateTimeFormat("es-CO",{month:"long",year:"numeric"}).format(new Date(y,m-1,1)); }
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

  /* LOGICA DE NEGOCIO */
  function planTotal(student){ if(!student)return 0; const base=student.planType==="custom"?Math.max(0,Number(student.customClasses||0)):Math.max(0,Number(PLAN_CLASSES[student.planType]||0)); return base+Math.max(0,Number(student.bonusClasses||0)); }
  function remainingClasses(student){ return planTotal(student)-Number(student.classesUsed||0); }
  function isRenewed(student){ return student.monthKey===state.currentMonth; }
  function studentStatusBadge(student){
    if(student.status!=="active") return '<span class="badge danger">Pausado</span>';
    if(!isRenewed(student)) return '<span class="badge warn">Renovar</span>';
    const r=remainingClasses(student);
    if(r<=0) return '<span class="badge danger">Sin clases</span>';
    if(r<=2) return '<span class="badge warn">Pocas clases</span>';
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
    if(btnLogin){ btnLogin.disabled=true; btnLogin.textContent="Verificando..."; }
    try {
      const { data, error } = await _supa.auth.signInWithPassword({ email, password: pass });
      if(error){
        setToast("Contrasena incorrecta. Intentalo de nuevo.");
        const form=document.getElementById("loginForm");
        if(form){ form.style.animation="none"; requestAnimationFrame(()=>{ form.style.animation="shake .35s ease"; }); }
        if(btnLogin){ btnLogin.disabled=false; btnLogin.innerHTML=btnLogin.innerHTML.replace("Verificando...","Ingresar"); }
        return;
      }
      isAuthenticated=true; loginModalVisible=false;
      const lm=document.getElementById("loginModal"); if(lm) lm.remove();
      if(activeView==="checkin") activeView="dashboard";
      render(); setToast("Bienvenido al panel de administracion");
      syncFromCloud();
    } catch(e){
      console.error("login:",e);
      setToast("Error de conexion. Verifica tu internet.");
      if(btnLogin){ btnLogin.disabled=false; }
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
    globalMonth.value=state.currentMonth;
    businessNameLabel.textContent=isAuthenticated?"Control de clases, QR y eventos":"Registro de asistencia";
    if(activeView!=="checkin") stopScanner(false);
    const renderers={ dashboard:renderDashboard, students:renderStudents, checkin:renderCheckin, cards:renderCards, events:renderEvents, reports:renderReports, settings:renderSettings, register:renderRegister };
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

    // Modal de login: inyectar en body directamente para que cubra todo
    const existingLoginModal=document.getElementById("loginModal");
    if(loginModalVisible && !existingLoginModal){
      const div=document.createElement("div");
      div.innerHTML=renderLoginModal();
      document.body.appendChild(div.firstElementChild);
      window.requestAnimationFrame(()=>document.querySelector("#loginForm [name='username']")?.focus());
    } else if(!loginModalVisible && existingLoginModal){
      existingLoginModal.remove();
    }

    // Si el scanner estaba activo y seguimos en checkin, reiniciarlo
    // (render() destruye el DOM incluyendo el video element)
    if(scannerEstabaActivo && activeView==="checkin"){
      setTimeout(()=>startScanner(),120);
    }
  }
  function renderOverlay(){ if(!signatureDraft)return ""; return renderSignatureModal(signatureDraft); }
  function renderHeader(title,subtitle,actions=""){ return `<div class="view-header"><div><h2>${escapeHtml(title)}</h2><p>${escapeHtml(subtitle)}</p></div><div class="toolbar">${actions}</div></div>`; }

  /* DASHBOARD */
  function renderDashboard(){
    const summary=stats();
    const recent=[...state.attendance].sort((a,b)=>new Date(b.at)-new Date(a.at)).slice(0,7);
    return `
      ${renderHeader("Panel de "+monthLabel(state.currentMonth),"Control mensual de cupos, asistencia y renovaciones.")}
      <section class="grid cols-4">
        ${statCard("Alumnos activos",summary.active,summary.renewed+" renovados este mes")}
        ${statCard("Clases usadas",summary.usedClasses,summary.remaining+" disponibles")}
        ${statCard("Check-ins de hoy",summary.today,summary.monthAttendance+" en el mes")}
        ${statCard("Por renovar",summary.pendingRenewal,summary.events+" eventos activos")}
      </section>
      <section class="grid cols-2" style="margin-top:16px">
        <div class="panel">
          <div class="panel-header"><div><h3>Check-in rapido</h3><p>Busca por nombre, telefono o codigo de carnet.</p></div>
            <button class="btn primary" type="button" data-action="go-checkin">${icon("scan")}Abrir QR</button></div>
          ${renderQuickSearch()}
        </div>
        <div class="panel">
          <div class="panel-header"><div><h3>Renovacion mensual</h3><p>${escapeHtml(monthLabel(state.currentMonth))}</p></div>
            <button class="btn accent" type="button" data-action="renew-all">${icon("refresh")}Renovar activos</button></div>
          ${renderRenewalSummary()}
        </div>
      </section>
      <section class="panel" style="margin-top:16px">
        <div class="panel-header"><div><h3>Ultimas clases registradas</h3><p>Movimientos recientes del control de asistencia.</p></div>
          <button class="btn" type="button" data-action="go-reports">${icon("file")}Ver reportes</button></div>
        ${renderAttendanceTable(recent)}
      </section>`;
  }
  function statCard(label,value,detail){ return `<article class="stat-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(detail)}</small></article>`; }

  /* BUSQUEDA RAPIDA */
  function renderQuickSearch(){
    const matches=filteredStudents({search:checkinSearch,status:"active"}).slice(0,5);
    return `<form class="toolbar" data-form="quick-search"><input class="search" type="search" data-filter="checkin-search" placeholder="Buscar alumno" value="${escapeHtml(checkinSearch)}"><button class="btn primary" type="submit">${icon("check")}Registrar</button></form>${renderStudentPickList(matches)}`;
  }
  function renderStudentPickList(students){
    if(!students.length) return '<div class="empty">No hay alumnos que coincidan.</div>';
    return `<div class="student-list">${students.map(student=>{
      const remaining=remainingClasses(student);
      return `<article class="student-card"><div><strong>${escapeHtml(student.name)}</strong><div class="meta"><span>${escapeHtml(student.code)}</span><span>${escapeHtml(PLAN_LABELS[student.planType]||planTotal(student)+" clases")}</span><span>${isRenewed(student)?remaining+" restantes":"Sin renovar"}</span></div></div><button class="btn primary" type="button" data-action="register-class" data-id="${escapeHtml(student.id)}">${icon("check")}Registrar</button></article>`;
    }).join("")}</div>`;
  }
  function renderRenewalSummary(){
    const pending=state.students.filter(s=>s.status==="active"&&!isRenewed(s));
    if(!state.students.length) return '<div class="empty">Agrega alumnos para activar las renovaciones.</div>';
    if(!pending.length) return '<div class="empty">Todos los alumnos activos ya estan renovados.</div>';
    return `<div class="student-list">${pending.slice(0,5).map(student=>`<article class="student-card"><div><strong>${escapeHtml(student.name)}</strong><div class="meta"><span>${escapeHtml(student.code)}</span><span>Ultimo mes: ${escapeHtml(student.monthKey||"sin registro")}</span></div></div><button class="btn" type="button" data-action="renew-student" data-id="${escapeHtml(student.id)}">${icon("refresh")}Renovar</button></article>`).join("")}</div>${pending.length>5?`<p class="muted">Hay ${pending.length-5} alumnos mas por renovar.</p>`:""}`;
  }

  /* ALUMNOS */
  function renderStudents(){
    const students=filteredStudents(studentFilters);
    const editing=editingStudentId?getStudent(editingStudentId):null;
    const listPanel=`<div class="panel students-list-panel"><div class="panel-header"><div><h3>Listado de alumnos</h3><p>${students.length} alumno${students.length===1?"":"s"} encontrados.</p></div>${studentsFormVisible?`<button class="btn icon" type="button" data-action="toggle-students-form">${icon("x")}</button>`:""}</div>${renderStudentFilters()}${renderStudentsTable(students)}</div>`;
    if(studentsFormVisible){
      return `${renderHeader("Alumnos","Ficha unica por estudiante.",`<button class="btn primary" type="button" data-action="new-student">${icon("plus")}Nuevo alumno</button>`)}<section class="grid cols-2"><div class="panel"><div class="panel-header"><div><h3>${editing?"Editar alumno":"Nuevo alumno"}</h3><p>${editing?escapeHtml(editing.code):"El codigo se asigna automaticamente."}</p></div></div>${renderStudentForm(editing)}</div>${listPanel}</section>`;
    }
    return `${renderHeader("Alumnos","Ficha unica por estudiante.",`<button class="btn primary" type="button" data-action="new-student">${icon("plus")}Nuevo alumno</button>`)}${listPanel}`;
  }
  function renderStudentForm(student){
    const data=student||{name:"",category:"Infantil",birthdate:"",documento:"",responsible:"",phoneAcudiente:"",talla:"",peso:"",sangre:"",eps:"",camiseta:"",phone:"",email:"",planType:"4",customClasses:1,status:"active",notes:""};
    const showCustom=data.planType==="custom";
    return `<form id="studentForm" class="field-grid">
      <input type="hidden" name="studentId" value="${escapeHtml(student?.id||"")}">
      <label class="field wide">Nombre completo<input name="name" required autocomplete="name" value="${escapeHtml(data.name)}"></label>
      <label class="field">Documento de identidad<input name="documento" inputmode="numeric" placeholder="CC / TI / CE" value="${escapeHtml(data.documento||'')}"></label>
      <label class="field">Tipo<select name="category">${so("Infantil",data.category,"Infantil")}${so("Adulto",data.category,"Adulto")}${so("Matronatacion",data.category,"Matronatacion")}</select></label>
      <label class="field">Fecha de nacimiento<input name="birthdate" type="date" value="${escapeHtml(data.birthdate||'')}"></label>
      <label class="field">Telefono<input name="phone" inputmode="tel" value="${escapeHtml(data.phone)}"></label>
      <label class="field">Acudiente o contacto<input name="responsible" value="${escapeHtml(data.responsible)}"></label>
      <label class="field">Telefono del acudiente<input name="phoneAcudiente" inputmode="tel" placeholder="300 000 0000" value="${escapeHtml(data.phoneAcudiente||'')}"></label>
      <label class="field">Correo<input name="email" type="email" value="${escapeHtml(data.email)}"></label>
      <label class="field">Plan mensual<select name="planType" data-plan-select>
        ${so("1_practica",data.planType,PLAN_LABELS["1_practica"])}${so("1_grupal",data.planType,PLAN_LABELS["1_grupal"])}${so("1_matronat",data.planType,PLAN_LABELS["1_matronat"])}${so("4",data.planType,PLAN_LABELS["4"])}${so("9",data.planType,PLAN_LABELS["9"])}${so("8_practicas",data.planType,PLAN_LABELS["8_practicas"])}${so("13",data.planType,PLAN_LABELS["13"])}${so("matronat_4",data.planType,PLAN_LABELS["matronat_4"])}${so("matronat_8",data.planType,PLAN_LABELS["matronat_8"])}${so("anual",data.planType,PLAN_LABELS["anual"])}${so("obsequio_1",data.planType,PLAN_LABELS["obsequio_1"])}${so("obsequio_2",data.planType,PLAN_LABELS["obsequio_2"])}${so("obsequio_3",data.planType,PLAN_LABELS["obsequio_3"])}${so("custom",data.planType,PLAN_LABELS.custom)}</select></label>
      <label class="field" data-custom-classes ${showCustom?"":"hidden"}>Clases del plan<input name="customClasses" type="number" min="1" max="80" value="${escapeHtml(data.customClasses||1)}"></label>
      <label class="field">Estado<select name="status">${so("active",data.status,"Activo")}${so("paused",data.status,"Pausado")}</select></label>
      <label class="field">Estatura (cm)<input name="talla" type="number" min="30" max="250" placeholder="Ej: 120" value="${escapeHtml(data.talla||'')}"></label><label class="field">Peso (kg)<input name="peso" type="number" min="1" max="300" placeholder="Ej: 45" value="${escapeHtml(data.peso||'')}"></label><label class="field">Tipo de sangre<select name="sangre">${so("",data.sangre||"","Seleccionar")}${["O+","O-","A+","A-","B+","B-","AB+","AB-"].map(t=>so(t,data.sangre||"",t)).join("")}</select></label><label class="field">EPS<input name="eps" placeholder="Ej: Sura, Sanitas..." value="${escapeHtml(data.eps||'')}"></label><label class="field">Talla camiseta<select name="camiseta">${so("",data.camiseta||"","Seleccionar")}${["2","4","6","8","10","12","14","XS","S","M","L","XL","XXL"].map(t=>so(t,data.camiseta||"",t)).join("")}</select></label><label class="field wide">Notas<textarea name="notes">${escapeHtml(data.notes)}</textarea></label>
      <div class="split-actions wide">${student?`<button class="btn" type="button" data-action="cancel-edit">Cancelar</button>`:""}<button class="btn primary" type="submit">${icon("save")}${student?"Guardar cambios":"Guardar alumno"}</button></div>
    </form>`;
  }
  function so(value,current,label=value){ return `<option value="${escapeHtml(value)}" ${value===current?"selected":""}>${escapeHtml(label)}</option>`; }
  function renderStudentFilters(){
    return `<div class="toolbar" style="margin-bottom:12px"><input class="search" type="search" data-filter="students-search" placeholder="Buscar" value="${escapeHtml(studentFilters.search)}"><select class="compact-input" data-filter="students-plan" aria-label="Filtrar por plan">${so("all",studentFilters.plan,"Todos los planes")}${Object.entries(PLAN_LABELS).map(([k,v])=>so(k,studentFilters.plan,v)).join("")}</select><select class="compact-input" data-filter="students-status" aria-label="Filtrar por estado">${so("all",studentFilters.status,"Todos")}${so("active",studentFilters.status,"Activos")}${so("paused",studentFilters.status,"Pausados")}</select></div>`;
  }
  function renderStudentsTable(students){
    if(!students.length) return '<div class="empty">No hay alumnos para mostrar.</div>';
    return `<div class="table-wrap"><table><thead><tr><th>Alumno</th><th>Plan</th><th>Clases</th><th>Estado</th><th></th></tr></thead><tbody>${students.map(student=>{
      const total=planTotal(student), used=Number(student.classesUsed||0), remaining=remainingClasses(student);
      const progress=total?Math.min(100,Math.max(0,(used/total)*100)):0;
      return `<tr><td><div class="student-name"><strong>${escapeHtml(student.name)}</strong><small>${escapeHtml(student.code)} - ${escapeHtml(student.phone||"sin telefono")}</small></div></td><td>${planBadge(student)}</td><td><div class="classes-cell"><strong>${remaining}</strong><small>restantes - ${used}/${total} usadas</small></div><div class="progress" aria-hidden="true"><span style="width:${progress}%"></span></div></td><td>${studentStatusBadge(student)}</td><td class="actions"><button class="btn icon" type="button" title="Registrar clase" data-action="register-class" data-id="${escapeHtml(student.id)}">${icon("check")}</button><button class="btn icon" type="button" title="Registrar pago" data-action="open-pay-modal" data-id="${escapeHtml(student.id)}">${icon("dollar")}</button><button class="btn icon" type="button" title="Renovar" data-action="renew-student" data-id="${escapeHtml(student.id)}">${icon("refresh")}</button><button class="btn icon" type="button" title="WhatsApp" data-action="notify-student" data-id="${escapeHtml(student.id)}">${icon("message")}</button><button class="btn icon" type="button" title="Editar" data-action="edit-student" data-id="${escapeHtml(student.id)}">${icon("edit")}</button><button class="btn icon" type="button" title="${student.waiver?'Firma registrada ✓':'Enviar firma por WhatsApp'}" data-action="send-waiver-whatsapp" data-id="${escapeHtml(student.id)}" style="${student.waiver?'color:var(--success)':''}">${icon("signature")}</button>${student.status==="active"?`<button class="btn icon warn" type="button" title="Pausar alumno" data-action="pause-student" data-id="${escapeHtml(student.id)}">${icon("stop")}</button>`:`<button class="btn icon" type="button" title="Activar alumno" data-action="activate-student" data-id="${escapeHtml(student.id)}">${icon("user")}</button>`}<button class="btn icon danger" type="button" title="Eliminar alumno definitivamente" data-action="delete-student" data-id="${escapeHtml(student.id)}">${icon("trash")}</button></td></tr>`;
    }).join("")}</tbody></table></div>`;
  }

  /* CHECK-IN QR - VISTA PUBLICA */
  function renderCheckin(){
    const matches=filteredStudents({search:checkinSearch,status:"active"}).slice(0,7);
    return `
      ${renderHeader("Escaner QR de Asistencia","Escanea el carnet del alumno para registrar la clase de hoy.")}
      <section class="scan-layout">
        <div class="panel">
          <div class="panel-header"><div><h3>Lector de camara</h3><p>Apunta al codigo QR del carnet del alumno.</p></div></div>
          <div style="margin-bottom:14px;display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn primary" type="button" data-action="start-scanner" style="flex:1;min-height:52px;font-size:1rem">${icon("scan")} Abrir camara</button>
            <button class="btn ghost" type="button" data-action="stop-scanner" style="min-height:52px">${icon("stop")} Detener</button>
          </div>
          <div class="scanner-box" style="position:relative">
            <video id="scanVideo" playsinline muted style="width:100%;min-height:280px;border-radius:12px;background:#000;object-fit:cover;display:block"></video>
            <div id="scannerPlaceholder" style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:var(--bg);border-radius:12px">
              <div style="width:64px;height:64px;color:var(--muted-2)">${icon("scan")}</div>
              <p style="color:var(--muted);font-size:.88rem;text-align:center;margin:0;padding:0 20px">Toca <strong>Abrir camara</strong> para activar el escaner QR.</p>
            </div>
            <div id="scanCrosshair" hidden style="position:absolute;inset:0;pointer-events:none;display:flex;align-items:center;justify-content:center">
              <div style="width:200px;height:200px;border:3px solid rgba(0,119,182,.8);border-radius:16px;box-shadow:0 0 0 9999px rgba(0,0,0,.35)"></div>
            </div>
          </div>
          <p style="text-align:center;font-size:.78rem;color:var(--muted);margin-top:10px">Compatible con Chrome, Safari y Firefox - Requiere permiso de camara</p>
        </div>
        ${isAuthenticated?`
        <aside class="panel">
          <div class="panel-header"><div><h3>Registro manual</h3><p>Codigo, nombre o telefono.</p></div></div>
          <form class="toolbar" data-form="quick-search">
            <input class="search" type="search" data-filter="checkin-search" placeholder="Buscar alumno o codigo" value="${escapeHtml(checkinSearch)}">
            <button class="btn primary" type="submit">${icon("check")} Registrar</button>
          </form>
          ${renderStudentPickList(matches)}
        </aside>`:`
        <aside class="panel" style="display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:14px;min-height:200px">
          <div style="width:56px;height:56px;border-radius:50%;background:var(--primary-tint);display:flex;align-items:center;justify-content:center;color:var(--primary)">${icon("lock")}</div>
          <div><p style="font-weight:600;margin:0 0 4px;color:var(--ink)">Registro manual solo para administradores</p><p style="font-size:.82rem;color:var(--muted);margin:0">Usa el escaner QR para registrar asistencia.</p></div>
          <button class="btn primary" type="button" data-action="open-login">${icon("lock")} Administrar</button>
        </aside>`}
      </section>`;
  }

  
  /* REGISTRO PUBLICO DE ALUMNO */
  function renderRegister(){
    return `
      <div class="view-header">
        <div><h2>Registrar nuevo alumno</h2><p>Completa el formulario para agregar un alumno a ACQUA NATACION.</p></div>
      </div>
      <section class="panel" style="max-width:560px;margin:0 auto">
        <div class="panel-header">
          <div><h3>Datos del alumno</h3><p>El codigo de carnet se asigna automaticamente.</p></div>
        </div>
        <form id="studentFormPublic" class="field-grid">
          <label class="field wide">Nombre completo <span style="color:var(--danger)">*</span><input name="name" required autocomplete="name" placeholder="Nombre y apellidos"></label>
          <label class="field">Documento de identidad<input name="documento" inputmode="numeric" placeholder="CC / TI / CE"></label>
          <label class="field">Tipo
            <select name="category">
              <option value="Infantil">Infantil</option>
              <option value="Adulto">Adulto</option>
              <option value="Matronatacion">Matronatacion</option>
            </select>
          </label>
          <label class="field">Fecha de nacimiento<input name="birthdate" type="date"></label>
          <label class="field">Telefono <span style="color:var(--danger)">*</span><input name="phone" inputmode="tel" required placeholder="300 000 0000"></label>
          <label class="field">Acudiente o contacto<input name="responsible" placeholder="Nombre del acudiente"></label>
          <label class="field">Telefono del acudiente<input name="phoneAcudiente" inputmode="tel" placeholder="300 000 0000"></label>
          <label class="field">Correo<input name="email" type="email" placeholder="correo@ejemplo.com"></label>
          <label class="field">Plan mensual
            <select name="planType" data-plan-select>
              <option value="1_practica">1 practica libre</option>
              <option value="1_grupal">1 clase grupal</option>
              <option value="1_matronat">1 clase de matronatacion</option>
              <option value="4" selected>4 clases/mes</option>
              <option value="9">9 clases/mes</option>
              <option value="8_practicas">8 practicas libres</option>
              <option value="13">13 clases/mes</option>
              <option value="matronat_4">Matronatacion 4 clases/mes</option>
              <option value="matronat_8">Matronatacion 8 clases/mes</option>
              <option value="anual">Plan anual</option>
              <option value="obsequio_1">Obsequio 1 clase</option>
              <option value="obsequio_2">Obsequio 2 clases</option>
              <option value="obsequio_3">Obsequio 3 clases</option>
              <option value="custom">Personalizado</option>
            </select>
          </label>
          <label class="field" data-custom-classes hidden>Numero de clases<input name="customClasses" type="number" min="1" max="80" value="1"></label>
          <label class="field">Estatura (cm)<input name="talla" type="number" min="30" max="250" placeholder="Ej: 120"></label>          <label class="field">Peso (kg)<input name="peso" type="number" min="1" max="300" placeholder="Ej: 45"></label>          <label class="field">Tipo de sangre<select name="sangre"><option value="">Seleccionar</option><option>O+</option><option>O-</option><option>A+</option><option>A-</option><option>B+</option><option>B-</option><option>AB+</option><option>AB-</option></select></label>          <label class="field">EPS<input name="eps" placeholder="Ej: Sura, Sanitas..."></label>          <label class="field">Talla camiseta<select name="camiseta"><option value="">Seleccionar</option><option>2</option><option>4</option><option>6</option><option>8</option><option>10</option><option>12</option><option>14</option><option>XS</option><option>S</option><option>M</option><option>L</option><option>XL</option><option>XXL</option></select></label>          <label class="field wide">Notas u observaciones<textarea name="notes" placeholder="Alergias, condiciones medicas, horario preferido..."></textarea></label>
          <div class="split-actions wide" style="margin-top:4px">
            <button class="btn primary" type="submit" style="flex:1;justify-content:center;min-height:46px">${icon("save")} Registrar alumno</button>
          </div>
        </form>
      </section>`;
  }

/* CARNETS QR */
  function renderCards(){
    const students=filteredStudents({search:cardSearch,status:"active"});
    return `${renderHeader("Carnets QR","Cada alumno conserva el mismo codigo. Solo se renueva el cupo al cambiar de mes.",`<button class="btn no-print" type="button" data-action="print-cards">${icon("print")}Imprimir todos</button>`)}<section class="panel print-area"><div class="toolbar" style="margin-bottom:14px"><input class="search" type="search" data-filter="cards-search" placeholder="Buscar carnet" value="${escapeHtml(cardSearch)}"></div>${students.length?`<div class="qr-grid">${students.map(renderQrCard).join("")}</div>`:'<div class="empty">No hay carnets para mostrar.</div>'}</section>`;
  }
  function renderQrCard(student){
    const qr=qrSvg(qrPayload(student));
    const diasRestantesMes=35;
    const parts=student.name.toUpperCase().trim().split(/\s+/);
    // Divide: primera(s) linea = nombre(s), segunda = apellido(s)
    let splitIdx=parts.length>=4?2:1;
    const nombres=parts.slice(0,splitIdx).join(' ');
    const apellidos=parts.slice(splitIdx).join(' ');
    return `<div style="display:flex;flex-direction:column;align-items:center;gap:8px;flex-shrink:0">
    <article style="position:relative;width:270px;height:450px;border-radius:18px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,.4);break-inside:avoid;page-break-inside:avoid" id="card-${escapeHtml(student.id)}">
      <img src="assets/carnet-Acqua.jpg" style="position:absolute;inset:0;width:100%;height:100%;object-fit:fill;border-radius:18px;display:block" alt="">
      <!-- QR mas abajo para no tapar el logo ACQUA -->
      <div style="position:absolute;top:25%;left:50%;transform:translateX(-50%);width:71%;border-radius:10px;overflow:hidden;background:#fff;line-height:0">${qr}</div>
      <!-- Nombre + tipo + dias + fundacion -->
      <div style="position:absolute;top:67%;left:0;right:0;text-align:center;padding:0 8px;color:#0a2472;font-weight:800;letter-spacing:.04em;line-height:1.3">
        <div style="font-size:1.15rem">${escapeHtml(nombres)}</div>
        ${apellidos?`<div style="font-size:1.15rem">${escapeHtml(apellidos)}</div>`:''}
        <div style="font-size:.78rem;font-weight:600;color:#1565c0;margin-top:3px">${{Nino:'Infantil',Adulto:'Adulto',Matronatacion:'Matronatacion','Practica libre':'Practica libre'}[student.category]||escapeHtml(student.category||'')}</div>
        <div style="font-size:.68rem;font-weight:600;color:#0a2472;margin-top:3px">Tienes ${diasRestantesMes} dias para consumir tu plan</div>
      </div>
      <div style="position:absolute;bottom:3%;left:0;right:0;text-align:center;font-size:.46rem;color:#8899cc;letter-spacing:.05em">Fundado el 17 de marzo de 2015</div>
    </article>
    <button class="btn no-print" type="button" data-action="print-one-card" data-id="${escapeHtml(student.id)}" style="width:270px;justify-content:center">${icon("print")} Imprimir carnet</button>
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
    const todayStr=new Date().toISOString().slice(0,10);
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
        const nm=e.name.length>16?e.name.slice(0,15)+"...":e.name;
        evtHtml+='<div class="cal-evt '+cls+'" title="'+escapeHtml(e.name)+'">'+escapeHtml(nm)+'</div>';
      });
      cells+='<div class="cal-cell'+(isToday?" today":"")+'"><span class="cal-day-num">'+d+'</span>'+evtHtml+'</div>';
    }

    const diasHtml=dias.map(function(d){ return '<div class="cal-head">'+d+'</div>'; }).join("");

    return '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;gap:8px">'
      +'<button class="btn" type="button" data-action="cal-prev">&larr;</button>'
      +'<strong style="font-size:.95rem;text-transform:capitalize;flex:1;text-align:center">'+escapeHtml(label)+'</strong>'
      +'<button class="btn" type="button" data-action="cal-next">&rarr;</button>'
      +'</div>'
      +'<div class="cal-grid">'+diasHtml+cells+'</div>'
      +'<div style="margin-top:10px;display:flex;gap:12px;font-size:.75rem;flex-wrap:wrap">'
      +'<span style="display:flex;align-items:center;gap:5px"><span style="width:12px;height:12px;border-radius:3px;background:#FEF3C7;border-left:3px solid #F59E0B;display:inline-block"></span>Externo</span>'
      +'<span style="display:flex;align-items:center;gap:5px"><span style="width:12px;height:12px;border-radius:3px;background:#DBEAFE;border-left:3px solid #3B82F6;display:inline-block"></span>Interno</span>'
      +'</div>';
  }

  function renderEvents(){
    try {
      const ev=activeEventId?getEvent(activeEventId):null;
      if(ev) return renderEventDetail(ev);

      const ordered=[...state.events].sort((a,b)=>(a.date||"").localeCompare(b.date||""));
      const internal=[...(state.internalEvents||[])].sort((a,b)=>(a.date||"").localeCompare(b.date||""));

      const btnL='<button class="btn '+(calendarView==="list"?"primary":"")+ '" type="button" data-action="events-view-list">Lista</button>';
      const btnC='<button class="btn '+(calendarView==="calendar"?"primary":"")+ '" type="button" data-action="events-view-calendar">Calendario</button>';
      const viewBtns='<div style="display:flex;gap:8px">'+btnL+btnC+'</div>';

      let calBlock="";
      if(calendarView==="calendar"){
        try{ calBlock='<div class="panel" style="margin-top:16px">'+renderCalendar()+'</div>'; }
        catch(ce){ calBlock='<div class="panel"><p style="color:red;padding:1rem">Error calendario: '+ce.message+'</p></div>'; }
      }

      const extHtml=ordered.length
        ? '<div class="event-list">'+ordered.map(renderEventCard).join("")+'</div>'
        : '<div class="empty">No hay eventos externos todavia.</div>';

      const intHtml=internal.length
        ? '<div class="event-list">'+internal.map(renderInternalEventCard).join("")+'</div>'
        : '<div class="empty">No hay eventos internos todavia.</div>';

      return renderHeader("Eventos y calendario","Gestiona competencias, travesias y actividades internas.",viewBtns)
        + calBlock
        + '<section class="events-layout">'
        + '<div class="panel">'
        +   '<div class="panel-header"><div><h3>Nuevo evento externo</h3><p>Competencia, travesia o salida.</p></div></div>'
        +   '<form id="eventForm" class="field-grid">'
        +     '<label class="field wide">Nombre<input name="eventName" required placeholder="Travesia San Andres 2026"></label>'
        +     '<label class="field">Fecha<input name="eventDate" type="date" required></label>'
        +     '<label class="field">Lugar<input name="eventPlace" required placeholder="Piscina, ciudad..."></label>'
        +     '<div class="split-actions wide"><button class="btn accent" type="submit">Crear externo</button></div>'
        +   '</form>'
        +   '<div style="border-top:1px solid var(--line-opaque);margin-top:16px;padding-top:14px">'
        +     '<div class="panel-header" style="padding:0 0 10px"><div><h3>Nuevo evento interno</h3><p>Fiestas y actividades en instalaciones.</p></div></div>'
        +     '<form id="internalEventForm" class="field-grid">'
        +       '<label class="field wide">Nombre<input name="iEventName" required placeholder="Fiesta, Cumpleanos..."></label>'
        +       '<label class="field">Fecha<input name="iEventDate" type="date" required></label>'
        +       '<label class="field">Hora inicio<input name="iEventStart" type="time"></label>'
        +       '<label class="field">Hora fin<input name="iEventEnd" type="time"></label>'
        +       '<label class="field wide">Descripcion<input name="iEventDesc" placeholder="Detalles adicionales..."></label>'
        +       '<div class="split-actions wide"><button class="btn primary" type="submit">Agregar al calendario</button></div>'
        +     '</form>'
        +   '</div>'
        + '</div>'
        + '<div class="panel">'
        +   '<div class="panel-header"><div><h3>Externos ('+state.events.length+')</h3><p>Competencias y travesias.</p></div></div>'
        +   extHtml
        +   '<div class="panel-header" style="margin-top:16px;padding:12px 0 8px;border-top:1px solid var(--line-opaque)"><div><h3>Internos ('+(state.internalEvents||[]).length+')</h3><p>Fiestas y actividades.</p></div></div>'
        +   intHtml
        + '</div>'
        + '</section>';
    } catch(e) {
      console.error("renderEvents error:", e);
      return '<div style="padding:2rem;color:red;text-align:center">'
        + '<h2>Error al cargar Eventos</h2>'
        + '<p style="margin:10px 0;font-size:.9rem">'+e.message+'</p>'
        + '<button class="btn primary" onclick="location.reload()">Recargar</button>'
        + '</div>';
    }
  }
  function renderInternalEventCard(event){
    const horario=event.start?(event.start+(event.end?" - "+event.end:"")):"Sin horario";
    const descHtml=event.desc?'<p style="font-size:.78rem;color:var(--muted);margin:4px 0 0">'+escapeHtml(event.desc)+'</p>':"";
    return '<article class="event-card" style="border-left:3px solid var(--primary)">'
      +'<div>'
      +'<strong>'+escapeHtml(event.name)+'</strong>'
      +'<div class="meta">'
      +'<span>'+icon("calendar")+escapeHtml(event.date||"Sin fecha")+'</span>'
      +'<span>'+icon("stop")+escapeHtml(horario)+'</span>'
      +'</div>'
      +descHtml
      +'</div>'
      +'<div class="event-actions">'
      +'<button class="btn icon danger" type="button" title="Eliminar" data-action="delete-internal-event" data-id="'+escapeHtml(event.id)+'">'+icon("trash")+'</button>'
      +'</div>'
      +'</article>';
  }

  function renderEventCard(event){
    const attendees=event.attendees||[];
    const paid=attendees.filter(a=>a.paid).length, signed=attendees.filter(a=>a.signed).length;
    return `<article class="event-card"><div><strong>${escapeHtml(event.name)}</strong><div class="meta"><span>${icon("calendar")}${escapeHtml(event.date||"Sin fecha")}</span><span>${icon("map")}${escapeHtml(event.place||"Sin lugar")}</span></div><div class="event-metrics"><span>${attendees.length} inscritos</span><span>${paid} pagos</span><span>${signed} firmas</span></div></div><div class="event-actions"><button class="btn primary" type="button" data-action="view-event" data-id="${escapeHtml(event.id)}">Gestionar</button><button class="btn icon danger" type="button" title="Eliminar" data-action="delete-event" data-id="${escapeHtml(event.id)}">${icon("trash")}</button></div></article>`;
  }
  function renderEventDetail(event){
    const attendees=event.attendees||[];
    const available=state.students.filter(s=>s.status==="active"&&!attendees.some(a=>a.studentId===s.id)).sort((a,b)=>a.name.localeCompare(b.name,"es"));
    const paid=attendees.filter(a=>a.paid).length, signed=attendees.filter(a=>a.signed).length;
    return `<div class="detail-shell"><button class="btn ghost" type="button" data-action="back-events">${icon("arrowLeft")}Volver a eventos</button><section class="event-hero"><div><img class="section-logo" src="assets/logo-acqua-blanco.png" alt="${escapeHtml(DEFAULT_BUSINESS)}"><span class="eyebrow">Evento activo</span><h2>${escapeHtml(event.name)}</h2><p>${icon("calendar")}${escapeHtml(event.date||"Sin fecha")} - ${icon("map")}${escapeHtml(event.place||"Sin lugar")}</p></div><div class="event-hero-stats"><span><strong>${attendees.length}</strong> inscritos</span><span><strong>${paid}</strong> pagados</span><span><strong>${signed}</strong> firmados</span></div></section><section class="grid cols-2"><div class="panel"><div class="panel-header"><div><h3>Inscribir alumno</h3><p>Solo aparecen alumnos activos no inscritos.</p></div></div><form id="eventEnrollForm" class="toolbar"><input type="hidden" name="eventId" value="${escapeHtml(event.id)}"><select class="search" name="studentId" required><option value="">Selecciona un alumno</option>${available.map(s=>`<option value="${escapeHtml(s.id)}">${escapeHtml(s.name)} - ${escapeHtml(s.code)}</option>`).join("")}</select><button class="btn primary" type="submit">${icon("plus")}Inscribir</button></form></div><div class="panel"><div class="panel-header"><div><h3>Control de inscritos</h3><p>Actualiza pagos y firmas antes del evento.</p></div></div>${attendees.length?`<div class="attendee-list">${attendees.map(a=>renderAttendeeRow(event,a)).join("")}</div>`:'<div class="empty">Aun no hay alumnos inscritos.</div>'}</div></section></div>`;
  }
  function renderAttendeeRow(event,attendee){
    const student=getStudent(attendee.studentId);
    if(!student) return "";
    return `<article class="attendee-row"><div><strong>${escapeHtml(student.name)}</strong><small>${escapeHtml(student.phone||"sin telefono")} - ${escapeHtml(student.code)}</small></div><div class="attendee-actions"><button class="btn ${attendee.paid?"ok":""}" type="button" data-action="toggle-event-paid" data-event-id="${escapeHtml(event.id)}" data-student-id="${escapeHtml(student.id)}">${icon("dollar")}${attendee.paid?"Pagado":"Pendiente"}</button><button class="btn ${attendee.signed?"ok":""}" type="button" data-action="open-signature" data-event-id="${escapeHtml(event.id)}" data-student-id="${escapeHtml(student.id)}">${icon("signature")}${attendee.signed?"Firmado":"Sin firmar"}</button><button class="btn icon danger" type="button" title="Quitar alumno" data-action="remove-event-student" data-event-id="${escapeHtml(event.id)}" data-student-id="${escapeHtml(student.id)}">${icon("trash")}</button></div></article>`;
  }
  function renderSignatureModal(draft){
    const event=getEvent(draft.eventId), student=getStudent(draft.studentId);
    if(!event||!student) return "";
    return `<div class="modal-backdrop" role="dialog" aria-modal="true" aria-label="Firma de exoneracion"><div class="modal-panel signature-panel"><div class="modal-header"><div><img class="modal-logo" src="assets/logo-acqua-blanco.png" alt="${escapeHtml(DEFAULT_BUSINESS)}"><span class="eyebrow">Documento digital</span><h3>Firma de exoneracion</h3></div><button class="btn icon" type="button" title="Cerrar" data-action="close-signature">${icon("x")}</button></div><div class="waiver-copy"><p><strong>Estudiante:</strong> ${escapeHtml(student.name)}<br><strong>Evento:</strong> ${escapeHtml(event.name)}</p><p style="font-weight:700;margin:12px 0 6px">DECLARACIONES Y AUTORIZACION</p><ol style="padding-left:18px;margin:0;display:grid;gap:7px;font-size:.82rem;line-height:1.55"><li><strong>Conocimiento del Evento:</strong> Declaro conocer las condiciones de participacion del evento y autorizo la asistencia del estudiante. Entiendo que las actividades fuera de la sede tienen condiciones muy diferentes a una clase regular, como corrientes, profundidad variable, oleaje y cambios de clima.</li><li><strong>Estado de Salud:</strong> Certifico que el estudiante se encuentra en buen estado de salud. Me comprometo a informar cualquier novedad medica, alergia o malestar relevante antes del inicio del evento.</li><li><strong>Supervision y Seguridad:</strong> Acepto que la participacion se realizara bajo la supervision del equipo de ACQUA NATACION, y me aseguro de que el estudiante acatara todas sus instrucciones y normas de seguridad.</li><li><strong>Exoneracion:</strong> Acepto los riesgos naturales de la actividad deportiva en exteriores y exonero de responsabilidad a ACQUA NATACION por cualquier incidente o lesion que ocurra durante el evento, siempre que la academia haya cumplido con las medidas de seguridad correspondientes.</li><li><strong>Atencion Medica:</strong> En caso de emergencia, autorizo al personal a brindar primeros auxilios o a trasladar al estudiante al centro medico mas cercano si es necesario.</li></ol></div><form id="signatureForm" class="field-grid"><input type="hidden" name="eventId" value="${escapeHtml(event.id)}"><input type="hidden" name="studentId" value="${escapeHtml(student.id)}"><label class="field wide consent"><input name="accepted" type="checkbox" required>Confirmo que lei y acepto los terminos de exoneracion y responsabilidad.</label><label class="field">Nombre de quien firma<input name="signatureName" required placeholder="Acudiente o estudiante mayor de edad"></label><label class="field">Documento<input name="signatureDocument" required inputmode="numeric" placeholder="CC / TI / CE"></label><div class="split-actions wide"><button class="btn" type="button" data-action="close-signature">Cancelar</button><button class="btn primary" type="submit">${icon("signature")}Firmar documento</button></div></form></div></div>`;
  }

  /* REPORTES */
  function renderReports(){
    const entries=monthAttendance().sort((a,b)=>new Date(b.at)-new Date(a.at));
    const byStudent=entries.reduce((map,entry)=>{ const student=getStudent(entry.studentId); const key=student?.id||entry.studentId; if(!map.has(key))map.set(key,{name:student?.name||"Alumno eliminado",code:student?.code||"",count:0}); map.get(key).count+=1; return map; },new Map());
    const ranking=[...byStudent.values()].sort((a,b)=>b.count-a.count).slice(0,8);
    return `${renderHeader("Reportes de "+monthLabel(state.currentMonth),"Asistencia registrada, consumo de clases y exportacion de datos.",`<button class="btn" type="button" data-action="export-csv">${icon("download")}CSV asistencia</button>`)}<section class="grid cols-2"><div class="panel"><div class="panel-header"><div><h3>Resumen por alumno</h3><p>Alumnos con mas clases en el mes.</p></div></div>${ranking.length?ranking.map(row=>`<div class="report-row"><strong>${escapeHtml(row.code||"Sin codigo")}</strong><span>${escapeHtml(row.name)}</span><span class="badge info">${row.count} clase${row.count===1?"":"s"}</span></div>`).join(""):'<div class="empty">No hay asistencia en este mes.</div>'}</div><div class="panel"><div class="panel-header"><div><h3>Bitacora</h3><p>Registro cronologico del mes operativo.</p></div></div>${renderAttendanceTable(entries)}</div></section>`;
  }
  function renderAttendanceTable(entries){
    if(!entries.length) return '<div class="empty">Aun no hay clases registradas.</div>';
    return `<div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Alumno</th><th>Origen</th><th>Tipo</th></tr></thead><tbody>${entries.map(entry=>{ const student=getStudent(entry.studentId); return `<tr><td>${escapeHtml(formatDateTime(entry.at))}</td><td><div class="student-name"><strong>${escapeHtml(student?.name||"Alumno no encontrado")}</strong><small>${escapeHtml(student?.code||entry.studentId)}</small></div></td><td>${(entry.source==="qr"||entry.source==="qr-url")?"QR":"Manual"}</td><td>${entry.extra?'<span class="badge warn">Extra</span>':'<span class="badge ok">Plan</span>'}</td><td><button class='btn icon danger' title='Anular' type='button' data-action='delete-attendance' data-att-id='${entry.id}'>${icon('x')}</button></td></tr>`; }).join("")}</tbody></table></div>`;
  }

  /* AJUSTES (sin campo de nombre de empresa) */
  function renderSettings(){
    if(!settingsUnlocked){
      return `${renderHeader("Ajustes","Ingresa la contrasena para acceder a esta seccion.")}
        <section class="panel" style="max-width:400px;margin:0 auto">
          <div class="panel-header"><div><h3>Acceso restringido</h3><p>Los ajustes requieren verificacion adicional.</p></div></div>
          <form id="settingsAuthForm" style="padding:8px 0;display:grid;gap:14px">
            <label class="field">Contrasena de administrador<input name="settingsPass" type="password" autocomplete="current-password" placeholder="..." autofocus></label>
            <button class="btn primary" type="submit" style="justify-content:center">${icon("lock")} Verificar acceso</button>
          </form>
        </section>`;
    }
    return `${renderHeader("Ajustes","Respaldos y utilidades de operacion.")}<section class="settings-grid"><div class="panel"><div class="panel-header"><div><h3>Mes operativo</h3><p>Cambia el mes activo para el control de clases.</p></div></div><form id="settingsForm" class="field-grid"><label class="field wide">Mes operativo<input name="currentMonth" type="month" value="${escapeHtml(state.currentMonth)}"></label><div class="split-actions wide"><button class="btn primary" type="submit">${icon("save")}Guardar mes</button></div></form></div><div class="panel"><div class="panel-header"><div><h3>Respaldo</h3><p>Exporta el archivo maestro o restaura una copia.</p></div></div><div class="toolbar"><button class="btn" type="button" data-action="export-json">${icon("download")}Exportar Excel</button><button class="btn" type="button" data-action="trigger-import">${icon("upload")}Importar respaldo</button><input class="file-input" id="importFile" type="file" accept=".xlsx,.json,application/json"></div><div class="toolbar" style="margin-top:14px"><button class="btn danger" type="button" data-action="clear-data">${icon("trash")}Borrar datos</button></div></div></section>`;
  }

  /* MODAL DE LOGIN */
  function renderLoginModal(){
    return `<div class="modal-backdrop" role="dialog" aria-modal="true" id="loginModal" style="z-index:10000"><div class="modal-panel" style="max-width:380px"><div class="modal-header"><div><img class="modal-logo" src="assets/logo-acqua-blanco.png" alt="ACQUA NATACION"><span class="eyebrow">Area administrativa</span><h3>Acceso al control</h3></div></div><form id="loginForm" style="padding:24px;display:grid;gap:14px"><div style="background:rgba(255,255,255,.08);border-radius:10px;padding:10px 14px;font-size:.82rem;color:rgba(255,255,255,.8);text-align:center">Acceso exclusivo para administradores</div><label class="field">Contrasena<input name="password" type="password" autocomplete="current-password" placeholder="Contrasena de administrador" autofocus></label><button id="btnLogin" class="btn primary" type="submit" style="width:100%;justify-content:center;margin-top:4px;min-height:46px">${icon("lock")} Ingresar</button></form></div></div><style>@keyframes shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-8px)}40%{transform:translateX(8px)}60%{transform:translateX(-5px)}80%{transform:translateX(5px)}}</style>`;
  }

  /* MODAL DE RENOVACION */
  function renderRenewalModal(){
    const student=getStudent(renewModalStudentId);
    if(!student) return "";
    const planBtns=Object.entries(PLAN_LABELS).map(([value,label])=>`<button class="renewal-plan-btn ${value===student.planType?"current":""}" data-action="confirm-renewal-plan" data-plan="${escapeHtml(value)}"><span>${escapeHtml(label)}</span>${value===student.planType?'<span class="renewal-plan-current-badge">actual</span>':""}</button>`).join("");
    return `<div class="modal-backdrop" role="dialog" aria-modal="true" style="z-index:9998"><div class="modal-panel" style="max-width:460px"><div class="modal-header"><div><span class="eyebrow">Renovacion mensual</span><h3>${escapeHtml(student.name)}</h3></div><button class="btn icon" type="button" data-action="close-renewal-modal" style="color:rgba(255,255,255,.7)">${icon("x")}</button></div><div style="padding:20px">${renewModalChangePlan?`<p style="margin:0 0 14px;color:var(--muted);font-size:.88rem">Selecciona el nuevo plan:</p><div style="display:grid;gap:8px">${planBtns}</div><div class="split-actions"><button class="btn ghost" data-action="renewal-back-options">Volver</button></div>`:`<p style="margin:0 0 18px;color:var(--muted);font-size:.88rem">Plan actual: <strong>${escapeHtml(PLAN_LABELS[student.planType]||"Personalizado")}</strong> - Mes: <strong>${escapeHtml(monthLabel(state.currentMonth))}</strong></p><div style="display:grid;gap:10px"><button class="renewal-opt-btn success" data-action="confirm-renewal-same"><span class="renewal-opt-icon">+</span><span><strong>Mismo plan</strong><small>${escapeHtml(PLAN_LABELS[student.planType]||"Personalizado")} - sin cambios</small></span></button><button class="renewal-opt-btn" data-action="show-renewal-change-plan"><span class="renewal-opt-icon">~</span><span><strong>Plan diferente</strong><small>Elige otro plan para este mes</small></span></button><button class="renewal-opt-btn accent" data-action="confirm-renewal-individual"><span class="renewal-opt-icon">1</span><span><strong>Clase individual</strong><small>Solo 1 clase - practica suelta</small></span></button>
                <button class="renewal-opt-btn" style="border-color:#34c759;background:rgba(52,199,89,.06)" data-action="add-one-class"><span class="renewal-opt-icon" style="color:#34c759">+1</span><span><strong>Sumar 1 clase al plan</strong><small>Se suma a las clases disponibles actuales</small></span></button></div><div class="split-actions"><button class="btn ghost" data-action="close-renewal-modal">Cancelar</button></div>`}</div></div></div><style>.renewal-opt-btn{display:flex;align-items:center;gap:14px;width:100%;padding:14px 16px;background:var(--bg);border:2px solid var(--line-opaque);border-radius:var(--radius-sm);text-align:left;cursor:pointer;transition:all .18s;font:inherit}.renewal-opt-btn:hover{border-color:var(--primary);background:var(--primary-tint);transform:translateY(-1px)}.renewal-opt-btn.success{border-color:var(--success);background:var(--success-tint)}.renewal-opt-btn.accent{border-color:var(--accent);background:rgba(255,159,10,.08)}.renewal-opt-icon{font-size:1.3rem;min-width:2rem;text-align:center;font-weight:700;color:var(--primary)}.renewal-opt-btn strong{display:block;font-size:.92rem;font-weight:600;color:var(--ink)}.renewal-opt-btn small{display:block;color:var(--muted);font-size:.78rem;margin-top:2px}.renewal-plan-btn{display:flex;align-items:center;justify-content:space-between;width:100%;padding:12px 14px;background:var(--bg);border:1.5px solid var(--line-opaque);border-radius:var(--radius-sm);text-align:left;cursor:pointer;font:inherit;transition:all .15s}.renewal-plan-btn:hover,.renewal-plan-btn.current{border-color:var(--primary);background:var(--primary-tint)}.renewal-plan-current-badge{font-size:.68rem;font-weight:700;background:var(--primary-tint);color:var(--primary);padding:2px 8px;border-radius:999px;border:1px solid rgba(0,119,182,.2)}</style>`;
  }

  /* OVERLAY DE CHECK-IN (escaneo exitoso) */
  function showCheckinScreen(student,source="qr"){
    // ── Registrar la clase inmediatamente, sin pedir confirmacion ──────────
    const noRenewed=!isRenewed(student);
    if(noRenewed) renewStudent(student.id,true);

    const extra=remainingClasses(student)<=0;
    student.classesUsed=Number(student.classesUsed||0)+1;
    student.updatedAt=new Date().toISOString();
    state.attendance.push({ id:uid("attendance"), studentId:student.id, at:new Date().toISOString(), monthKey:state.currentMonth, source, extra });
    saveState();

    // Cuantas clases lleva hoy este alumno
    const clasesHoy=state.attendance.filter(e=>e.studentId===student.id&&dayKey(new Date(e.at))===dayKey(new Date())).length;
    const remainingNow=remainingClasses(student);

    // ── Mostrar confirmacion visual que se cierra sola ─────────────────────
    const existing=document.getElementById("checkin-overlay");
    if(existing) existing.remove();

    const remainColor=remainingNow<=0?"var(--danger)":remainingNow<=2?"var(--warning)":"var(--success)";
    let extraHtml=extra?'<div class="checkin-warning danger">Plan agotado — clase registrada como extra.</div>':"";
    if(noRenewed) extraHtml='<div class="checkin-warning">Renovado automaticamente para este mes.</div>'+extraHtml;

    const overlay=document.createElement("div");
    overlay.id="checkin-overlay";
    overlay.innerHTML=`
      <div class="checkin-modal">
        <div class="checkin-check">&#10003;</div>
        <h2 class="checkin-name">${escapeHtml(student.name)}</h2>
        <p class="checkin-code">${escapeHtml(student.code)}</p>
        <div class="checkin-clases-hoy">
          <span>Clase ${clasesHoy === 1 ? "1 registrada hoy" : clasesHoy+" registradas hoy"}</span>
        </div>
        <div class="checkin-stat">
          <span>Clases restantes en el plan</span>
          <strong style="color:${remainColor}">${remainingNow<=0?"0":remainingNow}</strong>
        </div>
        ${extraHtml}
        <p class="checkin-auto">Este mensaje se cerrara solo...</p>
      </div>
      <style>
        #checkin-overlay{position:fixed;inset:0;background:rgba(0,0,0,.6);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px}
        .checkin-modal{background:#fff;border-radius:24px;padding:2rem 1.5rem;max-width:340px;width:100%;text-align:center;box-shadow:0 24px 64px rgba(0,0,0,.3);animation:popIn .25s cubic-bezier(.34,1.56,.64,1)}
        @keyframes popIn{from{transform:scale(.8);opacity:0}to{transform:scale(1);opacity:1}}
        .checkin-check{width:72px;height:72px;border-radius:50%;background:linear-gradient(135deg,#34c759,#30b550);color:#fff;font-size:2.4rem;line-height:72px;margin:0 auto 1rem;box-shadow:0 4px 16px rgba(52,199,89,.4)}
        .checkin-name{font-size:1.35rem;font-weight:800;letter-spacing:-.02em;margin:0 0 4px;color:var(--ink)}
        .checkin-code{font-size:.78rem;color:var(--muted);margin:0 0 1rem}
        .checkin-clases-hoy{background:linear-gradient(135deg,var(--primary-deep),var(--primary));color:#fff;border-radius:12px;padding:10px 16px;margin-bottom:12px;font-size:.92rem;font-weight:700;letter-spacing:.01em}
        .checkin-stat{display:flex;justify-content:space-between;align-items:center;background:var(--bg);border-radius:12px;padding:10px 16px;margin-bottom:10px;font-size:.88rem}
        .checkin-stat strong{font-size:1.5rem;font-weight:800}
        .checkin-warning{background:var(--surface-warm);border:1px solid var(--accent);border-radius:10px;padding:8px 12px;font-size:.78rem;color:#92400e;margin-bottom:8px;text-align:left}
        .checkin-warning.danger{background:var(--danger-tint);border-color:var(--danger);color:#c0392b}
        .checkin-auto{font-size:.72rem;color:var(--muted);margin:12px 0 0}
      </style>`;
    document.body.appendChild(overlay);

    // Cerrar automaticamente tras 2.8s y reactivar camara
    const closeTimer=setTimeout(()=>{
      overlay.remove();
      if((source==="qr"||source==="qr-url")&&activeView==="checkin") startScanner();
    },2800);

    // Tambien cerrar si el usuario toca el overlay
    overlay.addEventListener("click",()=>{
      clearTimeout(closeTimer);
      overlay.remove();
      if((source==="qr"||source==="qr-url")&&activeView==="checkin") setTimeout(()=>startScanner(),200);
    });

    if(student.phone&&remainingNow<=1&&!extra) notifyWhatsApp(student);
    if(activeView==="students"||activeView==="dashboard") render();
  }


  /* PAGOS DE ALUMNOS */
  let payModalStudentId = null;
  let studentWaiverModalId = null;

  function renderPayModal(studentId){
    const student=getStudent(studentId);
    if(!student) return "";
    const pagos=(student.payments||[]).slice().reverse();
    const total=pagos.reduce((s,p)=>s+Number(p.valor||0),0);
    return `<div class="modal-backdrop" role="dialog" aria-modal="true" id="payModal" style="z-index:9997;overflow-y:auto"><div class="modal-panel" style="max-width:520px;margin:2rem auto"><div class="modal-header"><div><span class="eyebrow">Historial de pagos</span><h3>${escapeHtml(student.name)}</h3></div><button class="btn icon" type="button" data-action="close-pay-modal" style="color:rgba(255,255,255,.7)">${icon("x")}</button></div><div style="padding:16px 20px">
      <form id="payForm" class="field-grid" style="background:var(--bg);border-radius:12px;padding:14px;margin-bottom:16px">
        <input type="hidden" name="studentId" value="${escapeHtml(studentId)}">
        <label class="field">Valor pagado (COP)<input name="valor" type="number" min="0" placeholder="Ej: 150000" required></label>
        <label class="field">Metodo de pago<select name="metodo">
          <optgroup label="Digital"><option>Nequi</option><option>Daviplata</option><option>Llave</option><option>PSE</option></optgroup>
          <optgroup label="Tarjeta"><option>Tarjeta debito</option><option>Tarjeta credito</option></optgroup>
          <optgroup label="Bancos"><option value="Bancolombia">Bancolombia</option><option value="Davivienda">Davivienda</option><option value="BBVA">BBVA</option><option value="Banco de Bogota">Banco de Bogota</option><option value="Banco Popular">Banco Popular</option><option value="Banco Caja Social">Banco Caja Social</option><option value="Banco de Occidente">Banco de Occidente</option><option value="Banco AV Villas">Banco AV Villas</option><option value="Colpatria">Colpatria</option><option value="GNB Sudameris">GNB Sudameris</option><option value="Itau">Itau</option><option value="Citibank">Citibank</option><option value="Scotiabank">Scotiabank</option><option value="Falabella">Falabella</option><option value="Serfinanza">Serfinanza</option><option value="Coopcentral">Coopcentral</option><option value="Bancamia">Bancamia</option><option value="Banco Agrario">Banco Agrario</option><option value="Finandina">Finandina</option><option value="Nu Colombia">Nu Colombia</option></optgroup>
          <option>Efectivo</option><option>Otro</option>
        </select></label>
        <label class="field">Fecha<input name="fechaPago" type="date" value="${new Date().toISOString().slice(0,10)}" required></label>
        <label class="field">Hora<input name="horaPago" type="time" value="${new Date().toTimeString().slice(0,5)}"></label>
        <label class="field wide">Concepto (opcional)<input name="concepto" placeholder="Ej: Mensualidad mayo, Inscripcion..."></label>
        <div class="split-actions wide"><button class="btn primary" type="submit">${icon("dollar")}Registrar pago</button></div>
      </form>
      ${pagos.length?`<div style="font-size:.78rem;color:var(--muted);margin-bottom:6px">Total registrado: <strong style="color:var(--ink)">${new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0}).format(total)}</strong></div>
      <div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Valor</th><th>Metodo</th><th>Concepto</th><th></th></tr></thead><tbody>
        ${pagos.map((p,i)=>`<tr><td style="font-size:.78rem">${escapeHtml(p.fecha+(p.hora?" "+p.hora:""))}</td><td style="font-weight:600;color:var(--success)">${new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0}).format(Number(p.valor||0))}</td><td>${escapeHtml(p.metodo||"")}</td><td style="font-size:.78rem">${escapeHtml(p.concepto||"-")}</td><td><button class="btn icon danger" type="button" data-action="delete-payment" data-student-id="${escapeHtml(studentId)}" data-pay-idx="${pagos.length-1-i}">${icon("trash")}</button></td></tr>`).join("")}
      </tbody></table></div>`:"<div class=\"empty\">Sin pagos registrados todavia.</div>"}
    </div></div></div>`;
  }

  function savePayment(form){
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
    saveState();
    setToast("Pago registrado correctamente.");
    // Re-render el modal
    const existing=document.getElementById("payModal");
    if(existing){
      const div=document.createElement("div");
      div.innerHTML=renderPayModal(studentId);
      existing.replaceWith(div.firstElementChild);
    }
  }

  function deletePayment(studentId,idx){
    const student=getStudent(studentId);
    if(!student||!student.payments) return;
    if(!window.confirm("Eliminar este pago?")) return;
    student.payments.splice(idx,1);
    student.updatedAt=new Date().toISOString();
    saveState(); setToast("Pago eliminado.");
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
    return `<div class="modal-backdrop" role="dialog" aria-modal="true" id="studentWaiverModal" style="z-index:9996;overflow-y:auto"><div class="modal-panel" style="max-width:520px;margin:2rem auto"><div class="modal-header"><div><img class="modal-logo" src="assets/logo-acqua-blanco.png" alt="ACQUA NATACION"><span class="eyebrow">Documento digital</span><h3>Firma de exoneracion</h3></div><button class="btn icon" type="button" data-action="close-student-waiver" style="color:rgba(255,255,255,.7)">${icon("x")}</button></div>
      <div style="padding:16px 20px">
        <div class="waiver-copy">
          <p><strong>Estudiante:</strong> ${escapeHtml(student.name)}<br><strong>Documento:</strong> ${escapeHtml(student.documento||"No registrado")}</p>
          <p style="font-weight:700;margin:10px 0 6px;font-size:.92rem">DECLARACIONES Y AUTORIZACION</p>
          <ol style="padding-left:16px;margin:0;display:grid;gap:6px;font-size:.78rem;line-height:1.5">
            <li><strong>Conocimiento del Riesgo:</strong> Declaro conocer las condiciones de la actividad de natacion, que incluye medio acuatico, y autorizo la participacion del estudiante bajo la supervision de ACQUA NATACION.</li>
            <li><strong>Estado de Salud:</strong> Certifico que el estudiante se encuentra en buen estado de salud. Me comprometo a informar al equipo cualquier novedad medica, alergia o condicion relevante que pueda afectar su participacion.</li>
            <li><strong>Supervision y Normas:</strong> Acepto que la actividad se realizara bajo supervision de los entrenadores de ACQUA NATACION, y me aseguro de que el estudiante acatara todas las instrucciones y normas de seguridad.</li>
            <li><strong>Exoneracion:</strong> Acepto los riesgos naturales de la actividad deportiva acuatica y exonero de responsabilidad a ACQUA NATACION y su personal por incidentes o lesiones que ocurran durante las clases, siempre que la academia haya cumplido con las medidas de seguridad correspondientes.</li>
            <li><strong>Atencion Medica:</strong> En caso de emergencia, autorizo al personal a brindar primeros auxilios o a trasladar al estudiante al centro medico mas cercano.</li>
          </ol>
        </div>
        ${existingWaiver?`<div style="background:var(--success-tint);border:1px solid var(--success);border-radius:10px;padding:10px 14px;margin-top:12px;font-size:.82rem">Firmado por <strong>${escapeHtml(existingWaiver.name)}</strong> (${escapeHtml(existingWaiver.document)}) el ${escapeHtml(existingWaiver.signedAt)}</div>`:""}
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

  function saveStudentPublic(form){
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
    const code=nextStudentCode();
    const student={ id:uid("student"), code, name, category:String(fd.get("category")||"Infantil"), birthdate:String(fd.get("birthdate")||"").trim(), documento:String(fd.get("documento")||"").trim(), responsible:String(fd.get("responsible")||"").trim(), phoneAcudiente:String(fd.get("phoneAcudiente")||"").trim(), phone, email:String(fd.get("email")||"").trim(), planType, customClasses:planType==="custom"?customClasses:"", status:"active", talla:String(fd.get("talla")||"").trim(),peso:String(fd.get("peso")||"").trim(),sangre:String(fd.get("sangre")||"").trim(),eps:String(fd.get("eps")||"").trim(),camiseta:String(fd.get("camiseta")||"").trim(),notes:String(fd.get("notes")||"").trim(), monthKey:state.currentMonth, classesUsed:0, createdAt:now, updatedAt:now };
    state.students.push(student);
    saveState();
    // Mostrar confirmacion y limpiar formulario
    form.reset();
    const cf=form.querySelector("[data-custom-classes]");
    if(cf) cf.hidden=true;
    // Overlay de confirmacion - el botón recarga la vista limpia
    const overlayConf=document.createElement("div");
    overlayConf.id="confirm-overlay";
    overlayConf.innerHTML=`<div style="position:fixed;inset:0;background:rgba(0,0,0,.55);backdrop-filter:blur(8px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px"><div style="background:#fff;border-radius:24px;padding:2rem 1.5rem;max-width:340px;width:100%;text-align:center;box-shadow:0 24px 64px rgba(0,0,0,.28)"><div style="width:68px;height:68px;border-radius:50%;background:linear-gradient(135deg,#34c759,#2da44e);color:#fff;font-size:2.2rem;line-height:68px;margin:0 auto 1rem">&#10003;</div><h2 style="font-size:1.25rem;font-weight:800;margin:0 0 6px;color:#0a2472">Alumno registrado</h2><p style="font-size:1rem;font-weight:700;color:#1565c0;margin:0 0 4px">${escapeHtml(name)}</p><p style="font-size:.88rem;color:#666;margin:0 0 1.4rem">Codigo asignado: <strong style="color:#0a2472">${escapeHtml(code)}</strong></p><button id="btnRegisterAnother" style="background:#0a2472;color:#fff;border:none;border-radius:12px;padding:12px 28px;font-size:.95rem;font-weight:700;cursor:pointer;width:100%">Registrar otro alumno</button></div></div>`;
    document.body.appendChild(overlayConf);
    document.getElementById("btnRegisterAnother").onclick=function(){
      document.getElementById("confirm-overlay")?.remove();
    };
  }

  function saveStudent(form){
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
    const student={ ...(existing||{}), id:existing?.id||uid("student"), code:existing?.code||nextStudentCode(), name, category:String(fd.get("category")||"Infantil"), birthdate:String(fd.get("birthdate")||"").trim(), documento:String(fd.get("documento")||"").trim(), responsible:String(fd.get("responsible")||"").trim(), phoneAcudiente:String(fd.get("phoneAcudiente")||"").trim(), phone:String(fd.get("phone")||"").trim(), email:String(fd.get("email")||"").trim(),talla:String(fd.get("talla")||"").trim(),peso:String(fd.get("peso")||"").trim(),sangre:String(fd.get("sangre")||"").trim(),eps:String(fd.get("eps")||"").trim(),camiseta:String(fd.get("camiseta")||"").trim(),planType, customClasses:planType==="custom"?customClasses:"", status:String(fd.get("status")||"active"), talla:String(fd.get("talla")||"").trim(),peso:String(fd.get("peso")||"").trim(),sangre:String(fd.get("sangre")||"").trim(),eps:String(fd.get("eps")||"").trim(),camiseta:String(fd.get("camiseta")||"").trim(),notes:String(fd.get("notes")||"").trim(), monthKey:existing?.monthKey||state.currentMonth, classesUsed:Number(existing?.classesUsed||0), createdAt:existing?.createdAt||now, updatedAt:now };
    if(existing){ state.students=state.students.map(s=>s.id===existing.id?student:s); setToast("Alumno actualizado."); }
    else{ state.students.push(student); setToast(`Alumno creado con codigo ${student.code}.`); }
    editingStudentId=null; studentsFormVisible=false;
    saveState(); render();
  }

  function renewStudent(studentId,silent=false,newPlanType=null){
    const student=getStudent(studentId);
    if(!student) return;
    if(newPlanType) student.planType=newPlanType;
    student.monthKey=state.currentMonth; student.classesUsed=0; student.bonusClasses=0;
    student.lastRenewedAt=new Date().toISOString(); student.updatedAt=student.lastRenewedAt;
    if(!silent) setToast(`${student.name} renovado para ${monthLabel(state.currentMonth)}.`);
  }
  function renewAllActive(){
    const active=state.students.filter(s=>s.status==="active");
    if(!active.length){ setToast("No hay alumnos activos para renovar."); return; }
    const ok=window.confirm(`Renovar ${active.length} alumnos activos para ${monthLabel(state.currentMonth)}?`);
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
  }
  function notifyWhatsApp(student){
    if(!student?.phone){ setToast("Este alumno no tiene telefono guardado."); return; }
    const digits=String(student.phone).replace(/\D/g,"");
    if(!digits){ setToast("El telefono del alumno no parece valido."); return; }
    const phone=digits.length===10&&digits.startsWith("3")?`57${digits}`:digits;
    const remaining=remainingClasses(student);
    let message=`Hola ${student.name}. Te escribimos de ${DEFAULT_BUSINESS}. `;
    if(remaining<=0) message+="Queremos recordarte que tu plan se ha culminado. Te esperamos para renovarlo y continuar con nosotros. Muchas gracias!";
    else if(remaining===1) message+="Esperamos que tengas un lindo dia. Queremos recordarte que tu plan se culmina en la siguiente clase, esperamos lo puedas renovar y continuar con nosotros. Muchas gracias!";
    else message+="Tienes "+remaining+" clases disponibles. Recuerda renovar a tiempo para no perder tu cupo.";
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`,"_blank","noopener");
  }
  function deleteStudent(studentId){
    const student=getStudent(studentId);
    if(!student) return;
    if(!window.confirm(`Eliminar a ${student.name} definitivamente?\nEsto borrara su historial de asistencia y no se puede deshacer.`)) return;
    state.students=state.students.filter(s=>s.id!==studentId);
    state.attendance=state.attendance.filter(a=>a.studentId!==studentId);
    saveState(); setToast("Alumno eliminado definitivamente."); render();
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
        ph.innerHTML=`<div style="padding:20px;text-align:center"><div style="font-size:2.5rem;margin-bottom:8px">&#128247;</div><p style="color:var(--danger);font-weight:700;font-size:.9rem;margin:0 0 8px">No se pudo abrir la camara</p><p style="color:var(--muted);font-size:.78rem;margin:0 0 14px">${escapeHtml(msg)}</p><button class="btn primary" type="button" data-action="start-scanner">Intentar de nuevo</button></div>`;
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
  function saveEvent(form){
    const fd=new FormData(form);
    const name=String(fd.get("eventName")||"").trim(), date=String(fd.get("eventDate")||"").trim(), place=String(fd.get("eventPlace")||"").trim();
    if(!name||!date||!place){ setToast("Completa nombre, fecha y lugar del evento."); return; }
    const event={ id:uid("event"), name, date, place, attendees:[], createdAt:new Date().toISOString(), updatedAt:new Date().toISOString() };
    state.events.push(event); activeEventId=event.id;
    saveState(); setToast("Evento creado."); render();
  }
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
  function deleteEvent(eventId){ const event=getEvent(eventId); if(!event)return; if(!window.confirm(`Eliminar "${event.name}" y sus inscritos?`))return; state.events=state.events.filter(e=>e.id!==eventId); if(activeEventId===eventId)activeEventId=null; saveState(); setToast("Evento eliminado."); render(); }
  function enrollEventStudent(eventId,studentId){ const event=getEvent(eventId), student=getStudent(studentId); if(!event||!student){ setToast("No encontre el evento o el alumno."); return; } event.attendees=event.attendees||[]; if(event.attendees.some(a=>a.studentId===student.id)){ setToast("Ese alumno ya esta inscrito."); return; } event.attendees.push({studentId:student.id,paid:false,signed:false,signature:null,addedAt:new Date().toISOString()}); event.updatedAt=new Date().toISOString(); saveState(); setToast(`${student.name} inscrito en el evento.`); render(); }
  function toggleEventPaid(eventId,studentId){ const attendee=findEventAttendee(eventId,studentId); if(!attendee)return; attendee.paid=!attendee.paid; touchEvent(eventId); saveState(); render(); }
  function removeEventStudent(eventId,studentId){ const event=getEvent(eventId), student=getStudent(studentId); if(!event||!student)return; if(!window.confirm(`Quitar a ${student.name} de "${event.name}"?`))return; event.attendees=(event.attendees||[]).filter(a=>a.studentId!==studentId); touchEvent(eventId); saveState(); setToast("Alumno retirado del evento."); render(); }
  function findEventAttendee(eventId,studentId){ return getEvent(eventId)?.attendees?.find(a=>a.studentId===studentId); }
  function touchEvent(eventId){ const event=getEvent(eventId); if(event)event.updatedAt=new Date().toISOString(); }
  function saveSignature(form){
    const fd=new FormData(form);
    const eventId=String(fd.get("eventId")||""), studentId=String(fd.get("studentId")||"");
    const attendee=findEventAttendee(eventId,studentId);
    if(!attendee){ setToast("No encontre la inscripcion para firmar."); return; }
    attendee.signed=true; attendee.signature={ name:String(fd.get("signatureName")||"").trim(), document:String(fd.get("signatureDocument")||"").trim(), signedAt:new Intl.DateTimeFormat("es-CO",{dateStyle:"medium",timeStyle:"short"}).format(new Date()) };
    touchEvent(eventId); signatureDraft=null;
    saveState(); setToast("Firma guardada."); render();
  }

  /* EXPORTAR / IMPORTAR */
  function exportJson(){
    if(typeof XLSX==="undefined"){ setToast("Libreria Excel no disponible. Recarga la pagina."); return; }
    try {
      const wb=XLSX.utils.book_new();
      const studentRows=state.students.map(s=>({ "Codigo":s.code||"", "Nombre":s.name||"", "Documento":s.documento||"", "Categoria":s.category||"", "Fecha nacimiento":s.birthdate||"", "Plan":PLAN_LABELS[s.planType]||s.planType||"", "Clases totales":planTotal(s), "Clases usadas":Number(s.classesUsed||0), "Clases restantes":remainingClasses(s), "Estado":s.status==="active"?"Activo":"Inactivo", "Telefono alumno":s.phone||"", "Acudiente":s.responsible||"", "Tel acudiente":s.phoneAcudiente||"", "Email":s.email||"", "Notas":s.notes||"", "Mes renovacion":s.monthKey||"" }));
      const wsStudents=XLSX.utils.json_to_sheet(studentRows.length?studentRows:[{"Codigo":"","Nombre":""}]);
      wsStudents["!cols"]=[8,26,14,12,14,20,10,10,10,10,14,20,14,24,24,12].map(w=>({wch:w}));
      XLSX.utils.book_append_sheet(wb,wsStudents,"Alumnos");
      const attendanceRows=[...state.attendance].sort((a,b)=>new Date(b.at)-new Date(a.at)).map(entry=>{ const s=getStudent(entry.studentId)||{}; return { "Fecha y hora":formatDateTime(entry.at), "Mes":entry.monthKey||"", "Nombre":s.name||"", "Codigo":s.code||entry.studentId, "Plan":PLAN_LABELS[s.planType]||"", "Origen":(entry.source==="qr"||entry.source==="qr-url")?"QR":"Manual", "Tipo":entry.extra?"Extra":"Plan" }; });
      const wsAttendance=XLSX.utils.json_to_sheet(attendanceRows.length?attendanceRows:[{"Fecha y hora":"","Nombre":""}]);
      wsAttendance["!cols"]=[18,8,24,10,16,8,6].map(w=>({wch:w}));
      XLSX.utils.book_append_sheet(wb,wsAttendance,"Asistencia");
      const wsDatos=XLSX.utils.aoa_to_sheet([[JSON.stringify(state)]]);
      XLSX.utils.book_append_sheet(wb,wsDatos,"_datos");
      const wbOut=XLSX.write(wb,{bookType:"xlsx",type:"array"});
      const blob=new Blob([wbOut],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
      const url=URL.createObjectURL(blob);
      const link=document.createElement("a"); link.href=url; link.download=`acqua-respaldo-${state.currentMonth}.xlsx`;
      document.body.append(link); link.click(); link.remove(); URL.revokeObjectURL(url);
      setToast("Respaldo Excel descargado.");
    } catch(err){ console.error(err); setToast("Error al generar el Excel."); }
  }
  function exportCsv(){
    const header=["fecha","alumno","codigo","plan","origen","tipo"];
    const rows=monthAttendance().map(entry=>{ const s=getStudent(entry.studentId)||{}; return [formatDateTime(entry.at),s.name||"",s.code||entry.studentId,PLAN_LABELS[s.planType]||"",(entry.source==="qr"||entry.source==="qr-url")?"QR":"Manual",entry.extra?"extra":"plan"]; });
    const csv=[header,...rows].map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8"});
    const url=URL.createObjectURL(blob);
    const link=document.createElement("a"); link.href=url; link.download=`acqua-asistencia-${state.currentMonth}.csv`;
    document.body.append(link); link.click(); link.remove(); URL.revokeObjectURL(url);
    setToast("CSV de asistencia descargado.");
  }
  function importJson(file){
    if(file.name.endsWith(".xlsx")){
      const reader=new FileReader();
      reader.onload=()=>{ try { const wb=XLSX.read(reader.result,{type:"array"}); const wsName=wb.SheetNames.find(n=>n==="_datos"); if(!wsName)throw new Error("Hoja _datos no encontrada"); const ws=wb.Sheets[wsName]; const raw=XLSX.utils.sheet_to_json(ws,{header:1}); const imported=JSON.parse(raw[0][0]); if(!Array.isArray(imported.students))throw new Error("Invalid"); state={ version:1, currentMonth:imported.currentMonth||monthKey(new Date()), settings:{businessName:DEFAULT_BUSINESS}, students:imported.students, attendance:imported.attendance||[], events:Array.isArray(imported.events)?imported.events:[] }; saveState(); setToast("Respaldo Excel importado."); render(); } catch(e){ console.error(e); setToast("El archivo Excel no es un respaldo valido de ACQUA."); } };
      reader.readAsArrayBuffer(file);
    } else {
      const reader=new FileReader();
      reader.onload=()=>{ try { const imported=JSON.parse(String(reader.result||"{}")); if(!Array.isArray(imported.students))throw new Error("Invalid"); state={ version:1, currentMonth:imported.currentMonth||monthKey(new Date()), settings:{businessName:DEFAULT_BUSINESS}, students:imported.students, attendance:imported.attendance||[], events:Array.isArray(imported.events)?imported.events:[] }; saveState(); setToast("Respaldo importado."); render(); } catch(e){ console.error(e); setToast("El archivo no parece ser un respaldo valido."); } };
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
    state={ version:1, currentMonth:monthKey(new Date()), settings:{businessName:DEFAULT_BUSINESS}, students:[], attendance:[], events:[] };
    saveState(); editingStudentId=null; activeEventId=null; signatureDraft=null; checkinSearch=""; studentFilters={search:"",plan:"all",status:"active"}; cardSearch="";
    setToast("Datos borrados."); render();
  }

  /* MANEJADORES DE EVENTOS */
  function preserveFocus(selector,renderFn=render){ renderFn(); window.requestAnimationFrame(()=>{ const el=document.querySelector(selector); if(!el)return; el.focus(); if(el.setSelectionRange)el.setSelectionRange(el.value.length,el.value.length); }); }

  document.addEventListener("click",event=>{
    const viewButton=event.target.closest("[data-view]");
    if(viewButton){
      if(!isAuthenticated){ loginModalVisible=true; render(); return; }
      activeView=viewButton.dataset.view;
      if(activeView!=="events"){ activeEventId=null; signatureDraft=null; }
      render(); return;
    }
    const action=event.target.closest("[data-action]");
    if(!action) return;
    const id=action.dataset.id, eventId=action.dataset.eventId, studentId=action.dataset.studentId;
    switch(action.dataset.action){
      case "open-login":  loginModalVisible=true; render(); break;
      case "close-login": loginModalVisible=false; const lmClose=document.getElementById("loginModal"); if(lmClose)lmClose.remove(); render(); break;
      case "logout":      logout(); break;

      case "renew-student":           renewModalStudentId=id; renewModalChangePlan=false; render(); break;
      case "close-renewal-modal":     renewModalStudentId=null; renewModalChangePlan=false; render(); break;
      case "confirm-renewal-same":    renewStudent(renewModalStudentId); saveState(); renewModalStudentId=null; renewModalChangePlan=false; render(); break;
      case "show-renewal-change-plan":renewModalChangePlan=true; render(); break;
      case "renewal-back-options":    renewModalChangePlan=false; render(); break;
      case "confirm-renewal-plan":    renewStudent(renewModalStudentId,false,action.dataset.plan); saveState(); renewModalStudentId=null; renewModalChangePlan=false; render(); break;
      case "confirm-renewal-individual": renewStudent(renewModalStudentId,false,"1_practica"); saveState(); renewModalStudentId=null; renewModalChangePlan=false; render(); break;
      case "add-one-class": { const stAdd=getStudent(renewModalStudentId); if(stAdd){ stAdd.bonusClasses=(Number(stAdd.bonusClasses||0)+1); stAdd.updatedAt=new Date().toISOString(); saveState(); setToast("1 clase extra sumada a "+stAdd.name+". Total disponibles: "+(remainingClasses(stAdd)+1)); } renewModalStudentId=null; renewModalChangePlan=false; render(); break; }

      case "go-checkin": activeView="checkin"; render(); break;
      case "go-register": activeView="register"; render(); break;
      case "go-events":  activeView="events";  render(); break;
      case "go-reports": activeView="reports"; render(); break;

      case "new-student":    editingStudentId=null; studentsFormVisible=true; render(); window.requestAnimationFrame(()=>{ const el=document.querySelector('#studentForm [name="name"]'); if(el){el.focus();el.select();} }); break;
      case "edit-student":   editingStudentId=id; studentsFormVisible=true; activeView="students"; render(); window.requestAnimationFrame(()=>document.querySelector('#studentForm [name="name"]')?.focus()); break;
      case "cancel-edit":    editingStudentId=null; studentsFormVisible=false; render(); break;
      case "toggle-students-form": studentsFormVisible=!studentsFormVisible; if(!studentsFormVisible)editingStudentId=null; render(); break;
      case "register-class":  registerClass(id,"manual"); break;
      case "notify-student":  notifyWhatsApp(getStudent(id)); break;
      case "renew-all":       renewAllActive(); break;
      case "pause-student":   pauseStudent(id); break;
      case "open-pay-modal":  { payModalStudentId=id; const d=document.createElement("div"); d.innerHTML=renderPayModal(id); document.body.appendChild(d.firstElementChild); break; }
      case "close-pay-modal": { payModalStudentId=null; document.getElementById("payModal")?.remove(); break; }
      case "delete-payment":  { deletePayment(action.dataset.studentId,Number(action.dataset.payIdx)); break; }
      case "delete-student":   deleteStudent(id); break;
      case "delete-attendance": deleteAttendance(action.dataset.attId); break;
      case "send-waiver-whatsapp": { const stWA=getStudent(id); if(!stWA) break;
        if(stWA.waiver){ setToast("Este alumno ya firmo el documento el "+stWA.waiver.signedAt); break; }
        const firmaUrl="https://app-acqua.netlify.app/firma-acqua.html?alumno="+encodeURIComponent(stWA.code);
        const digits=String(stWA.phone||"").replace(/\D/g,"");
        const phone=digits.length===10&&digits.startsWith("3")?"57"+digits:digits;
        const msg="Hola "+stWA.name+". Te enviamos el documento de exoneracion y autorizacion de ACQUA NATACION. "+"Por favor revisalo y firmalo digitalmente en el siguiente enlace:\n\n"+firmaUrl+"\n\nEste documento es obligatorio para participar en las clases.";
        if(phone) window.open("https://wa.me/"+phone+"?text="+encodeURIComponent(msg),"_blank","noopener");
        else { navigator.clipboard?.writeText(firmaUrl).catch(()=>{}); setToast("Copia el enlace: "+firmaUrl); }
        break; }
      case "open-student-waiver": { const wDiv=document.createElement("div"); wDiv.innerHTML=renderStudentWaiverModal(id); document.body.appendChild(wDiv.firstElementChild); break; }
      case "close-student-waiver": document.getElementById("studentWaiverModal")?.remove(); break;
      case "send-waiver-whatsapp": {
        const stWA=getStudent(id); if(!stWA) break;
        if(stWA.waiver){ setToast("Este alumno ya firmo el "+stWA.waiver.signedAt); break; }
        const firmaUrl="https://app-acqua.netlify.app/firma-acqua.html?alumno="+encodeURIComponent(stWA.code);
        const digWA=String(stWA.phone||"").replace(/\D/g,"");
        const phoneWA=digWA.length===10&&digWA.startsWith("3")?"57"+digWA:digWA;
        const msgWA="Hola "+stWA.name+". Te enviamos el documento de exoneracion y autorizacion de ACQUA NATACION. Por favor revisalo y firmalo digitalmente en el siguiente enlace:\n\n"+firmaUrl+"\n\nEste documento es obligatorio para participar en las clases.";
        if(phoneWA) window.open("https://wa.me/"+phoneWA+"?text="+encodeURIComponent(msgWA),"_blank","noopener");
        else { setToast("El alumno no tiene telefono registrado. Copia: "+firmaUrl); }
        break;
      }
      case "reset-student-waiver": { const stW2=getStudent(action.dataset.id||id); if(stW2&&window.confirm("Restablecer la firma de "+stW2.name+"?")){ delete stW2.waiver; saveState(); document.getElementById("studentWaiverModal")?.remove(); setToast("Firma restablecida."); } break; }
      case "open-student-waiver": { const d=document.createElement("div"); d.innerHTML=renderStudentWaiverModal(id); document.body.appendChild(d.firstElementChild); break; }
      case "close-student-waiver": document.getElementById("studentWaiverModal")?.remove(); break;
      case "send-waiver-whatsapp": {
        const stWA=getStudent(id); if(!stWA) break;
        if(stWA.waiver){ setToast("Este alumno ya firmo el "+stWA.waiver.signedAt); break; }
        const firmaUrl="https://app-acqua.netlify.app/firma-acqua.html?alumno="+encodeURIComponent(stWA.code);
        const digWA=String(stWA.phone||"").replace(/\D/g,"");
        const phoneWA=digWA.length===10&&digWA.startsWith("3")?"57"+digWA:digWA;
        const msgWA="Hola "+stWA.name+". Te enviamos el documento de exoneracion y autorizacion de ACQUA NATACION. Por favor revisalo y firmalo digitalmente en el siguiente enlace:\n\n"+firmaUrl+"\n\nEste documento es obligatorio para participar en las clases.";
        if(phoneWA) window.open("https://wa.me/"+phoneWA+"?text="+encodeURIComponent(msgWA),"_blank","noopener");
        else { setToast("El alumno no tiene telefono registrado. Copia: "+firmaUrl); }
        break;
      }
      case "reset-student-waiver": { const stW=getStudent(action.dataset.id||id); if(stW&&window.confirm("Restablecer la firma de "+stW.name+"?")){ delete stW.waiver; saveState(); document.getElementById("studentWaiverModal")?.remove(); setToast("Firma restablecida."); } break; }
      case "delete-attendance": deleteAttendance(action.dataset.attId); break;
      case "open-student-waiver": { const d=document.createElement("div"); d.innerHTML=renderStudentWaiverModal(id); document.body.appendChild(d.firstElementChild); break; }
      case "close-student-waiver": document.getElementById("studentWaiverModal")?.remove(); break;
      case "send-waiver-whatsapp": {
        const stWA=getStudent(id); if(!stWA) break;
        if(stWA.waiver){ setToast("Este alumno ya firmo el "+stWA.waiver.signedAt); break; }
        const firmaUrl="https://app-acqua.netlify.app/firma-acqua.html?alumno="+encodeURIComponent(stWA.code);
        const digWA=String(stWA.phone||"").replace(/\D/g,"");
        const phoneWA=digWA.length===10&&digWA.startsWith("3")?"57"+digWA:digWA;
        const msgWA="Hola "+stWA.name+". Te enviamos el documento de exoneracion y autorizacion de ACQUA NATACION. Por favor revisalo y firmalo digitalmente en el siguiente enlace:\n\n"+firmaUrl+"\n\nEste documento es obligatorio para participar en las clases.";
        if(phoneWA) window.open("https://wa.me/"+phoneWA+"?text="+encodeURIComponent(msgWA),"_blank","noopener");
        else { setToast("El alumno no tiene telefono registrado. Copia: "+firmaUrl); }
        break;
      }
      case "reset-student-waiver": { const stW=getStudent(action.dataset.id||id); if(stW&&window.confirm("Restablecer la firma de "+stW.name+"?")){ delete stW.waiver; saveState(); document.getElementById("studentWaiverModal")?.remove(); setToast("Firma restablecida."); } break; }
      case "delete-attendance": deleteAttendance(action.dataset.attId); break;
      case "open-student-waiver": { const d=document.createElement("div"); d.innerHTML=renderStudentWaiverModal(id); document.body.appendChild(d.firstElementChild); break; }
      case "close-student-waiver": document.getElementById("studentWaiverModal")?.remove(); break;
      case "send-waiver-whatsapp": {
        const stWA=getStudent(id); if(!stWA) break;
        if(stWA.waiver){ setToast("Este alumno ya firmo el "+stWA.waiver.signedAt); break; }
        const firmaUrl="https://app-acqua.netlify.app/firma-acqua.html?alumno="+encodeURIComponent(stWA.code);
        const digWA=String(stWA.phone||"").replace(/\D/g,"");
        const phoneWA=digWA.length===10&&digWA.startsWith("3")?"57"+digWA:digWA;
        const msgWA="Hola "+stWA.name+". Te enviamos el documento de exoneracion y autorizacion de ACQUA NATACION. Por favor revisalo y firmalo digitalmente en el siguiente enlace:\n\n"+firmaUrl+"\n\nEste documento es obligatorio para participar en las clases.";
        if(phoneWA) window.open("https://wa.me/"+phoneWA+"?text="+encodeURIComponent(msgWA),"_blank","noopener");
        else { setToast("El alumno no tiene telefono registrado. Copia: "+firmaUrl); }
        break;
      }
      case "reset-student-waiver": { const stW=getStudent(action.dataset.id||id); if(stW&&window.confirm("Restablecer la firma de "+stW.name+"?")){ delete stW.waiver; saveState(); document.getElementById("studentWaiverModal")?.remove(); setToast("Firma restablecida."); } break; }
      case "delete-attendance": deleteAttendance(action.dataset.attId); break;
      case "open-student-waiver": { const d=document.createElement("div"); d.innerHTML=renderStudentWaiverModal(id); document.body.appendChild(d.firstElementChild); break; }
      case "close-student-waiver": document.getElementById("studentWaiverModal")?.remove(); break;
      case "send-waiver-whatsapp": {
        const stWA=getStudent(id); if(!stWA) break;
        if(stWA.waiver){ setToast("Este alumno ya firmo el "+stWA.waiver.signedAt); break; }
        const firmaUrl="https://app-acqua.netlify.app/firma-acqua.html?alumno="+encodeURIComponent(stWA.code);
        const digWA=String(stWA.phone||"").replace(/\D/g,"");
        const phoneWA=digWA.length===10&&digWA.startsWith("3")?"57"+digWA:digWA;
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

      case "view-event":           activeView="events"; activeEventId=id; render(); break;
      case "back-events":          activeEventId=null; signatureDraft=null; render(); break;
      case "events-view-list":     calendarView="list"; render(); break;
      case "events-view-calendar": calendarView="calendar"; render(); break;
      case "cal-prev":             { const cm=getCalMonth(); calendarMonth=new Date(cm.getFullYear(),cm.getMonth()-1,1); render(); break; }
      case "cal-next":             { const cm2=getCalMonth(); calendarMonth=new Date(cm2.getFullYear(),cm2.getMonth()+1,1); render(); break; }
      case "delete-internal-event":{ if(!window.confirm("Eliminar este evento interno?")) break; state.internalEvents=(state.internalEvents||[]).filter(e=>e.id!==id); saveState(); setToast("Evento interno eliminado."); render(); break; }
      case "delete-event":         deleteEvent(id); break;
      case "toggle-event-paid":    toggleEventPaid(eventId,studentId); break;
      case "remove-event-student": removeEventStudent(eventId,studentId); break;
      case "open-signature":       signatureDraft={eventId,studentId}; render(); break;
      case "close-signature":      signatureDraft=null; render(); break;

      case "export-json":    exportJson(); break;
      case "export-csv":     exportCsv(); break;
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
    if(form.id==="internalEventForm") { saveInternalEvent(form); return; }
    if(form.id==="signatureForm")  { saveSignature(form); return; }
    if(form.id==="eventEnrollForm"){ const fd=new FormData(form); enrollEventStudent(String(fd.get("eventId")||""),String(fd.get("studentId")||"")); return; }
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

  document.addEventListener("input",event=>{
    const target=event.target;
    if(target.matches("[data-filter='students-search']")){ studentFilters.search=target.value; preserveFocus("[data-filter='students-search']"); return; }
    if(target.matches("[data-filter='checkin-search']")){ checkinSearch=target.value; preserveFocus("[data-filter='checkin-search']"); return; }
    if(target.matches("[data-filter='cards-search']")){ cardSearch=target.value; preserveFocus("[data-filter='cards-search']"); }
  });

  document.addEventListener("change",event=>{
    const target=event.target;
    if(target===globalMonth){ state.currentMonth=target.value||monthKey(new Date()); saveState(); render(); return; }
    if(target.matches("[data-filter='students-plan']"))  { studentFilters.plan=target.value; render(); return; }
    if(target.matches("[data-filter='students-status']")){ studentFilters.status=target.value; render(); return; }
    if(target.matches("[data-plan-select]")){ const cf=document.querySelector("[data-custom-classes]"); if(cf)cf.hidden=target.value!=="custom"; return; }
    if(target.id==="importFile"&&target.files?.[0]){ importJson(target.files[0]); target.value=""; }
  });

  globalMonth.addEventListener("change",event=>{ state.currentMonth=event.target.value||monthKey(new Date()); saveState(); render(); });
  window.addEventListener("beforeunload",()=>stopScanner(false));

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
      +".qr{position:absolute;top:25%;left:50%;transform:translateX(-50%);width:71%;border-radius:10px;overflow:hidden;background:#fff;line-height:0}"
      +".qr svg{width:100%;height:auto;display:block}"
      +".nombre{position:absolute;top:71%;left:0;right:0;text-align:center;padding:0 8px;color:#0a2472;font-weight:800;letter-spacing:.04em;line-height:1.3}"
      +".n1,.n2{font-size:1.15rem;display:block}"
      +".cat{font-size:.78rem;font-weight:600;color:#1565c0;margin-top:3px;display:block}"
      +".dias{font-size:.68rem;font-weight:600;color:#0a2472;margin-top:3px;display:block}"
      +".fund{position:absolute;bottom:3%;left:0;right:0;text-align:center;font-size:.46rem;color:#8899cc;letter-spacing:.05em}"
      +"button{padding:11px 28px;background:#0a2472;color:#fff;border:none;border-radius:12px;font-size:.95rem;font-weight:700;cursor:pointer}"
      +"</style></head><body>"
      +"<article>"
      +"<img class='bg' src='"+imgSrc+"' alt=''>"
      +"<div class='qr'>"+svgHtml+"</div>"
      +"<div class='nombre'>"
      +"<span class='n1'>"+nombres+"</span>"
      +(apellidos?"<span class='n2'>"+apellidos+"</span>":"")
      +"<span class='cat'>"+cat+"</span>"
      +"<span class='dias'>Tienes 35 dias para consumir tu plan</span>"
      +"</div>"
      +"<span class='fund'>Fundado el 17 de marzo de 2015</span>"
      +"</article>"
      +"<button class='noprint' onclick='window.print()'>Guardar PDF / Imprimir</button>"
      +"</body></html>";
    win.document.write(html);
    win.document.close();
  }

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
    if(isAuthenticated) syncFromCloud();
    document.addEventListener("visibilitychange",()=>{
      if(document.visibilityState==="visible"&&CLOUD_ENABLED&&isAuthenticated) syncFromCloud();
    });
    if(CLOUD_ENABLED) setInterval(()=>{ if(isAuthenticated) syncFromCloud(); },30_000);
  })();

  /* CHECK-IN POR URL (?checkin=AC-0001) */
  (function handleUrlCheckin(){
    const params=new URLSearchParams(window.location.search);
    const code=params.get("checkin");
    if(!code) return;
    window.history.replaceState({},"",window.location.pathname);
    function showNotFound(code){
      const overlay=document.createElement("div");
      overlay.id="checkin-overlay";
      overlay.innerHTML=`<div class="checkin-modal"><div style="font-size:3rem;margin-bottom:1rem">X</div><h2 class="checkin-name">Carnet no encontrado</h2><p class="checkin-code" style="margin-bottom:1rem">Codigo: ${escapeHtml(code)}</p><p style="color:var(--muted);font-size:.88rem;margin-bottom:1.5rem">Verifica que el alumno este registrado en el sistema.</p><button class="btn primary" style="width:100%;justify-content:center" onclick="document.getElementById('checkin-overlay').remove()">Cerrar</button></div><style>#checkin-overlay{position:fixed;inset:0;background:rgba(0,0,0,.55);backdrop-filter:blur(10px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px}.checkin-modal{background:#fff;border-radius:24px;padding:2rem 1.5rem;max-width:360px;width:100%;text-align:center;box-shadow:0 24px 64px rgba(0,0,0,.28)}.checkin-name{font-size:1.4rem;font-weight:700;margin:0 0 4px}.checkin-code{font-size:.82rem;color:var(--muted)}</style>`;
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
