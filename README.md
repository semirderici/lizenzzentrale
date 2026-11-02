# Lizenzzentrale

Self-Service-Portal für Bildungsträger, die Lizenzen für die E-Learning-Plattform zur IHK-Weiterbildung „Geprüfter Technischer Betriebswirt“ gekauft haben. Ein Verwalter sieht, wie viele Lizenzen vergeben und frei sind. Er weist Teilnehmern selbst eine Lizenz zu und entzieht sie wieder. Jeder Teilnehmer bekommt automatisch eine Einladung per E-Mail.

Abschlussprojekt im AI Engineering Accelerator, entwickelt mit dem AI Engineering Kit (spezifikationsgetriebener Ablauf, siehe [Spezifikationen und QA-Berichte](#spezifikationen-und-qa-berichte)).

## Die drei Features

| ID | Feature | Was es tut | Status |
|---|---|---|---|
| PROJ-1 | Konto & Login | Registrierung des Bildungsträgers mit E-Mail und Passwort, Anmelden, Abmelden, Bot-Prüfung und Login-Sperre. Jeder Verwalter sieht nur die Daten seines eigenen Trägers. Jeder Träger startet mit 5 Lizenzen. | Approved |
| PROJ-2 | Lizenzverwaltung | Kontingent sehen, Lizenzen per E-Mail-Adresse zuweisen und entziehen. Bei vollem Kontingent ist keine Zuweisung möglich. Das prüft auch die Datenbank. | Approved |
| PROJ-3 | Einladungs-E-Mail | Bei jeder Zuweisung geht eine Einladung über Mailjet hinaus. Der Versandstatus steht pro Lizenz in der Liste, die Einladung lässt sich erneut senden. | Approved |

Technik: Next.js 16 (App Router, TypeScript), Tailwind CSS und shadcn/ui, Supabase (PostgreSQL und Auth) mit Row Level Security, Cloudflare Turnstile, Mailjet.

## Lokal starten

Die App läuft nur lokal, gegen ein eigenes gehostetes Supabase-Projekt im kostenlosen Tarif. Docker ist nicht nötig.

### 1. Voraussetzungen

- Node.js 20.9 oder neuer mit npm (verlangt von Next.js 16)
- Supabase CLI: `brew install supabase/tap/supabase`, oder ohne Installation `npx supabase …`
- ein kostenloses Konto bei [Supabase](https://supabase.com)
- für den Mailversand ein kostenloses Konto bei [Mailjet](https://www.mailjet.com), siehe [Schritt 7](#7-mailversand-einrichten-mailjet)
- Ein Cloudflare-Konto ist nicht nötig. Die Bot-Prüfung läuft mit Cloudflares öffentlichen Testschlüsseln.

### 2. Installation

```bash
git clone <Repository-URL> lizenzzentrale
cd lizenzzentrale
npm install
```

### 3. Supabase-Projekt anlegen und einstellen

1. Im Supabase-Dashboard ein neues Projekt anlegen, Region **eu-central-1 (Frankfurt)**.
2. Das Datenbank-Passwort aufbewahren. Schritt 5 fragt danach.
3. Die Project Ref notieren: `<ref>` in `https://<ref>.supabase.co` (Project Settings → General → „Project ID“).
4. Diese Einstellungen von Hand im Dashboard setzen:

| Wo im Dashboard | Einstellung | Wert |
|---|---|---|
| Authentication → Sign In / Providers → Email | „Confirm email“ | **aus**: Das Konto ist nach der Registrierung sofort aktiv. |
| Authentication → Sign In / Providers → Email (je nach Stand unter Attack Protection) | „Minimum password length“ | **8**, ohne Pflicht zu bestimmten Zeichenarten |
| Authentication → Attack Protection | „Enable Captcha protection“ | **an**, Anbieter Cloudflare Turnstile, Secret `2x0000000000000000000000000000000AA` |
| Authentication → Audit Logs | „Write audit logs to the database“ | **aus** |

- **Das CAPTCHA-Secret im Dashboard scheitert mit Absicht immer.** Die App prüft das Turnstile-Token selbst und ruft Supabase danach mit dem Server-Schlüssel auf, den das CAPTCHA nicht betrifft. So kommt keine Anmeldung mit dem öffentlichen Schlüssel an den Bremsen der App vorbei. Ein Test prüft das.
- Ein Test erwartet, dass `auth.audit_log_entries` leer ist. War das Audit-Log schon einmal an, im SQL-Editor einmal `delete from auth.audit_log_entries;` ausführen.
- **`supabase config push` nicht ausführen.** `supabase/config.toml` gilt nur für eine lokale Instanz und würde die Einstellungen oben überschreiben.

### 4. Umgebungsvariablen

```bash
cp .env.local.example .env.local
```

Dann die Werte in `.env.local` eintragen. Die Datei ist über `.gitignore` ausgeschlossen, das Repository enthält keine Schlüssel.

| Variable | Wert |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` (Project Settings → Data API → „Project URL“) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Project Settings → API Keys → „Publishable key“ (`sb_publishable_…`) oder der ältere `anon`-Schlüssel |
| `SUPABASE_SERVICE_ROLE_KEY` | Project Settings → API Keys → „Secret key“ (`sb_secret_…`) oder der ältere `service_role`-Schlüssel. **Nur für den Server.** |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | `1x00000000000000000000AA` (Cloudflare-Testschlüssel, besteht immer) |
| `TURNSTILE_SECRET_KEY` | `1x0000000000000000000000000000000AA` (Cloudflare-Test-Secret, besteht immer) |
| `MAILJET_API_KEY`, `MAILJET_SECRET_KEY` | aus Mailjet, siehe [Schritt 7](#7-mailversand-einrichten-mailjet). **Nur für den Server.** |
| `INVITATION_SENDER_EMAIL` | die in Mailjet bestätigte Absenderadresse |
| `LEARNING_PLATFORM_URL` | Ziel des Knopfs „Zur Lernplattform“ in der Einladung, vollständig mit `https://` oder `http://`, z. B. `http://localhost:3000/` |
| `TRUSTED_PROXY` | lokal weglassen oder `false`. `true` gehört nur hinter einen Host, der `X-Forwarded-For` selbst setzt. |

Nicht verwechseln: In `.env.local` steht das Secret `1x…`, das immer besteht. Im Dashboard steht `2x…`, das immer scheitert. Nach jeder Änderung an `.env.local` `npm run dev` neu starten.

### 5. Datenbank einrichten

```bash
supabase login
supabase link --project-ref <ref>   # fragt nach dem Datenbank-Passwort aus Schritt 3
supabase db push                    # spielt die sechs Migrationen aus supabase/migrations/ ein
supabase migration list             # Local und Remote zeigen dieselben sechs Einträge
```

Die Migrationen legen Tabellen, Row Level Security, Rechte, Trigger und zwei `pg_cron`-Aufräumjobs an. Das Datenmodell beschreibt [`docs/data-model.md`](docs/data-model.md).

Ist in der Shell ein `SUPABASE_ACCESS_TOKEN` eines anderen Supabase-Kontos gesetzt, nimmt die CLI dieses statt des Logins. Dann jedem Befehl `env -u SUPABASE_ACCESS_TOKEN` voranstellen.

### 6. Starten

```bash
npm run dev
```

http://localhost:3000 öffnen. Die App leitet zur Anmeldung weiter.

### 7. Mailversand einrichten (Mailjet)

Ohne diesen Schritt startet die App trotzdem. Lizenzen lassen sich zuweisen, die Einladung steht dann auf „Fehlgeschlagen“.

1. Auf [mailjet.com](https://www.mailjet.com) ein Konto im Tarif **Free** anlegen, ohne Kreditkarte.
2. Account settings → Senders & domains → „Add a sender address“: eine eigene Adresse eintragen und den Link in der Bestätigungsmail öffnen.
   - Keine Adresse von Yahoo, AOL oder anderen Anbietern mit strenger DMARC-Regel, deren Mails werden abgewiesen.
   - Mit einer Gmail-Adresse landen Einladungen oft im Spam-Ordner.
3. Account settings → Tracking: Öffnungs- und Klickverfolgung **aus**.
4. Account settings → REST API → API key management: API-Key und Secret-Key in `.env.local` eintragen, die Absenderadresse als `INVITATION_SENDER_EMAIL`. Danach `npm run dev` neu starten.

**Nur an eigene Adressen senden**, am besten die eigene mit `+`-Zusatz (`name+test1@gmail.com`). **Nie an `example.com`:** Mailjet zählt solche Adressen als Rückläufer, und zu viele gefährden das Konto.

### 8. Kernablauf durchspielen

1. **Registrieren** („Noch kein Konto? Registrieren“): Name des Bildungsträgers, E-Mail-Adresse und zweimal ein Passwort mit mindestens 8 Zeichen. Danach ist man angemeldet und sieht die „Lizenzübersicht“ mit einem Kontingent von 5.
2. **Zuweisen:** „Lizenz zuweisen“ mit einer eigenen Adresse. Die Liste zeigt „Versendet am …“, die Mail kommt nach kurzer Zeit an. Auch im Spam-Ordner nachsehen.
3. **Entziehen:** „Entziehen“ und bestätigen. Die Lizenz ist sofort wieder frei.
4. **Kontingent voll:** fünf Lizenzen zuweisen. Dann erscheint „Ihr Kontingent ist ausgeschöpft. Für weitere Lizenzen wenden Sie sich an den Anbieter.“, und „Lizenz zuweisen“ ist gesperrt.
5. **Datentrennung:** in einem privaten Fenster einen zweiten Träger registrieren. Er sieht keine Lizenz des ersten.
6. **Abmelden** oben rechts.

Weitere Abläufe wie Login-Sperre und Versandgrenzen beschreiben die Akzeptanzkriterien in den `spec.md` der Features.

## Tests und `npm run check`

```bash
npm test          # Vitest: Unit- und Integrationstests
npm run check     # Lint, Typprüfung, Architekturregeln, alle Tests und Produktions-Build
```

Die Teile von `npm run check` lassen sich auch einzeln starten: `npm run lint`, `npm run typecheck`, `npm run check:structure`, `npm run build`.

- **Die Integrationstests brauchen das eigene Supabase-Projekt.** Die Datenbanktests in `src/test/db/` und mehrere `*.data.test.ts` laufen gegen das gehostete Projekt und lesen dieselben Schlüssel aus `.env.local` wie `npm run dev`. Vorher müssen die Schritte 3 bis 5 erledigt sein, sonst schlagen sie fehl. Das gilt auch für `npm run check`, weil es `npm test` enthält.
- Die Tests legen eigene Testkonten an und löschen sie am Ende wieder.
- Die Tests verschicken keine echten Mails. Mailjet ist in den Tests nachgebildet, die Mailjet-Werte aus `.env.local` werden nicht gelesen.
- Supabase begrenzt Anmeldungen pro IP-Adresse. Wer die Tests oft hintereinander startet, muss eventuell ein paar Minuten warten.
- Es gibt keine E2E-Tests. Der Schritt `/e2e-tests` ist im Ablauf des Kits optional und wurde nicht ausgeführt. `npm run test:e2e` ist eingerichtet und findet deshalb keine Tests.

## Spezifikationen und QA-Berichte

Den Status aller Features zeigt [`features/INDEX.md`](features/INDEX.md). Jedes Feature hat einen eigenen Ordner:

- [`features/PROJ-1-account-login/`](features/PROJ-1-account-login/)
- [`features/PROJ-2-license-management/`](features/PROJ-2-license-management/)
- [`features/PROJ-3-invitation-email/`](features/PROJ-3-invitation-email/)

In jedem Ordner liegen vier Dateien:

| Datei | Inhalt |
|---|---|
| `spec.md` | die Anforderungen: Akzeptanzkriterien (`AC-1`, `AC-2`, …) und Edge Cases (`EC-1`, …) |
| `design.md` | das technische Design und die Abweichungen beim Bau |
| `tasks.md` | der Bauplan, jede Aufgabe nennt die AC-IDs, die sie erfüllt |
| `qa-report.md` | der Prüfbericht pro AC-ID, das Security-Audit und alle Bugs mit Status |

Die Kette lautet **AC → Task → Test**. Übergreifend beschreiben [`docs/PRD.md`](docs/PRD.md) das Produkt, [`docs/data-model.md`](docs/data-model.md) die Daten und [`docs/privacy.md`](docs/privacy.md) die personenbezogenen Daten. Der Arbeitsablauf des Kits steht in [`CLAUDE.md`](CLAUDE.md).

## Kein Deployment

Laut PRD ist kein Deployment vorgesehen. Die App läuft nur lokal mit `npm run dev`, eine Produktions-URL gibt es nicht. Was erst für den Live-Betrieb nötig wäre, fehlt deshalb bewusst: Impressum, Datenschutzerklärung und „Passwort vergessen“.

## Bekannte Einschränkungen

### Mailjet-Schlüssel für den Mailversand

Das Repository enthält keine Mailjet-Schlüssel. Ohne `MAILJET_API_KEY`, `MAILJET_SECRET_KEY`, `INVITATION_SENDER_EMAIL` und ein gültiges `LEARNING_PLATFORM_URL` geht keine Mail hinaus, und die Einladung steht auf „Fehlgeschlagen“. Alles andere funktioniert. Für den Mailteil des Kernablaufs braucht es also ein eigenes Mailjet-Konto ([Schritt 7](#7-mailversand-einrichten-mailjet)).

Versandgrenzen: höchstens 3 Einladungen pro Lizenz und 30 pro Bildungsträger in 24 Stunden.

### Deferred-Bugs

Diese Bugs sind bekannt, dokumentiert und bewusst zurückgestellt. Keiner ist Critical oder High. Schritte zum Nachstellen stehen im jeweiligen `qa-report.md` unter „Bugs“.

| Feature | Bug | Severity | Was passiert |
|---|---|---|---|
| PROJ-1 | BUG-3 | Low | Unter 364 px Bildschirmbreite ragt die Bot-Prüfung über die Karte hinaus, die Seite scrollt waagerecht. |
| PROJ-1 | BUG-4 | Low | Es gibt keine eigene deutsche Fehler- und 404-Seite, Next.js zeigt seine englische Standardseite. |
| PROJ-1 | BUG-5 | Low | Steuerzeichen im Trägernamen werden nicht am Feld abgewiesen. |
| PROJ-1 | BUG-6 | Low | Gelingt die Registrierung, scheitert aber die Übernahme der Sitzung (z. B. bei einem kurzen Netzausfall), erscheint „bereits registriert“. Die Anmeldung klappt danach. Nur im Code gefunden, nicht ausgelöst. |
| PROJ-1 | BUG-7 | Low | Nach dem Abmelden liest das alte Zugriffstoken über die Datenschnittstelle von Supabase weiter die eigenen Daten, bis es abläuft (höchstens etwa 1 Stunde). Die App selbst weist es ab, das Cookie ist HttpOnly. |
| PROJ-1 | BUG-8 | Low | Bei gleichzeitigen Fehlversuchen nennt die Sperrmeldung teils „16 Minuten“ statt 15. |
| PROJ-1 | BUG-9 | Medium | Ohne vertrauenswürdigen Proxy zählen die IP-Bremsen alle Clients als eine Adresse. 20 Fehlversuche von irgendwem sperren den Login für alle für 15 Minuten, 5 Registrierungen in einer Stunde sperren die Registrierung für alle. Zurückgestellt, weil kein Deployment vorgesehen ist: Lokal gibt es keinen Proxy, der die Adresse des Clients weitergibt. |
| PROJ-3 | BUG-6 | Low | Endet der Trägername auf ein Steuerzeichen, steht am Satzende der Einladung „e.V. .“ statt „e.V.“. |
| PROJ-3 | BUG-7 | Low | Die Bereinigung des Trägernamens für die Mail entfernt auch ZWJ und ZWNJ. Emoji-Folgen zerfallen in einzelne Emoji, persische und indische Schreibweisen ändern sich. Nur Darstellung, kein Sicherheitsproblem. |

### Bewusst nicht enthalten

Laut [`docs/PRD.md`](docs/PRD.md) → Nicht-Ziele:

- mehrere Verwalter pro Bildungsträger
- eine Oberfläche für den Anbieter: Kontingente ändert er direkt in der Supabase-Tabellenansicht (`training_providers.license_quota`)
- eine Anmeldung der Teilnehmer in der Lizenzzentrale
- die Kopplung an ein Lernkonto der Plattform

---

Entwickelt mit dem AI Engineering Kit von Alex Sprogis (MIT-Lizenz).
