import { createContext } from 'react'
import type { RegisterResponse } from '../api/client'
import type { User } from '../types'

export type AuthContextValue = {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  googleLogin: (credential: string, options?: { termsAccepted?: boolean; privacyPolicyAccepted?: boolean }) => Promise<void>
  verifyEmailCode: (email: string, code: string) => Promise<void>
  verifyEmailToken: (token: string) => Promise<void>
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>
  register: (payload: {
    name: string
    email: string
    password: string
    institution?: string
    termsAccepted?: boolean
    privacyPolicyAccepted?: boolean
  }) => Promise<RegisterResponse>
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)
