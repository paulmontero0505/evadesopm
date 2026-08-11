import { useEffect, useMemo, useState } from 'react'
import { Camera, FileText, MapPin, Minus, Pencil, Plus, Printer, Radio, Search, Ship, Trash2, Undo2, UsersRound } from 'lucide-react'
import { api, SITE_BASE } from '../api.js'
import { useAuth } from '../auth.jsx'
import { useShift } from '../shift.jsx'
import TopBar from '../components/TopBar.jsx'
import Toast from '../components/Toast.jsx'
import { SearchablePicker } from './Asignaciones.jsx'
import SearchSelect from '../components/SearchSelect.jsx'

const CONDITIONS = ['Excelente Estado', 'Pantalla Rota', 'Botones Dañados']
const LOCATIONS = ['TOOLROOM', 'MUELLE 01', 'MUELLE 02', 'MUELLE 03', 'MUELLE 04', 'PATIO ZOP', 'GATE CI', 'MINERALES', 'DESCONSOLIDADO', 'BALANZA 01', 'BALANZA 02']
const turnoLabel = (turno) => turno === 'noche' ? 'Noche · 19:00 – 07:00' : 'Día · 07:00 – 19:00'
const addDays = (dateStr, days) => { const d = new Date(dateStr + 'T00:00:00'); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10) }
const EMPTY = { supervisor_id: '', nave: '', comments: '' }

