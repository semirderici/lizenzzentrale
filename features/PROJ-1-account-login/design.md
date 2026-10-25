# PROJ-1: Konto & Login — Technisches Design

> Das technische Design (das WIE) für dieses Feature. Es hat zwei Leser: den Betreiber, der es freigibt, und `/build`, das danach baut. Es enthält keinen Code, ist aber so genau, dass beim Bauen niemand raten muss.
> Zuständig: `/architecture`. Der Vertrag (das WAS) steht in `spec.md`, die Aufgabenliste in `tasks.md`.
> Kein Status- oder Datumsfeld: Der Status steht nur in `features/INDEX.md`.

## Überblick

- **Alles, was mit Zugangsdaten zu tun hat, läuft über den Server der App.** Registrieren und Anmelden sind Server Actions, Abmelden ist ein nativer POST an `/sign-out`. Der Browser spricht nie selbst mit Supabase Auth.
- **Die Bot-Prüfung ist Cloudflare Turnstile, und die App prüft das Token selbst.** Danach ruft der Server Supabase mit dem geheimen Server-Schlüssel auf. Den nimmt Supabase vom eigenen CAPTCHA aus.
- **Supabases eigenes CAPTCHA läuft mit Cloudflares Test-Secret, das immer scheitert.** Damit lehnt Supabase jede Registrierung und jeden Passwort-Login mit dem öffentlichen Schlüssel ab. Wer am Formular vorbei direkt zu Supabase geht, kommt nicht durch. Jeder Rateversuch und jede Registrierung läuft also durch die Bremsen der App (AC-6, AC-7, AC-8).
- **Beide Bremsen liegen in Postgres** im Schema `private`, das über die API nicht erreichbar ist. Zugriff gibt es nur über Funktionen, die allein der Server-Schlüssel aufrufen darf.
- **Bildungsträger und Mitgliedschaft entstehen per Datenbank-Trigger in derselben Transaktion wie das Konto.** Das Kontingent ist der Standardwert der Spalte (5). Aus den Registrierungsdaten übernimmt der Trigger nur den Namen.
- **Die Datentrennung wird zweifach durchgesetzt.** In der App liest ein Wächter Träger und Mitgliedschaft der Sitzung. In der Datenbank sorgen Row Level Security und entzogene Rechte dafür, dass ein Verwalter nur eigene Zeilen liest und gar nichts schreibt.
- **Namensregel:** Alles, was nur die eigenständige Lizenzzentrale braucht, trägt `license_center_` im Namen: Login-Bremse, Aufräumjob, Trigger auf `auth.users`. Es wandert nicht in die Plattform und kollidiert dort nicht mit deren `login_attempts`, `handle_new_user` oder `on_auth_user_created`. Die Fachtabellen `training_providers` und `training_provider_members` heißen ohne Vorsilbe, weil sie später mitwandern.

## Komponentenstruktur (Component Structure)

### Seiten und Rahmen

```
Wurzel-Layout (Sprache Deutsch, Schrift Inter, Tokens aus docs/design-system.md, Toaster)
+-- Rahmen abgemeldet — (auth)/layout
|   +-- zentrierte Karte (Smartphone: volle Breite mit Seitenrand; ab md: max. ca. 400 px)
|   +-- Produktname „Lizenzzentrale“ oben in der Karte
|   |
|   +-- /login
|   |   +-- Hinweisbox „Bitte melden Sie sich erneut an.“ — nur bei ?reason=session (EC-6)
|   |   +-- Formular: E-Mail-Adresse · Passwort · Bot-Prüfung (Turnstile)
|   |   +-- Formularfehler (Hinweisbox über dem Knopf)
|   |   +-- Knopf „Anmelden“ (volle Breite)
|   |   +-- Link „Noch kein Konto? Registrieren“ → /register
|   |
|   +-- /register
|       +-- Formular: Name des Bildungsträgers · E-Mail-Adresse ·
|       |   Passwort (darunter schon vor der Eingabe: „Mindestens 8 Zeichen.“) ·
|       |   Passwort wiederholen · Bot-Prüfung (Turnstile)
|       +-- Formularfehler (bei AC-3 mit Link „Zum Login“)
|       +-- Knopf „Registrieren“ (volle Breite)
|       +-- Link „Schon registriert? Anmelden“ → /login
|
+-- Rahmen angemeldet — (app)/layout, mit Wächter
|   +-- Kopfzeile
|   |   +-- links „Lizenzzentrale“
|   |   +-- rechts Name des Bildungsträgers (eine Zeile, gekürzt, reiner Text) · Knopf „Abmelden“
|   +-- zugeordnet → /licenses
|   |   +-- Titel „Lizenzübersicht“ (type-title)
|   |   +-- Platzhaltersatz „Hier sehen Sie bald Ihr Kontingent und verwalten die Lizenzen Ihres Bildungsträgers.“
|   +-- nicht zugeordnet (EC-5)
|       +-- Kopfzeile ohne Trägernamen, „Abmelden“ bleibt
|       +-- Hinweisbox mit der Meldung aus EC-5, sonst kein Inhalt
|
+-- /           → leitet weiter (angemeldet: /licenses, abgemeldet: /login)
+-- /sign-out   → nur POST, beendet die Sitzung
```

Seitentitel im Browser: „Anmelden – Lizenzzentrale“, „Registrieren – Lizenzzentrale“, „Lizenzübersicht – Lizenzzentrale“.

### Regeln für die Formulare

- **Felder:** Beschriftung darüber, Fehlertext darunter mit Symbol, 44 px hoch, 16 px Schrift (`docs/design-system.md`). Der Fehler steht nie nur als rote Rahmenfarbe da.
- **Autovervollständigen:** Trägername „organization“, E-Mail „email“, Login-Passwort „current-password“, beide Passwortfelder der Registrierung „new-password“. Die E-Mail-Felder haben den Typ E-Mail.
- **Feldfehler** aus der Eingabeprüfung erscheinen schon im Browser, dieselben Regeln prüft der Server noch einmal.
- **Formularfehler** vom Server stehen in einer Hinweisbox (shadcn `alert`, Variante für Fehler, mit `role="alert"`) direkt über dem Knopf. Für Formularfehler gibt es keine Toasts, weil sie stehen bleiben müssen.
- **Knopf gesperrt,** solange die Bot-Prüfung kein gültiges Token hat oder gerade gesendet wird (EC-1, EC-8). Während des Sendens trägt er `aria-busy`.
- **Nach einem Fehler vom Server** werden beide Passwortfelder geleert. Trägername und E-Mail-Adresse bleiben stehen (AC-2, EC-3, EC-9).
- **Absenden:** Die Formulare rufen ihre Server Action per POST auf. Zusätzlich tragen sie `method="post"`, damit ein Absenden vor dem Laden des Skripts nie Zugangsdaten in die Adresse schreibt. Da der Knopf ohne Token gesperrt ist, kann das ohnehin nicht passieren.
- **Erfolg:** Die Action leitet auf `/licenses` weiter. Das Formular behandelt diese Weiterleitung nie als Fehler. Es zeigt also kein „Keine Verbindung“, wenn Next.js beim Weiterleiten den Aufruf intern abbricht (Lehre aus der Plattform).

### Bot-Prüfung (Turnstile-Widget)

- Modus „Managed“: Cloudflare entscheidet, meist ist kein Klick nötig. Sprache Deutsch, das Farbschema folgt dem Gerät, volle Breite der Karte. Die Höhe ist vorab reserviert, damit nichts springt.
- **Laden nur bei Bedarf:** Das Skript von Cloudflare lädt nur auf `/login` und `/register`. Im Wurzel-Layout, im angemeldeten Bereich und auf `/` gibt es kein Skript, keine Vorab-Verbindung und kein Vorladen zu Cloudflare.
- **Ein Token gilt nur einmal und höchstens 5 Minuten.** Ein abgelaufenes Token holt das Widget selbst neu. Nach jedem Absenden, das mit einem Fehler zurückkommt, wird das Widget zurückgesetzt. Bis das neue Token da ist, ist der Knopf gesperrt.
- **Lädt die Prüfung nicht (EC-8):** In drei Fällen erscheint die Meldung aus EC-8 in der Hinweisbox, und der Knopf bleibt gesperrt: Das Skript lässt sich nicht laden (z. B. Werbeblocker), das Widget meldet einen Fehler, oder es ist nach 15 Sekunden noch nicht sichtbar.

### Kopfzeile (EC-10)

- Der Trägername wird als reiner Text ausgegeben, nie als HTML.
- Er steht in einer Zeile und wird mit „…“ gekürzt, wenn der Platz nicht reicht. Der volle Name steht beim Überfahren als Hinweistext.
- „Abmelden“ schrumpft nie und bleibt auf jeder Breite sichtbar. Es ist ein Knopf in einem eigenen kleinen Formular, das per POST an `/sign-out` sendet, Tippfläche mindestens 44 × 44 px.

## Code-Struktur (Code Structure)

