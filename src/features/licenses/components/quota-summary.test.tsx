import { render, screen } from '@testing-library/react'
import { quotaSummary } from '../licenses.rules'
import { QuotaSummary } from './quota-summary'

const TEXT = {
  exhausted: 'Ihr Kontingent ist ausgeschöpft. Für weitere Lizenzen wenden Sie sich an den Anbieter.',
  exceeded:
    'Ihr Kontingent ist überschritten. Bestehende Lizenzen bleiben gültig. Neue können Sie erst zuweisen, wenn weniger Lizenzen vergeben sind, als Ihr Kontingent erlaubt.',
}

function show(assigned: number, quota: number) {
  return render(<QuotaSummary summary={quotaSummary(assigned, quota)} />)
}

const bar = () => screen.getByRole('progressbar', { name: 'Vergebene Lizenzen' })

describe('QuotaSummary', () => {
  it('zeigt 2 von 5 als Zahlen und Balken, mit demselben Text für Screenreader, ohne Hinweis (AC-1)', () => {
    show(2, 5)

    expect(screen.getByText('2 von 5 Lizenzen vergeben')).toBeInTheDocument()
    expect(screen.getByText('3 frei')).toBeInTheDocument()
    expect(bar()).toHaveAttribute('aria-valuenow', '40')
    expect(bar()).toHaveAttribute('aria-valuetext', '2 von 5 Lizenzen vergeben')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByText(TEXT.exhausted)).not.toBeInTheDocument()
    expect(screen.queryByText(TEXT.exceeded)).not.toBeInTheDocument()
    expect(document.getElementById('license-quota-notice')).toBeNull()
  })

  it('schreibt bei einem Kontingent von 1 „Lizenz“ (AC-1)', () => {
    show(0, 1)

    expect(screen.getByText('0 von 1 Lizenz vergeben')).toBeInTheDocument()
    expect(screen.getByText('1 frei')).toBeInTheDocument()
  })

  it('zeigt bei 5 von 5 den Hinweis „ausgeschöpft“ mit der ID, auf die der gesperrte Knopf verweist (AC-7)', () => {
    show(5, 5)

    expect(screen.getByText('5 von 5 Lizenzen vergeben')).toBeInTheDocument()
    expect(screen.getByText('0 frei')).toBeInTheDocument()
    const notice = document.getElementById('license-quota-notice')
    expect(notice).toHaveTextContent(TEXT.exhausted)
    expect(screen.queryByText(TEXT.exceeded)).not.toBeInTheDocument()
  })

  it('zeigt bei 0 von 0 den Balken voll und den Hinweis „ausgeschöpft“ (EC-4)', () => {
    show(0, 0)

    expect(screen.getByText('0 von 0 Lizenzen vergeben')).toBeInTheDocument()
    expect(screen.getByText('0 frei')).toBeInTheDocument()
    expect(bar()).toHaveAttribute('aria-valuenow', '100')
    expect(document.getElementById('license-quota-notice')).toHaveTextContent(TEXT.exhausted)
  })

  it('zeigt bei 5 von 3 „0 frei“, den vollen Balken und den Hinweis „überschritten“ (AC-9)', () => {
    show(5, 3)

    expect(screen.getByText('5 von 3 Lizenzen vergeben')).toBeInTheDocument()
    expect(screen.getByText('0 frei')).toBeInTheDocument()
    expect(bar()).toHaveAttribute('aria-valuenow', '100')
    expect(bar()).toHaveAttribute('aria-valuetext', '5 von 3 Lizenzen vergeben')
    expect(document.getElementById('license-quota-notice')).toHaveTextContent(TEXT.exceeded)
    expect(screen.queryByText(TEXT.exhausted)).not.toBeInTheDocument()
  })
})
