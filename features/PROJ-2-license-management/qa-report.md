# QA-Testergebnisse: PROJ-2 Lizenzverwaltung

**Getestet:** 2026-10-25 (erster `/qa`-Lauf)
**App-URL:** http://localhost:3001
- Gestartet als `npm run dev -- -p 3001`, einmal von der `/qa`-Sitzung.
- Port 3000 aus `probe.baseUrl` war von einem anderen Projekt belegt.

**Tester:** QA Engineer (KI). Drei unabhängige `qa-engineer`-Prüfer ohne Build-Kontext, parallel und mit getrennten Bereichen:
- Abnahme (Step 2)
- Security (Step 3)
- Regression (Step 4 und 5)

Zusammengeführt hat die `/qa`-Sitzung. Der erste Security-Prüfer blieb ab 17:57 ohne Bericht stehen. Er wurde um 19:36 gestoppt und durch einen frischen Prüfer mit demselben Auftrag ersetzt. Nur dessen Befunde stehen hier.

**Umfang:** `full` (erster Lauf). Branch `feat/PROJ-2-license-management` auf Commit `d354b40`.

> Legende:
> - `[x]` in diesem Lauf geprüft (mit Beleg)
> - `[ ] BUG` als fehlerhaft geprüft
> - `[!] NOT VERIFIED` in diesem Lauf nicht prüfbar (mit Grund)

**So wurde geprüft:**
- **Server Actions** per HTTP direkt aufgerufen, am Formular vorbei: `POST /licenses` mit dem Kopf `Next-Action`. Die IDs stammen aus `.next/dev/server/server-reference-manifest.json`.
- **Seite:** Das server-gerenderte HTML von `/licenses` wurde ausgewertet. Antworten der Actions enthalten den neu gerenderten Baum.
- **Datenbank-Schnittstelle (PostgREST)** direkt angesprochen, mit dem öffentlichen Schlüssel und dem Zugriffstoken aus dem Sitzungs-Cookie.
- **Datenbank** direkt per `env -u SUPABASE_ACCESS_TOKEN supabase db query --linked`. Für Rechte-Tests lief SQL mit `set local role authenticated` und eigenen JWT-Claims, jeweils mit Rollback.
- **Testkonten:** fünf Verwalter `qa2-…-1025@example.com` mit je eigenem Träger, angelegt über die Registrierung der App. Teilnehmer-Adressen nur aus `example.com`.
- **Gemeinsame Bremse:** Lokal zählen alle Logins und Registrierungen unter `0.0.0.0`. Deshalb bekam jeder Prüfer eigene Konten und ein festes Budget. Die eigenen Bremszeilen wurden gelöscht.
- **Aufräumen:**
  - Alle Testkonten sind gelöscht, ein Teil davon als Probe für AC-11.
  - Endstand per SQL: 0 Konten `qa2-%`, 0 Träger `QA2%`, 0 Lizenzen `qa2%`.
  - Außerdem 0 Login-Versuche und 0 Sperren `qa2%`. Unter `0.0.0.0` gibt es 0 Registrierungen in der letzten Stunde.

**Suite-Lauf** (einmal vor den Prüfern, `npm test`): 27 Dateien, 591 Tests bestanden, 0 fehlgeschlagen, exit 0.

**Weitere Läufe:**
- `npm run build`: exit 0. `/licenses` ist dynamisch (ƒ). Der Build lief neben dem Dev-Server; Next.js 16 trennt `.next/dev` und `.next`.
- `npm run lint`: exit 0
- `npm run typecheck`: exit 0
- `npm run check:structure`: „118 modules scanned, 0 errors“
- **Migration:** [!] NOT VERIFIED, kein Round-Trip (`db reset`). Die Strategie ist `single`: Es gibt kein lokales Supabase, und ein Reset des gehosteten Projekts würde alle Daten löschen.
  - Ersatz: Das Live-Schema wurde gegen `supabase/migrations/20261025120000_proj2_licenses.sql` geprüft: Rechte, Spaltenrechte, RLS-Regeln, Prüffunktion, Trigger, Löschkaskade und Spalten (siehe Security).

## Akzeptanzkriterien

#### AC-1: Anzeige „X von Y vergeben“, „Z frei“ und Balken, aktuell ohne Neuladen
- [x] Nach zwei Zuweisungen zeigt `curl -b … /licenses` „2 von 5 Lizenzen vergeben“ und „3 frei“.
- [x] Der Balken trägt `role="progressbar" aria-valuenow="40" aria-valuetext="2 von 5 Lizenzen vergeben"`, die Füllung `translateX(-60%)`, also 40 %.
- [x] Ohne Neuladen: Jede Action-Antwort trägt `x-action-revalidated` und den neu gerenderten Baum. Nach dem Zuweisen stand dort „1 von 5“/„4 frei“, nach dem Entziehen „2 von 5“/„3 frei“. `refresh()` steht in `src/features/licenses/licenses.actions.ts:28,31,34,52,55`.
- [!] NOT VERIFIED: dass der Browser den mitgelieferten Baum wirklich einspielt. Dafür braucht es einen Browser.