Nach dem Next.js-Pack (`docs/stacks/framework-nextjs.md` → Code structure). Die Umsetzung liegt in `src/features/account/`. Routen und Layouts in `src/app/` hängen sie nur ein.

| Modul / Pfad | Aufgabe und Schnittstelle | Erlaubte Abhängigkeiten |
| --- | --- | --- |
| `src/features/account/account.schema.ts` (pure) | Eingaberegeln für Registrierung und Login, eine Quelle für Browser und Server: Normalisierung, Grenzen, Feldmeldungen | Zod, `account.rules.ts` |
| `src/features/account/account.rules.ts` (pure) | Alle Meldungstexte an einer Stelle. Restminuten als Text („1 Minute“ / „X Minuten“). IP-Adresse aus den Kopfwerten. Ergebnis eines Ablaufs → Meldung. | keine (nur andere pure Module) |
| `src/features/account/turnstile.integration.ts` (server-only) | Prüft ein Token bei Cloudflare: „bestanden“, „abgelehnt“ oder „Fehler“ | `server-only`, `fetch` |
| `src/features/account/throttle.data.ts` (server-only) | Ruft die fünf Bremsfunktionen der Datenbank auf (siehe „Login-Bremse“, „Registrierungsbremse“) | Admin-Client |
| `src/features/account/auth.data.ts` (server-only) | Registrieren und Passwort prüfen über den Admin-Client. Die gelieferte Sitzung wird in die Cookies der Nutzersitzung übernommen. Dazu kommt das Abmelden. | Admin-Client, Server-Client |
| `src/features/account/session.data.ts` (server-only) | `getCurrentAdmin()` und `requireTrainingProvider()` (siehe „Wächter“), pro Anfrage zwischengespeichert. **Das ist die Schnittstelle für PROJ-2.** | Server-Client |
| `src/features/account/account.actions.ts` (`'use server'`) | `register` und `login`: prüfen, Bremsen, Supabase, Mindestantwortzeit, Weiterleitung | alle Module oben |
| `src/features/account/components/` | `register-form.tsx`, `login-form.tsx`, `bot-check.tsx` (Client) und `unassigned-notice.tsx` (EC-5) | Schema, Regeln, Actions, shadcn — **nie** die `*.data.ts`-Module |
| `src/lib/supabase/admin.ts` (neu, server-only) | Client mit dem geheimen Server-Schlüssel. Er speichert keine Sitzung und setzt keine Cookies. Er wird **nur** für die Bremsfunktionen, das Registrieren und die Passwortprüfung benutzt, nie zum Lesen von Träger- oder Mitgliedsdaten. | `@supabase/supabase-js` |
| `src/lib/supabase/cookie-options.ts` (neu) | Die Cookie-Regeln der Sitzung (siehe „Sitzung“), gemeinsam für Server-Client und Tor | — |
| `src/lib/supabase/server.ts` (vorhanden) | Bekommt die Cookie-Regeln dazu | `cookie-options.ts` |
| `src/proxy.ts` (neu) | Tor: Sitzung auffrischen, Weiterleitungen (siehe „Tor“) | `@supabase/ssr`, `cookie-options.ts` |
| `src/components/app-header.tsx` (neu, geteilt) | Kopfzeile. Bekommt den Trägernamen als Wert (oder keinen) und importiert nichts aus `src/features`. | shadcn `button` |
| `src/app/layout.tsx` (anpassen) | `lang="de"`, Inter über `next/font`, Titel „Lizenzzentrale“, Toaster | — |
| `src/app/globals.css` (anpassen) | Tokens und Textrollen aus `docs/design-system.md` (Auftrag dort an den ersten `/build`) | — |
| `src/app/page.tsx` (ersetzen) | Leitet weiter, als Rückfall, falls das Tor nicht greift | `session.data.ts` |
| `src/app/(auth)/layout.tsx`, `(auth)/login/page.tsx`, `(auth)/register/page.tsx` | Rahmen abgemeldet und die zwei Formularseiten | Feature-Bauteile |
| `src/app/(app)/layout.tsx`, `(app)/licenses/page.tsx` | Rahmen angemeldet mit Wächter; Platzhalterseite | `session.data.ts`, `app-header.tsx` |
| `src/app/sign-out/route.ts` | Abmelden, nur POST | `auth.data.ts` |
| `next.config.ts` (anpassen) | siehe Technische Entscheidungen | — |

Tests liegen neben dem Modul, das sie prüfen. Datenbanktests (Regeln, Trigger, Bremse) liegen in `src/test/` oder neben `throttle.data.ts`; das entscheidet `/tasks`.

## Footprint

- **Code und Tests:** die Module der Tabelle oben, mit Tests daneben. Dazu ein Abschnitt in `README.md`: „Supabase und Bot-Prüfung einrichten“ mit den Einstellungen, den Testschlüsseln und den Befehlen für die Migrationen. So kommt der Prüfer ohne Nachfrage durch.
- **Migrationen, Tabellen, Regeln:**
  - `supabase/migrations/<Zeit>_proj1_training_providers.sql` — `public.training_providers`, `public.training_provider_members`, Leseregeln, ausdrücklich gesetzte Rechte, Trigger für Anlage und für den letzten Verwalter
  - `supabase/migrations/<Zeit>_proj1_login_throttle.sql` — Schema `private`, drei Tabellen der Bremsen, fünf Funktionen, Trigger beim Löschen eines Kontos
  - `supabase/migrations/<Zeit>_proj1_cleanup_job.sql` — `pg_cron`, Aufräumfunktion, stündlicher Job
