import { useNavigate } from 'react-router-dom'
import { ClipboardList, Ship, Users, Radio } from 'lucide-react'
import { useAuth } from '../auth.jsx'
import TopBar from '../components/TopBar.jsx'
import { T, useLang } from '../i18n.js'

export default function Admin() {
  const nav = useNavigate()
  const { user } = useAuth()
  const [lang] = useLang()
  const t = T[lang]

  const items = [
    { to: '/opms', t: t.opmsTitulo, d: t.modOpmsD, i: Ship, c: '#7A5195' },
    ...(user.role === 'admin' ? [{ to: '/users', t: t.modUsers, d: t.modUsersD, i: Users, c: '#1E7B34' }] : []),
    { to: '/asignaciones', t: t.modAsignaciones, d: t.modAsignacionesD, i: ClipboardList, c: '#0060A9' },
    ...(user.role === 'admin' ? [{ to: '/registrar-radios', t: 'Registrar radios', d: 'Catálogo de IMEI, código, modelo y ubicación', i: Radio, c: '#EF7D00' }] : []),
  ]

  return (
    <>
      <TopBar title={t.modAdmin} />
      <div className="content">
        <div className="mod-list">
          {items.map((it) => (
            <button key={it.to} className="mod" onClick={() => nav(it.to)}>
              <span className="mod-icon" style={{ background: it.c + '1A', color: it.c }}><it.i size={22} /></span>
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
