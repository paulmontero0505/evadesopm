import { useEffect, useState } from 'react'
import { RefreshCw, Search, ShieldCheck } from 'lucide-react'
import { api } from '../api.js'
import TopBar from '../components/TopBar.jsx'

const EMPTY_FILTERS = { from: '', to: '', module: '', user_id: '', q: '' }

function formatDetails(details) {
  if (!details) return null
  try {
    const parsed = JSON.parse(details)
    return Object.entries(parsed)
      .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
      .join('\n')
  } catch {
    return details
  }
}

export default function Auditoria() {
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [records, setRecords] = useState([])
  const [modules, setModules] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [openId, setOpenId] = useState(null)

  async function load(applied = filters) {
    setLoading(true)
    setError('')
    try {
      const res = await api.audit(applied)
      setRecords(res.records || [])
      setModules(res.modules || [])
      setUsers(res.users || [])
    } catch (err) {
      setError(err.message)
      setRecords([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load(EMPTY_FILTERS) }, [])

  const update = (field, value) => setFilters((f) => ({ ...f, [field]: value }))

  return (
    <>
      <TopBar title="Auditoría" sub="Historial de cambios" to="/admin" />
      <div className="content">
        <div className="card audit-filters">
          <div className="audit-filter-grid">
            <label>
              Desde
              <input className="input" type="date" value={filters.from} onChange={(e) => update('from', e.target.value)} />
            </label>
            <label>
              Hasta
              <input className="input" type="date" value={filters.to} onChange={(e) => update('to', e.target.value)} />
            </label>
            <label>
              Módulo
              <select className="input" value={filters.module} onChange={(e) => update('module', e.target.value)}>
                <option value="">Todos</option>
                {modules.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </label>
            <label>
              Usuario
              <select className="input" value={filters.user_id} onChange={(e) => update('user_id', e.target.value)}>
                <option value="">Todos</option>
                {users.map((u) => <option key={u.user_id} value={u.user_id}>{u.user_name}</option>)}
              </select>
            </label>
            <label className="audit-filter-search">
              Buscar
              <input className="input" value={filters.q} onChange={(e) => update('q', e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()} placeholder="Acción, usuario o detalle" />
            </label>
          </div>
          <div className="audit-filter-actions">
            <button className="btn secondary" onClick={() => { setFilters(EMPTY_FILTERS); load(EMPTY_FILTERS) }}>Limpiar</button>
            <button className="btn" onClick={() => load()}><Search size={15} /> Filtrar</button>
            <button className="icon-action" onClick={() => load()} aria-label="Recargar"><RefreshCw size={15} /></button>
          </div>
        </div>

        {error && <div className="error">{error}</div>}

        {loading ? (
          <div className="empty">Cargando auditoría…</div>
        ) : records.length === 0 ? (
          <div className="assignment-empty"><ShieldCheck size={24} /><div><strong>Sin registros</strong><span>No hay cambios que coincidan con los filtros.</span></div></div>
        ) : (
          <div className="card audit-table-card">
            <div className="audit-table">
              <div className="audit-head">
                <span>Fecha y hora</span>
                <span>Usuario</span>
                <span>Módulo</span>
                <span>Acción</span>
                <span>Detalle</span>
              </div>
              {records.map((r) => {
                const details = formatDetails(r.details)
                const open = openId === r.id
                return (
                  <div className={`audit-row${open ? ' open' : ''}`} key={r.id}>
                    <div className="audit-cells">
                      <span className="audit-when">{r.created_at}</span>
                      <span>
                        <strong>{r.user_name || '—'}</strong>
                        {r.user_role && <small className="audit-role">{r.user_role}</small>}
                      </span>
                      <span><span className="audit-module">{r.module}</span></span>
                      <span>
                        {r.action}
                        {r.entity_id && <small className="audit-entity"> · #{r.entity_id}</small>}
                      </span>
                      <span>
                        {details ? (
                          <button type="button" className="audit-detail-toggle" onClick={() => setOpenId(open ? null : r.id)}>
                            {open ? 'Ocultar' : 'Ver detalle'}
                          </button>
                        ) : <span className="muted">—</span>}
                      </span>
                    </div>
                    {open && details && <pre className="audit-detail">{details}</pre>}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
