import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AlertTriangle, Printer } from 'lucide-react'
import { api } from '../api.js'
import { useAuth } from '../auth.jsx'
import { useShift } from '../shift.jsx'
import { nivel5, colorNivel, currentQuarter } from '../rules.js'
import { T, useLang, objName, nivelText, estadoLabel } from '../i18n.js'
import TopBar from '../components/TopBar.jsx'

export default function Evaluacion() {
  const { opmId } = useParams()
  return opmId ? <EvaluacionDetalle opmId={Number(opmId)} /> : <EvaluacionLista />
}

function usePeriod() {
  const [sp] = useSearchParams()
  const year = Number(sp.get('year')) || new Date().getFullYear()
  const quarter = Number(sp.get('quarter')) || currentQuarter()
  return { year, quarter }
}

function EvaluacionLista() {
  const nav = useNavigate()
  const { user } = useAuth()
  const { shift } = useShift()
  const inicial = usePeriod()
  const [lang] = useLang()
  const [year, setYear] = useState(inicial.year)
  const [quarter, setQuarter] = useState(inicial.quarter)
  const [rows, setRows] = useState(null)
  const [err, setErr] = useState('')
  const [q, setQ] = useState('')

  const t = T[lang]

  useEffect(() => {
    Promise.all([api.control(year, quarter), api.controlCompromiso(year, quarter)])
      .then(([d, dc]) => {
        const compromisoMap = new Map(dc.control.map((r) => [r.id, r]))
        setRows(d.control.map((r) => ({ ...r, compromiso: compromisoMap.get(r.id) })))
      })
      .catch((e) => setErr(e.message))
  }, [year, quarter])

  const norm = (s) => (s || '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const term = norm(q)
  const selectedOpms = new Set((shift.selectedOpms || []).map(Number))
  const teamRows = rows ? rows.filter((row) => user.role === 'admin' || selectedOpms.has(Number(row.id))) : null
  const shown = teamRows ? teamRows.filter((r) => !term || norm(r.code).includes(term) || norm(r.full_name).includes(term)) : null

  const stats = teamRows ? {
    total: teamRows.reduce((s, r) => s + r.n, 0),
    completadas: teamRows.filter((r) => r.estado.t === 'VÁLIDA' && r.compromiso?.estado.t === 'VÁLIDA').length,
    eventos: teamRows.reduce((s, r) => s + r.eventos, 0),
  } : null

  return (
    <>
      <TopBar title={t.tituloEval} />
      <div className="content">
        {err && <div className="error">{err}</div>}

        {stats && (
          <div className="stat-grid" style={{ marginBottom: 14 }}>
            <div className="stat"><div className="n">{stats.total}</div><div className="l">{t.fichasTrimestre}</div></div>
            <div className="stat"><div className="n">{stats.completadas}</div><div className="l">{t.fichasCompletadas}</div></div>
            <div className="stat"><div className={`n ${stats.eventos > 0 ? 'alert' : ''}`}>{stats.eventos}</div><div className="l">{t.fichasSeguridad}</div></div>
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

        <div className="muted" style={{ margin: '10px 0' }}>{t.elijaOperario(quarter, year)}</div>
        <input className="input" style={{ marginBottom: 12 }} value={q} onChange={(e) => setQ(e.target.value)}
          placeholder={t.buscar} />
        {!rows && <div className="empty">{t.cargando}</div>}
        {rows && shown.length === 0 && <div className="empty">{t.sinResultados(q)}</div>}
        {shown && shown.map((r) => (
            <button key={r.id} className="list-row" style={{ width: '100%' }}
              onClick={() => nav(`/evaluar/${r.id}?year=${year}&quarter=${quarter}`)}>
              <div className="grow" style={{ textAlign: 'left' }}>
                <div className="name">{r.code} · {r.full_name}</div>
                <div className="meta">{t.fichasResumen(r.n, r.compromiso?.n ?? 0)}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                <span className="badge" style={{ background: r.estado.c }}>{estadoLabel(r.estado.t, lang)}</span>
                <span className="badge" style={{ background: r.compromiso?.estado.c ?? '#6B7280' }}>
                  {estadoLabel(r.compromiso?.estado.t ?? 'SIN FICHAS', lang)}
                </span>
              </div>
            </button>
        ))}
      </div>
    </>
  )
}

function EvaluacionDetalle({ opmId }) {
  const nav = useNavigate()
  const { year, quarter } = usePeriod()
  const [lang] = useLang()
  const [rules, setRules] = useState(null)
  const [rulesC, setRulesC] = useState(null)
  const [info, setInfo] = useState(null)
  const [evidencias, setEvidencias] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [err, setErr] = useState('')

  const t = T[lang]

  useEffect(() => {
    Promise.all([api.rules(), api.compromisoRules(), api.evaluation(opmId, year, quarter)])
      .then(([r, rc, e]) => {
        setRules(r.rules); setRulesC(rc.rules); setInfo(e)
        const ev = e.evaluation
        setEvidencias(ev?.evidencias_comentarios || '')
        setSaved(!!ev)
      })
      .catch((e) => setErr(e.message))
  }, [opmId, year, quarter])

  if (err) return (<><TopBar title={t.tituloEval} to="/evaluar" /><div className="content"><div className="error">{err}</div></div></>)
  if (!rules || !rulesC || !info) return (<><TopBar title={t.tituloEval} to="/evaluar" /><div className="empty">{t.cargando}</div></>)

  const obj = info.consolidado.obj
  const objC = info.consolidado_compromiso.obj
  const result = info.preview

  async function guardar() {
    setSaving(true); setErr('')
    try {
      await api.saveEvaluation({
        opm_id: opmId, year, quarter,
        evidencias_comentarios: evidencias,
      })
      setSaved(true)
    } catch (e) {
      setErr(e.message || 'No se pudo guardar la evaluación')
    } finally {
      setSaving(false)
    }
  }

  /** Filas de promedio por objetivo, comunes a los bloques A y B. */
  const bloqueObjetivos = (defs, valores, params) =>
    Object.keys(defs).map((o) => {
      const v = valores[o]; const n = nivel5(v, params)
      return (
        <div key={o} className="prom-row">
          <span className="obj-chip" style={{ background: defs[o].c }}>{o}</span>
          <span className="grow label">{objName(defs[o], lang)}</span>
          <span className="muted" style={{ fontSize: 10 }}>{(defs[o].peso * 100).toFixed(0)}%</span>
          <span className="value" style={{ color: v == null ? '#cbd5e1' : colorNivel(n) }}>{v == null ? '—' : v.toFixed(2)}</span>
        </div>
      )
    })

  const totalRow = (score, params) => (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>{t.promedioPond}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 17, fontWeight: 700, color: colorNivel(nivel5(score, params)) }}>{score.toFixed(2)}</span>
        <span className="badge" style={{ background: colorNivel(nivel5(score, params)) }}>{nivelText(nivel5(score, params), lang)}</span>
      </div>
    </div>
  )

  return (
    <>
      <TopBar title={t.tituloEval} to="/evaluar" />
      <div className="content">
        {err && <div className="error">{err}</div>}

        <div className="card">
          <div style={{ fontWeight: 700 }}>{info.opm.code} · {info.opm.full_name}</div>
          <div className="muted">{info.opm.puesto || t.puesto} · {t.quarterFmt(quarter, year)}</div>
          <div className="muted">{t.fichasResumen(info.consolidado.n, info.consolidado_compromiso.n)}</div>
        </div>

        {!info.puede_evaluar && (
          <div className="warn-box" style={{ marginBottom: 12 }}>
            <AlertTriangle size={16} color="#EF7D00" style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{t.evidenciaIncompleta(
              estadoLabel(info.consolidado.estado.t, lang),
              estadoLabel(info.consolidado_compromiso.estado.t, lang))}</span>
          </div>
        )}

        <div className="section-card">
          <div className="section-head" style={{ background: '#002E6D' }}>
            <span className="t">{t.secA}</span>
            <span className="p">70%</span>
          </div>
          <div className="section-body">
            {bloqueObjetivos(rules.objetivos, obj, rules.params)}
            {result.objScore != null && totalRow(result.objScore, rules.params)}
          </div>
        </div>

        <div className="section-card">
          <div className="section-head" style={{ background: '#EF7D00' }}>
            <span className="t">{t.secB}</span>
            <span className="p">30%</span>
          </div>
          <div className="section-body">
            <div className="muted" style={{ marginBottom: 10 }}>{t.modeloB}</div>
            {bloqueObjetivos(rulesC.objetivos, objC, rulesC.params)}
            {result.condScore != null && totalRow(result.condScore, rulesC.params)}
          </div>
        </div>

        {(result.objScore == null || result.condScore == null) ? (
          <div className="empty">{t.faltanFichas}</div>
        ) : (
          <>
            <div className="section-card">
              <div className="section-head" style={{ background: '#002E6D' }}><span className="t">{t.secC}</span></div>
              <div className="section-body">
                <div className="prom-row">
                  <span className="grow label">{t.nivelObj}</span>
                  <span className="badge" style={{ background: colorNivel(nivel5(result.objScore, rules.params)) }}>
                    {nivelText(nivel5(result.objScore, rules.params), lang)}
                  </span>
                </div>
                <div className="prom-row">
                  <span className="grow label">{t.nivelCond}</span>
                  <span className="badge" style={{ background: colorNivel(result.nCond) }}>{nivelText(result.nCond, lang)}</span>
                </div>
                <div className="prom-row">
                  <span className="grow label">{t.comb}</span>
                  <span style={{ fontWeight: 700 }}>{result.comb.toFixed(2)}</span>
                </div>
                {result.bloqueado && (
                  <div className="warn-box" style={{ marginTop: 8, background: '#FDEBD3', color: '#9C5700', border: 'none' }}>
                    <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                    <span>{t.reglaBloqueo}</span>
                  </div>
                )}
              </div>
              <div className="result-final" style={{ background: colorNivel(result.final) }}>
                <div className="l">{t.nivelFinal}</div>
                <div className="v">{nivelText(result.final, lang)}</div>
              </div>
            </div>

            <div className="card">
              <label>{t.evidLabel}</label>
              <textarea className="input" rows={3} maxLength={2000}
                value={evidencias} onChange={(e) => { setEvidencias(e.target.value); setSaved(false) }}
                placeholder={t.evidPlaceholder} />
            </div>

            <button className="btn orange" disabled={saving} onClick={guardar}>
              {saving ? t.guardando : saved ? t.guardado : t.guardar}
            </button>
          </>
        )}
        <button className="btn secondary" style={{ marginTop: 8 }}
          onClick={() => nav(`/evaluar/imprimir/${opmId}?year=${year}&quarter=${quarter}&lang=${lang}`)}>
          <Printer size={16} /> {t.imprimir}
        </button>
      </div>
    </>
  )
}