export default function ControlRadios() {
  const { shift } = useShift()
  const { user } = useAuth()
  const [data, setData] = useState({ radios: [], opms: [], puestos: [], supervisors: [], records: [], locations: [] })
  const [module, setModule] = useState(null)
  const [showDeliveryForm, setShowDeliveryForm] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [locationChoice, setLocationChoice] = useState('TOOLROOM')
  const [customLocation, setCustomLocation] = useState('')
  const [radioIds, setRadioIds] = useState([])
  const [radioStatuses, setRadioStatuses] = useState({})
  const [puestoCounts, setPuestoCounts] = useState({})
  const [photo, setPhoto] = useState(null)
  const [editingGroup, setEditingGroup] = useState(null)
  const [returnSupervisor, setReturnSupervisor] = useState('')
  const [returnComments, setReturnComments] = useState('')
  const [returnPhoto, setReturnPhoto] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [returning, setReturning] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [reportPeriod, setReportPeriod] = useState('turno')
  const [reportRecords, setReportRecords] = useState([])
  const [reportLoading, setReportLoading] = useState(false)

  async function load() {
    setLoading(true); setError('')
    try { setData(await api.radioContext(shift.date, shift.turno)) } catch (err) { setError(err.message) } finally { setLoading(false) }
  }
  useEffect(() => { if (module) load() }, [shift.date, shift.turno, module])
  useEffect(() => {
    setRadioStatuses((current) => Object.fromEntries(radioIds.map((id) => [id, current[id] || 'Excelente Estado'])))
  }, [radioIds])
  useEffect(() => {
    if (module !== 'deliver' || reportPeriod === 'turno') return
    let cancelled = false
    setReportLoading(true)
    const [y, m] = shift.date.split('-')
    const from = reportPeriod === 'semana' ? addDays(shift.date, -6) : `${y}-${m}-01`
    api.radioReports(from, shift.date).then((res) => { if (!cancelled) setReportRecords(res.records || []) }).catch(() => { if (!cancelled) setReportRecords([]) }).finally(() => { if (!cancelled) setReportLoading(false) })
    return () => { cancelled = true }
  }, [module, reportPeriod, shift.date])

  const puestoAvailability = useMemo(() => data.opms.reduce((counts, opm) => { const puesto = opm.puesto || opm.funcion_1; if (puesto) counts[puesto] = (counts[puesto] || 0) + 1; return counts }, {}), [data.opms])
  const availablePuestos = useMemo(() => Object.keys(puestoAvailability).sort(), [puestoAvailability])
  const allPuestos = useMemo(() => [...new Set([...availablePuestos, ...(data.puestos || []), ...Object.keys(puestoCounts)])].sort(), [availablePuestos, data.puestos, puestoCounts])
  const locationOptions = useMemo(() => [...new Set([...LOCATIONS, ...(data.locations || [])].filter(Boolean))], [data.locations])
  const selectedPuestos = useMemo(() => Object.entries(puestoCounts).filter(([, count]) => Number(count) > 0), [puestoCounts])
  const totalPuestos = useMemo(() => selectedPuestos.reduce((total, [, count]) => total + Number(count), 0), [selectedPuestos])
  const puestosForAssignment = useMemo(() => selectedPuestos.flatMap(([puesto, count]) => Array.from({ length: Number(count) }, () => puesto)), [selectedPuestos])
  const selectedRadios = useMemo(() => data.radios.filter((radio) => radioIds.includes(radio.id)), [data.radios, radioIds])
  const pendingGroups = useMemo(() => Object.values(data.records.filter((record) => !record.returned_at).reduce((groups, record) => {
    const key = record.supervisor_id
    if (!groups[key]) groups[key] = { id: key, name: record.supervisor_name, count: 0 }
    groups[key].count += 1
    return groups
  }, {})), [data.records])
  const selectedReturn = pendingGroups.find((group) => String(group.id) === String(returnSupervisor))
  const canCreate = user?.role === 'admin' || user?.role === 'coordinator'

  function clearDeliveryForm() {
    setForm(EMPTY); setLocationChoice('TOOLROOM'); setCustomLocation(''); setRadioIds([]); setRadioStatuses({}); setPuestoCounts({}); setPhoto(null); setEditingGroup(null)
  }
  function addPuesto(puesto) { if (puesto) setPuestoCounts((current) => current[puesto] ? current : { ...current, [puesto]: 1 }) }
  function changePuestoCount(puesto, amount) {
    setPuestoCounts((current) => {
      const count = Number(current[puesto]) || 1
      if (amount < 0 && count === 1) return Object.fromEntries(Object.entries(current).filter(([key]) => key !== puesto))
      return { ...current, [puesto]: Math.min(puestoAvailability[puesto] || radioIds.length, radioIds.length, count + amount) }
    })
  }
  function changeRadioStatus(radioId, status) { setRadioStatuses((current) => ({ ...current, [radioId]: status })) }
  function locationValue() { return locationChoice === 'OTROS' ? customLocation.trim() : locationChoice }

  async function submit(event) {
    event.preventDefault(); setSaving(true); setError(''); setMessage('')
    const location = locationValue()
    if (!location) { setSaving(false); setError('Escriba la ubicación cuando seleccione OTROS.'); return }
    const payload = { ...form, location, work_date: shift.date, turno: shift.turno, radio_ids: radioIds, puestos: puestosForAssignment, condition_statuses: radioStatuses }
    try {
      const result = editingGroup
        ? await api.updateRadioAssignmentGroup({ ...payload, group_id: editingGroup.key }, photo)
        : await api.createRadioAssignment(payload, photo)
      setMessage(editingGroup ? `Se actualizó la entrega completa de ${result.updated} radios.` : `Se registraron ${result.assigned} radios entregados.`)
      clearDeliveryForm()
      await load()
    } catch (err) { setError(err.message) } finally { setSaving(false) }
  }
  async function submitReturn(event) {
    event.preventDefault(); setReturning(true); setError(''); setMessage('')
    try {
      const result = await api.returnRadioAssignments({ supervisor_id: returnSupervisor, work_date: shift.date, turno: shift.turno, comments: returnComments }, returnPhoto)
      setMessage(`Se registró la devolución de ${result.returned} radios.`)
      setReturnSupervisor(''); setReturnComments(''); setReturnPhoto(null); await load()
    } catch (err) { setError(err.message) } finally { setReturning(false) }
  }
  function startEditGroup(group) {
    const { first, records } = group
    const isKnownLocation = locationOptions.includes(first.location)
    const counts = records.reduce((current, record) => ({ ...current, [record.assigned_puesto]: (current[record.assigned_puesto] || 0) + 1 }), {})
    setEditingGroup(group)
    setForm({ supervisor_id: String(first.supervisor_id), nave: first.nave || '', comments: first.comments || '' })
    setLocationChoice(isKnownLocation ? first.location : 'OTROS')
    setCustomLocation(isKnownLocation ? '' : first.location || '')
    setRadioIds(records.map((record) => record.radio_id))
    setRadioStatuses(Object.fromEntries(records.map((record) => [record.radio_id, record.condition_status])))
    setPuestoCounts(counts)
    setPhoto(null); setError(''); setMessage('')
    setShowDeliveryForm(true); window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  async function deleteRecord(record) {
    if (!window.confirm(`¿Eliminar la entrega del radio ${record.radio_code}?`)) return
    setDeletingId(record.id); setError(''); setMessage('')
    try { await api.deleteRadioAssignment(record.id); setMessage(`Se eliminó la entrega del radio ${record.radio_code}.`); await load() } catch (err) { setError(err.message) } finally { setDeletingId(null) }
  }
  async function deleteDelivery(records) {
    const total = records.length
    if (!window.confirm(`¿Eliminar esta entrega completa y sus ${total} radio${total === 1 ? '' : 's'}?`)) return
    setDeletingId(records[0].id); setError(''); setMessage('')
    try { await Promise.all(records.map((record) => api.deleteRadioAssignment(record.id))); setMessage(`Se eliminó la entrega y sus ${total} radio${total === 1 ? '' : 's'}.`); await load() } catch (err) { setError(err.message) } finally { setDeletingId(null) }
  }
  function canManageRecord() { return user?.role === 'admin' || user?.role === 'coordinator' }

  return <><TopBar title="Trazabilidad de equipos / radios" to="/" onBack={module ? () => { setModule(null); setError(''); setMessage('') } : undefined} /><main className="content">
    {error && <div className="error" role="alert">{error}</div>}
    {message && <div className="success">{message}</div>}
    {!module && <nav className="radio-module-cards" aria-label="Módulos de trazabilidad">{canCreate && <button className="radio-module-card" onClick={() => setModule('deliver')}><span className="radio-module-icon delivery"><Radio size={22} /></span><span><strong>Registrar entrega de radios</strong><small>Crear y consultar entregas del turno</small></span></button>}<button className="radio-module-card" onClick={() => setModule('relief')}><span className="radio-module-icon relief"><Undo2 size={22} /></span><span><strong>Relevo / entrega de radios</strong><small>Asignar personal y registrar devolución</small></span></button><button className="radio-module-card" onClick={() => setModule('report')}><span className="radio-module-icon report"><FileText size={22} /></span><span><strong>Reporte diario de trazabilidad</strong><small>Estado final de cada radio: entregas, devoluciones y reasignaciones</small></span></button></nav>}
    {canCreate && module === 'deliver' && <button className="btn secondary radio-form-toggle" type="button" onClick={() => setShowDeliveryForm((value) => !value)}>{showDeliveryForm ? 'Ocultar registro de entrega' : 'Mostrar registro de entrega'}</button>}
    {canCreate && module === 'deliver' && showDeliveryForm && <section className="card"><div className="assignment-list-heading"><div><h3>{editingGroup ? `Editar entrega: ${radioIds.length} radios` : 'Registrar entrega de radios'}</h3><p className="muted">{shift.date} · {turnoLabel(shift.turno)}</p></div><span className="chip"><Radio size={14} /> {radioIds.length}</span></div>
      {loading ? <div className="empty">Cargando radios y cuadrilla del turno…</div> : <form onSubmit={submit}>
        <div className="radio-form-grid">
          <div><label>Responsable de la entrega</label><SearchSelect value={form.supervisor_id} onChange={(supervisor_id) => setForm({ ...form, supervisor_id })} options={data.supervisors.map((item) => ({ value: String(item.user_id), label: `${item.full_name} · ${item.role === 'coordinator' ? 'Coordinador' : 'Supervisor'} · ${Number(item.in_turn) ? 'En turno' : 'No está en turno'}` }))} placeholder="Seleccione responsable" emptyLabel="Seleccione responsable" /><span className="field-help">Puede seleccionar supervisores y coordinadores aunque no estén asignados a este turno.</span></div>
          <div><label><MapPin size={14} /> Ubicación</label><select className="input" value={locationChoice} onChange={(event) => { setLocationChoice(event.target.value); if (event.target.value !== 'OTROS') setCustomLocation('') }}><option value="">Seleccione ubicación</option>{locationOptions.map((location) => <option key={location}>{location}</option>)}<option value="OTROS">OTROS</option></select></div>
          {locationChoice === 'OTROS' && <div><label>Nueva ubicación</label><input className="input" required value={customLocation} maxLength="150" onChange={(event) => setCustomLocation(event.target.value)} placeholder="Ej.: Taller de mantenimiento" /><span className="field-help">Quedará disponible para elegirla en próximas entregas.</span></div>}
          <div><label><Ship size={14} /> Nave (opcional)</label><input className="input" value={form.nave} onChange={(event) => setForm({ ...form, nave: event.target.value })} placeholder="Ej.: Nave 2" /></div>
        </div>
        <Picker title="Radios a entregar" description={editingGroup ? 'Puede buscar radios disponibles para agregarlos o quitar radios de esta entrega.' : 'Escriba para buscar radios y agréguelos a la entrega.'} count={radioIds.length}>
          <RadioMultiPicker radios={data.radios} selectedIds={radioIds} onChange={setRadioIds} />
          {selectedRadios.length > 0 && <div className="radio-state-list">{selectedRadios.map((radio) => <div className="radio-state-row" key={radio.id}><div><strong>{radio.code}</strong><span>IMEI: {radio.imei} · {radio.model}</span></div><label><span>Estado</span><select className="input" value={radioStatuses[radio.id] || 'Excelente Estado'} onChange={(event) => changeRadioStatus(radio.id, event.target.value)}>{CONDITIONS.map((condition) => <option key={condition}>{condition}</option>)}</select></label></div>)}</div>}
        </Picker>
        <Picker title="Puestos que recibirán radios" description="Busque y seleccione puestos registrados. Use − / + para indicar cuántas radios recibirá cada puesto." count={totalPuestos}>
          <div className="puesto-search"><SearchSelect value="" onChange={addPuesto} options={allPuestos.filter((puesto) => !puestoCounts[puesto]).map((puesto) => ({ value: puesto, label: puesto }))} placeholder="Buscar y seleccionar puesto" emptyLabel="Buscar y seleccionar puesto" /></div>
          {selectedPuestos.length ? <div className="radio-pick-list">{selectedPuestos.map(([puesto]) => { const atRadioLimit = totalPuestos >= radioIds.length; const atPuestoLimit = Number(puestoCounts[puesto]) >= (puestoAvailability[puesto] || radioIds.length); const isInTurn = Boolean(puestoAvailability[puesto]); return <div className="radio-pick radio-pick-quantity" key={puesto}><div><strong>{puesto}</strong><small>{isInTurn ? `${puestoAvailability[puesto]} colaborador${puestoAvailability[puesto] === 1 ? '' : 'es'} asignado${puestoAvailability[puesto] === 1 ? '' : 's'} a este turno` : 'Puesto registrado en colaboradores'}</small></div><div className="quantity-stepper" aria-label={`Cantidad de radios para ${puesto}`}><button type="button" onClick={() => changePuestoCount(puesto, -1)} aria-label={`Disminuir radios para ${puesto}`}><Minus size={15} /></button><output>{puestoCounts[puesto]}</output><button type="button" disabled={atRadioLimit || atPuestoLimit} onClick={() => changePuestoCount(puesto, 1)} aria-label={`Aumentar radios para ${puesto}`}><Plus size={15} /></button></div></div> })}</div> : <div className="search-picker-empty puesto-empty">Busque un puesto registrado para agregarlo a la entrega.</div>}
        </Picker>
        <div className="radio-final-fields"><label>Comentarios adicionales</label><textarea className="input radio-textarea" maxLength="1000" value={form.comments} onChange={(event) => setForm({ ...form, comments: event.target.value })} placeholder="Detalle de la entrega, incidencia o indicación adicional" /><label><Camera size={14} /> Foto de entrega (opcional)</label><input className="input" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setPhoto(event.target.files?.[0] || null)} />{photo && <span className="file-note">{photo.name}</span>}</div>
        {radioIds.length !== totalPuestos && <div className="warn-box">Seleccione la misma cantidad de radios que el total asignado entre los puestos.</div>}
        <div className="radio-form-actions">{editingGroup && <button className="btn secondary" type="button" onClick={clearDeliveryForm}>Cancelar edición</button>}<button className="btn" disabled={saving || !radioIds.length || radioIds.length !== totalPuestos || !form.supervisor_id}>{saving ? 'Guardando…' : editingGroup ? `Guardar entrega de ${radioIds.length} radios` : `Entregar ${radioIds.length} radio${radioIds.length === 1 ? '' : 's'}`}</button></div>
      </form>}
    </section>}
    {module === 'relief' && <FlexibleGroupedReliefPanel records={data.relief_records || []} allRecords={data.records} allOpms={data.all_opms || []} puestos={data.puestos || []} user={user} nextSupervisors={data.next_supervisors || []} nextShift={data.next_shift} onReload={load} />}
    {module === 'report' && <DailyRadioReport date={shift.date} turno={shift.turno} />}
    {module === 'deliver' && <DeliveryReports records={reportPeriod === 'turno' ? data.records : reportRecords} loading={reportPeriod === 'turno' ? loading : reportLoading} date={shift.date} turno={shift.turno} period={reportPeriod} onPeriodChange={setReportPeriod} canManage={canManageRecord} onEdit={startEditGroup} onDelete={deleteDelivery} deletingId={deletingId} />}
  </main></>
}

