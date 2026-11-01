import { render, screen } from '@testing-library/react'
import { invitationDisplay, type InvitationState } from '../invitations.rules'
import { InvitationStatus } from './invitation-status'

// The server's time at render. The running send is 30 seconds old, the hung one exactly 2 minutes.
const NOW = new Date('2026-10-27T10:00:00Z')
const RUNNING_SINCE = '2026-10-27T09:59:30Z'
const HUNG_SINCE = '2026-10-27T09:58:00Z'
// 23:30 UTC on 26.10. is already 00:30 on 27.10. in Berlin (CET, UTC+1 since 25.10.2026).
const SENT_AT = '2026-10-26T23:30:00Z'

const ROWS = {
  notInvited: null,
  sending: { status: 'sending', lastAttemptAt: RUNNING_SINCE },
  sent: { status: 'sent', lastAttemptAt: SENT_AT },
  failed: { status: 'failed', lastAttemptAt: SENT_AT },
  hung: { status: 'sending', lastAttemptAt: HUNG_SINCE },
} satisfies Record<string, InvitationState>

/** Renders the badge as the licence list does, inside a table cell; returns the badge. */
function show(invitation: InvitationState) {
  render(
    <table>
      <tbody>
        <tr>
          <td>
            <InvitationStatus display={invitationDisplay(invitation, NOW)} />
          </td>
        </tr>
      </tbody>
    </table>
  )
  return screen.getByRole('cell').firstElementChild as HTMLElement
}

/** Status colour on its surface, no hover colour (a status is not clickable), one icon. */
function expectLook(badge: HTMLElement, colors: string[], icon: string) {
  expect(badge).toHaveClass(...colors)
  expect(badge.className).not.toMatch(/hover:/)
  const icons = badge.querySelectorAll('svg')
  expect(icons).toHaveLength(1)
  expect(icons[0]).toHaveClass(`lucide-${icon}`)
}

describe('InvitationStatus', () => {
  it('zeigt ohne Einladung „Noch nicht eingeladen“ neutral mit Brief-Symbol (AC-6)', () => {
    const badge = show(ROWS.notInvited)

    expect(badge.textContent).toBe('Noch nicht eingeladen')
    expectLook(badge, ['bg-muted', 'text-muted-foreground'], 'mail')
  })

  it('zeigt einen laufenden Versand als „Wird versendet“ neutral mit Uhr (AC-4)', () => {
    const badge = show(ROWS.sending)

    expect(badge.textContent).toBe('Wird versendet')
    expectLook(badge, ['bg-muted', 'text-muted-foreground'], 'clock')
  })

  it('zeigt „Versendet am TT.MM.JJJJ“ in Europe/Berlin, grün mit Haken (AC-4)', () => {
    const badge = show(ROWS.sent)

    expect(badge.textContent).toBe('Versendet am 27.10.2026')
    expectLook(badge, ['bg-success-subtle', 'text-success'], 'circle-check')
  })

  it('setzt das Datum bei „Versendet am“ in ein time-Element mit dem vollen Zeitpunkt (AC-4)', () => {
    const badge = show(ROWS.sent)

    const times = badge.querySelectorAll('time')
    expect(times).toHaveLength(1)
    expect(times[0]).toHaveAttribute('datetime', SENT_AT)
    expect(times[0].textContent).toBe('27.10.2026')
  })

  it('zeigt einen fehlgeschlagenen Versand als „Fehlgeschlagen“, rot mit Warnsymbol (AC-4)', () => {
    const badge = show(ROWS.failed)

    expect(badge.textContent).toBe('Fehlgeschlagen')
    expectLook(badge, ['bg-destructive-subtle', 'text-destructive'], 'circle-alert')
  })

  it('zeigt einen Versand, der seit 2 Minuten hängt, als „Fehlgeschlagen“ (EC-3)', () => {
    const badge = show(ROWS.hung)

    expect(badge.textContent).toBe('Fehlgeschlagen')
    expectLook(badge, ['bg-destructive-subtle', 'text-destructive'], 'circle-alert')
  })

  it.each([
    ['Noch nicht eingeladen', ROWS.notInvited],
    ['Wird versendet', ROWS.sending],
    ['Versendet am 27.10.2026', ROWS.sent],
    ['Fehlgeschlagen', ROWS.failed],
  ] as const)(
    'blendet das Symbol für Screenreader aus, sie lesen nur „%s“ (AC-4)',
    (word, row) => {
      const badge = show(row)

      for (const icon of badge.querySelectorAll('svg')) {
        expect(icon).toHaveAttribute('aria-hidden', 'true')
      }
      expect(screen.getByRole('cell', { name: word })).toContainElement(badge)
    }
  )

  it('lässt den Text in einer schmalen Karte umbrechen, statt ihn in eine Zeile zu zwingen', () => {
    const badge = show(ROWS.sent)

    expect(badge.outerHTML).not.toMatch(/whitespace-nowrap|text-nowrap|truncate/)
  })
})
