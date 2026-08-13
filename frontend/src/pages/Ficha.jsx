import { useEffect, useMemo, useRef, useState } from 'react'
import { Anchor, Ship, ShieldAlert, CalendarClock, Trash2, Camera, X, ChevronDown, ChevronLeft, ChevronRight, Printer, Pencil } from 'lucide-react'
import { api, SITE_BASE } from '../api.js'
import { useAuth } from '../auth.jsx'
import { useShift } from '../shift.jsx'
import { nivel5, colorNivel, visibleBlocks, promediosFicha } from '../rules.js'
import { T, useLang, objName, blockTitle, cargaLabel, turnoText } from '../i18n.js'
import TopBar from '../components/TopBar.jsx'
import SearchSelect from '../components/SearchSelect.jsx'
import ActRow from '../components/ActRow.jsx'
import Toast from '../components/Toast.jsx'

const fmtDate = (d) => { if (!d) return ''; const [y, m, day] = d.split('-'); return `${day}/${m}/${y}` }
const dateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const weekStart = (date) => { const value = new Date(`${date}T00:00:00`); value.setDate(value.getDate() - ((value.getDay() + 6) % 7)); return dateKey(value) }
const addDays = (date, days) => { const value = new Date(`${date}T00:00:00`); value.setDate(value.getDate() + days); return dateKey(value) }
const shiftQuarter = (date, amount) => { const value = new Date(`${date}T00:00:00`); value.setMonth(value.getMonth() + amount * 3); return dateKey(value) }

function isSameWeek(d1, d2) {
  const date1 = new Date(d1 + 'T00:00:00')
  const date2 = new Date(d2 + 'T00:00:00')
  const getMonday = (d) => {
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    return new Date(d.setDate(diff))
  }
  const mon1 = getMonday(new Date(date1.getTime()))
  const mon2 = getMonday(new Date(date2.getTime()))
  return mon1.toDateString() === mon2.toDateString()
}