function Picker({ title, description, count, children }) { return <div className="radio-picker"><div className="assignment-list-heading"><div><h3>{title}</h3><p className="muted">{description}</p></div><span className="chip"><UsersRound size={14} /> {count}</span></div>{children}</div> }

function RadioMultiPicker({ radios, selectedIds, onChange }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const selected = radios.filter((radio) => selectedIds.includes(radio.id))
  const matches = query.trim() ? radios.filter((radio) => Number(radio.available) && !selectedIds.includes(radio.id) && `${radio.code} ${radio.imei} ${radio.model}`.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 20) : []
  function addRadio(id) { onChange([...selectedIds, id]); setQuery(''); setOpen(false) }
  function removeRadio(id) { onChange(selectedIds.filter((selectedId) => selectedId !== id)) }
  return <div className="radio-multi-picker"><div className="radio-multi-control">{selected.map((radio) => <span className="radio-token" key={radio.id}>{radio.code}<button type="button" aria-label={`Quitar radio ${radio.code}`} onClick={() => removeRadio(radio.id)}>×</button></span>)}<div className="radio-multi-input"><Search size={16} /><input value={query} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 120)} onKeyDown={(event) => { if (event.key === 'Escape') setOpen(false) }} onChange={(event) => { setQuery(event.target.value); setOpen(true) }} placeholder={selected.length ? 'Buscar y agregar otro radio…' : 'Buscar y agregar radios…'} aria-label="Buscar radio" /></div></div>{open && <div className="radio-multi-menu">{!query.trim() ? <div className="search-picker-empty">Escriba un código, IMEI o modelo para buscar.</div> : matches.length ? matches.map((radio) => <button type="button" key={radio.id} onMouseDown={(event) => event.preventDefault()} onClick={() => addRadio(radio.id)}><strong>{radio.code}</strong><span>IMEI: {radio.imei} · {radio.model}</span></button>) : <div className="search-picker-empty">No se encontraron radios disponibles.</div>}</div>}</div>
}

