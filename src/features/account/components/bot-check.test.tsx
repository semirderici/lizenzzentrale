import { createRef, useImperativeHandle } from 'react'
import { act, render, screen } from '@testing-library/react'
import type { TurnstileInstance, TurnstileProps } from '@marsidev/react-turnstile'
import { BotCheck, type BotCheckHandle } from './bot-check'

const TEST_SITE_KEY = '1x00000000000000000000AA'

// Fake of the external widget: records the props it gets and exposes `reset` through its ref,
// so the tests can fire Cloudflare's callbacks by hand.
const fake = vi.hoisted(() => ({
  render: vi.fn(),
  reset: vi.fn(),
}))

vi.mock('@marsidev/react-turnstile', () => ({
  Turnstile: function FakeTurnstile({
    ref,
    ...props
  }: TurnstileProps & { ref?: React.Ref<TurnstileInstance | undefined> }) {
    fake.render(props)
    useImperativeHandle(ref, () => ({ reset: fake.reset }) as unknown as TurnstileInstance)
    return <div data-testid="turnstile-widget" />
  },
}))

function widgetProps(): TurnstileProps {
  const last = fake.render.mock.lastCall
  if (!last) throw new Error('Turnstile was not rendered')
  return last[0] as TurnstileProps
}

function renderBotCheck() {
  const onToken = vi.fn()
  const onUnavailable = vi.fn()
  const ref = createRef<BotCheckHandle>()
  const view = render(<BotCheck ref={ref} onToken={onToken} onUnavailable={onUnavailable} />)
  return { ...view, onToken, onUnavailable, ref }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', TEST_SITE_KEY)
  fake.render.mockClear()
  fake.reset.mockClear()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

describe('BotCheck', () => {
  it('reicht das Token nach bestandener Prüfung an das Formular weiter (AC-7)', () => {
    const { onToken, onUnavailable } = renderBotCheck()

    act(() => widgetProps().onSuccess?.('token-abc'))

    expect(onToken).toHaveBeenCalledTimes(1)
    expect(onToken).toHaveBeenCalledWith('token-abc')
    expect(onUnavailable).not.toHaveBeenCalled()
  })

  it('meldet ein abgelaufenes Token als null, bis das Widget selbst ein neues holt (AC-7)', () => {
    const { onToken } = renderBotCheck()
    expect(widgetProps().options?.refreshExpired).toBe('auto')

    act(() => widgetProps().onSuccess?.('token-1'))
    act(() => widgetProps().onExpire?.('token-1'))
    expect(onToken).toHaveBeenLastCalledWith(null)

    act(() => widgetProps().onSuccess?.('token-2'))
    expect(onToken).toHaveBeenLastCalledWith('token-2')
  })

  it('setzt das Widget über reset() zurück und meldet bis zum neuen Token kein Token (AC-7)', () => {
    const { onToken, ref } = renderBotCheck()
    act(() => widgetProps().onSuccess?.('token-used'))

    act(() => ref.current?.reset())

    expect(fake.reset).toHaveBeenCalledTimes(1)
    expect(onToken).toHaveBeenLastCalledWith(null)
  })

  it('meldet einen Fehler des Widgets als „nicht verfügbar“ und verwirft das Token (EC-8)', () => {
    const { onToken, onUnavailable } = renderBotCheck()

    act(() => widgetProps().onError?.('300010'))

    expect(onUnavailable).toHaveBeenCalledTimes(1)
    expect(onToken).toHaveBeenLastCalledWith(null)
  })

  it('meldet ein Skript, das sich nicht laden lässt, als „nicht verfügbar“ (EC-8)', () => {
    const { onUnavailable } = renderBotCheck()

    act(() => widgetProps().scriptOptions?.onError?.())

    expect(onUnavailable).toHaveBeenCalledTimes(1)
  })

  it('meldet einen Browser, den die Prüfung nicht unterstützt, als „nicht verfügbar“ (EC-8)', () => {
    const { onUnavailable } = renderBotCheck()

    act(() => widgetProps().onUnsupported?.())

    expect(onUnavailable).toHaveBeenCalledTimes(1)
  })

  it('meldet nach 15 Sekunden ohne sichtbares Widget „nicht verfügbar“ (EC-8)', () => {
    const { onUnavailable } = renderBotCheck()

    act(() => vi.advanceTimersByTime(14_999))
    expect(onUnavailable).not.toHaveBeenCalled()

    act(() => vi.advanceTimersByTime(1))
    expect(onUnavailable).toHaveBeenCalledTimes(1)
  })

  it('meldet nichts, wenn das Widget innerhalb von 15 Sekunden sichtbar ist (EC-8)', () => {
    const { onUnavailable } = renderBotCheck()

    act(() => vi.advanceTimersByTime(5_000))
    act(() => widgetProps().onWidgetLoad?.('widget-1'))
    act(() => vi.advanceTimersByTime(60_000))

    expect(onUnavailable).not.toHaveBeenCalled()
  })

  it('räumt den 15-Sekunden-Timer auf, wenn die Seite verlassen wird (EC-8)', () => {
    const { onUnavailable, unmount } = renderBotCheck()

    unmount()
    act(() => vi.advanceTimersByTime(60_000))

    expect(onUnavailable).not.toHaveBeenCalled()
  })

  it('meldet „nicht verfügbar“ nur einmal, auch wenn mehrere Ladefehler zusammenkommen (EC-8)', () => {
    const { onUnavailable } = renderBotCheck()

    act(() => widgetProps().scriptOptions?.onError?.())
    act(() => widgetProps().onError?.('200500'))
    act(() => vi.advanceTimersByTime(60_000))

    expect(onUnavailable).toHaveBeenCalledTimes(1)
  })

  it('zeigt ohne Site-Key kein Widget und meldet „nicht verfügbar“ (EC-8)', () => {
    vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', undefined)

    const { onUnavailable } = renderBotCheck()

    expect(screen.queryByTestId('turnstile-widget')).not.toBeInTheDocument()
    expect(fake.render).not.toHaveBeenCalled()
    expect(onUnavailable).toHaveBeenCalledTimes(1)
  })

  it('lädt das Widget mit Site-Key, auf Deutsch, im Farbschema des Geräts und in voller Breite (AC-7)', () => {
    renderBotCheck()

    expect(screen.getByTestId('turnstile-widget')).toBeInTheDocument()
    expect(widgetProps().siteKey).toBe(TEST_SITE_KEY)
    expect(widgetProps().options).toMatchObject({
      language: 'de',
      theme: 'auto',
      size: 'flexible',
    })
  })

  it('reserviert die Höhe des Widgets vorab, damit das Formular nicht springt (AC-7)', () => {
    const { container } = renderBotCheck()

    expect(container.firstElementChild).toHaveClass('min-h-[65px]', 'w-full')
    expect(container.firstElementChild).toContainElement(screen.getByTestId('turnstile-widget'))
  })
})
