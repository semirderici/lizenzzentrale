import { fireEvent, render, screen, within } from '@testing-library/react'
import { LicensesLoadError } from './licenses-load-error'
import { LicensesSkeleton } from './licenses-skeleton'

const router = vi.hoisted(() => ({ refresh: vi.fn() }))

vi.mock('next/navigation', () => ({ useRouter: () => router }))

afterEach(() => {
  vi.clearAllMocks()
  vi.restoreAllMocks()
})

describe('LicensesLoadError', () => {
  it('zeigt die Hinweisbox „Die Lizenzen konnten nicht geladen werden.“ mit „Erneut versuchen“ (EC-6)', () => {
    render(<LicensesLoadError />)

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Die Lizenzen konnten nicht geladen werden.')
    expect(within(alert).getByRole('button', { name: 'Erneut versuchen' })).toBeEnabled()
  })

  it('„Erneut versuchen“ lädt über den Router neu, nie den Browser (EC-6)', () => {
    const reload = vi.fn()
    vi.spyOn(window, 'location', 'get').mockReturnValue({ ...window.location, reload })
    render(<LicensesLoadError />)

    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }))

    expect(router.refresh).toHaveBeenCalledTimes(1)
    expect(reload).not.toHaveBeenCalled()
  })
})

describe('LicensesSkeleton', () => {
  it('zeigt den Titel „Lizenzübersicht“ als Überschrift und meldet den Bereich als ladend (EC-6)', () => {
    const { container } = render(<LicensesSkeleton />)

    expect(screen.getByRole('heading', { level: 1, name: 'Lizenzübersicht' })).toBeInTheDocument()
    expect(container.firstElementChild).toHaveAttribute('aria-busy', 'true')
  })
})
