// Pure rules of the invitation mail: the check of the platform link and the mail itself (subject,
// plain-text and HTML version), built from the training provider's name and that link. No imports,
// no IO, no framework, no clock, no environment access: the caller passes the name and the raw
// value of LEARNING_PLATFORM_URL.
// See features/PROJ-3-invitation-email/design.md → "Inhalt der Einladung (AC-2, AC-10, AC-11,
// EC-7)", "Einstellungen der App (Umgebung)", "Technische Entscheidungen".

/** Without the training provider's name: a free, unchecked name there would be a phishing tool (AC-2). */
export const INVITATION_SUBJECT = 'Ihre Lizenz für den Kurs Geprüfter Technischer Betriebswirt (IHK)'

export type InvitationMail = { subject: string; text: string; html: string }

/** Longest accepted platform link, for the raw value and for the normalised href alike. */
const MAX_PLATFORM_URL_LENGTH = 2048

/** The platform link from the environment: valid → the normalised URL (new URL(value).href), else null (EC-9). */
export function platformUrlFrom(value: string | undefined): string | null {
  // The raw value is measured first, so a huge input never reaches the parser.
  if (value === undefined || value === '' || value.length > MAX_PLATFORM_URL_LENGTH) return null
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return null // a relative path or no URL at all
  }
  // Only web links: never javascript:, data:, mailto: or anything else a click would run.
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  if (url.username !== '' || url.password !== '') return null
  // Percent-encoding can make the href longer than the raw value.
  if (url.href.length > MAX_PLATFORM_URL_LENGTH) return null
  // The href, so the mail carries exactly what the URL parser understood.
  return url.href
}

// --- Texts (design.md → "Textfassung", paragraphs 1 to 7) -------------------------------------

const GREETING = 'Guten Tag,'
const BUTTON_LABEL = 'Zur Lernplattform'
const SIGN_IN_HINT =
  'Bitte melden Sie sich dort mit genau der E-Mail-Adresse an, an die diese Nachricht gesendet wurde.'
const CLOSING = 'Freundliche Grüße'
const SIGNATURE = 'Ihre Lizenzzentrale'
const FALLBACK_HINT = 'Falls der Knopf nicht funktioniert, öffnen Sie diese Adresse:'

// The name passed to these is already prepared for the version it goes into.
/**
 * The name closing a sentence: a name ending in a full stop (e.V., U+200B after it), "!", "?" or
 * "\u2026" ends the sentence itself and needs no stop after it.
 */
const atSentenceEnd = (name: string) => (/[.!?\u2026]\u200B?$/.test(name) ? name : `${name}.`)
const unlockedText = (name: string) =>
  `${name} hat Ihnen eine Lizenz für den Kurs „Geprüfter Technischer Betriebswirt (IHK)“ auf der Lernplattform freigeschaltet.`
const questionsText = (name: string) => `Bei Fragen wenden Sie sich an ${atSentenceEnd(name)}`
/** The privacy note of AC-10 word for word, with the name at all three places (Art. 14 GDPR). */
const privacyNote = (name: string) =>
  `${name} hat Ihre E-Mail-Adresse in der Lizenzzentrale eingetragen, um Ihnen diese Lizenz zuzuordnen. Gespeichert werden nur Ihre E-Mail-Adresse, der Zeitpunkt der Zuweisung und der Versandstand dieser Einladung, bis ${name} die Lizenz entzieht. Fragen dazu richten Sie bitte an ${atSentenceEnd(name)}`

// --- The training provider's name as plain text (EC-7) ----------------------------------------

const ZERO_WIDTH_SPACE = '\u200B'

/**
 * The name as one line of plain text that no mail client turns into a link: format characters
 * (direction overrides and isolates, zero-width characters, soft hyphens) are removed, since they
 * are formatting too (EC-7); control characters and line or paragraph separators become a space
 * (a name must not start a paragraph of its own, AC-2); and a zero-width space follows every ".",
 * "@", ":" and "/", which breaks the patterns of automatic linking (www.…, …@…, https://…).
 */
function plainName(name: string): string {
  return name
    .replace(/\p{Cf}/gu, '')
    .replace(/[\p{Cc}\p{Zl}\p{Zp}]+/gu, ' ')
    .replace(/[.@:/]/g, (char) => char + ZERO_WIDTH_SPACE)
}

const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

/** Safe in element text and in a double-quoted attribute value. */
function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ENTITIES[char])
}

// --- HTML styling -----------------------------------------------------------------------------

