import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './auth.jsx'
import { useShift } from './shift.jsx'
import Login from './pages/Login.jsx'
import Home from './pages/Home.jsx'
import SeleccionarTurno from './pages/SeleccionarTurno.jsx'
import Ficha from './pages/Ficha.jsx'
import FichaImprimir from './pages/FichaImprimir.jsx'
import Compromiso from './pages/Compromiso.jsx'
import CompromisoImprimir from './pages/CompromisoImprimir.jsx'
import Control from './pages/Control.jsx'
import Evaluacion from './pages/Evaluacion.jsx'
import EvaluacionImprimir from './pages/EvaluacionImprimir.jsx'
import Admin from './pages/Admin.jsx'
import Opms from './pages/Opms.jsx'
import Users from './pages/Users.jsx'
import EvaluacionOpm from './pages/EvaluacionOpm.jsx'
import CambiarClave from './pages/CambiarClave.jsx'
import Asignaciones from './pages/Asignaciones.jsx'
import ControlRadios from './pages/ControlRadios.jsx'
import RadiosCatalogo from './pages/RadiosCatalogo.jsx'
import Auditoria from './pages/Auditoria.jsx'
import AppErrorBoundary from './components/AppErrorBoundary.jsx'

function Protected({ children, roles, needShift = true }) {
  const { user, loading } = useAuth()
  const { shift } = useShift()
  if (loading) return <div className="empty">Cargando…</div>
  if (!user) return <Navigate to="/login" replace />
  if (needShift && !shift) return <Navigate to="/turno" replace />
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
    <div className="app">
      <AppErrorBoundary>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/cambiar-clave" element={<Protected needShift={false}><CambiarClave /></Protected>} />
        <Route path="/turno" element={<Protected needShift={false}><SeleccionarTurno /></Protected>} />
        <Route path="/" element={<Protected><Home /></Protected>} />
        <Route path="/evaluacion-opm" element={<Protected roles={['admin','supervisor']}><EvaluacionOpm /></Protected>} />
        <Route path="/ficha" element={<Protected roles={['admin','supervisor']}><Ficha /></Protected>} />
        <Route path="/imprimir/:id" element={<Protected roles={['admin','supervisor']} needShift={false}><FichaImprimir /></Protected>} />
        <Route path="/compromiso" element={<Protected roles={['admin','supervisor']}><Compromiso /></Protected>} />
        <Route path="/imprimir-compromiso/:id" element={<Protected roles={['admin','supervisor']} needShift={false}><CompromisoImprimir /></Protected>} />
        <Route path="/control" element={<Protected roles={['admin','supervisor']}><Control /></Protected>} />
        <Route path="/evaluar" element={<Protected roles={['admin','supervisor']}><Evaluacion /></Protected>} />
        <Route path="/evaluar/:opmId" element={<Protected roles={['admin','supervisor']}><Evaluacion /></Protected>} />
        <Route path="/evaluar/imprimir/:opmId" element={<Protected roles={['admin','supervisor']} needShift={false}><EvaluacionImprimir /></Protected>} />
        <Route path="/admin" element={<Protected roles={['admin','labor']}><Admin /></Protected>} />
        <Route path="/opms" element={<Protected roles={['admin','labor']}><Opms /></Protected>} />
        <Route path="/users" element={<Protected roles={['admin']}><Users /></Protected>} />
        <Route path="/asignaciones" element={<Protected roles={['admin','labor']}><Asignaciones /></Protected>} />
        <Route path="/asignaciones-supervisores" element={<Navigate to="/asignaciones" replace />} />
        <Route path="/radios" element={<Protected roles={['admin','supervisor','coordinator']}><ControlRadios /></Protected>} />
        <Route path="/registrar-radios" element={<Protected roles={['admin']}><RadiosCatalogo /></Protected>} />
        <Route path="/auditoria" element={<Protected roles={['admin']} needShift={false}><Auditoria /></Protected>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </AppErrorBoundary>
    </div>
  )
}
