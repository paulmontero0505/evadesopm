import { useState } from 'react'
import { KeyRound, LockKeyhole } from 'lucide-react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth.jsx'
import { T, useLang } from '../i18n.js'

export default function CambiarClave() {
  const { user, changePassword } = useAuth()
  const nav = useNavigate()
  const [lang] = useLang()
  const t = T[lang]
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (!user?.password_change_required) {
    return <Navigate to="/" replace />
  }

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (password !== confirm) {
      setError(t.clavesNoCoinciden)
      return
    }
    setBusy(true)
    try {
      await changePassword(password)
      nav('/', { replace: true })
    } catch (e) {
      setError(e.message || t.errorCambiarClave)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="password-change-wrap">
      <form className="password-change-card" onSubmit={submit}>
        <div className="password-change-icon"><KeyRound size={25} /></div>
        <h1>{t.cambiarClaveTitulo}</h1>
        <p>{t.cambiarClaveDescripcion}</p>
        {error && <div className="error" role="alert">{error}</div>}
        <label htmlFor="new-password">{t.nuevaContrasena}</label>
        <div className="password-input-wrap">
          <LockKeyhole size={17} aria-hidden="true" />
          <input id="new-password" className="input" type="password" value={password}
                 onChange={(e) => setPassword(e.target.value)} minLength="8" autoComplete="new-password" autoFocus required />
        </div>
        <label htmlFor="confirm-password">{t.confirmarContrasena}</label>
        <div className="password-input-wrap">
          <LockKeyhole size={17} aria-hidden="true" />
          <input id="confirm-password" className="input" type="password" value={confirm}
                 onChange={(e) => setConfirm(e.target.value)} minLength="8" autoComplete="new-password" required />
        </div>
        <div className="password-change-actions">
          <button type="button" className="btn secondary" onClick={() => nav('/')}>{t.cambiarLuego}</button>
          <button className="btn" disabled={busy}>{busy ? t.guardandoClave : t.guardarNuevaClave}</button>
        </div>
      </form>
    </main>
  )
}
