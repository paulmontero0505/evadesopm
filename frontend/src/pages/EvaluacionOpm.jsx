import { useNavigate } from 'react-router-dom'
import { ClipboardCheck, HeartHandshake } from 'lucide-react'
import TopBar from '../components/TopBar.jsx'
import { T, useLang } from '../i18n.js'

export default function EvaluacionOpm() {
  const nav = useNavigate()
  const [lang] = useLang()
  const t = T[lang]

  const items = [
    { to: '/ficha', t: t.modFicha, d: t.modFichaD, i: ClipboardCheck, c: '#0060A9' },
    { to: '/compromiso', t: t.modCompromiso, d: t.modCompromisoD, i: HeartHandshake, c: '#1E7B34' },
  ]

  return (
    <>
      <TopBar title={t.modEval} />
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
