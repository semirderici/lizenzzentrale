// @vitest-environment node
import { sessionCookieOptions } from './cookie-options'

describe('sessionCookieOptions', () => {
  it('setzt HttpOnly und SameSite=Lax und lässt die Lebensdauer bei Supabase (AC-10)', () => {
    const options = sessionCookieOptions('https:')

    expect(options).toEqual({ httpOnly: true, sameSite: 'lax', secure: true })
    expect(options).not.toHaveProperty('maxAge')
    expect(options).not.toHaveProperty('expires')
  })

  it.each(['http:', 'http', 'HTTP', ' http ', 'http,https'])(
    'setzt Secure nicht über eine reine http-Verbindung (%s)',
    (protocol) => {
      expect(sessionCookieOptions(protocol).secure).toBe(false)
    }
  )

  it.each(['https:', 'https', 'https,http', '', null, undefined, 'ws'])(
    'setzt Secure bei https und wenn das Protokoll unbekannt ist (%s)',
    (protocol) => {
      expect(sessionCookieOptions(protocol).secure).toBe(true)
    }
  )
})
