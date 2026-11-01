// @vitest-environment node
import { sendInvitationSchema } from './invitations.schema'

const LICENSE_ID = '3f2b8c1e-4d5a-4b6c-9e7f-0a1b2c3d4e5f'

describe('sendInvitationSchema', () => {
  it('nimmt eine UUID an (AC-5, AC-6)', () => {
    expect(sendInvitationSchema.parse({ licenseId: LICENSE_ID })).toEqual({ licenseId: LICENSE_ID })
  })

  it.each([
    ['fehlt', {}],
    ['ist leer', { licenseId: '' }],
    ['ist keine UUID', { licenseId: 'teilnehmer@example.com' }],
    ['ist kein Text', { licenseId: 7 }],
  ])('lehnt eine Lizenz-ID ab, die %s', (_case, input) => {
    expect(sendInvitationSchema.safeParse(input).success).toBe(false)
  })

  it('verwirft eine mitgeschickte Adresse und einen mitgeschickten Träger (AC-9)', () => {
    expect(
      sendInvitationSchema.parse({
        licenseId: LICENSE_ID,
        email: 'fremd@example.com',
        trainingProviderId: 'fremder-traeger',
      }),
    ).toStrictEqual({ licenseId: LICENSE_ID })
  })
})
