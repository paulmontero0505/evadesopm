import { createContext, useContext, useState } from 'react'

const ShiftCtx = createContext(null)
const KEY = 'work_shift'

export const TURNOS = [
  { v: 'dia', l: 'Día · 07:00 – 19:00', short: 'Día' },
  { v: 'noche', l: 'Noche · 19:00 – 07:00', short: 'Noche' },
]

export const turnoLabel = (v) => (TURNOS.find((t) => t.v === v)?.short || v)

export function ShiftProvider({ children }) {
  const [shift, setShiftState] = useState(() => {
    try { return JSON.parse(localStorage.getItem(KEY)) || null } catch { return null }
  })

  function setShift(s) {
    setShiftState(s)
    localStorage.setItem(KEY, JSON.stringify(s))
  }

  function clearShift() {
    setShiftState(null)
    localStorage.removeItem(KEY)
  }

  return (
    <ShiftCtx.Provider value={{ shift, setShift, clearShift }}>
      {children}
    </ShiftCtx.Provider>
  )
}

export const useShift = () => useContext(ShiftCtx)
