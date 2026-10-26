# QA-Testergebnisse: PROJ-2 Lizenzverwaltung

**Getestet:** 2026-10-26 (Nachprüfung nach dem Fix von BUG-1). Der erste `/qa`-Lauf war am 2026-10-25.
**App-URL:** http://localhost:3001
- Gestartet als `npm run dev -- -p 3001`, einmal von der `/qa`-Sitzung.
- Port 3000 aus `probe.baseUrl` war von einem anderen Projekt belegt (`lsof -iTCP:3000` → `next-server` aus `…/Developer/speechwerk`).

**Tester:** QA Engineer (KI). Drei unabhängige `qa-engineer`-Prüfer ohne Build-Kontext, parallel und mit getrennten Bereichen:
- Abnahme (Step 2)
- Security (Step 3)
- Regression (Step 4 und 5)

Zusammengeführt hat die `/qa`-Sitzung. Sie hat auch die Unit-Tests ergänzt (Step 6).

**Umfang:** Nachprüfung. `git diff --stat 1aea447..HEAD` (`1aea447` hat den vorigen Bericht geschrieben):
- Produktionsdatei: `supabase/migrations/20261026120000_proj2_licenses_email_rule.sql` (neu)
- sonst nur Tests (`src/test/db/licenses.test.ts`, `src/features/licenses/licenses.schema.test.ts`) und `design.md`
- Weil die Diff eine Migration berührt, lief die Prüfung in **voller Breite**: alle AC, EC, Security- und Regressionspunkte. Nichts ist ungeprüft aus dem vorigen Bericht übernommen. Jeder Haken unten stammt aus diesem Lauf.

> Legende:
> - `[x]` in diesem Lauf geprüft (mit Beleg)
> - `[ ] BUG` als fehlerhaft geprüft
> - `[!] NOT VERIFIED` in diesem Lauf nicht prüfbar (mit Grund)

**So wurde geprüft:**
- **Server Actions** per HTTP direkt aufgerufen, am Formular vorbei: `POST /licenses` mit dem Kopf `Next-Action`. Die IDs stammen aus `.next/dev/server/server-reference-manifest.json`.
- **Seite:** Das server-gerenderte HTML von `/licenses` wurde ausgewertet. Antworten der Actions enthalten den neu gerenderten Baum.
- **Datenbank-Schnittstelle (PostgREST)** direkt angesprochen, mit dem öffentlichen Schlüssel und dem Zugriffstoken aus dem Sitzungs-Cookie.
- **Datenbank** direkt per `env -u SUPABASE_ACCESS_TOKEN supabase db query --linked`. Für Rechte-Tests lief SQL mit `set local role authenticated` und eigenen JWT-Claims, jeweils mit Rollback.
- **Testkonten:** fünf Verwalter `qa3-{acc,sec,reg}-…-1026@example.com` mit je eigenem Träger, angelegt über die Registrierung der App. Teilnehmer-Adressen nur aus `example.com`.
- **Gemeinsame Bremse:** Lokal zählen alle Logins und Registrierungen unter `0.0.0.0`. Jeder Prüfer bekam deshalb eigene Konten und ein festes Budget und hat seine Bremszeilen direkt danach gelöscht.
- **Aufräumen**, Endstand per SQL von der `/qa`-Sitzung:
  - 0 Konten `qa3-%`, 0 Träger `QA3%`, 0 Lizenzen insgesamt
  - 0 Login-Versuche `qa3%` und 0 Sperren
  - 0 Registrierungen unter `0.0.0.0` in der letzten Stunde
  - 4 Konten insgesamt, so viele wie vor dem Lauf

**Suite-Lauf** (einmal vor den Prüfern, `npm test`): 27 Dateien, 595 Tests bestanden, 0 fehlgeschlagen, exit 0.
- Der vorige Lauf hatte 591. Die Differenz ist erklärt: 591 + 11 Unit-Tests aus dem ersten `/qa` − 7 Fälle, die in die gemeinsame Liste „Regel der Spalte“ gewandert sind = 595 (Regressionsprüfer).

**Weitere Läufe:**
- **Produktions-Build:** übersprungen, unverändert seit 2026-10-25. Die Diff berührt keinen App-Code: `git diff --stat 1aea447..HEAD -- src ':(exclude)*.test.ts' ':(exclude)*.test.tsx' ':(exclude)src/test/**'` ist leer. Geprüft wurde der vorhandene Build `vH4tgTR8MDy8THjStxCvS` (siehe Security).
- Nach der Teständerung von `/qa`: `npx eslint src/features/licenses/components/assign-license-dialog.test.tsx` → exit 0, `npx tsc --noEmit` → exit 0.
- **Migration:** [!] NOT VERIFIED, kein Round-Trip (`db reset`). Die Strategie ist `single`: Es gibt kein lokales Supabase, und ein Reset des gehosteten Projekts würde alle Daten löschen.
  - Ersatz: `supabase migration list --linked` zeigt lokal und remote dieselben 5 Versionen bis `20261026120000`.
  - Das Live-Schema wurde gegen beide PROJ-2-Migrationen geprüft (siehe Security, „Live-Schema“).

## Akzeptanzkriterien

#### AC-1: Anzeige „X von Y vergeben“, „Z frei“ und Balken, aktuell ohne Neuladen
- [x] Nach zwei Zuweisungen zeigt das HTML von `/licenses` „2 von 5 Lizenzen vergeben“ und „3 frei“.
- [x] Der Balken trägt `aria-valuenow="40" aria-valuetext="2 von 5 Lizenzen vergeben"`, die Füllung `translateX(-60%)`, also 40 %.
- [x] Ohne Neuladen: Jede Action-Antwort trägt `x-action-revalidated` und den neu gerenderten Baum mit der neuen Zählung, auch nach dem Entziehen („4 von 5“/„1 frei“). `refresh()` steht in `src/features/licenses/licenses.actions.ts:29,32,35,54,57`.
- [!] NOT VERIFIED: dass der Browser den mitgelieferten Baum wirklich einspielt. Dafür braucht es einen Browser.

