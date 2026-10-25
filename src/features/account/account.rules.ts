// Pure rules of the account feature: every text a user reads, the lock-time message, the
// mapping of a failed register/login outcome to its form message, and the visitor's IP from
// X-Forwarded-For. No IO, no framework, no clock — time is always passed in.
// See features/PROJ-1-account-login/design.md → "Meldungstexte", "IP-Adresse des Besuchers".

export const MESSAGES = {
  // Field messages (design.md → "Eingaberegeln")
  nameRequired: 'Bitte geben Sie den Namen Ihres Bildungsträgers ein.',
  nameTooShort: 'Der Name muss mindestens 2 Zeichen lang sein.',
  nameTooLong: 'Der Name darf höchstens 100 Zeichen lang sein.',
  emailRequired: 'Bitte geben Sie Ihre E-Mail-Adresse ein.',
  emailInvalid: 'Bitte geben Sie eine gültige E-Mail-Adresse ein.',
  passwordTooShort: 'Das Passwort muss mindestens 8 Zeichen lang sein.',
  passwordTooLong: 'Das Passwort darf höchstens 72 Zeichen lang sein.',
  passwordTooManyBytes:
    'Das Passwort ist zu lang, weil Umlaute und andere besondere Zeichen mehrfach zählen. Bitte kürzen Sie es.',
  passwordConfirmationRequired: 'Bitte wiederholen Sie das Passwort.',
  passwordMismatch: 'Die Passwörter stimmen nicht überein.',
  loginPasswordRequired: 'Bitte geben Sie Ihr Passwort ein.',
  passwordHint: 'Mindestens 8 Zeichen.',
  // Form messages (design.md → "Meldungstexte")
  emailAlreadyRegistered:
    'Mit dieser E-Mail-Adresse ist bereits ein Konto registriert. Bitte melden Sie sich an.',
  toLogin: 'Zum Login',
  invalidCredentials: 'E-Mail-Adresse oder Passwort ist falsch.',
  botCheckFailed: 'Die Sicherheitsprüfung ist fehlgeschlagen. Bitte versuchen Sie es erneut.',
  tooManyRegistrations: 'Zu viele Registrierungen. Bitte versuchen Sie es später erneut.',
  registrationFailed: 'Die Registrierung ist fehlgeschlagen. Bitte versuchen Sie es erneut.',
  loginFailed: 'Die Anmeldung ist fehlgeschlagen. Bitte versuchen Sie es erneut.',
  noConnection: 'Keine Verbindung. Bitte versuchen Sie es erneut.',
  unassigned:
    'Ihr Konto ist keinem Bildungsträger zugeordnet. Bitte wenden Sie sich an den Anbieter.',
  sessionEnded: 'Bitte melden Sie sich erneut an.',
  botCheckUnavailable:
    'Die Sicherheitsprüfung konnte nicht geladen werden. Bitte laden Sie die Seite neu.',
} as const

/** Every lock of the login brake lasts 15 minutes (AC-6). */
const LOGIN_LOCK_MINUTES = 15
/** Supabase's own rate limit is answered with a fixed wait (design.md → "Anmelden", step 5). */
const SUPABASE_RATE_LIMIT_MINUTES = 5

/** Whole minutes left, rounded up, at least 1. */
export function remainingMinutes(lockedUntil: Date, now: Date): number {
  const milliseconds = lockedUntil.getTime() - now.getTime()
  // An invalid date never understates the wait: assume the full lock.
  if (!Number.isFinite(milliseconds)) return LOGIN_LOCK_MINUTES
  return Math.max(1, Math.ceil(milliseconds / 60_000))
}

/** 'Zu viele Anmeldeversuche. Bitte versuchen Sie es in 1 Minute erneut.' / '… in X Minuten erneut.' */
export function tooManyLoginAttemptsMessage(minutes: number): string {
  const whole = Number.isFinite(minutes) ? Math.max(1, Math.ceil(minutes)) : LOGIN_LOCK_MINUTES
  const wait = whole === 1 ? '1 Minute' : `${whole} Minuten`
  return `Zu viele Anmeldeversuche. Bitte versuchen Sie es in ${wait} erneut.`
}

export type ClientIp = { ip: string; isPublic: boolean }

/** Stand-in when X-Forwarded-For carries no valid address (design.md → "IP-Adresse des Besuchers"). */
const UNKNOWN_IP = '0.0.0.0'

/**
 * From the X-Forwarded-For header value: the LAST entry that is a valid IPv4/IPv6 literal
 * (entries trimmed; earlier entries come from the client and never count). No valid entry
 * (or null/empty header) → '0.0.0.0'. isPublic is false for 0.0.0.0/8 and '::', loopback,
 * private networks, link-local and IPv4-mapped IPv6 forms of those.
 */
export function clientIpFrom(forwardedFor: string | null | undefined): ClientIp {
  const entries = (forwardedFor ?? '').split(',')
  for (let index = entries.length - 1; index >= 0; index--) {
    const entry = entries[index].trim()
    const ipv4 = parseIpv4(entry)
    if (ipv4) return { ip: entry, isPublic: isPublicIpv4(ipv4) }
    const ipv6 = parseIpv6(entry)
    if (ipv6) return { ip: entry, isPublic: isPublicIpv6(ipv6) }
  }
  return { ip: UNKNOWN_IP, isPublic: false }
}

