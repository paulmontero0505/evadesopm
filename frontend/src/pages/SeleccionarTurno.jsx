import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, CalendarDays, Search, UsersRound } from 'lucide-react'
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
  const [teamType, setTeamType] = useState(null)
  const [opms, setOpms] = useState([])
  const [supervisors, setSupervisors] = useState([])
  const [loading, setLoading] = useState(false)
  const [filterText, setFilterText] = useState('')
  const [zona, setZona] = useState('')
  const [selectedOpmIds, setSelectedOpmIds] = useState(new Set())
  const [selectedSupervisorIds, setSelectedSupervisorIds] = useState(new Set())
  const [savingSelection, setSavingSelection] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!teamType) return
    let active = true
    setLoading(true)
    setFilterText('')
    setZona('')
    api.shiftTeam(date, turno, teamType)
      .then((data) => {
        if (!active) return
        const members = (data.members || []).map((member) => ({
          ...member,
          in_turn: Number(member.in_turn) === 1,
          worked_previous_turn: Number(member.worked_previous_turn) === 1,
        }))
        if (teamType === 'opms') {
          setOpms(members)
          setSelectedOpmIds(new Set(members.filter((member) => member.in_turn && !member.worked_previous_turn).map((member) => member.person_id)))
        } else {
          setSupervisors(members)
          setSelectedSupervisorIds(new Set(members.filter((member) => member.in_turn && !member.worked_previous_turn).map((member) => member.person_id)))
        }
      })
      .catch(() => { if (active) teamType === 'opms' ? setOpms([]) : setSupervisors([]) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [date, turno, teamType])

  const isAdmin = user?.role === 'admin'
  const selectedCount = teamType === 'supervisors' ? selectedSupervisorIds.size : selectedOpmIds.size
  const canConfirm = Boolean(date) && (isAdmin || selectedCount > 0)

  function chooseTeam(type) {
    setSelectedOpmIds(new Set())
    setSelectedSupervisorIds(new Set())
    setTeamType(type)
  }

  async function confirmar() {
    setSavingSelection(true)
    setError('')
    try {
      // Al elegir a alguien OFF TURN, el administrador lo incorpora al turno sin
      // inventar una función: conserva su cargo de catálogo y queda disponible.
      if (isAdmin && teamType === 'opms') {
        const pending = opms.filter((member) => selectedOpmIds.has(member.person_id) && !member.in_turn)
        await Promise.all(pending.map((member) => api.createAssignmentIndividual({
          opm_id: member.person_id, date, turno, puesto: member.puesto || '',
        })))
        const current = await api.assignments(date, turno)
        const selectedAssignments = (current.assignments || [])
          .filter((assignment) => selectedOpmIds.has(assignment.opm_id))
          .map((assignment) => assignment.id)
        setShift({ date, turno, selectedOpms: selectedAssignments, selectedSupervisors: [...selectedSupervisorIds] })
      } else if (isAdmin && teamType === 'supervisors') {
        const pending = supervisors.filter((member) => selectedSupervisorIds.has(member.person_id) && !member.in_turn)
        await Promise.all(pending.map((member) => api.createSupervisorAssignmentIndividual({
          user_id: member.person_id, date, turno, puesto: member.puesto || '',
        })))
        setShift({ date, turno, selectedOpms: [...selectedOpmIds], selectedSupervisors: [...selectedSupervisorIds] })
      } else {
        setShift({ date, turno, selectedOpms: [...selectedOpmIds], selectedSupervisors: [...selectedSupervisorIds] })
      }
      nav('/')
    } catch (err) {
      setError(err.message || 'No se pudo guardar la selección del turno.')
    } finally {
      setSavingSelection(false)
    }
  }

  async function salir() {
    clearShift()
    await logout()
    nav('/login')
  }

  return <>
    <TopBar title={t.turnoTitulo} onExit={salir} />
    <div className="content">
      {error && <div className="error" role="alert">{error}</div>}
      <div className="card">
        <label>{t.fecha}</label>
        <input className="input" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        <label>{t.turnoTrabajo}</label>
        <select className="input" value={turno} onChange={(event) => setTurno(event.target.value)}><option value="dia">{t.turnoDia}</option><option value="noche">{t.turnoNoche}</option></select>
      </div>

      {!teamType ? <TeamChoice date={date} turno={turno} lang={lang} onChoose={chooseTeam} /> : <TeamRoster
        title={teamType === 'opms' ? 'Mi equipo del turno OPM' : 'Equipo de turno Supervisores'}
        teamType={teamType} date={date} turno={turno} lang={lang} t={t}
        members={teamType === 'opms' ? opms : supervisors} loading={loading}
        selectedIds={teamType === 'opms' ? selectedOpmIds : selectedSupervisorIds}
        setSelectedIds={teamType === 'opms' ? setSelectedOpmIds : setSelectedSupervisorIds}
        filterText={filterText} setFilterText={setFilterText} zona={zona} setZona={setZona}
        setTeamType={setTeamType}
      />}

      <button className="btn shift-confirm" disabled={!canConfirm || savingSelection} onClick={confirmar}>
        {savingSelection ? 'Guardando selección…' : selectedCount ? `Confirmar y continuar con ${selectedCount} seleccionado${selectedCount !== 1 ? 's' : ''}` : isAdmin ? t.continuarSinColaboradores : t.seleccioneColaborador}
      </button>
    </div>
  </>
}