#### AC-2: Liste aller Lizenzen mit Adresse und Datum, neueste oben, je mit „Entziehen“
- [x] Die neueste steht oben (t2 08:37:00 vor t1 08:36:51), nach jeder weiteren Zuweisung wieder die neue. Jede Zeile hat `<time dateTime=…>26.10.2026</time>` und einen Knopf „Entziehen“ mit `aria-label="Lizenz von … entziehen"`.
- [x] Tabelle und Karten stehen beide im HTML. Sortierung nach `assigned_at` absteigend, dann `id`: `src/features/licenses/licenses.data.ts:32-33`.

#### AC-3: Leere Liste mit Aufforderung
- [x] Bei einem frischen Träger steht auf der Seite „0 von 5 Lizenzen vergeben | 5 frei | Vergebene Lizenzen | Noch keine Lizenz vergeben. Weisen Sie die erste zu. | Lizenz zuweisen“.
- [x] Der zweite Knopf ist die Outline-Variante: `license-list.tsx:47` → `assign-license-dialog.tsx:103`.

#### AC-4: Zuweisen legt die Lizenz an, oben in der Liste, Zählung +1/−1, „Lizenz zugewiesen“
- [x] Die Action antwortet `{"status":"assigned"}`, die Antwort zeigt „1 von 5“/„4 frei“. Über PostgREST liegt die Zeile beim eigenen Träger, in der Liste steht sie oben.
- [x] Der Toast-Text „Lizenz zugewiesen“ steht in `licenses.rules.ts:24`, die Zuordnung in `licenses.rules.ts:126`.
- [!] NOT VERIFIED: der sichtbare Toast und das Öffnen und Schließen des Dialogs. Dafür braucht es einen Browser; belegt sind nur die Komponententests im Suite-Lauf.

#### AC-5: Leere oder ungültige Adresse wird abgelehnt, auch am Formular vorbei
- [x] **Über die App**, am Formular vorbei, kommt immer `field_error`, und es entsteht keine Zeile:
  - `""` und `"   "` → „Bitte geben Sie die E-Mail-Adresse des Teilnehmers ein.“
  - `not-an-email`, `a@b.c`, `<script>alert(1)</script>@example.com`, SQL-Reste → „Bitte geben Sie eine gültige E-Mail-Adresse ein.“
  - `{}` und `{"email":123}` → Meldung „leer“; `["x"]` → `failed`
- [x] **Im Dialog:** Prüfung mit demselben Schema, Meldung am Feld, die Action wird nicht aufgerufen, die Eingabe bleibt stehen. Belege: `assign-license-dialog.test.tsx:78-89` (von `/qa` um die Prüfung der stehenden Eingabe ergänzt, siehe Unit-Tests) und `:106` für „schon vergeben“.
- [x] **Direkt über die Datenbank-Schnittstelle** (BUG-1, jetzt behoben): App-Schema und Regel der Spalte urteilen gleich.
  - 72 knifflige Adressen, je einzeln als PostgREST-POST mit dem eigenen Token, verglichen mit dem Urteil von `assignLicenseSchema` (echte Datei): 0 Abweichungen.
  - Gültig waren u. a. `+`, Punkt, Bindestrich, Subdomain, Apostroph, `_`, Punycode und 254 Zeichen. Ungültig waren u. a. Großbuchstaben, 255 Zeichen, Punkt am Rand oder doppelt, `'` vor dem @, Umlaute und andere Unicode-Zeichen, TLD `c`/`123`, Zeilenumbruch, Tab, Leer- und Steuerzeichen, HTML-Nutzlasten, IP-Literal und zitierter lokaler Teil.
  - Ablehnung immer 400 `23514` mit `details:null`.
  - Breiter, zweimal unabhängig: 8.991 bzw. 5.000 erzeugte Adressen gegen die live gelesene Regel (`pg_get_constraintdef`) → 0 Abweichungen.

#### AC-6: Dieselbe Adresse ein zweites Mal beim eigenen Träger wird abgelehnt, beim fremden Träger nicht
- [x] `" QA3ACC-t1@EXAMPLE.com "` bei bestehender Lizenz → „Diese E-Mail-Adresse hat bereits eine Lizenz.“. Die Zählung bleibt bei 2 von 5.
- [x] Auch bei 5 von 5 kommt diese Meldung, nicht „ausgeschöpft“: Die Prüfung auf Duplikat kommt vor dem Kontingent (`20261025120000_proj2_licenses.sql:120-127`).
- [x] Träger B weist eine Adresse zu, die nur A hat → `assigned`. Die Antwort enthält nichts über A.

#### AC-7: Volles Kontingent sperrt das Zuweisen, auch an der Oberfläche vorbei
- [x] Bei 5 von 5 zeigt die Seite „Ihr Kontingent ist ausgeschöpft. Für weitere Lizenzen wenden Sie sich an den Anbieter.“.
  - Knopf: `disabled aria-describedby="license-quota-notice"`
  - Hinweis: `role="alert" id="license-quota-notice"`
- [x] Die Action antwortet `exhausted`. PostgREST mit einer und mit mehreren Zeilen → 400 `P0001 license_quota_exhausted`. 5 Zeilen in einem POST bei 1 von 5 → 0 angelegt. Zu keinem Zeitpunkt gab es mehr Lizenzen als das Kontingent.
- [x] Trigger live `BEFORE INSERT … private.enforce_license_rules()` (Migration `:129-135`).

