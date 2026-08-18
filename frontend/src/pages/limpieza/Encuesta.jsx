import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CircleCheckBig, HelpCircle, Info } from 'lucide-react'
import TopBar from '../../components/TopBar.jsx'
import { useAuth } from '../../auth.jsx'
import { useShift } from '../../shift.jsx'
import { api } from '../../api.js'
import {
  ESCALA, FASES, INSTALACIONES, PREGUNTAS, PREGUNTA_ABIERTA, PREGUNTA_INSTALACION,
  ZONAS, escalaPorValor, fechaLarga,
} from '../../limpieza.js'

/** Escala 1-5 con la rúbrica desplegable del sistema de diseño. */
function Escala({ valor, onChange }) {
  const [abierta, setAbierta] = useState(false)
  return (
    <>
      <button
        type="button"
        className={'rubric-toggle' + (abierta ? ' active' : '')}
        onClick={() => setAbierta((v) => !v)}
        aria-label="Ver criterios de la escala"
        style={{ marginLeft: 0, marginBottom: 6 }}
      >
        <HelpCircle size={16} />
        <span style={{ fontSize: 11, fontWeight: 700, marginLeft: 5 }}>Criterios</span>
      </button>
      {abierta && (
        <div className="rubric">
          {ESCALA.map((e) => (
            <div className="rubric-item" key={e.v}>
              <span className="rubric-v" style={{ background: e.color }}>{e.v}</span>
              <div>
                <div className="rubric-l" style={{ color: e.color }}>{e.l}</div>
                <div className="rubric-d">{e.d}</div>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="scale-row" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
        {ESCALA.map((e) => (
          <button
            type="button"
            key={e.v}
            className={'scale-btn' + (valor === e.v ? ' active' : '')}
            style={valor === e.v ? { background: e.color } : undefined}
            onClick={() => onChange(valor === e.v ? null : e.v)}
            aria-label={`${e.v} · ${e.l}`}
          >
            {e.v}
          </button>
        ))}
      </div>
    </>
  )
}

export default function LimpiezaEncuesta() {
  const { user } = useAuth()
  const { shift } = useShift()
  const nav = useNavigate()

  const [fase, setFase] = useState('diagnostico')
  const [zona, setZona] = useState('')
  const [respuestas, setRespuestas] = useState({})
  const [preocupa, setPreocupa] = useState(null)
  const [comentario, setComentario] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [enviado, setEnviado] = useState(null)

  const respondidas = PREGUNTAS.filter((p) => respuestas[p.id]).length
  const completa = respondidas === PREGUNTAS.length && zona !== ''

  async function enviar() {
    setGuardando(true)
    setError('')
    try {
      const registro = await api.createLimpiezaEncuesta({
        fase,
        fecha: shift.date,
        turno: shift.turno,
        zona,
        respuestas,
        preocupa,
        comentario: comentario.trim(),
      })
      setEnviado(registro)
    } catch (e) {
      setError(e.message)
    } finally {
      setGuardando(false)
    }
  }

  if (enviado) {
    const prom = Number(enviado.promedio)
    const esc = escalaPorValor(Math.round(prom))
    return (
      <>
        <TopBar title="Encuesta de percepción" to="/limpieza" />
        <div className="content">
          <div className="card" style={{ textAlign: 'center', paddingTop: 26 }}>
            <div className="login-icon" style={{ background: 'var(--green)' }}>
              <CircleCheckBig size={30} />
            </div>
            <h3 style={{ fontSize: 18 }}>Respuesta registrada</h3>
            <p className="muted" style={{ marginTop: 4 }}>
              Gracias. Tu respuesta entra en el consolidado de la fase de{' '}
              {FASES.find((f) => f.id === enviado.fase).nombre.toLowerCase()}.
            </p>
          </div>

          <div className="block-card">
            <div className="block-head" style={{ background: esc?.color || 'var(--navy)' }}>
              TU PROMEDIO DE PERCEPCIÓN
            </div>
            <div className="result-final" style={{ background: esc?.color || 'var(--navy)' }}>
              <div className="l">{esc?.l?.toUpperCase()}</div>
              <div className="v">{prom.toFixed(1)} / 5.0</div>
            </div>
          </div>

          <button className="btn secondary" onClick={() => nav('/limpieza')}>
            Volver al módulo
          </button>
        </div>
      </>
    )
  }

  return (
    <>
      <TopBar title="Encuesta de percepción" to="/limpieza" />
      <div className="content">
        {error && <div className="error">{error}</div>}

        <div className="shift-fixed">
          <Info size={18} />
          <span className="grow">
            {user.full_name}
            <div className="muted" style={{ fontSize: 11 }}>
              Tu cargo se toma del maestro de personal; la fecha y el turno, del turno seleccionado
              ({fechaLarga(shift.date)}).
            </div>
          </span>
        </div>

        <div className="card">
          <h3>Fase de la campaña</h3>
          <p className="muted" style={{ marginTop: 0, marginBottom: 10 }}>
            El plan levanta la percepción al inicio y la repite al cierre para compararla contra la línea base.
          </p>
          <div className="choice-grid">
            {FASES.map((f) => (
              <button
                type="button"
                key={f.id}
                className={'choice' + (fase === f.id ? ' active' : '')}
                style={fase === f.id ? { background: 'var(--blue)' } : undefined}
                onClick={() => setFase(f.id)}
              >
                {f.nombre}
                <div style={{ fontSize: 11, fontWeight: 500, opacity: 0.85, marginTop: 2 }}>{f.detalle}</div>
              </button>
            ))}
          </div>

          <label>Zona en la que trabajas este turno</label>
          <select className="input" value={zona} onChange={(e) => setZona(e.target.value)}>
            <option value="">Selecciona tu zona</option>
            {ZONAS.map((z) => (
              <option key={z} value={z}>{z}</option>
            ))}
          </select>
        </div>

        {PREGUNTAS.map((p, i) => (
          <div className="card" key={p.id}>
            <div className="act-label">
              <span className="obj-chip" style={{ background: 'var(--navy)' }}>{i + 1}</span>
              <span className="act-name">{p.texto}</span>
            </div>
            <p className="muted" style={{ fontSize: 12, margin: '0 0 10px' }}>
              {p.ayuda} <b style={{ color: 'var(--muted)' }}>({p.ancla})</b>
            </p>
            <Escala
              valor={respuestas[p.id] || null}
              onChange={(v) => setRespuestas((r) => ({ ...r, [p.id]: v }))}
            />
          </div>
        ))}

        <div className="card">
          <div className="act-label">
            <span className="obj-chip" style={{ background: 'var(--orange)' }}>6</span>
            <span className="act-name">{PREGUNTA_INSTALACION}</span>
          </div>
          <div className="choice-grid">
            {INSTALACIONES.map((ins) => (
              <button
                type="button"
                key={ins.id}
                className={'choice' + (preocupa === ins.id ? ' active' : '')}
                style={preocupa === ins.id ? { background: ins.color } : undefined}
                onClick={() => setPreocupa(preocupa === ins.id ? null : ins.id)}
              >
                {ins.nombre}
              </button>
            ))}
          </div>

          <label style={{ marginTop: 16 }}>{PREGUNTA_ABIERTA}</label>
          <textarea
            className="input"
            rows={4}
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            placeholder="Opcional. Escribe lo que consideres útil para el Centro de Operaciones."
          />
        </div>

        <div className="card">
          <div className="prom-row">
            <span className="label grow">Preguntas respondidas</span>
            <span className="value">{respondidas}/{PREGUNTAS.length}</span>
          </div>
          <div className="bar-track">
            <div
              className="bar-fill"
              style={{
                width: `${(respondidas / PREGUNTAS.length) * 100}%`,
                background: respondidas === PREGUNTAS.length ? 'var(--green)' : 'var(--blue)',
              }}
            />
          </div>
          <div style={{ height: 14 }} />
          <button className="btn" disabled={!completa || guardando} onClick={enviar}>
            {guardando ? 'Guardando…' : 'Enviar encuesta'}
          </button>
          {!completa && (
            <p className="muted" style={{ fontSize: 12, textAlign: 'center', marginBottom: 0 }}>
              Indica tu zona y responde las cinco preguntas de escala para poder enviar.
            </p>
          )}
        </div>
      </div>
    </>
  )
}
