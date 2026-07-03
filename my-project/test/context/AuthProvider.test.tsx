import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../../src/context/AuthContext'
import { useAuth } from '../../src/context/useAuth'
import type { AuthPayload, User } from '../../src/types'

const apiMock = vi.hoisted(() => ({
  changePassword: vi.fn(),
  login: vi.fn(),
  me: vi.fn(),
  register: vi.fn(),
}))

vi.mock('../../src/api/client', () => ({
  api: apiMock,
}))

const graduateUser: User = {
  _id: 'user-1',
  name: 'Stored Graduate',
  email: 'stored@example.com',
  role: 'graduate',
  institution: 'Kicukiro TVET',
  mustChangePassword: false,
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
}

function AuthProbe() {
  const { isAuthenticated, isLoading, login, logout, token, user } = useAuth()

  return (
    <div>
      <span>{isLoading ? 'loading' : 'ready'}</span>
      <span>{isAuthenticated ? 'authenticated' : 'guest'}</span>
      <span>{user?.name || 'No user'}</span>
      <span>{token || 'No token'}</span>
      <button type="button" onClick={() => void login('user@example.com', 'secret')}>
        Log in
      </button>
      <button type="button" onClick={logout}>
        Log out
      </button>
    </div>
  )
}

describe('AuthProvider integration', () => {
  it('hydrates stored auth and refreshes the current user', async () => {
    const freshUser = { ...graduateUser, name: 'Fresh Graduate' }
    apiMock.me.mockResolvedValue(freshUser)
    localStorage.setItem(
      'rtb-skills-gap-auth',
      JSON.stringify({ user: graduateUser, token: 'stored-token' }),
    )

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    )

    expect(screen.getByText('authenticated')).toBeInTheDocument()
    expect(screen.getByText('stored-token')).toBeInTheDocument()

    await waitFor(() => expect(screen.getByText('Fresh Graduate')).toBeInTheDocument())
    expect(apiMock.me).toHaveBeenCalledWith('stored-token')
    expect(JSON.parse(localStorage.getItem('rtb-skills-gap-auth') || '{}')).toEqual({
      user: freshUser,
      token: 'stored-token',
    })
  })

  it('persists auth after login and clears it on logout', async () => {
    const authPayload: AuthPayload = {
      user: graduateUser,
      token: 'login-token',
    }
    apiMock.login.mockResolvedValue(authPayload)

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    )

    screen.getByRole('button', { name: 'Log in' }).click()

    await waitFor(() => expect(screen.getByText('Stored Graduate')).toBeInTheDocument())
    expect(apiMock.login).toHaveBeenCalledWith('user@example.com', 'secret')
    expect(localStorage.getItem('rtb-skills-gap-auth')).toBe(JSON.stringify(authPayload))

    screen.getByRole('button', { name: 'Log out' }).click()

    await waitFor(() => expect(screen.getByText('guest')).toBeInTheDocument())
    expect(localStorage.getItem('rtb-skills-gap-auth')).toBeNull()
  })
})