#### AC-8: Entziehen mit Bestätigung, Lizenz sofort wieder frei
- [x] Die Action antwortet `{"status":"revoked"}`. Die Antwort zeigt „4 von 5“/„1 frei“, die Adresse kommt 0-mal vor, per SQL ist die Zeile weg.
- [x] Dieselbe Adresse sofort neu zugewiesen → `assigned`, mit neuer ID.
- [x] Dialogtexte in `licenses.rules.ts:34,50-52` und `revoke-license-dialog.tsx:90-93`. „Abbrechen“ entzieht nichts (Test `revoke-license-dialog.test.tsx:70`).
- [!] NOT VERIFIED: den Bestätigungsdialog selbst und den Toast „Lizenz entzogen“ im Browser.

#### AC-9: Kontingent unter die vergebene Zahl gesenkt
- [x] Kontingent per SQL auf 3 gesenkt, bei 5 vergebenen Lizenzen, also genau das Beispiel der Spec:
  - Die Seite zeigt „5 von 3 Lizenzen vergeben | 0 frei“ und den Hinweis „Ihr Kontingent ist überschritten. …“ wortgleich.
  - Der Knopf ist `disabled`, der Balken steht bei `aria-valuenow="100"`, alle 5 Lizenzen bleiben bestehen.
  - Zuweisen → `exhausted`.
- [x] Nach zweimal Entziehen steht „3 von 3“ mit dem Hinweis „ausgeschöpft“, der Knopf bleibt gesperrt.

#### AC-10: Datentrennung zwischen zwei Trägern, auch direkt über die Datenbank-Schnittstelle
- [x] **Über PostgREST**, mit dem Token von A gegen die Daten von B (zwei Prüfer unabhängig):
  - GET liefert nur die Zeilen von A. GET der B-Lizenz per `id` und GET mit dem Filter auf B → `[]`.
  - POST für B → 403 `42501 training_provider_not_accessible`, auch mit einer Adresse, die B schon hat. Ein nicht vorhandener Träger gibt dieselbe Antwort, nie `23505`.
  - Mehrfachzeile A+B → 403, nichts angelegt.
  - PATCH der B-Lizenz, der eigenen Lizenz mit neuer Adresse und der eigenen Lizenz nach B → 403 `42501`.
  - DELETE der B-Lizenz und `DELETE training_provider_id=neq.<A>` → `[]`, B behält seine Zeilen.
  - POST mit `id` oder `assigned_at` → 403. Über das Kontingent hinaus → `P0001`.
  - Ohne Token (`anon`): GET, POST und DELETE → 401 `42501`.
- [x] **Über die App:** `revokeLicense` mit der ID von B → `already_revoked`, die Zeile bleibt. `assignLicense` mit `training_provider_id`/`trainingProviderId` von B und `licenseQuota:999` im Rumpf legt die Lizenz bei A an.
- [x] **Per SQL als `authenticated`** mit den Claims von A: nur eigene Lizenzen, 1 sichtbarer Träger. Live: RLS an, genau 3 Regeln (SELECT, INSERT, DELETE), keine für UPDATE.

#### AC-11: Nach Entziehen oder Löschen ist die Adresse vollständig weg
- [x] **Nach dem Entziehen:** Eine Suche über alle Text-, JSON- und Array-Spalten in `public`, `private`, `auth`, `storage`, `cron`, `net`, `supabase_functions`, `realtime`, `extensions` und `vault` findet die Adresse 0-mal. Die Gegenprobe mit einer noch vergebenen Adresse findet sie 1-mal in `public.licenses`.
- [x] **Träger gelöscht** bzw. **Konto des Verwalters gelöscht** (`delete from auth.users …`), von allen drei Prüfern: Danach sind Adressen, Lizenzen, Träger, Mitgliedschaften und Identitäten überall 0.
- [x] Die Löschkaskade ist live `FOREIGN KEY … ON DELETE CASCADE`. Keine Tabelle verweist auf `licenses`.
- [!] NOT VERIFIED: das Postgres-Protokoll von Supabase. Der Mechanismus ist jetzt genauer beurteilt, siehe Beobachtung O-1.

#### AC-12: Nur Adresse und Zeitpunkt, keine weiteren Angaben
- [x] Die Live-Spalten sind genau `id uuid, training_provider_id uuid, email text, assigned_at timestamptz`. `GET select=name` → 400 `42703`.
- [x] Das Insert-Recht gilt nur für `training_provider_id` und `email` (live `column_privileges`). `id` und `assigned_at` setzt die Datenbank (mitgeschickt → 403).

## Edge Cases

#### EC-1: Letzte freie Lizenz gleichzeitig an zwei Adressen
- [x] **Garantie:** `pg_advisory_xact_lock` pro Träger, danach wird gezählt (Migration `:108`, `:130-135`). Live bestätigt: `prosrc` enthält die Sperre, der md5 von `prosrc` ist gleich dem Körper in der Migrationsdatei.
- [x] **Provoziert:** 5 gleichzeitige Actions mit 5 Adressen bei 1 von 2 → 1 `assigned`, 4 `exhausted`, danach genau 2 Zeilen.
- [x] **Veralteter Tab:** Zuweisung bei 5 von 5, nachdem die Seite 4 von 5 gezeigt hatte → `exhausted` mit aufgefrischtem Baum „5 von 5“.

#### EC-2: Mehrfachklick / dieselbe Adresse gleichzeitig
- [x] **Garantie:** Trigger-Schritt „schon vergeben“ vor dem Kontingent (Migration `:120-127`) und der eindeutige Schlüssel `(training_provider_id, email)`, live vorhanden.
- [x] **Provoziert:** 4 gleichzeitige Anfragen mit derselben Adresse auf die letzte freie Lizenz → genau 1 `assigned`, 3 × „Diese E-Mail-Adresse hat bereits eine Lizenz.“. In der Datenbank liegt 1 Zeile.
- [x] Der Knopf ist beim Senden gesperrt: `assign-license-dialog.tsx:54,57,95-97,166`, Test `assign-license-dialog.test.tsx:158`.
- [!] NOT VERIFIED: Sperre, Escape und Klick daneben im echten Browser.

