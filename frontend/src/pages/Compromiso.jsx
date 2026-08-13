import { useEffect, useMemo, useRef, useState } from 'react'
import { ShieldAlert, Trash2, Camera, X, ChevronDown, ChevronLeft, ChevronRight, Printer, Pencil } from 'lucide-react'
import { api, SITE_BASE } from '../api.js'
import { useAuth } from '../auth.jsx'
import { useShift } from '../shift.jsx'
import { nivel5, colorNivel, promediosFichaCompromiso } from '../rulesCompromiso.js'
import { T, useLang, objName, actName, turnoText } from '../i18n.js'
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

export default function Compromiso() {
  const { user } = useAuth()
  const { shift } = useShift()
  const [rules, setRules] = useState(null)
  const [opms, setOpms] = useState([])
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [deletingId, setDeletingId] = useState(null)

  const [lang] = useLang()
  const t = T[lang]

  const [opmId, setOpmId] = useState('')
  const [critica, setCritica] = useState(false)
  const [criticaComment, setCriticaComment] = useState('')
  const [criticaPhoto, setCriticaPhoto] = useState(null)
  const [criticaPhotoPreview, setCriticaPhotoPreview] = useState('')
  const [ratings, setRatings] = useState({})
  const [comments, setComments] = useState({})
  const [busy, setBusy] = useState(false)
  const [tab, setTab] = useState('nuevo')
  const [toastMsg, setToastMsg] = useState('')
  const [expandedId, setExpandedId] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [clearPhoto, setClearPhoto] = useState(false)
  const criticaPhotoRef = useRef(null)

  // Filtros de "Registros de hoy"
  const [fOpm, setFOpm] = useState('')
  const [fRango, setFRango] = useState('actual') // 'actual', 'semanal', 'trimestral'
  const [periodDate, setPeriodDate] = useState(shift.date)
  const [fSuper, setFSuper] = useState('')

  function fetchRecords(range = fRango, date = periodDate) {
    if (!date) return Promise.resolve()
    const [yStr, mStr] = date.split('-')
    const year = Number(yStr)
    const month = Number(mStr)
    const quarter = Math.ceil(month / 3)
    return api.compromisoRecords(year, quarter)
      .then((d) => setRecords(d.compromiso_records || []))
      .catch(() => setRecords([]))
  }

  useEffect(() => {
    setPeriodDate(shift.date)
    Promise.all([api.compromisoRules(), api.opms(), api.shiftTeam(shift.date, shift.turno, 'opms'), fetchRecords('actual', shift.date)])
      .then(([r, opmData, team]) => {
        setRules(r.rules)
        const inTurnById = new Map((team.members || []).map((member) => [Number(member.person_id), Number(member.in_turn) === 1]))
        const selectedOpms = new Set((shift.selectedOpms || []).map(Number))
        setOpms((opmData.opms || [])
          .filter((opm) => opm.active && isMultipurposeOperator(opm.puesto))
          .filter((opm) => user.role === 'admin' || selectedOpms.has(Number(opm.id)))
          .map((opm) => ({ ...opm, in_turn: inTurnById.get(Number(opm.id)) === true })))
      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false))
  }, [shift.date, shift.turno, shift.selectedOpms, user.role])

  const prom = useMemo(() => {
    if (!rules) return {}
    return promediosFichaCompromiso(rules.objetivos, rules.params, rules.conducta_critica, rules.actividades, ratings, critica)
  }, [rules, ratings, critica])

  const pendientes = rules ? rules.actividades.filter((a) => !ratings[a.id]).length : 0

  // Cuotas: máx. 8 fichas totales por OPM al trimestre; mismo supervisor máx. 2 veces por OPM al mes.
  const totalCount = opmId
    ? records.filter((r) => String(r.opm_id) === opmId && r.id !== editingId).length
    : 0
  const mesActual = shift.date.slice(0, 7)
  const superCount = opmId
    ? records.filter((r) => String(r.opm_id) === opmId && Number(r.supervisor_id) === Number(user.id) &&
        r.id !== editingId && r.work_date.slice(0, 7) === mesActual).length
    : 0
  // El administrador no tiene cuotas ni excepciones: puede registrar sin límites.
  const esAdmin = user.role === 'admin'
  const cuotaTotalExcedida = !esAdmin && totalCount >= (rules?.params.piso ?? 4)
  const cuotaSuperExcedida = !esAdmin && superCount >= 2

  const listo = opmId && pendientes === 0 && !busy && !cuotaTotalExcedida && !cuotaSuperExcedida

  const shown = records.filter((r) => {
    if (fRango === 'actual' && r.work_date !== shift.date) return false
    if (fRango === 'semanal' && (r.work_date < weekStart(periodDate) || r.work_date > addDays(weekStart(periodDate), 6))) return false
    return (!fOpm || String(r.opm_id) === fOpm) &&
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
    conductas: shown.filter((r) => Number(r.conducta_critica) === 1).length,
  }), [shown])

  function changeRange(range) { setFRango(range); setPeriodDate(shift.date); fetchRecords(range, shift.date) }
  function movePeriod(amount) { const next = fRango === 'semanal' ? addDays(periodDate, amount * 7) : shiftQuarter(periodDate, amount); setPeriodDate(next); fetchRecords(fRango, next) }

  function onCriticaPhoto(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.size > 8 * 1024 * 1024) { setErr(t.fotoGrande); return }
    setCriticaPhoto(file)
    setCriticaPhotoPreview(URL.createObjectURL(file))
  }

  function quitarCriticaPhoto() {
    if (criticaPhotoPreview) URL.revokeObjectURL(criticaPhotoPreview)
    setCriticaPhoto(null); setCriticaPhotoPreview('')
    if (editingId) setClearPhoto(true)
  }

  async function enviar() {
    setBusy(true); setErr('')
    try {
      const payload = {
        opm_id: Number(opmId),
        work_date: shift.date,
        turno: shift.turno,
        conducta_critica: critica,
        conducta_comment: critica ? criticaComment : '',
        ratings,
        comments,
      }
      if (editingId) {
        payload.clear_photo = clearPhoto
        await api.updateCompromisoRecord(editingId, payload, critica ? criticaPhoto : null)
        setToastMsg(t.toastActualizado)
      } else {
        await api.createCompromisoRecord(payload, critica ? criticaPhoto : null)
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
    setOpmId(''); setCritica(false)
    setRatings({}); setComments({}); setCriticaComment(''); quitarCriticaPhoto()
    setEditingId(null)
    setClearPhoto(false)
  }

  async function iniciarEdicion(r) {
    setErr('')
    setLoading(true)
    try {
      const d = await api.compromisoRecord(r.id)
      const fullRecord = d.compromiso_record

      setEditingId(fullRecord.id)
      setClearPhoto(false)

      setOpmId(String(fullRecord.opm_id))
      setCritica(Number(fullRecord.conducta_critica) === 1)
      setCriticaComment(fullRecord.conducta_comment || '')
      setCriticaPhotoPreview(fullRecord.conducta_photo ? (SITE_BASE + fullRecord.conducta_photo) : '')
      setCriticaPhoto(null)

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
    const ok = window.confirm(t.confirmarBorrarComp(r.opm_code, r.opm_name, turnoText(r.turno, lang)))
    if (!ok) return
    setDeletingId(r.id); setErr('')
    try {
      await api.deleteCompromisoRecord(r.id)
      await fetchRecords()
    } catch (e) {
      setErr(e.message || 'No se pudo eliminar la ficha')
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) return <div className="empty">{t.cargando}</div>

  return (
    <>
      <TopBar title={t.compTitulo} sub={t.fichaSub(fmtDate(shift.date), turnoText(shift.turno, lang))} to="/evaluacion-opm" />
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
            </div>

            {cuotaTotalExcedida && (
              <div className="error">{t.cuotaTotalComp(rules?.params.piso ?? 4)}</div>
            )}
            {!cuotaTotalExcedida && cuotaSuperExcedida && (
              <div className="error">{t.cuotaSuperComp}</div>
            )}

            {!opmId && (
              <div className="empty">
                <div>{t.elijaOpmConductas}</div>
              </div>
            )}

            {opmId && Object.keys(rules.objetivos).map((o) => (
              <div key={o} className="block-card">
                <div className="block-head">
                  {(lang === 'en' ? (rules.objetivos[o].en || rules.objetivos[o].t) : rules.objetivos[o].t).toUpperCase()}
                </div>
                {rules.actividades.filter((a) => a.o === o).map((a) => (
                  <ActRow key={a.id} act={a} objColor={rules.objetivos[a.o].c} escala={rules.escala} lang={lang}
                    value={ratings[a.id]}
                    onRate={(v) => setRatings({ ...ratings, [a.id]: v })}
                    comment={comments[a.id]}
                    onComment={(v) => setComments({ ...comments, [a.id]: v })} />
                ))}
              </div>
            ))}

            {opmId && (
              <>
                <button className={`toggle-btn ${critica ? 'active' : ''}`}
                  style={critica ? { background: '#C0392B', textAlign: 'left', justifyContent: 'flex-start' } : { textAlign: 'left', justifyContent: 'flex-start' }}
                  onClick={() => setCritica(!critica)}>
                  <ShieldAlert size={20} />
                  <span>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{actName(rules.conducta_critica, lang)}</div>
                    <div style={{ fontSize: 11, opacity: .85 }}>
                      {critica
                        ? t.criticaOn(objName(rules.objetivos[rules.conducta_critica.o], lang), rules.conducta_critica.o)
                        : t.criticaOff}
                    </div>
                  </span>
                </button>

                {critica && (
                  <div className="card evento-detail">
                    <label>{t.comentarioSolo}</label>
                    <textarea className="input" rows={3} maxLength={500}
                      value={criticaComment} onChange={(e) => setCriticaComment(e.target.value)}
                      placeholder={t.eventoPlaceholder} />

                    <label>{t.fotoOpcional}</label>
                    {criticaPhotoPreview ? (
                      <div className="evento-photo-preview">
                        <img src={criticaPhotoPreview} alt={t.fotoAlt} />
                        <button type="button" className="iconbtn danger" onClick={quitarCriticaPhoto} aria-label={t.quitarFoto}>
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <button type="button" className="toggle-btn" onClick={() => criticaPhotoRef.current?.click()}>
                        <Camera size={16} /> {t.subirFoto}
                      </button>
                    )}
                    <input ref={criticaPhotoRef} type="file" accept="image/jpeg,image/png,image/webp"
                      style={{ display: 'none' }} onChange={onCriticaPhoto} />
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
              <div className="stat"><div className={`n ${stats.conductas > 0 ? 'alert' : ''}`}>{stats.conductas}</div><div className="l">{t.conductasCriticas}</div></div>
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

            {shown.length === 0 ? (
              <div className="muted" style={{ marginTop: 12 }}>{t.sinRegistros}</div>
            ) : (
              <div style={{ marginTop: 12 }}>
                {shown.map((r) => {
                  const puedeBorrar = user.role === 'admin' || Number(r.supervisor_id) === Number(user.id)
                  const tieneCritica = Number(r.conducta_critica) === 1
                  const tieneDetalle = tieneCritica && (r.conducta_photo || r.conducta_comment)
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
                          <div className="meta">{t.turnoLbl(turnoText(r.turno, lang))}</div>
                          <div className="meta">{t.evaluadoPor(r.supervisor_name)}</div>
                        </button>
                        {tieneCritica && (
                          <button type="button" className="badge badge-btn" style={{ background: 'var(--red)' }}
                            disabled={!tieneDetalle}
                            onClick={() => setExpandedId(abierto ? null : r.id)}>
                            {t.conductaChip} {tieneDetalle && <ChevronDown size={12} className={abierto ? 'rot' : ''} />}
                          </button>
                        )}
                        <a className="iconbtn ghost" href={`#/imprimir-compromiso/${r.id}`} target="_blank" rel="noreferrer"
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
                          {r.conducta_photo && (
                            <a href={SITE_BASE + r.conducta_photo} target="_blank" rel="noreferrer" className="evento-photo-link">
                              <img src={SITE_BASE + r.conducta_photo} alt={t.fotoAlt} />
                            </a>
                          )}
                          {r.conducta_comment && <div className="evento-comment">{r.conducta_comment}</div>}
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
