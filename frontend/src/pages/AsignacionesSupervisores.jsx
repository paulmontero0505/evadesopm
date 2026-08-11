import { Download, Trash2, Upload, UserPlus, UsersRound } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { api } from '../api.js'
import { useShift } from '../shift.jsx'
import TopBar from '../components/TopBar.jsx'
import { AssignmentFields, SearchablePicker } from './Asignaciones.jsx'

const today = () => new Date().toISOString().slice(0, 10)
const EMPTY = { user_id: '', funcion_1: '', funcion_2: '', zona_1: '', puesto: '', nave: '', nave_2: '' }
const turnoLabel = (turno) => turno === 'noche' ? 'Noche · 19:00 - 07:00' : 'Día · 07:00 - 19:00'

export default function AsignacionesSupervisores() {
  const { shift } = useShift()
  const [date, setDate] = useState(shift?.date || today())
  const [turno, setTurno] = useState(shift?.turno || 'dia')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [showIndividual, setShowIndividual] = useState(false)
  const [users, setUsers] = useState([])
  const [individual, setIndividual] = useState(EMPTY)
  const [savingIndividual, setSavingIndividual] = useState(false)
  const fileRef = useRef(null)

  async function load() {
    setLoading(true); setError('')
    try { const data = await api.supervisorAssignments(date, turno); setRows(data.assignments || []) }
    catch (err) { setError(err.message) } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [date, turno])
  useEffect(() => { api.users().then((data) => setUsers((data.users || []).filter((user) => user.active && ['supervisor', 'coordinator'].includes(user.role)))).catch(() => {}) }, [])

  async function upload(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setImporting(true); setError(''); setMessage('')
    try { const result = await api.importSupervisorAssignments(file, turno, date); setMessage(`Se importaron ${result.imported} asignaciones de supervisores.${result.errors?.length ? ` Se omitieron ${result.errors.length} filas.` : ''}`); await load() }
    catch (err) { setError(err.message) } finally { setImporting(false) }
  }

  async function downloadTemplate() { setDownloading(true); setError(''); try { await api.downloadSupervisorAssignmentsTemplate() } catch (err) { setError(err.message) } finally { setDownloading(false) } }
  async function saveIndividual(event) { event.preventDefault(); setSavingIndividual(true); setError(''); setMessage(''); try { await api.createSupervisorAssignmentIndividual({ ...individual, date, turno }); setMessage('Supervisor o coordinador asignado correctamente al turno.'); setIndividual(EMPTY); setShowIndividual(false); await load() } catch (err) { setError(err.message) } finally { setSavingIndividual(false) } }
  async function removeAssignment(row) { if (!window.confirm(`¿Eliminar la asignación de ${row.full_name} para este turno?`)) return; setDeletingId(row.id); setError(''); setMessage(''); try { await api.deleteSupervisorAssignment(row.id); setMessage(`Se eliminó la asignación de ${row.full_name}.`); await load() } catch (err) { setError(err.message) } finally { setDeletingId(null) } }

  return <><TopBar title="Asignación de funciones (Supervisores)" to="/admin" /><main className="content">
    {error && <div className="error" role="alert">{error}</div>}{message && <div className="success">{message}</div>}
    <section className="card"><h3>Cargar asignaciones del turno</h3><p className="muted assignment-copy">Importe el Excel con las funciones de supervisores y coordinadores. La fecha y el turno seleccionados se aplicarán a todas las filas.</p><div className="row assignment-picker"><div><label>Fecha</label><input className="input" type="date" value={date} onChange={(event) => setDate(event.target.value)} /></div><div><label>Turno de trabajo</label><select className="input" value={turno} onChange={(event) => setTurno(event.target.value)}><option value="dia">Día · 07:00 - 19:00</option><option value="noche">Noche · 19:00 - 07:00</option></select></div></div><div className="row assignment-actions"><button className="btn" disabled={importing} onClick={() => fileRef.current?.click()}><Upload size={16} /> {importing ? 'Importando...' : 'Importar Excel'}</button><button className="btn secondary" onClick={() => setShowIndividual((value) => !value)}><UserPlus size={16} /> {showIndividual ? 'Ocultar registro' : 'Registro individual'}</button><button className="btn secondary" disabled={downloading} onClick={downloadTemplate}><Download size={16} /> {downloading ? 'Descargando...' : 'Exportar plantilla'}</button></div><input ref={fileRef} type="file" accept=".xlsx" hidden onChange={upload} /></section>
    {showIndividual && <IndividualSupervisorForm form={individual} setForm={setIndividual} users={users} saving={savingIndividual} onSubmit={saveIndividual} />}
    <section className="assignment-list"><div className="assignment-list-heading"><div><h2>Supervisores asignados</h2><p>{date} · {turnoLabel(turno)}</p></div><span className="chip"><UsersRound size={14} /> {rows.length}</span></div>{loading ? <div className="empty">Cargando...</div> : rows.length === 0 ? <div className="assignment-empty"><UsersRound size={25} /><div><strong>No hay supervisores asignados</strong><span>Importe una plantilla o agregue una asignación individual.</span></div></div> : rows.map((row) => <article className="assignment-row" key={row.id}><div className="assignment-row-main"><strong>{row.full_name}</strong><span>{row.role === 'coordinator' ? 'Coordinador' : 'Supervisor'}{row.puesto ? ` · ${row.puesto}` : ''}</span></div><div className="assignment-row-detail"><strong>{row.funcion_1 || 'Sin función asignada'}</strong><span>{[row.zona_1, row.nave].filter(Boolean).join(' · ') || 'Sin zona o nave'}</span></div><button type="button" className="icon-action danger" disabled={deletingId === row.id} onClick={() => removeAssignment(row)} aria-label={`Eliminar asignación de ${row.full_name}`} title="Eliminar asignación"><Trash2 size={16} /></button></article>)}</section>
  </main></>
}

function IndividualSupervisorForm({ form, setForm, users, saving, onSubmit }) {
  const selected = users.find((user) => String(user.id) === String(form.user_id))
  const update = (field, value) => setForm({ ...form, [field]: value })
  function choose(userId) { const user = users.find((item) => String(item.id) === String(userId)); setForm({ ...form, user_id: userId, puesto: user?.puesto || '' }) }
  return <form className="card" onSubmit={onSubmit}><h3>Asignar supervisor individualmente</h3><p className="muted assignment-copy">Incluye supervisores y coordinadores activos para el turno seleccionado.</p><label>Supervisor o coordinador</label><SearchablePicker items={users} value={form.user_id} onSelect={choose} labelOf={(user) => user.full_name} searchOf={(user) => `${user.employee_number} ${user.full_name}`} placeholder="Escriba nombre o número de empleado" />{selected && <div className="radio-form-grid assignment-person-data"><div><label>N° empleado</label><input className="input" readOnly value={selected.employee_number || ''} /></div><div><label>Cargo</label><input className="input" readOnly value={selected.puesto || ''} /></div></div>}<AssignmentFields form={form} update={update} hidePuesto /><button className="btn individual-assignment-submit" disabled={saving}>{saving ? 'Guardando...' : 'Agregar al turno'}</button></form>
}