// Fixed values from the light theme of src/app/globals.css (docs/design-system.md): mail clients
// know no CSS variables. Converted from HSL:
//   --primary             217 64% 40%   → #2557A7
//   --primary-foreground  220 20% 98.5% → #FAFBFC  (on #2557A7: contrast 6.8:1)
//   --foreground          222 47% 11%   → #0F1729
//   --muted-foreground    215 19% 36%   → #4A596D  (on #FDFEFE: 7.1:1)
//   --border              214 25% 87%   → #D6DDE6
//   --card                220 20% 99.5% → #FDFEFE  (the design system allows no pure white)
const COLOR_PRIMARY = '#2557A7'
const COLOR_PRIMARY_FOREGROUND = '#FAFBFC'
const COLOR_FOREGROUND = '#0F1729'
const COLOR_MUTED_FOREGROUND = '#4A596D'
const COLOR_BORDER = '#D6DDE6'
const COLOR_BACKGROUND = '#FDFEFE'

// System fonts only: a web font would be a request to a third party when the mail opens (AC-11).
const FONT_STACK = '-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif'
// Paragraphs carrying the name or the link may break anywhere, so a long one never widens the column.
const BREAK_ANYWHERE = 'overflow-wrap:anywhere;word-break:break-word;'
const PARAGRAPH = 'margin:0 0 16px;'
const SMALL = 'font-size:14px;line-height:20px;'

// A surface, not a text link: 48 px high from the line height alone, so it keeps the minimum
// touch height of 44 px even in clients that ignore padding on links.
const BUTTON_STYLE = [
  'display:block',
  'padding:0 24px',
  'line-height:48px',
  `background-color:${COLOR_PRIMARY}`,
  `color:${COLOR_PRIMARY_FOREGROUND}`,
  'border-radius:8px',
  'text-align:center',
  'text-decoration:none',
  'font-weight:bold',
].join(';')

const PRIVACY_STYLE = [
  'margin:24px 0 0',
  'padding-top:16px',
  `border-top:1px solid ${COLOR_BORDER}`,
  'font-size:13px',
  'line-height:20px',
  `color:${COLOR_MUTED_FOREGROUND}`,
].join(';')

function paragraph(style: string, content: string): string {
  return `<p style="${style}">${content}</p>`
}

// --- The mail ---------------------------------------------------------------------------------

/** Builds subject, plain-text and HTML version. platformUrl must come from platformUrlFrom. */
export function buildInvitationMail(trainingProviderName: string, platformUrl: string): InvitationMail {
  // A link that did not pass the check never gets into a mail, whatever the caller did.
  if (platformUrlFrom(platformUrl) !== platformUrl) {
    throw new Error('buildInvitationMail: the platform URL did not pass platformUrlFrom')
  }

  const textName = plainName(trainingProviderName)
  const text = [
    GREETING,
    unlockedText(textName),
    `${BUTTON_LABEL}: ${platformUrl}`,
    SIGN_IN_HINT,
    questionsText(textName),
    `${CLOSING}\n${SIGNATURE}`,
    `--\n${privacyNote(textName)}`,
  ].join('\n\n')

  // The name only ever stands in element text, never in an attribute.
  const htmlName = escapeHtml(textName)
  const href = escapeHtml(platformUrl)
  const html = [
    '<!DOCTYPE html>',
    '<html lang="de">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(INVITATION_SUBJECT)}</title>`,
    '</head>',
    `<body style="margin:0;padding:0;background-color:${COLOR_BACKGROUND};">`,
    `<div style="max-width:600px;margin:0 auto;padding:24px 16px;font-family:${FONT_STACK};font-size:16px;line-height:24px;color:${COLOR_FOREGROUND};">`,
    paragraph(PARAGRAPH, GREETING),
    paragraph(PARAGRAPH + BREAK_ANYWHERE, unlockedText(htmlName)),
    paragraph('margin:0 0 8px;', `<a href="${href}" style="${BUTTON_STYLE}">${BUTTON_LABEL}</a>`),
    paragraph(
      PARAGRAPH + SMALL + `color:${COLOR_MUTED_FOREGROUND};` + BREAK_ANYWHERE,
      `${FALLBACK_HINT}<br><a href="${href}" style="color:${COLOR_PRIMARY};">${href}</a>`,
    ),
    paragraph(PARAGRAPH, SIGN_IN_HINT),
    paragraph(PARAGRAPH + BREAK_ANYWHERE, questionsText(htmlName)),
    paragraph(PARAGRAPH, `${CLOSING}<br>${SIGNATURE}`),
    paragraph(`${PRIVACY_STYLE};${BREAK_ANYWHERE}`, privacyNote(htmlName)),
    '</div>',
    '</body>',
    '</html>',
  ].join('\n')

  return { subject: INVITATION_SUBJECT, text, html }
}
