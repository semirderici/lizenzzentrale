import { render, screen } from '@testing-library/react'
import { AppHeader } from './app-header'

describe('AppHeader', () => {
  it('zeigt „Lizenzzentrale“, den Namen des Bildungsträgers und „Abmelden“ (AC-4)', () => {
    render(<AppHeader trainingProviderName="Akademie Nord" />)

    expect(screen.getByRole('banner')).toHaveTextContent('LizenzzentraleAkademie NordAbmelden')
    expect(screen.getByRole('button', { name: 'Abmelden' })).toBeInTheDocument()
  })

  it('meldet per POST an /sign-out ab, mit einem echten Absende-Knopf (AC-10)', () => {
    render(<AppHeader trainingProviderName="Akademie Nord" />)

    const button = screen.getByRole('button', { name: 'Abmelden' })
    expect(button).toHaveAttribute('type', 'submit')
    const form = button.closest('form')
    expect(form).toHaveAttribute('action', '/sign-out')
    expect(form).toHaveAttribute('method', 'post')
  })

  it('zeigt HTML und Sonderzeichen im Namen als reinen Text (EC-10)', () => {
    const name = '<b>Akademie</b> & "Söhne" <script>alert(1)</script>'
    const { container } = render(<AppHeader trainingProviderName={name} />)

    expect(screen.getByTitle(name).textContent).toBe(name)
    expect(container.querySelector('b')).toBeNull()
    expect(container.querySelector('script')).toBeNull()
  })

  it('kürzt einen langen Namen auf eine Zeile, nennt ihn voll im Hinweistext, und „Abmelden“ schrumpft nie (EC-10)', () => {
    const name = 'Institut für berufliche Weiterbildung '.repeat(5).trim()
    render(<AppHeader trainingProviderName={name} />)

    const element = screen.getByText(name)
    expect(element).toHaveAttribute('title', name)
    expect(element).toHaveClass('truncate', 'min-w-0')
    expect(screen.getByRole('button', { name: 'Abmelden' }).closest('form')).toHaveClass('shrink-0')
  })

  it('hat für „Abmelden“ eine Tippfläche von mindestens 44 × 44 px', () => {
    render(<AppHeader trainingProviderName="Akademie Nord" />)

    expect(screen.getByRole('button', { name: 'Abmelden' })).toHaveClass('h-11', 'min-w-11')
  })

  it.each([undefined, null, ''])('zeigt ohne Trägernamen nur „Abmelden“ (EC-5, Name: %s)', (name) => {
    const { container } = render(<AppHeader trainingProviderName={name} />)

    expect(screen.getByRole('banner')).toHaveTextContent(/^LizenzzentraleAbmelden$/)
    // Only the "Lizenzzentrale" label, no (empty) element for a name.
    expect(container.querySelectorAll('header span')).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Abmelden' })).toBeInTheDocument()
  })
})