function DeliveryReports({ records, loading, date, turno, period, onPeriodChange, canManage, onEdit, onDelete, deletingId }) {
  const [printGroup, setPrintGroup] = useState('')
  const groups = useMemo(() => Object.values(records.reduce((all, record) => { const key = record.group_id; if (!all[key]) all[key] = { key, records: [], first: record }; all[key].records.push(record); return all }, {})), [records])
  function printReport(key) { setPrintGroup(key); setTimeout(() => window.print(), 0) }
  return <section className="assignment-list"><div className="report-period-filter no-print"><button type="button" className={`period-btn ${period === 'turno' ? 'active' : ''}`} onClick={() => onPeriodChange('turno')}>Turno</button><button type="button" className={`period-btn ${period === 'semana' ? 'active' : ''}`} onClick={() => onPeriodChange('semana')}>Semana</button><button type="button" className={`period-btn ${period === 'mes' ? 'active' : ''}`} onClick={() => onPeriodChange('mes')}>Mes</button></div><div className="assignment-list-heading no-print"><div><h2>{period === 'turno' ? 'Entregas registradas en este turno' : period === 'semana' ? 'Entregas registradas · Semana' : 'Entregas registradas · Mes'}</h2><p>{period === 'turno' ? `${date} · ${turnoLabel(turno)}` : period === 'semana' ? `Últimos 7 días: ${addDays(date, -6)} al ${date}` : `Desde ${date.slice(0, 7)}-01 hasta ${date}`}</p></div><span className="chip"><Radio size={14} /> {groups.length}</span></div>{loading ? null : groups.length ? groups.map((group) => { const { first, records: radios } = group; return <article className={`delivery-report ${printGroup === group.key ? 'print-selected' : ''}`} key={group.key}><div className="radio-record-head"><div><strong>Entrega a {first.supervisor_name}</strong><span>{radios.length} radio{radios.length === 1 ? '' : 's'} asignado{radios.length === 1 ? '' : 's'} · {first.location || 'TOOLROOM'}{first.nave ? ` · ${first.nave}` : ''}</span></div><div className="delivery-report-actions no-print"><button type="button" className="icon-action" onClick={() => printReport(group.key)} aria-label="Imprimir reporte"><Printer size={15} /></button>{canManage(first) && <><button type="button" className="icon-action" onClick={() => onEdit(group)} aria-label="Editar entrega"><Pencil size={15} /></button><button type="button" className="icon-action danger" disabled={deletingId === first.id} onClick={() => onDelete(radios)} aria-label="Eliminar entrega"><Trash2 size={15} /></button></>}</div></div><div className="delivery-report-meta"><span><b>Asignado por</b>{first.registered_by_name}</span><span><b>Fecha y turno</b>{first.work_date || date} · {turnoLabel(first.turno || turno)}</span>{first.comments && <span><b>Comentarios</b>{first.comments}</span>}</div>{radios.some((radio) => radio.returned_at) && <div className="delivery-report-return"><div className="delivery-report-return-title"><Undo2 size={14} /> Devolución</div><div className="delivery-report-meta"><span><b>Estado</b>{radios.filter((radio) => radio.returned_at).length === radios.length ? `Devuelto (${radios.length} radio${radios.length === 1 ? '' : 's'})` : `Parcial (${radios.filter((radio) => radio.returned_at).length} de ${radios.length} radio${radios.length === 1 ? '' : 's'})`}</span><span><b>Fecha</b>{radios.find((radio) => radio.returned_at)?.returned_at}</span><span><b>Devuelto por</b>{radios.find((radio) => radio.returned_at)?.returned_by_name || first.returned_by_name || '—'}</span>{radios.find((radio) => radio.returned_at)?.return_comments && <span><b>Comentarios</b>{radios.find((radio) => radio.returned_at)?.return_comments}</span>}</div></div>}<div className="delivery-report-radios">{radios.map((radio) => <div key={radio.id}><strong>{radio.radio_code}</strong><span>{radio.model} · {radio.assigned_puesto} · {radio.condition_status}</span></div>)}</div></article> }) : <div className="assignment-empty"><Radio size={25} /><div><strong>Aún no hay entregas registradas</strong><span>Las radios agrupadas por supervisor aparecerán como un único reporte.</span></div></div>}</section>
}

