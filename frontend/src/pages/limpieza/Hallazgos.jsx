import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, Plus, TriangleAlert } from 'lucide-react'
import TopBar from '../../components/TopBar.jsx'
import { api, SITE_BASE } from '../../api.js'
import { TURNOS, turnoLabel } from '../../shift.jsx'
import { ESTADOS, INSTALACIONES, estadoPorId, fechaLarga, instalacionPorId } from '../../limpieza.js'

export default function LimpiezaHallazgos() {
  const nav = useNavigate()
  const [filas, setFilas] = useState(null)
  const [abierto, setAbierto] = useState(null)
  const [f, setF] = useState({ instalacion: '', estado: '', turno: '' })
  const [verificacion, setVerificacion] = useState('')
  const [error, setError] = useState('')

  const recargar = () =>
    api.limpiezaHallazgos()
      .then((r) => { setFilas([...r].reverse()); setError('') })
      .catch((e) => { setError(e.message); setFilas([]) })

  useEffect(() => { recargar() }, [])

  const visibles = useMemo(
    () =>
      (filas || []).filter(
        (h) =>
          (!f.instalacion || h.instalacion === f.instalacion) &&
          (!f.estado || h.estado === f.estado) &&
          (!f.turno || h.turno === f.turno),
      ),
    [filas, f],
  )

  const totales = useMemo(() => {
    const t = filas || []
    return {
      total: t.length,
      abiertos: t.filter((h) => h.estado !== 'cerrado').length,
      cerrados: t.filter((h) => h.estado === 'cerrado').length,
    }
  }, [filas])

  async function cambiarEstado(h, estado) {
    try {
      await api.updateLimpiezaHallazgo(h.id, {
        estado,
        cierre: estado === 'cerrado' ? { nota: verificacion.trim() } : null,
      })
      setVerificacion('')
      await recargar()
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <>
      <TopBar title="Registro de hallazgos" to="/limpieza" />
      <div className="content">
        {error && <div className="error">{error}</div>}

        <div className="stat-grid" style={{ marginBottom: 14 }}>
          <div className="stat">
            <div className="n">{totales.total}</div>
            <div className="l">Hallazgos totales</div>
          </div>
          <div className="stat">
            <div className={'n' + (totales.abiertos ? ' alert' : '')}>{totales.abiertos}</div>
            <div className="l">Sin cerrar</div>
          </div>
          <div className="stat">
            <div className="n">{totales.cerrados}</div>
            <div className="l">Cerrados</div>
          </div>
        </div>

        <button className="btn" style={{ marginBottom: 14 }} onClick={() => nav('/limpieza/hallazgos/nuevo')}>
          <Plus size={17} /> Registrar hallazgo
        </button>

        <div className="assignment-selection-tools" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
          <select className="input" value={f.instalacion} onChange={(e) => setF({ ...f, instalacion: e.target.value })}>
            <option value="">Toda instalación</option>
            {INSTALACIONES.map((i) => (
              <option key={i.id} value={i.id}>{i.nombre}</option>
            ))}
          </select>
          <select className="input" value={f.estado} onChange={(e) => setF({ ...f, estado: e.target.value })}>
            <option value="">Todo estado</option>
            {ESTADOS.map((e2) => (
              <option key={e2.id} value={e2.id}>{e2.label}</option>
            ))}
          </select>
          <select className="input" value={f.turno} onChange={(e) => setF({ ...f, turno: e.target.value })}>
            <option value="">Todo turno</option>
            {TURNOS.map((t) => (
              <option key={t.v} value={t.v}>Turno {t.short}</option>
            ))}
          </select>
        </div>

        {filas === null ? (
          <div className="empty">Cargando…</div>
        ) : visibles.length === 0 ? (
          <div className="empty">
            <TriangleAlert size={44} />
            <div>No hay hallazgos con estos filtros.</div>
          </div>
        ) : (
          visibles.map((h) => {
            const ins = instalacionPorId(h.instalacion)
            const est = estadoPorId(h.estado)
            const exp = abierto === h.id
            return (
              <div className="block-card" key={h.id}>
                <button
                  className="record-main clickable"
                  style={{ width: '100%', padding: 13 }}
                  onClick={() => setAbierto(exp ? null : h.id)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <span className="obj-chip" style={{ background: ins?.color, marginTop: 0 }}>{ins?.corto}</span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#17345e' }}>
                        {ins?.nombre} · {h.ubicacion}
                      </span>
                      <span style={{ display: 'block', fontSize: 11, color: '#62718a' }}>
                        {fechaLarga(h.fecha)} · turno {turnoLabel(h.turno)} · {h.registradoPor}
                      </span>
                    </span>
                    <span className="badge" style={{ background: est?.color }}>{est?.label}</span>
                    <ChevronDown size={16} className={exp ? 'rot' : ''} style={{ color: '#94a3b8' }} />
                  </div>
                </button>

                {exp && (
                  <div style={{ padding: '0 13px 13px' }}>
                    <div className="evento-comment">{h.descripcion}</div>
                    {h.trabajador && (
                      <p className="muted" style={{ fontSize: 12, marginTop: 8, marginBottom: 0 }}>
                        Trabajador involucrado: <b>{h.trabajador}</b>
                      </p>
                    )}
                    <p className="muted" style={{ fontSize: 12, marginTop: 6, marginBottom: 0 }}>
                      <b>Aprobador:</b> {h.aprobador}
                    </p>
                    {h.foto && (
                      <a
                        className="evento-photo-link"
                        href={SITE_BASE + h.foto}
                        target="_blank"
                        rel="noreferrer"
                        style={{ marginTop: 10 }}
                      >
                        <img src={SITE_BASE + h.foto} alt="Evidencia" />
                      </a>
                    )}

                    {h.cierre ? (
                      <div className="success" style={{ marginTop: 12, marginBottom: 0 }}>
                        Cerrado el {fechaLarga(h.cierre.fecha)} por {h.cierre.verificadoPor}.
                        {h.cierre.nota && <div style={{ marginTop: 3 }}>{h.cierre.nota}</div>}
                      </div>
                    ) : (
                      <>
                        <label>Verificación de cierre</label>
                        <input
                          className="input"
                          value={verificacion}
                          onChange={(e) => setVerificacion(e.target.value)}
                          placeholder="Qué se corrigió y cómo se verificó"
                        />
                        <div className="row" style={{ marginTop: 10 }}>
                          {h.estado !== 'correccion' && (
                            <button className="btn secondary small" onClick={() => cambiarEstado(h, 'correccion')}>
                              En corrección
                            </button>
                          )}
                          <button className="btn small" onClick={() => cambiarEstado(h, 'cerrado')}>
                            Cerrar hallazgo
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </>
  )
}
