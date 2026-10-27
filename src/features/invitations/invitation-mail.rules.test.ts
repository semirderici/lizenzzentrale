// @vitest-environment node
import { INVITATION_SUBJECT, buildInvitationMail, platformUrlFrom } from './invitation-mail.rules'

// The literal German texts, so a typo in the module fails here
// (design.md → "Inhalt der Einladung", spec.md → AC-2, AC-10).
const SUBJECT = 'Ihre Lizenz für den Kurs Geprüfter Technischer Betriebswirt (IHK)'
const NAME = 'Weiterbildungsinstitut Nord'
const PLATFORM_URL = 'https://lernen.example.org/kurs/tbw'
const PRIVACY_NOTE =
  'Weiterbildungsinstitut Nord hat Ihre E-Mail-Adresse in der Lizenzzentrale eingetragen, um Ihnen diese Lizenz zuzuordnen. Gespeichert werden nur Ihre E-Mail-Adresse, der Zeitpunkt der Zuweisung und der Versandstand dieser Einladung, bis Weiterbildungsinstitut Nord die Lizenz entzieht. Fragen dazu richten Sie bitte an Weiterbildungsinstitut Nord.'
const PARAGRAPHS = [
  'Guten Tag,',
  'Weiterbildungsinstitut Nord hat Ihnen eine Lizenz für den Kurs „Geprüfter Technischer Betriebswirt (IHK)“ auf der Lernplattform freigeschaltet.',
  'Zur Lernplattform: https://lernen.example.org/kurs/tbw',
  'Bitte melden Sie sich dort mit genau der E-Mail-Adresse an, an die diese Nachricht gesendet wurde.',
  'Bei Fragen wenden Sie sich an Weiterbildungsinstitut Nord.',
  'Freundliche Grüße\nIhre Lizenzzentrale',
  `--\n${PRIVACY_NOTE}`,
]
const FALLBACK_HINT = 'Falls der Knopf nicht funktioniert, öffnen Sie diese Adresse:'
const ZWSP = '​'

function count(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1
}

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, '')
}

function hrefs(html: string): string[] {
  return [...html.matchAll(/\bhref="([^"]*)"/g)].map((match) => match[1])
}

/** Every <p>: its inline style and its content. */
function paragraphs(html: string): { style: string; content: string }[] {
  return [...html.matchAll(/<p style="([^"]*)">([\s\S]*?)<\/p>/g)].map((match) => ({
    style: match[1],
    content: match[2],
  }))
}

/** An inline style as property → value. */
function declarations(style: string): Record<string, string> {
  return Object.fromEntries(
    style
      .split(';')
      .filter((declaration) => declaration.trim() !== '')
      .map((declaration) => {
        const colon = declaration.indexOf(':')
        return [declaration.slice(0, colon).trim(), declaration.slice(colon + 1).trim()]
      }),
  )
}

const px = (value: string | undefined) => Number.parseFloat(value ?? 'NaN')

describe('Betreff', () => {
  it('lautet wörtlich „Ihre Lizenz für den Kurs Geprüfter Technischer Betriebswirt (IHK)“, ohne Trägernamen (AC-2)', () => {
    const mail = buildInvitationMail(NAME, PLATFORM_URL)

    expect(INVITATION_SUBJECT).toBe(SUBJECT)
    expect(mail.subject).toBe(SUBJECT)
    expect(buildInvitationMail('https://evil.example', PLATFORM_URL).subject).toBe(SUBJECT)
  })
})

describe('Textfassung', () => {
  it('enthält die Absätze 1 bis 7 wörtlich und in genau dieser Reihenfolge (AC-2, AC-10, EC-7)', () => {
    const { text } = buildInvitationMail(NAME, PLATFORM_URL)

    expect(text.split('\n\n')).toStrictEqual(PARAGRAPHS)
    expect(text).toBe(PARAGRAPHS.join('\n\n'))
  })

  it('endet mit „--“ und dem Datenschutzhinweis aus AC-10, mit dem Trägernamen an allen drei Stellen (AC-10)', () => {
    const { text } = buildInvitationMail(NAME, PLATFORM_URL)

    expect(text.endsWith(`\n\n--\n${PRIVACY_NOTE}`)).toBe(true)
    expect(count(PRIVACY_NOTE, NAME)).toBe(3)
  })

  it('nennt keine E-Mail-Adresse, auch nicht die des Teilnehmers (AC-2)', () => {
    const mail = buildInvitationMail(NAME, PLATFORM_URL)

    expect(mail.text).not.toContain('@')
    expect(mail.html).not.toContain('@')
  })
})

