// @vitest-environment node
import { sendMail, type MailjetMessage, type MailjetVerdict } from './mailjet.integration'

// Distinctive fake values, so the log checks can look for each of them.
const API_KEY = 'test-api-key-123'
const SECRET_KEY = 'test-secret-key-456'
const CREDENTIALS = Buffer.from(`${API_KEY}:${SECRET_KEY}`).toString('base64')
const SENDER = 'absender-test@example.org'
const RECIPIENT = 'vorname.nachname+kurs@mail.sub.example.com'
const ERROR_TEXT = 'fehlertext-von-mailjet'
const ERROR_IDENTIFIER = '1ab23cd4-0000-4000-8000-feedbeef0001'

/** Nothing of this may ever appear on the console. */
const NEVER_LOGGED = [API_KEY, SECRET_KEY, CREDENTIALS, SENDER, RECIPIENT, ERROR_TEXT, ERROR_IDENTIFIER, 'From']

const message: MailjetMessage = {
  to: RECIPIENT,
  subject: 'Ihre Einladung',
  text: 'Textfassung der Einladung',
  html: '<p>HTML-Fassung der Einladung</p>',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

/** Mailjet's answer for an accepted message (Send API v3.1). */
const SUCCESS_BODY = {
  Messages: [
    {
      Status: 'success',
      CustomID: '',
      To: [
        {
          Email: RECIPIENT,
          MessageUUID: '1ab23cd4-0000-4000-8000-feedbeef0002',
          MessageID: 288230376891494400,
          MessageHref: 'https://api.mailjet.com/v3/REST/message/288230376891494400',
        },
      ],
      Cc: [],
      Bcc: [],
    },
  ],
}

/** Mailjet's answer for a message it refused, with its error text naming an address as it does. */
function messageError(errorCode: string, statusCode: number, address: string) {
  return {
    Messages: [
      {
        Status: 'error',
        Errors: [
          {
            ErrorIdentifier: ERROR_IDENTIFIER,
            ErrorCode: errorCode,
            StatusCode: statusCode,
            ErrorMessage: `"${address}" ${ERROR_TEXT}`,
            ErrorRelatedTo: ['From'],
          },
        ],
      },
    ],
  }
}

const fetchMock = vi.fn<typeof fetch>()
const consoleError = vi.spyOn(console, 'error')

beforeEach(() => {
  vi.stubEnv('MAILJET_API_KEY', API_KEY)
  vi.stubEnv('MAILJET_SECRET_KEY', SECRET_KEY)
  vi.stubEnv('INVITATION_SENDER_EMAIL', SENDER)
  vi.stubGlobal('fetch', fetchMock)
  consoleError.mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
  fetchMock.mockReset()
  consoleError.mockReset()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

function sentRequest() {
  expect(fetchMock).toHaveBeenCalledTimes(1)
  const [url, init] = fetchMock.mock.calls[0]
  return { url, init, headers: new Headers(init?.headers), body: JSON.parse(String(init?.body)) }
}

function basicCredentials(headers: Headers) {
  const authorization = headers.get('authorization') ?? ''
  expect(authorization.startsWith('Basic ')).toBe(true)
  return Buffer.from(authorization.slice('Basic '.length), 'base64').toString()
}

/** Exactly one console line, with exactly these details, and nothing secret in it. */
function expectLogLine(details: string) {
  expect(consoleError).toHaveBeenCalledTimes(1)
  expect(consoleError.mock.calls[0]).toHaveLength(1)
  const line = String(consoleError.mock.calls[0][0])
  expect(line).toBe(`Mailjet: Einladung nicht versendet (${details})`)
  for (const value of NEVER_LOGGED) expect(line).not.toContain(value)
}

describe('sendMail — die Anfrage', () => {
  it('schickt genau eine Nachricht per POST an die Send API v3.1 (AC-2, AC-11)', async () => {
    fetchMock.mockResolvedValue(jsonResponse(SUCCESS_BODY))

    await sendMail(message)
    const { url, init, headers, body } = sentRequest()
    expect(url).toBe('https://api.mailjet.com/v3.1/send')
    expect(init?.method).toBe('POST')
    expect(basicCredentials(headers)).toBe(`${API_KEY}:${SECRET_KEY}`)
    expect(headers.get('content-type')).toBe('application/json')
    expect(body).toStrictEqual({
      Messages: [
        {
          From: { Email: SENDER, Name: 'Lizenzzentrale' },
          To: [{ Email: RECIPIENT }],
          Subject: 'Ihre Einladung',
          TextPart: 'Textfassung der Einladung',
          HTMLPart: '<p>HTML-Fassung der Einladung</p>',
          TrackOpens: 'disabled',
          TrackClicks: 'disabled',
        },
      ],
    })
  })

  it('setzt keine Antwortadresse, keine Kennungen, keine Kopien, Anhänge oder Vorlagen (AC-2, AC-11)', async () => {
    fetchMock.mockResolvedValue(jsonResponse(SUCCESS_BODY))

    await sendMail(message)
    const { body } = sentRequest()
    expect(Object.keys(body)).toEqual(['Messages'])
    const [sent] = body.Messages
    for (const key of [
      'ReplyTo',
      'CustomID',
      'CustomCampaign',
      'EventPayload',
      'URLTags',
      'Cc',
      'Bcc',
      'Attachments',
      'InlinedAttachments',
      'TemplateID',
      'TemplateLanguage',
      'Variables',
      'Headers',
    ]) {
      expect(sent).not.toHaveProperty(key)
    }
    expect(sent.To).toEqual([{ Email: RECIPIENT }])
  })

  it('gibt eine Adresse mit „+“ und Subdomain unverändert weiter (EC-8)', async () => {
    fetchMock.mockResolvedValue(jsonResponse(SUCCESS_BODY))

    await sendMail({ ...message, to: 'vorname.nachname+kurs@mail.sub.example.com' })
    expect(sentRequest().body.Messages[0].To).toStrictEqual([{ Email: 'vorname.nachname+kurs@mail.sub.example.com' }])
  })

  it('liest Schlüssel und Absender bei jedem Aufruf neu, nie beim Laden (EC-9)', async () => {
    fetchMock.mockImplementation(async () => jsonResponse(SUCCESS_BODY))

    expect(await sendMail(message)).toBe('accepted')
    vi.stubEnv('MAILJET_API_KEY', 'test-api-key-789')
    vi.stubEnv('INVITATION_SENDER_EMAIL', 'anderer-absender@example.org')
    expect(await sendMail(message)).toBe('accepted')

    const [first, second] = fetchMock.mock.calls.map(([, init]) => ({
      headers: new Headers(init?.headers),
      body: JSON.parse(String(init?.body)),
    }))
    expect(basicCredentials(first.headers)).toBe(`${API_KEY}:${SECRET_KEY}`)
    expect(first.body.Messages[0].From.Email).toBe(SENDER)
    expect(basicCredentials(second.headers)).toBe(`test-api-key-789:${SECRET_KEY}`)
    expect(second.body.Messages[0].From.Email).toBe('anderer-absender@example.org')
  })

  it('nimmt die Werte ohne Leerzeichen am Rand', async () => {
    fetchMock.mockResolvedValue(jsonResponse(SUCCESS_BODY))
    vi.stubEnv('MAILJET_API_KEY', ` ${API_KEY}\n`)
    vi.stubEnv('MAILJET_SECRET_KEY', ` ${SECRET_KEY} `)
    vi.stubEnv('INVITATION_SENDER_EMAIL', ` ${SENDER} `)

    expect(await sendMail(message)).toBe('accepted')
    const { headers, body } = sentRequest()
    expect(basicCredentials(headers)).toBe(`${API_KEY}:${SECRET_KEY}`)
    expect(body.Messages[0].From.Email).toBe(SENDER)
  })

  it.each([
    ['MAILJET_API_KEY', 'fehlt', undefined],
    ['MAILJET_API_KEY', 'leer', '   '],
    ['MAILJET_SECRET_KEY', 'fehlt', undefined],
    ['MAILJET_SECRET_KEY', 'leer', '   '],
    ['INVITATION_SENDER_EMAIL', 'fehlt', undefined],
    ['INVITATION_SENDER_EMAIL', 'leer', '   '],
  ])('ist ohne Anfrage fehlgeschlagen, wenn %s %s (EC-9)', async (name, _case, value) => {
    vi.stubEnv(name, value)

    expect(await sendMail(message)).toBe('failed')
    expect(fetchMock).not.toHaveBeenCalled()
    expectLogLine('nicht eingestellt')
  })
})

describe('sendMail — die Antwort', () => {
  it.each([200, 201])('ist angenommen bei HTTP %i und Status success (AC-3)', async (status) => {
    fetchMock.mockResolvedValue(jsonResponse(SUCCESS_BODY, status))

    expect(await sendMail(message)).toBe('accepted')
    expect(consoleError).not.toHaveBeenCalled()
  })

  it('lässt nach der Antwort keine Zeitgrenze stehen', async () => {
    vi.useFakeTimers()
    fetchMock.mockResolvedValue(jsonResponse(SUCCESS_BODY))

    expect(await sendMail(message)).toBe('accepted')
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each([
    [
      'falscher Schlüssel',
      jsonResponse(
        { ErrorIdentifier: ERROR_IDENTIFIER, ErrorCode: 'mj-0015', StatusCode: 401, ErrorMessage: ERROR_TEXT },
        401,
      ),
      'HTTP 401, mj-0015',
    ],
    ['falscher Schlüssel, ohne Rumpf', new Response(null, { status: 401 }), 'HTTP 401'],
    ['unbestätigter Absender', jsonResponse(messageError('send-0008', 403, SENDER), 403), 'HTTP 403, send-0008'],
    ['ungültige Nachricht', jsonResponse(messageError('mj-0013', 400, RECIPIENT), 400), 'HTTP 400, mj-0013'],
    ['zu viele Anfragen', new Response(`Too many requests for ${RECIPIENT}`, { status: 429 }), 'HTTP 429'],
    ['Fehler bei Mailjet', new Response('<html>Service Unavailable</html>', { status: 503 }), 'HTTP 503'],
    ['HTTP-Fehler, auch wenn der Rumpf success meldet', jsonResponse(SUCCESS_BODY, 500), 'HTTP 500'],
    ['Status error bei HTTP 200', jsonResponse(messageError('send-0003', 400, RECIPIENT)), 'HTTP 200, nicht angenommen, send-0003'],
  ])('ist fehlgeschlagen und protokolliert nur Status und Code (%s) (AC-3, EC-9)', async (_case, response, details) => {
    fetchMock.mockResolvedValue(response)

    expect(await sendMail(message)).toBe('failed')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expectLogLine(details)
  })

  it.each([
    ['kein JSON', new Response('<html>OK</html>', { status: 200 })],
    ['leerer Rumpf', new Response(null, { status: 200 })],
    ['null', jsonResponse(null)],
    ['ohne Messages', jsonResponse({ Status: 'success' })],
    ['Messages ist keine Liste', jsonResponse({ Messages: 'success' })],
    ['keine Nachricht', jsonResponse({ Messages: [] })],
    ['zwei Nachrichten', jsonResponse({ Messages: [SUCCESS_BODY.Messages[0], SUCCESS_BODY.Messages[0]] })],
    ['Nachricht ist kein Objekt', jsonResponse({ Messages: ['success'] })],
  ])('ist fehlgeschlagen bei einer unlesbaren Antwort mit HTTP 2xx (%s)', async (_case, response) => {
    fetchMock.mockResolvedValue(response)

    expect(await sendMail(message)).toBe('failed')
    expectLogLine('HTTP 200, Antwort nicht lesbar')
  })

  it.each([
    ['anderer Status', { Messages: [{ Status: 'queued' }] }],
    ['Status in Großbuchstaben', { Messages: [{ Status: 'SUCCESS' }] }],
    ['ohne Status', { Messages: [{ To: [{ Email: RECIPIENT }] }] }],
  ])('ist nur bei Status success angenommen (%s)', async (_case, body) => {
    fetchMock.mockResolvedValue(jsonResponse(body, 201))

    expect(await sendMail(message)).toBe('failed')
    expectLogLine('HTTP 201, nicht angenommen')
  })

  it('protokolliert nur Codes in Mailjets Form, nie etwas anderes aus dem Feld', async () => {
    const body = messageError('send-0008', 403, SENDER)
    body.Messages[0].Errors.push(
      { ...body.Messages[0].Errors[0], ErrorCode: RECIPIENT },
      { ...body.Messages[0].Errors[0], ErrorCode: `send-0008 ${ERROR_TEXT}` },
      { ...body.Messages[0].Errors[0], ErrorCode: 'send-0008' },
    )
    fetchMock.mockResolvedValue(jsonResponse({ ...body, ErrorCode: API_KEY }, 403))

    expect(await sendMail(message)).toBe('failed')
    expectLogLine('HTTP 403, send-0008')
  })

  it('ist fehlgeschlagen, wenn keine Verbindung zustande kommt', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'))

    expect(await sendMail(message)).toBe('failed')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expectLogLine('keine Verbindung')
  })

  it('bricht nach genau 10 Sekunden ab und versucht es nicht erneut (AC-3)', async () => {
    vi.useFakeTimers()
    // Like the real fetch: no answer, until the signal aborts the request.
    fetchMock.mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(init.signal?.reason))
        }),
    )
    let verdict: MailjetVerdict | undefined
    const sending = sendMail(message).then((result) => (verdict = result))

    await vi.advanceTimersByTimeAsync(9_999)
    const signal = fetchMock.mock.calls[0][1]?.signal
    expect(signal).toBeInstanceOf(AbortSignal)
    expect(signal?.aborted).toBe(false)
    expect(verdict).toBeUndefined()

    await vi.advanceTimersByTimeAsync(1)
    expect(signal?.aborted).toBe(true)
    expect(await sending).toBe('failed')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expectLogLine('Zeitüberschreitung')
  })
})
