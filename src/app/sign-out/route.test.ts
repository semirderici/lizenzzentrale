// @vitest-environment node
// What signing out does to the session and its cookies is tested in auth.data.test.ts; this
// file covers the route: the method, the redirect and its target.
import { NextRequest } from 'next/server'
import { signOutCurrentSession } from '@/features/account/auth.data'
import * as route from './route'

vi.mock('@/features/account/auth.data', () => ({ signOutCurrentSession: vi.fn() }))

function requestWith(method: string) {
  return new NextRequest('http://localhost:3000/sign-out', { method })
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('POST /sign-out', () => {
  it('meldet mit Sitzung ab und leitet mit 303 auf /login (AC-10)', async () => {
    vi.mocked(signOutCurrentSession).mockResolvedValue({ hadSession: true })

    const response = await route.POST(requestWith('POST'))

    expect(signOutCurrentSession).toHaveBeenCalledTimes(1)
    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe('http://localhost:3000/login')
  })

  it('leitet ohne Sitzung mit 303 auf /login?reason=session (EC-6)', async () => {
    vi.mocked(signOutCurrentSession).mockResolvedValue({ hadSession: false })

    const response = await route.POST(requestWith('POST'))

    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe('http://localhost:3000/login?reason=session')
  })
})

describe('andere Methoden', () => {
  it.each(['GET', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] as const)(
    'antwortet auf %s mit 405 und meldet niemanden ab',
    async (method) => {
      const response = await route[method]()

      expect(response.status).toBe(405)
      expect(response.headers.get('allow')).toBe('POST')
      expect(signOutCurrentSession).not.toHaveBeenCalled()
    }
  )

  it('exportiert außer POST keinen Handler, der abmelden könnte', () => {
    const handlers = Object.keys(route).filter((name) => name !== 'POST')
    expect(handlers.sort()).toEqual(['DELETE', 'GET', 'OPTIONS', 'PATCH', 'PUT'])
  })
})
