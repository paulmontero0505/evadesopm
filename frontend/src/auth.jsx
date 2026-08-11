import { createContext, useContext, useEffect, useState } from 'react'
import { api } from './api.js'

const AuthCtx = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) { setLoading(false); return }
    api.me()
      .then((d) => setUser(d.user))
      .catch(() => { localStorage.removeItem('token') })
      .finally(() => setLoading(false))
  }, [])

  async function login(employee_number, password) {
    const d = await api.login(employee_number, password)
    localStorage.setItem('token', d.token)
    setUser(d.user)
    return d.user
  }

  async function logout() {
    try { await api.logout() } catch { /* ignore */ }
    localStorage.removeItem('token')
    setUser(null)
  }

  async function changePassword(password) {
    const d = await api.changePassword(password)
    setUser(d.user)
    return d.user
  }

  return (
    <AuthCtx.Provider value={{ user, loading, login, logout, changePassword }}>
      {children}
    </AuthCtx.Provider>
  )
}

export const useAuth = () => useContext(AuthCtx)