function FlexibleGroupedReliefPanel({ records, allRecords, allOpms, puestos, user, nextSupervisors, nextShift, onReload }) {
  const [activeGroupKey, setActiveGroupKey] = useState('')
  const [selectedIds, setSelectedIds] = useState([])
  const [action, setAction] = useState('return')
  const [targetUserId, setTargetUserId] = useState('')
  const [comments, setComments] = useState('')
  const [savingId, setSavingId] = useState(null)
  const [moving, setMoving] = useState(false)
  const [error, setError] = useState('')
  const visible = user?.role === 'supervisor' ? records.filter((record) => Number(record.current_supervisor_id || record.supervisor_id) === Number(user.id)) : records
  const groups = useMemo(() => Object.values(visible.reduce((all, record) => {
    const key = record.group_id || `legacy-${record.id}`
    if (!all[key]) all[key] = { key, first: record, records: [] }
    all[key].records.push(record)
    return all
  }, {})), [visible])
  const activeGroup = groups.find((group) => group.key === activeGroupKey)
  const activeRecords = activeGroup?.records || []

  useEffect(() => { if (activeGroupKey && !activeGroup) setActiveGroupKey('') }, [activeGroupKey, activeGroup])
  function toggle(id) { setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]) }
  async function updateAssignment(record, payload) {
    setSavingId(record.id); setError('')
    try { await api.assignRadioCollaborator(record.id, payload.opm_id || '', payload.puesto || ''); await onReload() } catch (err) { setError(err.message) } finally { setSavingId(null) }
  }
  async function move(event) {
    event.preventDefault(); setMoving(true); setError('')
    try { await api.moveRadioAssignments({ assignment_ids: selectedIds, action, target_user_id: targetUserId, comments }); setSelectedIds([]); setComments(''); await onReload() } catch (err) { setError(err.message) } finally { setMoving(false) }
  }

  if (!activeGroup) return <><section className="radio-indicators"><div><strong>{visible.length}</strong><span>Pendientes</span></div><div><strong>{allRecords.filter((record) => record.returned_at).length}</strong><span>Devueltos</span></div><div><strong>{groups.length}</strong><span>Entregas activas</span></div></section><section className="assignment-list"><div className="assignment-list-heading"><div><h2>Mis entregas pendientes</h2><p>Abra una ubicación para asignar puestos y colaboradores.</p></div><span className="chip"><Radio size={14} /> {groups.length}</span></div>{groups.length ? <div className="relief-delivery-list">{groups.map((group) => <button type="button" className="relief-delivery-card" key={group.key} onClick={() => { setActiveGroupKey(group.key); setSelectedIds([]); setError('') }}><span className="relief-delivery-icon"><MapPin size={19} /></span><span><strong>{group.first.location || 'TOOLROOM'}</strong><small>{group.first.nave || 'Sin nave registrada'} · {group.records.length} radio{group.records.length === 1 ? '' : 's'}</small><em>Responsable: {group.first.current_supervisor_name || group.first.supervisor_name}</em></span><Radio size={18} /></button>)}</div> : <div className="assignment-empty"><Radio size={25} /><div><strong>No tiene entregas pendientes</strong><span>Las entregas activas aparecerán agrupadas por ubicación.</span></div></div>}</section></>

  return <><button type="button" className="btn secondary relief-back" onClick={() => { setActiveGroupKey(''); setSelectedIds([]); setError('') }}><Undo2 size={16} /> Ver todas las entregas</button><section className="assignment-list"><div className="assignment-list-heading"><div><h2>{activeGroup.first.location || 'TOOLROOM'}{activeGroup.first.nave ? ` · ${activeGroup.first.nave}` : ''}</h2><p>{activeRecords.length} radios asignadas · Responsable: {activeGroup.first.current_supervisor_name || activeGroup.first.supervisor_name}</p></div><span className="chip"><Radio size={14} /> {activeRecords.length}</span></div>{error && <div className="error" role="alert">{error}</div>}{activeRecords.map((record) => {
    const puestoOptions = [...new Set([record.assigned_puesto, ...puestos].filter(Boolean))].sort().map((puesto) => ({ value: puesto, label: puesto }))
    const candidates = allOpms.filter((opm) => opm.puesto === record.assigned_puesto).map((opm) => ({ ...opm, id: opm.opm_id }))
    return <article className="radio-record relief-record" key={record.id}><div className="radio-record-head"><label className="radio-select"><input type="checkbox" checked={selectedIds.includes(record.id)} onChange={() => toggle(record.id)} /><span><strong>{record.radio_code}</strong><small>{record.model} · IMEI {record.imei}</small></span></label><span className="radio-status">Pendiente</span></div><div className="radio-record-grid"><div><label>Puesto</label><SearchSelect value={record.assigned_puesto || ''} onChange={(puesto) => updateAssignment(record, { puesto })} options={puestoOptions} placeholder="Buscar y seleccionar puesto" emptyLabel="Seleccione puesto" /></div><span><b>Responsable actual</b>{record.current_supervisor_name}</span></div><div className="relief-person"><label>Colaborador que recibe este radio</label><SearchablePicker items={candidates} value={record.collaborator_id || ''} onSelect={(opmId) => { if (opmId) updateAssignment(record, { opm_id: opmId }) }} labelOf={(opm) => `${opm.full_name} · ${opm.code}${Number(opm.in_turn) ? ' · En turno' : ' · Fuera de turno'}`} searchOf={(opm) => `${opm.code} ${opm.full_name} ${opm.puesto || ''}`} placeholder="Buscar por nombre o código" />{savingId === record.id ? <span className="field-help">Actualizando asignación…</span> : record.collaborator_name ? <span className="field-help">Asignado a: {record.collaborator_name}</span> : <span className="field-help">Puede buscar colaboradores en turno o fuera de turno.</span>}</div></article>
  })}</section><section className="card"><h3>Registrar movimiento de radios</h3><p className="muted assignment-copy">Devuelva o reasigne únicamente los radios seleccionados de esta ubicación.</p><form onSubmit={move}><label>Acción</label><select className="input" value={action} onChange={(event) => { setAction(event.target.value); setTargetUserId('') }}><option value="return">Registrar devolución</option><option value="reassign">Reasignar al siguiente turno</option></select><label>{action === 'return' ? 'Supervisor que recibe la devolución' : 'Responsable del siguiente turno'}</label><SearchablePicker items={nextSupervisors.map((item) => ({ ...item, id: item.user_id }))} value={targetUserId} onSelect={setTargetUserId} labelOf={(item) => `${item.full_name} · ${item.role === 'coordinator' ? 'Coordinador' : 'Supervisor'} · ${Number(item.in_turn) ? 'En turno' : 'Fuera de turno'}`} searchOf={(item) => `${item.full_name} ${item.role}`} placeholder="Buscar supervisor o coordinador" /><label>Comentarios</label><textarea className="input radio-textarea" value={comments} onChange={(event) => setComments(event.target.value)} placeholder="Opcional" /><button className="btn" disabled={moving || !selectedIds.length || (action === 'reassign' && !targetUserId)}>{moving ? 'Registrando…' : action === 'return' ? `Devolver ${selectedIds.length} radio${selectedIds.length === 1 ? '' : 's'}` : `Reasignar ${selectedIds.length} radio${selectedIds.length === 1 ? '' : 's'}`}</button></form></section></>
}

