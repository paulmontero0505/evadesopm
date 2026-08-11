import { useEffect, useMemo, useRef, useState } from 'react'
import { Upload, Download, UserPlus, ChevronDown, Search, X } from 'lucide-react'
import { api } from '../api.js'
import TopBar from '../components/TopBar.jsx'
import { T, useLang } from '../i18n.js'

const EMPTY = { code: '', full_name: '', puesto: '', fecha_ingreso: '', dni: '', fecha_nacimiento: '', telefono: '', email_personal: '', team: '' }
const fmtDate = (d) => { if (!d) return '—'; const [y, m, day] = d.split('-'); return `${day}/${m}/${y}` }

export default function Opms() {
  const [lang] = useLang()
  const t = T[lang]
  const [opms, setOpms] = useState([])
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [form, setForm] = useState(EMPTY)
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(null)
  const [edit, setEdit] = useState(EMPTY)
  const [showForm, setShowForm] = useState(false)
  const [importing, setImporting] = useState(false)
  const [expanded, setExpanded] = useState(null)
  const [q, setQ] = useState('')
  const [exporting, setExporting] = useState(false)
  const fileRef = useRef(null)

  async function load() {
    try { const d = await api.opms(); setOpms(d.opms) } catch (e) { setErr(e.message) }
  }
  useEffect(() => { load() }, [])

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return opms
    return opms.filter((o) =>
      [o.code, o.full_name, o.puesto, o.dni, o.telefono, o.email_personal, o.team].some((v) => (v || '').toLowerCase().includes(term)))
  }, [opms, q])

  async function create(e) {
    e.preventDefault(); setBusy(true); setErr(''); setMsg('')
    try {
      await api.createOpm(form)
      setMsg(t.opmCreado)
      setForm(EMPTY)
      await load()
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }

  async function exportTemplate() {
    setExporting(true); setErr(''); setMsg('')
    try {
      await api.downloadOpmsTemplate()
    } catch (e) { setErr(e.message) } finally { setExporting(false) }
  }

  async function onFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''   // permite volver a elegir el mismo archivo
    if (!file) return
    setImporting(true); setErr(''); setMsg('')
    try {
      const r = await api.importOpms(file)
      const errTxt = r.errors?.length ? t.conError(r.errors.length) : ''
      setMsg(`Importación completa: ${r.created} nuevos, ${r.updated} actualizados de ${r.total} colaboradores${errTxt}.`)
      await load()
    } catch (e) { setErr(e.message) } finally { setImporting(false) }
  }

  function startEdit(o) {
    setErr(''); setMsg('')
    setEditing(o.id)
    setEdit({
      code: o.code, full_name: o.full_name, puesto: o.puesto || '', fecha_ingreso: o.fecha_ingreso || '',
      dni: o.dni || '', fecha_nacimiento: o.fecha_nacimiento || '', telefono: o.telefono || '',
      email_personal: o.email_personal || '', team: o.team || '',
    })
  }

  async function saveEdit(o) {
    setBusy(true); setErr(''); setMsg('')
    try {
      await api.updateOpm(o.id, {
        code: edit.code.trim(), full_name: edit.full_name.trim(),
        puesto: edit.puesto.trim(), fecha_ingreso: edit.fecha_ingreso, dni: edit.dni.trim(),
        fecha_nacimiento: edit.fecha_nacimiento, telefono: edit.telefono.trim(),
        email_personal: edit.email_personal.trim(), team: edit.team.trim(),
      })
      setMsg(t.opmActualizado)
      setEditing(null)
      await load()
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }

  async function toggleActive(o) {
    setErr(''); setMsg('')
    try { await api.updateOpm(o.id, { active: o.active ? 0 : 1 }); await load() }
    catch (e) { setErr(e.message) }
  }

  async function remove(o) {
    const ok = window.confirm(t.confirmarBorrarOpm(o.full_name, o.code))
    if (!ok) return
    setBusy(true); setErr(''); setMsg('')
    try {
      const r = await api.deleteOpm(o.id)
      setMsg(r.deactivated ? t.opmDesactivado : t.opmEliminado)
      await load()
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }

  return (
    <>
      <TopBar title={t.opmsTitulo} to="/admin" />
      <div className="content">
        {err && <div className="error">{err}</div>}
        {msg && <div className="success">{msg}</div>}

        <div className="card">
          <h3>{t.agregarColab}</h3>
          <div className="muted" style={{ marginBottom: 12 }}>{t.agregarColabD}</div>
          <div className="row">
            <button className="btn" disabled={importing} onClick={() => fileRef.current?.click()}>
              <Upload size={16} /> {importing ? t.importando : t.importarExcel}
            </button>
            <button className="btn secondary" onClick={() => setShowForm((v) => !v)}>
              <UserPlus size={16} /> {showForm ? t.ocultarRegistro : t.registroIndividual}
            </button>
          </div>
          <button className="btn secondary" style={{ marginTop: 8 }} disabled={exporting} onClick={exportTemplate}>
            <Download size={16} /> {exporting ? t.descargando : t.exportarPlantilla}
          </button>
          <input ref={fileRef} type="file" accept=".xlsx" style={{ display: 'none' }} onChange={onFile} />
        </div>

        {showForm && (
          <form className="card" onSubmit={create}>
            <h3>{t.nuevoColaborador}</h3>
            <label>{t.colCodigo}</label>
            <input className="input" placeholder="0000116" required value={form.code}
                   onChange={(e) => setForm({ ...form, code: e.target.value })} />
            <label>{t.colNombresCompletos}</label>
            <input className="input" required value={form.full_name}
                   onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            <label>{t.colCargo}</label>
            <input className="input" value={form.puesto}
                   onChange={(e) => setForm({ ...form, puesto: e.target.value })} />
            <label>{t.fechaIngreso}</label>
            <input className="input" type="date" value={form.fecha_ingreso}
                   onChange={(e) => setForm({ ...form, fecha_ingreso: e.target.value })} />
            <label>{t.colDocumento}</label>
            <input className="input" value={form.dni}
                   onChange={(e) => setForm({ ...form, dni: e.target.value })} />
            <label>{t.fechaNacimiento}</label>
            <input className="input" type="date" value={form.fecha_nacimiento}
                   onChange={(e) => setForm({ ...form, fecha_nacimiento: e.target.value })} />
            <label>{t.telefono}</label>
            <input className="input" type="tel" value={form.telefono}
                   onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
            <label>{t.emailPersonal}</label>
            <input className="input" type="email" value={form.email_personal}
                   onChange={(e) => setForm({ ...form, email_personal: e.target.value })} />
            <label>{t.team}</label>
            <input className="input" value={form.team}
                   onChange={(e) => setForm({ ...form, team: e.target.value })} />
            <div style={{ height: 12 }} />
            <button className="btn" disabled={busy}>{busy ? t.creando : t.crearColaborador}</button>
          </form>
        )}

        <div className="search-box">
          <Search size={16} className="search-icon" />
          <input className="input" placeholder={t.buscarColab}
                 value={q} onChange={(e) => setQ(e.target.value)} />
          {q && (
            <button className="search-clear" onClick={() => setQ('')} aria-label={t.limpiarBusqueda}>
              <X size={15} />
            </button>
          )}
        </div>
        {q && (
          <div className="muted" style={{ margin: '0 0 10px 2px' }}>
            {t.deColaboradores(shown.length, opms.length)}
          </div>
        )}

        {shown.length === 0 ? (
          <div className="empty">{t.sinColaboradores(q)}</div>
        ) : shown.map((o) => editing === o.id ? (
          <div className="card" key={o.id}>
            <h3>{t.editarColaborador}</h3>
            <label>{t.colCodigo}</label>
            <input className="input" required value={edit.code} onChange={(e) => setEdit({ ...edit, code: e.target.value })} />
            <label>{t.colNombresCompletos}</label>
            <input className="input" required value={edit.full_name} onChange={(e) => setEdit({ ...edit, full_name: e.target.value })} />
            <label>{t.colCargo}</label>
            <input className="input" value={edit.puesto} onChange={(e) => setEdit({ ...edit, puesto: e.target.value })} />
            <label>{t.fechaIngreso}</label>
            <input className="input" type="date" value={edit.fecha_ingreso} onChange={(e) => setEdit({ ...edit, fecha_ingreso: e.target.value })} />
            <label>{t.colDocumento}</label>
            <input className="input" value={edit.dni} onChange={(e) => setEdit({ ...edit, dni: e.target.value })} />
            <label>{t.fechaNacimiento}</label>
            <input className="input" type="date" value={edit.fecha_nacimiento} onChange={(e) => setEdit({ ...edit, fecha_nacimiento: e.target.value })} />
            <label>{t.telefono}</label>
            <input className="input" type="tel" value={edit.telefono} onChange={(e) => setEdit({ ...edit, telefono: e.target.value })} />
            <label>{t.emailPersonal}</label>
            <input className="input" type="email" value={edit.email_personal} onChange={(e) => setEdit({ ...edit, email_personal: e.target.value })} />
            <label>{t.team}</label>
            <input className="input" value={edit.team} onChange={(e) => setEdit({ ...edit, team: e.target.value })} />
            <div style={{ height: 12 }} />
            <div className="row">
              <button className="btn secondary" disabled={busy} onClick={() => setEditing(null)}>{t.cancelar}</button>
              <button className="btn" disabled={busy} onClick={() => saveEdit(o)}>{busy ? t.guardandoBtn : t.guardar}</button>
            </div>
          </div>
        ) : (
          <div className="opm-card" key={o.id}>
            <div className="list-row" style={{ marginBottom: 0, boxShadow: 'none', border: 'none', borderRadius: 0 }}>
              <button className="opm-expand" onClick={() => setExpanded(expanded === o.id ? null : o.id)}
                aria-label={t.verDetalles} aria-expanded={expanded === o.id}>
                <ChevronDown size={16} className={expanded === o.id ? 'rot' : ''} />
              </button>
              <div className="grow">
                <div className="name">{o.code}</div>
                <div className="meta">{o.full_name}</div>
              </div>
              <button className={`btn small ${o.active ? 'ghost' : 'secondary'}`} disabled={busy} onClick={() => toggleActive(o)}>
                {o.active ? t.activo : t.inactivo}
              </button>
              <button className="btn small secondary" onClick={() => startEdit(o)}>{t.editar}</button>
              <button className="btn small danger" disabled={busy} onClick={() => remove(o)}>{t.eliminar}</button>
            </div>
            {expanded === o.id && (
              <div className="opm-details">
                <div><span className="muted">{t.dni}</span><span>{o.dni || '—'}</span></div>
                <div><span className="muted">{t.fechaIngreso}</span><span>{fmtDate(o.fecha_ingreso)}</span></div>
                <div><span className="muted">{t.puestoCampo}</span><span>{o.puesto || '—'}</span></div>
                <div><span className="muted">{t.team}</span><span>{o.team || '—'}</span></div>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  )
}
