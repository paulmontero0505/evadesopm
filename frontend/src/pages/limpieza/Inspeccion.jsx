import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardCheck, Plus } from 'lucide-react'
import TopBar from '../../components/TopBar.jsx'
import { api } from '../../api.js'
import { turnoLabel } from '../../shift.jsx'
import { INSTALACIONES, fechaLarga, instalacionPorId, semaforo } from '../../limpieza.js'

export default function LimpiezaInspeccion() {
  const nav = useNavigate()
  const [filas, setFilas] = useState(null)
  const [filtro, setFiltro] = useState('todas')
  const [error, setError] = useState('')

  useEffect(() => {
    api.limpiezaInspecciones()
      .then((r) => setFilas([...r].reverse()))
      .catch((e) => { setError(e.message); setFilas([]) })
  }, [])

  const visibles = (filas || []).filter((f) => filtro === 'todas' || f.instalacion === filtro)

  return (
    <>
      <TopBar title="Inspección cruzada de relevo" to="/limpieza" />
      <div className="content">
        {error && <div className="error">{error}</div>}

        <div className="card">
          <h3>
            <Plus size={15} style={{ verticalAlign: -2, marginRight: 5 }} />
            Nueva inspección
          </h3>
          <p className="muted" style={{ marginTop: 0, marginBottom: 10 }}>
            Elige la instalación que estás recibiendo. El estándar se carga desde el plan.
          </p>
          <div className="choice-grid">
            {INSTALACIONES.map((ins) => (
              <button
                key={ins.id}
                type="button"
                className="choice"
                onClick={() => nav(`/limpieza/inspeccion/nueva/${ins.id}`)}
              >
                {ins.nombre}
                <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--muted)', marginTop: 2 }}>{ins.zona}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="report-period-filter">
          <button
            className={'period-btn' + (filtro === 'todas' ? ' active' : '')}
            onClick={() => setFiltro('todas')}
          >
            Todas
          </button>
          {INSTALACIONES.map((ins) => (
            <button
              key={ins.id}
              className={'period-btn' + (filtro === ins.id ? ' active' : '')}
              onClick={() => setFiltro(ins.id)}
            >
              {ins.nombre}
            </button>
          ))}
        </div>

        {filas === null ? (
          <div className="empty">Cargando…</div>
        ) : visibles.length === 0 ? (
          <div className="empty">
            <ClipboardCheck size={44} />
            <div>Aún no hay inspecciones registradas.</div>
          </div>
        ) : (
          <div className="home-assignments-list">
            {visibles.map((f) => {
              const ins = instalacionPorId(f.instalacion)
              const sem = semaforo(f.conformidad)
              return (
                <button
                  key={f.id}
                  className="record-main clickable"
                  style={{ width: '100%', padding: '13px 14px', borderBottom: '1px solid var(--border)' }}
                  onClick={() => nav(`/limpieza/inspeccion/${f.id}`)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className="obj-chip" style={{ background: ins?.color, marginTop: 0 }}>
                      {ins?.corto}
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#17345e' }}>
                        {f.ubicacion}
                      </span>
                      <span style={{ display: 'block', fontSize: 11, color: '#62718a' }}>
                        {fechaLarga(f.fecha)} · recibe turno {turnoLabel(f.turnoEntrante)} · {f.inspector}
                      </span>
                    </span>
                    <span className="badge" style={{ background: sem.color }}>
                      {f.conformidad === null ? 'N/A' : `${f.conformidad}%`}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
