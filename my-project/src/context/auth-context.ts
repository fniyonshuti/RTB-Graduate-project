import { createContext } from 'react'
import type { Role, User } from '../types'

export type AuthContextValue = {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>
  register: (payload: {
    name: string
    email: string
    password: string
    role?: Role
    institution?: string
    organizationId?: string
  }) => Promise<void>
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)