- **Umgebungsvariablen** (nur Namen):
  - neu: `SUPABASE_SERVICE_ROLE_KEY` (geheim), `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (öffentlich), `TURNSTILE_SECRET_KEY` (geheim)
  - vorhanden: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **Pakete:** `@marsidev/react-turnstile` (neu). Datenbank-Erweiterung `pg_cron`.
- **Einhängepunkte:** Tor `src/proxy.ts`, Rahmen `(auth)` und `(app)`, Kopfzeile, `/sign-out`, Wurzel-Layout. Externer Dienst: Cloudflare Turnstile.

## Datenmodell (Data Model)

### Bildungsträger — `public.training_providers`

| Feld | Typ und Regeln |
|---|---|
| `id` | UUID, von der Datenbank erzeugt, Primärschlüssel |
| `name` | Text, Pflicht. Gespeichert ohne Leerzeichen am Rand, 2 bis 100 Zeichen. Gezählt wird wie bei Postgres `char_length`, also in Unicode-Zeichen. Die App zählt genauso. Nicht eindeutig (Produktentscheidung der Spec). |
| `license_quota` | ganze Zahl, Pflicht, Standard **5**, mindestens 0 |
| `created_at` | Zeitpunkt, Standard: jetzt |

- **Angelegt:** nur vom Registrierungs-Trigger. Er setzt nur den Namen, das Kontingent ist immer der Standard.
- **Geändert:** Name und Kontingent ändert nur der Anbieter in der Supabase-Tabellenansicht, nie die App.
- **Gelesen:** von den Verwaltern dieses Trägers.
- **Aufbewahrung:** bis der Anbieter den Träger oder das Konto des letzten Verwalters löscht.

### Mitgliedschaft — `public.training_provider_members`

| Feld | Typ und Regeln |
|---|---|
| `training_provider_id` | Verweis auf `training_providers`, Pflicht. Wird der Träger gelöscht, verschwindet die Mitgliedschaft mit. |
| `user_id` | Verweis auf das Supabase-Konto (`auth.users`), Pflicht, **eindeutig**: heute gehört ein Konto zu genau einem Träger. Wird das Konto gelöscht, verschwindet die Mitgliedschaft mit. |
| `role` | Text, einer von: `admin` (= Verwalter). Standard `admin`. |
| `created_at` | Zeitpunkt, Standard: jetzt |

- **Schlüssel:** (`training_provider_id`, `user_id`). Mehrere Verwalter pro Träger brauchen später keinen Umbau. Erst wenn ein Konto zu mehreren Trägern gehören soll, fällt die Eindeutigkeit von `user_id` weg.
- **Angelegt:** nur vom Registrierungs-Trigger. **Geändert:** nie über die App.
- **Gelesen:** nur die eigene Zeile.
- **Aufbewahrung:** wie das Konto bzw. der Träger.

### Login-Bremse und Registrierungsbremse — Schema `private`

Nur für die eigenständige Lizenzzentrale, wandert nicht in die Plattform. Über die Daten-API nicht erreichbar, RLS an, keine Regeln für `anon` und `authenticated`. Gelesen und geschrieben wird nur über die Funktionen unter „Abläufe und Zugriff“.

**`private.license_center_login_attempts`** — ein Eintrag pro Login-Versuch, der bis zur Passwortprüfung kam

| Feld | Typ und Regeln |
|---|---|
| `id` | fortlaufende Zahl |
| `email` | Text, Pflicht, normalisiert (ohne Leerzeichen am Rand, kleingeschrieben), höchstens 254 Zeichen. Auch Adressen ohne Konto werden eingetragen. |
| `ip_address` | IP-Adresse, Pflicht |
| `outcome` | einer von: `pending` (Prüfung läuft), `success`, `failure`, `error` |
| `attempted_at` | Zeitpunkt, Standard: jetzt |

**`private.license_center_login_lockouts`** — aktuelle oder letzte Sperre und Zählbeginn pro Schlüssel

| Feld | Typ und Regeln |
|---|---|
| `scope` | einer von: `account` (E-Mail-Adresse), `ip` |
| `subject` | Text: die normalisierte E-Mail-Adresse bzw. die IP-Adresse als Text |
| `locked_until` | Zeitpunkt oder leer |
| `count_from` | Zeitpunkt („Zählen ab“). Fehlversuche davor zählen nicht. Standard: minus unendlich |

Der Schlüssel ist (`scope`, `subject`).

**`private.license_center_registration_attempts`** — ein Eintrag pro Registrierung, die bis zu Supabase kam

| Feld | Typ und Regeln |
|---|---|
| `id` | fortlaufende Zahl |
| `ip_address` | IP-Adresse, Pflicht |
| `outcome` | einer von: `pending`, `success`, `duplicate` (Adresse schon registriert), `error` |
| `attempted_at` | Zeitpunkt, Standard: jetzt |

Keine E-Mail-Adresse, weil die Bremse sie nicht braucht (Datensparsamkeit).

**Indizes** (Zweck, nicht Syntax): Login-Versuche nach E-Mail und Zeit sowie nach IP und Zeit. Registrierungen nach IP und Zeit. Alle drei Tabellen nach Zeit für den Aufräumjob.

**Aufbewahrung (AC-13):**
- Der stündliche Aufräumjob löscht Login-Versuche und Registrierungen, die älter als **23 Stunden** sind. So wird kein Eintrag 24 Stunden alt.
- Sperren löscht er, sobald sie keine Wirkung mehr haben: Sperre und Zählbeginn liegen beide mehr als 15 Minuten zurück.
- Wird ein Konto gelöscht, verschwinden die Login-Versuche und die Kontosperre dieser Adresse sofort (AC-12).

### Was Supabase selbst speichert

- `auth.users`: E-Mail-Adresse, Passwort-Hash, Zeitstempel. Die Registrierungsdaten (`raw_user_meta_data`) behalten den Trägernamen. Die App liest Nutzer-Metadaten nach der Anlage nie wieder; Name und Rechte kommen nur aus den Tabellen oben.
- `auth.sessions` und Refresh-Tokens: bis zum Abmelden bzw. bis zur Kontolöschung.
- Audit-Log: **nicht in der Datenbank** (Einstellung „Write audit logs to the database“ aus). Supabase hält es in seinem Log-Speicher nur so lange, wie der Tarif vorsieht.

## Abläufe und Zugriff (Behaviors & Access)

### Grundsätze

1. Eingaben prüft der Server immer selbst, mit denselben Regeln wie der Browser (AC-2).
2. Rechte kommen nur aus der Mitgliedschaft, nie aus Daten, die der Nutzer mitschickt, und nie aus dem Anmelde-Token.
3. Der geheime Server-Schlüssel steckt nur im Admin-Client: nie in einer Variablen mit `NEXT_PUBLIC_`, nie in einem Client-Bauteil.
4. Jede Anfrage ohne bestandene Bot-Prüfung wird abgelehnt. Kann die App die Prüfung nicht durchführen (Cloudflare nicht erreichbar, Secret fehlt), gilt sie als nicht bestanden.

### Eingaberegeln (ein Schema für Browser und Server)

Jedes Textfeld wird vor allen anderen Regeln auf höchstens 1.000 Zeichen begrenzt; mehr ergibt den Feldfehler der jeweiligen Obergrenze.

| Feld | Regel | Meldung |
|---|---|---|
| Name des Bildungsträgers | Leerzeichen am Rand entfernen, dann 2 bis 100 Zeichen | leer: „Bitte geben Sie den Namen Ihres Bildungsträgers ein.“ · zu kurz: „Der Name muss mindestens 2 Zeichen lang sein.“ · zu lang: „Der Name darf höchstens 100 Zeichen lang sein.“ |
| E-Mail-Adresse (beide Formulare) | Leerzeichen am Rand entfernen, kleinschreiben, dann gültiges E-Mail-Format, höchstens 254 Zeichen (EC-4) | leer: „Bitte geben Sie Ihre E-Mail-Adresse ein.“ · ungültig: „Bitte geben Sie eine gültige E-Mail-Adresse ein.“ |
| Passwort (Registrierung) | nichts kürzen, nichts entfernen (EC-4). Mindestens 8 und höchstens 72 Zeichen, **zusätzlich höchstens 72 Bytes**: Supabase nimmt mehr nicht an, Umlaute zählen doppelt. Keine Pflicht zu bestimmten Zeichenarten. | zu kurz: „Das Passwort muss mindestens 8 Zeichen lang sein.“ · über 72 Zeichen: „Das Passwort darf höchstens 72 Zeichen lang sein.“ · über 72 Bytes: „Das Passwort ist zu lang, weil Umlaute und andere besondere Zeichen mehrfach zählen. Bitte kürzen Sie es.“ |
| Passwort wiederholen | muss genau gleich sein | leer: „Bitte wiederholen Sie das Passwort.“ · abweichend: „Die Passwörter stimmen nicht überein.“ |
| Passwort (Login) | nur Pflicht. Über 72 Zeichen oder 72 Bytes: kein Feldfehler, sondern die Meldung aus AC-5 (siehe Anmelden) | leer: „Bitte geben Sie Ihr Passwort ein.“ |
| Turnstile-Token (beide) | Pflicht, höchstens 2.048 Zeichen (Cloudflares Höchstlänge) | fehlt oder zu lang: Formularfehler „Die Sicherheitsprüfung ist fehlgeschlagen. Bitte versuchen Sie es erneut.“ |

Die Passwortregel „Mindestens 8 Zeichen.“ steht schon vor der Eingabe unter dem Passwortfeld der Registrierung (AC-2).

### IP-Adresse des Besuchers

- Es zählt der **letzte** gültige Eintrag im Kopf `X-Forwarded-For`. Das ist der, den der Proxy des Hosts anhängt. Einträge davor kommen vom Client und zählen nie, `X-Real-IP` auch nicht (Lehre aus Plattform BUG-2).
- Lokal ohne Proxy setzt Next.js die Adresse der Verbindung, wenn der Kopf fehlt.
- Kein gültiger Eintrag → Ersatzadresse `0.0.0.0`.
- An Cloudflare geht die IP nur mit, wenn sie öffentlich ist: nicht `0.0.0.0`, nicht Loopback und kein privates Netz.

### Registrieren (AC-1 bis AC-3, AC-7, AC-8, EC-1 bis EC-4, EC-9)

1. **Eingaben prüfen** nach der Tabelle oben. Fehler → Feldfehler, nichts wird gezählt oder angelegt.
2. **Bot-Prüfung** bei Cloudflare mit dem Token und der IP:
   - abgelehnt → Formularfehler „Die Sicherheitsprüfung ist fehlgeschlagen. …“, Widget zurücksetzen (AC-7)
   - Fehler (keine Antwort, kein Secret) → Meldung aus EC-3
3. **Registrierungsbremse:** `license_center_begin_registration(IP)`.
   - gesperrt → Meldung aus AC-8, es wird nichts gespeichert
   - erlaubt → die Antwort enthält eine Versuchsnummer
4. **Registrierung bei Supabase** über den Admin-Client: normalisierte E-Mail-Adresse, Passwort unverändert, in den Registrierungsdaten `training_provider_name` (der getrimmte Name). Supabase legt das Konto an. In derselben Transaktion legt der Trigger Träger und Mitgliedschaft an. Weil die Bestätigung aus ist, liefert Supabase sofort eine Sitzung.
5. **Ergebnis:**
   - **Erfolg:** Versuch → `success`. Die Sitzung wird in die Cookies übernommen, Weiterleitung auf `/licenses` (AC-1).
   - **Adresse schon registriert** (Supabase meldet „User already registered“ bzw. „email exists“): Versuch → `duplicate`, Meldung aus AC-3 mit Link „Zum Login“. Es entsteht nichts.
   - **Supabase lehnt wegen seiner eigenen Grenze ab:** Versuch → `error`, Meldung aus AC-8.
   - **Supabase lehnt das Passwort ab:** nur ein Sicherheitsnetz, das Schema fängt das vorher. Versuch → `error`, Feldfehler am Passwort.
   - **Jeder andere Fehler** (Supabase nicht erreichbar, allgemeiner 500er, Trigger abgelehnt): Der Server fragt `license_center_email_registered(E-Mail)`.
     - Die Adresse ist registriert → Versuch `duplicate`, Meldung aus AC-3. Das ist der Verlierer bei zwei gleichzeitigen Registrierungen (EC-2): Supabase liefert dann einen allgemeinen 500er.
     - Die Adresse ist nicht registriert, oder die Nachfrage scheitert → Versuch `error`, Meldung aus EC-3.
6. **Keine Antwort vom App-Server** (Verbindung weg) → das Formular zeigt die Meldung aus EC-9.

Die Registrierung bekommt keine Mindestantwortzeit: AC-3 verrät ohnehin, ob eine Adresse registriert ist (Produktentscheidung der Spec).

### Anmelden (AC-4 bis AC-7, EC-4, EC-7, EC-9)

1. **Eingaben prüfen.** Ist das Passwort länger als 72 Zeichen oder 72 Bytes, kann es nie stimmen: Meldung aus AC-5, ohne Bot-Prüfung, Bremse und Supabase, und es zählt nicht als Fehlversuch (Lehre aus Plattform BUG-16).
2. **Bot-Prüfung** wie beim Registrieren. Fehler → „Die Anmeldung ist fehlgeschlagen. Bitte versuchen Sie es erneut.“ Die Bot-Prüfung kommt vor der Bremse: Ohne gelöstes CAPTCHA kann niemand Fehlversuche auslösen und damit fremde Adressen sperren.
3. **Login-Bremse:** `license_center_begin_login(E-Mail, IP)`.
   - gesperrt → Meldung aus AC-6 mit der Restzeit
   - erlaubt → die Antwort enthält eine Versuchsnummer
4. **Passwort prüfen** über den Admin-Client (Passwort-Login bei Supabase, ohne Cookies).
5. **Ergebnis:**
   - **Richtig:** `license_center_finish_login(Nr., success)`. Das setzt die Zählung dieser Adresse zurück (EC-7). Die Sitzung wird in die Cookies übernommen, Weiterleitung auf `/licenses` (AC-4).
   - **Falsch oder unbekannte Adresse** (Supabase unterscheidet das nicht): `finish … failure`, Meldung aus AC-5. Der fünfte Fehlversuch setzt die Sperre. Er selbst zeigt noch AC-5, erst der nächste Versuch zeigt die Sperrmeldung.
   - **Supabase lehnt wegen seiner eigenen Grenze ab:** `finish … error`, Meldung aus AC-6 mit „5 Minuten“.
   - **Supabase nicht erreichbar oder unbekannter Fehler:** `finish … error`, „Die Anmeldung ist fehlgeschlagen. Bitte versuchen Sie es erneut.“
   - Die E-Mail-Adresse bleibt in jedem Fehlerfall im Feld.
6. **Mindestantwortzeit:** Jede Antwort außer dem Erfolg kommt frühestens **1 Sekunde** nach dem Eingang der Anfrage. So unterscheiden sich unbekannte und bekannte Adressen nicht in der Antwortzeit (Technische Anforderungen, ergänzt AC-5; Lehre aus Plattform BUG-5).

### Login-Bremse im Detail (AC-6, AC-13, EC-4, EC-7)

- **Schlüssel:** die normalisierte E-Mail-Adresse, auch ohne Konto dazu, und die IP-Adresse.
- **Was zählt:** Einträge mit `failure` und noch laufende Prüfungen (`pending`). Sie zählen in den letzten 15 Minuten, aber nie vor „Zählen ab“. `success` und `error` zählen nie.
- **`license_center_begin_login(E-Mail, IP)`:**
  - normalisiert die E-Mail-Adresse noch einmal selbst. Fehlt die IP oder ist die Adresse leer oder länger als 254 Zeichen, bricht die Funktion mit einem Fehler ab.
  - läuft pro Adresse und pro IP nacheinander ab (Sperre in der Datenbank auf den Schlüssel, immer erst Adresse, dann IP, damit sich zwei Anfragen nie gegenseitig blockieren).
  - Ist für Adresse oder IP eine Sperre aktiv → „gesperrt bis <Zeitpunkt>“. Bei zwei Sperren zählt die spätere. Nichts wird gespeichert.
  - Erreicht die Zählung schon 5 für die Adresse oder 20 für die IP, ohne dass eine Sperre gesetzt ist, laufen gerade mehrere Prüfungen gleichzeitig. Dann gilt „gesperrt bis jetzt + 15 Minuten“, und nichts wird gespeichert. Die Meldung nennt also 15 Minuten, nicht 1 Minute (Lehre aus Plattform BUG-33).
  - Sonst → Eintrag `pending`, Antwort „erlaubt“ mit Versuchsnummer.
- **`license_center_finish_login(Nr., Ergebnis)`:** Ergebnis ist `success`, `failure` oder `error`. Nur für einen Eintrag, der noch `pending` ist, sonst Fehler. Dieselbe Reihenfolge der Sperren wie oben.
  - `failure`: Erreicht die Zählung für die Adresse 5, ist die Adresse bis jetzt + 15 Minuten gesperrt, und „Zählen ab“ springt auf das Ende der Sperre. Erreicht die Zählung für die IP 20, gilt dasselbe für die IP.
  - `success`: „Zählen ab“ der Adresse wird auf jetzt gesetzt (EC-7). Die IP-Zählung bleibt.
- **Meldung:** Die Restzeit wird in ganzen Minuten aufgerundet, mindestens 1 („in 1 Minute“, sonst „in X Minuten“). Der Text ist für Adress- und IP-Sperre gleich, auch für Adressen ohne Konto.
- **Nie dauerhaft:** Jede Sperre endet nach 15 Minuten. Danach beginnt die Zählung neu (AC-6).
- **Am Formular vorbei:** Supabase lehnt jeden Passwort-Login mit dem öffentlichen Schlüssel ab (CAPTCHA mit scheiterndem Secret). Den Server-Schlüssel hat nur die App, und die prüft immer erst die Bremse.

### Registrierungsbremse (AC-8)

- **Schlüssel:** die IP-Adresse.
- **Was zählt:** Einträge mit `pending`, `success` oder `duplicate` in den letzten 60 Minuten. Treffer auf schon registrierte Adressen zählen also mit, damit die Bremse auch das Ausprobieren von Adressen bremst (AC-8). `error` zählt nicht.
- **`license_center_begin_registration(IP)`:** pro IP nacheinander (eigene Sperre auf den Schlüssel). 5 oder mehr → „gesperrt“, nichts wird gespeichert. Sonst → Eintrag `pending`, Antwort „erlaubt“ mit Nummer.
- **`license_center_finish_registration(Nr., Ergebnis)`:** Ergebnis ist `success`, `duplicate` oder `error`. Nur für einen Eintrag, der noch `pending` ist.
- **`license_center_email_registered(E-Mail)`:** ja/nein, ob es ein Konto mit dieser normalisierten Adresse gibt. Nur für den unklaren Fehlerfall beim Registrieren (EC-2).

Alle fünf Funktionen liegen im Schema `public`, laufen mit den Rechten ihres Eigentümers (security definer) und mit festem, leerem Suchpfad. Aufrufen darf sie **nur** `service_role`: `public`, `anon` und `authenticated` wird das Recht entzogen, `service_role` bekommt es ausdrücklich (Rechte-Regel unter „Zugriffsregeln in der Datenbank“).

### Sitzung

- Die Cookies der Sitzung schreibt `@supabase/ssr`. Die App setzt bei jedem Cookie, im Server-Client und im Tor:
  - **HttpOnly** (ein eingeschleustes Skript kann die Sitzung nicht lesen)
  - **SameSite=Lax**
  - **Secure** außer bei einer Verbindung über `http` (lokal)
- Die Lebensdauer bleibt, wie Supabase sie setzt. Die Cookies sind also dauerhaft, keine Sitzungscookies, und überstehen das Schließen des Browsers (AC-10).
- Supabase lässt die Sitzung laufen, bis abgemeldet wird; Refresh-Token-Rotation bleibt an (Standard).
- Folge: Der Browser-Client (`src/lib/supabase/client.ts`) sieht keine Sitzung. PROJ-2 und PROJ-3 arbeiten über den Server.

### Tor (`src/proxy.ts`, AC-9, EC-6)

- Läuft bei jeder Anfrage außer den statischen Dateien von Next.js und Bildern.
- Frischt die Sitzung auf und fragt den Auth-Server (`getUser`), ob sie noch besteht. Eine beendete Sitzung greift so sofort, nicht erst nach Ablauf des Zugriffstokens: Abmelden im anderen Tab, Konto gelöscht.
- **Weiterleitungen nur bei GET und HEAD.** Server Actions und `/sign-out` (POST) prüfen selbst.
  - `/` → angemeldet `/licenses`, sonst `/login`
  - `/login`, `/register` → angemeldet `/licenses`, sonst durchlassen
  - jede andere Adresse ohne Sitzung → `/login?reason=session`
- Die Weiterleitung passiert, bevor eine Seite gerendert wird. Geschützte Inhalte erscheinen also nie, auch nicht kurz (AC-9).

### Wächter (`session.data.ts`) — auch für PROJ-2

- **`getCurrentAdmin()`** liefert genau einen von drei Zuständen:
  - **abgemeldet:** Der Auth-Server kennt keine gültige Sitzung.
  - **nicht zugeordnet:** Es gibt eine Sitzung, aber keine lesbare Mitgliedschaft. Mitgeliefert wird die Konto-ID.
  - **zugeordnet:** Konto-ID, Rolle und Träger (ID, Name, Kontingent), gelesen mit der Nutzersitzung, also durch die Leseregeln.
- **`requireTrainingProvider()`**:
  - Bei „abgemeldet“ leitet es auf `/login?reason=session` weiter.
  - Sonst liefert es „zugeordnet“ mit Träger oder „nicht zugeordnet“.
  - Seiten zeigen bei „nicht zugeordnet“ nichts, die Hinweisbox kommt aus dem Rahmen.
  - Aktionen brechen bei „nicht zugeordnet“ mit der Meldung aus EC-5 ab, ohne etwas zu lesen oder zu schreiben.
- Beide werden pro Anfrage nur einmal ausgeführt, Rahmen und Seite teilen sich das Ergebnis.
- **Pflicht:** Der Rahmen `(app)` **und** jede Seite **und** jede Server Action im angemeldeten Bereich rufen den Wächter auf. Das Tor allein reicht nie.
- Seiten im angemeldeten Bereich werden immer dynamisch gerendert. Sie lesen Cookies, also schickt Next.js `Cache-Control: no-store`. Kein Browser hält eine geschützte Seite zum Zurückblättern vor (AC-10).

### Abmelden (`/sign-out`, AC-10, EC-6)

- Nur POST. Andere Methoden → 405. Ein Link, ein Vorladen oder ein fremdes Bild können also nicht abmelden. Cookies mit SameSite=Lax gehen bei einem POST von einer fremden Seite ohnehin nicht mit.
- **Mit Sitzung:** Supabase-Abmelden mit Scope `local` (nur diese Sitzung). Die Cookies werden gelöscht, dann 303 auf `/login`.
- **Ohne Sitzung** (z. B. schon im anderen Tab abgemeldet): 303 auf `/login?reason=session` (EC-6).
- Weil das Formular nativ sendet, lädt der Browser `/login` komplett neu. Es bleibt kein Zwischenspeicher der App im Speicher. „Zurück“ fordert `/licenses` neu an und landet über das Tor beim Login (AC-10).

### Hinweis nach beendeter Sitzung (EC-6)

- `/login` zeigt den Hinweis „Bitte melden Sie sich erneut an.“ nur, wenn `reason` genau `session` ist. Jeder andere Wert wird ignoriert.
- Angezeigt wird ein fester Text, der Wert aus der Adresse erscheint nie auf der Seite.

### Zugriffsregeln in der Datenbank (AC-11)

| Tabelle | `anon` | `authenticated` | `service_role` |
|---|---|---|---|
| `training_providers` | keine Rechte | nur Lesen, und nur Zeilen, zu denen eine Mitgliedschaft des Aufrufers besteht | Lesen, Anlegen, Ändern, Löschen (nur Server und Tests, RLS gilt für diese Rolle nicht) |
| `training_provider_members` | keine Rechte | nur Lesen, und nur die Zeile mit der eigenen Konto-ID | wie bei `training_providers` |
| alles in `private` | keine Rechte | keine Rechte | keine Rechte, nur über die Funktionen der Bremsen |

- **Rechte-Regel (gilt für jede Migration, auch in PROJ-2 und PROJ-3):** Jede Migration setzt die Rechte ihrer Tabellen und Funktionen ausdrücklich. Sie verlässt sich weder auf die Projekteinstellung „Automatically expose new tables“ noch auf die automatische RLS. So ist das Ergebnis in jedem Projekt gleich, ob die Einstellungen an oder aus sind, auch im frischen Projekt des Prüfers.
  - **Tabellen in `public`:** Erst alle Rechte für `anon` und `authenticated` entziehen, dann nur zurückgeben, was die Tabelle oben nennt. Auch `service_role` bekommt seine Rechte ausdrücklich, denn bei ausgeschalteter Freigabe hat sonst auch diese Rolle keine.
  - **RLS:** In jeder Tabelle ausdrücklich einschalten, auch in `private`. Die automatische RLS wirkt nur in `public` und ist nicht in jedem Projekt an.
  - **Funktionen:** Das Ausführen für `public`, `anon` und `authenticated` entziehen, dann nur der Rolle geben, die sie aufrufen darf. Das Entziehen für `public` ist immer nötig: Postgres erlaubt jede neue Funktion zunächst allen, und die Projekteinstellung ändert daran nichts.
  - **Schema `private`:** `public`, `anon` und `authenticated` bekommen keinen Zugriff auf das Schema.
  - Ein vergessenes Recht sperrt, statt zu öffnen. Weil im Entwicklungsprojekt die automatische Freigabe aus ist, fällt das schon in den Tests auf.
- Ein Schreibversuch von `anon` oder `authenticated` scheitert damit schon am fehlenden Recht, und RLS ist die zweite Sperre.
- Die Leseregeln vergleichen mit der Konto-ID aus der Sitzung, einmal pro Abfrage ausgewertet (Supabase-Best-Practice).
- Folge für AC-11: Ein Verwalter sieht nur seinen Träger und seine Mitgliedschaft. Name, Kontingent oder Mitgliedschaft ändern, sich einem anderen Träger zuordnen oder einen Träger anlegen wird abgelehnt. Ein abgemeldeter Besucher bekommt keine Zeilen.
- Der Anbieter ändert Kontingent und Namen in der Supabase-Tabellenansicht. Die arbeitet mit Eigentümerrechten, nicht mit den Rollen der App.

### Trigger

- **`license_center_on_auth_user_created`** (nach dem Anlegen eines Kontos, Funktion `private.license_center_handle_new_user`, security definer, leerer Suchpfad):
  - liest `training_provider_name` aus den Registrierungsdaten, entfernt Leerzeichen am Rand und legt den Träger nur mit diesem Namen an
  - legt die Mitgliedschaft mit der Rolle `admin` an
  - Andere Angaben in den Registrierungsdaten ignoriert er, ein mitgeschicktes Kontingent also auch (AC-1).
  - Ist der Name ungültig, verletzt er die Regel der Spalte. Dann scheitert die ganze Registrierung, und es entsteht nichts (EC-3).
- **Letzter Verwalter weg** (nach dem Löschen einer Mitgliedschaft, Funktion `private.delete_orphaned_training_provider`, security definer):
  - Hat der Träger danach keine Mitgliedschaft mehr, wird er gelöscht (AC-12), und mit ihm später alles, was ihm gehört.
  - Security definer ist nötig, weil Supabase Auth Konten mit einer eigenen Datenbankrolle löscht.
  - Er muss den Fall vertragen, dass der Träger selbst gerade gelöscht wird (EC-5: Der Anbieter löscht nur den Träger, die Mitgliedschaft fällt per Kaskade weg). Dafür gibt es einen Test.
  - Er gehört zum Fachmodell und heißt deshalb ohne Vorsilbe.
- **`license_center_on_auth_user_deleted`** (nach dem Löschen eines Kontos, Funktion `private.license_center_forget_deleted_account`, security definer): löscht die Login-Versuche und die Kontosperre dieser Adresse (AC-12).

### Löschen durch den Anbieter (AC-12, EC-5)

- **Konto löschen:** Der Anbieter löscht in Supabase unter Authentication → Users. Danach fällt die Mitgliedschaft per Kaskade weg, der Trigger löscht den Träger als letzten Verwalter, und ein zweiter Trigger löscht die Login-Einträge der Adresse. Supabases Sitzungen gehen mit dem Konto. Ein noch offener Tab landet beim nächsten Aufruf über das Tor beim Login.
- **Nur den Träger löschen** (Tabellenansicht): Die Mitgliedschaft fällt weg, das Konto bleibt. Beim nächsten Login gilt EC-5.
- Vorgabe aus der Spec für PROJ-2 und PROJ-3: Ihre Tabellen hängen per Löschkaskade am Träger.

### Aufräumjob (AC-13)

- `pg_cron`, stündlich zur vollen Stunde, Job `license-center-cleanup`, Funktion `private.license_center_cleanup`, aufrufbar nur vom Datenbank-Eigentümer.
- Er löscht:
  1. Login-Versuche, älter als 23 Stunden
  2. Registrierungen, älter als 23 Stunden
  3. Sperren ohne Wirkung: „gesperrt bis“ leer oder älter als 15 Minuten **und** „Zählen ab“ älter als 15 Minuten
- Damit ist jeder Eintrag spätestens nach 24 Stunden weg, und die Bremse hat immer die letzten 15 bzw. 60 Minuten.

### Meldungstexte

Alle Texte stehen an einer Stelle (`account.rules.ts`), in der Sie-Form.

| Anlass | Text | AC/EC |
|---|---|---|
| Adresse schon registriert | „Mit dieser E-Mail-Adresse ist bereits ein Konto registriert. Bitte melden Sie sich an.“ mit Link „Zum Login“ → `/login` | AC-3, EC-2 |
| Login falsch, Adresse unbekannt, Passwort zu lang | „E-Mail-Adresse oder Passwort ist falsch.“ | AC-5 |
| Login gesperrt | „Zu viele Anmeldeversuche. Bitte versuchen Sie es in X Minuten erneut.“ (X = 1: „in 1 Minute“) | AC-6 |
| Bot-Prüfung abgelehnt oder Token fehlt | „Die Sicherheitsprüfung ist fehlgeschlagen. Bitte versuchen Sie es erneut.“ | AC-7 |
| Registrierungen gebremst | „Zu viele Registrierungen. Bitte versuchen Sie es später erneut.“ | AC-8 |
| Registrierung: Fehler auf dem Server | „Die Registrierung ist fehlgeschlagen. Bitte versuchen Sie es erneut.“ | EC-3 |
| Login: Fehler auf dem Server | „Die Anmeldung ist fehlgeschlagen. Bitte versuchen Sie es erneut.“ | (neu, analog EC-3) |
| Keine Antwort vom App-Server | „Keine Verbindung. Bitte versuchen Sie es erneut.“ | EC-9 |
| Konto ohne Bildungsträger | „Ihr Konto ist keinem Bildungsträger zugeordnet. Bitte wenden Sie sich an den Anbieter.“ | EC-5 |
| Sitzung beendet | „Bitte melden Sie sich erneut an.“ | EC-6 |
| Bot-Prüfung lädt nicht | „Die Sicherheitsprüfung konnte nicht geladen werden. Bitte laden Sie die Seite neu.“ | EC-8 |

Dazu kommen die Feldmeldungen aus „Eingaberegeln“. Abgrenzung EC-3 gegen EC-9: Kommt keine Antwort vom App-Server an, zeigt der Browser EC-9. Antwortet der Server mit einem Fehler (auch wenn Supabase für ihn nicht erreichbar war), steht EC-3 bzw. der Login-Fehler.

### Hinweise für `/qa`

- **Zugriffstoken für AC-11:** Die Cookies sind HttpOnly. Das Zugriffstoken eines Verwalters kommt aus dem Sitzungs-Cookie nach einem Login über die App (Browser-Entwicklerwerkzeuge oder Playwright-Cookies, `sb-<ref>-auth-token`, ggf. aufgeteilt und base64-kodiert). Damit dann direkt gegen `/rest/v1/` mit dem öffentlichen Schlüssel testen.
- **AC-7:** Eine Anfrage an die Action ohne Token wird von der App abgelehnt. Eine direkte Anfrage an Supabase (`/auth/v1/signup`, `/auth/v1/token?grant_type=password`) mit dem öffentlichen Schlüssel endet mit `captcha_failed`. Ein abgelehntes Token testet man, indem man in `.env.local` kurz das immer scheiternde Test-Secret `2x0000000000000000000000000000000AA` als `TURNSTILE_SECRET_KEY` einträgt.
- **AC-6:** Supabase begrenzt Passwort-Logins im gehosteten Projekt auf 150 pro 5 Minuten und IP (Schübe bis 30). 25 schnelle Versuche liegen darunter.
- **AC-13:** Einträge mit zurückdatiertem Zeitpunkt anlegen und die Aufräumfunktion im SQL-Editor aufrufen. Oder den stündlichen Lauf abwarten.

## Abhängigkeiten (Dependencies)

- **Neu:**
  - `@marsidev/react-turnstile` — fertiges React-Bauteil für das Turnstile-Widget, mit Laden, Fehlern, Zurücksetzen, Sprache und Farbschema
  - Datenbank-Erweiterung `pg_cron` — in Supabase enthalten, wird per Migration eingeschaltet
- **Schon vorhanden und genutzt:** `@supabase/ssr`, `@supabase/supabase-js`, `zod`, `react-hook-form`, `@hookform/resolvers`, `server-only`, `lucide-react`, die Schrift Inter über `next/font` und die shadcn/ui-Bausteine `card`, `form`, `input`, `label`, `button` und `alert`.
- **Bewusst nicht:** `@upstash/ratelimit` und `@upstash/redis`, weil die Bremsen in Postgres liegen.

## Einstellungen durch den Nutzer (Settings the user makes)

Supabase läuft mit der Strategie `single`: Es gibt nur das gehostete Projekt, und `supabase/config.toml` wird dafür nicht gelesen. Deshalb kommen alle Auth-Einstellungen ins Dashboard. `supabase config push` wird bewusst nicht benutzt, weil es lokale Standardwerte aus `config.toml` ins Projekt schreiben würde.

| Einstellung | Wo | Wann | Wert | Warum | → AC |
| --- | --- | --- | --- | --- | --- |
| E-Mail-Bestätigung | Supabase → Authentication → Sign In / Providers → Email → „Confirm email“ | now | **aus** | Konto sofort aktiv, und nur so meldet Supabase eine schon registrierte Adresse | AC-1, AC-3 |
| Mindestlänge Passwort | Supabase → Authentication → Sign In / Providers → Email → „Minimum password length“ (je nach Stand des Dashboards auch unter Attack Protection) | now | 8, keine Pflicht zu Zeichenarten | zweite Linie hinter dem Schema | AC-2 |
| CAPTCHA in Supabase | Supabase → Authentication → Attack Protection → „Enable Captcha protection“ | now | an, Anbieter Cloudflare Turnstile, Secret **`2x0000000000000000000000000000000AA`** (Cloudflares Test-Secret, das immer scheitert) | Supabase lehnt so jede Registrierung und jeden Passwort-Login am Formular vorbei ab | AC-6, AC-7, AC-8 |
| Audit-Log in der Datenbank | Supabase → Authentication → Audit Logs → „Write audit logs to the database“ | now | **aus** | Keine Zeile in der Datenbank verweist nach einer Löschung noch auf das Konto, und es liegen keine IP-Adressen im Audit-Log der Datenbank | AC-12, AC-13 |
| Neue Tabellen automatisch freigeben | Supabase → Integrations → Data API → Settings → „Automatically expose new tables“ (in älteren Dashboards „Default privileges for new entities“) | now | **aus** | Das Entwicklungsprojekt verhält sich wie ein frisches Projekt mit Supabases neuem Standard. Fehlt in einer Migration ein Recht, scheitern die Tests hier und nicht erst beim Prüfer. Für die Migrationen selbst ist die Einstellung egal (Rechte-Regel), für den Prüfer also optional. | AC-11 |
| Platzhalter der neuen Variablen | `.env.local.example` (der Agent darf sie nicht bearbeiten) | now | `SUPABASE_SERVICE_ROLE_KEY=your-supabase-secret-key`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA`, `TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA` | dokumentiert jede Variable für den Prüfer, die Testschlüssel sind öffentlich | AC-1, AC-4, AC-7 |
| Server-Schlüssel | `.env.local` → `SUPABASE_SERVICE_ROLE_KEY` | now | Supabase → Project Settings → API Keys → Secret key (`sb_secret_…`) oder der ältere `service_role`-Schlüssel | Registrieren, Passwort prüfen und Bremsfunktionen. Nur für den Server, nie mit `NEXT_PUBLIC_` | AC-1, AC-4, AC-6, AC-8 |
| Turnstile-Testschlüssel | `.env.local` → `NEXT_PUBLIC_TURNSTILE_SITE_KEY` und `TURNSTILE_SECRET_KEY` | now | `1x00000000000000000000AA` und `1x0000000000000000000000000000000AA` (Cloudflares Testschlüssel, bestehen immer) | Widget und Prüfung ohne eigenes Cloudflare-Konto | AC-1, AC-4, AC-7 |
| Supabase-CLI verbinden | Terminal: `supabase login`, dann `supabase link --project-ref <ref>` (fragt nach dem Datenbank-Passwort) | now | — | `/build` spielt die Migrationen mit `supabase db push` ins Projekt | alle |
| Eigenes Turnstile-Widget | Cloudflare-Dashboard → Turnstile → Add widget (Domain der App, Modus Managed); Site-Key und Secret in die Umgebung des Hosts | go-live | echte Schlüssel. **Das Secret in Supabase bleibt das immer scheiternde Test-Secret.** Mit einem echten Secret dort käme ein direkter Login mit gelöstem CAPTCHA an der Bremse vorbei. | Bot-Prüfung mit echter Wirkung | AC-7 |
| Auftragsverarbeitungsverträge | Supabase → Organization Settings → Legal Documents; Cloudflare-Konto | go-live | akzeptiert | `docs/privacy.md` | — |

