import { useEffect, useState } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { Printer, ChevronLeft, Languages } from 'lucide-react'
import { api } from '../api.js'
import { nivel5 } from '../rules.js'
import { T, useLang, objName, nivelText } from '../i18n.js'

export default function EvaluacionImprimir() {
  const { opmId } = useParams()
  const [sp] = useSearchParams()
  const nav = useNavigate()
  const year = Number(sp.get('year')) || new Date().getFullYear()
  const quarter = Number(sp.get('quarter')) || 1
  const [lang, setLang, toggleLang] = useLang()
  const [rules, setRules] = useState(null)
  const [rulesC, setRulesC] = useState(null)
  const [info, setInfo] = useState(null)
  const [err, setErr] = useState('')

  // ?lang=en abre el reporte directamente en inglés (útil para enviar el enlace).
  useEffect(() => { if (sp.get('lang') === 'en' || sp.get('lang') === 'es') setLang(sp.get('lang')) }, [])

  const t = T[lang]

  useEffect(() => {
    Promise.all([api.rules(), api.compromisoRules(), api.evaluation(opmId, year, quarter)])
      .then(([r, rc, e]) => { setRules(r.rules); setRulesC(rc.rules); setInfo(e) })
      .catch((e) => setErr(e.message || 'No se pudo cargar la evaluación'))
  }, [opmId, year, quarter])

  if (err) return <div className="empty">{err}</div>
  if (!rules || !rulesC || !info) return <div className="empty">{t.cargando}</div>
  if (!info.evaluation) return <div className="empty">{t.noSaved}</div>

  // Los puntajes se recalculan siempre en vivo (info.preview), igual que en la pantalla de
  // Evaluar desempeño — así el PDF nunca queda desactualizado respecto de un guardado previo
  // si después se agregaron, editaron o borraron fichas.
  const ev = info.evaluation
  const obj = info.consolidado.obj
  const objC = info.consolidado_compromiso.obj
  const objScore = info.preview.objScore == null ? null : Number(info.preview.objScore)
  const condScore = info.preview.condScore == null ? null : Number(info.preview.condScore)
  const combScore = info.preview.comb == null ? null : Number(info.preview.comb)
  const finalLevel = info.preview.final ?? null
  const bloqueado = info.preview.bloqueado ?? false

  const handleBack = () => {
    window.close()
    setTimeout(() => {
      if (window.history.length > 1) nav(-1)
      else nav('/evaluar')
    }, 100)
  }

  /** Cuerpo de una tabla de objetivos (A o B): objetivo, peso y promedio. */
  const filas = (defs, valores, totalLabel, totalScore) => (
    <tbody>
      {Object.keys(defs).map((o) => {
        const v = valores[o]; const num = v == null ? null : Number(v)
        return (
          <tr key={o}>
            <td className="c-act">{o} · {objName(defs[o], lang)}</td>
            <td className="c-scale">{(defs[o].peso * 100).toFixed(0)}%</td>
            <td className="c-scale strong">{num == null ? '—' : num.toFixed(2)}</td>
          </tr>
        )
      })}
      <tr>
        <td className="c-act strong">{totalLabel}</td>
        <td className="c-scale"></td>
        <td className="c-scale strong">{totalScore == null ? '—' : totalScore.toFixed(2)}</td>
      </tr>
    </tbody>
  )

  return (
    <>
      <div className="topbar no-print">
        <button className="backbtn" onClick={handleBack} aria-label={t.volver}><ChevronLeft size={22} /></button>
        <div style={{ flex: 1 }}><h1 style={{ fontSize: 15 }}>{t.view}</h1></div>
        <button className="btn secondary small" onClick={toggleLang} title={t.switchTo}>
          <Languages size={14} /> {lang === 'es' ? 'EN' : 'ES'}
        </button>
        <button className="btn secondary small" onClick={() => window.print()}>
          <Printer size={14} /> {t.imprimir}
        </button>
      </div>

      <div className="print-sheet">
        <div className="ph-brand">COSCO SHIPPING PORTS CHANCAY PERU S.A. (CSPCP)</div>
        <div className="ph-title">{t.tituloReporte}</div>

        <table className="ph-meta">
          <tbody>
            <tr>
              <td className="k">{t.code}</td><td className="v">{info.opm.code}</td>
              <td className="k">{t.name}</td><td className="v">{info.opm.full_name}</td>
            </tr>
            <tr>
              <td className="k">{t.puestoLbl}</td><td className="v">{info.opm.puesto || '—'}</td>
              <td className="k">{t.quarter}</td><td className="v">{t.quarterFmt(quarter, year)}</td>
            </tr>
            <tr>
              <td className="k">{t.evaluador}</td><td className="v" colSpan={3}></td>
            </tr>
          </tbody>
        </table>

        <table className="ph-table">
          <thead>
            <tr><th colSpan={3} className="ph-block-head">{t.secAr}</th></tr>
            <tr>
              <th className="c-act">{t.objetivo}</th>
              <th className="c-scale" style={{ width: 70 }}>{t.peso}</th>
              <th className="c-scale" style={{ width: 110 }}>{t.promedio}</th>
            </tr>
          </thead>
          {filas(rules.objetivos, obj, t.totalA, objScore)}
        </table>

        <table className="ph-table" style={{ marginTop: 14 }}>
          <thead>
            <tr><th colSpan={3} className="ph-block-head orange">{t.secBr}</th></tr>
            <tr>
              <th className="c-act">{t.objetivo}</th>
              <th className="c-scale" style={{ width: 70 }}>{t.peso}</th>
              <th className="c-scale" style={{ width: 110 }}>{t.promedio}</th>
            </tr>
          </thead>
          {filas(rulesC.objetivos, objC, t.totalB, condScore)}
        </table>

        <table className="ph-table" style={{ marginTop: 14 }}>
          <thead>
            <tr><th colSpan={2} className="ph-block-head">{t.secC}</th></tr>
          </thead>
          <tbody>
            <tr>
              <td className="c-act">{t.nivelObj}</td>
              <td className="c-result strong">{objScore == null ? '—' : nivelText(nivel5(objScore, rules.params), lang)}</td>
            </tr>
            <tr>
              <td className="c-act">{t.nivelCond}</td>
              <td className="c-result strong">{condScore == null ? '—' : nivelText(nivel5(condScore, rulesC.params), lang)}</td>
            </tr>
            <tr>
              <td className="c-act">{t.combR}</td>
              <td className="c-result strong">{combScore == null ? '—' : combScore.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>

        <div className="ph-block-head" style={{ textAlign: 'center', fontSize: 16, padding: 14 }}>
          {t.nivelFinal} · {nivelText(finalLevel, lang)}
        </div>

        {bloqueado && <div className="ph-alert">{t.reglaBloqueo}</div>}
        <div className="ph-note">
          {t.evidencia(info.consolidado.n, info.consolidado.supers,
            info.consolidado_compromiso.n, info.consolidado_compromiso.supers)}
        </div>

        <div className="ph-obs">
          <div className="ph-obs-title">{t.secDr}</div>
          <div className="ph-obs-line">{ev.evidencias_comentarios || t.sinComentarios}</div>
        </div>

        <div className="ph-sign">
          <div>{t.firmaOpm}</div>
          <div>{t.firmaRrhh}</div>
          <div>{t.firmaJefe}</div>
        </div>
      </div>
    </>
  )
}
