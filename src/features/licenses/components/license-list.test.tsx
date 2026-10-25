import { render, screen, within } from '@testing-library/react'
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

const licenses = [
  { id: 'id-neu', email: 'neu@example.com', assignedAt: '2026-10-24T22:30:00Z' },
  { id: 'id-alt', email: 'alt@example.com', assignedAt: '2026-03-01T09:00:00Z' },
]

function table() {
  return screen.getByRole('table')
}

/** The phone cards: the list that is not the table. */
function cards() {
  return screen.getByRole('list')
}

describe('LicenseList', () => {
  it('zeigt den Abschnitt „Vergebene Lizenzen“ mit Tabelle ab md und Karten darunter, jede Fassung einmal sichtbar (AC-2, EC-8)', () => {
    render(<LicenseList licenses={licenses} summary={quotaSummary(2, 5)} />)

    expect(screen.getByRole('heading', { level: 2, name: 'Vergebene Lizenzen' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Vergebene Lizenzen' })).toBeInTheDocument()
    // Hidden means display: none, so screen readers read only one of the two.
    expect(table().closest('.hidden')).toHaveClass('md:block')
    expect(cards()).toHaveClass('md:hidden')
  })

  it('Tabelle: Spaltenköpfe, „Aktion“ nur für Screenreader, Reihenfolge wie gelesen, Datum in Berliner Zeit im time-Element (AC-2)', () => {
    render(<LicenseList licenses={licenses} summary={quotaSummary(2, 5)} />)

    const headers = within(table()).getAllByRole('columnheader')
    expect(headers.map((header) => header.textContent)).toEqual(['E-Mail-Adresse', 'Zugewiesen am', 'Aktion'])
    expect(within(headers[2]).getByText('Aktion')).toHaveClass('sr-only')

    const rows = within(table()).getAllByRole('row').slice(1)
    expect(rows.map((row) => within(row).getAllByRole('cell')[0].textContent)).toEqual([
      'neu@example.com',
      'alt@example.com',
    ])
    // 22:30 UTC on 24 October is 00:30 on 25 October in Berlin.
    const date = within(rows[0]).getByText('25.10.2026')
    expect(date.tagName).toBe('TIME')
    expect(date).toHaveAttribute('datetime', '2026-10-24T22:30:00Z')
  })

  it('jede Lizenz hat „Entziehen“: in der Tabelle klein, in der Karte in voller Breite, mit ID und Adresse (AC-2, AC-8)', () => {
    render(<LicenseList licenses={licenses} summary={quotaSummary(2, 5)} />)

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
    render(<LicenseList licenses={licenses} summary={quotaSummary(2, 5)} />)

    const items = within(cards()).getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(within(items[0]).getByText('neu@example.com')).toBeInTheDocument()
    expect(items[0]).toHaveTextContent('Zugewiesen am 25.10.2026')
    expect(items[1]).toHaveTextContent('Zugewiesen am 01.03.2026')
  })

  it('eine lange Adresse mit Sonderzeichen steht als reiner Text und darf überall umbrechen (EC-8)', () => {
    const email = `<script>alert(1)</script>${'a'.repeat(200)}@example.com`
    const { container } = render(
      <LicenseList licenses={[{ id: 'id-1', email, assignedAt: '2026-10-25T10:00:00Z' }]} summary={quotaSummary(1, 5)} />
    )

    expect(container.querySelector('script')).toBeNull()
    for (const shown of screen.getAllByText(email)) {
      expect(shown).toHaveClass('[overflow-wrap:anywhere]')
    }
  })

  it('leer und mindestens eine Lizenz frei: Hinweis und „Lizenz zuweisen“ für den leeren Zustand, keine Liste (AC-3)', () => {
    render(<LicenseList licenses={[]} summary={quotaSummary(0, 5)} />)

    expect(screen.getByText('Noch keine Lizenz vergeben. Weisen Sie die erste zu.')).toBeInTheDocument()
    const assign = screen.getByTestId('assign')
    expect(assign).toHaveAttribute('data-variant', 'empty')
    expect(assign).toBeEnabled()
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.queryByRole('list')).toBeNull()
  })

  it('bei Kontingent 0 ohne Lizenzen entfällt der Abschnitt ganz, auch die Aufforderung (EC-4)', () => {
    const { container } = render(<LicenseList licenses={[]} summary={quotaSummary(0, 0)} />)

    expect(container).toBeEmptyDOMElement()
  })

  it('bei vollem oder überschrittenem Kontingent bleibt die Liste stehen, ohne leeren Zustand (AC-7, AC-9)', () => {
    for (const summary of [quotaSummary(2, 2), quotaSummary(2, 1)]) {
      const { unmount } = render(<LicenseList licenses={licenses} summary={summary} />)
      expect(within(table()).getAllByRole('row')).toHaveLength(3)
      expect(screen.queryByText('Noch keine Lizenz vergeben. Weisen Sie die erste zu.')).toBeNull()
      unmount()
    }
  })
})
