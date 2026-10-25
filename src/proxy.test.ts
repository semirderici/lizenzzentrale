// @vitest-environment node
import { NextRequest, type NextResponse } from 'next/server'
import type { CookieMethodsServer, CookieOptionsWithName } from '@supabase/ssr'
import { config, proxy } from './proxy'
import { sessionCookieOptions } from '@/lib/supabase/cookie-options'

type ClientOptions = { cookieOptions: CookieOptionsWithName; cookies: CookieMethodsServer }

const fake = vi.hoisted(() => ({
  calls: [] as { url: string; key: string; options: unknown }[],
  getUser: vi.fn(),
  getSession: vi.fn(),
  getClaims: vi.fn(),
}))

vi.mock('@supabase/ssr', () => ({
  createServerClient: (url: string, key: string, options: unknown) => {
    fake.calls.push({ url, key, options })
    return { auth: { getUser: fake.getUser, getSession: fake.getSession, getClaims: fake.getClaims } }
  },
}))

const ORIGIN = 'http://localhost:3000'
const COOKIE = 'sb-test-auth-token'
const NO_STORE = 'private, no-cache, no-store, must-revalidate, max-age=0'

const signedIn = { data: { user: { id: 'u1' } }, error: null }
const signedOut = { data: { user: null }, error: { name: 'AuthSessionMissingError', message: 'Auth session missing!' } }

function lastOptions() {
  return fake.calls.at(-1)!.options as ClientOptions
}

/** getUser first writes cookies through the captured setAll, as a token refresh does. */
function refreshThen(result: unknown, value: string, maxAge: number) {
  fake.getUser.mockImplementation(async () => {
    const { cookies, cookieOptions } = lastOptions()
    await cookies.setAll!(
      [{ name: COOKIE, value, options: { ...cookieOptions, path: '/', maxAge } }],
      { 'Cache-Control': NO_STORE, Expires: '0', Pragma: 'no-cache' }
    )
    return result
  })
}

function run(path: string, method = 'GET', init: { origin?: string; cookie?: string } = {}) {
  const headers = init.cookie ? { cookie: init.cookie } : undefined
  return proxy(new NextRequest(`${init.origin ?? ORIGIN}${path}`, { method, headers }))
}

function expectRedirect(response: NextResponse, target: string) {
  expect(response.status).toBe(307)
  expect(response.headers.get('location')).toBe(`${ORIGIN}${target}`)
}

function expectPassThrough(response: NextResponse) {
  expect(response.status).toBe(200)
  expect(response.headers.get('x-middleware-next')).toBe('1')
  expect(response.headers.get('location')).toBeNull()
}

beforeEach(() => {
  fake.calls.length = 0
  fake.getUser.mockReset()
  fake.getSession.mockReset()
  fake.getClaims.mockReset()
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project-ref.supabase.co')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('Weiterleitungen bei GET und HEAD', () => {
  describe.each(['GET', 'HEAD'])('%s', (method) => {
    it('leitet abgemeldet von / auf /login um (AC-9)', async () => {
      fake.getUser.mockResolvedValue(signedOut)
      expectRedirect(await run('/', method), '/login')
    })

    it('leitet angemeldet von / auf /licenses um (AC-9)', async () => {
      fake.getUser.mockResolvedValue(signedIn)
      expectRedirect(await run('/', method), '/licenses')
    })

    it('leitet abgemeldet von /licenses auf /login?reason=session um (AC-9, EC-6)', async () => {
      fake.getUser.mockResolvedValue(signedOut)
      expectRedirect(await run('/licenses', method), '/login?reason=session')
    })

    it('lässt angemeldet /licenses durch (AC-9)', async () => {
      fake.getUser.mockResolvedValue(signedIn)
      expectPassThrough(await run('/licenses', method))
    })

    it('lässt abgemeldet /login und /register durch (AC-9)', async () => {
      fake.getUser.mockResolvedValue(signedOut)
      expectPassThrough(await run('/login', method))
      expectPassThrough(await run('/register', method))
    })

    it('leitet angemeldet von /login und /register auf /licenses um (AC-9)', async () => {
      fake.getUser.mockResolvedValue(signedIn)
      expectRedirect(await run('/login', method), '/licenses')
      expectRedirect(await run('/register', method), '/licenses')
    })

    it('leitet abgemeldet von einer unbekannten Adresse auf /login?reason=session um (AC-9, EC-6)', async () => {
      fake.getUser.mockResolvedValue(signedOut)
      expectRedirect(await run('/gibt-es-nicht/tief', method), '/login?reason=session')
      expectRedirect(await run('/sign-out', method), '/login?reason=session')
    })

    it('lässt angemeldet jede andere Adresse durch (AC-9)', async () => {
      fake.getUser.mockResolvedValue(signedIn)
      expectPassThrough(await run('/gibt-es-nicht', method))
      expectPassThrough(await run('/sign-out', method))
    })
  })
})

