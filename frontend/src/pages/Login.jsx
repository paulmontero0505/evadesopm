import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Languages } from 'lucide-react'
import { useAuth } from '../auth.jsx'
import { useShift } from '../shift.jsx'
import { T, useLang } from '../i18n.js'
import { SITE_BASE } from '../api.js'

// El logo se sirve desde /img del sitio (no se empaqueta): así se puede
// reemplazar la imagen en el servidor sin recompilar el frontend.
const LOGO = SITE_BASE + 'img/porttrack.png'

export default function Login() {
  const { login } = useAuth()
  const { clearShift } = useShift()
  const nav = useNavigate()
  const [lang, , toggleLang] = useLang()
  const t = T[lang]
  const [emp, setEmp] = useState('')
  const [pass, setPass] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    document.body.classList.add('login-bg')
    return () => document.body.classList.remove('login-bg')
  }, [])

  async function submit(e) {
    e.preventDefault()
    setErr(''); setBusy(true)
    try {
      const user = await login(emp.trim(), pass)
      clearShift()
      nav(user.password_change_required ? '/cambiar-clave' : '/')
    } catch (e) {
      setErr(e.message || 'No se pudo iniciar sesión')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-wrap">
      <button className="login-lang" onClick={toggleLang} title={t.switchTo} aria-label={t.switchTo}>
        <Languages size={15} /> {lang === 'es' ? 'EN' : 'ES'}
      </button>
      <img src={LOGO} alt="PortTrack Performance" className="login-logo" />
      <p className="center muted" style={{ marginTop: 12 }}>{t.sistema}</p>
      <form onSubmit={submit} className="card" style={{ marginTop: 16 }}>
        {err && <div className="error">{err}</div>}
        <label>{t.numEmpleado}</label>
        <input className="input" value={emp} onChange={(e) => setEmp(e.target.value)}
               placeholder={t.numEmpleadoPh} autoComplete="username"
               autoCapitalize="none" autoCorrect="off" spellCheck={false} autoFocus />
        <label>{t.contrasena}</label>
        <input className="input" type="password" value={pass}
               onChange={(e) => setPass(e.target.value)} placeholder={t.contrasenaPh} />
        <div style={{ height: 14 }} />
        <button className="btn" disabled={busy}>{busy ? t.ingresando : t.iniciarSesion}</button>
      </form>
      <div className="ver">v1.0.0</div>
    </div>
  )
}
