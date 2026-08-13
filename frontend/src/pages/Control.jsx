import { useEffect, useState } from 'react'
import { ChevronDown, AlertTriangle, Printer, Users } from 'lucide-react'
import { api } from '../api.js'
import { useAuth } from '../auth.jsx'
import { useShift } from '../shift.jsx'
import { colorNivel, nivel5, currentQuarter } from '../rules.js'
import { colorNivel as colorNivelC, nivel5 as nivel5C } from '../rulesCompromiso.js'
import TopBar from '../components/TopBar.jsx'
import { T, useLang, turnoText, estadoLabel, cargaLabel } from '../i18n.js'

const PISO = 8
const PISO_C = 4

const fmtDate = (d) => { if (!d) return ''; const [y, m, day] = d.split('-'); return `${day}/${m}/${y}` }

export default function Control() {
  const { user } = useAuth()
  const { shift } = useShift()
  const [lang] = useLang()
  const t = T[lang]
  const [vista, setVista] = useState('desempeno') // 'desempeno' | 'compromiso'
  const [rules, setRules] = useState(null)
  const [rulesC, setRulesC] = useState(null)
  const [data, setData] = useState(null)
  const [dataC, setDataC] = useState(null)
  const [year, setYear] = useState(new Date().getFullYear())
  const [quarter, setQuarter] = useState(currentQuarter())
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState(null)
  const [detalle, setDetalle] = useState({})
  const [detalleLoading, setDetalleLoading] = useState(false)
  const [q, setQ] = useState('')
  const [estadoFiltro, setEstadoFiltro] = useState('todos')

  useEffect(() => {
    api.rules().then((r) => setRules(r.rules))
    api.compromisoRules().then((r) => setRulesC(r.rules))
  }, [])

  useEffect(() => {
    setLoading(true)
    Promise.all([api.control(year, quarter), api.controlCompromiso(year, quarter)])
      .then(([d, dc]) => { setData(d); setDataC(dc) })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false))
  }, [year, quarter])

  const esDesempeno = vista === 'desempeno'
  const rulesActivas = esDesempeno ? rules : rulesC
  const dataActiva = esDesempeno ? data : dataC
  const piso = rulesActivas?.params?.piso ?? (esDesempeno ? PISO : PISO_C)
  const nivel5Fn = esDesempeno ? nivel5 : nivel5C
  const colorNivelFn = esDesempeno ? colorNivel : colorNivelC

  const norm = (s) => (s || '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const term = norm(q)
  const selectedOpms = new Set((shift.selectedOpms || []).map(Number))
  const control = (dataActiva?.control ?? []).filter((row) => user.role === 'admin' || selectedOpms.has(Number(row.id)))
  const resumenEstados = control.reduce((resumen, r) => {
    if (r.n === 0) resumen.noIniciados += 1
    else if (r.estado.t === 'VÁLIDA') resumen.completos += 1
    else resumen.iniciados += 1
    return resumen
  }, { iniciados: 0, noIniciados: 0, completos: 0 })
  const filtrados = control.filter((r) => {
    const coincideBusqueda = !term || norm(r.code).includes(term) || norm(r.full_name).includes(term)
    const coincideEstado = estadoFiltro === 'todos'
      || (estadoFiltro === 'iniciados' && r.n > 0 && r.estado.t !== 'VÁLIDA')
      || (estadoFiltro === 'noIniciados' && r.n === 0)
      || (estadoFiltro === 'completos' && r.estado.t === 'VÁLIDA')
    return coincideBusqueda && coincideEstado
  })

  function detalleKey(opmId) {
    return `${vista}:${opmId}:${year}:${quarter}`
  }

  async function toggleDetalle(opmId) {
    if (expandedId === opmId) { setExpandedId(null); return }
    setExpandedId(opmId)
    const key = detalleKey(opmId)
    if (detalle[key]) return
    setDetalleLoading(true)
    try {
      const d = esDesempeno
        ? await api.shiftRecords(year, quarter, opmId)
        : await api.compromisoRecords(year, quarter, opmId)
      const records = esDesempeno ? d.shift_records : d.compromiso_records
      setDetalle((prev) => ({ ...prev, [key]: records }))
    } catch (e) {
      setErr(e.message)
    } finally {
      setDetalleLoading(false)
    }
  }

  return (
    <>
      <TopBar title={t.controlTitulo} />
      <div className="content">
        <div className="tab-bar" style={{ marginBottom: 12 }}>
          <button className={`tab-btn ${esDesempeno ? 'active' : ''}`} onClick={() => { setVista('desempeno'); setExpandedId(null); setEstadoFiltro('todos') }}>
            {t.porDesempeno}
          </button>
          <button className={`tab-btn ${!esDesempeno ? 'active' : ''}`} onClick={() => { setVista('compromiso'); setExpandedId(null); setEstadoFiltro('todos') }}>
            {t.porCompromiso}
          </button>
        </div>

        {!loading && dataActiva && (
          <div className="control-status-grid" aria-label={t.resumenEstados}>
            <button type="button" className={`control-status-card initiated ${estadoFiltro === 'iniciados' ? 'active' : ''}`}
              onClick={() => setEstadoFiltro((f) => f === 'iniciados' ? 'todos' : 'iniciados')} aria-pressed={estadoFiltro === 'iniciados'}>
              <span className="n">{resumenEstados.iniciados}</span>
              <span className="l">{t.iniciados}</span>
            </button>
            <button type="button" className={`control-status-card not-started ${estadoFiltro === 'noIniciados' ? 'active' : ''}`}
              onClick={() => setEstadoFiltro((f) => f === 'noIniciados' ? 'todos' : 'noIniciados')} aria-pressed={estadoFiltro === 'noIniciados'}>
              <span className="n">{resumenEstados.noIniciados}</span>
              <span className="l">{t.noIniciados}</span>
            </button>
            <button type="button" className={`control-status-card completed ${estadoFiltro === 'completos' ? 'active' : ''}`}
              onClick={() => setEstadoFiltro((f) => f === 'completos' ? 'todos' : 'completos')} aria-pressed={estadoFiltro === 'completos'}>
              <span className="n">{resumenEstados.completos}</span>
              <span className="l">{t.completos}</span>
            </button>
          </div>
        )}

        <div className="period-picker">
          <select className="input" value={quarter} onChange={(e) => setQuarter(Number(e.target.value))}>
            {t.trimestres.map((label, i) => <option key={i} value={i + 1}>{label}</option>)}
          </select>
          <select className="input" value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {[year - 1, year, year + 1].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        {err && <div className="error">{err}</div>}
        {loading && <div className="empty">{t.cargando}</div>}

        {!loading && dataActiva && control.every((r) => r.n === 0) && (
          <div className="empty">
            <Users size={32} />
            <div style={{ fontWeight: 600, color: '#334155' }}>{t.sinFichasTitulo}</div>
            <div>{t.sinFichasDesc(esDesempeno ? t.tipoTurnos : t.tipoCompromiso)}</div>
          </div>
        )}

        {!loading && dataActiva && !control.every((r) => r.n === 0) && (
          <>
            <input className="input" style={{ marginBottom: 12 }} value={q} onChange={(e) => setQ(e.target.value)}
              placeholder={t.buscar} />

            <div className="warn-box" style={{ marginBottom: 12 }}>
              <AlertTriangle size={16} color="#EF7D00" style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{t.reglaValidez(piso, rulesActivas?.params?.minSupers)}</span>
            </div>

            {filtrados.length === 0 && <div className="empty">{t.sinResultados(q)}</div>}

            {filtrados.map((r) => (
              <div key={r.id} className="section-card">
                <div style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{r.code} · {r.full_name}</div>
                    <div className="muted">
                      {t.nFichas(r.n)} · {t.nSupers(r.supers)}
                      {esDesempeno && r.eventos > 0 && <span style={{ color: '#C0392B', fontWeight: 600 }}> · {t.nEventos(r.eventos)}</span>}
                      {!esDesempeno && r.criticas > 0 && <span style={{ color: '#C0392B', fontWeight: 600 }}> · {t.nCriticas(r.criticas)}</span>}
                    </div>
                  </div>
                  <span className="badge" style={{ background: r.estado.c }}>{estadoLabel(r.estado.t, lang)}</span>
                  <a className="iconbtn ghost" href={`#/evaluar/imprimir/${r.id}?year=${year}&quarter=${quarter}&lang=${lang}`} target="_blank" rel="noreferrer" aria-label={t.imprimir} title={t.imprimir}>
                    <Printer size={16} />
                  </a>
                </div>

                <div style={{ padding: '0 12px 10px' }}>
                  <div className="bar-track">
                    <div className="bar-fill" style={{ width: `${Math.min(100, (r.n / piso) * 100)}%`, background: r.n >= piso ? '#1E7B34' : '#C0392B' }} />
                  </div>
                  <div className="muted" style={{ marginTop: 4 }}>{t.deFichasMin(r.n, piso)}</div>
                </div>

                {r.n > 0 && rulesActivas && (
                  <div style={{ padding: '0 12px 12px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(56px, 1fr))', gap: 6 }}>
                    {Object.keys(rulesActivas.objetivos).map((o) => {
                      const v = r.obj[o]
                      return (
                        <div key={o} style={{ background: '#f1f5f9', borderRadius: 8, padding: '6px 0', textAlign: 'center' }}>
                          <div style={{ fontSize: 9, fontWeight: 700, color: rulesActivas.objetivos[o].c }}>{o}</div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: v == null ? '#cbd5e1' : colorNivelFn(nivel5Fn(v, rulesActivas.params)) }}>
                            {v == null ? '—' : v.toFixed(2)}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {esDesempeno && r.n > 0 && rulesActivas && (
                  <div style={{ padding: '0 12px 12px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 6 }}>
                    {rulesActivas.cargas.map((c) => {
                      const n = r.cob[c] ?? 0
                      const min = rulesActivas.params.minCarga
                      const completo = n >= min
                      return (
                        <div key={c} style={{ background: completo ? '#eafaf0' : '#f1f5f9', borderRadius: 8, padding: '6px 8px', textAlign: 'center' }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: '#475569' }}>{cargaLabel(c, lang, rulesActivas)}</div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: completo ? '#1E7B34' : '#334155' }}>
                            {t.deN(n, min)} {completo ? '✓' : ''}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {r.n > 0 && (
                  <button type="button" className="tab-btn" style={{ width: '100%', borderRadius: 0, borderTop: '1px solid var(--border)' }}
                    onClick={() => toggleDetalle(r.id)}>
                    {t.verDetalle} <ChevronDown size={14} className={expandedId === r.id ? 'rot' : ''} />
                  </button>
                )}

                {expandedId === r.id && (
                  <div style={{ padding: 12, borderTop: '1px solid var(--border)' }}>
                    {detalleLoading && !detalle[detalleKey(r.id)] && <div className="muted">{t.cargando}</div>}
                    {detalle[detalleKey(r.id)] && detalle[detalleKey(r.id)].length === 0 && (
                      <div className="muted">{t.sinFichasRegistradas}</div>
                    )}
                    {detalle[detalleKey(r.id)]?.map((f) => (
                      <div key={f.id} className="prom-row" style={{ alignItems: 'flex-start' }}>
                        <span className="grow label">
                          {fmtDate(f.work_date)} · {t.turnoLbl(turnoText(f.turno, lang))}
                          {esDesempeno && <> · {cargaLabel(f.carga, lang, rulesActivas)}</>}
                        </span>
                        <span className="muted" style={{ fontSize: 11 }}>{f.supervisor_name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </>
        )}
      </div>
    </>
  )
}
