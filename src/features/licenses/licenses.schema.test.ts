// @vitest-environment node
import { assignLicenseSchema, revokeLicenseSchema } from './licenses.schema'

// The literal German texts, so a typo in LICENSE_MESSAGES fails here (design.md → "Eingaberegeln").
const EMAIL_REQUIRED = 'Bitte geben Sie die E-Mail-Adresse des Teilnehmers ein.'
const EMAIL_INVALID = 'Bitte geben Sie eine gültige E-Mail-Adresse ein.'

/** The email field's messages; an empty list means the input passed. */
function emailMessages(input: unknown): string[] {
  const result = assignLicenseSchema.safeParse(input)
  if (result.success) return []
  return result.error.issues.filter((issue) => issue.path[0] === 'email').map((issue) => issue.message)
}

describe('assignLicenseSchema', () => {
  // The same addresses stand in src/test/db/licenses.test.ts → "Regel der Spalte", which judges a
  // longer list with this schema and the column rule alike (BUG-1).
  it.each([
    'vorname.nachname+kurs@example.com',
    'max-muster@example.com',
    'teilnehmer_1@mail.sub.example.com',
    "o'neil@example.com",
    `${'a'.repeat(242)}@example.com`,
  ])('nimmt %s an, unverändert (AC-4, AC-5)', (email) => {
    expect(assignLicenseSchema.parse({ email })).toEqual({ email })
  })

  it('die längste gültige Adresse hat genau 254 Zeichen', () => {
    expect(`${'a'.repeat(242)}@example.com`).toHaveLength(254)
  })

  it('entfernt Leerzeichen am Rand und schreibt klein (AC-6)', () => {
    expect(assignLicenseSchema.parse({ email: ' Teilnehmer@Example.COM ' })).toEqual({
      email: 'teilnehmer@example.com',
    })
  })

  it('zählt die 254 Zeichen nach dem Entfernen der Leerzeichen am Rand', () => {
    expect(emailMessages({ email: `  ${'a'.repeat(242)}@example.com  ` })).toEqual([])
  })

  it.each([
    ['leer', ''],
    ['nur Leerzeichen', '   '],
  ])('eine Adresse %s meldet „Bitte geben Sie die E-Mail-Adresse des Teilnehmers ein.“ (AC-5)', (_case, email) => {
    expect(emailMessages({ email })).toEqual([EMAIL_REQUIRED])
  })

  it.each([
    ['fehlt', {}],
    ['ist kein Text', { email: 42 }],
  ])('ein Feld, das %s, meldet dasselbe (AC-5)', (_case, input) => {
    expect(emailMessages(input)).toEqual([EMAIL_REQUIRED])
  })

  it.each([
    ['mit 255 Zeichen', `${'a'.repeat(243)}@example.com`],
    ['ohne @', 'teilnehmer.example.com'],
    ['mit Leerzeichen in der Mitte', 'teil nehmer@example.com'],
    ['ohne Domain mit Punkt', 'teilnehmer@example'],
    ['mit 1.001 Zeichen', `${'a'.repeat(989)}@example.com`],
  ])('eine Adresse %s meldet genau „Bitte geben Sie eine gültige E-Mail-Adresse ein.“ (AC-5)', (_case, email) => {
    expect(emailMessages({ email })).toEqual([EMAIL_INVALID])
  })

  it('mehr als 1.000 Zeichen sind ungültig, auch wenn sie nur aus Leerzeichen bestehen', () => {
    expect(emailMessages({ email: ' '.repeat(1001) })).toEqual([EMAIL_INVALID])
  })

  // Added by /qa: what a pasted address brings along, and the edges of the length rules.
  it.each([
    ['Tab und Zeilenumbruch', '\tTeilnehmer@Example.com\n'],
    ['geschütztes Leerzeichen', ' teilnehmer@example.com '],
    ['Wagenrücklauf', 'teilnehmer@example.com\r\n'],
  ])('entfernt %s am Rand wie Leerzeichen (AC-6)', (_case, email) => {
    expect(assignLicenseSchema.parse({ email })).toEqual({ email: 'teilnehmer@example.com' })
  })

  it('genau 1.000 Zeichen mit Rand-Leerzeichen sind noch keine Überlänge', () => {
    const email = `${' '.repeat(493)}teilnehmer@example.com${' '.repeat(485)}`
    expect(email).toHaveLength(1000)
    expect(assignLicenseSchema.parse({ email })).toEqual({ email: 'teilnehmer@example.com' })
  })

  it.each([
    ['ohne Teil vor dem @', '@example.com'],
    ['mit zwei @', 'teil@nehmer@example.com'],
    ['mit Punkt am Anfang', '.teilnehmer@example.com'],
    ['mit zwei Punkten hintereinander', 'teil..nehmer@example.com'],
    ['mit Leerzeichen in der Domain', 'teilnehmer@exam ple.com'],
  ])('eine Adresse %s ist ungültig (AC-5)', (_case, email) => {
    expect(emailMessages({ email })).toEqual([EMAIL_INVALID])
  })

  it('verwirft einen mitgeschickten Träger (Technische Anforderungen: Träger nur aus dem Wächter)', () => {
    expect(
      assignLicenseSchema.parse({ email: 'teilnehmer@example.com', trainingProviderId: 'fremder-traeger' })
    ).toEqual({ email: 'teilnehmer@example.com' })
  })
})

describe('revokeLicenseSchema', () => {
  it('nimmt eine UUID an (AC-8)', () => {
    const licenseId = '3f2b8c1e-4d5a-4b6c-9e7f-0a1b2c3d4e5f'
    expect(revokeLicenseSchema.parse({ licenseId })).toEqual({ licenseId })
  })

  it.each([
    ['fehlt', {}],
    ['ist keine UUID', { licenseId: 'teilnehmer@example.com' }],
    ['ist leer', { licenseId: '' }],
    ['ist kein Text', { licenseId: 7 }],
  ])('lehnt eine Lizenz-ID ab, die %s', (_case, input) => {
    expect(revokeLicenseSchema.safeParse(input).success).toBe(false)
  })

  it('verwirft einen mitgeschickten Träger', () => {
    const licenseId = '3f2b8c1e-4d5a-4b6c-9e7f-0a1b2c3d4e5f'
    expect(revokeLicenseSchema.parse({ licenseId, trainingProviderId: 'fremder-traeger' })).toEqual({ licenseId })
  })
})