export default function Ficha() {
  const { user } = useAuth()
  const { shift } = useShift()
  const [lang] = useLang()
  const t = T[lang]
  const [rules, setRules] = useState(null)
  const [opms, setOpms] = useState([])
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [err, setErr] = useState('')
  const [deletingId, setDeletingId] = useState(null)

  const [opmId, setOpmId] = useState('')
  const [carga, setCarga] = useState('')
  const [nave, setNave] = useState('')
  const [amarre, setAmarre] = useState(false)
  const [evento, setEvento] = useState(false)
  const [eventoComment, setEventoComment] = useState('')
  const [eventoPhoto, setEventoPhoto] = useState(null)
  const [eventoPhotoPreview, setEventoPhotoPreview] = useState('')
  const [reevaluacionIncidente, setReevaluacionIncidente] = useState(false)
  const [ratings, setRatings] = useState({})
  const [comments, setComments] = useState({})
  const [busy, setBusy] = useState(false)
  const [tab, setTab] = useState('nuevo')
  const [toastMsg, setToastMsg] = useState('')
  const [expandedId, setExpandedId] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [clearPhoto, setClearPhoto] = useState(false)
  const eventoPhotoRef = useRef(null)

  // Filtros de "Registros de hoy"
  const [fOpm, setFOpm] = useState('')
  const [fRango, setFRango] = useState('actual') // 'actual', 'semanal', 'trimestral'
  const [periodDate, setPeriodDate] = useState(shift.date)
  const [fCarga, setFCarga] = useState('')
  const [fSuper, setFSuper] = useState('')

  function fetchRecords(range = fRango, date = periodDate) {
    if (!date) return Promise.resolve()
    const [yStr, mStr] = date.split('-')
    const year = Number(yStr)
    const month = Number(mStr)
    const quarter = Math.ceil(month / 3)
    return api.shiftRecords(year, quarter)
      .then((d) => setRecords(d.shift_records || []))
      .catch(() => setRecords([]))
  }

  useEffect(() => {
    setLoading(true)
    setErr('')
    setPeriodDate(shift.date)
    Promise.all([api.rules(), api.opms(), api.shiftTeam(shift.date, shift.turno, 'opms'), fetchRecords('actual', shift.date)])
      .then(([r, opmData, team]) => {
        if (!r?.rules || !Array.isArray(r.rules.cargas) || !Array.isArray(r.rules.bloques) || !r.rules.objetivos) {
          throw new Error(t.errorFichaDatos)
        }
        setRules(r.rules)
        const inTurnById = new Map((team.members || []).map((member) => [Number(member.person_id), Number(member.in_turn) === 1]))
        const selectedOpms = new Set((shift.selectedOpms || []).map(Number))
        setOpms((opmData.opms || [])
          .filter((opm) => opm.active && isMultipurposeOperator(opm.puesto))
          .filter((opm) => user.role === 'admin' || selectedOpms.has(Number(opm.id)))
          .map((opm) => ({ ...opm, in_turn: inTurnById.get(Number(opm.id)) === true })))
      })
      .catch((e) => { setRules(null); setErr(e.message || t.errorFichaCarga) })
      .finally(() => setLoading(false))
  }, [loadAttempt, shift.date, shift.turno, shift.selectedOpms, user.role])

  const visibles = useMemo(() => {
    if (!rules || !carga) return []
    return visibleBlocks(rules.bloques, carga, amarre)
  }, [rules, carga, amarre])

  const prom = useMemo(() => {
    if (!rules) return {}
    const r = {}
    visibles.forEach((b) => b.acts.forEach((a) => { if (ratings[a.id]) r[a.id] = ratings[a.id] }))
    return promediosFicha(rules.bloques, rules.objetivos, rules.params, r, evento)
  }, [rules, ratings, evento, visibles])

  const pendientes = visibles.flatMap((b) => b.acts).filter((a) => !ratings[a.id]).length

  // Reglas de cuota por trimestre: máx. 8 fichas totales por OPM; mismo supervisor máx. 3 veces por OPM; mismo OPM+carga máx. 2 veces.
  const totalCount = opmId
    ? records.filter((r) => String(r.opm_id) === opmId && r.id !== editingId).length
    : 0
  const superCount = opmId
    ? records.filter((r) => String(r.opm_id) === opmId && Number(r.supervisor_id) === Number(user.id) && r.id !== editingId).length
    : 0
  const cargaCount = opmId && carga
    ? records.filter((r) => String(r.opm_id) === opmId && r.carga === carga && r.id !== editingId).length
    : 0
  // El administrador no tiene cuotas de total ni de supervisor, pero la cobertura por tipo de
  // carga sí aplica siempre (incluso a él): asegura que las fichas mínimas cubran los 4 tipos.
  const esAdmin = user.role === 'admin'
  const cuotaTotalExcedida = !esAdmin && totalCount >= (rules?.params.piso ?? 8)
  const cuotaSuperExcedida = !esAdmin && superCount >= 3
  const cuotaCargaExcedida = cargaCount >= (rules?.params.minCarga ?? 2)
  const maxCargaConIncidentes = (rules?.params.minCarga ?? 2) + 2
  const maxReevaluacionesAlcanzado = cargaCount >= maxCargaConIncidentes

  const incidenteDocumentado = reevaluacionIncidente && evento && eventoComment.trim()
  const listo = opmId && carga && pendientes === 0 && !busy && !cuotaTotalExcedida && !cuotaSuperExcedida && !maxReevaluacionesAlcanzado && (!cuotaCargaExcedida || incidenteDocumentado)

  const shown = records.filter((r) => {
    if (fRango === 'actual' && r.work_date !== shift.date) return false
    if (fRango === 'semanal' && (r.work_date < weekStart(periodDate) || r.work_date > addDays(weekStart(periodDate), 6))) return false
    return (!fOpm || String(r.opm_id) === fOpm) &&
           (!fCarga || r.carga === fCarga) &&
           (!fSuper || String(r.supervisor_id) === fSuper)
  })

  const supervisorOptions = useMemo(() => {
    const seen = new Map()
    records.forEach((r) => { if (!seen.has(r.supervisor_id)) seen.set(r.supervisor_id, r.supervisor_name) })
    return Array.from(seen, ([value, label]) => ({ value: String(value), label }))
  }, [records])

  const stats = useMemo(() => ({
    evaluaciones: shown.length,
    colaboradores: new Set(shown.map((r) => r.opm_id)).size,
    eventos: shown.filter((r) => Number(r.evento_seguridad) === 1).length,
  }), [shown])

  function changeRange(range) { setFRango(range); setPeriodDate(shift.date); fetchRecords(range, shift.date) }
  function movePeriod(amount) { const next = fRango === 'semanal' ? addDays(periodDate, amount * 7) : shiftQuarter(periodDate, amount); setPeriodDate(next); fetchRecords(fRango, next) }

  function onEventoPhoto(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.size > 8 * 1024 * 1024) { setErr(t.fotoGrande); return }
    setEventoPhoto(file)
    setEventoPhotoPreview(URL.createObjectURL(file))
  }

  function quitarEventoPhoto() {
    if (eventoPhotoPreview) URL.revokeObjectURL(eventoPhotoPreview)
    setEventoPhoto(null); setEventoPhotoPreview('')
    if (editingId) setClearPhoto(true)
  }

  async function enviar() {
    setBusy(true); setErr('')
    try {
      const payload = {
        opm_id: Number(opmId),
        work_date: shift.date,
        turno: shift.turno,
        carga,
        nave,
        amarre,
        evento_seguridad: evento,
        evento_comment: evento ? eventoComment : '',
        reevaluacion_incidente: reevaluacionIncidente,
        ratings,
        comments,
      }
      if (editingId) {
        payload.clear_photo = clearPhoto
        await api.updateShiftRecord(editingId, payload, evento ? eventoPhoto : null)
        setToastMsg(t.toastActualizado)
      } else {
        await api.createShiftRecord(payload, evento ? eventoPhoto : null)
        setToastMsg(t.toastEnviado)
      }
      await fetchRecords()
      nuevaFicha()
      if (editingId) {
        setEditingId(null)
        setClearPhoto(false)
        setTab('registrados')
      }
    } catch (e) {
      setErr(e.message || 'No se pudo guardar la ficha')
    } finally {
      setBusy(false)
    }
  }

  function nuevaFicha() {
    setOpmId(''); setCarga(''); setNave(''); setAmarre(false); setEvento(false); setReevaluacionIncidente(false)
    setRatings({}); setComments({}); setEventoComment(''); quitarEventoPhoto()
    setEditingId(null)
    setClearPhoto(false)
  }

  async function iniciarEdicion(r) {
    setErr('')
    setLoading(true)
    try {
      const d = await api.shiftRecord(r.id)
      const fullRecord = d.shift_record

      setEditingId(fullRecord.id)
      setClearPhoto(false)

      setOpmId(String(fullRecord.opm_id))
      setCarga(fullRecord.carga)
      setNave(fullRecord.nave || '')
      setAmarre(Number(fullRecord.amarre) === 1)
      setEvento(Number(fullRecord.evento_seguridad) === 1)
      setReevaluacionIncidente(false)
      setEventoComment(fullRecord.evento_comment || '')
      setEventoPhotoPreview(fullRecord.evento_photo ? (SITE_BASE + fullRecord.evento_photo) : '')
      setEventoPhoto(null)

      const newRatings = {}
      const newComments = {}
      fullRecord.ratings.forEach((item) => {
        // rating NULL en base = la actividad se marcó como "No aplica".
        newRatings[item.activity_code] = item.rating == null ? 'na' : Number(item.rating)
        if (item.comment) newComments[item.activity_code] = item.comment
      })
      setRatings(newRatings)
      setComments(newComments)

      setTab('nuevo')
    } catch (e) {
      setErr(e.message || 'No se pudo cargar el detalle de la ficha')
    } finally {
      setLoading(false)
    }
  }

  function cancelarEdicion() {
    setEditingId(null)
    setClearPhoto(false)
    nuevaFicha()
    setTab('registrados')
  }

  async function eliminarFicha(r) {
    const ok = window.confirm(t.confirmarBorrar(r.opm_code, r.opm_name, turnoText(r.turno, lang)))
    if (!ok) return
    setDeletingId(r.id); setErr('')
    try {
      await api.deleteShiftRecord(r.id)
      await fetchRecords()
    } catch (e) {
      setErr(e.message || 'No se pudo eliminar la ficha')
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) return <div className="empty">{t.cargando}</div>
  if (!rules) {
    return (
      <>
        <TopBar title={t.fichaTitulo} sub={t.fichaSub(fmtDate(shift?.date), turnoText(shift?.turno, lang))} to="/evaluacion-opm" />
        <div className="content">
          <div className="card load-error-state" role="alert">
            <h3>{t.errorFichaTitulo}</h3>
            <p className="muted">{err || t.errorFichaCarga}</p>
            <button className="btn" onClick={() => setLoadAttempt((n) => n + 1)}>{t.reintentar}</button>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <TopBar title={t.fichaTitulo} sub={t.fichaSub(fmtDate(shift.date), turnoText(shift.turno, lang))} to="/evaluacion-opm" />
      <Toast message={toastMsg} onDone={() => setToastMsg('')} />
      <div className="content">
        {err && <div className="error">{err}</div>}

        <div className="tab-bar">
          <button className={`tab-btn ${tab === 'nuevo' ? 'active' : ''}`} onClick={() => setTab('nuevo')}>
            {editingId ? t.tabEditar(editingId) : t.tabNuevo}
          </button>
          <button className={`tab-btn ${tab === 'registrados' ? 'active' : ''}`} onClick={() => {
            if (editingId) {
              cancelarEdicion()
            } else {
              setTab('registrados')
            }
          }}>
            {t.tabRegistrados} <span className="chip">{shown.length}</span>
          </button>
        </div>

        {tab === 'nuevo' && (
          <>
            <div className="card">
              <label>{t.operario}</label>
              <SearchSelect value={opmId} onChange={setOpmId} placeholder={t.seleccione}
                options={opms.map((o) => ({ value: String(o.id), label: `${o.code} · ${o.full_name} · ${o.in_turn ? 'IN TURN' : 'OFF TURN'}` }))} />
              {opms.length === 0 && <div className="warn-box">No hay colaboradores activos registrados.</div>}

              <label>{t.tipoCarga}</label>
              <div className="choice-grid">
                {rules.cargas.map((c) => (
                  <button key={c} className={`choice ${carga === c ? 'active' : ''}`}
                    style={carga === c ? { background: '#0060A9' } : {}}
                    onClick={() => { setCarga(c); setReevaluacionIncidente(false) }}>{cargaLabel(c, lang, rules)}</button>
                ))}
              </div>

              <label>{t.naveOpcional}</label>
              <input className="input" value={nave} onChange={(e) => setNave(e.target.value)}
                placeholder={t.navePlaceholder} />

              <button className={`toggle-btn ${amarre ? 'active' : ''}`}
                style={amarre ? { background: '#EF7D00', marginTop: 12 } : { marginTop: 12 }}
                onClick={() => setAmarre(!amarre)}>
                <Anchor size={16} /> {amarre ? t.amarreSi : t.amarrePregunta}
              </button>
            </div>

            {cuotaTotalExcedida && (
              <div className="error">{t.cuotaTotal(rules?.params.piso ?? 8)}</div>
            )}
            {!cuotaTotalExcedida && cuotaSuperExcedida && (
              <div className="error">{t.cuotaSuper}</div>
            )}
            {!cuotaTotalExcedida && !cuotaSuperExcedida && maxReevaluacionesAlcanzado && (
              <div className="error">Ya se alcanzó el máximo de {maxCargaConIncidentes} fichas para {cargaLabel(carga, lang, rules)}, incluidas las reevaluaciones por incidente.</div>
            )}
            {!cuotaTotalExcedida && !cuotaSuperExcedida && cuotaCargaExcedida && !maxReevaluacionesAlcanzado && !reevaluacionIncidente && (
              <div className="incident-reevaluation"><div><strong>Tope de carga alcanzado</strong><span>{t.cuotaCarga(rules?.params.minCarga ?? 2, cargaLabel(carga, lang, rules))}</span></div><button type="button" className="btn small incident-reevaluation-btn" onClick={() => { setReevaluacionIncidente(true); setEvento(true) }}>Reevaluar por incidente</button></div>
            )}
            {!cuotaTotalExcedida && !cuotaSuperExcedida && cuotaCargaExcedida && !maxReevaluacionesAlcanzado && reevaluacionIncidente && (
              <div className="incident-reevaluation active"><strong>Reevaluación por incidente activada</strong><span>Describa el incidente de seguridad para registrar esta ficha adicional.</span></div>
            )}

            {!carga && (
              <div className="empty">
                <Ship size={32} />
                <div>{t.elijaCarga}</div>
              </div>
            )}

            {carga && visibles.map((b) => (
              <div key={b.id} className="block-card">
                <div className="block-head">{blockTitle(b, lang).toUpperCase()}</div>
                {b.acts.map((a) => (
                  <ActRow key={a.id} act={a} objColor={rules.objetivos[a.o].c} escala={rules.escala} lang={lang}
                    value={ratings[a.id]}
                    onRate={(v) => setRatings({ ...ratings, [a.id]: v })}
                    comment={comments[a.id]}
                    onComment={(v) => setComments({ ...comments, [a.id]: v })} />
                ))}
              </div>
            ))}

            {carga && (
              <>
                <button className={`toggle-btn ${evento ? 'active' : ''}`}
                  style={evento ? { background: '#C0392B', textAlign: 'left', justifyContent: 'flex-start' } : { textAlign: 'left', justifyContent: 'flex-start' }}
                  onClick={() => { setEvento(!evento); if (evento) setReevaluacionIncidente(false) }}>
                  <ShieldAlert size={20} />
                  <span>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{t.eventoTitulo}</div>
                    <div style={{ fontSize: 11, opacity: .85 }}>
                      {evento ? t.eventoOn : t.eventoOff}
                    </div>
                  </span>
                </button>

                {evento && (
                  <div className="card evento-detail">
                    <label>{t.eventoComentario}</label>
                    <textarea className="input" rows={3} maxLength={500}
                      value={eventoComment} onChange={(e) => setEventoComment(e.target.value)}
                      placeholder={t.eventoPlaceholder} />

                    <label>{t.fotoOpcional}</label>
                    {eventoPhotoPreview ? (
                      <div className="evento-photo-preview">
                        <img src={eventoPhotoPreview} alt={t.fotoAlt} />
                        <button type="button" className="iconbtn danger" onClick={quitarEventoPhoto} aria-label={t.quitarFoto}>
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <button type="button" className="toggle-btn" onClick={() => eventoPhotoRef.current?.click()}>
                        <Camera size={16} /> {t.subirFoto}
                      </button>
                    )}
                    <input ref={eventoPhotoRef} type="file" accept="image/jpeg,image/png,image/webp"
                      style={{ display: 'none' }} onChange={onEventoPhoto} />
                  </div>
                )}

                <div className="card" style={{ marginTop: 12 }}>
                  <h3>{t.promediosTurno}</h3>
                  {Object.keys(rules.objetivos).map((o) => {
                    const v = prom[o]; const n = nivel5(v, rules.params)
                    return (
                      <div key={o} className="prom-row">
                        <span className="obj-chip" style={{ background: rules.objetivos[o].c }}>{o}</span>
                        <span className="grow label">{objName(rules.objetivos[o], lang)}</span>
                        {v == null ? <span className="muted">—</span> : (
                          <>
                            <div className="prom-track"><div className="bar-fill" style={{ width: `${(v / 5) * 100}%`, background: colorNivel(n) }} /></div>
                            <span className="value" style={{ color: colorNivel(n) }}>{v.toFixed(2)}</span>
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>

                <button className="btn orange" style={{ marginTop: 14 }} disabled={!listo} onClick={enviar}>
                  {(!editingId && cuotaTotalExcedida) ? t.btnMaxFichas
                    : (!editingId && cuotaSuperExcedida) ? t.btnCuota
                    : (!editingId && maxReevaluacionesAlcanzado) ? 'Máximo de reevaluaciones alcanzado'
                    : (!editingId && cuotaCargaExcedida && !incidenteDocumentado) ? 'Describa el incidente para reevaluar'
                    : pendientes > 0 ? t.btnFaltan(pendientes)
                    : (busy ? t.btnGuardando : (editingId ? t.btnGuardarCambios : t.btnGuardarFicha))}
                </button>
                {editingId && (
                  <button type="button" className="btn secondary" style={{ marginTop: 8 }} onClick={cancelarEdicion}>
                    {t.btnCancelarEdicion}
                  </button>
                )}
              </>
            )}
          </>
        )}

        {tab === 'registrados' && (
          <div className="card">
            <div className="muted" style={{ marginBottom: 10 }}>
              {fRango === 'actual' && t.fichasDel(fmtDate(shift.date))}
              {fRango === 'semanal' && `Semana del ${fmtDate(weekStart(periodDate))} al ${fmtDate(addDays(weekStart(periodDate), 6))}`}
              {fRango === 'trimestral' && `Trimestre ${Math.ceil(Number(periodDate.slice(5, 7)) / 3)} · ${periodDate.slice(0, 4)}`}
            </div>

            <div className="stat-grid" style={{ marginBottom: 14 }}>
              <div className="stat"><div className="n">{stats.evaluaciones}</div><div className="l">{t.evaluaciones}</div></div>
              <div className="stat"><div className="n">{stats.colaboradores}</div><div className="l">{t.colaboradores}</div></div>
              <div className="stat"><div className={`n ${stats.eventos > 0 ? 'alert' : ''}`}>{stats.eventos}</div><div className="l">{t.eventosSeguridad}</div></div>
            </div>

            <div className="tab-bar turno-tabs">
              <button className={`tab-btn ${fRango === 'actual' ? 'active' : ''}`} onClick={() => changeRange('actual')}>Actual</button>
              <button className={`tab-btn ${fRango === 'semanal' ? 'active' : ''}`} onClick={() => changeRange('semanal')}>{t.rangoSemanal}</button>
              <button className={`tab-btn ${fRango === 'trimestral' ? 'active' : ''}`} onClick={() => changeRange('trimestral')}>{t.rangoTrimestral}</button>
            </div>
            {fRango !== 'actual' && <div className="row" style={{ marginBottom: 8 }}><button type="button" className="btn secondary small" onClick={() => movePeriod(-1)} aria-label="Periodo anterior"><ChevronLeft size={16} /> Anterior</button><button type="button" className="btn secondary small" onClick={() => movePeriod(1)} aria-label="Periodo siguiente">Siguiente <ChevronRight size={16} /></button></div>}

            <SearchSelect value={fOpm} onChange={setFOpm} emptyLabel={t.todosOpm}
              options={opms.map((o) => ({ value: String(o.id), label: `${o.code} · ${o.full_name}` }))} />
            <div style={{ height: 8 }} />
            <SearchSelect value={fSuper} onChange={setFSuper} emptyLabel={t.todosSupervisores}
              options={supervisorOptions} />
            <select value={fCarga} onChange={(e) => setFCarga(e.target.value)} style={{ marginTop: 8 }}>
              <option value="">{t.todasCargas}</option>
              {rules.cargas.map((c) => <option key={c} value={c}>{cargaLabel(c, lang, rules)}</option>)}
            </select>

            {shown.length === 0 ? (
              <div className="muted" style={{ marginTop: 12 }}>{t.sinRegistros}</div>
            ) : (
              <div style={{ marginTop: 12 }}>
                {shown.map((r) => {
                  const puedeBorrar = user.role === 'admin' || Number(r.supervisor_id) === Number(user.id)
                  const tieneEvento = Number(r.evento_seguridad) === 1
                  const tieneDetalle = tieneEvento && (r.evento_photo || r.evento_comment)
                  const abierto = expandedId === r.id
                  return (
                    <div key={r.id} className="opm-card" style={{ marginBottom: 8 }}>
                      <div className="list-row" style={{ marginBottom: 0, boxShadow: 'none', border: 'none', borderRadius: 0 }}>
                        <button type="button"
                          className={`grow record-main ${tieneDetalle ? 'clickable' : ''}`}
                          disabled={!tieneDetalle}
                          onClick={() => setExpandedId(abierto ? null : r.id)}
                          aria-expanded={tieneDetalle ? abierto : undefined}>
                          <div className="name">{r.opm_code} · {r.opm_name}</div>
                          <div className="meta">
                            {t.turnoLbl(turnoText(r.turno, lang))} · {cargaLabel(r.carga, lang, rules)}
                            {Number(r.amarre) === 1 ? ` · ${t.amarreChip}` : ''}{r.nave ? ` · ${t.naveChip(r.nave)}` : ''}
                          </div>
                          <div className="meta">{t.evaluadoPor(r.supervisor_name)}</div>
                        </button>
                        {tieneEvento && (
                          <button type="button" className="badge badge-btn" style={{ background: 'var(--red)' }}
                            disabled={!tieneDetalle}
                            onClick={() => setExpandedId(abierto ? null : r.id)}>
                            {t.eventoChip} {tieneDetalle && <ChevronDown size={12} className={abierto ? 'rot' : ''} />}
                          </button>
                        )}
                        <a className="iconbtn ghost" href={`#/imprimir/${r.id}`} target="_blank" rel="noreferrer"
                          aria-label={t.imprimirFicha}>
                          <Printer size={16} />
                        </a>
                        {puedeBorrar && (
                          <>
                            <button type="button" className="iconbtn ghost" style={{ marginLeft: 4 }}
                              onClick={() => iniciarEdicion(r)} aria-label={t.editarFicha}>
                              <Pencil size={16} />
                            </button>
                            <button className="iconbtn danger" style={{ marginLeft: 4 }} disabled={deletingId === r.id}
                              onClick={() => eliminarFicha(r)} aria-label={t.eliminarFicha}>
                              <Trash2 size={16} />
                            </button>
                          </>
                        )}
                      </div>
                      {abierto && tieneDetalle && (
                        <div className="evento-expand">
                          {r.evento_photo && (
                            <a href={SITE_BASE + r.evento_photo} target="_blank" rel="noreferrer" className="evento-photo-link">
                              <img src={SITE_BASE + r.evento_photo} alt={t.fotoAlt} />
                            </a>
                          )}
                          {r.evento_comment && <div className="evento-comment">{r.evento_comment}</div>}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}

function isMultipurposeOperator(puesto) {
  const normalized = (puesto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
  return normalized.includes('OPERARIO') && normalized.includes('MULTIPROPOSITO')
}
