import { useNavigate } from 'react-router-dom'
import { BarChart3, ClipboardCheck, MessageSquare, TriangleAlert } from 'lucide-react'
import TopBar from '../../components/TopBar.jsx'
import { useAuth } from '../../auth.jsx'
import { useShift } from '../../shift.jsx'
import { turnoLabel } from '../../shift.jsx'
import { fechaLarga } from '../../limpieza.js'

const MANDO = ['admin', 'supervisor', 'coordinator']

export default function LimpiezaInicio() {
  const { user } = useAuth()
  const { shift } = useShift()
  const nav = useNavigate()

  const items = [
    {
      to: '/limpieza/encuesta',
      i: MessageSquare,
      c: '#002E6D',
      t: 'Encuesta de percepción',
      d: 'Cinco preguntas sobre orden y limpieza · § 5.1 y § 5.5',
      ver: true,
    },
    {
      to: '/limpieza/inspeccion',
      i: ClipboardCheck,
      c: '#0060A9',
      t: 'Inspección cruzada de relevo',
      d: 'Evalúa el estándar de la instalación que recibes · § 5.3',
      ver: MANDO.includes(user.role),
    },
    {
      to: '/limpieza/hallazgos',
      i: TriangleAlert,
      c: '#C0392B',
      t: 'Registro de hallazgos',
      d: 'Registra, corrige y cierra condiciones observadas · § 6',
      ver: MANDO.includes(user.role),
    },
    {
      to: '/limpieza/resumen',
      i: BarChart3,
      c: '#EF7D00',
      t: 'Reporte consolidado',
      d: 'Percepción, conformidad y hallazgos para el reporte semanal · § 8.2',
      ver: user.role === 'admin',
    },
  ].filter((it) => it.ver)

  return (
    <>
      <TopBar
        title="Cuidado y limpieza de instalaciones"
        sub={shift ? `Turno ${turnoLabel(shift.turno)} · ${fechaLarga(shift.date)}` : undefined}
        to="/"
      />
      <div className="content">
        <div className="warn-box" style={{ marginBottom: 14 }}>
          <div>
            <b style={{ color: 'var(--navy)' }}>LO QUE RECIBO LIMPIO, LO ENTREGO LIMPIO.</b>
            <div style={{ marginTop: 3 }}>
              Plan de Sensibilización OPS-SEN-001 v1.0 · Centro de Operaciones.
            </div>
          </div>
        </div>

        <div className="mod-list">
          {items.map((it) => (
            <button key={it.to} className="mod" onClick={() => nav(it.to)}>
              <span className="mod-icon" style={{ background: it.c + '1A', color: it.c }}>
                <it.i size={22} />
              </span>
              <span>
                <div className="mod-title">{it.t}</div>
                <div className="mod-desc">{it.d}</div>
              </span>
            </button>
          ))}
        </div>
      </div>
    </>
  )
}
