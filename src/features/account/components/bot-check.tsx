'use client'

import { useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import { Turnstile, type TurnstileInstance, type TurnstileProps } from '@marsidev/react-turnstile'

/** EC-8: a widget that is still not visible after this long counts as "cannot be loaded". */
const BOT_CHECK_LOAD_TIMEOUT_MS = 15_000

/**
 * Render options of the widget (design.md → Bot-Prüfung). "Managed" mode is set on Cloudflare's
 * side for the site key, not here. `flexible` is the full width of the card (Cloudflare: 100 %,
 * at least 300 px, 65 px high). An expired token is fetched again by the widget itself.
 */
const WIDGET_OPTIONS = {
  language: 'de',
  theme: 'auto',
  size: 'flexible',
  refreshExpired: 'auto',
} as const satisfies NonNullable<TurnstileProps['options']>

export type BotCheckHandle = { reset: () => void }

export type BotCheckProps = {
  /** New token, or null when the token expired, the widget was reset or failed. */
  onToken: (token: string | null) => void
  /** The check cannot be loaded: the script fails to load, the widget reports an error, or it is not visible after 15 seconds (EC-8). */
  onUnavailable: () => void
  ref?: React.Ref<BotCheckHandle>
}

/**
 * Cloudflare Turnstile for the login and register forms (AC-7, EC-8). The script is injected
 * only where this component is rendered. The EC-8 message itself is shown by the form.
 */
export function BotCheck({ onToken, onUnavailable, ref }: BotCheckProps): React.JSX.Element {
  // Inlined by Next.js at build time; read during render so tests can stub it.
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

  const widgetRef = useRef<TurnstileInstance | undefined>(undefined)
  const loadTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const widgetLoaded = useRef(false)
  const unavailableReported = useRef(false)

  // The forms may pass new callback functions on every render. Keep the latest ones in a ref, so
  // neither the 15-second timer nor the script's error handler is restarted or goes stale.
  const callbacks = useRef({ onToken, onUnavailable })
  useEffect(() => {
    callbacks.current = { onToken, onUnavailable }
  })

  const stopLoadTimer = useCallback(() => {
    clearTimeout(loadTimer.current)
    loadTimer.current = undefined
  }, [])

  const reportUnavailable = useCallback(() => {
    stopLoadTimer()
    if (unavailableReported.current) return
    unavailableReported.current = true
    callbacks.current.onUnavailable()
  }, [stopLoadTimer])

  useEffect(() => {
    if (!siteKey) {
      reportUnavailable()
      return
    }
    if (widgetLoaded.current) return
    loadTimer.current = setTimeout(reportUnavailable, BOT_CHECK_LOAD_TIMEOUT_MS)
    return stopLoadTimer
  }, [siteKey, reportUnavailable, stopLoadTimer])

  useImperativeHandle(
    ref,
    () => ({
      reset() {
        widgetRef.current?.reset()
        callbacks.current.onToken(null)
      },
    }),
    [],
  )

  // Stable object: the library re-runs its script injection whenever this prop changes identity.
  const scriptOptions = useMemo(() => ({ onError: reportUnavailable }), [reportUnavailable])

  return (
    // Reserves Cloudflare's fixed widget height (65 px) up front, so the form does not jump
    // when the widget appears — and keeps the same space when it never does.
    <div className="min-h-[65px] w-full">
      {siteKey ? (
        <Turnstile
          ref={widgetRef}
          siteKey={siteKey}
          options={WIDGET_OPTIONS}
          scriptOptions={scriptOptions}
          onWidgetLoad={() => {
            widgetLoaded.current = true
            stopLoadTimer()
          }}
          onSuccess={(token) => callbacks.current.onToken(token)}
          onExpire={() => callbacks.current.onToken(null)}
          onError={() => {
            callbacks.current.onToken(null)
            reportUnavailable()
          }}
          onUnsupported={() => {
            callbacks.current.onToken(null)
            reportUnavailable()
          }}
        />
      ) : null}
    </div>
  )
}
