import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CakeSlice, CalendarDays, Search, UsersRound } from 'lucide-react'
import { api } from '../api.js'
import { useAuth } from '../auth.jsx'
import TopBar from '../components/TopBar.jsx'
import { useShift } from '../shift.jsx'
import { T, turnoText, useLang } from '../i18n.js'

export default function SeleccionarTurno() {
  const { user, logout } = useAuth()
  const { shift, setShift, clearShift } = useShift()
  const nav = useNavigate()
  const [lang] = useLang()
  const t = T[lang]
  const [date, setDate] = useState(shift?.date || new Date().toISOString().slice(0, 10))
  const [turno, setTurno] = useState(shift?.turno || 'dia')
  const [members, setMembers] = useState([])
  const [selected, setSelected] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [filterText, setFilterText] = useState('')
  const [puesto, setPuesto] = useState('')
  const [onlyInTurn, setOnlyInTurn] = useState(false)
  const [onlyBirthday, setOnlyBirthday] = useState(false)

  useEffect(() => {
    let active = true
    setLoading(true); setError(''); setFilterText(''); setPuesto(''); setOnlyInTurn(false); setOnlyBirthday(false)
    api.shiftTeam(date, turno).then((data) => {
      if (!active) return
      const roster = (data.members || []).map((member) => ({ ...member, in_turn: Number(member.in_turn) === 1, worked_previous_turn: Number(member.worked_previous_turn) === 1 }))
      setMembers(roster)
      setSelected(new Set(roster.filter((member) => member.in_turn && !member.worked_previous_turn).map((member) => `${member.person_type}:${member.person_id}`)))
    }).catch((err) => { if (active) { setMembers([]); setError(err.message) } }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [date, turno])

  const isAdmin = user?.role === 'admin'
  const puestos = useMemo(() => [...new Set(members.map((member) => member.puesto || roleLabel(member)).filter(Boolean))].sort(), [members])
  const filtered = useMemo(() => members.filter((member) => {
    const memberPuesto = member.puesto || roleLabel(member)
    const text = `${member.full_name} ${member.code || ''} ${memberPuesto} ${member.funcion_1 || ''} ${member.zona_1 || ''}`.toLowerCase()
    return (!puesto || memberPuesto === puesto) && (!onlyInTurn || member.in_turn) && (!onlyBirthday || isBirthday(member.fecha_nacimiento, date)) && text.includes(filterText.toLowerCase())
  }), [members, puesto, filterText, onlyInTurn, onlyBirthday, date])
  const selectable = filtered.filter((member) => !member.worked_previous_turn)
  const allSelected = selectable.length > 0 && selectable.every((member) => selected.has(memberKey(member)))

  function toggle(member, checked) {
    if (member.worked_previous_turn) return
    setSelected((current) => { const next = new Set(current); checked ? next.add(memberKey(member)) : next.delete(memberKey(member)); return next })
  }
  function toggleAll(checked) {
    setSelected((current) => { const next = new Set(current); selectable.forEach((member) => checked ? next.add(memberKey(member)) : next.delete(memberKey(member))); return next })
  }
  async function confirmar() {
    setSaving(true); setError('')
    try {
      if (isAdmin) {
        const pending = members.filter((member) => selected.has(memberKey(member)) && !member.in_turn)
        await Promise.all(pending.map((member) => member.person_type === 'opm'
          ? api.createAssignmentIndividual({ opm_id: member.person_id, date, turno, puesto: member.puesto || '' })
          : api.createSupervisorAssignmentIndividual({ user_id: member.person_id, date, turno, puesto: member.puesto || '' })))
      }
      const selectedOpms = members.filter((member) => member.person_type === 'opm' && selected.has(memberKey(member))).map((member) => member.assignment_id || member.person_id)
      const selectedSupervisors = members.filter((member) => member.person_type !== 'opm' && selected.has(memberKey(member))).map((member) => member.person_id)
      setShift({ date, turno, selectedOpms, selectedSupervisors })
      nav('/')
    } catch (err) { setError(err.message || 'No se pudo guardar la selección del turno.') } finally { setSaving(false) }
  }
  async function salir() { clearShift(); await logout(); nav('/login') }

  return <><TopBar title={t.turnoTitulo} onExit={salir} /><main className="content shift-page">
    {error && <div className="error" role="alert">{error}</div>}
    <section className="card shift-setup"><div><label>{t.fecha}</label><input className="input" type="date" value={date} onChange={(event) => setDate(event.target.value)} /></div><div><label>{t.turnoTrabajo}</label><select className="input" value={turno} onChange={(event) => setTurno(event.target.value)}><option value="dia">{t.turnoDia}</option><option value="noche">{t.turnoNoche}</option></select></div></section>
    <section className="shift-opm-list" aria-labelledby="shift-roster-title">
      <div className="assignment-list-heading shift-selection-heading"><div><h2 id="shift-roster-title">Equipo del turno</h2><p>{date} · {turnoText(turno, lang)} · Seleccione todo el personal o filtre por cargo.</p></div><span className="shift-selection-count"><UsersRound size={15} /> <strong>{selected.size}</strong> seleccionados</span></div>
      <div className="assignment-selection-tools"><select className="input" aria-label="Filtrar por cargo" value={puesto} onChange={(event) => setPuesto(event.target.value)}><option value="">Todos los cargos</option>{puestos.map((item) => <option key={item} value={item}>{item}</option>)}</select><label className="shift-search"><Search size={17} /><input type="text" className="input" placeholder="Buscar por nombre, código o cargo" value={filterText} onChange={(event) => setFilterText(event.target.value)} /></label><div className="assignment-filter-checks"><label className="assignment-select-all"><input type="checkbox" checked={allSelected} onChange={(event) => toggleAll(event.target.checked)} disabled={!selectable.length} /><span>Seleccionar todos ({selectable.length})</span></label><label className="assignment-select-all"><input type="checkbox" checked={onlyInTurn} onChange={(event) => setOnlyInTurn(event.target.checked)} /><span>Solo IN TURN</span></label><label className="assignment-select-all"><input type="checkbox" checked={onlyBirthday} onChange={(event) => setOnlyBirthday(event.target.checked)} /><span>Cumpleaños</span></label></div></div>
      <p className="shift-roster-guide"><span className="turn-state in">IN TURN</span> tiene una función registrada. <span className="turn-state off">OFF TURN</span> puede incorporarse al turno. Quien cubrió el turno anterior queda en descanso obligatorio.</p>
      {loading ? <div className="empty">{t.cargando}</div> : filtered.length === 0 ? <div className="assignment-empty"><CalendarDays size={25} /><div><strong>Sin coincidencias</strong><span>Pruebe con otro nombre, código o filtro.</span></div></div> : <div className="home-assignments-list shift-roster-list">{filtered.map((member) => <label className={`home-assignment shift-roster-item${member.worked_previous_turn ? ' is-resting' : ''}`} key={memberKey(member)}><input type="checkbox" checked={selected.has(memberKey(member))} disabled={member.worked_previous_turn} onChange={(event) => toggle(member, event.target.checked)} /><div className="shift-roster-copy"><div className="shift-roster-titleline"><strong>{member.full_name}</strong><span className="shift-roster-indicators">{isBirthday(member.fecha_nacimiento, date) && <span className="birthday-icon" title="Cumpleaños"><CakeSlice size={16} /></span>}<span className={`turn-state ${member.in_turn ? 'in' : 'off'}`}>{member.in_turn ? 'IN TURN' : 'OFF TURN'}</span></span></div><span>{member.code ? `${member.code} · ` : ''}{member.puesto || roleLabel(member) || t.sinPuesto}</span>{member.in_turn && <small>{member.funcion_1 || t.sinFuncion}{member.zona_1 ? ` · ${member.zona_1}` : ''}{member.nave ? ` · ${member.nave}` : ''}</small>}{member.worked_previous_turn && <small className="resting-note">No disponible: cubrió el turno anterior (máximo 12 horas).</small>}</div></label>)}</div>}
    </section>
    <button className="btn shift-confirm" disabled={(!isAdmin && selected.size === 0) || saving} onClick={confirmar}>{saving ? 'Guardando selección...' : selected.size ? `Confirmar y continuar con ${selected.size} seleccionado${selected.size !== 1 ? 's' : ''}` : isAdmin ? t.continuarSinColaboradores : t.seleccioneColaborador}</button>
  </main></>
}

const memberKey = (member) => `${member.person_type}:${member.person_id}`
const roleLabel = (member) => member.person_type === 'coordinator' ? 'Coordinador' : member.person_type === 'supervisor' ? 'Supervisor' : ''
const isBirthday = (birthDate, date) => Boolean(birthDate && date && birthDate.slice(5) === date.slice(5))
