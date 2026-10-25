// @vitest-environment node
import { verifyTurnstileToken } from './turnstile.integration'

const SECRET = '1x0000000000000000000000000000000AA'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  vi.stubEnv('TURNSTILE_SECRET_KEY', SECRET)
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  fetchMock.mockReset()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

function sentBody() {
  const [url, init] = fetchMock.mock.calls[0]
  expect(url).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify')
  expect(init?.method).toBe('POST')
  return new URLSearchParams(init?.body as URLSearchParams)
}

describe('verifyTurnstileToken', () => {
  it('besteht, wenn Cloudflare success: true meldet (AC-7)', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true }))

    expect(await verifyTurnstileToken('token-1', '203.0.113.7')).toBe('passed')
    const body = sentBody()
    expect(body.get('secret')).toBe(SECRET)
    expect(body.get('response')).toBe('token-1')
    expect(body.get('remoteip')).toBe('203.0.113.7')
  })

  it('schickt ohne übergebene IP keine IP mit', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true }))

    await verifyTurnstileToken('token-1')
    expect(sentBody().has('remoteip')).toBe(false)
  })

  it('setzt eine Zeitgrenze für die Anfrage', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true }))

    await verifyTurnstileToken('token-1')
    expect(fetchMock.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal)
  })

  it.each([
    ['ungültiges Token', ['invalid-input-response']],
    ['abgelaufenes oder schon benutztes Token', ['timeout-or-duplicate']],
    ['ohne Fehlercodes', undefined],
  ])('lehnt ab bei success: false (%s) (AC-7)', async (_case, errorCodes) => {
    fetchMock.mockResolvedValue(jsonResponse({ success: false, 'error-codes': errorCodes }))

    expect(await verifyTurnstileToken('token-1')).toBe('rejected')
  })

  it.each([
    ['falsches Secret', ['invalid-input-secret']],
    ['Fehler bei Cloudflare', ['internal-error']],
  ])('gilt als Fehler, nie als bestanden (%s) (EC-3)', async (_case, errorCodes) => {
    fetchMock.mockResolvedValue(jsonResponse({ success: false, 'error-codes': errorCodes }))

    expect(await verifyTurnstileToken('token-1')).toBe('error')
  })

  it('gilt ohne Secret als Fehler und fragt Cloudflare gar nicht (EC-3)', async () => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', '')

    expect(await verifyTurnstileToken('token-1')).toBe('error')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('gilt als Fehler, wenn keine Antwort kommt (EC-3)', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'))

    expect(await verifyTurnstileToken('token-1')).toBe('error')
  })

  it('gilt als Fehler bei einem HTTP-Fehler, auch wenn der Text success: true enthält', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true }, 500))

    expect(await verifyTurnstileToken('token-1')).toBe('error')
  })

  it.each([
    ['kein JSON', new Response('<html>Bad Gateway</html>', { status: 200 })],
    ['ohne success', jsonResponse({ hostname: 'example.com' })],
    ['success ist kein Boolean', jsonResponse({ success: 'true' })],
    ['null', jsonResponse(null)],
  ])('gilt als Fehler bei einer unlesbaren Antwort (%s)', async (_case, response) => {
    fetchMock.mockResolvedValue(response)

    expect(await verifyTurnstileToken('token-1')).toBe('error')
  })
})