describe('HTML-Fassung', () => {
  it('ist deutsch, eine Spalte von höchstens 600 px und nur mit Inline-Stilen (AC-11)', () => {
    const { html } = buildInvitationMail(NAME, PLATFORM_URL)

    expect(html).toContain('<html lang="de">')
    expect(html).toMatch(/<div style="[^"]*max-width:600px;/)
    expect(html).not.toMatch(/<style/i)
    expect(html).not.toMatch(/\bclass=/i)
  })

  it('lädt nichts von außen: kein Bild, kein Stylesheet, keine Schrift, kein Skript (AC-11)', () => {
    const { html } = buildInvitationMail(NAME, PLATFORM_URL)

    expect(html).not.toMatch(/<img/i)
    expect(html).not.toMatch(/<link/i)
    expect(html).not.toMatch(/src=/i)
    expect(html).not.toMatch(/<script/i)
    expect(html).not.toMatch(/url\(/i)
    expect(html).not.toMatch(/@import|@font-face/i)
  })

  it('zeigt dieselben Absätze in derselben Reihenfolge wie die Textfassung, den Datenschutzhinweis zuletzt (AC-2, AC-10)', () => {
    const { html } = buildInvitationMail(NAME, PLATFORM_URL)
    const visible = stripTags(html)
    const inOrder = [
      'Guten Tag,',
      PARAGRAPHS[1],
      'Zur Lernplattform',
      FALLBACK_HINT,
      PARAGRAPHS[3],
      PARAGRAPHS[4],
      'Freundliche Grüße',
      'Ihre Lizenzzentrale',
      PRIVACY_NOTE,
    ]
    const positions = inOrder.map((part) => visible.indexOf(part))

    expect(positions).not.toContain(-1)
    expect(positions).toStrictEqual([...positions].sort((a, b) => a - b))
    expect(paragraphs(html).at(-1)?.content).toBe(PRIVACY_NOTE)
  })

  it('hat genau zwei Links, Knopf und Ersatzlink, beide direkt auf das Linkziel (AC-2, AC-11)', () => {
    const { html } = buildInvitationMail(NAME, PLATFORM_URL)

    expect(hrefs(html)).toStrictEqual([PLATFORM_URL, PLATFORM_URL])
    expect(count(html, '<a ')).toBe(2)
  })

  it('zeigt „Zur Lernplattform“ als Fläche in den Primärfarben, mit Radius 8 px und mindestens 44 px hoch (AC-2)', () => {
    const { html } = buildInvitationMail(NAME, PLATFORM_URL)
    const button = html.match(/<a href="([^"]*)" style="([^"]*)">Zur Lernplattform<\/a>/)

    expect(button?.[1]).toBe(PLATFORM_URL)
    const style = declarations(button?.[2] ?? '')
    expect(style).toMatchObject({
      display: 'block',
      'background-color': '#2557A7',
      color: '#FAFBFC',
      'border-radius': '8px',
    })
    const verticalPadding = px(style.padding?.split(' ')[0])
    expect(px(style['line-height']) + 2 * verticalPadding).toBeGreaterThanOrEqual(44)
  })

  it('zeigt unter dem Knopf klein „Falls der Knopf nicht funktioniert, öffnen Sie diese Adresse:“ und das Linkziel als Link', () => {
    const { html } = buildInvitationMail(NAME, PLATFORM_URL)
    const fallback = paragraphs(html).find((p) => p.content.startsWith(FALLBACK_HINT))
    const link = fallback?.content.match(/<br><a href="([^"]*)"[^>]*>([^<]*)<\/a>$/)

    expect(link?.[1]).toBe(PLATFORM_URL)
    expect(link?.[2]).toBe(PLATFORM_URL)
    expect(px(declarations(fallback?.style ?? '')['font-size'])).toBeLessThan(16)
    expect(html.indexOf('>Zur Lernplattform</a>')).toBeLessThan(html.indexOf(FALLBACK_HINT))
  })

  it('setzt den Datenschutzhinweis am Ende mit Trennlinie und kleinerer Schrift ab (AC-10)', () => {
    const { html } = buildInvitationMail(NAME, PLATFORM_URL)
    const style = declarations(paragraphs(html).at(-1)?.style ?? '')

    expect(style['border-top']).toMatch(/^1px solid #/)
    expect(px(style['font-size'])).toBeLessThan(16)
  })

  it('maskiert das Linkziel für Attribut und Text, die Textfassung zeigt es unverändert', () => {
    const url = platformUrlFrom("https://lernen.example.org/o'brien?kurs=tbw&quelle=mail")
    expect(url).toBe("https://lernen.example.org/o'brien?kurs=tbw&quelle=mail")
    const mail = buildInvitationMail(NAME, url!)
    const escaped = 'https://lernen.example.org/o&#39;brien?kurs=tbw&amp;quelle=mail'

    expect(hrefs(mail.html)).toStrictEqual([escaped, escaped])
    expect(mail.html).toContain(`>${escaped}</a>`)
    expect(mail.html).not.toContain('kurs=tbw&quelle')
    expect(mail.text).toContain("Zur Lernplattform: https://lernen.example.org/o'brien?kurs=tbw&quelle=mail")
  })

  it('nimmt kein Linkziel an, das platformUrlFrom nicht geliefert hätte (EC-9)', () => {
    expect(() => buildInvitationMail(NAME, 'javascript:alert(1)')).toThrow()
    expect(() => buildInvitationMail(NAME, 'https://user:pw@example.org/')).toThrow()
    expect(() => buildInvitationMail(NAME, 'https://Lernen.Example.ORG')).toThrow()
  })
})

