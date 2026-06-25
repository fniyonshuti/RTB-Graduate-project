import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { api } from '../api/client'
import type { AuthPayload, Role, User } from '../types'

type AuthContextValue = {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (payload: {
    name: string
    email: string
    password: string
    role: Role
    institution?: string
  }) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)
const STORAGE_KEY = 'rtb-skills-gap-auth'

function readStoredAuth(): AuthPayload | null {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return null

  try {
    return JSON.parse(raw) as AuthPayload
  } catch {
    localStorage.removeItem(STORAGE_KEY)
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const stored = readStoredAuth()
    if (!stored) {
      setIsLoading(false)
      return
    }

    setUser(stored.user)
    setToken(stored.token)

    api
      .me(stored.token)
      .then((freshUser) => {
        setUser(freshUser)
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ user: freshUser, token: stored.token }),
        )
      })
      .catch(() => {
        localStorage.removeItem(STORAGE_KEY)
        setUser(null)
        setToken(null)
      })
      .finally(() => setIsLoading(false))
  }, [])

  const persistAuth = useCallback((payload: AuthPayload) => {
    setUser(payload.user)
    setToken(payload.token)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  }, [])

  const login = useCallback(
    async (email: string, password: string) => {
      const payload = await api.login(email, password)
      persistAuth(payload)
    },
    [persistAuth],
  )

  const register = useCallback(
    async (payload: {
      name: string
      email: string
      password: string
      role: Role
      institution?: string
    }) => {
      const authPayload = await api.register(payload)
      persistAuth(authPayload)
    },
    [persistAuth],
  )

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setUser(null)
    setToken(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(user && token),
      isLoading,
      login,
      register,
      logout,
    }),
    [isLoading, login, logout, register, token, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider')
  }

  return context
}
