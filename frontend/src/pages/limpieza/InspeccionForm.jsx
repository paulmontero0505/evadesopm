import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Camera, CircleAlert, X } from 'lucide-react'
import TopBar from '../../components/TopBar.jsx'
import { useAuth } from '../../auth.jsx'
import { useShift, TURNOS, turnoLabel } from '../../shift.jsx'
import { api } from '../../api.js'
import {
  ESTANDARES, RESPUESTAS, UBICACIONES, comprimirImagen, conformidad,
  fechaLarga, instalacionPorId, semaforo, turnoOpuesto,
} from '../../limpieza.js'

export default function LimpiezaInspeccionForm() {
  const { instalacion } = useParams()
  const { user } = useAuth()
  const { shift } = useShift()
  const nav = useNavigate()

  const ins = instalacionPorId(instalacion)
  const items = ESTANDARES[instalacion] || []

  const [ubicacion, setUbicacion] = useState('')
  const [turnoSaliente, setTurnoSaliente] = useState(turnoOpuesto(shift.turno))
  const [respuestas, setRespuestas] = useState({})
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const pct = useMemo(() => conformidad(respuestas), [respuestas])
  const sem = semaforo(pct)
  const evaluados = items.filter((it) => respuestas[it.id]?.estado).length
  const completa = evaluados === items.length && ubicacion.trim().length > 0
  const noConformes = items.filter((it) => respuestas[it.id]?.estado === 'NC')
  const conFoto = items.filter((it) => respuestas[it.id]?.foto).length

  if (!ins) {
    return (
      <>
        <TopBar title="Inspección cruzada" to="/limpieza/inspeccion" />
        <div className="content">
          <div className="empty">Instalación no reconocida.</div>
        </div>
      </>
    )
  }

  const actualizar = (itemId, campos) =>
    setRespuestas((r) => ({ ...r, [itemId]: { ...r[itemId], ...campos } }))

  function marcar(itemId, estado) {
    setRespuestas((r) => ({
      ...r,
      [itemId]: { ...r[itemId], estado: r[itemId]?.estado === estado ? null : estado },
    }))
  }

  // Una foto por ítem, comprimida a 700 px: cinco fotos viajan en un solo POST.
  async function adjuntar(itemId, e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError('')
    try {
      actualizar(itemId, { foto: await comprimirImagen(file, 700, 0.55) })
    } catch (err) {
      setError(err.message)
    }
  }

  async function guardar() {
    setGuardando(true)
    setError('')
    try {
      const registro = await api.createLimpiezaInspeccion({
        instalacion,
        ubicacion: ubicacion.trim(),
        fecha: shift.date,
        turnoEntrante: shift.turno,
        turnoSaliente,
        items: items.map((it) => ({
          id: it.id,
          texto: it.texto,
          critico: !!it.critico,
          estado: respuestas[it.id]?.estado || 'NA',
          comentario: (respuestas[it.id]?.comentario || '').trim(),
          foto: respuestas[it.id]?.foto || null,
        })),
        conformidad: pct,
        semaforo: sem.id,
      })
      nav(`/limpieza/inspeccion/${registro.id}`, { replace: true })
    } catch (err) {
      setGuardando(false)
      setError(err.message)
    }
  }

  return (
    <>
      <TopBar title={`Relevo · ${ins.nombre}`} to="/limpieza/inspeccion" />
      <div className="content">
        <div className="warn-box" style={{ marginBottom: 12, borderLeft: `4px solid ${ins.color}` }}>
          <div>
            <b style={{ color: 'var(--navy)' }}>{ins.mensaje}</b>
            <div style={{ marginTop: 3 }}>
              Verifica la condición en que <b>recibes</b> la instalación. Aprobador de la actividad: {ins.aprobador}.
            </div>
          </div>
        </div>

        <div className="card">
          <h3>Datos del relevo</h3>
          <label>Ubicación o identificador</label>
          <input
            className="input"
            list="limpieza-ubicaciones"
            value={ubicacion}
            onChange={(e) => setUbicacion(e.target.value)}
            placeholder={UBICACIONES[instalacion]?.[0] || 'Ej. Zona / número'}
          />
          <datalist id="limpieza-ubicaciones">
            {(UBICACIONES[instalacion] || []).map((u) => (
              <option key={u} value={u} />
            ))}
          </datalist>

          <div className="row" style={{ marginTop: 12 }}>
            <div>
              <label style={{ marginTop: 0 }}>Turno que entrega</label>
              <select className="input" value={turnoSaliente} onChange={(e) => setTurnoSaliente(e.target.value)}>
                {TURNOS.map((t) => (
                  <option key={t.v} value={t.v}>{t.l}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ marginTop: 0 }}>Turno que recibe</label>
              <input className="input" value={turnoLabel(shift.turno)} disabled />
            </div>
          </div>
          <p className="muted" style={{ fontSize: 12, marginBottom: 0, marginTop: 10 }}>
            Fecha {fechaLarga(shift.date)} · Inspecciona {user.full_name}.
          </p>
        </div>

        <div className="block-card">
          <div className="block-head" style={{ background: ins.color }}>
            ESTÁNDAR ESPERADO · {ins.nombre.toUpperCase()}
          </div>
          {items.map((it, i) => {
            const r = respuestas[it.id] || {}
            return (
              <div className="act-row" key={it.id}>
                <div className="act-label">
                  <span className="obj-chip" style={{ background: it.critico ? 'var(--red)' : '#94a3b8' }}>
                    {it.critico ? '!' : i + 1}
                  </span>
                  <span className="act-name">{it.texto}</span>
                </div>
                <div className="behavior-grid">
                  {RESPUESTAS.map((op) => (
                    <button
                      type="button"
                      key={op.id}
                      className={'behavior-btn' + (r.estado === op.id ? ' active' : '')}
                      style={r.estado === op.id ? { background: op.color } : undefined}
                      onClick={() => marcar(it.id, op.id)}
                    >
                      {op.label}
                    </button>
                  ))}
                </div>

                {r.estado === 'NC' && (
                  <textarea
                    className="input act-comment"
                    rows={2}
                    value={r.comentario || ''}
                    onChange={(e) => actualizar(it.id, { comentario: e.target.value })}
                    placeholder="Describe qué encontraste. Este texto precarga el hallazgo."
                  />
                )}

                {r.foto ? (
                  <div className="item-foto">
                    <img src={r.foto} alt={`Evidencia del ítem ${i + 1}`} />
                    <button
                      type="button"
                      className="iconbtn danger"
                      onClick={() => actualizar(it.id, { foto: null })}
                      aria-label="Quitar evidencia"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <label className="item-foto-btn">
                    <Camera size={14} />
                    Adjuntar evidencia
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={(e) => adjuntar(it.id, e)}
                      style={{ display: 'none' }}
                    />
                  </label>
                )}
              </div>
            )
          })}
        </div>

        <div className="card">
          <div className="prom-row">
            <span className="label grow">Conformidad</span>
            <span className="value" style={{ color: sem.color }}>
              {pct === null ? '—' : `${pct}%`}
            </span>
          </div>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${pct || 0}%`, background: sem.color }} />
          </div>
          <div className="prom-row" style={{ marginTop: 6 }}>
            <span className="label grow">
              {evaluados}/{items.length} ítems evaluados · {conFoto} con evidencia
            </span>
            <span className="badge" style={{ background: sem.color }}>{sem.label}</span>
          </div>

          {noConformes.length > 0 && (
            <div className="error" style={{ marginTop: 12, marginBottom: 0 }}>
              <CircleAlert size={15} style={{ verticalAlign: -3, marginRight: 6 }} />
              {noConformes.length} ítem(s) no conforme(s). Al guardar podrás generar el hallazgo correspondiente.
            </div>
          )}

          {error && <div className="error" style={{ marginTop: 12, marginBottom: 0 }}>{error}</div>}

          <div style={{ height: 14 }} />
          <button className="btn" disabled={!completa || guardando} onClick={guardar}>
            {guardando ? 'Guardando…' : 'Guardar inspección'}
          </button>
          {!completa && (
            <p className="muted" style={{ fontSize: 12, textAlign: 'center', marginBottom: 0 }}>
              Indica la ubicación y evalúa los {items.length} ítems del estándar.
            </p>
          )}
        </div>
      </div>
    </>
  )
}