#### AC-2: Liste aller Lizenzen mit Adresse und Datum, neueste oben, je mit „Entziehen“
- [x] Die neueste steht oben: teilnehmer2 (16:46:42) vor teilnehmer1 (16:46:34). Jede Zeile hat `<time dateTime=…>25.10.2026</time>` und einen Knopf „Entziehen“ mit `aria-label="Lizenz von … entziehen"`.
- [x] Tabelle und Karten stehen beide im HTML.
- [x] Sortierung nach `assigned_at` absteigend, dann `id`: `src/features/licenses/licenses.data.ts:32-33`.

#### AC-3: Leere Liste mit Aufforderung
- [x] Bei 0 Lizenzen steht auf der Seite „0 von 5 Lizenzen vergeben | 5 frei | Vergebene Lizenzen | Noch keine Lizenz vergeben. Weisen Sie die erste zu. | Lizenz zuweisen“.
- [x] Der zweite Knopf ist die Outline-Variante: `src/features/licenses/components/license-list.tsx:46`.

#### AC-4: Zuweisen legt die Lizenz an, oben in der Liste, Zählung +1/−1, „Lizenz zugewiesen“
- [x] Die Action antwortet `{"status":"assigned"}`. Die Zeile liegt beim eigenen Träger und steht oben in der Liste. Die Zählung geht um eins nach oben bzw. unten.
- [x] Der Toast-Text „Lizenz zugewiesen“ steht in `licenses.rules.ts:24`, die Zuordnung in `licenses.rules.ts:126`, ausgelöst in `assign-license-dialog.tsx:72`.
- [!] NOT VERIFIED: der sichtbare Toast und das Öffnen und Schließen des Dialogs. Dafür braucht es einen Browser; belegt sind nur die Komponententests im Suite-Lauf.

#### AC-5: Leere oder ungültige Adresse wird abgelehnt, auch am Formular vorbei
- [x] Über die Action am Formular vorbei kommt immer `field_error`, und es entsteht keine Zeile:
  - `""` und `"   "` → „Bitte geben Sie die E-Mail-Adresse des Teilnehmers ein.“
  - `abc`, `a@b`, `a b@example.com`, 255 Zeichen, 50 KB, 1.001 Leerzeichen plus Adresse, `<script>@example.com`, SQL-Reste und `\u0000` → „Bitte geben Sie eine gültige E-Mail-Adresse ein.“
  - eine Zahl, ein fehlendes Feld, `__proto__` → Meldung „leer“
  - `[]` und `[null]` → `failed`
  - Schema: `src/features/licenses/licenses.schema.ts:22-31`
- [x] Die Eingabe bleibt stehen: `setError` ohne Reset (`assign-license-dialog.tsx:77`), Test `assign-license-dialog.test.tsx:105`.
- [ ] **BUG-1:** Direkt über die Datenbank-Schnittstelle gelten nicht dieselben Regeln. PostgREST nimmt mit dem eigenen Token Adressen an, die die App ablehnt, z. B. `<script>alert(1)</script>@example.com` (201). Siehe BUG-1.

#### AC-6: Dieselbe Adresse ein zweites Mal beim eigenen Träger wird abgelehnt, beim fremden Träger nicht
- [x] `"  QA2ACC-Teilnehmer1@Example.COM  "` bei bestehender Lizenz → „Diese E-Mail-Adresse hat bereits eine Lizenz.“. Das Kontingent bleibt gleich. Das gilt auch bei vollem Kontingent: Die Prüfung auf Duplikat kommt vor dem Kontingent (Migration `:120-127`).
- [x] Eine Adresse, die nur ein anderer Träger hat, wird normal zugewiesen. Die Antwort verrät nichts über den anderen Träger (zwei Prüfer unabhängig: `o'brien--x@example.com` bzw. `QA2-SEC-B-P1@example.com`).
- [x] Großbuchstaben direkt über PostgREST → 400 `23514` (Regel der Spalte, Migration `:29`).

#### AC-7: Volles Kontingent sperrt das Zuweisen, auch an der Oberfläche vorbei
- [x] Bei 5 von 5 zeigt die Seite „0 frei“ und „Ihr Kontingent ist ausgeschöpft. Für weitere Lizenzen wenden Sie sich an den Anbieter.“.
  - Knopf: `<button disabled aria-describedby="license-quota-notice">`
  - Hinweis: `role="alert" id="license-quota-notice"`
- [x] Die Action antwortet `exhausted`. Direkt über PostgREST und als `authenticated` in SQL kommt `P0001 license_quota_exhausted`, auch bei mehreren Zeilen in einer Anweisung. Zu keinem Zeitpunkt gab es mehr Lizenzen als das Kontingent.
- [x] Trigger: Migration `:130-135`.

#### AC-8: Entziehen mit Bestätigung, Lizenz sofort wieder frei
- [x] Die Action antwortet `{"status":"revoked"}`. Die Antwort zeigt eine freie Lizenz mehr, die Adresse kommt 0-mal vor, in der Datenbank ist die Zeile weg.
- [x] Dieselbe Adresse sofort neu zugewiesen → `assigned`, mit neuer ID.
- [x] Dialogtexte in `licenses.rules.ts:44-52` und `revoke-license-dialog.tsx:89-93`. „Abbrechen“ entzieht nichts (Test `revoke-license-dialog.test.tsx:70`).
- [!] NOT VERIFIED: den Bestätigungsdialog selbst und den Toast „Lizenz entzogen“ im Browser.

