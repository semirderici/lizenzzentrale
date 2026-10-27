import { render, screen, within } from '@testing-library/react'
import type { InvitationState } from '@/features/invitations/invitations.rules'
import { quotaSummary } from '../licenses.rules'
import { LicenseList } from './license-list'

// The two dialogs have their own tests; here they only show which values the list hands them.
vi.mock('./assign-license-dialog', () => ({
  AssignLicenseDialog: ({ disabled, variant }: { disabled: boolean; variant: string }) => (
    <button type="button" data-testid="assign" data-variant={variant} disabled={disabled}>
      Lizenz zuweisen
    </button>
  ),
}))
vi.mock('./revoke-license-dialog', () => ({
  RevokeLicenseDialog: ({ licenseId, email, appearance }: { licenseId: string; email: string; appearance: string }) => (
    <button type="button" data-testid="revoke" data-license={licenseId} data-email={email} data-appearance={appearance}>
      Entziehen
    </button>
  ),
}))
// The send button has its own tests as well (PROJ-3 T18). Without visible text, so a cell's text
// is exactly the badge's. The badge itself is the real one.
vi.mock('@/features/invitations/components/send-invitation-button', () => ({
  SendInvitationButton: ({
    licenseId,
    email,
    action,
    appearance,
  }: {
    licenseId: string
    email: string
    action: string
    appearance: string
  }) => (
    <button
      type="button"
      data-testid="send"
      data-license={licenseId}
      data-email={email}
      data-action={action}
      data-appearance={appearance}
    />
  ),
}))

// The server's time at render, passed in by the page. Far from the real clock, so a list that
// read the clock itself would show other states.
const NOW = new Date('2026-10-25T12:00:00Z')

function minutesBeforeNow(minutes: number) {
  return new Date(NOW.getTime() - minutes * 60_000).toISOString()
}

const licenses = [
  { id: 'id-neu', email: 'neu@example.com', assignedAt: '2026-10-24T22:30:00Z', invitation: null },
  { id: 'id-alt', email: 'alt@example.com', assignedAt: '2026-03-01T09:00:00Z', invitation: null },
]

function table() {
  return screen.getByRole('table')
}

/** The phone cards: the list that is not the table. */
function cards() {
  return screen.getByRole('list')
}

/** The table row of one address. */
function tableRow(email: string) {
  const row = within(table())
    .getAllByRole('row')
    .find((candidate) => within(candidate).queryAllByRole('cell')[0]?.textContent === email)
  if (!row) throw new Error(`no table row for ${email}`)
  return row
}

/** The card of one address. */
function card(email: string) {
  const item = within(cards())
    .getAllByRole('listitem')
    .find((candidate) => within(candidate).queryByText(email) !== null)
  if (!item) throw new Error(`no card for ${email}`)
  return item
}

/** The send button's values as the list hands them over, or null when there is none. */
function sendButton(container: HTMLElement) {
  const buttons = within(container).queryAllByTestId('send')
  expect(buttons.length).toBeLessThanOrEqual(1)
  if (buttons.length === 0) return null
  const { license, email, action, appearance } = buttons[0].dataset
  return { license, email, action, appearance }
}

