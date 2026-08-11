import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Languages, LogOut } from 'lucide-react'
import { T, useLang } from '../i18n.js'

/** Barra superior con el selector de idioma: al estar aquí, todas las pantallas
 *  que la usan pueden cambiar entre español e inglés desde el mismo sitio. */
export default function TopBar({ title, sub, to = '/', onBack, onExit }) {
  const nav = useNavigate()
  const [lang, , toggleLang] = useLang()
  const t = T[lang]
  return (
    <>
      <div className="topbar">
        <button className="backbtn" onClick={() => onBack ? onBack() : nav(to)} aria-label={t.volver}>
          <ChevronLeft size={24} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontSize: 16 }}>{title}</h1>
          {sub && <div className="sub">{sub}</div>}
        </div>
        <button className="langbtn" onClick={toggleLang} title={t.switchTo} aria-label={t.switchTo}>
          <Languages size={15} /> {lang === 'es' ? 'EN' : 'ES'}
        </button>
        {onExit && (
          <button className="iconbtn" onClick={onExit} aria-label={t.salir} title={t.salir}>
            <LogOut size={18} />
          </button>
        )}
      </div>
      <div className="topbar-accent" />
    </>
  )
}
