import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Printer, TriangleAlert } from 'lucide-react'
import TopBar from '../../components/TopBar.jsx'
import { api, SITE_BASE } from '../../api.js'
import { turnoLabel } from '../../shift.jsx'
import { COLOR_ITEM, ESTADO_ITEM, fechaLarga, instalacionPorId, semaforo } from '../../limpieza.js'

export default function LimpiezaInspeccionDetalle() {
  const { id } = useParams()
  const nav = useNavigate()
  const [reg, setReg] = useState(undefined)
  const [hallazgos, setHallazgos] = useState([])

  useEffect(() => {
    api.limpiezaInspeccion(id).then(setReg).catch(() => setReg(null))
    api.limpiezaHallazgos().then(setHallazgos).catch(() => setHallazgos([]))
  }, [id])

  if (reg === undefined) {
    return (
      <>
        <TopBar title="Acta de relevo" to="/limpieza/inspeccion" />
        <div className="content"><div className="empty">Cargando…</div></div>
      </>
    )
  }
  if (!reg) {
    return (
      <>
        <TopBar title="Acta de relevo" to="/limpieza/inspeccion" />
        <div className="content"><div className="empty">No se encontró la inspección.</div></div>
      </>
    )
  }

  const ins = instalacionPorId(reg.instalacion)
  const sem = semaforo(reg.conformidad)
  const noConformes = reg.items.filter((i) => i.estado === 'NC')
  const yaTieneHallazgo = (itemId) => hallazgos.some((h) => h.origen === `${reg.id}:${itemId}`)

  return (
    <>
      <TopBar title="Acta de relevo" to="/limpieza/inspeccion" />
      <div className="content limpieza-print">
        {noConformes.length > 0 && (
          <div className="card" style={{ borderTop: '3px solid var(--red)' }}>
            <h3>
              <TriangleAlert size={15} style={{ verticalAlign: -2, marginRight: 5, color: 'var(--red)' }} />
              Ítems no conformes
            </h3>
            <p className="muted" style={{ marginTop: 0 }}>
              Cada uno puede convertirse en un hallazgo con su responsable de aprobación.
            </p>
            {noConformes.map((it) => (
              <div key={it.id} style={{ padding: '10px 0', borderTop: '1px solid #f1f5f9' }}>
                <div className="act-name" style={{ marginBottom: 6 }}>{it.texto}</div>
                {it.comentario && <div className="evento-comment" style={{ marginBottom: 8 }}>{it.comentario}</div>}
                {it.foto && (
                  <a
                    className="evento-photo-link"
                    href={SITE_BASE + it.foto}
                    target="_blank"
                    rel="noreferrer"
                    style={{ marginBottom: 8 }}
                  >
                    <img src={SITE_BASE + it.foto} alt="Evidencia del ítem" />
                  </a>
                )}
                {yaTieneHallazgo(it.id) ? (
                  <span className="badge" style={{ background: 'var(--green)' }}>Hallazgo generado</span>
                ) : (
                  <button
                    className="btn small danger"
                    onClick={() =>
                      nav('/limpieza/hallazgos/nuevo', {
                        state: {
                          instalacion: reg.instalacion,
                          ubicacion: reg.ubicacion,
                          descripcion: it.comentario || it.texto,
                          origen: `${reg.id}:${it.id}`,
                        },
                      })
                    }
                  >
                    Generar hallazgo
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="print-sheet">
          <div className="ph-brand">COSCO SHIPPING PORTS CHANCAY PERÚ · GERENCIA DE OPERACIONES</div>
          <div className="ph-title">ACTA DE INSPECCIÓN CRUZADA DE RELEVO</div>

          <table className="ph-meta">
            <tbody>
              <tr>
                <td className="k">Instalación</td><td>{ins?.nombre}</td>
                <td className="k">Ubicación</td><td>{reg.ubicacion}</td>
              </tr>
              <tr>
                <td className="k">Fecha</td><td>{fechaLarga(reg.fecha)}</td>
                <td className="k">Zona</td><td>{ins?.zona}</td>
              </tr>
              <tr>
                <td className="k">Turno entrega</td><td>{turnoLabel(reg.turnoSaliente)}</td>
                <td className="k">Turno recibe</td><td>{turnoLabel(reg.turnoEntrante)}</td>
              </tr>
              <tr>
                <td className="k">Inspector</td><td>{reg.inspector}</td>
                <td className="k">Cargo</td><td>{reg.inspectorCargo}</td>
              </tr>
              <tr>
                <td className="k">Aprobador</td><td colSpan={3}>{ins?.aprobador}</td>
              </tr>
            </tbody>
          </table>

          <table className="ph-table">
            <thead>
              <tr>
                <th className="c-obj">#</th>
                <th className="c-act">Ítem del estándar</th>
                <th className="c-scale">Res.</th>
              </tr>
            </thead>
            <tbody>
              {reg.items.map((it, i) => (
                <tr key={it.id}>
                  <td className="c-obj">{i + 1}</td>
                  <td className="c-act">
                    {it.texto}
                    {it.comentario && (
                      <div style={{ color: '#C0392B', fontSize: 11, marginTop: 3 }}>Obs.: {it.comentario}</div>
                    )}
                    {it.foto && <img className="ph-foto" src={SITE_BASE + it.foto} alt="Evidencia" />}
                  </td>
                  <td className="c-scale strong" style={{ color: COLOR_ITEM[it.estado] }}>
                    {ESTADO_ITEM[it.estado]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="ph-block-head" style={{ background: sem.color }}>
            RESULTADO: {reg.conformidad === null ? 'SIN DATOS' : `${reg.conformidad}% DE CONFORMIDAD`} ·{' '}
            {sem.label.toUpperCase()}
          </div>
        </div>

        <button className="btn secondary" onClick={() => window.print()}>
          <Printer size={16} /> Imprimir acta
        </button>
      </div>
    </>
  )
}