function expectInDocumentOrder(...elements: Element[]) {
  for (let i = 1; i < elements.length; i++) {
    expect(elements[i - 1].compareDocumentPosition(elements[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  }
}

describe('LicenseList', () => {
  it('zeigt den Abschnitt „Vergebene Lizenzen“ mit Tabelle ab md und Karten darunter, jede Fassung einmal sichtbar (AC-2, EC-8)', () => {
    render(<LicenseList licenses={licenses} summary={quotaSummary(2, 5)} now={NOW} />)

    expect(screen.getByRole('heading', { level: 2, name: 'Vergebene Lizenzen' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Vergebene Lizenzen' })).toBeInTheDocument()
    // Hidden means display: none, so screen readers read only one of the two.
    expect(table().closest('.hidden')).toHaveClass('md:block')
    expect(cards()).toHaveClass('md:hidden')
  })

  it('Tabelle: Spaltenköpfe mit „Einladung“ vor „Aktion“, „Aktion“ nur für Screenreader, Reihenfolge wie gelesen, Datum in Berliner Zeit im time-Element (AC-2; PROJ-3 AC-4)', () => {
    render(<LicenseList licenses={licenses} summary={quotaSummary(2, 5)} now={NOW} />)

    const headers = within(table()).getAllByRole('columnheader')
    expect(headers.map((header) => header.textContent)).toEqual(['E-Mail-Adresse', 'Zugewiesen am', 'Einladung', 'Aktion'])
    expect(within(headers[3]).getByText('Aktion')).toHaveClass('sr-only')

    const rows = within(table()).getAllByRole('row').slice(1)
    expect(rows.map((row) => within(row).getAllByRole('cell')[0].textContent)).toEqual([
      'neu@example.com',
      'alt@example.com',
    ])
    // 22:30 UTC on 24 October is 00:30 on 25 October in Berlin.
    const date = within(rows[0]).getByText('25.10.2026')
    expect(date.tagName).toBe('TIME')
    expect(date).toHaveAttribute('datetime', '2026-10-24T22:30:00Z')

    // Each cell sits under its header: the state in the third column, "Entziehen" in the fourth.
    for (const row of rows) {
      const cells = within(row).getAllByRole('cell')
      expect(cells).toHaveLength(4)
      expect(cells[2]).toHaveTextContent('Noch nicht eingeladen')
      expect(within(cells[2]).getByTestId('send')).toBeInTheDocument()
      expect(within(cells[3]).getByTestId('revoke')).toBeInTheDocument()
    }
  })

  it('jede Lizenz hat „Entziehen“: in der Tabelle klein, in der Karte in voller Breite, mit ID und Adresse (AC-2, AC-8)', () => {
    render(<LicenseList licenses={licenses} summary={quotaSummary(2, 5)} now={NOW} />)

    const tableButtons = within(table()).getAllByTestId('revoke')
    expect(tableButtons.map((button) => [button.dataset.license, button.dataset.email, button.dataset.appearance])).toEqual([
      ['id-neu', 'neu@example.com', 'compact'],
      ['id-alt', 'alt@example.com', 'compact'],
    ])
    const cardButtons = within(cards()).getAllByTestId('revoke')
    expect(cardButtons.map((button) => [button.dataset.license, button.dataset.appearance])).toEqual([
      ['id-neu', 'full'],
      ['id-alt', 'full'],
    ])
  })

  it('Karte: Adresse, darunter „Zugewiesen am“ mit Datum, in derselben Reihenfolge (AC-2, EC-8)', () => {
    render(<LicenseList licenses={licenses} summary={quotaSummary(2, 5)} now={NOW} />)

    const items = within(cards()).getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(within(items[0]).getByText('neu@example.com')).toBeInTheDocument()
    expect(items[0]).toHaveTextContent('Zugewiesen am 25.10.2026')
    expect(items[1]).toHaveTextContent('Zugewiesen am 01.03.2026')
  })

  it('Karte: nach „Zugewiesen am“ die Zeile „Einladung:“ mit Badge, darunter der Knopf zum Senden, dann „Entziehen“ (PROJ-3 AC-4, AC-6)', () => {
    render(<LicenseList licenses={licenses} summary={quotaSummary(2, 5)} now={NOW} />)

    for (const item of within(cards()).getAllByRole('listitem')) {
      const assigned = within(item).getByText('Zugewiesen am', { exact: false })
      const invitationLine = within(item).getByText('Einladung:')
      expect(invitationLine.textContent).toBe('Einladung: Noch nicht eingeladen')
      expectInDocumentOrder(
        assigned,
        invitationLine,
        within(item).getByTestId('send'),
        within(item).getByTestId('revoke')
      )
    }
  })

  it('kein Block-Element in einem Absatz: das Badge ist ein div, im p wäre das ein Hydration-Fehler (PROJ-3 AC-4)', () => {
    const { container } = render(<LicenseList licenses={licenses} summary={quotaSummary(2, 5)} now={NOW} />)

    expect(container.querySelector('p div, p p, p ul, p table')).toBeNull()
  })

  describe('Versandstand und Knopf in beiden Fassungen, berechnet mit der Zeit des Servers (PROJ-3 AC-1, AC-3 bis AC-6, EC-3)', () => {
    const cases: {
      name: string
      invitation: InvitationState
      label: string
      action: 'send' | 'resend' | null
    }[] = [
      {
        name: 'versendet: „Versendet am TT.MM.JJJJ“ in Berliner Zeit und „Erneut senden“',
        // 22:30 UTC on 24 October is already the 25th in Berlin.
        invitation: { status: 'sent', lastAttemptAt: '2026-10-24T22:30:00Z' },
        label: 'Versendet am 25.10.2026',
        action: 'resend',
      },
      {
        name: 'fehlgeschlagen: „Fehlgeschlagen“ und „Erneut senden“',
        invitation: { status: 'failed', lastAttemptAt: minutesBeforeNow(30) },
        label: 'Fehlgeschlagen',
        action: 'resend',
      },
      {
        name: 'nie eingeladen: „Noch nicht eingeladen“ und „Einladung senden“',
        invitation: null,
        label: 'Noch nicht eingeladen',
        action: 'send',
      },
      {
        name: 'seit 1 Minute im Versand: „Wird versendet“ und kein Knopf',
        invitation: { status: 'sending', lastAttemptAt: minutesBeforeNow(1) },
        label: 'Wird versendet',
        action: null,
      },
      {
        name: 'seit 3 Minuten im Versand, hängengeblieben: „Fehlgeschlagen“ und „Erneut senden“ (EC-3)',
        invitation: { status: 'sending', lastAttemptAt: minutesBeforeNow(3) },
        label: 'Fehlgeschlagen',
        action: 'resend',
      },
    ]

    it.each(cases)('$name', ({ invitation, label, action }) => {
      const license = { id: 'id-1', email: 'teilnehmer@example.com', assignedAt: '2026-10-20T10:00:00Z', invitation }
      render(<LicenseList licenses={[license]} summary={quotaSummary(1, 5)} now={NOW} />)

      // Table: the badge in the column "Einladung", the small button beside it.
      const cells = within(tableRow(license.email)).getAllByRole('cell')
      expect(cells[2].textContent).toBe(label)
      expect(sendButton(cells[2])).toEqual(
        action === null ? null : { license: 'id-1', email: 'teilnehmer@example.com', action, appearance: 'compact' }
      )
      expect(within(cells[3]).getByTestId('revoke')).toBeInTheDocument()

      // Card: "Einladung:" with the badge, the full-width button below it.
      const item = card(license.email)
      expect(within(item).getByText('Einladung:').textContent).toBe(`Einladung: ${label}`)
      expect(sendButton(item)).toEqual(
        action === null ? null : { license: 'id-1', email: 'teilnehmer@example.com', action, appearance: 'full' }
      )
      expect(within(item).getByTestId('revoke')).toBeInTheDocument()
    })

    it('mehrere Lizenzen: jede mit ihrem eigenen Stand und einem Knopf mit ihrer ID und Adresse', () => {
      const mixed = cases.map((entry, index) => ({
        id: `id-${index}`,
        email: `person${index}@example.com`,
        assignedAt: '2026-10-20T10:00:00Z',
        invitation: entry.invitation,
      }))
      render(<LicenseList licenses={mixed} summary={quotaSummary(mixed.length, 10)} now={NOW} />)

      cases.forEach(({ label, action }, index) => {
        const email = `person${index}@example.com`
        const expected = (appearance: string) =>
          action === null ? null : { license: `id-${index}`, email, action, appearance }

        const cells = within(tableRow(email)).getAllByRole('cell')
        expect(cells[2].textContent).toBe(label)
        expect(sendButton(cells[2])).toEqual(expected('compact'))

        const item = card(email)
        expect(within(item).getByText('Einladung:').textContent).toBe(`Einladung: ${label}`)
        expect(sendButton(item)).toEqual(expected('full'))
      })
    })
  })

  it('eine lange Adresse mit Sonderzeichen steht als reiner Text und darf überall umbrechen (EC-8)', () => {
    const email = `<script>alert(1)</script>${'a'.repeat(200)}@example.com`
    const { container } = render(
      <LicenseList
        licenses={[{ id: 'id-1', email, assignedAt: '2026-10-25T10:00:00Z', invitation: null }]}
        summary={quotaSummary(1, 5)}
        now={NOW}
      />
    )

    expect(container.querySelector('script')).toBeNull()
    for (const shown of screen.getAllByText(email)) {
      expect(shown).toHaveClass('[overflow-wrap:anywhere]')
    }
  })

  it('leer und mindestens eine Lizenz frei: Hinweis und „Lizenz zuweisen“ für den leeren Zustand, keine Liste (AC-3)', () => {
    render(<LicenseList licenses={[]} summary={quotaSummary(0, 5)} now={NOW} />)

    expect(screen.getByText('Noch keine Lizenz vergeben. Weisen Sie die erste zu.')).toBeInTheDocument()
    const assign = screen.getByTestId('assign')
    expect(assign).toHaveAttribute('data-variant', 'empty')
    expect(assign).toBeEnabled()
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.queryByRole('list')).toBeNull()
  })

  it('bei Kontingent 0 ohne Lizenzen entfällt der Abschnitt ganz, auch die Aufforderung (EC-4)', () => {
    const { container } = render(<LicenseList licenses={[]} summary={quotaSummary(0, 0)} now={NOW} />)

    expect(container).toBeEmptyDOMElement()
  })

  it('bei vollem oder überschrittenem Kontingent bleibt die Liste stehen, ohne leeren Zustand (AC-7, AC-9)', () => {
    for (const summary of [quotaSummary(2, 2), quotaSummary(2, 1)]) {
      const { unmount } = render(<LicenseList licenses={licenses} summary={summary} now={NOW} />)
      expect(within(table()).getAllByRole('row')).toHaveLength(3)
      expect(screen.queryByText('Noch keine Lizenz vergeben. Weisen Sie die erste zu.')).toBeNull()
      unmount()
    }
  })
})