#### AC-9: Kontingent unter die vergebene Zahl gesenkt
- [x] Kontingent per SQL auf 3 gesenkt, bei 4 vergebenen Lizenzen:
  - Die Seite zeigt „4 von 3 Lizenzen vergeben | 0 frei“ und den Hinweis „Ihr Kontingent ist überschritten. …“ wortgleich.
  - Der Knopf ist `disabled`, der Balken steht bei `aria-valuenow="100"`, alle 4 Lizenzen bleiben bestehen.
  - Zuweisen → `exhausted`.
- [x] Nach einem Entziehen steht „3 von 3“ mit dem Hinweis „ausgeschöpft“, der Knopf bleibt gesperrt. Geprüft wurde „4 von 3“ statt „5 von 3“; das ist derselbe Codepfad (`licenses.rules.ts:68-73`), und der Unit-Test prüft 5 von 3.

#### AC-10: Datentrennung zwischen zwei Trägern, auch direkt über die Datenbank-Schnittstelle
- [x] **Echt über PostgREST**, mit dem Token von A gegen die Daten von B:
  - GET liefert nur die Zeilen von A. GET mit dem Filter auf B und GET der B-Lizenz per `id` → `[]`.
  - POST für B → 403 `42501 training_provider_not_accessible`, auch mit einer Adresse, die B schon hat. Ein nicht vorhandener Träger gibt dieselbe Antwort.
  - Bulk-POST [A, B] → 42501, die ganze Anweisung wird abgelehnt.
  - PATCH einer B-Lizenz und PATCH der eigenen Lizenz nach B → 403.
  - DELETE der B-Lizenz → 200 `[]`, B behält seine Zeilen.
  - POST mit `id` oder `assigned_at` → 403 (kein Spaltenrecht). Upsert auf die ID einer B-Lizenz → 403.
  - Ohne Token (`anon`): GET, POST und DELETE → 401.
  - `/rpc/enforce_license_rules` → 404. Schema `private` per `Accept-Profile` → 406.
- [x] **Über die App:** `revokeLicense` mit der ID von B → `already_revoked`, auch mit mitgeschicktem `trainingProviderId` von B; die Zeile bleibt. `assignLicense` mit dem Träger von B im Rumpf legt die Lizenz bei A an.
- [x] **Gefälschte Tokens:** `sub` auf B umgeschrieben → 401 `PGRST301`. `alg:none` → 401.
- [x] **Kontingent schreibgeschützt:** PATCH `training_providers.license_quota=999` mit dem Token von A → 403, der Wert bleibt 5.

#### AC-11: Nach Entziehen oder Löschen ist die Adresse vollständig weg
- [x] **Nach dem Entziehen:** Eine Volltextsuche (`to_jsonb`) über alle Tabellen in `public` und `private` findet die Adressen 0-mal. Auf `licenses` liegt kein Audit-Trigger, nur die beiden RI-Trigger und `enforce_license_rules`.
- [x] **Konto des Verwalters gelöscht** (`delete from auth.users …`), mit 3 bzw. 2 Lizenzen am Träger, von zwei Prüfern unabhängig: Danach gibt es 0 Lizenzen, 0 Träger, 0 Mitgliedschaften und 0 Konten.
- [x] Die Löschkaskade ist live `confdeltype='c'` (Migration `:16-17`). Die Fehlertexte des Triggers enthalten keine Adresse (Migration `:115,126,134`).
- [!] NOT VERIFIED: das Postgres-Protokoll von Supabase. Siehe Beobachtung O-1.

#### AC-12: Nur Adresse und Zeitpunkt, keine weiteren Angaben
- [x] Die Live-Spalten sind genau `id uuid, training_provider_id uuid, email text, assigned_at timestamptz` (information_schema; Migration `:13-31`).
- [x] Das Insert-Recht gilt nur für `training_provider_id` und `email` (Migration `:84`). `id` und `assigned_at` setzt die Datenbank (siehe AC-10: 403).

## Edge Cases

#### EC-1: Letzte freie Lizenz gleichzeitig an zwei Adressen
- [x] **Garantie:** `pg_advisory_xact_lock` pro Träger, danach wird gezählt (Migration `:108`, `:130-135`).
- [x] **Provoziert, zweimal unabhängig:**
  - 4 gleichzeitige Actions → 1 `assigned`, 3 `exhausted`
  - 6 gleichzeitige PostgREST-POSTs → 1 × 201, 5 × `P0001`
  - Danach gibt es jeweils genau so viele Lizenzen wie das Kontingent.
- [x] Die Antwort auf `exhausted` zeigt den aktuellen Stand („5 von 5“, „0 frei“, Hinweis).