describe('andere Methoden als GET und HEAD', () => {
  it.each(['/licenses', '/login', '/register', '/sign-out', '/'])(
    'lässt POST an %s abgemeldet ohne Weiterleitung durch (AC-10, EC-6)',
    async (path) => {
      fake.getUser.mockResolvedValue(signedOut)
      expectPassThrough(await run(path, 'POST'))
    }
  )

  it('lässt POST an /login und / angemeldet ohne Weiterleitung durch (AC-9)', async () => {
    fake.getUser.mockResolvedValue(signedIn)
    expectPassThrough(await run('/login', 'POST'))
    expectPassThrough(await run('/', 'POST'))
  })

  it.each(['PUT', 'PATCH', 'DELETE', 'OPTIONS'])(
    'lässt %s an /licenses abgemeldet ohne Weiterleitung durch (EC-6)',
    async (method) => {
      fake.getUser.mockResolvedValue(signedOut)
      expectPassThrough(await run('/licenses', method))
    }
  )

  it('frischt die Sitzung auch bei POST auf und gibt das Cookie mit (AC-10)', async () => {
    refreshThen(signedIn, 'fresh', 3600)
    const response = await run('/licenses', 'POST', { cookie: `${COOKIE}=stale` })
    expectPassThrough(response)
    expect(fake.getUser).toHaveBeenCalledTimes(1)
    expect(response.cookies.get(COOKIE)?.value).toBe('fresh')
  })
})

describe('Adresse der Weiterleitung', () => {
  it('übernimmt die ursprüngliche Query nicht in die Login-Adresse (EC-6)', async () => {
    fake.getUser.mockResolvedValue(signedOut)
    expectRedirect(
      await run('/licenses?next=https://evil.example&reason=x#frag', 'GET'),
      '/login?reason=session'
    )
    expectRedirect(await run('/?reason=session&x=1', 'GET'), '/login')
  })

  it('übernimmt die Query auch angemeldet nicht in /licenses (AC-9)', async () => {
    fake.getUser.mockResolvedValue(signedIn)
    expectRedirect(await run('/login?reason=session&x=1', 'GET'), '/licenses')
  })

  it('bleibt beim Host der Anfrage (AC-9)', async () => {
    fake.getUser.mockResolvedValue(signedOut)
    const response = await run('/licenses', 'GET', { origin: 'https://lizenzen.example' })
    expect(response.headers.get('location')).toBe('https://lizenzen.example/login?reason=session')
  })
})