**Test-Gegenstück der go-live-Zeilen:** Cloudflares offizielle Testschlüssel. Damit braucht weder der Betreiber noch der Prüfer ein Cloudflare-Konto, um `/qa` zu durchlaufen.

## Technische Entscheidungen (Technical Decisions)

| Entscheidung | Begründung | Erwogene Alternative | Trade-off | Datum |
|---|---|---|---|---|
| Registrieren und Anmelden als Server Actions, Abmelden als Route Handler. Der Browser spricht nie selbst mit Supabase Auth. | Sie senden per POST, Zugangsdaten stehen nie in einer URL. Eingabeprüfung, Bot-Prüfung und Bremsen sitzen an einer Stelle, die man nicht umgehen kann (Pack: „The login and signup flow“). | Supabase-Client im Browser | Supabase sieht bei diesen Aufrufen die IP des App-Servers. Lokal ist das dieselbe wie die des Browsers, gehostet eine offene Frage. | 2026-10-21 |
| Die App prüft das Turnstile-Token selbst und ruft Supabase danach mit dem Server-Schlüssel auf. Supabases eigenes CAPTCHA läuft mit dem immer scheiternden Test-Secret. | Supabase nimmt Anfragen mit Admin-Schlüssel vom CAPTCHA aus (Quellcode von Supabase Auth: `verifyCaptcha` überspringt Admin-Anfragen). So schließt das scheiternde Secret jeden direkten Weg mit dem öffentlichen Schlüssel, und jeder Versuch läuft durch die Bremsen. In der Plattform als BUG-4 gefunden und so behoben. | Supabase prüft das Token selbst (dann kommt ein direkter Login mit gelöstem CAPTCHA an der Kontosperre vorbei); zusätzlich ein Custom-Access-Token-Hook | Der Server-Schlüssel steckt im Login- und Registrierungsweg, nur auf dem Server und ohne Cookies. `/build` sichert die Ausnahme mit zwei Tests am gehosteten Projekt ab: über die App klappt es, direkt mit dem öffentlichen Schlüssel kommt `captcha_failed`. | 2026-10-21 |
| Cloudflare Turnstile als Bot-Prüfung | Kostenlos, ohne Kreditkarte, meist ohne Klick, mit offiziellen Testschlüsseln (Kriterium der Spec). Supabase unterstützt nur Turnstile und hCaptcha. | hCaptcha (öfter sichtbare Rätsel); Friendly Captcha oder ALTCHA (EU bzw. selbst gehostet, aber in Supabase nicht eingebaut) | Cloudflare (US-Firma, globales Netz) wird Auftragsverarbeiter. EU-Verarbeitung gibt es im kostenlosen Tarif nicht. Die Frage zu § 25 TDDDG bleibt beim Anwalt (`spec.md`). | 2026-10-21 |
| Login- und Registrierungsbremse in Postgres statt Upstash Redis | Kein weiterer Dienst, kein weiterer Auftragsverarbeiter, kein weiteres Konto für den Prüfer, keine Kosten. `/qa` kann AC-13 direkt in der Datenbank prüfen. | Upstash Redis (Standard im Pack) | Bei einem Massenangriff trifft die Last die Datenbank, für die erwartete Nutzerzahl unkritisch | 2026-10-21 |
| Ein Versuch wird vor der Prüfung eingetragen, laufende Prüfungen zählen mit, und pro Adresse und IP läuft das nacheinander ab | **Garantie für gleichzeitige Versuche (AC-6, AC-8):** Ohne das könnten 50 parallele Rateversuche oder Registrierungen durchrutschen, bevor der erste gezählt ist (Pack: „Count before the check“) | Erst nach dem Ergebnis zählen | Zwei gleichzeitige Absendungen derselben Person können im Grenzfall kurz abgewiesen werden | 2026-10-21 |
| Ein erfolgreicher Login setzt die Zählung seiner Adresse zurück, über „Zählen ab“; die Einträge bleiben stehen | Erfüllt EC-7. Die IP-Zählung bleibt richtig, weil kein Eintrag gelöscht wird. | Einträge der Adresse löschen (würde auch die IP-Zählung senken) | Wer sein eigenes Konto kennt, kann seine Adresse entsperren, aber nicht fremde | 2026-10-21 |
| Abgewiesene Versuche (Sperre aktiv) werden nicht gespeichert | Sie zählen nicht, also braucht sie niemand (Datensparsamkeit) | Als „blocked“ protokollieren (Plattform) | Ein Angriff während einer Sperre ist im Nachhinein nicht sichtbar | 2026-10-21 |
| Treffer auf schon registrierte Adressen zählen bei der Registrierungsbremse mit | Die Spec nimmt den offenen Hinweis aus AC-3 bewusst in Kauf, „abgefedert durch Bot-Prüfung und Registrierungsbremse“. Das gilt nur, wenn die Bremse auch diese Treffer zählt. Entscheidung des Betreibers. | Nur angelegte Konten zählen (AC-8 wörtlich) | AC-8 ist seit `/refine` vom 2026-10-21 so formuliert. Wer sich mehrfach mit einer vergebenen Adresse vertippt, wird früher gebremst. | 2026-10-21 |
| Träger und Mitgliedschaft entstehen per Trigger in derselben Transaktion wie das Konto. Das Kontingent ist der Standardwert der Spalte. | **Garantie für EC-3:** alles oder nichts, auch bei Abbrüchen. AC-1: Das Kontingent kann aus der Anfrage nicht kommen, weil der Trigger es gar nicht liest. Übliches Supabase-Muster. | Träger in der App nach der Registrierung anlegen | Ein Fehler im Trigger blockiert jede Registrierung. Dagegen gibt es einen Test. | 2026-10-21 |
| Gegen doppelte Konten hilft die eindeutige E-Mail-Adresse in Supabase. Bei einem unklaren Fehler fragt der Server nach, ob die Adresse inzwischen registriert ist. | **Garantie für EC-1 und EC-2:** Die Datenbank lässt nur ein Konto pro Adresse zu, und ein Turnstile-Token gilt nur einmal. Supabase meldet dem Verlierer gleichzeitiger Anfragen nur einen allgemeinen Fehler (Befund der Plattform), die Nachfrage macht daraus die Meldung aus AC-3. | Nur der gesperrte Knopf | Eine Funktion mehr, die nur der Server-Schlüssel aufrufen darf | 2026-10-21 |
| Der Träger wird gelöscht, wenn sein letzter Verwalter wegfällt. Login-Einträge einer Adresse gehen mit dem Konto. Das Audit-Log wird nicht in die Datenbank geschrieben. | Erfüllt AC-12 wörtlich: Keine Zeile verweist mehr auf Konto oder Träger. Die Kaskaden von PROJ-2 und PROJ-3 hängen am Träger. | Träger von Hand löschen lassen; Audit-Log in der Datenbank behalten und befristen | Das Audit-Log liegt nur in Supabases Log-Speicher, so lange wie der Tarif vorsieht | 2026-10-21 |
| Zugriff: RLS mit Leseregeln, dazu entzogene Rechte; keine Schreibrechte für `anon` und `authenticated` | Zwei unabhängige Sperren (Sicherheitsregeln des Projekts). Je nach Projekteinstellung gibt Supabase neuen Tabellen sonst alle Rechte. Rechte kommen aus der Mitgliedschaft (Supabase-Skill: nie aus Nutzer-Metadaten). | Nur RLS | Jede spätere Schreiboperation braucht eine bewusste Freigabe | 2026-10-21 |
| Jede Migration setzt Rechte und RLS ausdrücklich, unabhängig von „Automatically expose new tables“ und der automatischen RLS. Im Entwicklungsprojekt ist die automatische Freigabe aus. | Supabase stellt den Standard gerade um: Bei ausgeschalteter Freigabe bekommen neue Tabellen und Funktionen in `public` gar keine Rechte, auch nicht für `service_role` (Supabase-Doku „Securing your API“). Der Prüfer legt ein frisches Projekt an und hat womöglich den neuen Standard. So verhalten sich die Migrationen in jedem Projekt gleich. | Auf die Projekteinstellung verlassen. Dann scheitert der Admin-Client im frischen Projekt an `permission denied`, oder neue Tabellen sind ungewollt offen. | Jede Tabelle und Funktion braucht eigene Zeilen für ihre Rechte. Ein vergessenes Recht sperrt, statt zu öffnen, und fällt in den Tests auf. | 2026-10-25 |
| Das Tor fragt bei jeder Anfrage den Auth-Server (`getUser`). Es leitet nur bei GET und HEAD weiter. Rahmen, Seite und Action prüfen zusätzlich mit dem Wächter. | Beendete Sitzungen und gelöschte Konten greifen sofort. Server Actions bekommen keine Weiterleitung, die Next.js nicht versteht. Ein Tor allein ist nie genug (Next.js-Doku zur Datensicherheit). | Nur die Signatur prüfen (`getClaims`); Prüfung nur im Tor | Ein Netzwerkaufruf zu Supabase pro Seitenaufruf, lokal kaum merklich | 2026-10-21 |
| Abmelden als nativer POST an `/sign-out`, Scope `local`, 303 auf `/login` | Der Browser lädt neu und vergisst den Zwischenspeicher der App. „Zurück“ zeigt so nichts Geschütztes mehr (AC-10). `local` beendet genau die Sitzung, um die es geht. | Server Action mit Weiterleitung (der Router-Cache bliebe im Speicher); Scope `global` | Ein Verwalter, der auf zwei Geräten angemeldet ist, bleibt auf dem anderen angemeldet | 2026-10-21 |
| Sitzungs-Cookies HttpOnly, SameSite=Lax, Secure außer über http; Lebensdauer wie von Supabase | Ein eingeschleustes Skript kann die Sitzung nicht lesen. Die dauerhafte Lebensdauer erfüllt AC-10 („weiterhin angemeldet“). | Supabase-Standard (vom Browser-Skript lesbar) | Der Browser-Client sieht keine Sitzung. Spätere Features lesen und schreiben über den Server. | 2026-10-21 |
| Jede Login-Antwort außer dem Erfolg kommt frühestens nach 1 Sekunde | Erfüllt die Technische Anforderung „Antwortzeit vergleichbar“. Supabase prüft für eine unbekannte Adresse kein Passwort und antwortet schneller (Befund der Plattform, BUG-5). 1 Sekunde deckt Bot-Prüfung, Bremse und Passwortprüfung gegen Frankfurt mit Abstand ab. | Keine Angleichung; 500 ms wie in der lokalen Plattform | Ein Tippfehler kostet eine Sekunde Wartezeit | 2026-10-21 |
| Passwort höchstens 72 Zeichen und zusätzlich höchstens 72 Bytes, beim Login zählt eine längere Eingabe nicht als Fehlversuch | Supabase nimmt mehr als 72 Bytes nicht an (bcrypt). Umlaute zählen doppelt, sodass „72 Zeichen“ allein nicht reicht (Plattform BUG-9, BUG-16). | Nur 72 Zeichen (dann scheitert ein langes Umlaut-Passwort mit einem unklaren Fehler) | AC-2 nennt seit `/refine` vom 2026-10-21 die Grenze in Bytes. Die zusätzliche Prüfung auf 72 Zeichen ändert nichts an der Grenze (72 Bytes sind nie mehr als 72 Zeichen), sie liefert nur die verständlichere Meldung, wenn jemand einfach zu viele Zeichen tippt. | 2026-10-21 |
| IP aus dem letzten Eintrag von `X-Forwarded-For`, sonst `0.0.0.0`; an Cloudflare nur öffentliche IPs | Frühere Einträge setzt der Client selbst (Plattform BUG-2). Eine Loopback- oder Ersatzadresse würde Cloudflare nur verwirren. | Erster Eintrag; `X-Real-IP` | Lokal ohne Proxy kann ein Client den Kopf selbst setzen. Die Adresssperre wirkt trotzdem. Beim Hosting prüfen (Offene Fragen). | 2026-10-21 |
| Vorsilbe `license_center_` für alles, was nur die eigenständige Lizenzzentrale braucht | Die Tabellen sollen in die Datenbank der Plattform wandern (PRD). Die Plattform hat schon `private.login_attempts`, `on_auth_user_created` und `handle_new_user`. Die Vorsilbe verhindert Kollisionen und zeigt, was nicht mitwandert. | Eigenes Schema | Lange Namen | 2026-10-21 |
| Aufgeräumt wird stündlich mit `pg_cron` in der Datenbank, Grenze 23 Stunden | Erfüllt AC-13 streng: Kein Eintrag wird 24 Stunden alt. Läuft ohne weiteren Dienst und ist in jedem Supabase-Tarif enthalten. | Grenze 24 Stunden (dann bis zu 25 Stunden alt); Edge Function mit Zeitplan | Einträge verschwinden schon nach 23 bis 24 Stunden. Die Bremse braucht nur 60 Minuten. | 2026-10-21 |
| Kein Custom-Access-Token-Hook | Der direkte Login ist schon durch das scheiternde CAPTCHA geschlossen. Ein Hook wäre eine Fehlerquelle mehr, die alle Logins blockieren kann. | Hook als zweite Linie wie in der Plattform | Hält jemand den Server-Schlüssel, hilft keine Sperre in Supabase. Der Schlüssel ist aber ohnehin der Generalschlüssel. | 2026-10-21 |
| `next.config.ts`: Protokoll der Server Functions aus, die vier Sicherheitsheader, kein `X-Powered-By`, `agentRules: false` | `next dev` schreibt sonst jede Action mit ihren Argumenten in die Konsole, Passwörter eingeschlossen (Plattform AC-40). Die Header verlangen die Sicherheitsregeln (Pack: Security headers). `agentRules` verhindert, dass `next dev` einen Block an `CLAUDE.md` anhängt (Befund der Plattform). | Alles wie im Standard | Ein Server-Fehler ist im Protokoll weniger ausführlich | 2026-10-21 |
| Das Turnstile-Skript lädt nur auf `/login` und `/register` | Wer angemeldet arbeitet, schickt keine Daten an Cloudflare (Datensparsamkeit) | Skript global im Wurzel-Layout | Auf den beiden Formularseiten dauert es einen Moment, bis das Widget bereit ist | 2026-10-21 |
| Der Hinweis aus EC-6 kommt über `?reason=session`; angezeigt wird nur ein fester Text | Unterscheidet „Sitzung beendet“ von einem normalen Login, ohne Daten in der Adresse. Kein Wert aus der Adresse erscheint auf der Seite, also gibt es keine Einschleusung. | Kurzlebiges Hinweis-Cookie | Wer `/licenses` als Lesezeichen abgemeldet öffnet, sieht den Hinweis auch. Das ist harmlos. | 2026-10-21 |