#### EC-2: Mehrfachklick / dieselbe Adresse gleichzeitig
- [x] **Garantie:** Trigger-Schritt 3 vor dem Kontingent (Migration `:120-127`) und der eindeutige Schlüssel (Migration `:23`).
- [x] **Provoziert:** 4 bzw. 5 gleichzeitige Anfragen mit derselben Adresse auf die letzte freie Lizenz → genau 1 `assigned`, die übrigen „Diese E-Mail-Adresse hat bereits eine Lizenz.“ (nicht „ausgeschöpft“). In der Datenbank liegt 1 Zeile.
- [x] Der Knopf ist beim Senden gesperrt: `assign-license-dialog.tsx:150` (`disabled={sending}`), Test `assign-license-dialog.test.tsx:158`.
- [!] NOT VERIFIED: Sperre, Escape und Klick daneben im echten Browser.

#### EC-3: Dieselbe Lizenz in zwei Tabs entziehen
- [x] **Garantie:** DELETE nach ID und Träger, die Zahl der zurückgegebenen Zeilen entscheidet (`licenses.data.ts:76-84`).
- [x] Ein zweites Entziehen → `already_revoked`, mit aufgefrischtem Stand.
- [x] 3 gleichzeitige Anfragen → genau 1 `revoked`, 2 `already_revoked`. Die Zählung sinkt um genau 1.

#### EC-4: Kontingent 0, keine Lizenz
- [x] Die Seite zeigt „0 von 0 Lizenzen vergeben | 0 frei“ und den Hinweis aus AC-7, ohne den Abschnitt mit der leeren Liste.
- [x] Der Knopf ist `disabled`, der Balken steht auf 100 %. Zuweisen → `exhausted`.
- [x] Bei Kontingent 1 steht „0 von 1 Lizenz vergeben“ (Einzahl).

#### EC-5: Verbindungsabbruch / Serverfehler
- [x] Jede Aktion ist genau eine Anweisung an die Datenbank (`licenses.data.ts:53-57,76-81`).
- [x] Meldungen: `TypeError` → „Keine Verbindung“, alles andere → „Das hat nicht geklappt“ (`licenses.rules.ts:156-161`).
- [x] Die Eingabe bleibt stehen (`assign-license-dialog.tsx:78`, Test `:141`); für Entziehen die Tests `revoke-license-dialog.test.tsx:114,127`.
- [!] NOT VERIFIED: ein echter Verbindungsabbruch oder Serverfehler zur Laufzeit. Den Server oder Supabase zu stören hätte die parallelen Prüfer gestört.

#### EC-6: Lizenzen lassen sich nicht laden
- [x] Bei einem Fehler oder einer Ausnahme kommt `load_error`, nie eine leere Liste (`licenses.data.ts:34,39-41`).
- [x] Die Seite rendert dann nur den Titel und `LicensesLoadError` (`src/app/(app)/licenses/page.tsx:28-35`).
- [x] Tests: `licenses.data.test.ts:147,153` und `licenses-load-error.test.tsx:15,23`.
- [!] NOT VERIFIED: ein echter Ladefehler zur Laufzeit. Dafür hätte man Rechte entziehen müssen, was die parallelen Prüfer gestört hätte.

#### EC-7: Abgemeldet bzw. nicht zugeordnet
- [x] **Abgemeldet:** Beide Actions ohne Cookie, mit kaputtem Cookie und mit dem Cookie nach `POST /sign-out` → `x-action-redirect: /login?reason=session`. Es entsteht und verschwindet nichts.
  - `/login?reason=session` zeigt „Bitte melden Sie sich erneut an.“.
  - Nach dem Löschen des Kontos leitet `/licenses` mit dem alten Cookie per 307 dorthin.
- [x] **Nicht zugeordnet**, zur Laufzeit geprüft vom Regressionsprüfer: Träger des eigenen Kontos per SQL gelöscht.
  - `assignLicense` und `revokeLicense` → `"status":"unassigned"`.
  - `/licenses` zeigt nur `role="alert"` mit „Ihr Konto ist keinem Bildungsträger zugeordnet. Bitte wenden Sie sich an den Anbieter.“.
  - 0 Treffer für Anzeige, „Lizenz zuweisen“ und Liste.
  - Im Code steht der Wächter vor Schema und Datenzugriff (`licenses.actions.ts:15-17,44-47`).

#### EC-8: Lange Adressen und Sonderzeichen
- [x] Eine Adresse mit 254 Zeichen wurde zugewiesen und vollständig gelistet.
- [x] HTML-Nutzlasten, direkt über die Datenbank angelegt (`<svg/onload=alert(1)>`, `<script>`), stehen im HTML nur escaped (`&lt;…&gt;`), roh 0-mal. `dangerouslySetInnerHTML` kommt in `src/` 0-mal vor. Der Dialogtitel ist ein Textknoten (`revoke-license-dialog.tsx:90`).
- [x] Umbruch per `[overflow-wrap:anywhere]` (`license-list.tsx:30,67,81`, `revoke-license-dialog.tsx:89`), Knopf mit `shrink-0` (`revoke-license-dialog.tsx:84`), Karten unter `md` (`license-list.tsx:56,77`).
- [!] NOT VERIFIED: der tatsächliche Umbruch, die Karten auf dem Smartphone ohne seitliches Scrollen und ob „Entziehen“ erreichbar bleibt. Es gibt keinen Viewport.

