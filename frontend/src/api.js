// ============================================================
//  Cliente HTTP hacia la API PHP
// ============================================================

// Por defecto el backend cuelga de la misma carpeta que el index.html, así el
// build sirve igual en XAMPP (/evadesopm/) que en otro hosting (raíz del dominio).
// Para `npm run dev` (Vite) define VITE_API_BASE en un .env.local.
export const API_BASE =
  import.meta.env.VITE_API_BASE ||
  new URL('../backend/index.php', import.meta.url).href

// Raíz del sitio (para armar URLs de archivos subidos, ej. fotos de eventos).
export const SITE_BASE = API_BASE.replace(/backend\/index\.php$/, '')

function getToken() {
  return localStorage.getItem('token') || ''
}

async function request(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (auth && getToken()) headers['Authorization'] = `Bearer ${getToken()}`

  const res = await fetch(API_BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  let data = null
  try { data = await res.json() } catch { /* respuesta vacía */ }

  if (!res.ok) {
    const msg = (data && data.error) || `Error ${res.status}`
    const err = new Error(msg)
    err.status = res.status
    err.data = data
    throw err
  }
  return data
}

async function upload(path, formData) {
  const headers = {}
  if (getToken()) headers['Authorization'] = `Bearer ${getToken()}`

  const res = await fetch(API_BASE + path, { method: 'POST', headers, body: formData })
  let data = null
  try { data = await res.json() } catch { /* respuesta vacía */ }
  if (!res.ok) {
    const msg = (data && data.error) || `Error ${res.status}`
    const err = new Error(msg)
    err.status = res.status
    err.data = data
    throw err
  }
  return data
}

/** Descarga un archivo binario autenticado y dispara el diálogo de guardar del navegador. */
async function downloadFile(path, filename) {
  const headers = {}
  if (getToken()) headers['Authorization'] = `Bearer ${getToken()}`

  const res = await fetch(API_BASE + path, { headers })
  if (!res.ok) {
    let data = null
    try { data = await res.json() } catch { /* respuesta vacía */ }
    const msg = (data && data.error) || `Error ${res.status}`
    const err = new Error(msg)
    err.status = res.status
    throw err
  }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export const api = {
  login: (employee_number, password) =>
    request('/auth/login', { method: 'POST', body: { employee_number, password }, auth: false }),
  me: () => request('/auth/me'),
  logout: () => request('/auth/logout', { method: 'POST' }),
  changePassword: (password) => request('/auth/change-password', { method: 'POST', body: { password } }),

  rules: () => request('/rules'),

  opms: () => request('/opms'),
  downloadOpmsTemplate: () => downloadFile('/opms/template', 'plantilla_colaboradores.xlsx'),
  exportOpms: () => downloadFile('/opms/export', 'registros_colaboradores.xlsx'),
  createOpm: (payload) => request('/opms', { method: 'POST', body: payload }),
  importOpms: (file) => { const fd = new FormData(); fd.append('file', file); return upload('/opms/import', fd) },
  updateOpm: (id, payload) => request(`/opms/${id}`, { method: 'PUT', body: payload }),
  deleteOpm: (id) => request(`/opms/${id}`, { method: 'DELETE' }),

  shiftRecords: (year, quarter, opmId = '') =>
    request(`/shift-records?year=${year}&quarter=${quarter}&opm_id=${opmId}`),
  shiftRecordsByDate: (date, opmId = '') =>
    request(`/shift-records?date=${date}&opm_id=${opmId}`),
  shiftRecord: (id) => request(`/shift-records/${id}`),
  createShiftRecord: (payload, photo) => {
    if (!photo) return request('/shift-records', { method: 'POST', body: payload })
    const fd = new FormData()
    fd.append('payload', JSON.stringify(payload))
    fd.append('evento_photo', photo)
    return upload('/shift-records', fd)
  },
  updateShiftRecord: (id, payload, photo) => {
    if (!photo) return request(`/shift-records/${id}`, { method: 'POST', body: payload })
    const fd = new FormData()
    fd.append('payload', JSON.stringify(payload))
    fd.append('evento_photo', photo)
    return upload(`/shift-records/${id}`, fd)
  },
  deleteShiftRecord: (id) => request(`/shift-records/${id}`, { method: 'DELETE' }),

  control: (year, quarter) => request(`/control?year=${year}&quarter=${quarter}`),

  compromisoRules: () => request('/compromiso-rules'),
  compromisoRecords: (year, quarter, opmId = '') =>
    request(`/compromiso-records?year=${year}&quarter=${quarter}&opm_id=${opmId}`),
  compromisoRecord: (id) => request(`/compromiso-records/${id}`),
  createCompromisoRecord: (payload, photo) => {
    if (!photo) return request('/compromiso-records', { method: 'POST', body: payload })
    const fd = new FormData()
    fd.append('payload', JSON.stringify(payload))
    fd.append('conducta_photo', photo)
    return upload('/compromiso-records', fd)
  },
  updateCompromisoRecord: (id, payload, photo) => {
    if (!photo) return request(`/compromiso-records/${id}`, { method: 'POST', body: payload })
    const fd = new FormData()
    fd.append('payload', JSON.stringify(payload))
    fd.append('conducta_photo', photo)
    return upload(`/compromiso-records/${id}`, fd)
  },
  deleteCompromisoRecord: (id) => request(`/compromiso-records/${id}`, { method: 'DELETE' }),

  controlCompromiso: (year, quarter) => request(`/control-compromiso?year=${year}&quarter=${quarter}`),

  evaluation: (opmId, year, quarter) =>
    request(`/evaluations/${opmId}?year=${year}&quarter=${quarter}`),
  saveEvaluation: (payload) => request('/evaluations', { method: 'POST', body: payload }),
  evaluations: (year, quarter) => request(`/evaluations?year=${year}&quarter=${quarter}`),

  users: () => request('/users'),
  createUser: (payload) => request('/users', { method: 'POST', body: payload }),
  updateUser: (id, payload) => request(`/users/${id}`, { method: 'PUT', body: payload }),
  deleteUser: (id) => request(`/users/${id}`, { method: 'DELETE' }),
  importUsers: (file) => { const fd = new FormData(); fd.append('file', file); return upload('/users/import', fd) },
  downloadUsersTemplate: () => downloadFile('/users/template', 'plantilla_supervisores.xlsx'),

  assignments: (date, turno) => request(`/assignments?date=${encodeURIComponent(date)}&turno=${encodeURIComponent(turno)}`),
  shiftTeam: (date, turno, type = 'all') => request(`/turno-team?date=${encodeURIComponent(date)}&turno=${encodeURIComponent(turno)}&type=${encodeURIComponent(type)}`),
  importAssignments: (file, turno, date) => { const fd = new FormData(); fd.append('file', file); fd.append('turno', turno); fd.append('date', date); return upload('/assignments/import', fd) },
  downloadAssignmentsTemplate: () => downloadFile('/assignments/template', 'plantilla_asignacion_opm.xlsx'),
  createAssignmentIndividual: (payload) => request('/assignments/individual', { method: 'POST', body: payload }),
  supervisorAssignments: (date, turno) => request(`/supervisor-assignments?date=${date}&turno=${turno}`),
  importSupervisorAssignments: (file, turno, date, puesto) => { const fd = new FormData(); fd.append('file', file); fd.append('turno', turno); fd.append('date', date); fd.append('puesto', puesto); return upload('/supervisor-assignments/import', fd) },
  downloadSupervisorAssignmentsTemplate: () => downloadFile('/supervisor-assignments/template', 'plantilla_asignacion_supervisores.xlsx'),
  createSupervisorAssignmentIndividual: (payload) => request('/supervisor-assignments/individual', { method: 'POST', body: payload }),
  deleteSupervisorAssignment: (id) => request(`/supervisor-assignments/${id}`, { method: 'DELETE' }),
  radioContext: (date, turno) => request(`/radios?date=${date}&turno=${turno}`),
  radioReports: (from, to) => request(`/radios/reports?from=${from}&to=${to}`),
  radioDailyReport: (date, turno) => request(`/radios/reports/daily?date=${date}&turno=${turno}`),
  radiosCatalog: () => request('/radios/catalog'),
  createRadio: (payload) => request('/radios/catalog', { method: 'POST', body: payload }),
  updateRadio: (id, payload) => request(`/radios/catalog/${id}`, { method: 'PUT', body: payload }),
  deleteRadio: (id) => request(`/radios/catalog/${id}`, { method: 'DELETE' }),
  downloadRadiosTemplate: () => downloadFile('/radios/catalog/template', 'plantilla_radios.xlsx'),
  downloadRadiosLocationReport: () => downloadFile('/radios/catalog/report', 'reporte_ubicaciones_radios.xlsx'),
  importRadios: (file) => { const fd = new FormData(); fd.append('file', file); return upload('/radios/catalog/import', fd) },
  createRadioAssignment: (payload, photo) => {
    const fd = new FormData(); fd.append('payload', JSON.stringify(payload)); if (photo) fd.append('radio_photo', photo)
    return upload('/radios/assignments', fd)
  },
  updateRadioAssignment: (id, payload, photo) => {
    const fd = new FormData(); fd.append('payload', JSON.stringify(payload)); if (photo) fd.append('radio_photo', photo)
    return upload(`/radios/assignments/${id}`, fd)
  },
  updateRadioAssignmentGroup: (payload, photo) => {
    const fd = new FormData(); fd.append('payload', JSON.stringify(payload)); if (photo) fd.append('radio_photo', photo)
    return upload('/radios/assignments/group', fd)
  },
  deleteRadioAssignment: (id) => request(`/radios/assignments/${id}`, { method: 'DELETE' }),
  assignRadioCollaborator: (id, opm_id, puesto = '') => request(`/radios/assignments/${id}/collaborator`, { method: 'POST', body: { opm_id, puesto } }),
  moveRadioAssignments: (payload, photo) => { const fd = new FormData(); fd.append('payload', JSON.stringify(payload)); if (photo) fd.append('movement_photo', photo); return upload('/radios/movements', fd) },
  returnRadioAssignments: (payload, photo) => {
    const fd = new FormData(); fd.append('payload', JSON.stringify(payload)); if (photo) fd.append('return_photo', photo)
    return upload('/radios/returns', fd)
  },
}

export { getToken }
