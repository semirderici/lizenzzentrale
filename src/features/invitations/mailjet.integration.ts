// Server-side call to the Mailjet Send API v3.1 (design.md → Mailjet aufrufen, Grundsatz 5).
// Missing settings, no answer or an answer that cannot be read is a failure, never an acceptance.
import 'server-only'

const SEND_URL = 'https://api.mailjet.com/v3.1/send'
const TIMEOUT_MS = 10_000
const SENDER_NAME = 'Lizenzzentrale'

// Only codes shaped like Mailjet's own (`send-0008`, `mj-0015`) reach the log. Anything else in
// that field is not trusted to be free of addresses.
const ERROR_CODE = /^[a-z]+-\d{4}$/

export type MailjetMessage = { to: string; subject: string; text: string; html: string }
export type MailjetVerdict = 'accepted' | 'failed'

/**
 * Hands one invitation to Mailjet, once, with no retry (AC-3). A failure leaves one line on the
 * server console with the HTTP status and Mailjet's error codes only — never a key, an address,
 * Mailjet's error text or the response body.
 */
export async function sendMail(message: MailjetMessage): Promise<MailjetVerdict> {
  // Read on every call, so the app starts without them (EC-9).
  const apiKey = process.env.MAILJET_API_KEY?.trim()
  const secretKey = process.env.MAILJET_SECRET_KEY?.trim()
  const sender = process.env.INVITATION_SENDER_EMAIL?.trim()
  if (!apiKey || !secretKey || !sender) return failed('nicht eingestellt')

  const body = {
    Messages: [
      {
        From: { Email: sender, Name: SENDER_NAME },
        // Only the address, exactly as stored with the license (EC-8).
        To: [{ Email: message.to }],
        Subject: message.subject,
        TextPart: message.text,
        HTMLPart: message.html,
        // Set per message, so the account setting cannot switch tracking back on (AC-11).
        TrackOpens: 'disabled',
        TrackClicks: 'disabled',
      },
    ],
  }

  // An own timer instead of AbortSignal.timeout(): it also covers reading the body, and Vitest's
  // fake timers can drive it.
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  let ok: boolean
  let status: number
  let text: string
  try {
    const response = await fetch(SEND_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${apiKey}:${secretKey}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    ok = response.ok
    status = response.status
    text = await response.text()
  } catch {
    return failed(controller.signal.aborted ? 'Zeitüberschreitung' : 'keine Verbindung')
  } finally {
    clearTimeout(timer)
  }

  // Mailjet documents 201 for this call while its examples show 200, so any 2xx counts.
  const result = parseJson(text)
  if (!ok) return failed(`HTTP ${status}`, ...errorCodes(result))

  // Exactly the one message that was sent; any other shape is not an answer we understand.
  const messages = isRecord(result) && Array.isArray(result.Messages) ? result.Messages : []
  const [entry] = messages
  if (messages.length !== 1 || !isRecord(entry)) return failed(`HTTP ${status}`, 'Antwort nicht lesbar')
  if (entry.Status !== 'success') return failed(`HTTP ${status}`, 'nicht angenommen', ...errorCodes(result))
  return 'accepted'
}

function failed(...details: string[]): 'failed' {
  console.error(`Mailjet: Einladung nicht versendet (${details.join(', ')})`)
  return 'failed'
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/** The codes of a top-level error (e.g. a wrong key) and of every error of the message. */
function errorCodes(result: unknown): string[] {
  if (!isRecord(result)) return []
  const messages = Array.isArray(result.Messages) ? result.Messages : []
  const errors = messages.flatMap((entry) => (isRecord(entry) && Array.isArray(entry.Errors) ? entry.Errors : []))
  const codes = [result, ...errors].map((item) => (isRecord(item) ? item.ErrorCode : undefined))
  return [...new Set(codes.filter((code): code is string => typeof code === 'string' && ERROR_CODE.test(code)))]
}