#### EC-9: Eigene Adresse des Verwalters
- [x] `QA2-ACC-A-1025@example.com` (das eigene Konto) → `assigned`. Sie zählt ins Kontingent (4 von 5) und wird kleingeschrieben gelistet.

#### EC-10: Kontingent ändert sich bei offener Seite
- [x] Die Seite wurde bei „3 von 5“ geladen, danach das Kontingent per SQL auf 3 gesenkt: Zuweisen → `exhausted`, die Antwort zeigt „3 von 3“ und den Hinweis. Danach auf 4 erhöht: Zuweisen → `assigned`, „4 von 4“.
- [x] **Garantie:** Der Trigger liest das Kontingent beim Anlegen (Migration `:111-116`).

#### Zusätzliche Edge Cases
- [x] Mehrere Zeilen in einer Anweisung direkt an der Datenbank: 6 Zeilen bei Kontingent 5 → `P0001`; ein Duplikat in einer Anweisung → `23505`. Der BEFORE-ROW-Trigger sieht die vorher eingefügten Zeilen derselben Anweisung.
- [x] Entziehen mit kaputter ID (`nope`, `{}`, eine Adresse statt UUID, SQL-Rest, Array, `*`) → `failed`.
- [x] Server Action mit fremdem `Origin: https://evil.example` → 500 „Invalid Server Actions request.“, 0 Zeilen (CSRF wird abgewehrt).
- [x] `GET /licenses?email=…` legt nichts an.

## Security-Audit

- [x] **Authentifizierung:**
  - `GET /licenses` ohne Sitzung → 307 auf `/login?reason=session`.
  - Beide Actions ohne Sitzung → Weiterleitung, nichts angelegt.
  - Der Wächter fragt `getUser` (`session.data.ts:35`), die Actions rufen ihn zuerst (`licenses.actions.ts:16,44`).
- [x] **Autorisierung:** A gegen B über PostgREST, über die Actions und per SQL als `authenticated`, siehe AC-10. Abgeglichen mit `design.md` → „Zugriffsregeln in der Datenbank“, live bestätigt:
  - **Rechte:** erst `revoke all`, dann `authenticated` SELECT und DELETE, INSERT nur auf `(training_provider_id, email)`, kein UPDATE, `anon` ohne Recht (Migration `:81-86`; `role_table_grants` und `column_privileges` stimmen überein).
  - **RLS:** eingeschaltet (`:38`). Drei Regeln (`:42,55,68`) verlangen `role='admin'` und `(select auth.uid())`; live zeigt `pg_policies` genau diese drei.
  - **Prüffunktion:** security invoker mit `search_path=''` (`:95-139`). Live `prosecdef=false`, das Ausführen ist entzogen (`:146-147`).
  - **Trigger:** BEFORE INSERT FOR EACH ROW (`:141-143`), aktiv.
- [x] **Eingaben über die App:** XSS-, SQL- und Steuerzeichen-Nutzlasten werden vom Schema auf dem Server abgelehnt (siehe AC-5). Datenzugriff nur über supabase-js, ohne SQL-Strings und ohne Filter nach einer Adresse (`licenses.data.ts:28-33,51-55,76-81`). Gespeicherte Nutzlasten werden escaped ausgegeben (EC-8).
- [ ] **BUG-1: Eingaben direkt an der Datenbank-Schnittstelle** sind schwächer geprüft als in der App (siehe AC-5).
- [!] **Rate limiting:** NOT VERIFIED, nicht implementiert. Es ist laut Spec Out of Scope (die Grenze kommt in PROJ-3).
  - Gemessen: 30 Zuweisungen in 12 s ohne Drosselung, 30 Entziehen ebenso.
  - `grep -rln "rateLimit|rate_limit|throttle" src/features/licenses supabase/migrations/*proj2*` → 0.
  - Die Kontingent-Grenze greift trotzdem.
- [!] **Brute Force auf Zugangsdaten:** NOT VERIFIED, entfällt. PROJ-2 hat keinen Login, keine Registrierung und keine eigene Prüfung von Zugangsdaten; das ist PROJ-1. `tasks.md:6-7`: keine `[user]`- und keine `[user go-live]`-Aufgaben.
- [!] **Account-Enumeration beim Login:** NOT VERIFIED, entfällt (PROJ-1).
- [x] **Keine Ausforschung fremder Daten:** Fremder und nicht vorhandener Träger antworten beide mit `42501`. „Schon vergeben“ bei einem fremden Träger verrät nichts (AC-6, AC-10). Eine fremde Lizenz-ID sieht aus wie „bereits entzogen“.
- [x] **Keine Zugangsdaten oder Adressen in der URL:** `<form method="post" noValidate onSubmit=…>` (`assign-license-dialog.tsx:129`, `handleSubmit` in `:94`). Entziehen sendet nur die ID (`revoke-license-dialog.tsx:62`). Im Datenzugriff gibt es 0 Filter nach `email`.
- [x] **Keine Geheimnisse im Client-Bundle:**
  - Im Build-Output `.next/static` (1,2 MB) gibt es 0 Treffer für `sb_secret_`, `service_role`, `SERVICE_ROLE`, `SUPABASE_SECRET`, `TURNSTILE_SECRET`, `TRUSTED_PROXY`, `eyJhbGciOi` (also kein JWT), `sb_publishable_` und die Turnstile-Test-Secrets.
  - In `.next/dev/static` (72 Chunks) ebenso 0.
  - Server-Variablen tragen kein `NEXT_PUBLIC_` (`grep -rhoE "process\.env\.[A-Z_]+" src`).
