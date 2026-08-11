import { useNavigate } from 'react-router-dom'
import { ClipboardCheck, Users, Award, ShieldCheck, LogOut, ChevronLeft, Languages, Radio } from 'lucide-react'
import { useAuth } from '../auth.jsx'
import { useShift } from '../shift.jsx'
import { T, useLang, turnoText } from '../i18n.js'

const fmtDate = (d) => { if (!d) return ''; const [y, m, day] = d.split('-'); return `${day}/${m}/${y}` }

export default function Home() {
  const { user, logout } = useAuth()
  const { shift, clearShift } = useShift()
  const [lang, , toggleLang] = useLang()
  const nav = useNavigate()
  const t = T[lang]
  const items = user.role === 'coordinator'
    ? [{ to: '/radios', i: Radio, t: 'Trazabilidad de equipos / radios', d: 'Registrar y consultar entregas del turno', c: '#EF7D00' }]
    : user.role === 'admin'
      ? [
          { to: '/evaluacion-opm', i: ClipboardCheck, t: t.modEval, d: t.modEvalD, c: '#0060A9' },
          { to: '/radios', i: Radio, t: 'Trazabilidad de equipos / radios', d: 'Registrar y consultar entregas del turno', c: '#EF7D00' },
          { to: '/control', i: Users, t: t.modControl, d: t.modControlD, c: '#002E6D' },
          { to: '/evaluar', i: Award, t: t.modEvaluar, d: t.modEvaluarD, c: '#EF7D00' },
          { to: '/admin', i: ShieldCheck, t: t.modAdmin, d: t.modAdminD, c: '#7A5195' },
        ]
      : [
          { to: '/evaluacion-opm', i: ClipboardCheck, t: 'Supervisar OPM', d: 'Registrar evaluaciones del turno', c: '#0060A9' },
          { to: '/radios', i: Radio, t: 'Trazabilidad de equipos / radios', d: 'Consultar y gestionar relevo de radios', c: '#EF7D00' },
          { to: '/control', i: Users, t: t.modControl, d: t.modControlD, c: '#002E6D' },
          { to: '/evaluar', i: Award, t: t.modEvaluar, d: t.modEvaluarD, c: '#EF7D00' },
        ]

  const rolLabel = user.role === 'admin' ? t.rolAdmin : user.role === 'coordinator' ? t.rolCoordinador : t.rolSupervisor

  return (
    <>
      <div className="topbar">
        <button className="backbtn" onClick={() => nav('/turno')} aria-label={t.volverTurno}>
          <ChevronLeft size={24} />
        </button>
        <div style={{ flex: 1 }}>
          <div className="brand">COSCO SHIPPING PORTS CHANCAY</div>
          <h1>{t.appTitulo}</h1>
          <div className="sub">
            <span>{user.full_name} · {rolLabel}</span>
            {shift && (
              <span className="sub-turno">{t.turnoBadge(turnoText(shift.turno, lang), fmtDate(shift.date))}</span>
            )}
          </div>
        </div>
        <button className="langbtn" onClick={toggleLang} title={t.switchTo} aria-label={t.switchTo}>
          <Languages size={15} /> {lang === 'es' ? 'EN' : 'ES'}
        </button>
        <button className="iconbtn" onClick={() => { clearShift(); logout(); nav('/login') }} aria-label={t.salir}>
          <LogOut size={18} />
        </button>
      </div>
      <div className="topbar-accent" />

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