function DailyRadioReport({ date, turno }) {
  const [selDate, setSelDate] = useState(date)
  const [selTurno, setSelTurno] = useState(turno)
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [printing, setPrinting] = useState(false)

  useEffect(() => {
    document.body.classList.toggle('trace-printing', printing)
    return () => document.body.classList.remove('trace-printing')
  }, [printing])

  useEffect(() => {
    let cancelled = false
    setLoading(true); setError('')
    api.radioDailyReport(selDate, selTurno)
      .then((res) => { if (!cancelled) setRecords(res.records || []) })
      .catch((err) => { if (!cancelled) setError(err.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [selDate, selTurno])

  const stats = useMemo(() => ({
    total: records.length,
    entregado: records.filter((record) => record.movement === 'Entregado').length,
    devuelto: records.filter((record) => record.movement === 'Devuelto a Tool Room').length,
    reasignado: records.filter((record) => record.movement === 'Reasignado').length,
  }), [records])

  function printReport() { setPrinting(true); setTimeout(() => { window.print(); setPrinting(false) }, 0) }
  function fmt(value) { return value ? value.slice(0, 16) : '—' }
  function movementClass(movement) { return movement === 'Devuelto a Tool Room' ? 'return' : movement === 'Reasignado' ? 'reassign' : 'deliver' }

  return <section className="trace-report-sheet"><div className="assignment-list-heading no-print"><div><h2>Reporte diario de trazabilidad de radios</h2><p>Genere el reporte según la fecha y el turno seleccionados. Muestra el último movimiento de cada radio en el turno.</p></div></div>
    <div className="row assignment-picker no-print"><div><label>Fecha</label><input className="input" type="date" value={selDate} onChange={(event) => setSelDate(event.target.value)} /></div><div><label>Turno</label><select className="input" value={selTurno} onChange={(event) => setSelTurno(event.target.value)}><option value="dia">Día · 07:00 – 19:00</option><option value="noche">Noche · 19:00 – 07:00</option></select></div></div>
    <div className="report-actions no-print"><button className="btn" disabled={loading || !records.length} onClick={printReport}><Printer size={16} /> Imprimir reporte (PDF)</button></div>
    {error && <div className="error" role="alert">{error}</div>}
    <section className="radio-indicators no-print"><div><strong>{stats.total}</strong><span>Radios en el turno</span></div><div><strong>{stats.entregado}</strong><span>Entregados</span></div><div><strong>{stats.reasignado}</strong><span>Reasignados</span></div><div><strong>{stats.devuelto}</strong><span>Devueltos a Tool Room</span></div></section>
    <section className="trace-report"><div className="trace-report-header"><div><h2>Reporte diario de trazabilidad de radios</h2><p>{selDate} · {turnoLabel(selTurno)} · {records.length} radio{records.length === 1 ? '' : 's'}</p></div></div>
      {loading ? <div className="empty">Generando reporte…</div> : records.length ? <div className="trace-table-wrap"><table className="trace-table"><thead><tr><th>Código</th><th>Modelo / IMEI</th><th>Estado del radio</th><th>Último movimiento</th><th>Fecha y hora</th><th>Responsable anterior</th><th>Responsable actual</th><th>Ubicación final</th><th>Comentarios del movimiento</th></tr></thead><tbody>{records.map((record) => <tr key={record.id}><td><strong>{record.radio_code}</strong>{record.assigned_puesto ? <small>{record.assigned_puesto}</small> : null}</td><td><span className="trace-model">{record.model}</span><small>IMEI: {record.imei}</small></td><td><span className="trace-condition">{record.condition_status}</span></td><td><span className={`movement-badge movement-${movementClass(record.movement)}`}>{record.movement}</span></td><td>{fmt(record.movement_at)}</td><td>{record.previous_supervisor_name || 'Tool Room'}</td><td>{record.current_supervisor_name || 'Tool Room'}</td><td>{record.final_location || 'TOOLROOM'}</td><td>{record.movement_comments || <span className="muted">—</span>}</td></tr>)}</tbody></table></div> : <div className="assignment-empty"><Radio size={25} /><div><strong>No hay movimientos registrados en este turno</strong><span>Seleccione otra fecha o turno.</span></div></div>}
    </section>
  </section>
}

function GroupedReliefPanel({ records, allRecords, opms, user, nextSupervisors, nextShift, onReload }) {
  const [activeGroupKey, setActiveGroupKey] = useState('')
  const [savingId, setSavingId] = useState(null)
  const [error, setError] = useState('')
  const [selectedIds, setSelectedIds] = useState([])
  const [action, setAction] = useState('return')
  const [targetUserId, setTargetUserId] = useState('')
  const [comments, setComments] = useState('')
  const [moving, setMoving] = useState(false)
  const [toastMsg, setToastMsg] = useState('')
  const visible = user?.role === 'supervisor' ? records.filter((record) => Number(record.current_supervisor_id || record.supervisor_id) === Number(user.id)) : records
  const groups = useMemo(() => Object.values(visible.reduce((all, record) => {
    const key = record.group_id || `legacy-${record.id}`
    if (!all[key]) all[key] = { key, first: record, records: [] }
    all[key].records.push(record)
    return all
  }, {})), [visible])
  const activeGroup = groups.find((group) => group.key === activeGroupKey)
  const activeRecords = activeGroup?.records || []

  useEffect(() => { if (activeGroupKey && !activeGroup) setActiveGroupKey('') }, [activeGroupKey, activeGroup])
  function toggle(id) { setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]) }
  async function assignPerson(record, opmId) {
    setSavingId(record.id); setError('')
    try { await api.assignRadioCollaborator(record.id, opmId); await onReload(); setToastMsg('Asignado') } catch (err) { setError(err.message) } finally { setSavingId(null) }
  }
  async function move(event) {
    event.preventDefault(); setMoving(true); setError('')
    try { await api.moveRadioAssignments({ assignment_ids: selectedIds, action, target_user_id: targetUserId, comments }); setSelectedIds([]); setComments(''); await onReload() } catch (err) { setError(err.message) } finally { setMoving(false) }
  }

  if (!activeGroup) return <><section className="radio-indicators"><div><strong>{visible.length}</strong><span>Pendientes</span></div><div><strong>{allRecords.filter((record) => record.returned_at).length}</strong><span>Devueltos</span></div><div><strong>{groups.length}</strong><span>Entregas activas</span></div></section><section className="assignment-list"><div className="assignment-list-heading"><div><h2>Mis entregas pendientes</h2><p>Abra una ubicación para ver y distribuir las radios asignadas.</p></div><span className="chip"><Radio size={14} /> {groups.length}</span></div>{groups.length ? <div className="relief-delivery-list">{groups.map((group) => <button type="button" className="relief-delivery-card" key={group.key} onClick={() => { setActiveGroupKey(group.key); setSelectedIds([]); setError('') }}><span className="relief-delivery-icon"><MapPin size={19} /></span><span><strong>{group.first.location || 'TOOLROOM'}</strong><small>{group.first.nave || 'Sin nave registrada'} · {group.records.length} radio{group.records.length === 1 ? '' : 's'}</small><em>Responsable: {group.first.current_supervisor_name || group.first.supervisor_name}</em></span><Radio size={18} /></button>)}</div> : <div className="assignment-empty"><Radio size={25} /><div><strong>No tiene entregas pendientes</strong><span>Las entregas activas aparecerán agrupadas por ubicación.</span></div></div>}</section><Toast message={toastMsg} onDone={() => setToastMsg('')} /></>

  return <><button type="button" className="btn secondary relief-back" onClick={() => { setActiveGroupKey(''); setSelectedIds([]); setError('') }}><Undo2 size={16} /> Ver todas las entregas</button><section className="assignment-list"><div className="assignment-list-heading"><div><h2>{activeGroup.first.location || 'TOOLROOM'}{activeGroup.first.nave ? ` · ${activeGroup.first.nave}` : ''}</h2><p>{activeRecords.length} radios asignadas · Responsable: {activeGroup.first.current_supervisor_name || activeGroup.first.supervisor_name}</p></div><span className="chip"><Radio size={14} /> {activeRecords.length}</span></div>{error && <div className="error" role="alert">{error}</div>}{activeRecords.map((record) => {
    const usedByOthers = new Set(activeRecords.filter((item) => item.id !== record.id && item.collaborator_id).map((item) => Number(item.collaborator_id)))
    const candidates = opms.filter((opm) => (opm.puesto || opm.funcion_1) === record.assigned_puesto && (!usedByOthers.has(Number(opm.opm_id)) || Number(opm.opm_id) === Number(record.collaborator_id))).map((opm) => ({ ...opm, id: opm.opm_id }))
    return <article className="radio-record relief-record" key={record.id}><div className="radio-record-head"><label className="radio-select"><input type="checkbox" checked={selectedIds.includes(record.id)} onChange={() => toggle(record.id)} /><span><strong>{record.radio_code}</strong><small>{record.model} · IMEI {record.imei}</small></span></label><span className="radio-status">Pendiente</span></div><div className="radio-record-grid"><span><b>Puesto</b>{record.assigned_puesto}</span><span><b>Responsable actual</b>{record.current_supervisor_name}</span></div><div className="relief-person"><label>Colaborador que recibe este radio</label><SearchablePicker items={candidates} value={record.collaborator_id || ''} onSelect={(opmId) => { if (opmId) assignPerson(record, opmId) }} labelOf={(opm) => `${opm.full_name} · ${opm.code}`} searchOf={(opm) => `${opm.code} ${opm.full_name} ${opm.puesto || ''}`} placeholder="Buscar por nombre o código" />{record.collaborator_name && <span className="field-help">Asignado a: {record.collaborator_name}</span>}</div></article>
  })}</section><section className="card"><h3>Registrar movimiento de radios</h3><p className="muted assignment-copy">Devuelva o reasigne únicamente los radios seleccionados de esta ubicación.</p><form onSubmit={move}><label>Acción</label><select className="input" value={action} onChange={(event) => { setAction(event.target.value); setTargetUserId('') }}><option value="return">Registrar devolución</option><option value="reassign">Reasignar al siguiente turno</option></select>{action === 'return' && <><label>Supervisor que recibe la devolución</label><SearchablePicker items={nextSupervisors.map((item) => ({ ...item, id: item.user_id }))} value={targetUserId} onSelect={setTargetUserId} labelOf={(item) => `${item.full_name} · ${item.role === 'coordinator' ? 'Coordinador' : 'Supervisor'} · ${Number(item.in_turn) ? 'IN TURN' : 'OFF TURN'}`} searchOf={(item) => `${item.full_name} ${item.role} ${Number(item.in_turn) ? 'in turn' : 'off turn'}`} placeholder="Escriba para buscar supervisor o coordinador" /><span className="field-help">Seleccione al responsable que recibe las radios devueltas.</span></>}{action === 'reassign' && <><label>Responsable del siguiente turno</label><SearchablePicker items={nextSupervisors.map((item) => ({ ...item, id: item.user_id }))} value={targetUserId} onSelect={setTargetUserId} labelOf={(item) => `${item.full_name} · ${item.role === 'coordinator' ? 'Coordinador' : 'Supervisor'} · ${Number(item.in_turn) ? 'IN TURN' : 'OFF TURN'}`} searchOf={(item) => `${item.full_name} ${item.role} ${Number(item.in_turn) ? 'in turn' : 'off turn'}`} placeholder="Escriba para buscar supervisor o coordinador" /><span className="field-help">Siguiente turno: {nextShift?.date} · {turnoLabel(nextShift?.turno)}. Puede elegir personal IN TURN u OFF TURN.</span></>}<label>Comentarios</label><textarea className="input radio-textarea" value={comments} onChange={(event) => setComments(event.target.value)} placeholder="Opcional" /><button className="btn" disabled={moving || !selectedIds.length || !targetUserId}>{moving ? 'Guardando…' : action === 'return' ? `Devolver ${selectedIds.length} radio${selectedIds.length === 1 ? '' : 's'}` : `Reasignar ${selectedIds.length} radio${selectedIds.length === 1 ? '' : 's'}`}</button></form></section><Toast message={toastMsg} onDone={() => setToastMsg('')} /></>
}

function ReliefPanel({ records, allRecords, opms, user, nextSupervisors, nextShift, onReload }) {
  const [savingId, setSavingId] = useState(null)
  const [error, setError] = useState('')
  const [selectedIds, setSelectedIds] = useState([])
  const [action, setAction] = useState('return')
  const [targetUserId, setTargetUserId] = useState('')
  const [comments, setComments] = useState('')
  const [moving, setMoving] = useState(false)
  const [toastMsg, setToastMsg] = useState('')
  const visible = user?.role === 'supervisor' ? records.filter((record) => Number(record.current_supervisor_id || record.supervisor_id) === Number(user.id)) : records
  async function assignPerson(record, opmId) {
    setSavingId(record.id); setError('')
    try { await api.assignRadioCollaborator(record.id, opmId); await onReload(); setToastMsg('Asignado') } catch (err) { setError(err.message) } finally { setSavingId(null) }
  }
  function toggle(id) { setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]) }
  async function move(event) { event.preventDefault(); setMoving(true); setError(''); try { await api.moveRadioAssignments({ assignment_ids: selectedIds, action, target_user_id: targetUserId, comments }); setSelectedIds([]); setComments(''); await onReload() } catch (err) { setError(err.message) } finally { setMoving(false) } }
  return <><section className="radio-indicators"><div><strong>{visible.length}</strong><span>Pendientes</span></div><div><strong>{allRecords.filter((record) => record.returned_at).length}</strong><span>Devueltos</span></div><div><strong>{selectedIds.length}</strong><span>Seleccionados</span></div></section><section className="assignment-list"><div className="assignment-list-heading"><div><h2>Radios bajo responsabilidad del turno</h2><p>Asigne cada radio al colaborador correspondiente de su puesto.</p></div><span className="chip"><Radio size={14} /> {visible.length}</span></div>{error && <div className="error" role="alert">{error}</div>}{visible.length ? visible.map((record) => { const candidates = opms.filter((opm) => (opm.puesto || opm.funcion_1) === record.assigned_puesto); return <article className="radio-record relief-record" key={record.id}><div className="radio-record-head"><label className="radio-select"><input type="checkbox" checked={selectedIds.includes(record.id)} onChange={() => toggle(record.id)} /><span><strong>{record.radio_code}</strong><small>{record.model} · IMEI {record.imei}</small></span></label><span className="radio-status">Pendiente</span></div><div className="radio-record-grid"><span><b>Puesto</b>{record.assigned_puesto}</span><span><b>Responsable actual</b>{record.current_supervisor_name}</span></div><div className="relief-person"><label>Colaborador que recibe este radio</label><select className="input" value={record.collaborator_id || ''} disabled={savingId === record.id} onChange={(event) => assignPerson(record, event.target.value)}><option value="">Seleccione colaborador</option>{candidates.map((opm) => <option key={opm.opm_id} value={opm.opm_id}>{opm.full_name}</option>)}</select>{record.collaborator_name && <span className="field-help">Asignado a: {record.collaborator_name}</span>}</div></article> }) : <div className="assignment-empty"><Radio size={25} /><div><strong>No tiene radios pendientes para este turno</strong><span>Las entregas abiertas aparecerán aquí.</span></div></div>}</section>{visible.length > 0 && <section className="card"><h3>Registrar movimiento de radios</h3><p className="muted assignment-copy">Devuelva o reasigne únicamente los radios seleccionados.</p><form onSubmit={move}><label>Acción</label><select className="input" value={action} onChange={(event) => { setAction(event.target.value); setTargetUserId('') }}><option value="return">Registrar devolución</option><option value="reassign">Reasignar al siguiente turno</option></select>{action === 'return' && <><label>Supervisor que recibe la devolución</label><select className="input" required value={targetUserId} onChange={(event) => setTargetUserId(event.target.value)}><option value="">Seleccione responsable</option>{nextSupervisors.map((item) => <option key={item.user_id} value={item.user_id}>{item.full_name}</option>)}</select><span className="field-help">Seleccione al responsable que recibe las radios devueltas.</span></>}{action === 'reassign' && <><label>Responsable del siguiente turno</label><select className="input" required value={targetUserId} onChange={(event) => setTargetUserId(event.target.value)}><option value="">Seleccione responsable</option>{nextSupervisors.map((item) => <option key={item.user_id} value={item.user_id}>{item.full_name}</option>)}</select><span className="field-help">Siguiente turno: {nextShift?.date} · {turnoLabel(nextShift?.turno)}</span></>}<label>Comentarios</label><textarea className="input radio-textarea" value={comments} onChange={(event) => setComments(event.target.value)} placeholder="Opcional" /><button className="btn" disabled={moving || !selectedIds.length || !targetUserId}>{moving ? 'Guardando…' : action === 'return' ? `Devolver ${selectedIds.length} radio${selectedIds.length === 1 ? '' : 's'}` : `Reasignar ${selectedIds.length} radio${selectedIds.length === 1 ? '' : 's'}`}</button></form></section>}<Toast message={toastMsg} onDone={() => setToastMsg('')} /></>
}