- [x] **Keine Geheimnisse in der Git-Historie:** `git log --all -p` mit dem Muster für `sb_secret_…`, `sk_live`, `re_…` und `0x4AAAA…` → 0 Treffer.
- [x] **Keine sensiblen Daten in Antworten:** Die Actions antworten nur `{"status":…}`, bei Feldfehlern zusätzlich mit `message`. Im HTML/RSC von `/licenses` stehen 0-mal Träger-ID, Nutzer-ID, Daten des anderen Trägers, `access_token`, `refresh_token`, `license_quota` und `training_provider_id`.
- [x] **Sicherheitsheader lokal:** `X-Frame-Options: DENY`, `nosniff`, `origin-when-cross-origin`, HSTS mit `includeSubDomains`, `Cache-Control: no-store` (`curl -I /licenses`). Das Auth-Cookie ist HttpOnly.
- [!] **Sicherheitsheader live:** NOT VERIFIED, es gibt kein Deployment.

## Regression (PROJ-1 Konto & Login)

Kein Feature steht auf „Deployed“. Geprüft wurde das verwandte PROJ-1 (Approved). Es teilt mit PROJ-2 den Rahmen, den Wächter, die Seite `/licenses`, `form-feedback.tsx` und `training_providers`. Die Diff `main..HEAD` berührt davon nur `form-feedback.tsx` (verschoben, Prop `message` statt `error`), die Importe in `login-form.tsx`/`register-form.tsx`, `/licenses` und die neue Migration.

- [x] **Suite:** 591/591 grün, darunter `login-form.test.tsx`, `register-form.test.tsx` und das verschobene `form-feedback.test.tsx`.
  - Keine geschwächten Prüfungen: `grep -rnE "\.(skip|only|todo)\(|\bxit\(|\bfit\(|skipIf|runIf" src --include='*.test.ts*'` → 0.
  - `git diff main..HEAD -- package.json vitest.config.mts` ist leer.
- [x] `tsc --noEmit` belegt, dass alle 4 Aufrufer von `FormAlert` die neue Prop nutzen: `login-form.tsx:105`, `register-form.tsx:133`, `assign-license-dialog.tsx:154`, `revoke-license-dialog.tsx:96`.
- [x] **AC-1:** Registrierung mit Großbuchstaben, Leerzeichen und Zusatzfeldern `licenseQuota:999`, `role:"owner"` → `/licenses`. In der Datenbank: Kontingent 5, Rolle `admin`.
- [x] **AC-2:** Alle 4 Feldfehler gleichzeitig. Kein Bremseintrag, kein Träger.
- [x] **AC-3:** Duplikat → Meldung mit Login-Link, kein Cookie, 1 Konto.
- [x] **AC-4:** Der Login führt zu `/licenses` (200) mit Kopfzeile, Trägername und Abmelden-Formular (`method="post"`). Der Platzhalter ist weg, wie PROJ-1-AC-4 es vorsieht.
- [x] **AC-5:** Falsches Passwort und unbekannte Adresse → wortgleiche Meldung (1,12 s bzw. 1,01 s).
- [x] **AC-6:** Sperre per SQL gesetzt. Richtiges Passwort → „Zu viele Anmeldeversuche. … in 3 Minuten …“, kein Cookie, nichts gespeichert.
- [x] **AC-7:** Ohne Turnstile-Token → „Die Sicherheitsprüfung ist fehlgeschlagen. …“.
- [x] **AC-9:** Weiterleitungen abgemeldet (`/` → `/login`, `/licenses` → `/login?reason=session`) und angemeldet (→ `/licenses`) stimmen.
- [x] **AC-10:** `POST /sign-out` → 303, Cookies `Max-Age=0`, das alte Cookie wird abgewiesen.
- [x] **AC-11:** Als `authenticated` sind 1 von 8 Trägern sichtbar. `update license_quota`, `name`, `role`, `insert` und `delete` → `42501`. Die Grants sind unverändert.
- [x] **AC-12:** Konto mit 2 Lizenzen gelöscht. Danach 0 Konten, Träger, Mitgliedschaften, Lizenzen, Sessions, Login-Spuren. Das Audit-Log hat 0 Zeilen. Der neue Kaskadenpfad wirkt mit dem Trigger `delete_orphaned_training_provider` zusammen.
- [x] **AC-13 (Teilbeleg):** Der Job `license-center-cleanup` ist aktiv, der letzte Lauf `succeeded`, es gibt 0 Einträge älter als 24 h.
- [x] **EC-4, EC-5, EC-6, EC-7, EC-10:** Schreibweise, „nicht zugeordnet“, Abmelden in einem anderen Tab, Zurücksetzen der Zählung und ein escapeter Trägername `<script>…` in der Kopfzeile der neuen Seite. Alles wie erwartet.
- [!] NOT VERIFIED:
  - **PROJ-1-AC-6 und AC-8:** echte 5/20 Fehlversuche und die 6. Registrierung. Die Bremse ist für alle Prüfer gemeinsam; Code und Migration der Bremse sind nicht in der Diff.
  - **AC-13:** das echte Löschen nach 24 Stunden.
  - **PROJ-1-EC-1/2/3/8/9:** im Browser.