function TeamChoice({ date, turno, lang, onChoose }) {
  return <section className="shift-opm-list" aria-labelledby="shift-team-choice-title">
    <div className="assignment-list-heading shift-selection-heading"><div><h2 id="shift-team-choice-title">Selección de equipos de turno</h2><p>{date} · {turnoText(turno, lang)}</p></div></div>
    <div className="row assignment-actions">
      <button className="btn" onClick={() => onChoose('opms')}><UsersRound size={16} /> Seleccionar mi equipo del turno OPM</button>
      <button className="btn secondary" onClick={() => onChoose('supervisors')}><UsersRound size={16} /> Seleccionar equipo de turno Supervisores</button>
    </div>
  </section>
}

function TeamRoster({ title, teamType, date, turno, lang, t, members, loading, selectedIds, setSelectedIds, filterText, setFilterText, zona, setZona, setTeamType }) {
  const zonas = useMemo(() => [...new Set(members.map((member) => member.zona_1).filter(Boolean))], [members])
  const filtered = useMemo(() => members.filter((member) => {
    const text = `${member.full_name} ${member.code || ''} ${member.puesto || ''} ${member.funcion_1 || ''} ${member.zona_1 || ''}`.toLowerCase()
    return (!zona || member.zona_1 === zona) && text.includes(filterText.toLowerCase())
  }), [members, zona, filterText])
  const selectable = filtered.filter((member) => !member.worked_previous_turn)
  const allSelected = selectable.length > 0 && selectable.every((member) => selectedIds.has(member.person_id))
  const inTurnCount = members.filter((member) => member.in_turn).length

  function toggleAll(event) {
    const next = new Set(selectedIds)
    selectable.forEach((member) => event.target.checked ? next.add(member.person_id) : next.delete(member.person_id))
    setSelectedIds(next)
  }
  function toggle(member, checked) {
    if (member.worked_previous_turn) return
    const next = new Set(selectedIds)
    checked ? next.add(member.person_id) : next.delete(member.person_id)
    setSelectedIds(next)
  }

  return <section className="shift-opm-list" aria-labelledby="shift-roster-title">
    <div className="assignment-list-heading shift-selection-heading"><div><h2 id="shift-roster-title">{title}</h2><p>{date} · {turnoText(turno, lang)} · {members.length} disponibles en catálogo</p></div><span className="shift-selection-count"><UsersRound size={15} /> <strong>{selectedIds.size}</strong> seleccionados</span></div>
    <button className="btn secondary shift-back-team" onClick={() => setTeamType(null)}><ArrowLeft size={16} /> Cambiar equipo</button>
    <div className="assignment-selection-tools">
      {teamType === 'opms' && <select className="input" aria-label="Filtrar por zona" value={zona} onChange={(event) => setZona(event.target.value)}><option value="">Todas las zonas</option>{zonas.map((item) => <option key={item} value={item}>{item}</option>)}</select>}
      <label className="shift-search"><Search size={17} /><input type="text" className="input" placeholder="Buscar por nombre, código o puesto" value={filterText} onChange={(event) => setFilterText(event.target.value)} /></label>
      <label className="assignment-select-all"><input type="checkbox" checked={allSelected} onChange={toggleAll} disabled={!selectable.length} /><span>Seleccionar disponibles ({selectable.length})</span></label>
    </div>
    <p className="shift-roster-guide"><span className="turn-state in">IN TURN</span> pertenece al turno elegido. <span className="turn-state off">OFF TURN</span> puede seleccionarse si está disponible. Quien cubrió el turno anterior queda en descanso obligatorio.</p>
    {loading ? <div className="empty">{t.cargando}</div> : filtered.length === 0 ? <div className="assignment-empty"><CalendarDays size={25} /><div><strong>Sin coincidencias</strong><span>Pruebe con otro nombre, código o filtro.</span></div></div> : <div className="home-assignments-list shift-roster-list">{filtered.map((member) => <label className={`home-assignment shift-roster-item${member.worked_previous_turn ? ' is-resting' : ''}`} key={member.person_id}>
      <input type="checkbox" checked={selectedIds.has(member.person_id)} disabled={Boolean(member.worked_previous_turn)} onChange={(event) => toggle(member, event.target.checked)} />
      <div className="shift-roster-copy"><div className="shift-roster-titleline"><strong>{member.full_name}</strong><span className={`turn-state ${member.in_turn ? 'in' : 'off'}`}>{member.in_turn ? 'IN TURN' : 'OFF TURN'}</span></div><span>{member.code ? `${member.code} · ` : ''}{teamType === 'supervisors' ? (member.role === 'coordinator' ? 'Coordinador' : 'Supervisor') : (member.puesto || t.sinPuesto)}</span>{member.in_turn && <small>{member.funcion_1 || t.sinFuncion}{member.zona_1 ? ` · ${member.zona_1}` : ''}{member.nave ? ` · ${member.nave}` : ''}</small>}{member.worked_previous_turn && <small className="resting-note">No disponible: cubrió el turno anterior (máximo 12 horas).</small>}</div>
    </label>)}</div>}
    {!loading && <span className="shift-in-turn-summary">{inTurnCount} {teamType === 'opms' ? 'colaborador(es)' : 'supervisor(es)'} con asignación en este turno, mostrados primero.</span>}
  </section>
}