/** Four octets, or null. Leading zeros are rejected ('01.2.3.4' is ambiguous). */
function parseIpv4(text: string): number[] | null {
  const parts = text.split('.')
  if (parts.length !== 4) return null
  const octets: number[] = []
  for (const part of parts) {
    if (!/^(0|[1-9]\d{0,2})$/.test(part)) return null
    const octet = Number(part)
    if (octet > 255) return null
    octets.push(octet)
  }
  return octets
}

/** Eight 16-bit groups, or null. Accepts '::' compression and a dotted IPv4 tail; no zone id. */
function parseIpv6(text: string): number[] | null {
  if (!/^[0-9A-Fa-f:.]+$/.test(text)) return null
  const halves = text.split('::')
  if (halves.length > 2) return null
  if (halves.length === 1) {
    const groups = parseIpv6Groups(text, true)
    return groups && groups.length === 8 ? groups : null
  }
  const head = parseIpv6Groups(halves[0], false)
  const tail = parseIpv6Groups(halves[1], true)
  if (!head || !tail || head.length + tail.length > 7) return null
  const zeros = new Array<number>(8 - head.length - tail.length).fill(0)
  return [...head, ...zeros, ...tail]
}

function parseIpv6Groups(text: string, allowIpv4Tail: boolean): number[] | null {
  if (text === '') return []
  const parts = text.split(':')
  const groups: number[] = []
  for (const [index, part] of parts.entries()) {
    if (allowIpv4Tail && index === parts.length - 1 && part.includes('.')) {
      const ipv4 = parseIpv4(part)
      if (!ipv4) return null
      groups.push(ipv4[0] * 256 + ipv4[1], ipv4[2] * 256 + ipv4[3])
    } else if (/^[0-9A-Fa-f]{1,4}$/.test(part)) {
      groups.push(parseInt(part, 16))
    } else {
      return null
    }
  }
  return groups
}

function isPublicIpv4([a, b]: number[]): boolean {
  if (a === 0) return false // 0.0.0.0/8 ("this network", includes the stand-in 0.0.0.0)
  if (a === 127) return false // loopback
  if (a === 10) return false // private
  if (a === 172 && b >= 16 && b <= 31) return false // private
  if (a === 192 && b === 168) return false // private
  if (a === 169 && b === 254) return false // link-local
  return true
}

function isPublicIpv6(groups: number[]): boolean {
  const firstFiveZero = groups.slice(0, 5).every((group) => group === 0)
  if (firstFiveZero && groups[5] === 0xffff) {
    // IPv4-mapped (::ffff:a.b.c.d): judged by the IPv4 address inside
    return isPublicIpv4([groups[6] >> 8, groups[6] & 0xff, groups[7] >> 8, groups[7] & 0xff])
  }
  const firstSevenZero = firstFiveZero && groups[5] === 0 && groups[6] === 0
  if (firstSevenZero && (groups[7] === 0 || groups[7] === 1)) return false // '::' and '::1'
  if ((groups[0] & 0xfe00) === 0xfc00) return false // unique local fc00::/7
  if ((groups[0] & 0xffc0) === 0xfe80) return false // link-local fe80::/10
  return true
}

export type FormError = { message: string; loginLink?: true }

export type RegisterFailure =
  | 'bot_check_rejected'
  | 'bot_check_error'
  | 'throttled'
  | 'duplicate'
  | 'auth_rate_limited'
  | 'failed'

/** design.md → "Registrieren", steps 2, 3 and 5. */
export function registerFormError(failure: RegisterFailure): FormError {
  switch (failure) {
    case 'bot_check_rejected':
      return { message: MESSAGES.botCheckFailed }
    case 'duplicate':
      return { message: MESSAGES.emailAlreadyRegistered, loginLink: true }
    case 'throttled':
    case 'auth_rate_limited':
      return { message: MESSAGES.tooManyRegistrations }
    case 'bot_check_error':
    case 'failed':
      return { message: MESSAGES.registrationFailed }
  }
}

export type LoginFailure =
  | 'bot_check_rejected'
  | 'bot_check_error'
  | 'locked'
  | 'invalid_credentials'
  | 'auth_rate_limited'
  | 'failed'

/** design.md → "Anmelden", steps 1 to 5. */
export function loginFormError(
  failure: LoginFailure,
  lock?: { lockedUntil: Date; now: Date },
): FormError {
  switch (failure) {
    case 'bot_check_rejected':
      return { message: MESSAGES.botCheckFailed }
    case 'locked':
      // Without the lock's end the wait cannot be computed; the full lock never understates it.
      return {
        message: tooManyLoginAttemptsMessage(
          lock ? remainingMinutes(lock.lockedUntil, lock.now) : LOGIN_LOCK_MINUTES,
        ),
      }
    case 'invalid_credentials':
      return { message: MESSAGES.invalidCredentials }
    case 'auth_rate_limited':
      return { message: tooManyLoginAttemptsMessage(SUPABASE_RATE_LIMIT_MINUTES) }
    case 'bot_check_error':
    case 'failed':
      return { message: MESSAGES.loginFailed }
  }
}