## Unit-Tests (von `/qa` ergänzt)

Die Module von PROJ-2 hatte `/build` schon breit getestet. `/qa` hat die Lücken geschlossen, die beim Durchgehen auffielen:

- `src/features/licenses/licenses.schema.test.ts` (+9 Tests):
  - Tab, Zeilenumbruch, Wagenrücklauf und geschütztes Leerzeichen am Rand werden wie Leerzeichen entfernt. Das betrifft eingefügte Adressen (AC-6).
  - Genau 1.000 Zeichen mit Rand-Leerzeichen sind noch keine Überlänge.
  - Ungültig sind: kein Teil vor dem @, zwei @, ein Punkt am Anfang, zwei Punkte hintereinander, ein Leerzeichen in der Domain (AC-5).
- `src/features/licenses/licenses.rules.test.ts` (+2 Tests): 4 von 5 ist die letzte freie Lizenz und „verfügbar“ (EC-1). 2 von 0 ist „überschritten“, nicht „ausgeschöpft“ (AC-9).
- [x] Beide Dateien grün: `npx vitest run src/features/licenses/licenses.schema.test.ts src/features/licenses/licenses.rules.test.ts` → 52 bestanden.
- [x] Rot-Beweis, eine Runde pro Datei: Kopien der Testdateien mit umgekehrten Erwartungen der neuen Tests. Das sind abgelehnte statt angenommene Eingaben bzw. umgekehrt, `exhausted` statt `available`/`exceeded` und „Lizenz“ statt „Lizenzen“. Die neuen 11 Tests schlugen alle mit der erwarteten Abweichung fehl. Danach wurden die Kopien gelöscht, und die Originale sind wieder grün.

## E2E-Tests
- Status: **nicht gelaufen**. `tests/` existiert noch nicht. Für die kritischen Abläufe `/e2e-tests` ausführen.

## Nicht geprüft in diesem Lauf

- [!] **Browser-Verhalten:**
  - Toasts, Öffnen und Schließen der Dialoge, Fokus (Feld bzw. „Abbrechen“), Sperre beim Senden, Escape und Klick daneben (AC-1, AC-4, AC-8, EC-2)
  - dass der Browser den neu gerenderten Baum einspielt (AC-1)
  - Grund: Es gibt keinen Browser; das gehört zu `/e2e-tests`. Belegt sind die Komponententests im Suite-Lauf.
- [!] **Responsive Darstellung bei 375/768/1440 px**, Karten auf dem Smartphone, Umbruch langer Adressen (EC-8). Grund: kein Viewport.
- [!] **Cross-Browser** (Chrome, Firefox, Safari, Edge). Grund: keine Browser-Engine.
- [!] **Echter Verbindungsabbruch, Serverfehler und Ladefehler zur Laufzeit** (EC-5, EC-6). Grund: Das hätte die parallelen Prüfer gestört; belegt sind Code und Tests.
- [!] **Migration als Round-Trip.** Grund: Strategie `single`, kein lokales Supabase. Das Live-Schema wurde stattdessen gegen die Migration geprüft.
- [!] **Postgres-Protokoll von Supabase** auf Teilnehmer-Adressen (AC-11). Grund: nicht eingesehen; siehe O-1.
- [!] **Rate limiting.** Grund: nicht implementiert, laut Spec Out of Scope (PROJ-3).
- [!] **Brute Force und Account-Enumeration.** Grund: PROJ-2 prüft keine Zugangsdaten; das gehört zu PROJ-1.
- [!] **Sicherheitsheader gegen eine Live-URL.** Grund: Es gibt kein Deployment.

## Bugs

#### BUG-1: Datenbank nimmt am Formular vorbei Adressen an, die die App ablehnt
- **Severity:** Medium
  - Es betrifft nur den eigenen Träger und das eigene Kontingent, und die Anzeige ist escaped.
  - Der direkte Weg braucht das Zugriffstoken aus dem HttpOnly-Cookie und den öffentlichen Schlüssel, den die App nicht an den Browser ausliefert.
  - Er verletzt aber AC-5 („dieselben Regeln gelten für Anfragen, die das Formular umgehen“), und AC-10 nennt die Datenbank-Schnittstelle ausdrücklich als solchen Weg.
  - Für PROJ-3 wichtig: Solche Adressen würden an den Mail-Dienst gehen.
- **Status:** Open (vom Nutzer entschieden am 2026-10-26: jetzt beheben)
- **Class:** Die Prüfregel an der Datenbank-Schnittstelle ist schwächer als das Schema der App. Die Validierung gilt nur in der App, obwohl die Spec sie für jeden Weg am Formular vorbei verlangt.
- **Sweep:** `grep -nE "constraint [a-z_]+_check check" supabase/migrations/*.sql` → 3 Treffer.
  - Betroffen ist nur `licenses_email_check` (`supabase/migrations/20261025120000_proj2_licenses.sql:27-31`).
  - Die beiden anderen, `training_provider_members_role_check` und `license_center_login_lockouts_scope_check`, sind geschlossene Wertelisten ohne Lücke.