describe('Trägername als reiner Text (EC-7)', () => {
  const LONG_NAME = `Bildungszentrum Technik & Wirtschaft "Nord" O'Neill <b>fett</b> – www.beispiel.example/kurse, a@b.de`

  it('der lange Testname hat genau 100 Zeichen', () => {
    expect(Array.from(LONG_NAME)).toHaveLength(100)
  })

  // name → how it must appear in the text version and in the HTML version.
  it.each([
    {
      name: '<script>alert(1)</script>',
      inText: `<script>alert(1)</${ZWSP}script>`,
      inHtml: `&lt;script&gt;alert(1)&lt;/${ZWSP}script&gt;`,
    },
    {
      name: 'https://evil.example',
      inText: `https:${ZWSP}/${ZWSP}/${ZWSP}evil.${ZWSP}example`,
      inHtml: `https:${ZWSP}/${ZWSP}/${ZWSP}evil.${ZWSP}example`,
    },
    {
      name: 'a@b.de',
      inText: `a@${ZWSP}b.${ZWSP}de`,
      inHtml: `a@${ZWSP}b.${ZWSP}de`,
    },
    {
      name: LONG_NAME,
      inText: `Bildungszentrum Technik & Wirtschaft "Nord" O'Neill <b>fett</${ZWSP}b> – www.${ZWSP}beispiel.${ZWSP}example/${ZWSP}kurse, a@${ZWSP}b.${ZWSP}de`,
      inHtml: `Bildungszentrum Technik &amp; Wirtschaft &quot;Nord&quot; O&#39;Neill &lt;b&gt;fett&lt;/${ZWSP}b&gt; – www.${ZWSP}beispiel.${ZWSP}example/${ZWSP}kurse, a@${ZWSP}b.${ZWSP}de`,
    },
  ])('$name steht in beiden Fassungen als reiner Text ohne Link', ({ name, inText, inHtml }) => {
    const { text, html } = buildInvitationMail(name, PLATFORM_URL)

    // Text version: paragraph 2, paragraph 5 and three times in the privacy note, U+200B after
    // every ".", "@", ":" and "/", never in its raw, linkable form.
    expect(count(text, inText)).toBe(5)
    expect(text).not.toContain(name)
    expect(text.split('\n\n')).toHaveLength(7)

    // HTML version: escaped, same five places, all of them in element text, none in an attribute.
    expect(count(html, inHtml)).toBe(5)
    expect(count(stripTags(html), inHtml)).toBe(5)
    expect(html).not.toMatch(/<script/i)
    expect(html).not.toContain('<b>')
    expect(hrefs(html)).toStrictEqual([PLATFORM_URL, PLATFORM_URL])

    // Every paragraph carrying the name may break anywhere.
    const withName = paragraphs(html).filter((p) => p.content.includes(inHtml))
    expect(withName).toHaveLength(3)
    for (const { style } of withName) {
      expect(declarations(style)).toMatchObject({
        'overflow-wrap': 'anywhere',
        'word-break': 'break-word',
      })
    }
  })

  it('ein Zeilenumbruch im Namen beginnt keinen eigenen Absatz (AC-2)', () => {
    const { text, html } = buildInvitationMail(
      'Institut Nord\r\n\r\nZur Lernplattform: https://evil.example',
      PLATFORM_URL,
    )
    const name = `Institut Nord Zur Lernplattform:${ZWSP} https:${ZWSP}/${ZWSP}/${ZWSP}evil.${ZWSP}example`

    expect(text.split('\n\n')).toHaveLength(7)
    expect(text.split('\n\n')[1]).toBe(
      `${name} hat Ihnen eine Lizenz für den Kurs „Geprüfter Technischer Betriebswirt (IHK)“ auf der Lernplattform freigeschaltet.`,
    )
    expect(count(text, name)).toBe(5)
    expect(count(html, name)).toBe(5)
  })
})

