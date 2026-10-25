// @vitest-environment node
import { isConnectionError, isRedirectError } from './form-feedback'

// What Next.js puts on the error after `redirect()` in a Server Action.
const REDIRECT_DIGEST = 'NEXT_REDIRECT;replace;/licenses;307;'

describe('isRedirectError', () => {
  it.each([
    ['replace', { digest: REDIRECT_DIGEST }],
    ['push', { digest: 'NEXT_REDIRECT;push;/licenses;303;' }],
    ['Error mit digest', Object.assign(new Error('NEXT_REDIRECT'), { digest: REDIRECT_DIGEST })],
  ])('wertet die Weiterleitung nach dem Erfolg als Erfolg (%s) (AC-1, AC-4)', (_, error) => {
    expect(isRedirectError(error)).toBe(true)
  })

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['Error nur mit Text', new Error('NEXT_REDIRECT')],
    ['Zeichenkette', 'NEXT_REDIRECT'],
    ['anderer digest', { digest: 'NEXT_HTTP_ERROR_FALLBACK;404' }],
    ['digest kein Text', { digest: 42 }],
    ['digest nicht am Anfang', { digest: `x${REDIRECT_DIGEST}` }],
    ['Netzwerkfehler', new TypeError('Failed to fetch')],
  ])('hält alles andere nie für eine Weiterleitung (%s) (EC-3, EC-9)', (_, error) => {
    expect(isRedirectError(error)).toBe(false)
  })
})

describe('isConnectionError', () => {
  it.each([
    ['Chrome', new TypeError('Failed to fetch')],
    ['Firefox', new TypeError('NetworkError when attempting to fetch resource.')],
    ['Safari', new TypeError('Load failed')],
  ])('erkennt eine fehlende Antwort des App-Servers (%s) (EC-9)', (_, error) => {
    expect(isConnectionError(error)).toBe(true)
  })

  it.each([
    ['Serverfehler', new Error('An unexpected response was received from the server.')],
    ['Weiterleitung', Object.assign(new Error('NEXT_REDIRECT'), { digest: REDIRECT_DIGEST })],
    ['nachgebauter TypeError', { name: 'TypeError', message: 'Failed to fetch' }],
    ['Abbruch', new DOMException('The operation was aborted.', 'AbortError')],
    ['null', null],
    ['undefined', undefined],
  ])('meldet „Keine Verbindung“ nicht bei anderen Fehlern (%s) (EC-3, EC-9)', (_, error) => {
    expect(isConnectionError(error)).toBe(false)
  })
})