#### EC-3: Dieselbe Lizenz in zwei Tabs entziehen
- [x] **Garantie:** DELETE nach ID und Träger, die Zahl der zurückgegebenen Zeilen entscheidet (`licenses.data.ts:76-83`).
- [x] 3 gleichzeitige Anfragen → genau 1 `revoked`, 2 `already_revoked`. Nacheinander ebenso, mit aufgefrischter Zählung.

#### EC-4: Kontingent 0, keine Lizenz
- [x] Die Seite zeigt „0 von 0 Lizenzen vergeben | 0 frei“ und den Hinweis aus AC-7, ohne den Abschnitt „Vergebene Lizenzen“ und ohne Aufforderung.
- [x] Der Knopf ist `disabled`, der Balken steht bei `aria-valuenow="100"`. Zuweisen → `exhausted`.
- [x] Bei Kontingent 1 steht „0 von 1 Lizenz vergeben“ (Einzahl).

#### EC-5: Verbindungsabbruch / Serverfehler
- [x] Jede Aktion ist genau eine Anweisung an die Datenbank, Ausnahmen werden zu `failed` (`licenses.data.ts:48-66,73-86`). Bei `failed` gibt es kein `refresh` (`licenses.actions.ts:37-38,59-60`).
- [x] Meldungen: `TypeError` → „Keine Verbindung“, alles andere → „Das hat nicht geklappt“ (`licenses.rules.ts:156-160`).
- [x] Die Eingabe bleibt stehen (Test `assign-license-dialog.test.tsx:128-141`); für Entziehen die Tests `revoke-license-dialog.test.tsx:114,127`.
- [!] NOT VERIFIED: ein echter Verbindungsabbruch oder Serverfehler zur Laufzeit. Den Server oder Supabase zu stören hätte die parallelen Prüfer gestört.

#### EC-6: Lizenzen lassen sich nicht laden
- [x] Bei einem Fehler oder einer Ausnahme kommt `load_error`, nie eine leere Liste (`licenses.data.ts:34,39-41`).
- [x] Die Seite rendert dann nur den Titel und die Hinweisbox (`src/app/(app)/licenses/page.tsx:27-34`).
- [x] Tests: `licenses.data.test.ts:147,153` und `licenses-load-error.test.tsx:15,23`.
- [!] NOT VERIFIED: ein echter Ladefehler zur Laufzeit, aus demselben Grund wie EC-5.

#### EC-7: Abgemeldet bzw. nicht zugeordnet
- [x] **Abgemeldet:** Sitzung per `POST /sign-out` beendet. Beide Actions mit dem alten Cookie → `x-action-redirect: /login?reason=session`, per SQL nichts angelegt und nichts gelöscht.
  - `GET /licenses` → 307 auf `/login?reason=session`, die Seite zeigt „Bitte melden Sie sich erneut an.“.
- [x] **Nicht zugeordnet** (Träger per SQL gelöscht): `assignLicense`, `revokeLicense` und eine ungültige Eingabe → `{"status":"unassigned"}`.
  - Die Seite zeigt nur „Ihr Konto ist keinem Bildungsträger zugeordnet. Bitte wenden Sie sich an den Anbieter.“.
  - Der Wächter steht vor Schema und Datenzugriff (`licenses.actions.ts:16-17,44-45`).

#### EC-8: Lange Adressen und Sonderzeichen
- [x] Eine Adresse mit 254 Zeichen und Apostroph (`qa3acc-o'brien+…@example.com`) wurde zugewiesen. Im HTML steht sie escaped (`o&#x27;brien`), in Tabellenzelle und Karte, beide mit `[overflow-wrap:anywhere]`.
- [x] Knopf mit `shrink-0`, Tippfläche 44 px (`h-9 after:-inset-y-1`). HTML-Nutzlasten kommen seit dem Fix auf keinem Weg mehr in die Datenbank (AC-5).
- [!] NOT VERIFIED: der tatsächliche Umbruch, die Karten auf dem Smartphone ohne seitliches Scrollen und der Dialogtitel. Es gibt keinen Viewport.

#### EC-9: Eigene Adresse des Verwalters
- [x] `QA3-ACC-A-1026@example.com` (das eigene Konto) → `assigned`. Sie zählt ins Kontingent (4 → 5 von 5) und wird kleingeschrieben gelistet.

#### EC-10: Kontingent ändert sich bei offener Seite
- [x] Kontingent bei offener Übersicht per SQL von 5 auf 3 gesenkt: Zuweisen → `exhausted`, die Antwort zeigt „5 von 3“. Danach von 3 auf 4: Zuweisen → `assigned`, „4 von 4“, die nächste → `exhausted`.
- [x] **Garantie:** Der Trigger liest das Kontingent beim Anlegen (Migration `:111-116`).

#### Zusätzliche Edge Cases
- [x] Unicode-Leerzeichen am Rand (NBSP, BOM, U+2028, Tab, CRLF): Die App entfernt sie und speichert die Adresse in ASCII. Die Datenbank nimmt diese Form an, den Rohwert nicht. Das ist die gewollte Regel „ablehnen statt anpassen“ (`design.md`, Technische Entscheidungen).
- [x] Kaputter Rumpf (`["x"]`, ein String statt eines Objekts) → `failed`. Entziehen mit `not-a-uuid`, `"1 or 1=1"` oder einem Array → `failed`, nichts gelöscht.
- [x] Eine mitgeschickte `training_provider_id` beim Entziehen wird verworfen (`already_revoked`, die fremde Zeile bleibt).
- [x] Server Action mit fremdem `Origin: https://evil.example` → 500 „Invalid Server Actions request.“, nichts angelegt (CSRF wird abgewehrt).

## Security-Audit

