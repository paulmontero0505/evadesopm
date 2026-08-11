import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Search, X } from 'lucide-react'
import { T, useLang } from '../i18n.js'

/** Selector con búsqueda tipo combobox.
 *  options: [{ value, label }]. value/onChange controlan la selección (string). */
export default function SearchSelect({ value, onChange, options, placeholder, emptyLabel }) {
  const [lang] = useLang()
  const t = T[lang]
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const boxRef = useRef(null)
  const inputRef = useRef(null)

  const selected = options.find((o) => String(o.value) === String(value))

  useEffect(() => {
    function onDocClick(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) {
        setOpen(false); setQuery('')
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return options
    return options.filter((o) => o.label.toLowerCase().includes(term))
  }, [options, query])

  function pick(v) {
    onChange(v)
    setOpen(false); setQuery('')
  }

  function openBox() {
    setOpen(true)
    setQuery('')
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  return (
    <div className="search-select" ref={boxRef}>
      {!open ? (
        <button type="button" className="input search-select-btn" onClick={openBox}>
          <span className={selected ? '' : 'search-select-placeholder'}>
            {selected ? selected.label : (emptyLabel || placeholder || t.seleccione)}
          </span>
          <ChevronDown size={16} />
        </button>
      ) : (
        <div className="search-select-input">
          <Search size={15} className="search-icon" />
          <input ref={inputRef} className="input" value={query}
            placeholder={t.buscar}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') { setOpen(false); setQuery('') } }} />
          <button type="button" className="search-clear" onClick={() => { setOpen(false); setQuery('') }} aria-label={t.cerrar}>
            <X size={15} />
          </button>
        </div>
      )}

      {open && (
        <div className="search-select-list">
          {emptyLabel && (
            <button type="button"
              className={`search-select-opt ${value === '' ? 'active' : ''}`}
              onClick={() => pick('')}>
              {emptyLabel}
            </button>
          )}
          {filtered.length === 0 ? (
            <div className="search-select-empty">{t.sinResultados(query)}</div>
          ) : filtered.map((o) => (
            <button type="button" key={o.value}
              className={`search-select-opt ${String(o.value) === String(value) ? 'active' : ''}`}
              onClick={() => pick(o.value)}>
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
