import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Camera, X } from 'lucide-react'
import TopBar from '../../components/TopBar.jsx'
import { useAuth } from '../../auth.jsx'
import { useShift } from '../../shift.jsx'
import { api } from '../../api.js'
import { INSTALACIONES, UBICACIONES, aprobadorDe, comprimirImagen, fechaLarga } from '../../limpieza.js'

export default function LimpiezaHallazgoForm() {
  const { user } = useAuth()
  const { shift } = useShift()
  const nav = useNavigate()
  const precarga = useLocation().state || {}

  const [instalacion, setInstalacion] = useState(precarga.instalacion || '')
  const [ubicacion, setUbicacion] = useState(precarga.ubicacion || '')
  const [descripcion, setDescripcion] = useState(precarga.descripcion || '')
  const [trabajador, setTrabajador] = useState('')
  const [foto, setFoto] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const completa = instalacion && ubicacion.trim() && descripcion.trim().length >= 10

  async function onFoto(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      setFoto(await comprimirImagen(file))
    } catch (err) {
      setError(err.message)
    }
  }

  async function guardar() {
    setGuardando(true)
    setError('')
    try {
      await api.createLimpiezaHallazgo({
        fecha: shift.date,
        turno: shift.turno,
        instalacion,
        ubicacion: ubicacion.trim(),
        descripcion: descripcion.trim(),
        trabajador: trabajador.trim(),
        aprobador: aprobadorDe(instalacion),
        foto,
        origen: precarga.origen || null,
      })
      nav('/limpieza/hallazgos', { replace: true })
    } catch (err) {
      setError(err.message)
      setGuardando(false)
    }
  }

  return (
    <>
      <TopBar title="Nuevo hallazgo" to="/limpieza/hallazgos" />
      <div className="content">
        {error && <div className="error">{error}</div>}

        <div className="card">
          <h3>Dónde</h3>
          <label>Instalación</label>
          <select
            className="input"
            value={instalacion}
            onChange={(e) => { setInstalacion(e.target.value); setUbicacion('') }}
          >
            <option value="">Selecciona la instalación</option>
            {INSTALACIONES.map((i) => (
              <option key={i.id} value={i.id}>{i.nombre} · {i.zona}</option>
            ))}
          </select>

          <label>Ubicación o identificador</label>
          <input
            className="input"
            list="limpieza-ubic-hallazgo"
            value={ubicacion}
            onChange={(e) => setUbicacion(e.target.value)}
            placeholder={UBICACIONES[instalacion]?.[0] || 'Ej. Zona / número'}
            disabled={!instalacion}
          />
          <datalist id="limpieza-ubic-hallazgo">
            {(UBICACIONES[instalacion] || []).map((u) => (
              <option key={u} value={u} />
            ))}
          </datalist>

          {instalacion && (
            <p className="muted" style={{ fontSize: 12, marginTop: 10, marginBottom: 0 }}>
              Aprobador de la actividad según la matriz: <b>{aprobadorDe(instalacion)}</b>.
            </p>
          )}
        </div>

        <div className="card">
          <h3>Qué se encontró</h3>
          <label>Descripción del hallazgo</label>
          <textarea
            className="input"
            rows={4}
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Describe la condición encontrada, de forma verificable."
          />
          <label>Trabajador involucrado (opcional)</label>
          <input
            className="input"
            value={trabajador}
            onChange={(e) => setTrabajador(e.target.value)}
            placeholder="Nombre y apellido, si corresponde"
          />
          <p className="muted" style={{ fontSize: 12, marginTop: 8, marginBottom: 0 }}>
            El hallazgo se registra sobre condiciones verificables, no sobre percepciones aisladas.
          </p>

          <label>Evidencia fotográfica (opcional)</label>
          {foto ? (
            <div className="evento-photo-preview">
              <img src={foto} alt="Evidencia" />
              <button className="iconbtn danger" onClick={() => setFoto(null)} aria-label="Quitar foto">
                <X size={16} />
              </button>
            </div>
          ) : (
            <label className="btn ghost" style={{ margin: 0, cursor: 'pointer' }}>
              <Camera size={16} /> Adjuntar foto
              <input type="file" accept="image/*" capture="environment" onChange={onFoto} style={{ display: 'none' }} />
            </label>
          )}
        </div>

        <div className="card">
          <p className="muted" style={{ marginTop: 0 }}>
            Se registrará con fecha {fechaLarga(shift.date)}, a nombre de {user.full_name}.
          </p>
          <button className="btn" disabled={!completa || guardando} onClick={guardar}>
            {guardando ? 'Guardando…' : 'Registrar hallazgo'}
          </button>
          {!completa && (
            <p className="muted" style={{ fontSize: 12, textAlign: 'center', marginBottom: 0 }}>
              Completa instalación, ubicación y una descripción de al menos 10 caracteres.
            </p>
          )}
        </div>
      </div>
    </>
  )
}