- [x] **Authentifizierung:**
  - `GET /licenses` ohne Cookie und mit kaputtem Cookie → 307 auf `/login?reason=session`.
  - Beide Actions ohne Sitzung → Weiterleitung, per SQL nichts angelegt und nichts gelöscht.
- [x] **Autorisierung:** A gegen B über PostgREST, über die Actions und per SQL als `authenticated`, siehe AC-10.
- [x] **Live-Schema gegen Migrationen** (Ersatz für den Round-Trip):
  - `pg_get_constraintdef(licenses_email_check)` entspricht wörtlich `20261026120000_proj2_licenses_email_rule.sql:14-18`. Das Muster ist identisch mit `z.email()` in zod 4.6.7 (`node_modules/zod/v4/core/regexes.js:34`).
  - Eindeutiger Schlüssel, Primärschlüssel und Löschkaskade wie `20261025120000_proj2_licenses.sql:13-32`.
  - **RLS:** eingeschaltet, genau 3 Regeln mit `role='admin'` und `(select auth.uid())` wie `:42-79`.
  - **Rechte:** `authenticated` hat SELECT und DELETE, INSERT nur auf `(training_provider_id, email)`, kein UPDATE; `anon` ohne Recht (`:81-86`).
  - **Trigger** `BEFORE INSERT FOR EACH ROW`, aktiv (`:141-143`).
  - **Prüffunktion:** `prosecdef=false`, `search_path=""`, Ausführen nur für `postgres`. Der Körper ist per md5 identisch mit der Migrationsdatei.
- [x] **Eingaben über die App:** XSS- und SQL-Nutzlasten lehnt das Schema auf dem Server ab (AC-5). `qa3sec'--@example.com` ist laut zod gültig und wird wörtlich gespeichert. Der Datenzugriff läuft nur parametrisiert über supabase-js (`licenses.data.ts:51-55`), im HTML steht die Adresse escaped.
- [x] **Eingaben direkt an der Datenbank-Schnittstelle (BUG-1):** Die drei Nutzlasten aus dem vorigen Bericht → jetzt 400 `23514` statt 201. Dazu 40 gezielte Umgehungsversuche → alle abgelehnt:
  - Steuer- und Leerzeichen: LF, CR, CRLF, Tab, NBSP, BOM und Zero-Width am Ende, am Anfang und in der Mitte
  - Unicode: Umlaute, Kelvin-Zeichen, langes s, punktloses i, kyrillisches a, Vollbreite, RTL-Override, kombinierende Zeichen
  - Großbuchstaben (auch bei 254 Zeichen) und die Längen 255, 256 und 1.000
  - Formate wie IP-Literal oder Kommentar
  - Upsert mit `merge-duplicates` → 403, mit `ignore-duplicates` → `23514`. Mehrfachzeile gültig + ungültig → 400, nichts angelegt. PATCH → 403.
  - Die Grenze stimmt: genau 254 gültige Zeichen → 201.
- [!] **Rate limiting:** NOT VERIFIED, nicht implementiert. Es ist laut Spec Out of Scope (die Grenze kommt in PROJ-3).
  - Gemessen: 20 × `revokeLicense` in 16 s ohne Drosselung.
  - `grep -rlnE "rateLimit|rate_limit|throttle" src/features/licenses supabase/migrations/*proj2*` → 0.
  - Die Kontingent-Grenze greift trotzdem.
- [!] **Brute Force auf Zugangsdaten:** NOT VERIFIED, entfällt. PROJ-2 hat keinen Login, keine Registrierung und keine eigene Prüfung von Zugangsdaten; das ist PROJ-1. `tasks.md:6`: keine `[user]`- und keine `[user go-live]`-Aufgaben.
- [!] **Account-Enumeration beim Login und massenhafte Registrierung:** NOT VERIFIED, entfällt (PROJ-1).
- [x] **Keine Ausforschung fremder Daten:** Fremder und nicht vorhandener Träger antworten beide mit `42501`, auch wenn die Adresse dort schon vergeben ist (AC-10). Eine fremde Lizenz-ID sieht aus wie „bereits entzogen“. Der Fehlertext bei einem Duplikat (`409 license_already_assigned`) enthält keine Adresse.
- [x] **Keine Zugangsdaten oder Adressen in der URL:** `<form method="post" noValidate onSubmit=…>` (`assign-license-dialog.tsx:129`). Entziehen sendet nur die `licenseId`. `useSearchParams`, `searchParams`, `router.push` und `href=` kommen in `src/features/licenses` und `src/app/(app)/licenses` 0-mal vor.
- [x] **Keine Geheimnisse im Client-Bundle:**
  - Geprüft wurde der Build `vH4tgTR8MDy8THjStxCvS` vom 26.10.; der App-Code ist seitdem unverändert.
  - In `.next/static` (1,2 MB) und `.next/dev/static` (18 MB) gibt es 0 Treffer für `sb_secret_`, `service_role`, `SERVICE_ROLE`, `SUPABASE_SECRET`, `TURNSTILE_SECRET`, `eyJhbGciOi`, `sb_publishable_` und die Turnstile-Test-Secrets.
  - Nur die drei öffentlichen Variablen tragen `NEXT_PUBLIC_` (`grep -rhoE "process\.env\.[A-Z_]+" src`).
- [x] **Keine Geheimnisse in der Git-Historie:** `git log --all -p` mit den Mustern für `sb_secret_`, `sk_live`, `re_`, `0x4AAAA`, `eyJhbGciOi` und `sb_publishable_` → 1 Treffer, ein Fehlalarm: der Text „`sk_live`“ im vorigen `qa-report.md`. Eingecheckt ist nur `.env.local.example`.
- [x] **Keine sensiblen Daten in Antworten:** Die Actions antworten nur `{"status":…}`, bei Feldfehlern zusätzlich mit `message`. Im HTML von `/licenses` (57 KB) stehen 0-mal Träger-ID, Nutzer-ID, Daten von B, `access_token`, `refresh_token`, `license_quota`, `training_provider_id` und `sb_*`. PostgREST-Fehler bei Regelverstößen: `details:null`.
- [x] **Sicherheitsheader lokal:** `X-Frame-Options: DENY`, `nosniff`, `origin-when-cross-origin`, HSTS mit `includeSubDomains`, `Cache-Control: no-store` (`curl -I /licenses`). Das Auth-Cookie ist `HttpOnly; SameSite=lax`.
- [!] **Sicherheitsheader live:** NOT VERIFIED, es gibt kein Deployment.

