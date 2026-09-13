import { createContext, useContext, useState, useEffect } from 'react'
import { authAPI } from '../services/api'
import { io } from 'socket.io-client'

const AuthContext = createContext(null)

const SOCKET_URL = import.meta.env.VITE_API_URL || window.location.origin

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(localStorage.getItem('token'))
  const [socket, setSocket] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (token) {
      authAPI.me()
        .then(res => {
          setUser(res.data.user)
          const s = io(SOCKET_URL, { auth: { token } })
          setSocket(s)
        })
        .catch(() => {
          localStorage.removeItem('token')
          setToken(null)
        })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [token])

  const login = async (username, password) => {
    const res = await authAPI.login({ username, password })
    localStorage.setItem('token', res.data.token)
    setToken(res.data.token)
    setUser(res.data.user)
    return res.data
  }

  const register = async (data) => {
    const res = await authAPI.register(data)
    if (!res.data.token) return res.data
    localStorage.setItem('token', res.data.token)
    setToken(res.data.token)
    setUser(res.data.user)
    return res.data
  }

  const logout = async () => {
    try { await authAPI.logout() } catch {}
    if (socket) socket.disconnect()
    localStorage.removeItem('token')
    setToken(null)
    setUser(null)
    setSocket(null)
  }

  return (
    <AuthContext.Provider value={{ user, token, socket, loading, login, register, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
