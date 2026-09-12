import { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null)
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const storedToken = localStorage.getItem('cyracode_token')
    const storedUser = localStorage.getItem('cyracode_user')
    if (storedToken) setToken(storedToken)
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser))
      } catch {
        setUser(null)
      }
    }
    setLoading(false)
  }, [])

  const login = (newToken, newUser) => {
    setToken(newToken)
    setUser(newUser)
    localStorage.setItem('cyracode_token', newToken)
    if (newUser) localStorage.setItem('cyracode_user', JSON.stringify(newUser))
  }

  const logout = () => {
    setToken(null)
    setUser(null)
    localStorage.removeItem('cyracode_token')
    localStorage.removeItem('cyracode_user')
    // Search history/result cache is per-browser and may contain codes from a
    // previous login — purge it so the next user can't see another user's entries.
    const purge = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (
        key &&
        (key.startsWith('cyracode_search_history') || key.startsWith('cyracode_result_'))
      ) {
        purge.push(key)
      }
    }
    purge.forEach((key) => localStorage.removeItem(key))
  }

  return (
    <AuthContext.Provider
      value={{ user, token, login, logout, isAuthenticated: !!token, loading }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