## Regression (PROJ-1 Konto & Login)

Kein Feature steht auf „Deployed“. Geprüft wurde das verwandte PROJ-1 (Approved). Es teilt mit PROJ-2 den Rahmen, den Wächter, die Seite `/licenses`, `training_providers` und den Löschpfad Konto → Träger → Lizenzen.

- [x] **Suite:** 595/595 grün, darunter alle PROJ-1-Dateien (`account.*`, `login-form`, `register-form`, `bot-check`, `session.data`, `throttle.data`, `proxy`, `sign-out/route`, `form-feedback`, `src/test/db/throttle.test.ts`, `training-providers.test.ts`). 27 Dateien entsprechen genau `git ls-files '*.test.ts' '*.test.tsx' | wc -l`.
- [x] **Keine geschwächten Prüfungen:**
  - `src/test/db/licenses.test.ts`: Die 7 ungültigen Fälle, die bisher als `service_role` eingefügt wurden, stehen jetzt in einer längeren Liste mit 12 weiteren Adressen. Sie gehen mit dem Token des Verwalters an die Datenbank, erwartet wird für jede genau `23514`; eine RLS-Ablehnung würde den Test rot machen. Neu ist die Kreuzprobe gegen `assignLicenseSchema`. Die Zahl der `it(`-Blöcke bleibt bei 15.
  - `licenses.schema.test.ts`: nur 2 Kommentarzeilen geändert.
  - `grep -rnE '\.(skip|only|todo|fails)\(|\bxit\(|\bfit\(|xdescribe|skipIf|runIf' src --include='*.test.ts' --include='*.test.tsx'` → 0.
  - `git diff main..HEAD -- package.json package-lock.json vitest.config.mts tsconfig.json eslint.config.mjs scripts/` ist leer.
- [x] **AC-1:** Registrierung mit Großbuchstaben, Leerzeichen und den Zusatzfeldern `licenseQuota:999`, `license_quota:999`, `role:"owner"` → `/licenses`. In der Datenbank: Kontingent 5, Rolle `admin`, 1 Mitgliedschaft.
- [x] **AC-2:** Alle 4 Feldfehler gleichzeitig. Kein Konto, kein Träger, keine Bremszeile.
- [x] **AC-3:** Duplikat in anderer Schreibweise → Meldung mit Login-Link, kein Cookie, weiter 1 Konto.
- [x] **AC-4:** Der Login führt zu `/licenses` (200) mit Kopfzeile, Trägername und Abmelden-Formular (`method="post"`).
- [x] **AC-5:** Falsches Passwort und unbekannte Adresse → byte-gleiche Antwort „E-Mail-Adresse oder Passwort ist falsch.“ (1,10 s bzw. 1,01 s).
- [x] **AC-6:** Sperre per SQL an der eigenen Adresse gesetzt: Richtiges Passwort → „Zu viele Anmeldeversuche. … in 3 Minuten …“, kein Cookie. Die Schwellen 5 pro Adresse und 20 pro IP lösen in der Datenbank `locked` aus, geprüft in zurückgerollten Transaktionen an `198.51.100.77`.
- [x] **AC-7:** Ohne Turnstile-Token → „Die Sicherheitsprüfung ist fehlgeschlagen. …“, nichts angelegt.
- [x] **AC-8 (Datenbankebene):** 5 Registrierungen mit `success`/`duplicate` → `locked`; Fehler zählen nicht. Geprüft in zurückgerollten Transaktionen.
- [x] **AC-9:** Weiterleitungen abgemeldet (`/` → `/login`, `/licenses` → `/login?reason=session`) und angemeldet (→ `/licenses`) stimmen.
- [x] **AC-10:** `GET /sign-out` → 405. `POST /sign-out` → 303, Cookies mit `Max-Age=0`, das alte Cookie wird abgewiesen. Andere Sitzungen desselben Kontos bleiben gültig.
- [x] **AC-11:** Als `authenticated` ist 1 von 9 Trägern sichtbar. Kontingent, Name, Rolle oder Träger ändern, Träger anlegen und Mitgliedschaften anlegen oder löschen → `42501`. Das Kontingent bleibt 5.
- [x] **AC-12:** Konto mit 2 Lizenzen gelöscht. Danach 0 Konten, Identitäten, Sessions, Träger, Mitgliedschaften, Lizenzen und Login-Spuren, auch im Audit-Log.
- [x] **AC-13 (Teilbeleg):** Der Job `license-center-cleanup` ist aktiv (`0 * * * *`), der letzte Lauf `succeeded`, es gibt 0 Einträge älter als 24 h.
- [x] **EC-4, EC-5, EC-6, EC-7, EC-10:** Schreibweise, „nicht zugeordnet“ (auch für die PROJ-2-Action: `unassigned`), Abmelden in einem anderen Tab, Zurücksetzen der Zählung und ein escapeter Trägername `<script>…` in der Kopfzeile. Alles wie erwartet.
- [x] **PROJ-1 `[user]`-Aufgaben:** T1–T4, T8, T16–T18 und T31 sind abgehakt. Offen sind nur die `[user go-live]`-Aufgaben T29, T30 und T32; die gehören zu `/deploy`.
- [!] NOT VERIFIED:
  - **PROJ-1-AC-6 und AC-8 über die App:** echte 5/20 Fehlversuche und die 6. Registrierung. Die Bremse ist für alle Prüfer gemeinsam; belegt sind die Sperre über die App und die Schwellen in der Datenbank.
  - **AC-13:** das echte Löschen nach 24 Stunden.
  - **PROJ-1-EC-1/2/3/8/9** und alles zum Browser (Zurück-Knopf, Browser schließen): kein Browser.

