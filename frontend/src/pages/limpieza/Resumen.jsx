import { useEffect, useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import TopBar from '../../components/TopBar.jsx'
import { api } from '../../api.js'
import { TURNOS, turnoLabel } from '../../shift.jsx'
import {
  ESTADOS, FASES, INSTALACIONES, PREGUNTAS, aCSV, descargarCSV,
  instalacionPorId, semaforo,
} from '../../limpieza.js'

const prom = (nums) => (nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null)
const f1 = (n) => (n === null ? '—' : n.toFixed(1))
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`

export default function LimpiezaResumen() {
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([api.limpiezaEncuestas(), api.limpiezaInspecciones(), api.limpiezaHallazgos()])
      .then(([encuestas, inspecciones, hallazgos]) => setDatos({ encuestas, inspecciones, hallazgos }))
      .catch((e) => {
        setError(e.message)
        setDatos({ encuestas: [], inspecciones: [], hallazgos: [] })
      })
  }, [])

  const porPregunta = useMemo(() => {
    if (!datos) return []
    return PREGUNTAS.map((p) => {
      const de = (fase) =>
        prom(datos.encuestas.filter((e) => e.fase === fase).map((e) => e.respuestas[p.id]).filter(Boolean))
      return { p, diagnostico: de('diagnostico'), cierre: de('cierre') }
    })
  }, [datos])

  const porInstalacion = useMemo(() => {
    if (!datos) return []
    return INSTALACIONES.map((ins) => {
      const insp = datos.inspecciones.filter((i) => i.instalacion === ins.id && i.conformidad !== null)
      const hall = datos.hallazgos.filter((h) => h.instalacion === ins.id)
      return {
        ins,
        conformidad: prom(insp.map((i) => i.conformidad)),
        inspecciones: insp.length,
        hallazgos: hall.length,
        abiertos: hall.filter((h) => h.estado !== 'cerrado').length,
      }
    })
  }, [datos])

  const porTurno = useMemo(() => {
    if (!datos) return []
    return TURNOS.map((t) => ({
      t,
      hallazgos: datos.hallazgos.filter((h) => h.turno === t.v).length,
      inspecciones: datos.inspecciones.filter((i) => i.turnoEntrante === t.v).length,
    }))
  }, [datos])

  const porEstado = useMemo(() => {
    if (!datos) return []
    return ESTADOS.map((e) => ({ e, total: datos.hallazgos.filter((h) => h.estado === e.id).length }))
  }, [datos])

  if (!datos) {
    return (
      <>
        <TopBar title="Reporte consolidado" to="/limpieza" />
        <div className="content"><div className="empty">Cargando…</div></div>
      </>
    )
  }

  const exportarHallazgos = () => {
    descargarCSV('hallazgos-limpieza.csv', aCSV(datos.hallazgos, [
      { label: 'Fecha', get: (h) => h.fecha },
      { label: 'Turno', get: (h) => turnoLabel(h.turno) },
      { label: 'Instalación', get: (h) => instalacionPorId(h.instalacion)?.nombre },
      { label: 'Ubicación', get: (h) => h.ubicacion },
      { label: 'Descripción', get: (h) => h.descripcion },
      { label: 'Trabajador', get: (h) => h.trabajador },
      { label: 'Aprobador', get: (h) => h.aprobador },
      { label: 'Estado', get: (h) => h.estado },
      { label: 'Registrado por', get: (h) => h.registradoPor },
      { label: 'Cierre', get: (h) => (h.cierre ? `${h.cierre.fecha} - ${h.cierre.verificadoPor}` : '') },
    ]))
  }

  const exportarEncuestas = () => {
    descargarCSV('encuestas-percepcion.csv', aCSV(datos.encuestas, [
      { label: 'Fecha', get: (e) => e.fecha },
      { label: 'Fase', get: (e) => e.fase },
      { label: 'Turno', get: (e) => turnoLabel(e.turno) },
      { label: 'Empleado', get: (e) => e.empleado },
      { label: 'Nombre', get: (e) => e.nombre },
      { label: 'Cargo', get: (e) => e.cargo },
      { label: 'Zona', get: (e) => e.zona },
      ...PREGUNTAS.map((p, i) => ({ label: `P${i + 1}`, get: (e) => e.respuestas[p.id] })),
      { label: 'Promedio', get: (e) => e.promedio },
      { label: 'Instalación que preocupa', get: (e) => instalacionPorId(e.preocupa)?.nombre || '' },
      { label: 'Comentario', get: (e) => e.comentario },
    ]))
  }

  return (
    <>
      <TopBar title="Reporte consolidado" to="/limpieza" />
      <div className="content">
        {error && <div className="error">{error}</div>}

        <div className="section-card">
          <div className="section-head" style={{ background: 'var(--navy)' }}>
            <span className="t">ENCUESTA DE PERCEPCIÓN</span>
            <span className="p">{plural(datos.encuestas.length, 'respuesta', 'respuestas')}</span>
          </div>
          <div className="section-body">
            {datos.encuestas.length === 0 ? (
              <div className="muted">Aún no hay respuestas registradas.</div>
            ) : (
              <>
                <div className="prom-row">
                  <span className="label grow" />
                  <span className="label" style={{ width: 74, textAlign: 'right' }}>{FASES[0].nombre}</span>
                  <span className="label" style={{ width: 54, textAlign: 'right' }}>{FASES[1].nombre}</span>
                </div>
                {porPregunta.map(({ p, diagnostico, cierre }, i) => (
                  <div className="prom-row" key={p.id}>
                    <span className="grow">
                      <span className="label" style={{ display: 'block', lineHeight: 1.3 }}>
                        P{i + 1}. {p.ancla}
                      </span>
                    </span>
                    <span className="value" style={{ width: 74 }}>{f1(diagnostico)}</span>
                    <span
                      className="value"
                      style={{
                        width: 54,
                        color:
                          cierre !== null && diagnostico !== null
                            ? cierre >= diagnostico ? 'var(--green)' : 'var(--red)'
                            : undefined,
                      }}
                    >
                      {f1(cierre)}
                    </span>
                  </div>
                ))}
                <button className="btn ghost small" style={{ marginTop: 10 }} onClick={exportarEncuestas}>
                  <Download size={15} /> Exportar CSV
                </button>
              </>
            )}
          </div>
        </div>

        <div className="section-card">
          <div className="section-head" style={{ background: 'var(--orange)' }}>
            <span className="t">CONFORMIDAD POR INSTALACIÓN</span>
            <span className="p">{plural(datos.inspecciones.length, 'inspección', 'inspecciones')}</span>
          </div>
          <div className="section-body">
            {porInstalacion.map(({ ins, conformidad, inspecciones, hallazgos, abiertos }) => {
              const sem = semaforo(conformidad === null ? null : Math.round(conformidad))
              return (
                <div key={ins.id} className="behavior-block">
                  <div className="behavior-name">
                    {ins.nombre}
                    <span className="muted" style={{ fontWeight: 500, fontSize: 11 }}>
                      {' '}· {plural(inspecciones, 'inspección', 'inspecciones')} ·{' '}
                      {plural(hallazgos, 'hallazgo', 'hallazgos')} ({abiertos} sin cerrar)
                    </span>
                  </div>
                  <div className="prom-row">
                    <span className="grow">
                      <div className="bar-track">
                        <div className="bar-fill" style={{ width: `${conformidad || 0}%`, background: sem.color }} />
                      </div>
                    </span>
                    <span className="value" style={{ color: sem.color }}>
                      {conformidad === null ? '—' : `${Math.round(conformidad)}%`}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="section-card">
          <div className="section-head" style={{ background: 'var(--red)' }}>
            <span className="t">HALLAZGOS POR ESTADO</span>
            <span className="p">{datos.hallazgos.length} total</span>
          </div>
          <div className="section-body">
            {porEstado.map(({ e, total }) => (
              <div className="prom-row" key={e.id}>
                <span className="badge" style={{ background: e.color }}>{e.label}</span>
                <span className="grow" />
                <span className="value">{total}</span>
              </div>
            ))}
            <div style={{ height: 10 }} />
            <div className="behavior-name">Por turno</div>
            {porTurno.map(({ t, hallazgos, inspecciones }) => (
              <div className="prom-row" key={t.v}>
                <span className="label grow">
                  Turno {t.short} · {plural(inspecciones, 'inspección', 'inspecciones')}
                </span>
                <span className="value">{hallazgos}</span>
              </div>
            ))}
            <button className="btn ghost small" style={{ marginTop: 12 }} onClick={exportarHallazgos}>
              <Download size={15} /> Exportar CSV
            </button>
          </div>
        </div>

        <div className="warn-box">
          <div>
            Este consolidado alimenta el reporte semanal del Jefe del Centro de Operaciones (§ 8.2) y la
            comparación contra la línea base de la semana 12 (§ 5.5).
          </div>
        </div>
      </div>
    </>
  )
}
