(() => {
  const STORAGE_KEY = "aquacontrol.state.v1";
  const DEFAULT_BUSINESS = "ACQUA NATACIÓN";

  /* ─── Supabase config ────────────────────────────────────────────────────
     1. Crea un proyecto gratis en https://supabase.com
     2. En SQL Editor ejecuta el script de acquacontrol-setup.sql
     3. Ve a Project Settings → API y pega los valores aquí              */
  const SUPABASE_URL      = "https://sokfsbzzmrpijkmlpmag.supabase.co/rest/v1/"
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNva2ZzYnp6bXJwaWprbWxwbWFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2MzYyNDgsImV4cCI6MjA5NDIxMjI0OH0.bor86ohZ-u9sUl_Lr85vDHhaw7rMyCRuNiX1ZAHVSaM";
  const CLOUD_ROW_ID      = "acquacontrol-principal"; // ID único de tu academia
  const CLOUD_ENABLED     = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
  /* ─────────────────────────────────────────────────────────────────────── */
  const PLAN_LABELS = {
    "1_practica": "1 práctica libre",
    "4": "4 clases/mes",
    "8": "8 clases/mes",
    "8_practicas": "8 prácticas libres",
    "13": "13 clases/mes",
    custom: "Personalizado",
  };
  const PLAN_CLASSES = {
    "1_practica": 1,
    "4": 4,
    "8": 8,
    "8_practicas": 8,
    "13": 13,
  };

  const app = document.querySelector("#app");
  const toast = document.querySelector("#toast");
  const globalMonth = document.querySelector("#globalMonth");
  const businessNameLabel = document.querySelector("#businessNameLabel");

  let activeView = "dashboard";
  let editingStudentId = null;
  let activeEventId = null;
  let signatureDraft = null;
  let studentsFormVisible = false;
  let cloudStatus = CLOUD_ENABLED ? "connecting" : "disabled";
  let state = loadState();
  let studentFilters = { search: "", plan: "all", status: "active" };
  let checkinSearch = "";
  let cardSearch = "";
  let useJsQr = false;
  let scanner = {
    detector: null,
    stream: null,
    timer: null,
    busy: false,
    lastPayload: "",
    lastPayloadAt: 0,
  };

  const icons = {
    plus:
      '<path d="M12 5v14M5 12h14" />',
    save:
      '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" /><path d="M17 21v-8H7v8" /><path d="M7 3v5h8" />',
    edit:
      '<path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />',
    refresh:
      '<path d="M21 12a9 9 0 0 1-15 6.7L3 16" /><path d="M3 21v-5h5" /><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M21 3v5h-5" />',
    check:
      '<path d="m20 6-11 11-5-5" />',
    scan:
      '<path d="M3 7V5a2 2 0 0 1 2-2h2" /><path d="M17 3h2a2 2 0 0 1 2 2v2" /><path d="M21 17v2a2 2 0 0 1-2 2h-2" /><path d="M7 21H5a2 2 0 0 1-2-2v-2" /><path d="M7 12h10" />',
    stop:
      '<rect x="6" y="6" width="12" height="12" rx="2" />',
    arrowLeft:
      '<path d="M19 12H5" /><path d="m12 19-7-7 7-7" />',
    x:
      '<path d="M18 6 6 18" /><path d="m6 6 12 12" />',
    print:
      '<path d="M6 9V2h12v7" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><path d="M6 14h12v8H6z" />',
    download:
      '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5 5 5-5" /><path d="M12 15V3" />',
    upload:
      '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M17 8l-5-5-5 5" /><path d="M12 3v12" />',
    calendar:
      '<path d="M8 2v4" /><path d="M16 2v4" /><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M3 10h18" />',
    map:
      '<path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="3" />',
    dollar:
      '<path d="M12 2v20" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7H14a3.5 3.5 0 0 1 0 7H6" />',
    signature:
      '<path d="M3 21c3-5 6-5 9-1 2 2 5 1 8-2" /><path d="M14.5 4.5a2.1 2.1 0 0 1 3 3L9 16l-4 1 1-4Z" />',
    message:
      '<path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 20l1.3-5.2A8.4 8.4 0 1 1 21 11.5Z" />',
    trash:
      '<path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" />',
    user:
      '<path d="M20 21a8 8 0 0 0-16 0" /><circle cx="12" cy="7" r="4" />',
    file:
      '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6" />',
  };

  function icon(name) {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || ""}</svg>`;
  }

  function loadState() {
    const fallback = {
      version: 1,
      currentMonth: monthKey(new Date()),
      settings: { businessName: DEFAULT_BUSINESS },
      students: [],
      attendance: [],
      events: [],
    };

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return {
        ...fallback,
        ...parsed,
        settings: { ...fallback.settings, ...(parsed.settings || {}) },
        students: Array.isArray(parsed.students) ? parsed.students : [],
        attendance: Array.isArray(parsed.attendance) ? parsed.attendance : [],
        events: Array.isArray(parsed.events) ? parsed.events : [],
      };
    } catch (error) {
      console.error(error);
      return fallback;
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (CLOUD_ENABLED) debouncedCloudSave(state);
  }

  /* ─── Sincronización con Supabase ────────────────────────────────────── */
  function updateSyncDot() {
    const dot = document.querySelector("#syncDot");
    if (!dot) return;
    const cfg = {
      disabled:   { icon: "●", cls: "sync-off",  tip: "Sin nube configurada" },
      connecting: { icon: "●", cls: "sync-wait", tip: "Conectando…" },
      syncing:    { icon: "●", cls: "sync-wait", tip: "Guardando en la nube…" },
      ok:         { icon: "●", cls: "sync-ok",   tip: "Datos guardados en la nube ✓" },
      error:      { icon: "●", cls: "sync-err",  tip: "Sin conexión — datos en local" },
    };
    const c = cfg[cloudStatus] || cfg.disabled;
    dot.textContent = c.icon;
    dot.title       = c.tip;
    dot.className   = `sync-dot ${c.cls}`;
  }

  async function cloudSave(snapshot) {
    if (!CLOUD_ENABLED) return;
    cloudStatus = "syncing";
    updateSyncDot();
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/app_state`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey":         SUPABASE_ANON_KEY,
          "Authorization":  `Bearer ${SUPABASE_ANON_KEY}`,
          "Prefer":         "resolution=merge-duplicates,return=minimal",
        },
        body: JSON.stringify({
          id:       CLOUD_ROW_ID,
          data:     snapshot,
          saved_at: new Date().toISOString(),
        }),
      });
      if (!res.ok) {
        const msg = await res.text().catch(() => res.status);
        throw new Error(msg);
      }
      cloudStatus = "ok";
    } catch (err) {
      console.error("cloudSave:", err);
      cloudStatus = "error";
    }
    updateSyncDot();
  }

  let _cloudSaveTimer = null;
  function debouncedCloudSave(snapshot) {
    clearTimeout(_cloudSaveTimer);
    _cloudSaveTimer = setTimeout(() => cloudSave(snapshot), 800);
  }

  async function cloudLoad() {
    if (!CLOUD_ENABLED) return null;
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/app_state?id=eq.${encodeURIComponent(CLOUD_ROW_ID)}&select=data`,
        {
          cache: "no-store",
          headers: {
            "apikey":        SUPABASE_ANON_KEY,
            "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
          },
        }
      );
      if (!res.ok) return null;
      const rows = await res.json();
      return rows[0]?.data ?? null;
    } catch {
      return null;
    }
  }

  // Aplica datos de la nube al estado local y re-renderiza
  async function syncFromCloud() {
    const cloudData = await cloudLoad();
    if (cloudData && Array.isArray(cloudData.students)) {
      state = {
        version:      1,
        currentMonth: cloudData.currentMonth || state.currentMonth,
        settings:     { businessName: DEFAULT_BUSINESS, ...(cloudData.settings || {}) },
        students:     Array.isArray(cloudData.students)   ? cloudData.students   : [],
        attendance:   Array.isArray(cloudData.attendance) ? cloudData.attendance : [],
        events:       Array.isArray(cloudData.events)     ? cloudData.events     : [],
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      cloudStatus = "ok";
      render();
    } else if (CLOUD_ENABLED) {
      cloudStatus = cloudData === null ? "error" : "ok";
    }
    updateSyncDot();
  }

  async function cloudLoad() {
    if (!CLOUD_ENABLED) return null;
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/app_state?id=eq.${encodeURIComponent(CLOUD_ROW_ID)}&select=data`,
        {
          headers: {
            "apikey": SUPABASE_ANON_KEY,
            "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
          },
        }
      );
      if (!res.ok) return null;
      const rows = await res.json();
      return rows[0]?.data ?? null;
    } catch {
      return null;
    }
  }
  /* ─────────────────────────────────────────────────────────────────────── */

  function monthKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
  }

  function dayKey(date) {
    return date.toISOString().slice(0, 10);
  }

  function monthLabel(key) {
    const [year, month] = key.split("-").map(Number);
    return new Intl.DateTimeFormat("es-CO", {
      month: "long",
      year: "numeric",
    }).format(new Date(year, month - 1, 1));
  }

  function formatDateTime(iso) {
    return new Intl.DateTimeFormat("es-CO", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => {
      const entities = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      };
      return entities[char];
    });
  }

  function uid(prefix = "id") {
    if (window.crypto && crypto.randomUUID) {
      return `${prefix}_${crypto.randomUUID()}`;
    }
    return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  function nextStudentCode() {
    const max = state.students.reduce((highest, student) => {
      const match = String(student.code || "").match(/(\d+)$/);
      const value = match ? Number(match[1]) : 0;
      return Math.max(highest, value);
    }, 0);
    return `AC-${String(max + 1).padStart(4, "0")}`;
  }

  function planTotal(student) {
    if (!student) return 0;
    if (student.planType === "custom") return Math.max(0, Number(student.customClasses || 0));
    return Math.max(0, Number(PLAN_CLASSES[student.planType] || student.planType || 0));
  }

  function remainingClasses(student) {
    return planTotal(student) - Number(student.classesUsed || 0);
  }

  function isRenewed(student) {
    return student.monthKey === state.currentMonth;
  }

  function studentStatusBadge(student) {
    if (student.status !== "active") return '<span class="badge danger">Pausado</span>';
    if (!isRenewed(student)) return '<span class="badge warn">Renovar</span>';
    const remaining = remainingClasses(student);
    if (remaining <= 0) return '<span class="badge danger">Sin clases</span>';
    if (remaining <= 2) return '<span class="badge warn">Pocas clases</span>';
    return '<span class="badge ok">Activo</span>';
  }

  function planBadge(student) {
    const total = planTotal(student);
    const label = student.planType === "custom" ? `${total} clases` : PLAN_LABELS[student.planType];
    return `<span class="badge info">${escapeHtml(label || "Sin plan")}</span>`;
  }

  function getStudent(studentId) {
    return state.students.find((student) => student.id === studentId);
  }

  function filteredStudents({ search = "", plan = "all", status = "all" } = {}) {
    const query = search.trim().toLowerCase();
    return state.students
      .filter((student) => {
        if (plan !== "all" && student.planType !== plan) return false;
        if (status !== "all" && student.status !== status) return false;
        if (!query) return true;
        const haystack = [
          student.name,
          student.code,
          student.phone,
          student.email,
          student.responsible,
          student.category,
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(query);
      })
      .sort((a, b) => a.name.localeCompare(b.name, "es"));
  }

  function monthAttendance(month = state.currentMonth) {
    return state.attendance.filter((entry) => entry.monthKey === month);
  }

  function todayAttendance() {
    const today = dayKey(new Date());
    return state.attendance.filter((entry) => dayKey(new Date(entry.at)) === today);
  }

  function stats() {
    const active = state.students.filter((student) => student.status === "active");
    const renewed = active.filter((student) => isRenewed(student));
    const totalClasses = renewed.reduce((sum, student) => sum + planTotal(student), 0);
    const usedClasses = renewed.reduce((sum, student) => sum + Number(student.classesUsed || 0), 0);
    return {
      active: active.length,
      renewed: renewed.length,
      pendingRenewal: active.length - renewed.length,
      totalClasses,
      usedClasses,
      remaining: totalClasses - usedClasses,
      today: todayAttendance().length,
      monthAttendance: monthAttendance().length,
      events: state.events.length,
    };
  }

  function setToast(message) {
    toast.textContent = message;
    toast.classList.add("is-visible");
    window.clearTimeout(setToast.timer);
    setToast.timer = window.setTimeout(() => toast.classList.remove("is-visible"), 3200);
  }

  function setActiveTab() {
    document.querySelectorAll(".tab").forEach((tab) => {
      tab.classList.toggle("is-active", tab.dataset.view === activeView);
    });
  }

  function render() {
    setActiveTab();
    globalMonth.value = state.currentMonth;
    businessNameLabel.textContent = "Control de clases, QR y eventos";

    if (activeView !== "checkin") {
      stopScanner(false);
    }

    const renderers = {
      dashboard: renderDashboard,
      students: renderStudents,
      checkin: renderCheckin,
      cards: renderCards,
      events: renderEvents,
      reports: renderReports,
      settings: renderSettings,
    };
    app.innerHTML = renderers[activeView]() + renderOverlay();
  }

  function renderOverlay() {
    if (!signatureDraft) return "";
    return renderSignatureModal(signatureDraft);
  }

  function renderHeader(title, subtitle, actions = "") {
    return `
      <div class="view-header">
        <div>
          <h2>${escapeHtml(title)}</h2>
          <p>${escapeHtml(subtitle)}</p>
        </div>
        <div class="toolbar">${actions}</div>
      </div>
    `;
  }

  function renderDashboard() {
    const summary = stats();
    const recent = [...state.attendance]
      .sort((a, b) => new Date(b.at) - new Date(a.at))
      .slice(0, 7);

    return `
      ${renderHeader(
        `Panel de ${monthLabel(state.currentMonth)}`,
        "Control mensual de cupos, asistencia y renovaciones."
      )}

      <section class="grid cols-4">
        ${statCard("Alumnos activos", summary.active, `${summary.renewed} renovados este mes`)}
        ${statCard("Clases usadas", summary.usedClasses, `${summary.remaining} disponibles`)}
        ${statCard("Check-ins de hoy", summary.today, `${summary.monthAttendance} en el mes`)}
        ${statCard("Por renovar", summary.pendingRenewal, `${summary.events} eventos activos`)}
      </section>

      <section class="grid cols-2" style="margin-top:16px">
        <div class="panel">
          <div class="panel-header">
            <div>
              <h3>Check-in rápido</h3>
              <p>Busca por nombre, teléfono o código de carnet.</p>
            </div>
            <button class="btn primary" type="button" data-action="go-checkin">${icon("scan")}Abrir QR</button>
          </div>
          ${renderQuickSearch()}
        </div>

        <div class="panel">
          <div class="panel-header">
            <div>
              <h3>Renovación mensual</h3>
              <p>${escapeHtml(monthLabel(state.currentMonth))}</p>
            </div>
            <button class="btn accent" type="button" data-action="renew-all">${icon("refresh")}Renovar activos</button>
          </div>
          ${renderRenewalSummary()}
        </div>
      </section>

      <section class="panel" style="margin-top:16px">
        <div class="panel-header">
          <div>
            <h3>Últimas clases registradas</h3>
            <p>Movimientos recientes del control de asistencia.</p>
          </div>
          <button class="btn" type="button" data-action="go-reports">${icon("file")}Ver reportes</button>
        </div>
        ${renderAttendanceTable(recent)}
      </section>
    `;
  }

  function statCard(label, value, detail) {
    return `
      <article class="stat-card">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value)}</strong>
        <small>${escapeHtml(detail)}</small>
      </article>
    `;
  }

  function renderQuickSearch() {
    const matches = filteredStudents({ search: checkinSearch, status: "active" }).slice(0, 5);
    return `
      <form class="toolbar" data-form="quick-search">
        <input class="search" type="search" data-filter="checkin-search" placeholder="Buscar alumno" value="${escapeHtml(checkinSearch)}">
        <button class="btn primary" type="submit">${icon("check")}Registrar</button>
      </form>
      ${renderStudentPickList(matches)}
    `;
  }

  function renderStudentPickList(students) {
    if (!students.length) return '<div class="empty">No hay alumnos que coincidan con la búsqueda.</div>';
    return `
      <div class="student-list">
        ${students
          .map((student) => {
            const remaining = remainingClasses(student);
            return `
              <article class="student-card">
                <div>
                  <strong>${escapeHtml(student.name)}</strong>
                  <div class="meta">
                    <span>${escapeHtml(student.code)}</span>
                    <span>${escapeHtml(PLAN_LABELS[student.planType] || `${planTotal(student)} clases`)}</span>
                    <span>${isRenewed(student) ? `${remaining} restantes` : "Sin renovar"}</span>
                  </div>
                </div>
                <button class="btn primary" type="button" data-action="register-class" data-id="${escapeHtml(student.id)}">${icon("check")}Registrar</button>
              </article>
            `;
          })
          .join("")}
      </div>
    `;
  }

  function renderRenewalSummary() {
    const pending = state.students.filter((student) => student.status === "active" && !isRenewed(student));
    if (!state.students.length) return '<div class="empty">Agrega alumnos para activar las renovaciones mensuales.</div>';
    if (!pending.length) return '<div class="empty">Todos los alumnos activos ya están renovados para este mes.</div>';
    return `
      <div class="student-list">
        ${pending
          .slice(0, 5)
          .map(
            (student) => `
              <article class="student-card">
                <div>
                  <strong>${escapeHtml(student.name)}</strong>
                  <div class="meta">
                    <span>${escapeHtml(student.code)}</span>
                    <span>Último mes: ${escapeHtml(student.monthKey || "sin registro")}</span>
                  </div>
                </div>
                <button class="btn" type="button" data-action="renew-student" data-id="${escapeHtml(student.id)}">${icon("refresh")}Renovar</button>
              </article>
            `
          )
          .join("")}
      </div>
      ${pending.length > 5 ? `<p class="muted">Hay ${pending.length - 5} alumnos más por renovar.</p>` : ""}
    `;
  }

  function renderStudents() {
    const students = filteredStudents(studentFilters);
    const editing = editingStudentId ? getStudent(editingStudentId) : null;

    const listPanel = `
      <div class="panel students-list-panel">
        <div class="panel-header">
          <div>
            <h3>Listado de alumnos</h3>
            <p>${students.length} alumno${students.length === 1 ? "" : "s"} encontrados.</p>
          </div>
          ${studentsFormVisible ? `<button class="btn icon" type="button" title="Cerrar formulario y ampliar listado" data-action="toggle-students-form">${icon("x")}</button>` : ""}
        </div>
        ${renderStudentFilters()}
        ${renderStudentsTable(students)}
      </div>
    `;

    if (studentsFormVisible) {
      return `
        ${renderHeader(
          "Alumnos",
          "Ficha única por estudiante: sus datos quedan guardados y el QR se reutiliza cada mes.",
          `<button class="btn primary" type="button" data-action="new-student">${icon("plus")}Nuevo alumno</button>`
        )}
        <section class="grid cols-2">
          <div class="panel">
            <div class="panel-header">
              <div>
                <h3>${editing ? "Editar alumno" : "Nuevo alumno"}</h3>
                <p>${editing ? escapeHtml(editing.code) : "El código se asigna automáticamente."}</p>
              </div>
            </div>
            ${renderStudentForm(editing)}
          </div>
          ${listPanel}
        </section>
      `;
    }

    return `
      ${renderHeader(
        "Alumnos",
        "Ficha única por estudiante: sus datos quedan guardados y el QR se reutiliza cada mes.",
        `<button class="btn primary" type="button" data-action="new-student">${icon("plus")}Nuevo alumno</button>`
      )}
      ${listPanel}
    `;
  }

  function renderStudentForm(student) {
    const data = student || {
      name: "",
      category: "Niño",
      age: "",
      responsible: "",
      phone: "",
      email: "",
      planType: "4",
      customClasses: 1,
      status: "active",
      notes: "",
    };
    const showCustom = data.planType === "custom";
    return `
      <form id="studentForm" class="field-grid">
        <input type="hidden" name="studentId" value="${escapeHtml(student?.id || "")}">
        <label class="field wide">
          Nombre completo
          <input name="name" required autocomplete="name" value="${escapeHtml(data.name)}">
        </label>
        <label class="field">
          Tipo
          <select name="category">
            ${selectOption("Niño", data.category)}
            ${selectOption("Adulto", data.category)}
            ${selectOption("Práctica libre", data.category)}
          </select>
        </label>
        <label class="field">
          Edad
          <input name="age" type="number" min="0" max="110" value="${escapeHtml(data.age)}">
        </label>
        <label class="field">
          Acudiente o contacto
          <input name="responsible" value="${escapeHtml(data.responsible)}">
        </label>
        <label class="field">
          Teléfono
          <input name="phone" inputmode="tel" value="${escapeHtml(data.phone)}">
        </label>
        <label class="field">
          Correo
          <input name="email" type="email" value="${escapeHtml(data.email)}">
        </label>
        <label class="field">
          Plan mensual
          <select name="planType" data-plan-select>
            ${selectOption("1_practica", data.planType, PLAN_LABELS["1_practica"])}
            ${selectOption("4", data.planType, PLAN_LABELS["4"])}
            ${selectOption("8", data.planType, PLAN_LABELS["8"])}
            ${selectOption("8_practicas", data.planType, PLAN_LABELS["8_practicas"])}
            ${selectOption("13", data.planType, PLAN_LABELS["13"])}
            ${selectOption("custom", data.planType, PLAN_LABELS.custom)}
          </select>
        </label>
        <label class="field" data-custom-classes ${showCustom ? "" : "hidden"}>
          Clases del plan
          <input name="customClasses" type="number" min="1" max="80" value="${escapeHtml(data.customClasses || 1)}">
        </label>
        <label class="field">
          Estado
          <select name="status">
            ${selectOption("active", data.status, "Activo")}
            ${selectOption("paused", data.status, "Pausado")}
          </select>
        </label>
        <label class="field wide">
          Notas
          <textarea name="notes">${escapeHtml(data.notes)}</textarea>
        </label>
        <div class="split-actions wide">
          ${student ? `<button class="btn" type="button" data-action="cancel-edit">Cancelar</button>` : ""}
          <button class="btn primary" type="submit">${icon("save")}${student ? "Guardar cambios" : "Guardar alumno"}</button>
        </div>
      </form>
    `;
  }

  function selectOption(value, current, label = value) {
    return `<option value="${escapeHtml(value)}" ${value === current ? "selected" : ""}>${escapeHtml(label)}</option>`;
  }

  function renderStudentFilters() {
    return `
      <div class="toolbar" style="margin-bottom:12px">
        <input class="search" type="search" data-filter="students-search" placeholder="Buscar" value="${escapeHtml(studentFilters.search)}">
        <select class="compact-input" data-filter="students-plan" aria-label="Filtrar por plan">
          ${selectOption("all", studentFilters.plan, "Todos los planes")}
          ${selectOption("1_practica", studentFilters.plan, PLAN_LABELS["1_practica"])}
          ${selectOption("4", studentFilters.plan, PLAN_LABELS["4"])}
          ${selectOption("8", studentFilters.plan, PLAN_LABELS["8"])}
          ${selectOption("8_practicas", studentFilters.plan, PLAN_LABELS["8_practicas"])}
          ${selectOption("13", studentFilters.plan, PLAN_LABELS["13"])}
          ${selectOption("custom", studentFilters.plan, PLAN_LABELS.custom)}
        </select>
        <select class="compact-input" data-filter="students-status" aria-label="Filtrar por estado">
          ${selectOption("all", studentFilters.status, "Todos")}
          ${selectOption("active", studentFilters.status, "Activos")}
          ${selectOption("paused", studentFilters.status, "Pausados")}
        </select>
      </div>
    `;
  }

  function renderStudentsTable(students) {
    if (!students.length) return '<div class="empty">No hay alumnos para mostrar.</div>';
    return `
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Alumno</th>
              <th>Plan</th>
              <th>Clases</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${students
              .map((student) => {
                const total = planTotal(student);
                const used = Number(student.classesUsed || 0);
                const remaining = remainingClasses(student);
                const progress = total ? Math.min(100, Math.max(0, (used / total) * 100)) : 0;
                return `
                  <tr>
                    <td>
                      <div class="student-name">
                        <strong>${escapeHtml(student.name)}</strong>
                        <small>${escapeHtml(student.code)} · ${escapeHtml(student.phone || "sin teléfono")}</small>
                      </div>
                    </td>
                    <td>${planBadge(student)}</td>
                    <td>
                      <div class="classes-cell"><strong>${remaining}</strong><small>restantes · ${used}/${total} usadas</small></div>
                      <div class="progress" aria-hidden="true"><span style="width:${progress}%"></span></div>
                    </td>
                    <td>${studentStatusBadge(student)}</td>
                    <td class="actions">
                      <button class="btn icon" type="button" title="Registrar clase" data-action="register-class" data-id="${escapeHtml(student.id)}">${icon("check")}</button>
                      <button class="btn icon" type="button" title="Renovar" data-action="renew-student" data-id="${escapeHtml(student.id)}">${icon("refresh")}</button>
                      <button class="btn icon" type="button" title="WhatsApp" data-action="notify-student" data-id="${escapeHtml(student.id)}">${icon("message")}</button>
                      <button class="btn icon" type="button" title="Editar" data-action="edit-student" data-id="${escapeHtml(student.id)}">${icon("edit")}</button>
                      ${
                        student.status === "active"
                          ? `<button class="btn icon danger" type="button" title="Pausar" data-action="pause-student" data-id="${escapeHtml(student.id)}">${icon("trash")}</button>`
                          : `<button class="btn icon" type="button" title="Activar" data-action="activate-student" data-id="${escapeHtml(student.id)}">${icon("user")}</button>`
                      }
                    </td>
                  </tr>
                `;
              })
              .join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderCheckin() {
    const matches = filteredStudents({ search: checkinSearch, status: "active" }).slice(0, 7);
    return `
      ${renderHeader("Check-in QR", "Escanea el carnet o registra la clase por búsqueda manual.")}
      <section class="scan-layout">
        <div class="panel">
          <div class="panel-header">
            <div>
              <h3>Lector de QR</h3>
              <p>El navegador debe permitir la cámara desde localhost.</p>
            </div>
            <div class="toolbar">
              <button class="btn primary" type="button" data-action="start-scanner">${icon("scan")}Iniciar</button>
              <button class="btn" type="button" data-action="stop-scanner">${icon("stop")}Detener</button>
            </div>
          </div>
          <div class="scanner-box">
            <video id="scanVideo" playsinline muted></video>
            <div class="scanner-placeholder" id="scannerPlaceholder">
              ${icon("scan")}
              <span>Listo para leer códigos QR.</span>
            </div>
          </div>
        </div>

        <aside class="panel">
          <div class="panel-header">
            <div>
              <h3>Registro manual</h3>
              <p>Código, nombre o teléfono.</p>
            </div>
          </div>
          <form class="toolbar" data-form="quick-search">
            <input class="search" type="search" data-filter="checkin-search" placeholder="Buscar alumno o código" value="${escapeHtml(checkinSearch)}">
            <button class="btn primary" type="submit">${icon("check")}Registrar</button>
          </form>
          ${renderStudentPickList(matches)}
        </aside>
      </section>
    `;
  }

  function renderCards() {
    const students = filteredStudents({ search: cardSearch, status: "active" });
    return `
      ${renderHeader(
        "Carnets QR",
        "Cada alumno conserva el mismo código. Al cambiar de mes solo se renueva su cupo.",
        `<button class="btn" type="button" data-action="print-cards">${icon("print")}Imprimir</button>`
      )}
      <section class="panel print-area">
        <div class="toolbar" style="margin-bottom:14px">
          <input class="search" type="search" data-filter="cards-search" placeholder="Buscar carnet" value="${escapeHtml(cardSearch)}">
        </div>
        ${
          students.length
            ? `<div class="qr-grid">${students.map(renderQrCard).join("")}</div>`
            : '<div class="empty">No hay carnets para mostrar.</div>'
        }
      </section>
    `;
  }

  function renderQrCard(student) {
    return `
      <article class="qr-card">
        <div class="qr-card-brand">
          <img src="assets/logo-acqua-blanco.png" alt="${escapeHtml(state.settings.businessName || DEFAULT_BUSINESS)}">
        </div>
        <div class="qr">${qrSvg(qrPayload(student))}</div>
        <div>
          <strong>${escapeHtml(student.name)}</strong><br>
          <small>${escapeHtml(state.settings.businessName || DEFAULT_BUSINESS)}</small><br>
          <small>${escapeHtml(student.code)} · ${escapeHtml(PLAN_LABELS[student.planType] || `${planTotal(student)} clases`)}</small>
        </div>
      </article>
    `;
  }

  function renderEvents() {
    const event = activeEventId ? getEvent(activeEventId) : null;
    if (event) return renderEventDetail(event);

    const orderedEvents = [...state.events].sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));
    return `
      ${renderHeader(
        "Eventos y travesías",
        "Gestiona inscritos, pagos y firmas de exoneración para actividades fuera de clase."
      )}
      <section class="events-layout">
        <div class="panel">
          <div class="panel-header">
            <div>
              <h3>Nuevo evento</h3>
              <p>Usa este formulario para crear una competencia, salida o travesía.</p>
            </div>
          </div>
          <form id="eventForm" class="field-grid">
            <label class="field wide">
              Nombre del evento
              <input name="eventName" required placeholder="Travesía San Andrés 2026">
            </label>
            <label class="field">
              Fecha
              <input name="eventDate" type="date" required>
            </label>
            <label class="field">
              Lugar
              <input name="eventPlace" required placeholder="Piscina, ciudad o punto de salida">
            </label>
            <div class="split-actions wide">
              <button class="btn accent" type="submit">${icon("calendar")}Crear evento</button>
            </div>
          </form>
        </div>

        <div class="panel">
          <div class="panel-header">
            <div>
              <h3>Agenda activa</h3>
              <p>${state.events.length} evento${state.events.length === 1 ? "" : "s"} guardado${state.events.length === 1 ? "" : "s"}.</p>
            </div>
          </div>
          ${
            orderedEvents.length
              ? `<div class="event-list">${orderedEvents.map(renderEventCard).join("")}</div>`
              : '<div class="empty">No hay eventos todavía. Crea el primero para empezar a inscribir alumnos.</div>'
          }
        </div>
      </section>
    `;
  }

  function renderEventCard(event) {
    const attendees = event.attendees || [];
    const paid = attendees.filter((attendee) => attendee.paid).length;
    const signed = attendees.filter((attendee) => attendee.signed).length;
    return `
      <article class="event-card">
        <div>
          <strong>${escapeHtml(event.name)}</strong>
          <div class="meta">
            <span>${icon("calendar")}${escapeHtml(event.date || "Sin fecha")}</span>
            <span>${icon("map")}${escapeHtml(event.place || "Sin lugar")}</span>
          </div>
          <div class="event-metrics" aria-label="Resumen del evento">
            <span>${attendees.length} inscritos</span>
            <span>${paid} pagos</span>
            <span>${signed} firmas</span>
          </div>
        </div>
        <div class="event-actions">
          <button class="btn primary" type="button" data-action="view-event" data-id="${escapeHtml(event.id)}">Gestionar</button>
          <button class="btn icon danger" type="button" title="Eliminar evento" data-action="delete-event" data-id="${escapeHtml(event.id)}">${icon("trash")}</button>
        </div>
      </article>
    `;
  }

  function renderEventDetail(event) {
    const attendees = event.attendees || [];
    const studentsAvailable = state.students
      .filter((student) => student.status === "active" && !attendees.some((attendee) => attendee.studentId === student.id))
      .sort((a, b) => a.name.localeCompare(b.name, "es"));
    const paid = attendees.filter((attendee) => attendee.paid).length;
    const signed = attendees.filter((attendee) => attendee.signed).length;

    return `
      <div class="detail-shell">
        <button class="btn ghost" type="button" data-action="back-events">${icon("arrowLeft")}Volver a eventos</button>
        <section class="event-hero">
          <div>
            <img class="section-logo" src="assets/logo-acqua-blanco.png" alt="${escapeHtml(state.settings.businessName || DEFAULT_BUSINESS)}">
            <span class="eyebrow">Evento activo</span>
            <h2>${escapeHtml(event.name)}</h2>
            <p>${icon("calendar")}${escapeHtml(event.date || "Sin fecha")} · ${icon("map")}${escapeHtml(event.place || "Sin lugar")}</p>
          </div>
          <div class="event-hero-stats">
            <span><strong>${attendees.length}</strong> inscritos</span>
            <span><strong>${paid}</strong> pagados</span>
            <span><strong>${signed}</strong> firmados</span>
          </div>
        </section>

        <section class="grid cols-2">
          <div class="panel">
            <div class="panel-header">
              <div>
                <h3>Inscribir alumno</h3>
                <p>Solo aparecen alumnos activos que no están inscritos.</p>
              </div>
            </div>
            <form id="eventEnrollForm" class="toolbar">
              <input type="hidden" name="eventId" value="${escapeHtml(event.id)}">
              <select class="search" name="studentId" required>
                <option value="">Selecciona un alumno</option>
                ${studentsAvailable.map((student) => `<option value="${escapeHtml(student.id)}">${escapeHtml(student.name)} · ${escapeHtml(student.code)}</option>`).join("")}
              </select>
              <button class="btn primary" type="submit">${icon("plus")}Inscribir</button>
            </form>
          </div>

          <div class="panel">
            <div class="panel-header">
              <div>
                <h3>Control de inscritos</h3>
                <p>Actualiza pagos y firmas antes del evento.</p>
              </div>
            </div>
            ${
              attendees.length
                ? `<div class="attendee-list">${attendees.map((attendee) => renderAttendeeRow(event, attendee)).join("")}</div>`
                : '<div class="empty">Aún no hay alumnos inscritos en este evento.</div>'
            }
          </div>
        </section>
      </div>
    `;
  }

  function renderAttendeeRow(event, attendee) {
    const student = getStudent(attendee.studentId);
    if (!student) return "";
    const signatureTitle = attendee.signed && attendee.signature ? `Firmado por ${attendee.signature.name} el ${attendee.signature.signedAt}` : "Registrar firma";
    return `
      <article class="attendee-row">
        <div>
          <strong>${escapeHtml(student.name)}</strong>
          <small>${escapeHtml(student.phone || "sin teléfono")} · ${escapeHtml(student.code)}</small>
        </div>
        <div class="attendee-actions">
          <button class="btn ${attendee.paid ? "ok" : ""}" type="button" data-action="toggle-event-paid" data-event-id="${escapeHtml(event.id)}" data-student-id="${escapeHtml(student.id)}">
            ${icon("dollar")}${attendee.paid ? "Pagado" : "Pendiente"}
          </button>
          <button class="btn ${attendee.signed ? "ok" : ""}" type="button" title="${escapeHtml(signatureTitle)}" data-action="open-signature" data-event-id="${escapeHtml(event.id)}" data-student-id="${escapeHtml(student.id)}">
            ${icon("signature")}${attendee.signed ? "Firmado" : "Sin firmar"}
          </button>
          <button class="btn icon danger" type="button" title="Quitar alumno" data-action="remove-event-student" data-event-id="${escapeHtml(event.id)}" data-student-id="${escapeHtml(student.id)}">${icon("trash")}</button>
        </div>
      </article>
    `;
  }

  function renderSignatureModal(draft) {
    const event = getEvent(draft.eventId);
    const student = getStudent(draft.studentId);
    if (!event || !student) return "";
    return `
      <div class="modal-backdrop" role="dialog" aria-modal="true" aria-label="Firma de exoneración">
        <div class="modal-panel signature-panel">
          <div class="modal-header">
            <div>
              <img class="modal-logo" src="assets/logo-acqua-blanco.png" alt="${escapeHtml(state.settings.businessName || DEFAULT_BUSINESS)}">
              <span class="eyebrow">Documento digital</span>
              <h3>Firma de exoneración</h3>
            </div>
            <button class="btn icon" type="button" title="Cerrar" data-action="close-signature">${icon("x")}</button>
          </div>
          <div class="waiver-copy">
            <p><strong>Estudiante:</strong> ${escapeHtml(student.name)}<br><strong>Evento:</strong> ${escapeHtml(event.name)}</p>
            <p>Declaro conocer las condiciones de participación del evento, autorizo la actividad deportiva y acepto informar cualquier novedad médica relevante antes de la salida.</p>
            <p>Entiendo que los eventos fuera de la sede pueden realizarse en piscinas externas o aguas abiertas, con condiciones distintas a una clase regular, y acepto la participación bajo la supervisión del equipo de ACQUA NATACIÓN.</p>
          </div>
          <form id="signatureForm" class="field-grid">
            <input type="hidden" name="eventId" value="${escapeHtml(event.id)}">
            <input type="hidden" name="studentId" value="${escapeHtml(student.id)}">
            <label class="field wide consent">
              <input name="accepted" type="checkbox" required>
              Confirmo que leí y acepto los términos de exoneración y responsabilidad.
            </label>
            <label class="field">
              Nombre de quien firma
              <input name="signatureName" required placeholder="Acudiente o estudiante mayor de edad">
            </label>
            <label class="field">
              Documento
              <input name="signatureDocument" required inputmode="numeric" placeholder="CC / TI / CE">
            </label>
            <div class="split-actions wide">
              <button class="btn" type="button" data-action="close-signature">Cancelar</button>
              <button class="btn primary" type="submit">${icon("signature")}Firmar documento</button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  function renderReports() {
    const entries = monthAttendance()
      .sort((a, b) => new Date(b.at) - new Date(a.at));
    const byStudent = entries.reduce((map, entry) => {
      const student = getStudent(entry.studentId);
      const key = student?.id || entry.studentId;
      if (!map.has(key)) {
        map.set(key, { name: student?.name || "Alumno eliminado", code: student?.code || "", count: 0 });
      }
      map.get(key).count += 1;
      return map;
    }, new Map());
    const ranking = [...byStudent.values()].sort((a, b) => b.count - a.count).slice(0, 8);

    return `
      ${renderHeader(
        `Reportes de ${monthLabel(state.currentMonth)}`,
        "Asistencia registrada, consumo de clases y exportación de datos.",
        `<button class="btn" type="button" data-action="export-csv">${icon("download")}CSV asistencia</button>`
      )}
      <section class="grid cols-2">
        <div class="panel">
          <div class="panel-header">
            <div>
              <h3>Resumen por alumno</h3>
              <p>Alumnos con más clases registradas en el mes.</p>
            </div>
          </div>
          ${
            ranking.length
              ? ranking
                  .map(
                    (row) => `
                      <div class="report-row">
                        <strong>${escapeHtml(row.code || "Sin código")}</strong>
                        <span>${escapeHtml(row.name)}</span>
                        <span class="badge info">${row.count} clase${row.count === 1 ? "" : "s"}</span>
                      </div>
                    `
                  )
                  .join("")
              : '<div class="empty">No hay asistencia en este mes.</div>'
          }
        </div>
        <div class="panel">
          <div class="panel-header">
            <div>
              <h3>Bitácora</h3>
              <p>Registro cronológico del mes operativo.</p>
            </div>
          </div>
          ${renderAttendanceTable(entries)}
        </div>
      </section>
    `;
  }

  function renderAttendanceTable(entries) {
    if (!entries.length) return '<div class="empty">Aún no hay clases registradas.</div>';
    return `
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Alumno</th>
              <th>Origen</th>
              <th>Tipo</th>
            </tr>
          </thead>
          <tbody>
            ${entries
              .map((entry) => {
                const student = getStudent(entry.studentId);
                return `
                  <tr>
                    <td>${escapeHtml(formatDateTime(entry.at))}</td>
                    <td>
                      <div class="student-name">
                        <strong>${escapeHtml(student?.name || "Alumno no encontrado")}</strong>
                        <small>${escapeHtml(student?.code || entry.studentId)}</small>
                      </div>
                    </td>
                    <td>${entry.source === "qr" ? "QR" : "Manual"}</td>
                    <td>${entry.extra ? '<span class="badge warn">Extra</span>' : '<span class="badge ok">Plan</span>'}</td>
                  </tr>
                `;
              })
              .join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderSettings() {
    return `
      ${renderHeader("Ajustes", "Respaldos, datos de la empresa y utilidades de operación.")}
      <section class="settings-grid">
        <div class="panel">
          <div class="panel-header">
            <div>
              <h3>Datos generales</h3>
              <p>Nombre visible en carnets, respaldos y mensajes.</p>
            </div>
          </div>
          <form id="settingsForm" class="field-grid">
            <label class="field wide">
              Nombre de la empresa
              <input name="businessName" value="${escapeHtml(state.settings.businessName || DEFAULT_BUSINESS)}">
            </label>
            <label class="field">
              Mes operativo
              <input name="currentMonth" type="month" value="${escapeHtml(state.currentMonth)}">
            </label>
            <div class="split-actions wide">
              <button class="btn primary" type="submit">${icon("save")}Guardar ajustes</button>
            </div>
          </form>
        </div>
        <div class="panel">
          <div class="panel-header">
            <div>
              <h3>Respaldo</h3>
              <p>Exporta el archivo maestro o restaura una copia.</p>
            </div>
          </div>
          <div class="toolbar">
            <button class="btn" type="button" data-action="export-json">${icon("download")}Exportar Excel</button>
            <button class="btn" type="button" data-action="trigger-import">${icon("upload")}Importar respaldo</button>
            <input class="file-input" id="importFile" type="file" accept=".xlsx,.json,application/json">
          </div>
          <div class="toolbar" style="margin-top:14px">
            <button class="btn" type="button" data-action="load-demo">${icon("plus")}Cargar demo</button>
            <button class="btn danger" type="button" data-action="clear-data">${icon("trash")}Borrar datos</button>
          </div>
        </div>
      </section>
    `;
  }

  function getEvent(eventId) {
    return state.events.find((event) => event.id === eventId);
  }

  function saveEvent(form) {
    const formData = new FormData(form);
    const name = String(formData.get("eventName") || "").trim();
    const date = String(formData.get("eventDate") || "").trim();
    const place = String(formData.get("eventPlace") || "").trim();
    if (!name || !date || !place) {
      setToast("Completa nombre, fecha y lugar del evento.");
      return;
    }

    const event = {
      id: uid("event"),
      name,
      date,
      place,
      attendees: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    state.events.push(event);
    activeEventId = event.id;
    saveState();
    setToast("Evento creado.");
    render();
  }

  function deleteEvent(eventId) {
    const event = getEvent(eventId);
    if (!event) return;
    const ok = window.confirm(`Eliminar "${event.name}" y sus inscritos?`);
    if (!ok) return;
    state.events = state.events.filter((item) => item.id !== eventId);
    if (activeEventId === eventId) activeEventId = null;
    saveState();
    setToast("Evento eliminado.");
    render();
  }

  function enrollEventStudent(eventId, studentId) {
    const event = getEvent(eventId);
    const student = getStudent(studentId);
    if (!event || !student) {
      setToast("No encontré el evento o el alumno.");
      return;
    }
    event.attendees = event.attendees || [];
    if (event.attendees.some((attendee) => attendee.studentId === student.id)) {
      setToast("Ese alumno ya está inscrito.");
      return;
    }
    event.attendees.push({
      studentId: student.id,
      paid: false,
      signed: false,
      signature: null,
      addedAt: new Date().toISOString(),
    });
    event.updatedAt = new Date().toISOString();
    saveState();
    setToast(`${student.name} inscrito en el evento.`);
    render();
  }

  function toggleEventPaid(eventId, studentId) {
    const attendee = findEventAttendee(eventId, studentId);
    if (!attendee) return;
    attendee.paid = !attendee.paid;
    touchEvent(eventId);
    saveState();
    render();
  }

  function removeEventStudent(eventId, studentId) {
    const event = getEvent(eventId);
    const student = getStudent(studentId);
    if (!event || !student) return;
    const ok = window.confirm(`Quitar a ${student.name} de "${event.name}"?`);
    if (!ok) return;
    event.attendees = (event.attendees || []).filter((attendee) => attendee.studentId !== studentId);
    touchEvent(eventId);
    saveState();
    setToast("Alumno retirado del evento.");
    render();
  }

  function findEventAttendee(eventId, studentId) {
    const event = getEvent(eventId);
    return event?.attendees?.find((attendee) => attendee.studentId === studentId);
  }

  function touchEvent(eventId) {
    const event = getEvent(eventId);
    if (event) event.updatedAt = new Date().toISOString();
  }

  function saveSignature(form) {
    const formData = new FormData(form);
    const eventId = String(formData.get("eventId") || "");
    const studentId = String(formData.get("studentId") || "");
    const attendee = findEventAttendee(eventId, studentId);
    if (!attendee) {
      setToast("No encontré la inscripción para firmar.");
      return;
    }
    attendee.signed = true;
    attendee.signature = {
      name: String(formData.get("signatureName") || "").trim(),
      document: String(formData.get("signatureDocument") || "").trim(),
      signedAt: new Intl.DateTimeFormat("es-CO", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date()),
    };
    touchEvent(eventId);
    signatureDraft = null;
    saveState();
    setToast("Firma guardada.");
    render();
  }

  function saveStudent(form) {
    const formData = new FormData(form);
    const studentId = formData.get("studentId");
    const name = String(formData.get("name") || "").trim();
    if (!name) {
      setToast("El nombre del alumno es obligatorio.");
      return;
    }

    const planType = String(formData.get("planType") || "4");
    const customClasses = Math.max(1, Number(formData.get("customClasses") || 1));
    const now = new Date().toISOString();
    const existing = studentId ? getStudent(studentId) : null;
    const student = {
      ...(existing || {}),
      id: existing?.id || uid("student"),
      code: existing?.code || nextStudentCode(),
      name,
      category: String(formData.get("category") || "Niño"),
      age: String(formData.get("age") || "").trim(),
      responsible: String(formData.get("responsible") || "").trim(),
      phone: String(formData.get("phone") || "").trim(),
      email: String(formData.get("email") || "").trim(),
      planType,
      customClasses: planType === "custom" ? customClasses : "",
      status: String(formData.get("status") || "active"),
      notes: String(formData.get("notes") || "").trim(),
      monthKey: existing?.monthKey || state.currentMonth,
      classesUsed: Number(existing?.classesUsed || 0),
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    if (existing) {
      state.students = state.students.map((item) => (item.id === existing.id ? student : item));
      setToast("Alumno actualizado.");
    } else {
      state.students.push(student);
      setToast(`Alumno creado con código ${student.code}.`);
    }

    editingStudentId = null;
    studentsFormVisible = false;
    saveState();
    render();
  }

  function renewStudent(studentId, silent = false) {
    const student = getStudent(studentId);
    if (!student) return;
    student.monthKey = state.currentMonth;
    student.classesUsed = 0;
    student.lastRenewedAt = new Date().toISOString();
    student.updatedAt = student.lastRenewedAt;
    if (!silent) setToast(`${student.name} renovado para ${monthLabel(state.currentMonth)}.`);
  }

  function renewAllActive() {
    const active = state.students.filter((student) => student.status === "active");
    if (!active.length) {
      setToast("No hay alumnos activos para renovar.");
      return;
    }
    const ok = window.confirm(`Renovar ${active.length} alumnos activos para ${monthLabel(state.currentMonth)}?`);
    if (!ok) return;
    active.forEach((student) => renewStudent(student.id, true));
    saveState();
    setToast("Renovación mensual completada.");
    render();
  }

  function registerClass(studentId, source = "manual") {
    const student = getStudent(studentId);
    if (!student) {
      setToast("No encontré ese alumno.");
      return false;
    }
    if (student.status !== "active") {
      setToast("El alumno está pausado.");
      return false;
    }

    if (!isRenewed(student)) {
      const ok = window.confirm(`${student.name} no está renovado para ${monthLabel(state.currentMonth)}. Renovar y registrar la clase?`);
      if (!ok) return false;
      renewStudent(student.id, true);
    }

    const today = dayKey(new Date());
    const alreadyToday = state.attendance.some(
      (entry) => entry.studentId === student.id && dayKey(new Date(entry.at)) === today
    );
    if (alreadyToday) {
      const ok = window.confirm(`${student.name} ya tiene una clase registrada hoy. Registrar otra?`);
      if (!ok) return false;
    }

    let extra = false;
    if (remainingClasses(student) <= 0) {
      const ok = window.confirm(`${student.name} ya consumió su plan del mes. Registrar como clase extra?`);
      if (!ok) return false;
      extra = true;
    }

    student.classesUsed = Number(student.classesUsed || 0) + 1;
    student.updatedAt = new Date().toISOString();
    state.attendance.push({
      id: uid("attendance"),
      studentId: student.id,
      at: new Date().toISOString(),
      monthKey: state.currentMonth,
      source,
      extra,
    });
    saveState();
    setToast(`Clase registrada para ${student.name}.`);
    if (student.phone && remainingClasses(student) <= 1) {
      notifyWhatsApp(student);
    }
    render();
    return true;
  }

  function notifyWhatsApp(student) {
    if (!student?.phone) {
      setToast("Este alumno no tiene teléfono guardado.");
      return;
    }
    const digits = String(student.phone).replace(/\D/g, "");
    if (!digits) {
      setToast("El teléfono del alumno no parece válido.");
      return;
    }
    const phone = digits.length === 10 && digits.startsWith("3") ? `57${digits}` : digits;
    const remaining = remainingClasses(student);
    let message = `Hola ${student.name}. Te escribimos de ${state.settings.businessName || DEFAULT_BUSINESS}. `;
    if (remaining <= 0) {
      message += "Tus clases o prácticas se han agotado. Te esperamos para renovar tu plan y seguir nadando.";
    } else if (remaining === 1) {
      message += "Te queda 1 clase o práctica disponible. Te recomendamos renovar pronto.";
    } else {
      message += `Tienes ${remaining} clases o prácticas disponibles.`;
    }
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank", "noopener");
  }

  function pauseStudent(studentId) {
    const student = getStudent(studentId);
    if (!student) return;
    const ok = window.confirm(`Pausar a ${student.name}? No se borrará su historial.`);
    if (!ok) return;
    student.status = "paused";
    student.updatedAt = new Date().toISOString();
    saveState();
    setToast("Alumno pausado.");
    render();
  }

  function activateStudent(studentId) {
    const student = getStudent(studentId);
    if (!student) return;
    student.status = "active";
    student.updatedAt = new Date().toISOString();
    saveState();
    setToast("Alumno activado.");
    render();
  }

  function qrPayload(student) {
    return `AQUA:${student.code}`;
  }

  function findByQrPayload(payload) {
    const clean = String(payload || "").trim();
    let code = clean;
    if (clean.toUpperCase().startsWith("AQUA:")) code = clean.slice(5);
    if (clean.toUpperCase().startsWith("SWIM:")) code = clean.slice(5);
    return state.students.find(
      (student) =>
        student.id === code ||
        String(student.code || "").toUpperCase() === code.toUpperCase()
    );
  }

  function handleQrPayload(payload) {
    const now = Date.now();
    if (payload === scanner.lastPayload && now - scanner.lastPayloadAt < 4500) return;
    scanner.lastPayload = payload;
    scanner.lastPayloadAt = now;

    const student = findByQrPayload(payload);
    if (!student) {
      setToast("QR leído, pero no corresponde a un alumno guardado.");
      return;
    }
    stopScanner(false);
    registerClass(student.id, "qr");
  }

  async function startScanner() {
    const video = document.querySelector("#scanVideo");
    const placeholder = document.querySelector("#scannerPlaceholder");
    if (!video) return;

    const hasBarcodeDetector = "BarcodeDetector" in window;
    const hasJsQr = typeof jsQR !== "undefined";

    if (!hasBarcodeDetector && !hasJsQr) {
      setToast("Este navegador no soporta lectura QR. Usa Chrome, Edge o Firefox actualizado.");
      return;
    }

    try {
      if (hasBarcodeDetector) {
        const formats = await BarcodeDetector.getSupportedFormats();
        if (formats.includes("qr_code")) {
          scanner.detector = new BarcodeDetector({ formats: ["qr_code"] });
          useJsQr = false;
        } else {
          useJsQr = true;
        }
      } else {
        useJsQr = true;
      }

      scanner.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      video.srcObject = scanner.stream;
      await video.play();
      placeholder.hidden = true;
      scanner.timer = window.setInterval(scanFrame, 300);
      setToast(useJsQr ? "Lector QR iniciado (modo universal)." : "Lector QR iniciado.");
    } catch (error) {
      console.error(error);
      if (error.name === "NotAllowedError") {
        setToast("Permiso de cámara denegado. Habilítalo en la configuración del navegador.");
      } else {
        setToast("No pude abrir la cámara. Revisa permisos del navegador.");
      }
    }
  }

  async function scanFrame() {
    const video = document.querySelector("#scanVideo");
    if (!video || scanner.busy || video.readyState < 2) return;
    scanner.busy = true;
    try {
      if (useJsQr && typeof jsQR !== "undefined") {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: "dontInvert",
        });
        if (code) handleQrPayload(code.data);
      } else if (scanner.detector) {
        const codes = await scanner.detector.detect(video);
        if (codes.length) handleQrPayload(codes[0].rawValue);
      }
    } catch (error) {
      console.error(error);
    } finally {
      scanner.busy = false;
    }
  }

  function stopScanner(showToast = true) {
    if (scanner.timer) {
      window.clearInterval(scanner.timer);
      scanner.timer = null;
    }
    if (scanner.stream) {
      scanner.stream.getTracks().forEach((track) => track.stop());
      scanner.stream = null;
    }
    scanner.detector = null;
    const video = document.querySelector("#scanVideo");
    const placeholder = document.querySelector("#scannerPlaceholder");
    if (video) video.srcObject = null;
    if (placeholder) placeholder.hidden = false;
    if (showToast) setToast("Lector QR detenido.");
  }

  function exportJson() {
    if (typeof XLSX === "undefined") {
      setToast("Librería Excel no disponible. Recarga la página e intenta de nuevo.");
      return;
    }

    try {
      const wb = XLSX.utils.book_new();

      // ── Hoja 1: Alumnos ────────────────────────────────────────────────────
      const studentRows = state.students.map((s) => ({
        "Código": s.code || "",
        "Nombre": s.name || "",
        "Categoría": s.category || "",
        "Plan": PLAN_LABELS[s.planType] || s.planType || "",
        "Clases totales": planTotal(s),
        "Clases usadas": Number(s.classesUsed || 0),
        "Clases restantes": remainingClasses(s),
        "Estado": s.status === "active" ? "Activo" : "Inactivo",
        "Acudiente": s.guardian || "",
        "Telefono": s.phone || "",
        "Email": s.email || "",
        "Notas": s.notes || "",
        "Mes renovacion": s.monthKey || "",
      }));
      const wsStudents = XLSX.utils.json_to_sheet(
        studentRows.length ? studentRows : [{ "Código": "", "Nombre": "" }]
      );
      wsStudents["!cols"] = [8,24,12,16,10,10,10,10,18,16,22,20,12].map((w) => ({ wch: w }));
      XLSX.utils.book_append_sheet(wb, wsStudents, "Alumnos");

      // ── Hoja 2: Asistencia ─────────────────────────────────────────────────
      const attendanceRows = [...state.attendance]
        .sort((a, b) => new Date(b.at) - new Date(a.at))
        .map((entry) => {
          const student = getStudent(entry.studentId) || {};
          return {
            "Fecha y hora": formatDateTime(entry.at),
            "Mes": entry.monthKey || "",
            "Nombre": student.name || "",
            "Codigo": student.code || entry.studentId,
            "Plan": PLAN_LABELS[student.planType] || "",
            "Origen": entry.source === "qr" ? "QR" : "Manual",
            "Tipo": entry.extra ? "Extra" : "Plan",
          };
        });
      const wsAttendance = XLSX.utils.json_to_sheet(
        attendanceRows.length ? attendanceRows : [{ "Fecha y hora": "", "Nombre": "" }]
      );
      wsAttendance["!cols"] = [18,8,24,10,16,8,6].map((w) => ({ wch: w }));
      XLSX.utils.book_append_sheet(wb, wsAttendance, "Asistencia");

      // ── Hoja 3: Eventos ────────────────────────────────────────────────────
      const eventRows = (state.events || []).map((ev) => ({
        "Nombre": ev.name || "",
        "Fecha": ev.date || "",
        "Estado": ev.status || "",
        "Descripcion": ev.description || ev.notes || "",
      }));
      const wsEvents = XLSX.utils.json_to_sheet(
        eventRows.length ? eventRows : [{ "Nombre": "" }]
      );
      wsEvents["!cols"] = [24,12,10,30].map((w) => ({ wch: w }));
      XLSX.utils.book_append_sheet(wb, wsEvents, "Eventos");

      // ── Hoja 4: Resumen ────────────────────────────────────────────────────
      const configRows = [
        { "Parametro": "Negocio", "Valor": state.settings?.businessName || DEFAULT_BUSINESS },
        { "Parametro": "Mes actual", "Valor": state.currentMonth },
        { "Parametro": "Total alumnos", "Valor": state.students.length },
        { "Parametro": "Total asistencias", "Valor": state.attendance.length },
        { "Parametro": "Total eventos", "Valor": (state.events || []).length },
        { "Parametro": "Exportado el", "Valor": new Date().toLocaleString("es-CO") },
      ];
      const wsConfig = XLSX.utils.json_to_sheet(configRows);
      wsConfig["!cols"] = [{ wch: 18 }, { wch: 28 }];
      XLSX.utils.book_append_sheet(wb, wsConfig, "Resumen");

      // ── Hoja técnica: datos para reimportar ───────────────────────────────
      const wsDatos = XLSX.utils.aoa_to_sheet([[JSON.stringify(state)]]);
      XLSX.utils.book_append_sheet(wb, wsDatos, "_datos");

      // Generar y descargar el archivo
      const wbOut = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([wbOut], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `aquacontrol-respaldo-${state.currentMonth}.xlsx`;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      setToast("Respaldo Excel descargado correctamente.");
    } catch (err) {
      console.error("Error al exportar Excel:", err);
      setToast("Error al generar el Excel. Revisa la consola del navegador.");
    }
  }

  function exportCsv() {
    const header = ["fecha", "alumno", "codigo", "plan", "origen", "tipo"];
    const rows = monthAttendance().map((entry) => {
      const student = getStudent(entry.studentId) || {};
      return [
        formatDateTime(entry.at),
        student.name || "",
        student.code || entry.studentId,
        PLAN_LABELS[student.planType] || `${planTotal(student)} clases`,
        entry.source === "qr" ? "QR" : "Manual",
        entry.extra ? "Extra" : "Plan",
      ];
    });
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    downloadFile(`asistencia-${state.currentMonth}.csv`, csv, "text/csv;charset=utf-8");
  }

  function downloadFile(filename, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function importJson(file) {
    const isExcel = /\.(xlsx|xls)$/i.test(file.name);

    if (isExcel && typeof XLSX !== "undefined") {
      // ── Importar desde Excel ───────────────────────────────────────────────
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const wb = XLSX.read(data, { type: "array" });
          const wsDatos = wb.Sheets["_datos"];
          if (!wsDatos || !wsDatos.A1) throw new Error("Hoja de datos no encontrada");
          const imported = JSON.parse(wsDatos.A1.v);
          if (!Array.isArray(imported.students) || !Array.isArray(imported.attendance)) {
            throw new Error("Estructura inválida");
          }
          state = {
            version: 1,
            currentMonth: imported.currentMonth || monthKey(new Date()),
            settings: { businessName: DEFAULT_BUSINESS, ...(imported.settings || {}) },
            students: imported.students,
            attendance: imported.attendance,
            events: Array.isArray(imported.events) ? imported.events : [],
          };
          saveState();
          setToast("Respaldo Excel importado correctamente.");
          render();
        } catch (error) {
          console.error(error);
          setToast("El archivo Excel no es un respaldo válido de ACQUA.");
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      // ── Importar desde JSON (compatibilidad hacia atrás) ───────────────────
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const imported = JSON.parse(String(reader.result || "{}"));
          if (!Array.isArray(imported.students) || !Array.isArray(imported.attendance)) {
            throw new Error("Invalid backup");
          }
          state = {
            version: 1,
            currentMonth: imported.currentMonth || monthKey(new Date()),
            settings: { businessName: DEFAULT_BUSINESS, ...(imported.settings || {}) },
            students: imported.students,
            attendance: imported.attendance,
            events: Array.isArray(imported.events) ? imported.events : [],
          };
          saveState();
          setToast("Respaldo importado.");
          render();
        } catch (error) {
          console.error(error);
          setToast("El archivo no parece ser un respaldo válido.");
        }
      };
      reader.readAsText(file);
    }
  }

  function loadDemoData() {
    const ok = state.students.length
      ? window.confirm("Esto agregará alumnos de ejemplo a tus datos actuales. Continuar?")
      : true;
    if (!ok) return;

    const demos = [
      ["Mariana López", "Niño", "8", "Laura López", "300 111 2222"],
      ["Tomás Rincón", "Niño", "4", "Andrés Rincón", "300 333 4444"],
      ["Valeria Gómez", "Adulto", "13", "", "300 555 6666"],
      ["Carlos Mejía", "Adulto", "custom", "", "300 777 8888"],
    ];

    demos.forEach(([name, category, planType, responsible, phone]) => {
      state.students.push({
        id: uid("student"),
        code: nextStudentCode(),
        name,
        category,
        age: "",
        responsible,
        phone,
        email: "",
        planType,
        customClasses: planType === "custom" ? 6 : "",
        status: "active",
        notes: "",
        monthKey: state.currentMonth,
        classesUsed: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    });
    saveState();
    setToast("Datos demo cargados.");
    render();
  }

  function clearData() {
    const ok = window.confirm("Borrar todos los alumnos y asistencias guardadas en este navegador?");
    if (!ok) return;
    state = {
      version: 1,
      currentMonth: monthKey(new Date()),
      settings: { businessName: DEFAULT_BUSINESS },
      students: [],
      attendance: [],
      events: [],
    };
    saveState();
    editingStudentId = null;
    activeEventId = null;
    signatureDraft = null;
    checkinSearch = "";
    studentFilters = { search: "", plan: "all", status: "active" };
    cardSearch = "";
    setToast("Datos borrados.");
    render();
  }

  function preserveFocus(selector, renderFn = render) {
    renderFn();
    window.requestAnimationFrame(() => {
      const element = document.querySelector(selector);
      if (!element) return;
      element.focus();
      const valueLength = element.value.length;
      if (element.setSelectionRange) element.setSelectionRange(valueLength, valueLength);
    });
  }

  document.addEventListener("click", (event) => {
    const viewButton = event.target.closest("[data-view]");
    if (viewButton) {
      activeView = viewButton.dataset.view;
      if (activeView !== "events") {
        activeEventId = null;
        signatureDraft = null;
      }
      render();
      return;
    }

    const action = event.target.closest("[data-action]");
    if (!action) return;

    const id = action.dataset.id;
    const eventId = action.dataset.eventId;
    const studentId = action.dataset.studentId;
    switch (action.dataset.action) {
      case "go-checkin":
        activeView = "checkin";
        render();
        break;
      case "go-events":
        activeView = "events";
        render();
        break;
      case "go-reports":
        activeView = "reports";
        render();
        break;
      case "new-student":
        editingStudentId = null;
        studentsFormVisible = true;
        render();
        window.requestAnimationFrame(() => {
          const nameInput = document.querySelector('#studentForm [name="name"]');
          if (nameInput) { nameInput.focus(); nameInput.select(); }
        });
        break;
      case "edit-student":
        editingStudentId = id;
        studentsFormVisible = true;
        activeView = "students";
        render();
        window.requestAnimationFrame(() => {
          const nameInput = document.querySelector('#studentForm [name="name"]');
          if (nameInput) nameInput.focus();
        });
        break;
      case "cancel-edit":
        editingStudentId = null;
        studentsFormVisible = false;
        render();
        break;
      case "toggle-students-form":
        studentsFormVisible = !studentsFormVisible;
        if (!studentsFormVisible) editingStudentId = null;
        render();
        break;
      case "register-class":
        registerClass(id, "manual");
        break;
      case "notify-student":
        notifyWhatsApp(getStudent(id));
        break;
      case "renew-student":
        renewStudent(id);
        saveState();
        render();
        break;
      case "renew-all":
        renewAllActive();
        break;
      case "pause-student":
        pauseStudent(id);
        break;
      case "activate-student":
        activateStudent(id);
        break;
      case "start-scanner":
        startScanner();
        break;
      case "stop-scanner":
        stopScanner(true);
        break;
      case "print-cards":
        window.print();
        break;
      case "view-event":
        activeView = "events";
        activeEventId = id;
        render();
        break;
      case "back-events":
        activeEventId = null;
        signatureDraft = null;
        render();
        break;
      case "delete-event":
        deleteEvent(id);
        break;
      case "toggle-event-paid":
        toggleEventPaid(eventId, studentId);
        break;
      case "remove-event-student":
        removeEventStudent(eventId, studentId);
        break;
      case "open-signature":
        signatureDraft = { eventId, studentId };
        render();
        break;
      case "close-signature":
        signatureDraft = null;
        render();
        break;
      case "export-json":
        exportJson();
        break;
      case "export-csv":
        exportCsv();
        break;
      case "trigger-import":
        document.querySelector("#importFile")?.click();
        break;
      case "load-demo":
        loadDemoData();
        break;
      case "clear-data":
        clearData();
        break;
      default:
        break;
    }
  });

  document.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.target;

    if (form.id === "studentForm") {
      saveStudent(form);
      return;
    }

    if (form.id === "eventForm") {
      saveEvent(form);
      return;
    }

    if (form.id === "eventEnrollForm") {
      const formData = new FormData(form);
      enrollEventStudent(String(formData.get("eventId") || ""), String(formData.get("studentId") || ""));
      return;
    }

    if (form.id === "signatureForm") {
      saveSignature(form);
      return;
    }

    if (form.id === "settingsForm") {
      const formData = new FormData(form);
      state.settings.businessName = String(formData.get("businessName") || DEFAULT_BUSINESS).trim() || DEFAULT_BUSINESS;
      state.currentMonth = String(formData.get("currentMonth") || monthKey(new Date()));
      saveState();
      setToast("Ajustes guardados.");
      render();
      return;
    }

    if (form.dataset.form === "quick-search") {
      const match = filteredStudents({ search: checkinSearch, status: "active" })[0];
      if (match) registerClass(match.id, "manual");
      else {
        const byPayload = findByQrPayload(checkinSearch);
        if (byPayload) registerClass(byPayload.id, "manual");
        else setToast("No encontré un alumno para registrar.");
      }
    }
  });

  document.addEventListener("input", (event) => {
    const target = event.target;
    if (target.matches("[data-filter='students-search']")) {
      studentFilters.search = target.value;
      preserveFocus("[data-filter='students-search']");
      return;
    }
    if (target.matches("[data-filter='checkin-search']")) {
      checkinSearch = target.value;
      preserveFocus("[data-filter='checkin-search']");
      return;
    }
    if (target.matches("[data-filter='cards-search']")) {
      cardSearch = target.value;
      preserveFocus("[data-filter='cards-search']");
    }
  });

  document.addEventListener("change", (event) => {
    const target = event.target;
    if (target === globalMonth) {
      state.currentMonth = target.value || monthKey(new Date());
      saveState();
      render();
      return;
    }
    if (target.matches("[data-filter='students-plan']")) {
      studentFilters.plan = target.value;
      render();
      return;
    }
    if (target.matches("[data-filter='students-status']")) {
      studentFilters.status = target.value;
      render();
      return;
    }
    if (target.matches("[data-plan-select]")) {
      const customField = document.querySelector("[data-custom-classes]");
      if (customField) customField.hidden = target.value !== "custom";
      return;
    }
    if (target.id === "importFile" && target.files?.[0]) {
      importJson(target.files[0]);
      target.value = "";
    }
  });

  globalMonth.addEventListener("change", (event) => {
    state.currentMonth = event.target.value || monthKey(new Date());
    saveState();
    render();
  });

  window.addEventListener("beforeunload", () => stopScanner(false));

  function qrSvg(text) {
    const modules = qrMatrix(text);
    const border = 4;
    const size = modules.length + border * 2;
    const dark = [];
    for (let y = 0; y < modules.length; y += 1) {
      for (let x = 0; x < modules.length; x += 1) {
        if (modules[y][x]) dark.push(`M${x + border},${y + border}h1v1h-1z`);
      }
    }
    return `
      <svg viewBox="0 0 ${size} ${size}" role="img" aria-label="Código QR">
        <rect width="${size}" height="${size}" fill="#fff"></rect>
        <path d="${dark.join(" ")}" fill="#111827"></path>
      </svg>
    `;
  }

  function qrMatrix(text) {
    const masks = Array.from({ length: 8 }, (_, mask) => buildQrMatrix(text, mask));
    masks.sort((a, b) => penaltyScore(a) - penaltyScore(b));
    return masks[0];
  }

  function buildQrMatrix(text, mask) {
    const version = 4;
    const size = version * 4 + 17;
    const dataCodewords = 80;
    const eccCodewords = 20;
    const modules = Array.from({ length: size }, () => Array(size).fill(false));
    const reserved = Array.from({ length: size }, () => Array(size).fill(false));

    function setFunction(x, y, dark) {
      modules[y][x] = Boolean(dark);
      reserved[y][x] = true;
    }

    function reserve(x, y) {
      reserved[y][x] = true;
    }

    drawFinder(0, 0);
    drawFinder(size - 7, 0);
    drawFinder(0, size - 7);
    drawAlignment(26, 26);
    drawTiming();
    reserveFormat();
    setFunction(8, size - 8, true);

    const data = encodeQrData(text, dataCodewords);
    const ecc = reedSolomonRemainder(data, eccCodewords);
    const codewords = data.concat(ecc);
    placeData(codewords);
    drawFormatBits(mask);

    return modules;

    function drawFinder(left, top) {
      for (let dy = -1; dy <= 7; dy += 1) {
        for (let dx = -1; dx <= 7; dx += 1) {
          const x = left + dx;
          const y = top + dy;
          if (x < 0 || y < 0 || x >= size || y >= size) continue;
          const dark =
            dx >= 0 &&
            dx <= 6 &&
            dy >= 0 &&
            dy <= 6 &&
            (dx === 0 || dx === 6 || dy === 0 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4));
          setFunction(x, y, dark);
        }
      }
    }

    function drawAlignment(cx, cy) {
      for (let dy = -2; dy <= 2; dy += 1) {
        for (let dx = -2; dx <= 2; dx += 1) {
          const distance = Math.max(Math.abs(dx), Math.abs(dy));
          setFunction(cx + dx, cy + dy, distance !== 1);
        }
      }
    }

    function drawTiming() {
      for (let i = 8; i < size - 8; i += 1) {
        setFunction(i, 6, i % 2 === 0);
        setFunction(6, i, i % 2 === 0);
      }
    }

    function reserveFormat() {
      for (let i = 0; i <= 8; i += 1) {
        if (i !== 6) {
          reserve(8, i);
          reserve(i, 8);
        }
      }
      for (let i = 0; i < 8; i += 1) reserve(size - 1 - i, 8);
      for (let i = 0; i < 7; i += 1) reserve(8, size - 1 - i);
    }

    function placeData(codewords) {
      let bitIndex = 0;
      let upward = true;
      for (let right = size - 1; right >= 1; right -= 2) {
        if (right === 6) right -= 1;
        for (let vertical = 0; vertical < size; vertical += 1) {
          const y = upward ? size - 1 - vertical : vertical;
          for (let column = 0; column < 2; column += 1) {
            const x = right - column;
            if (reserved[y][x]) continue;
            const bit = bitIndex < codewords.length * 8 ? ((codewords[Math.floor(bitIndex / 8)] >>> (7 - (bitIndex % 8))) & 1) === 1 : false;
            modules[y][x] = bit !== maskBit(mask, x, y);
            bitIndex += 1;
          }
        }
        upward = !upward;
      }
    }

    function drawFormatBits(maskValue) {
      const bits = formatBits(1, maskValue);
      for (let i = 0; i <= 5; i += 1) setFunction(8, i, bitAt(bits, i));
      setFunction(8, 7, bitAt(bits, 6));
      setFunction(8, 8, bitAt(bits, 7));
      setFunction(7, 8, bitAt(bits, 8));
      for (let i = 9; i < 15; i += 1) setFunction(14 - i, 8, bitAt(bits, i));

      for (let i = 0; i < 8; i += 1) setFunction(size - 1 - i, 8, bitAt(bits, i));
      for (let i = 8; i < 15; i += 1) setFunction(8, size - 15 + i, bitAt(bits, i));
      setFunction(8, size - 8, true);
    }
  }

  function encodeQrData(text, dataCodewords) {
    const bytes = Array.from(new TextEncoder().encode(text));
    if (bytes.length > 78) throw new Error("QR payload is too long");
    const bits = [];
    appendBits(bits, 0b0100, 4);
    appendBits(bits, bytes.length, 8);
    bytes.forEach((byte) => appendBits(bits, byte, 8));
    const capacity = dataCodewords * 8;
    appendBits(bits, 0, Math.min(4, capacity - bits.length));
    while (bits.length % 8) bits.push(0);

    const codewords = [];
    for (let i = 0; i < bits.length; i += 8) {
      let value = 0;
      for (let j = 0; j < 8; j += 1) value = (value << 1) | bits[i + j];
      codewords.push(value);
    }
    for (let pad = 0xec; codewords.length < dataCodewords; pad = pad === 0xec ? 0x11 : 0xec) {
      codewords.push(pad);
    }
    return codewords;
  }

  function appendBits(target, value, length) {
    for (let i = length - 1; i >= 0; i -= 1) {
      target.push((value >>> i) & 1);
    }
  }

  function formatBits(errorCorrectionBits, mask) {
    const data = (errorCorrectionBits << 3) | mask;
    let remainder = data << 10;
    for (let i = 14; i >= 10; i -= 1) {
      if (((remainder >>> i) & 1) !== 0) remainder ^= 0x537 << (i - 10);
    }
    return ((data << 10) | remainder) ^ 0x5412;
  }

  function bitAt(value, index) {
    return ((value >>> index) & 1) !== 0;
  }

  function maskBit(mask, x, y) {
    switch (mask) {
      case 0:
        return (x + y) % 2 === 0;
      case 1:
        return y % 2 === 0;
      case 2:
        return x % 3 === 0;
      case 3:
        return (x + y) % 3 === 0;
      case 4:
        return (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0;
      case 5:
        return ((x * y) % 2) + ((x * y) % 3) === 0;
      case 6:
        return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
      case 7:
        return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
      default:
        return false;
    }
  }

  function penaltyScore(modules) {
    const size = modules.length;
    let score = 0;

    for (let y = 0; y < size; y += 1) {
      let runColor = modules[y][0];
      let runLength = 1;
      for (let x = 1; x < size; x += 1) {
        if (modules[y][x] === runColor) {
          runLength += 1;
          if (runLength === 5) score += 3;
          else if (runLength > 5) score += 1;
        } else {
          runColor = modules[y][x];
          runLength = 1;
        }
      }
    }

    for (let x = 0; x < size; x += 1) {
      let runColor = modules[0][x];
      let runLength = 1;
      for (let y = 1; y < size; y += 1) {
        if (modules[y][x] === runColor) {
          runLength += 1;
          if (runLength === 5) score += 3;
          else if (runLength > 5) score += 1;
        } else {
          runColor = modules[y][x];
          runLength = 1;
        }
      }
    }

    for (let y = 0; y < size - 1; y += 1) {
      for (let x = 0; x < size - 1; x += 1) {
        const color = modules[y][x];
        if (color === modules[y][x + 1] && color === modules[y + 1][x] && color === modules[y + 1][x + 1]) {
          score += 3;
        }
      }
    }

    const pattern = [true, false, true, true, true, false, true, false, false, false, false];
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x <= size - pattern.length; x += 1) {
        if (pattern.every((color, index) => modules[y][x + index] === color)) score += 40;
      }
    }
    for (let x = 0; x < size; x += 1) {
      for (let y = 0; y <= size - pattern.length; y += 1) {
        if (pattern.every((color, index) => modules[y + index][x] === color)) score += 40;
      }
    }

    const dark = modules.flat().filter(Boolean).length;
    const percent = (dark * 100) / (size * size);
    score += Math.floor(Math.abs(percent - 50) / 5) * 10;
    return score;
  }

  const gfExp = Array(512).fill(0);
  const gfLog = Array(256).fill(0);
  let gfValue = 1;
  for (let i = 0; i < 255; i += 1) {
    gfExp[i] = gfValue;
    gfLog[gfValue] = i;
    gfValue <<= 1;
    if (gfValue & 0x100) gfValue ^= 0x11d;
  }
  for (let i = 255; i < gfExp.length; i += 1) gfExp[i] = gfExp[i - 255];

  function gfMultiply(left, right) {
    if (left === 0 || right === 0) return 0;
    return gfExp[gfLog[left] + gfLog[right]];
  }

  function reedSolomonDivisor(degree) {
    const result = Array(degree).fill(0);
    result[degree - 1] = 1;
    let root = 1;
    for (let i = 0; i < degree; i += 1) {
      for (let j = 0; j < result.length; j += 1) {
        result[j] = gfMultiply(result[j], root);
        if (j + 1 < result.length) result[j] ^= result[j + 1];
      }
      root = gfMultiply(root, 0x02);
    }
    return result;
  }

  function reedSolomonRemainder(data, degree) {
    const divisor = reedSolomonDivisor(degree);
    const result = Array(degree).fill(0);
    data.forEach((byte) => {
      const factor = byte ^ result.shift();
      result.push(0);
      divisor.forEach((coefficient, index) => {
        result[index] ^= gfMultiply(coefficient, factor);
      });
    });
    return result;
  }

  /* ─── Arranque ───────────────────────────────────────────────────────────
     1. Muestra datos locales de inmediato
     2. Carga desde Supabase y actualiza si hay datos más recientes         */
  render();
  updateSyncDot();
  syncFromCloud();

  // Sincroniza cuando el usuario vuelve a la pestaña (desde otro dispositivo)
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && CLOUD_ENABLED) {
      syncFromCloud();
    }
  });

  // Sondeo cada 30 segundos para detectar cambios de otros dispositivos
  if (CLOUD_ENABLED) {
    setInterval(syncFromCloud, 30_000);
  }
})();