## Unit-Tests (von `/qa` ergänzt)

Die Diff bringt keine neue Logik in `src/`. Die Fehlerklasse von BUG-1 sichert der geänderte Datenbanktest „Regel der Spalte“ (`src/test/db/licenses.test.ts`). `/qa` hat eine Lücke geschlossen, die der Abnahmeprüfer gefunden hat:

- `src/features/licenses/components/assign-license-dialog.test.tsx`, Test „prüft im Browser: leer/ungültig → Meldung am Feld, die Eingabe bleibt, …“ (`:78-89`): Er prüft jetzt auch, dass die Eingabe nach einer Ablehnung im Browser stehen bleibt (AC-5). Bisher war das nur für „schon vergeben“ belegt.
  - Ein Feld vom Typ `email` entfernt Leerzeichen am Rand selbst (HTML-Wertbereinigung). Deshalb erwartet der Test `email.trim()`.
- [x] Die Datei ist grün: `npx vitest run src/features/licenses/components/assign-license-dialog.test.tsx` → 16 bestanden.
- [x] **Rot-Beweis**, eine Runde für die Datei: Der Dialog leerte vorübergehend das Feld nach einer Ablehnung (`form.handleSubmit(submit, () => form.setValue('email', ''))`). Der Fall „ungültig“ schlug fehl, die anderen 15 Tests blieben grün. Danach wurde der Dialog per `git checkout` wiederhergestellt, und die Datei ist wieder grün (16/16).
  - Der Fall „leer“ kann ein geleertes Feld prinzipiell nicht erkennen, weil das Feld `'   '` ohnehin zu `''` bereinigt.

## E2E-Tests
- Status: **nicht gelaufen**. `tests/` existiert noch nicht. Für die kritischen Abläufe `/e2e-tests` ausführen.

## Nicht geprüft in diesem Lauf

- [!] **Browser-Verhalten:**
  - Toasts, Öffnen und Schließen der Dialoge, Fokus, Sperre beim Senden, Escape und Klick daneben (AC-1, AC-4, AC-8, EC-2)
  - dass der Browser den neu gerenderten Baum einspielt (AC-1)
  - Grund: Es gibt keinen Browser; das gehört zu `/e2e-tests`. Belegt sind die Komponententests im Suite-Lauf.
- [!] **Responsive Darstellung bei 375/768/1440 px**, Karten auf dem Smartphone, Umbruch langer Adressen (EC-8). Grund: kein Viewport.
- [!] **Cross-Browser** (Chrome, Firefox, Safari, Edge). Grund: keine Browser-Engine.
- [!] **Echter Verbindungsabbruch, Serverfehler und Ladefehler zur Laufzeit** (EC-5, EC-6). Grund: Das hätte die parallelen Prüfer gestört; belegt sind Code und Tests.
- [!] **Migration als Round-Trip.** Grund: Strategie `single`, kein lokales Supabase. Das Live-Schema wurde stattdessen gegen beide Migrationen geprüft.
- [!] **Postgres-Protokoll von Supabase** auf Teilnehmer-Adressen (AC-11). Grund: Die Supabase CLI v2.119 hat keinen Zugriff auf die Protokolle des gehosteten Projekts; siehe O-1.
- [!] **Rate limiting.** Grund: nicht implementiert, laut Spec Out of Scope (PROJ-3).
- [!] **Brute Force, Account-Enumeration und massenhafte Registrierung.** Grund: PROJ-2 prüft keine Zugangsdaten; das gehört zu PROJ-1.
- [!] **Sicherheitsheader gegen eine Live-URL.** Grund: Es gibt kein Deployment.
- [!] **PROJ-1 `[user go-live]`-Aufgaben T29, T30, T32:** NOT VERIFIED — go-live, wird in `/deploy` gemacht und geprüft. In der Testumgebung geprüft: Ohne Turnstile-Token wird abgelehnt (PROJ-1 AC-7).

## Bugs

#### BUG-1: Datenbank nimmt am Formular vorbei Adressen an, die die App ablehnt
- **Severity:** Medium
- **Status:** Fixed (2026-10-26, re-verified). Behoben in `7aaf680` durch die Migration `20261026120000_proj2_licenses_email_rule.sql`.
- **Class:** Die Prüfregel an der Datenbank-Schnittstelle ist schwächer als das Schema der App. Die Validierung gilt nur in der App, obwohl die Spec sie für jeden Weg am Formular vorbei verlangt.
- **Sweep:** `grep -nE "constraint [a-z_]+_check check" supabase/migrations/*.sql` → 4 Treffer, nichts außer den erlaubten:
  - `20261025120000_proj2_licenses.sql:27`: die alte Fassung von `licenses_email_check`. Sie wird von `20261026120000_proj2_licenses_email_rule.sql:13` ersetzt; live existiert nur die neue.
  - `20261026120000_proj2_licenses_email_rule.sql:14`: die neue Fassung, gleich `z.email()`.
  - `training_provider_members_role_check` und `license_center_login_lockouts_scope_check`: geschlossene Wertelisten ohne Lücke.
  - Breiterer Gegen-Sweep `grep -nE "check *\(" supabase/migrations/*.sql | grep -v "with check"` → 10 Treffer. Daneben stehen nur Wertelisten sowie Längen- und Normalformregeln von PROJ-1, keine weitere E-Mail-Formatregel, die schwächer als die App wäre.
