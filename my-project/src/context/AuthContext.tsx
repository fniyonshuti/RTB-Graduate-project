import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { api } from '../api/client'
import type { AuthPayload } from '../types'
import { AuthContext, type AuthContextValue } from './auth-context'
import { STORAGE_KEYS } from '../constants/storage'

const STORAGE_KEY = STORAGE_KEYS.AUTH

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
  const [storedAuth] = useState(readStoredAuth)
  const [user, setUser] = useState(storedAuth?.user ?? null)
  const [token, setToken] = useState(storedAuth?.token ?? null)
  const [isLoading, setIsLoading] = useState(Boolean(storedAuth))

  useEffect(() => {
    if (!storedAuth) return

    let isCurrent = true

    api
      .me(storedAuth.token)
      .then((freshUser) => {
        if (!isCurrent) return

        setUser(freshUser)
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ user: freshUser, token: storedAuth.token }),
        )
      })
      .catch(() => {
        if (!isCurrent) return

        localStorage.removeItem(STORAGE_KEY)
        setUser(null)
        setToken(null)
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false)
      })

    return () => {
      isCurrent = false
    }
  }, [storedAuth])

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

  const googleLogin = useCallback(
    async (credential: string) => {
      const payload = await api.googleLogin(credential)
      persistAuth(payload)
    },
    [persistAuth],
  )
  const register = useCallback(
    async (payload: {
      name: string
      email: string
      password: string
      institution?: string
    }) => {
      const authPayload = await api.register(payload)
      persistAuth(authPayload)
    },
    [persistAuth],
  )

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      if (!token) throw new Error('Authentication is required')
      const freshUser = await api.changePassword(token, currentPassword, newPassword)
      setUser(freshUser)
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ user: freshUser, token }))
    },
    [token],
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
      googleLogin,
      changePassword,
      register,
      logout,
    }),
    [changePassword, googleLogin, isLoading, login, logout, register, token, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