## Abdeckung der Acceptance Criteria

| AC / EC | Wo es im Design gelöst ist |
|---|---|
| AC-1 | Registrieren, Trigger, Kontingent als Spaltenstandard, Einstellung „Confirm email“ aus |
| AC-2 | Eingaberegeln (ein Schema für Browser und Server), Regel der Spalte `name`, Mindestlänge in Supabase |
| AC-3 | Registrieren → „Adresse schon registriert“, Meldungstexte |
| AC-4 | Anmelden, Wächter, Kopfzeile, Platzhalterseite |
| AC-5 | Anmelden, Meldungstexte, Mindestantwortzeit |
| AC-6 | Login-Bremse im Detail, CAPTCHA in Supabase mit scheiterndem Secret |
| AC-7 | Bot-Prüfung in beiden Abläufen, CAPTCHA in Supabase |
| AC-8 | Registrierungsbremse (zählt `pending`, `success` und `duplicate`) |
| AC-9 | Tor, Wächter |
| AC-10 | Sitzung (dauerhafte Cookies), Abmelden, `no-store` |
| AC-11 | Zugriffsregeln in der Datenbank, Wächter |
| AC-12 | Trigger „Letzter Verwalter weg“, Trigger beim Löschen eines Kontos, Audit-Log aus |
| AC-13 | Aufräumjob (Login-Versuche, Login-Sperren und Registrierungsversuche), Aufbewahrung im Datenmodell |
| EC-1 | gesperrter Knopf, Einmal-Token, eindeutige Adresse |
| EC-2 | eindeutige Adresse, Nachfrage `license_center_email_registered` |
| EC-3 | Trigger in derselben Transaktion, Meldungstexte |
| EC-4 | Eingaberegeln (Normalisierung), Bremse zählt normalisierte Adresse |
| EC-5 | Wächter „nicht zugeordnet“, Rahmen, Trigger verträgt Löschen des Trägers |
| EC-6 | Tor, Abmelden ohne Sitzung, Hinweis über `?reason=session` |
| EC-7 | Login-Bremse → `success` setzt „Zählen ab“ |
| EC-8 | Bot-Prüfung (Turnstile-Widget), Grundsatz 4 |
| EC-9 | Formularregeln, Meldungstexte (Abgrenzung EC-3 / EC-9) |
| EC-10 | Kopfzeile |

