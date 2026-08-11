import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'

/** Notificación flotante que se autodescarta. Renderizar en el nivel superior de la página. */
export default function Toast({ message, duration = 2600, onDone }) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!message) return
    setShow(false)
    const raf = requestAnimationFrame(() => setShow(true))
    const timer = setTimeout(() => onDone?.(), duration)
    return () => { cancelAnimationFrame(raf); clearTimeout(timer) }
  }, [message, duration])

  if (!message) return null
  return (
    <div className={`toast ${show ? 'show' : ''}`} role="status" aria-live="polite">
      <span className="toast-icon"><Check size={14} /></span>
      {message}
    </div>
  )
}
