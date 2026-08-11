import { Fragment, useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Printer, ChevronLeft, Languages } from 'lucide-react'
import { api, SITE_BASE } from '../api.js'
import { nivel5, visibleBlocks } from '../rules.js'
import { T, useLang, objName, blockTitle, actName, cargaLabel, turnoText, nivelText } from '../i18n.js'

const fmtDate = (d) => { if (!d) return ''; const [y, m, day] = d.split('-'); return `${day}/${m}/${y}` }
const ESCALA = [1, 2, 3, 4, 5]

export default function FichaImprimir() {
  const { id } = useParams()
  const [lang, , toggleLang] = useLang()
  const nav = useNavigate()
  const [rules, setRules] = useState(null)
  const [record, setRecord] = useState(null)
  const [err, setErr] = useState('')
  const t = T[lang]

  useEffect(() => {
    Promise.all([api.rules(), api.shiftRecord(id)])
      .then(([r, s]) => { setRules(r.rules); setRecord(s.shift_record) })
      .catch((e) => setErr(e.message || 'No se pudo cargar la ficha'))
  }, [id])

  if (err) return <div className="empty">{err}</div>
  if (!rules || !record) return <div className="empty">{t.cargando}</div>

  const ratingMap = {}
  record.ratings.forEach((r) => { ratingMap[r.activity_code] = r })

  const bloques = visibleBlocks(rules.bloques, record.carga, Number(record.amarre) === 1)

  const observaciones = []
  bloques.forEach((b) => b.acts.forEach((a) => {
    const c = ratingMap[a.id]?.comment
    if (c) observaciones.push(`${actName(a, lang)}: ${c}`)
  }))
  if (record.evento_comment) observaciones.push(`${t.eventoTitulo}: ${record.evento_comment}`)

  // Solo cuentan las tareas realmente calificadas: las marcadas "No aplica"
  // (rating NULL) no entran en el divisor del promedio.
  const tareasPorObjetivo = {}
  record.ratings.forEach((r) => {
    if (r.rating == null) return
    tareasPorObjetivo[r.objective] = (tareasPorObjetivo[r.objective] || 0) + 1
  })

  const handleBack = () => {
    window.close()
    setTimeout(() => {
      if (window.history.length > 1) {
        nav(-1)
      } else {
        nav('/ficha')
      }
    }, 100)
  }

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
        <div className="ph-title">{t.fichaPrintTitulo}</div>

        <table className="ph-meta">
          <tbody>
            <tr>
              <td className="k">{t.fecha}</td><td className="v">{fmtDate(record.work_date)}</td>
              <td className="k">{t.turnoK}</td><td className="v">{turnoText(record.turno, lang)}</td>
            </tr>
            <tr>
              <td className="k">{t.code}</td><td className="v">{record.opm_code}</td>
              <td className="k">{t.tipoCarga}</td><td className="v">{cargaLabel(record.carga, lang, rules)}</td>
            </tr>
            <tr>
              <td className="k">{t.name}</td><td className="v" colSpan={3}>{record.opm_name}</td>
            </tr>
            <tr>
              <td className="k">{t.naveK}</td><td className="v" colSpan={3}>{record.nave || '—'}</td>
            </tr>
            <tr>
              <td className="k">{t.supervisorK}</td><td className="v" colSpan={3}>{record.supervisor_name}</td>
            </tr>
          </tbody>
        </table>

        <table className="ph-table">
          <thead>
            <tr>
              <th className="c-obj">{t.objK}</th>
              <th className="c-act">{t.actividadK}</th>
              {ESCALA.map((v) => <th key={v} className="c-scale">{v}</th>)}
              <th className="c-scale">{t.ptsK}</th>
            </tr>
          </thead>
          <tbody>
            {bloques.map((b) => (
              <Fragment key={b.id}>
                <tr>
                  <td colSpan={8} className={`ph-block-head ${b.id === 'prod' ? 'orange' : ''}`}>{blockTitle(b, lang).toUpperCase()}</td>
                </tr>
                {b.acts.map((a) => {
                  const rr = ratingMap[a.id]
                  const pts = rr && rr.rating != null ? Number(rr.rating) : null
                  return (
                    <tr key={a.id}>
                      <td className="c-obj"><span className="obj-chip" style={{ background: rules.objetivos[a.o].c }}>{a.o}</span></td>
                      <td className="c-act">{actName(a, lang)}</td>
                      {ESCALA.map((v) => <td key={v} className="c-scale">{pts === v ? '✕' : ''}</td>)}
                      <td className="c-scale strong">{rr ? (pts ?? 'N/A') : ''}</td>
                    </tr>
                  )
                })}
              </Fragment>
            ))}
            <tr>
              <td colSpan={8} className="ph-block-head orange">{t.seguridadK}</td>
            </tr>
            <tr>
              <td className="c-obj"><span className="obj-chip" style={{ background: rules.objetivos.O1.c }}>O1</span></td>
              <td className="c-act">{t.banderaK}</td>
              <td className="c-scale strong" colSpan={3}>{Number(record.evento_seguridad) === 1 ? `${t.siLbl} ✕` : t.siLbl}</td>
              <td className="c-scale strong" colSpan={3}>{Number(record.evento_seguridad) === 1 ? t.noLbl : `${t.noLbl} ✕`}</td>
            </tr>
          </tbody>
        </table>

        <table className="ph-table" style={{ marginTop: 14 }}>
          <thead>
            <tr><th colSpan={5} className="ph-subtitle">{t.promObjTitulo}</th></tr>
            <tr>
              <th className="c-obj">{t.objK}</th><th className="c-act">{t.objetivo}</th>
              <th className="c-scale">{t.tareasCalif}</th><th className="c-scale">{t.promedio}</th><th className="c-scale" style={{ width: 100 }}>{t.nivelCspcp}</th>
            </tr>
          </thead>
          <tbody>
            {Object.keys(rules.objetivos).map((o) => {
              const v = record[`obj_${o.toLowerCase()}`]
              const num = v == null ? null : Number(v)
              return (
                <tr key={o}>
                  <td className="c-obj"><span className="obj-chip" style={{ background: rules.objetivos[o].c }}>{o}</span></td>
                  <td className="c-act">{objName(rules.objetivos[o], lang)}</td>
                  <td className="c-scale">{tareasPorObjetivo[o] || 0}</td>
                  <td className="c-scale strong">{num == null ? '—' : num.toFixed(2)}</td>
                  <td className="c-scale" style={{ width: 100 }}>{num == null ? '—' : nivelText(nivel5(num, rules.params), lang)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {Number(record.evento_seguridad) === 1 && (
          <div className="ph-alert">{t.alertaEvento}</div>
        )}
        <div className="ph-note">{t.notaPrint(rules.params.minimo)}</div>

        <div className="ph-obs">
          <div className="ph-obs-title">{t.obsTurno}</div>
          {observaciones.length === 0 ? (
            <div className="ph-obs-line muted">{t.sinObs}</div>
          ) : observaciones.map((o, i) => <div key={i} className="ph-obs-line">{o}</div>)}
        </div>

        {record.evento_photo && (
          <div className="ph-obs">
            <div className="ph-obs-title">{t.fotoEvento}</div>
            <img className="ph-photo" src={SITE_BASE + record.evento_photo} alt={t.fotoAlt} />
          </div>
        )}

        <div className="ph-sign">
          <div>{t.firmaSuper(record.supervisor_name)}</div>
          <div>{t.fechaFirma(fmtDate(record.work_date))}</div>
        </div>
      </div>
    </>
  )
}
