import { useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircle2, Download, FileSpreadsheet, MapPin, Pencil, Radio, Search, Trash2, Upload, XCircle } from 'lucide-react'
import { api } from '../api.js'
import TopBar from '../components/TopBar.jsx'

const EMPTY = { code: '', imei: '', model: '', location: '', condition_status: 'Excelente Estado' }
const CONDITIONS = ['Excelente Estado', 'Pantalla Rota', 'Botones Dañados']

export default function RadiosCatalogo() {
  const [radios, setRadios] = useState([])
  const [form, setForm] = useState(EMPTY)
  const [editing, setEditing] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [importing, setImporting] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const fileRef = useRef(null)

  async function load() {
    try { const data = await api.radiosCatalog(); setRadios(data.radios || []) } catch (err) { setError(err.message) }
  }

  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return q ? radios.filter((r) => `${r.code} ${r.imei} ${r.model} ${r.location || ''} ${r.last_location || ''}`.toLowerCase().includes(q)) : radios
  }, [radios, search])
  const metrics = useMemo(() => ({
    total: radios.length,
    toolroom: radios.filter((r) => (r.last_location || r.location || '').toUpperCase() === 'TOOLROOM').length,
    elsewhere: radios.filter((r) => { const location = (r.last_location || r.location || '').toUpperCase(); return location && location !== 'TOOLROOM' }).length,
    damaged: radios.filter((r) => r.condition_status !== 'Excelente Estado').length,
  }), [radios])

  function openNew() { setEditing(null); setForm(EMPTY); setShowForm(true) }
  function openEdit(radio) {
    setEditing(radio)
    setForm({ code: radio.code, imei: radio.imei, model: radio.model, location: radio.location || '', condition_status: radio.condition_status || 'Excelente Estado' })
    setShowForm(true)
  }
  async function submit(event) {
    event.preventDefault(); setSaving(true); setError(''); setMessage('')
    try {
      if (editing) await api.updateRadio(editing.id, form); else await api.createRadio(form)
      setMessage(editing ? 'Radio actualizado correctamente.' : 'Radio registrado correctamente.')
      setShowForm(false); setEditing(null); setForm(EMPTY)
      await load()
    } catch (err) { setError(err.message) } finally { setSaving(false) }
  }
  async function importFile(event) {
    const file = event.target.files?.[0]; event.target.value = ''
    if (!file) return
    setImporting(true); setError(''); setMessage('')
    try { const result = await api.importRadios(file); setMessage(`Importación completada: ${result.created} nuevos y ${result.updated} actualizados.`); await load() } catch (err) { setError(err.message) } finally { setImporting(false) }
  }
  async function update(radio, payload) {
    setError(''); setMessage('')
    try { await api.updateRadio(radio.id, payload); await load() } catch (err) { setError(err.message) }
  }
  async function deleteRadio(radio) {
    if (!window.confirm(`¿Eliminar el radio ${radio.code}? Esta acción no se puede deshacer.`)) return
    setDeletingId(radio.id); setError(''); setMessage('')
    try { await api.deleteRadio(radio.id); setMessage(`Radio ${radio.code} eliminado correctamente.`); await load() } catch (err) { setError(err.message) } finally { setDeletingId(null) }
  }
  async function downloadReport() {
    setDownloading(true); setError('')
    try { await api.downloadRadiosLocationReport() } catch (err) { setError(err.message) } finally { setDownloading(false) }
  }

  return <>
    <TopBar title="Registrar radios" to="/admin" />
    <main className="content">
      {error && <div className="error" role="alert">{error}</div>}
      {message && <div className="success" role="status">{message}</div>}
      <section className="card">
        <h3>Registrar inventario de radios</h3>
        <p className="muted assignment-copy">Importe una lista Excel o registre un radio de forma individual.</p>
        <div className="row assignment-actions">
          <button className="btn" disabled={importing} onClick={() => fileRef.current?.click()}><Upload size={16} /> {importing ? 'Importando...' : 'Importar Excel'}</button>
          <button className="btn secondary" onClick={() => api.downloadRadiosTemplate()}><Download size={16} /> Exportar plantilla</button>
        </div>
        <input ref={fileRef} type="file" accept=".xlsx" hidden onChange={importFile} />
      </section>
      <button className="btn secondary catalog-new-btn" onClick={() => showForm ? setShowForm(false) : openNew()}>{showForm ? 'Ocultar registro de radio' : 'Registrar nueva radio'}</button>
      {showForm && <section className="card">
        <h3>{editing ? `Editar radio ${editing.code}` : 'Nuevo radio'}</h3>
        <form onSubmit={submit}>
          <div className="radio-form-grid">
            <div><label>Código de radio</label><input className="input" required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></div>
            <div><label>IMEI</label><input className="input" required value={form.imei} onChange={(e) => setForm({ ...form, imei: e.target.value })} /></div>
            <div><label>Modelo</label><input className="input" required value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} /></div>
            <div><label><MapPin size={14} /> Ubicación base</label><input className="input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
            <div><label>Estado</label><select className="input" value={form.condition_status} onChange={(e) => setForm({ ...form, condition_status: e.target.value })}>{CONDITIONS.map((condition) => <option key={condition}>{condition}</option>)}</select></div>
          </div>
          <div className="radio-form-actions"><button className="btn secondary" type="button" onClick={() => { setShowForm(false); setEditing(null); setForm(EMPTY) }}>Cancelar</button><button className="btn" disabled={saving}>{saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Registrar radio'}</button></div>
        </form>
      </section>}
      <section className="catalog-insights" aria-label="Resumen de inventario">
        <div><strong>{metrics.total}</strong><span>Total de radios</span></div>
        <div><strong>{metrics.toolroom}</strong><span>En TOOLROOM</span></div>
        <div><strong>{metrics.elsewhere}</strong><span>En otra ubicación</span></div>
        <div><strong>{metrics.damaged}</strong><span>Radios dañadas</span></div>
      </section>
      <section>
        <div className="home-assignments-heading"><div><h2>Inventario de radios</h2><p>Busque, edite, elimine o consulte la última ubicación.</p></div><span className="shift-selection-count"><Radio size={14} />{filtered.length}</span></div>
        <div className="catalog-tools">
          <div className="search-box"><Search className="search-icon" size={18} /><input className="input" placeholder="Buscar por código, IMEI, modelo o ubicación" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          <button className="btn secondary" disabled={downloading} onClick={() => setShowReport(!showReport)}><FileSpreadsheet size={16} /> Reporte de ubicaciones</button>
        </div>
        {showReport && <section className="card radio-location-report"><h3>Reporte de ubicaciones</h3><p className="muted assignment-copy">Descargue el listado actualizado de radios y su última ubicación registrada.</p><button className="btn" disabled={downloading} onClick={downloadReport}><Download size={16} /> {downloading ? 'Descargando...' : 'Descargar reporte Excel'}</button></section>}
        {filtered.length === 0 ? <div className="empty"><Radio size={30} /><div>No se encontraron radios.</div></div> : filtered.map((radio) => <article className="assignment-row radio-catalog-row" key={radio.id}>
          <div className="assignment-row-main"><strong>{radio.code}</strong><span>IMEI: {radio.imei} · {radio.model} · Base: {radio.last_location || radio.location || 'Sin ubicación'}</span></div>
          <select className="input radio-catalog-status" value={radio.condition_status || 'Excelente Estado'} onChange={(e) => update(radio, { condition_status: e.target.value })} aria-label={`Estado del radio ${radio.code}`}>{CONDITIONS.map((condition) => <option key={condition}>{condition}</option>)}</select>
          <div className="radio-catalog-actions">
            <button className="catalog-icon edit" onClick={() => openEdit(radio)} title={`Editar radio ${radio.code}`} aria-label={`Editar radio ${radio.code}`}><Pencil size={18} /></button>
            <button className="catalog-icon state" onClick={() => update(radio, { active: !radio.active })} title={radio.active ? `Desactivar radio ${radio.code}` : `Activar radio ${radio.code}`} aria-label={radio.active ? `Desactivar radio ${radio.code}` : `Activar radio ${radio.code}`}>{radio.active ? <CheckCircle2 size={19} /> : <XCircle size={19} />}</button>
            <button className="catalog-icon delete" disabled={deletingId === radio.id} onClick={() => deleteRadio(radio)} title={`Eliminar radio ${radio.code}`} aria-label={`Eliminar radio ${radio.code}`}>{deletingId === radio.id ? '...' : <Trash2 size={18} />}</button>
          </div>
        </article>)}
      </section>
    </main>
  </>
}