describe('Cookies der Sitzung', () => {
  it('gibt ein aufgefrischtes Cookie beim Durchlassen an Antwort und Seite weiter (AC-10)', async () => {
    refreshThen(signedIn, 'fresh', 3600)
    const response = await run('/licenses', 'GET', { cookie: `${COOKIE}=stale` })
    expectPassThrough(response)
    expect(response.cookies.get(COOKIE)?.value).toBe('fresh')
    // The page behind the gate reads the refreshed cookie, not the stale one.
    expect(response.headers.get('x-middleware-request-cookie')).toContain(`${COOKIE}=fresh`)
    expect(response.headers.get('cache-control')).toBe(NO_STORE)
  })

  it('gibt ein aufgefrischtes Cookie auch bei einer Weiterleitung mit (AC-9, AC-10)', async () => {
    refreshThen(signedIn, 'fresh', 3600)
    const response = await run('/', 'GET', { cookie: `${COOKIE}=stale` })
    expectRedirect(response, '/licenses')
    expect(response.cookies.get(COOKIE)).toMatchObject({ value: 'fresh', maxAge: 3600, httpOnly: true, sameSite: 'lax' })
    expect(response.headers.get('cache-control')).toBe(NO_STORE)
  })

  it('gibt ein gelöschtes Cookie bei der Weiterleitung auf den Login mit (EC-6)', async () => {
    refreshThen(signedOut, '', 0)
    const response = await run('/licenses', 'GET', { cookie: `${COOKIE}=revoked` })
    expectRedirect(response, '/login?reason=session')
    expect(response.cookies.get(COOKIE)).toMatchObject({ value: '', maxAge: 0 })
    expect(response.headers.get('set-cookie')).toContain(`${COOKIE}=;`)
  })

  it('setzt ohne Auffrischung keine Cookies, auch nicht die der Anfrage (AC-10)', async () => {
    fake.getUser.mockResolvedValue(signedIn)
    expect((await run('/', 'GET', { cookie: `${COOKIE}=abc` })).headers.get('set-cookie')).toBeNull()
    expect((await run('/licenses', 'GET', { cookie: `${COOKIE}=abc` })).headers.get('set-cookie')).toBeNull()
  })

  it('liest die Cookies der Anfrage über getAll (AC-10)', async () => {
    fake.getUser.mockResolvedValue(signedIn)
    await run('/licenses', 'GET', { cookie: `${COOKIE}=abc; other=1` })
    expect(lastOptions().cookies.getAll()).toEqual([
      { name: COOKIE, value: 'abc' },
      { name: 'other', value: '1' },
    ])
  })

  it('nutzt die Cookie-Regeln aus sessionCookieOptions, über http ohne Secure (AC-10)', async () => {
    fake.getUser.mockResolvedValue(signedIn)
    await run('/licenses', 'GET')
    expect(lastOptions().cookieOptions).toEqual(sessionCookieOptions('http:'))
    expect(lastOptions().cookieOptions).toEqual({ httpOnly: true, sameSite: 'lax', secure: false })
  })

  it('nutzt über https Secure-Cookies (AC-10)', async () => {
    fake.getUser.mockResolvedValue(signedIn)
    await run('/licenses', 'GET', { origin: 'https://lizenzen.example' })
    expect(lastOptions().cookieOptions).toEqual({ httpOnly: true, sameSite: 'lax', secure: true })
  })

  it('baut den Client aus den beiden öffentlichen Supabase-Werten (AC-9)', async () => {
    fake.getUser.mockResolvedValue(signedIn)
    await run('/licenses', 'GET')
    expect(fake.calls).toHaveLength(1)
    expect(fake.calls[0]).toMatchObject({ url: 'https://project-ref.supabase.co', key: 'anon-key' })
  })
})

describe('Quelle der Entscheidung', () => {
  it('entscheidet über getUser, nicht über getSession oder getClaims (AC-9, EC-6)', async () => {
    // Cookie still looks valid locally, but the Auth server knows the session has ended.
    fake.getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } }, error: null })
    fake.getClaims.mockResolvedValue({ data: { claims: { sub: 'u1' } }, error: null })
    fake.getUser.mockResolvedValue(signedOut)
    expectRedirect(await run('/licenses', 'GET'), '/login?reason=session')
    expect(fake.getUser).toHaveBeenCalledTimes(1)
    expect(fake.getSession).not.toHaveBeenCalled()
    expect(fake.getClaims).not.toHaveBeenCalled()
  })

  it('lässt durch, wenn getUser einen Nutzer liefert, auch ohne lokale Sitzung (AC-9)', async () => {
    fake.getSession.mockResolvedValue({ data: { session: null }, error: null })
    fake.getClaims.mockResolvedValue({ data: null, error: null })
    fake.getUser.mockResolvedValue(signedIn)
    expectPassThrough(await run('/licenses', 'GET'))
  })

  it('wertet einen Fehler von getUser als abgemeldet, auch mit Nutzer (EC-6)', async () => {
    fake.getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: { name: 'AuthApiError', message: 'boom' } })
    expectRedirect(await run('/licenses', 'GET'), '/login?reason=session')
    expectPassThrough(await run('/login', 'GET'))
  })

  it('wertet einen geworfenen Fehler von getUser als abgemeldet, ohne Fehlerseite (EC-6)', async () => {
    fake.getUser.mockRejectedValue(new Error('network down'))
    expectRedirect(await run('/licenses', 'GET'), '/login?reason=session')
    expectRedirect(await run('/', 'GET'), '/login')
  })
})

describe('Matcher', () => {
  const matches = (pathname: string) => config.matcher.some((source) => new RegExp(`^${source}$`).test(pathname))

  it.each(['/', '/login', '/register', '/licenses', '/sign-out', '/gibt-es-nicht/tief'])(
    'läuft auf %s (AC-9)',
    (pathname) => {
      expect(matches(pathname)).toBe(true)
    }
  )

  it.each([
    '/_next/static/chunks/main.js',
    '/_next/static/css/app.css',
    '/_next/image',
    '/favicon.ico',
    '/next.svg',
    '/bilder/logo.png',
    '/a.jpg',
    '/a.jpeg',
    '/a.gif',
    '/a.webp',
    '/icons/app.ico',
  ])('läuft nicht auf %s (AC-9)', (pathname) => {
    expect(matches(pathname)).toBe(false)
  })
})
