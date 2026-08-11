import { useEffect, useMemo, useRef, useState } from 'react'
import { Upload, Download, UserPlus, ChevronDown, Search, X } from 'lucide-react'
import { api } from '../api.js'
import { useAuth } from '../auth.jsx'
import TopBar from '../components/TopBar.jsx'
import { T, useLang } from '../i18n.js'


const EMPTY = {
  employee_number: '', full_name: '', password: '', role: 'supervisor',
  code: '', dni: '', fecha_ingreso: '', puesto: '', team: '',
}
const fmtDate = (d) => { if (!d) return '—'; const [y, m, day] = d.split('-'); return `${day}/${m}/${y}` }

export default function Users() {
  const { user: me } = useAuth()
  const [lang] = useLang()
  const t = T[lang]
  const ROLES = [['supervisor', t.rolSupervisor], ['coordinator', t.rolCoordinador], ['admin', t.rolAdmin]]
  const [users, setUsers] = useState([])
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [form, setForm] = useState(EMPTY)
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(null)
  const [edit, setEdit] = useState(EMPTY)
  const [importing, setImporting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [expanded, setExpanded] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [q, setQ] = useState('')
  const fileRef = useRef(null)

  async function load() {
    try { const d = await api.users(); setUsers(d.users) } catch (e) { setErr(e.message) }
  }
  useEffect(() => { load() }, [])

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return users
    return users.filter((u) =>
      [u.employee_number, u.full_name, u.code, u.dni, u.puesto, u.team].some((v) => (v || '').toLowerCase().includes(term)))
  }, [users, q])

  async function onFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setImporting(true); setErr(''); setMsg('')
    try {
      const r = await api.importUsers(file)
      const errTxt = r.errors?.length ? t.conError(r.errors.length) : ''
      setMsg(t.importCompleta(r.created, r.updated, r.total, t.tipoSupervisores, errTxt) + t.importUsersExtra)
      await load()
    } catch (e) { setErr(e.message) } finally { setImporting(false) }
  }

  async function exportTemplate() {
    setExporting(true); setErr(''); setMsg('')
    try { await api.downloadUsersTemplate() } catch (e) { setErr(e.message) } finally { setExporting(false) }
  }

  async function create(e) {
    e.preventDefault(); setBusy(true); setErr(''); setMsg('')
    try {
      await api.createUser(form)
      setMsg(t.usuarioCreado)
      setForm(EMPTY)
      await load()
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }

  function startEdit(u) {
    setErr(''); setMsg('')
    setEditing(u.id)
    setEdit({
      employee_number: u.employee_number, full_name: u.full_name, role: u.role, password: '',
      code: u.code || '', dni: u.dni || '', fecha_ingreso: u.fecha_ingreso || '',
      puesto: u.puesto || '', team: u.team || '',
    })
  }

  async function saveEdit(u) {
    setBusy(true); setErr(''); setMsg('')
    try {
      const payload = {
        employee_number: edit.employee_number.trim(),
        full_name: edit.full_name.trim(),
        role: edit.role,
        code: edit.code.trim(), dni: edit.dni.trim(),
        fecha_ingreso: edit.fecha_ingreso, puesto: edit.puesto.trim(), team: edit.team.trim(),
      }
      if (edit.password) payload.password = edit.password
      await api.updateUser(u.id, payload)
      setMsg(t.usuarioActualizado)
      setEditing(null)
      await load()
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }

  async function remove(u) {
    const ok = window.confirm(t.confirmarBorrarUser(u.full_name, u.employee_number))
    if (!ok) return
    setBusy(true); setErr(''); setMsg('')
    try { await api.deleteUser(u.id); setMsg(t.usuarioEliminado); await load() }
    catch (e) { setErr(e.message) } finally { setBusy(false) }
  }

  async function toggleActive(u) {
    setErr(''); setMsg('')
    try { await api.updateUser(u.id, { active: u.active ? 0 : 1 }); await load() }
    catch (e) { setErr(e.message) }
  }

  return (
    <>
      <TopBar title={t.usersTitulo} to="/admin" />
      <div className="content">
        {err && <div className="error">{err}</div>}
        {msg && <div className="success">{msg}</div>}

        <div className="card">
          <h3>{t.cargarSupers}</h3>
          <div className="muted" style={{ marginBottom: 12 }}>{t.cargarSupersD}</div>
          <div className="row">
            <button className="btn" disabled={importing} onClick={() => fileRef.current?.click()}>
              <Upload size={16} /> {importing ? t.importando : t.importarExcel}
            </button>
            <button className="btn secondary" onClick={() => setShowForm((v) => !v)}>
              <UserPlus size={16} /> {showForm ? t.ocultarRegistro : t.registroIndividual}
            </button>
          </div>
          <button className="btn secondary" style={{ marginTop: 8, width: '100%' }} disabled={exporting} onClick={exportTemplate}>
            <Download size={16} /> {exporting ? t.descargando : t.exportarPlantilla}
          </button>
          <input ref={fileRef} type="file" accept=".xlsx" style={{ display: 'none' }} onChange={onFile} />
        </div>

        {showForm && (
        <form className="card" onSubmit={create}>
          <h3>{t.nuevoUsuario}</h3>
          <div className="row">
            <div>
              <label>{t.numEmp}</label>
              <input className="input" value={form.employee_number}
                     onChange={(e) => setForm({ ...form, employee_number: e.target.value })} />
            </div>
            <div>
              <label>{t.rol}</label>
              <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>
          <label>{t.nombreCompleto}</label>
          <input className="input" value={form.full_name}
                 onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          <label>{t.contrasena}</label>
          <input className="input" type="text" value={form.password}
                 onChange={(e) => setForm({ ...form, password: e.target.value })} />
          {form.role !== 'admin' && <div className="muted">{t.claveSupervisorAviso}</div>}
          <label>{t.codigoCod}</label>
          <input className="input" value={form.code}
                 onChange={(e) => setForm({ ...form, code: e.target.value })} />
          <label>{t.dni}</label>
          <input className="input" value={form.dni}
                 onChange={(e) => setForm({ ...form, dni: e.target.value })} />
          <label>{t.fechaIngreso}</label>
          <input className="input" type="date" value={form.fecha_ingreso}
                 onChange={(e) => setForm({ ...form, fecha_ingreso: e.target.value })} />
          <label>{t.puestoCampo}</label>
          <input className="input" value={form.puesto}
                 onChange={(e) => setForm({ ...form, puesto: e.target.value })} />
          <label>{t.team}</label>
          <input className="input" value={form.team}
                 onChange={(e) => setForm({ ...form, team: e.target.value })} />
          <div style={{ height: 12 }} />
          <button className="btn" disabled={busy}>{busy ? t.creando : t.crearUsuario}</button>
        </form>
        )}

        <div className="search-box">
          <Search size={16} className="search-icon" />
          <input className="input" placeholder={t.buscarUsers}
                 value={q} onChange={(e) => setQ(e.target.value)} />
          {q && (
            <button className="search-clear" onClick={() => setQ('')} aria-label={t.limpiarBusqueda}>
              <X size={15} />
            </button>
          )}
        </div>
        {q && (
          <div className="muted" style={{ margin: '0 0 10px 2px' }}>
            {t.deUsuarios(shown.length, users.length)}
          </div>
        )}

        {shown.length === 0 ? (
          <div className="empty">{t.sinUsuarios(q)}</div>
        ) : shown.map((u) => editing === u.id ? (
          <div className="card" key={u.id}>
            <h3>{t.editarUsuario}</h3>
            <div className="row">
              <div>
                <label>{t.numEmp}</label>
                <input className="input" value={edit.employee_number}
                       onChange={(e) => setEdit({ ...edit, employee_number: e.target.value })} />
              </div>
              <div>
                <label>{t.rol}</label>
                <select className="input" value={edit.role} disabled={u.id === me.id}
                        onChange={(e) => setEdit({ ...edit, role: e.target.value })}>
                  {ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            </div>
            <label>{t.nombreCompleto}</label>
            <input className="input" value={edit.full_name}
                   onChange={(e) => setEdit({ ...edit, full_name: e.target.value })} />
            <label>{t.nuevaContrasena}</label>
            <input className="input" type="text" placeholder={t.dejarVacio}
                   value={edit.password}
                   onChange={(e) => setEdit({ ...edit, password: e.target.value })} />
            {u.role !== 'admin' && <div className="muted">{t.claveSupervisorAviso}</div>}
            <label>{t.codigoCod}</label>
            <input className="input" value={edit.code}
                   onChange={(e) => setEdit({ ...edit, code: e.target.value })} />
            <label>{t.dni}</label>
            <input className="input" value={edit.dni}
                   onChange={(e) => setEdit({ ...edit, dni: e.target.value })} />
            <label>{t.fechaIngreso}</label>
            <input className="input" type="date" value={edit.fecha_ingreso}
                   onChange={(e) => setEdit({ ...edit, fecha_ingreso: e.target.value })} />
            <label>{t.puestoCampo}</label>
            <input className="input" value={edit.puesto}
                   onChange={(e) => setEdit({ ...edit, puesto: e.target.value })} />
            <label>{t.team}</label>
            <input className="input" value={edit.team}
                   onChange={(e) => setEdit({ ...edit, team: e.target.value })} />
            <div style={{ height: 12 }} />
            <div className="row">
              <button className="btn secondary" disabled={busy} onClick={() => setEditing(null)}>{t.cancelar}</button>
              <button className="btn" disabled={busy} onClick={() => saveEdit(u)}>{busy ? t.guardandoBtn : t.guardar}</button>
            </div>
          </div>
        ) : (
          <div className="opm-card" key={u.id}>
            <div className="list-row" style={{ marginBottom: 0, boxShadow: 'none', border: 'none', borderRadius: 0 }}>
              <button className="opm-expand" onClick={() => setExpanded(expanded === u.id ? null : u.id)}
                aria-label={t.verDetalles} aria-expanded={expanded === u.id}>
                <ChevronDown size={16} className={expanded === u.id ? 'rot' : ''} />
              </button>
              <div className="grow">
                <div className="name">{u.employee_number}</div>
                <div className="meta">
                  {u.full_name} · {ROLES.find(([v]) => v === u.role)?.[1]}
                  {u.id === me.id ? t.tu : ''}
                </div>
              </div>
              <button className={`btn small ${u.active ? 'ghost' : 'secondary'}`} disabled={busy} onClick={() => toggleActive(u)}>
                {u.active ? t.activo : t.inactivo}
              </button>
              <button className="btn small secondary" onClick={() => startEdit(u)}>{t.editar}</button>
              {u.id !== me.id && (
                <button className="btn small danger" disabled={busy} onClick={() => remove(u)}>{t.eliminar}</button>
              )}
            </div>
            {expanded === u.id && (
              <div className="opm-details">
                <div><span className="muted">{t.codigo}</span><span>{u.code || '—'}</span></div>
                <div><span className="muted">{t.dni}</span><span>{u.dni || '—'}</span></div>
                <div><span className="muted">{t.fechaIngreso}</span><span>{fmtDate(u.fecha_ingreso)}</span></div>
                <div><span className="muted">{t.puestoCampo}</span><span>{u.puesto || '—'}</span></div>
                <div><span className="muted">{t.team}</span><span>{u.team || '—'}</span></div>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  )
}