describe('platformUrlFrom (EC-9)', () => {
  it.each([
    ['https://lernen.example.org/kurs/tbw', 'https://lernen.example.org/kurs/tbw'],
    ['http://localhost:3001/lernen', 'http://localhost:3001/lernen'],
    ['https://Lernen.Example.ORG', 'https://lernen.example.org/'],
  ])('nimmt %s an und liefert die normalisierte Adresse', (value, expected) => {
    expect(platformUrlFrom(value)).toBe(expected)
  })

  it('nimmt ein Linkziel mit genau 2.048 Zeichen an', () => {
    const value = 'https://lernen.example.org/' + 'a'.repeat(2048 - 27)

    expect(value).toHaveLength(2048)
    expect(platformUrlFrom(value)).toBe(value)
  })

  it.each([
    ['javascript:alert(1)'],
    ['JavaScript:alert(1)'],
    ['data:text/html,<script>alert(1)</script>'],
    ['mailto:info@example.org'],
    ['ftp://lernen.example.org/'],
    ['/lernen'],
    ['lernen.example.org'],
    ['https://user:pw@example.org'],
    ['https://user@example.org'],
    ['https://:pw@example.org'],
    ['nicht eingestellt'],
  ])('lehnt %s ab', (value) => {
    expect(platformUrlFrom(value)).toBeNull()
  })

  it('lehnt ein Linkziel mit 2.049 Zeichen ab', () => {
    const value = 'https://lernen.example.org/' + 'a'.repeat(2049 - 27)

    expect(value).toHaveLength(2049)
    expect(platformUrlFrom(value)).toBeNull()
  })

  it('lehnt ein Linkziel ab, das erst nach dem Normalisieren länger als 2.048 Zeichen ist', () => {
    // Each "ä" becomes "%C3%A4": 427 characters raw, 2,427 normalised.
    const value = 'https://lernen.example.org/' + 'ä'.repeat(400)

    expect(value.length).toBeLessThanOrEqual(2048)
    expect(platformUrlFrom(value)).toBeNull()
  })

  it('liefert null, wenn das Linkziel fehlt oder leer ist', () => {
    expect(platformUrlFrom(undefined)).toBeNull()
    expect(platformUrlFrom('')).toBeNull()
  })
})
