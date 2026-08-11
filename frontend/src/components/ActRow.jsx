import { useState } from 'react'
import { HelpCircle } from 'lucide-react'
import { T, actName, actDesc, scaleLabel } from '../i18n.js'

/**
 * Fila de una actividad a evaluar: nombre, escala 1-5 + No aplica, comentario y la
 * rúbrica (descriptores) que justifica cada puntaje. Compartida por la ficha de
 * Desenvolvimiento y la de Compromiso — los textos vienen del servidor en ambos idiomas.
 */
export default function ActRow({ act, objColor, escala, value, onRate, comment, onComment, lang = 'es' }) {
  const [openRubric, setOpenRubric] = useState(true)
  const t = T[lang]
  const desc = actDesc(act, lang)
  const nombre = actName(act, lang)
  const na = value === 'na'

  return (
    <div className="act-row">
      <div className="act-label">
        <span className="obj-chip" style={{ background: objColor }}>{act.o}</span>
        <span className="act-name">{nombre}</span>
        {desc.length > 0 && (
          <button type="button" className={`rubric-toggle ${openRubric ? 'active' : ''}`}
            onClick={() => setOpenRubric(!openRubric)}
            aria-expanded={openRubric}
            title={t.verCriterios}>
            <HelpCircle size={16} />
          </button>
        )}
      </div>

      {openRubric && (
        <div className="rubric">
          {escala.map((e) => (
            <div key={e.v} className="rubric-item">
              <span className="rubric-v" style={{ background: e.c }}>{e.v}</span>
              <div>
                <div className="rubric-l" style={{ color: e.c }}>{scaleLabel(e, lang)}</div>
                <div className="rubric-d">{desc[e.v - 1]}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className={`scale-row ${na ? 'is-na' : ''}`}>
        {escala.map((e) => {
          const l = scaleLabel(e, lang)
          return (
            <button key={e.v} className={`scale-btn ${value === e.v ? 'active' : ''}`}
              style={value === e.v ? { background: e.c } : {}}
              onClick={() => onRate(e.v)}
              title={desc[e.v - 1] ? `${e.v} · ${l}: ${desc[e.v - 1]}` : `${e.v} · ${l}`}
              aria-label={`${nombre}: ${l}`}>
              {e.v}
            </button>
          )
        })}
        <button className={`scale-btn na-btn ${na ? 'active' : ''}`}
          onClick={() => onRate(na ? undefined : 'na')}
          aria-pressed={na}
          title={t.naTitulo}
          aria-label={`${nombre}: N/A`}>
          N/A
        </button>
      </div>

      {na && <div className="na-note">{t.naAviso}</div>}

      <textarea className="input act-comment" rows={1} maxLength={500}
        value={comment || ''}
        onChange={(ev) => onComment(ev.target.value)}
        placeholder={t.comentarioOpcional} />
    </div>
  )
}