## Offene Fragen (Open Questions)

- [ ] **Vor einem Live-Gang:** Setzt der Host `X-Forwarded-For` selbst bzw. überschreibt er ihn? Sonst lässt sich die IP-Sperre durch einen selbst gesetzten Kopf umgehen. Die Adresssperre wirkt in jedem Fall.
- [ ] **Vor einem Live-Gang:** Gehostet sieht Supabase bei allen Aufrufen die IP des App-Servers. Seine eigenen IP-Grenzen (150 Passwort-Logins, 30 Registrierungen pro 5 Minuten) gelten dann für alle Besucher zusammen. Prüfen und unter Authentication → Rate Limits anheben, falls nötig.
- [ ] **Restrisiko, beim Live-Gang bewerten:** Ein angemeldeter Verwalter kann über Supabases direkten Endpunkt (`PUT /auth/v1/user`) die eigene E-Mail-Adresse oder das eigene Passwort ändern. Die App bietet das nicht an (Out of Scope), es betrifft nur das eigene Konto, und Rechte hängen nicht an der Adresse.
- [ ] **Für `/build`, am gehosteten Projekt per Test bestätigen:**
  - Der Admin-Schlüssel umgeht Supabases CAPTCHA.
  - Ein direkter Login und eine direkte Registrierung mit dem öffentlichen Schlüssel scheitern mit `captcha_failed`.
  - Die Trigger auf `auth.users` legen an und löschen mit.
  - `pg_cron` läuft und darf die Tabellen in `private` leeren.
