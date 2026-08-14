import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarDays, Download, Search, Trash2, Upload, UserPlus, UsersRound } from 'lucide-react'
import { api } from '../api.js'
import { useShift } from '../shift.jsx'
import TopBar from '../components/TopBar.jsx'
import { T, turnoText, useLang } from '../i18n.js'

const today = () => new Date().toISOString().slice(0, 10)
const EMPTY = { person_key: '', funcion_1: '', funcion_2: '', zona_1: '', puesto: '', nave: '', nave_2: '' }
const personKey = (type, id) => `${type}:${id}`
const roleLabel = (person) => person.person_type === 'coordinator' ? 'Coordinador' : person.person_type === 'supervisor' ? 'Supervisor' : ''

export default function Asignaciones() {
  const { shift } = useShift(); const [lang] = useLang(); const t = T[lang]
  const [date, setDate] = useState(shift?.date || today()); const [turno, setTurno] = useState(shift?.turno || 'dia')
  const [assignments, setAssignments] = useState([]); const [people, setPeople] = useState([]); const [cargo, setCargo] = useState(''); const [search, setSearch] = useState(''); const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false); const [downloading, setDownloading] = useState(false); const [deleting, setDeleting] = useState(false); const [error, setError] = useState(''); const [message, setMessage] = useState('')
  const [showIndividual, setShowIndividual] = useState(false); const [individual, setIndividual] = useState(EMPTY); const [saving, setSaving] = useState(false)
  const fileRef = useRef(null)

  async function load() {
    setLoading(true); setError('')
    try {
      const [opmData, supervisorData] = await Promise.all([api.assignments(date, turno), api.supervisorAssignments(date, turno)])
      setAssignments([
        ...(opmData.assignments || []).map((row) => ({ ...row, person_type: 'opm', person_id: row.opm_id, full_name: row.opm_name, code: row.opm_code })),
        ...(supervisorData.assignments || []).map((row) => ({ ...row, person_type: row.role, person_id: row.user_id, full_name: row.full_name, code: row.employee_number || '' })),
      ].sort((a, b) => a.full_name.localeCompare(b.full_name)))
    } catch (err) { setError(err.message) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [date, turno])
  useEffect(() => {
    Promise.all([api.opms(), api.users()]).then(([opmData, usersData]) => setPeople([
      ...(opmData.opms || []).filter((person) => person.active).map((person) => ({ ...person, person_type: 'opm', person_key: personKey('opm', person.id), code: person.code })),
      ...(usersData.users || []).filter((person) => person.active && ['supervisor', 'coordinator'].includes(person.role)).map((person) => ({ ...person, person_type: person.role, person_key: personKey(person.role, person.id), code: person.employee_number })),
    ])).catch(() => {})
  }, [])

  const peopleByKey = useMemo(() => new Map(people.map((person) => [person.person_key, person])), [people])
  const cargos = useMemo(() => [...new Set(people.map((person) => person.puesto?.trim() || roleLabel(person)).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [people])
  const filteredAssignments = useMemo(() => assignments.filter((assignment) => {
    const catalogPerson = peopleByKey.get(personKey(assignment.person_type, assignment.person_id))
    const assignmentCargo = catalogPerson?.puesto?.trim() || assignment.puesto || roleLabel(assignment)
    const text = `${assignment.full_name} ${assignment.code || ''} ${assignmentCargo}`.toLowerCase()
    return (!cargo || assignmentCargo === cargo) && text.includes(search.toLowerCase())
  }), [assignments, cargo, search, peopleByKey])

  async function importFile(event) {
    const file = event.target.files?.[0]; event.target.value = ''
    if (!file) return
    setImporting(true); setError(''); setMessage('')
    try {
      const result = await api.importAssignments(file, turno, date)
      const omitted = result.errors?.length ? ` Se omitieron ${result.errors.length} filas.` : ''
      setMessage(`Se importaron ${result.imported} asignaciones.${omitted}`); await load()
    } catch (err) { setError(err.message) } finally { setImporting(false) }
  }
  async function downloadTemplate() {
    setDownloading(true); setError('')
    try { await api.downloadAssignmentsTemplate() } catch (err) { setError(err.message) } finally { setDownloading(false) }
  }
  async function deleteShiftAssignments() {
    const total = assignments.length
    if (!total || !window.confirm(`¿Eliminar las ${total} asignaciones del ${date} para el turno ${turnoText(turno, lang)}? Esta acción no se puede deshacer.`)) return
    setDeleting(true); setError(''); setMessage('')
    try {
      const result = await api.deleteShiftAssignments(date, turno)
      setMessage(`Se eliminaron ${result.deleted} asignaciones del turno.`); await load()
    } catch (err) { setError(err.message) } finally { setDeleting(false) }
  }
  async function saveIndividual(event) {
    event.preventDefault(); const person = people.find((item) => item.person_key === individual.person_key); if (!person) return
    setSaving(true); setError(''); setMessage('')
    try {
      const payload = { ...individual, date, turno, puesto: individual.puesto || person.puesto || '' }
      person.person_type === 'opm' ? await api.createAssignmentIndividual({ ...payload, opm_id: person.id }) : await api.createSupervisorAssignmentIndividual({ ...payload, user_id: person.id })
      setMessage('Asignación registrada correctamente.'); setIndividual(EMPTY); setShowIndividual(false); await load()
    } catch (err) { setError(err.message) } finally { setSaving(false) }
  }

  return <><TopBar title={t.asignacionesTitulo} to="/admin" /><main className="content assignment-page">
    {error && <div className="error" role="alert">{error}</div>}{message && <div className="success">{message}</div>}
    <section className="card assignment-setup"><h3>{t.cargarAsignaciones}</h3><p className="muted assignment-copy">Importe una sola plantilla con colaboradores, supervisores y coordinadores. Solo se actualizan las personas incluidas.</p>
      <div className="assignment-controls"><div><label>Fecha</label><input className="input" type="date" value={date} onChange={(event) => setDate(event.target.value)} /></div><div><label>Turno de trabajo</label><select className="input" value={turno} onChange={(event) => setTurno(event.target.value)}><option value="dia">{t.turnoDia}</option><option value="noche">{t.turnoNoche}</option></select></div><div><label htmlFor="assignment-cargo">Filtrar cargo</label><select id="assignment-cargo" className="input" value={cargo} onChange={(event) => setCargo(event.target.value)}><option value="">Todos los cargos</option>{cargos.map((item) => <option key={item} value={item}>{item}</option>)}</select></div></div>
      <div className="row assignment-actions"><button className="btn" disabled={importing} onClick={() => fileRef.current?.click()}><Upload size={16} /> {importing ? 'Importando...' : 'Importar Excel'}</button><button className="btn secondary" onClick={() => setShowIndividual((value) => !value)}><UserPlus size={16} /> {showIndividual ? 'Ocultar registro' : 'Registro individual'}</button><button className="btn secondary" disabled={downloading} onClick={downloadTemplate}><Download size={16} /> {downloading ? 'Descargando...' : 'Exportar plantilla'}</button><button className="btn danger" disabled={deleting || !assignments.length} onClick={deleteShiftAssignments}><Trash2 size={16} /> {deleting ? 'Eliminando...' : 'Eliminar asignaciones'}</button></div><input ref={fileRef} type="file" accept=".xlsx" hidden onChange={importFile} />
    </section>
    {showIndividual && <IndividualForm form={individual} setForm={setIndividual} people={people} saving={saving} onSubmit={saveIndividual} />}
    <section className="assignment-list assignment-results"><div className="assignment-list-heading"><div><h2>{cargo ? `Asignaciones: ${cargo}` : 'Personal asignado'}</h2><p>{date} · {turnoText(turno, lang)}</p></div><span className="chip"><UsersRound size={14} /> {filteredAssignments.length}</span></div><label className="assignment-search"><Search size={16} /><input className="input" placeholder="Buscar por nombre o cargo" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
      {loading ? <div className="empty">{t.cargando}</div> : filteredAssignments.length === 0 ? <div className="assignment-empty"><CalendarDays size={25} /><div><strong>No hay asignaciones</strong><span>Importe una plantilla o registre una asignación individual.</span></div></div> : <div className="assignment-results-list">{filteredAssignments.map((row) => <article className="assignment-row" key={`${row.person_type}:${row.id}`}><div className="assignment-row-main"><strong>{row.full_name}</strong><span>{row.code ? `${row.code} · ` : ''}{peopleByKey.get(personKey(row.person_type, row.person_id))?.puesto || row.puesto || roleLabel(row)}</span></div><div className="assignment-row-detail"><strong>{row.funcion_1 || t.sinFuncion}</strong><span>{[row.zona_1, row.nave].filter(Boolean).join(' · ') || 'Sin zona o nave'}</span></div></article>)}</div>}
    </section>
  </main></>
}

function IndividualForm({ form, setForm, people, saving, onSubmit }) {
  const selected = people.find((item) => item.person_key === form.person_key)
  const update = (field, value) => setForm({ ...form, [field]: value })
  function choose(personKeyValue) { const person = people.find((item) => item.person_key === personKeyValue); setForm({ ...form, person_key: personKeyValue, puesto: person?.puesto || '' }) }
  return <form className="card" onSubmit={onSubmit}><h3>Asignar personal individualmente</h3><p className="muted assignment-copy">Busque cualquier colaborador, supervisor o coordinador activo.</p><label>Colaborador</label><SearchablePicker items={people} value={form.person_key} onSelect={choose} labelOf={(person) => `${person.full_name} · ${person.puesto || roleLabel(person)}`} searchOf={(person) => `${person.code || ''} ${person.full_name} ${person.puesto || ''} ${roleLabel(person)}`} placeholder="Escriba código, nombre o cargo" />{selected && <div className="radio-form-grid assignment-person-data"><div><label>Código</label><input className="input" readOnly value={selected.code || ''} /></div><div><label>Cargo</label><input className="input" readOnly value={selected.puesto || roleLabel(selected)} /></div></div>}<AssignmentFields form={form} update={update} hidePuesto /><button className="btn individual-assignment-submit" disabled={saving || !selected}>{saving ? 'Guardando...' : 'Agregar al turno'}</button></form>
}

export function SearchablePicker({ items, value, onSelect, labelOf, searchOf, placeholder, statusOf }) { const [query, setQuery] = useState(''); const [open, setOpen] = useState(false); const selected = items.find((item) => String(item.person_key || item.id) === String(value)); const text = open ? query : (selected ? labelOf(selected) : query); const matches = query.trim() ? items.filter((item) => searchOf(item).toLowerCase().includes(query.trim().toLowerCase())).slice(0, 30) : []; function select(item) { onSelect(item.person_key || item.id); setQuery(labelOf(item)); setOpen(false) } return <div className="search-picker"><div className="search-picker-input"><Search size={16} /><input className="input" value={text} onFocus={() => { setQuery(selected ? labelOf(selected) : query); setOpen(true) }} onChange={(event) => { setQuery(event.target.value); onSelect(''); setOpen(true) }} onBlur={() => setTimeout(() => setOpen(false), 120)} placeholder={placeholder} autoComplete="off" /></div>{open && <div className="search-picker-menu">{!query.trim() ? <div className="search-picker-empty">Escriba para buscar.</div> : matches.length ? matches.map((item) => <button type="button" className="search-picker-option" key={item.person_key || item.id} onMouseDown={(event) => { event.preventDefault(); select(item) }}><span>{labelOf(item)}</span>{statusOf?.(item) && <span className="search-picker-option-status">{statusOf(item)}</span>}</button>) : <div className="search-picker-empty">No se encontraron coincidencias.</div>}</div>}</div> }
export function AssignmentFields({ form, update, hidePuesto = false }) { return <div className="radio-form-grid"><div><label>Función 1</label><input className="input" value={form.funcion_1} onChange={(event) => update('funcion_1', event.target.value)} /></div><div><label>Función 2</label><input className="input" value={form.funcion_2} onChange={(event) => update('funcion_2', event.target.value)} /></div><div><label>Zona 1</label><input className="input" value={form.zona_1} onChange={(event) => update('zona_1', event.target.value)} /></div>{!hidePuesto && <div><label>Puesto</label><input className="input" value={form.puesto} onChange={(event) => update('puesto', event.target.value)} /></div>}<div><label>Nave</label><input className="input" value={form.nave} onChange={(event) => update('nave', event.target.value)} /></div><div><label>Nave 2</label><input className="input" value={form.nave_2} onChange={(event) => update('nave_2', event.target.value)} /></div></div> }