- **Herkunft:** `design.md` → Technische Entscheidungen: „Die Formatregel der Spalte ist bewusst weiter als die der App“. Diese Entscheidung nimmt genau das in Kauf und widerspricht damit AC-5. Es gibt zwei Wege:
  - Die Regel der Spalte so eng machen wie die der App (`/build`).
  - Bewusst bei der weiten Regel bleiben und AC-5 per `/refine PROJ-2` anpassen.
- **Steps to Reproduce:**
  1. Als Verwalter A anmelden und das Zugriffstoken aus dem Cookie `sb-<ref>-auth-token` nehmen.
  2. `curl -X POST <projekt-url>/rest/v1/licenses -H "apikey: <publishable>" -H "Authorization: Bearer <token>" -H 'Content-Type: application/json' -d '{"training_provider_id":"<A>","email":"<script>alert(1)</script>@example.com"}'`
  3. Erwartet: abgelehnt, wie über die App („Bitte geben Sie eine gültige E-Mail-Adresse ein.“).
  4. Tatsächlich: 201, die Lizenz ist angelegt. Ebenso für `"><img/src=x/onerror=alert(1)>@example.com` und `a@b.c`.

## Beobachtungen (kein Bug, zur Kenntnis)

- **O-1, Adresse im Datenbank-Protokoll (zu AC-11, ungeprüft):** Verstößt eine Anlage direkt an der Datenbank gegen `licenses_email_check` (z. B. mit Großbuchstaben), schreibt Postgres üblicherweise „Failing row contains (…)“ samt Adresse in sein Protokoll. PostgREST gab `details:null` zurück; das Supabase-Protokoll wurde nicht eingesehen. Über die App tritt das nicht auf, weil ihr Schema vorher normalisiert und strenger ist. Der Fall hängt am selben direkten Weg wie BUG-1.
- **O-2, Transaktionssperre auf einen fremden Träger:** Die Prüffunktion nimmt die Sperre, bevor sie prüft, ob der Träger sichtbar ist (Migration `:108` vor `:111`). Die Sperre hält nur bis zum Ende der eigenen, sofort abgebrochenen Transaktion und ist praktisch folgenlos.
- **O-3, Fortschrittsbalken:** `src/components/ui/progress.tsx` (shadcn) gibt `value` nicht an Radix weiter, deshalb steht `data-state="indeterminate"` im HTML.
  - Die ARIA-Werte setzt `quota-summary.tsx` selbst, und sie stimmen.
  - Kein Stil hängt an `indeterminate` (`grep -rln indeterminate src` → 0).
  - Bekannt und in `design.md` → Umsetzungsnotizen dokumentiert.
- **O-4, Zwei Seitentitel im gestreamten HTML:** `<h1>Lizenzübersicht</h1>` steht im Rohdokument zweimal. Das zweite stammt aus dem Skeleton von `loading.tsx` als Suspense-Platzhalter, den der Browser ersetzt. Ob im fertigen DOM nur einer bleibt, ist ohne Browser nicht prüfbar.
- **O-5, Altes Token nach dem Abmelden:** An der Datenbank-Schnittstelle bleibt es bis zum Ablauf gültig. Das ist PROJ-1 BUG-7 (Deferred); die App selbst weist es ab.

## Zusammenfassung
- **Akzeptanzkriterien:** 11 von 12 bestanden, 1 fehlgeschlagen (AC-5 am direkten Datenbank-Weg). Browser-Teile von AC-1, AC-4 und AC-8 sind nicht geprüft.
- **Edge Cases:** 10 von 10 bestanden. Browser- und Laufzeit-Teile von EC-2, EC-5, EC-6 und EC-8 sind nicht geprüft.
- **Bugs:** 1 insgesamt (0 Critical, 0 High, 1 Medium, 0 Low). Open: 1 (vom Nutzer entschieden), Deferred: 0.
- **Security:** 10 von 13 Prüfpunkten geprüft (davon einer mit BUG-1), 3 NOT VERIFIED: Rate limiting (Out of Scope), Brute Force und Login-Enumeration (beide PROJ-1). Dazu kommen die Header gegen eine Live-URL, weil es kein Deployment gibt.
- **Regression:** PROJ-1 ohne Regression, Suite 591/591.
- **Production Ready:** JA, es gibt keinen Critical- oder High-Bug.
- **Empfehlung:** BUG-1 vor PROJ-3 beheben (`/build PROJ-2`), weil PROJ-3 an diese Adressen Mails schickt. So entschieden: Der Bug ist Open, PROJ-2 bleibt bis zur Nachprüfung „In Review“.

> „Production Ready: JA“ heißt *keine Critical/High-Bugs*. Es heißt **nicht**, dass alles geprüft wurde. Die Punkte unter „Nicht geprüft in diesem Lauf“ sind offen und brauchen einen Menschen oder `/e2e-tests`.