- **Nachprüfung:**
  - Die drei Nutzlasten aus der Reproduktion → 400 `23514`.
  - 40 Umgehungsversuche abgelehnt.
  - 72 knifflige Adressen und 2 × mehrere tausend erzeugte Adressen ergeben 0 Abweichungen zwischen App und Spalte (siehe AC-5 und Security).
- **Steps to Reproduce** (ursprünglich):
  1. Als Verwalter A anmelden und das Zugriffstoken aus dem Cookie `sb-<ref>-auth-token` nehmen.
  2. `curl -X POST <projekt-url>/rest/v1/licenses -H "apikey: <publishable>" -H "Authorization: Bearer <token>" -H 'Content-Type: application/json' -d '{"training_provider_id":"<A>","email":"<script>alert(1)</script>@example.com"}'`
  3. Erwartet: abgelehnt, wie über die App.
  4. Am 2026-10-25: 201, die Lizenz war angelegt. Am 2026-10-26: 400 `23514`, nichts angelegt.

## Beobachtungen (kein Bug, zur Kenntnis)

- **O-1, Adresse im Datenbank-Protokoll (zu AC-11), genauer beurteilt:** Der Regelverstoß wurde per SQL mit Rollback nachgestellt (`GET STACKED DIAGNOSTICS pg_exception_detail`).
  - Als `authenticated`, also über die App und PostgREST mit dem Token eines Verwalters, sind die Fehlerdetails leer. Postgres unterdrückt „Failing row contains“, wenn RLS für den Aufrufer greift.
  - Als `service_role` enthalten die Details die Zeile samt Adresse.
  - Live gilt `log_parameter_max_length_on_error=0`: Bind-Parameter landen nicht im Protokoll.
  - Folge: Über die Wege der App gelangt keine Adresse ins Protokoll; mit `service_role` oder über die Tabellenansicht des Anbieters schon. **Für PROJ-3 wichtig**, falls ein Server-Pfad mit `service_role` Adressen schreibt. Das Protokoll selbst wurde nicht eingesehen.
- **O-2, Transaktionssperre auf einen fremden Träger:** unverändert, die Prüffunktion ist per md5 identisch. Die Sperre wird vor der Sichtbarkeitsprüfung genommen, hält nur bis zum Ende der eigenen, sofort abgebrochenen Transaktion und ist praktisch folgenlos.
- **O-3, Fortschrittsbalken:** `src/components/ui/progress.tsx` (shadcn) rendert weiterhin `data-state="indeterminate"`. Die ARIA-Werte aus `quota-summary.tsx` stimmen. Bekannt und in `design.md` dokumentiert.
- **O-4, Zwei Seitentitel im gestreamten HTML:** in diesem Lauf nicht erneut geprüft. Am 2026-10-25 stammte der zweite aus dem Skeleton von `loading.tsx`, und die Diff berührt keinen App-Code.
- **O-5, Altes Token nach dem Abmelden:** An der Datenbank-Schnittstelle bleibt es bis zum Ablauf gültig. Das ist PROJ-1 BUG-7 (Deferred); die App selbst weist es ab.
- **O-6, Kelvin-Zeichen (neu):** `toLowerCase()` macht aus „K“ (U+212A) ein ASCII-„k“. Die App nimmt eine Adresse mit diesem Zeichen an und speichert die ASCII-Form. Die Liste zeigt die gespeicherte Form, also kein Widerspruch zur Spec. Für PROJ-3 gut zu wissen: Die Mail geht an die ASCII-Form.
- **O-7, Bremszeilen aus dem Suite-Lauf (neu):** Die Datenbanktests lassen ihre Login- und Registrierungsversuche liegen. Das sind rund 90 Login-Versuche, 23 Registrierungen und 10 Sperren unter `2001:db8:…`-IPs und `example.com`-Adressen. Der Cron-Job löscht sie nach spätestens 24 h, unter `0.0.0.0` stören sie nicht. Nur Test-Hygiene.
- **O-8, `public.rls_auto_enable` (neu, außerhalb PROJ-2):** Eine Security-Definer-Funktion mit `EXECUTE` für `anon` und `authenticated`. Sie gehört zu einem Event-Trigger, offenbar von Supabase angelegt, nicht in `supabase/migrations/`. Als Event-Trigger-Funktion ist sie per RPC nicht aufrufbar. Nicht weiter geprüft.

## Zusammenfassung
- **Akzeptanzkriterien:** 12 von 12 bestanden. Die Browser-Teile von AC-1, AC-4 und AC-8 sind nicht geprüft.
- **Edge Cases:** 10 von 10 bestanden. Die Browser- und Laufzeit-Teile von EC-2, EC-5, EC-6 und EC-8 sind nicht geprüft.
- **Bugs:** 1 insgesamt (0 Critical, 0 High, 1 Medium, 0 Low). Fixed: 1 (BUG-1, in diesem Lauf nachgeprüft). Open: 0, Deferred: 0. Neue Bugs in diesem Lauf: 0.
- **Security:** 11 von 15 Prüfpunkten geprüft, alle bestanden. 4 sind NOT VERIFIED: Rate limiting (Out of Scope), Brute Force und Login-Enumeration (beide PROJ-1) sowie die Header gegen eine Live-URL (kein Deployment).
- **Regression:** PROJ-1 ohne Regression, Suite 595/595, keine geschwächten Prüfungen.
- **Production Ready:** JA. Es gibt keinen offenen Bug, und alle Akzeptanzkriterien wurden gegen die laufende App ausgeübt.
- **Empfehlung:** Approved. Vor PROJ-3 die Beobachtung O-1 lesen (`service_role` und Adressen im Protokoll).

> „Production Ready: JA“ heißt *keine Critical/High-Bugs*. Es heißt **nicht**, dass alles geprüft wurde. Die Punkte unter „Nicht geprüft in diesem Lauf“ sind offen und brauchen einen Menschen oder `/e2e-tests`.
