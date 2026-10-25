# QA-Testergebnisse: PROJ-1 Konto & Login

**Getestet:** 2026-10-25 (zweiter `/qa`-Lauf, Re-Verifikation nach dem Bugfix von BUG-1 und BUG-2)
**App-URL:** http://localhost:3001. Gestartet mit `npm run dev` als `next dev -p 3001`, einmal vom QA-Verantwortlichen. Port 3000 aus `probe.baseUrl` war von einem anderen Projekt belegt.
**Tester:** QA Engineer (KI). Ein unabhängiger `qa-engineer`-Prüfer ohne Build-Kontext, mit allen drei Bereichen nacheinander: Abnahme → Security → Regression. Zusammengeführt von der `/qa`-Sitzung.
**Umfang:** Re-Verifikation, `git diff --stat ec65f07..HEAD` (ec65f07 = Commit des ersten Berichts). Branch `feat/PROJ-1-account-login` auf Commit `c926e20`.
- **Produktionscode:** nur `src/features/account/account.actions.ts`, dort nur `visitorIp` (Zeilen 68–76).
- **Außerdem geändert:** `.env.local.example` (+1 Zeile, Inhalt nicht gelesen), `README.md`, `design.md`, `tasks.md`, die Tests `account.actions.test.ts` und `auth.data.test.ts`.
- **Unverändert:** `supabase/`, `src/lib`, `src/proxy.ts`, `src/app`, `src/components`, `src/features/account/components`, `account.schema.ts`. Beleg: `git diff --stat ec65f07..HEAD -- <diese Pfade>` ist leer.
- **Ein Prüfer statt drei:** Geändert ist eine einzige Produktionsdatei. Sie wird nur von PROJ-1 genutzt, und kein Nachbar-Feature ist deployt. Außerdem teilen sich ohne Proxy alle Anfragen eine IP-Bremse. Parallele Prüfer hätten sich gegenseitig gesperrt.

> Legende:
> - `[x]` in diesem Lauf geprüft (mit Beleg)
> - `[ ] BUG` als fehlerhaft geprüft
> - `[!] NOT VERIFIED` in diesem Lauf nicht prüfbar (mit Grund)
> - `[=]` übernommen aus dem Lauf vom 2026-10-25 (Commit `ec65f07`), in diesem Lauf nicht erneut geprüft, weil die Diff den Code dafür nicht berührt

**So wurde geprüft:**
- **Server Actions:** per HTTP direkt aufgerufen, am Formular vorbei. Kopf `Next-Action`, IDs aus `.next/dev/server/server-reference-manifest.json`.
- **Datenbank:** `env -u SUPABASE_ACCESS_TOKEN supabase db query --linked`.
- **Bot-Prüfung:** Cloudflares Turnstile-Testschlüssel (bestehen immer).
- **Startzustand:** Unter `0.0.0.0` gab es weder Login-Versuche noch Registrierungen noch eine IP-Sperre. Das Audit-Log hatte 0 Zeilen.
- **Bremsdaten:** Ohne Proxy zählen alle Anfragen unter `0.0.0.0`. Zwischen den Testblöcken wurden deshalb die eigenen Zeilen gelöscht, wie `design.md` → Teststrategie es vorsieht.
- **Aufräumen:**
  - Die Testkonten `qa-r1-1025@…` und `qa-r4-1025@…` sind per `delete from auth.users` gelöscht, danach gibt es 0 Konten mit `qa-%`.
  - Die eigenen Bremszeilen sind gelöscht. Endstand unter `0.0.0.0`: 0 Login-Versuche, 0 Sperren, 0 Registrierungen.
  - Das Audit-Log hat 0 Zeilen.

**Suite-Lauf** (einmal vor dem Prüfer, `npm test`): 17 Dateien, 440 Tests bestanden, 0 fehlgeschlagen.
**Weitere Läufe:**
- Build (`npm run build`): exit 0. Die Diff berührt App-Code, deshalb lief er.
- `npm run lint`: exit 0.
- `npm run check:structure`: „106 modules scanned, 0 errors“.
- **Migrationen:** übersprungen, unverändert seit 2026-10-25 (`git diff --stat ec65f07..HEAD -- supabase/` ist leer).

## Akzeptanzkriterien

#### AC-1: Registrierung legt Konto, Träger mit 5 Lizenzen und Mitgliedschaft an, sofort angemeldet
- [x] Registrierung mit der E-Mail `"  QA-R1-1025@Lizenzzentrale-Test.DE "` und den Zusatzfeldern `licenseQuota:999`, `license_quota:999`, `role:"owner"`:
  - Antwort: `x-action-redirect: /licenses;push` und Sitzungs-Cookie.
  - Datenbank: `license_quota=5`, `role=admin`, Name getrimmt, `email_confirmed_at` gesetzt, E-Mail klein.
  - Der Versuch steht als `success` unter `0.0.0.0`.
  - Beleg: Action-Aufruf und DB-Abfrage.

#### AC-2: Ungültige Eingaben werden abgelehnt, mit Meldung am Feld
- [x] 5 ungültige Anfragen am Formular vorbei liefern Feldmeldungen. Es entsteht keine Registrierungszeile. Die 5 Fälle:
  - Name nur aus Leerzeichen
  - 4 Fehler zugleich (Name 1 Zeichen, E-Mail ungültig, Passwort 7 Zeichen, Wiederholung weicht ab), alle 4 Meldungen gleichzeitig
  - Name 101 Zeichen und Passwort 37×„ä“ (74 Bytes)
  - Passwort mit 73 ASCII-Zeichen
  - falsche Typen bzw. `{"$ne":null}`
  - Beleg: Action-Aufrufe, DB-Abfrage.
- [=] Grenzwerte, die angenommen werden, und der Hinweis „Mindestens 8 Zeichen.“ unter dem Feld. Unverändert seit 2026-10-25, Schema und Formular sind nicht in der Diff.
- [!] NOT VERIFIED: dass Trägername und E-Mail im Browser ausgefüllt bleiben. Es gab keinen Browser. Belegt nur durch den Code (`register-form.tsx:46-50`) und die Komponententests im Suite-Lauf.

#### AC-3: Schon registrierte Adresse
- [x] Das Duplikat in Großbuchstaben liefert wortgleich „Mit dieser E-Mail-Adresse ist bereits ein Konto registriert. Bitte melden Sie sich an.“ mit `loginLink:true`. Es bleibt bei 1 Konto, der Versuch ist als `duplicate` gespeichert. Beleg: Action-Aufruf und DB-Abfrage.

#### AC-4: Anmelden und Lizenzübersicht
- [x] Login mit `"  QA-R1-1025@LIZENZZENTRALE-test.de "` liefert `/licenses;push` und ein Cookie. `curl -H Cookie … /licenses` liefert 200 mit:
  - Seitentitel „Lizenzübersicht – Lizenzzentrale“
  - Kopfzeile mit „Lizenzzentrale“, dem Trägernamen und `<form action="/sign-out" method="post">` mit „Abmelden“
  - `<h1>Lizenzübersicht</h1>` und dem Platzhaltersatz
- Einschränkung unter Missbrauch: siehe BUG-9.

#### AC-5: Gleiche Fehlermeldung für unbekannte Adresse und falsches Passwort
- [x] Zwei unbekannte Adressen und zweimal ein falsches Passwort zu einem bekannten Konto liefern denselben Text „E-Mail-Adresse oder Passwort ist falsch.“.
- [x] Antwortzeiten: 1.019–1.045 ms bei einem Fehlschlag, 1.015–1.030 ms bei einer Sperre. Mindestantwortzeit in `src/features/account/account.actions.ts:43,124-129`.
- [x] Ein Passwort aus 37×„ä“ liefert dieselbe Meldung und schreibt keine Bremszeile.

#### AC-6: Login-Bremse (5 pro Adresse oder 20 pro IP in 15 Minuten, dann 15 Minuten Sperre)
- [x] **Sperre pro Adresse:** 5 Fehlversuche, jeweils mit anderem `X-Forwarded-For` (198.51.100.1–5). Der 6. Versuch hat das richtige Passwort, eine andere Schreibweise und wieder einen anderen Kopf. Er bekommt „Zu viele Anmeldeversuche. Bitte versuchen Sie es in 15 Minuten erneut.“, in der DB steht `locked_until` = jetzt + 15 Min.
- [x] **Restzeit:** `locked_until` auf jetzt + 150 s gesetzt → „in 3 Minuten“. Das Sperrende wurde durch Zurückdatieren von `locked_until` und `count_from` simuliert, danach klappt der Login wieder.
- [x] **Sperre pro IP:** Nach 20 Fehlversuchen ist auch ein anderes, ungesperrtes Konto mit dem richtigen Passwort gesperrt. Gesperrte Versuche speichern nichts: 31 Zeilen vorher, 31 nachher.
- [x] **BUG-2 geschlossen:** Ein selbst gesetzter Kopf ändert die gezählte IP nicht mehr (Belege unter BUG-2).
- [ ] **BUG-9 (Medium):** Die IP-Sperre zählt alle Clients gemeinsam statt „von derselben IP-Adresse“. 20 Fehlversuche von irgendwem sperren den Login für alle, auch von einer echt anderen Quelladresse.
- [!] NOT VERIFIED: das echte Ablaufen der 15 Minuten. In diesem Lauf nur simuliert. Real geprüft im Lauf vom 2026-10-25, die Migrationen sind seitdem unverändert.
- BUG-8 (Deferred) besteht weiter, siehe unten.

#### AC-7: Ohne bestandene Bot-Prüfung keine Registrierung und kein Login
- [x] Ohne Token und mit leerem Token kommt bei Registrierung und Login „Die Sicherheitsprüfung ist fehlgeschlagen. Bitte versuchen Sie es erneut.“. Es entsteht kein Cookie, und zu `qa-nobot@…` gibt es 0 Login-Zeilen.
- [=] Der direkte Weg zu Supabase mit dem öffentlichen Schlüssel endet mit `captcha_failed` (T18). Unverändert seit 2026-10-25, das ist eine Dashboard-Einstellung und kein Code in der Diff.
- [!] NOT VERIFIED: ein Token, das Cloudflare ablehnt. Das Test-Secret nimmt jedes Token an. Prüfbar ist das nur, wenn kurz `TURNSTILE_SECRET_KEY=2x0000000000000000000000000000000AA` in `.env.local` steht.
- [!] NOT VERIFIED (go-live): das eigene Turnstile-Widget (T29 `[user go-live]`).

#### AC-8: Registrierungsbremse (5 pro IP und Stunde)
- [x] 1 Erfolg und 4 Duplikate, abgeschickt mit `X-Forwarded-For` 192.0.2.50/.51, mit `X-Real-IP`, mit `Forwarded` und mit einem `X-Forwarded-For` aus zwei Einträgen. Alle 5 stehen als `0.0.0.0` in der DB (IDs 218–222).
- [x] Danach bekommen 4 weitere Versuche „Zu viele Registrierungen. Bitte versuchen Sie es später erneut.“, und es entsteht kein Konto. Die 4 Versuche:
  - neue Adresse mit frischem Kopf
  - alle Köpfe zugleich (XFF, X-Real-IP, CF-Connecting-IP, True-Client-IP, Forwarded)
  - IPv6 im Kopf
  - Duplikat ohne Kopf
- [x] Ein Eingabefehler wird auch bei voller Bremse als Feldfehler beantwortet. Ein Serverfehler wird als `error` gespeichert (siehe EC-3).
- [ ] **BUG-9 (Medium):** Die Bremse zählt alle Clients gemeinsam. 5 gezählte Registrierungen von irgendwem sperren eine Stunde lang jede neue Registrierung.

#### AC-9: Weiterleitungen je nach Sitzung
- [=] Unverändert seit 2026-10-25 (`src/proxy.ts` und `src/app` nicht in der Diff).
- [x] Stichprobe in diesem Lauf: abgemeldet führt `/` zu 307 `/login` und `/licenses` zu 307 `/login?reason=session`.

#### AC-10: Sitzung bleibt bestehen, Abmelden beendet sie
- [=] Dauerhafte Cookies, Auffrischen, `no-store`, Scope `local`, 405 für andere Methoden. Unverändert seit 2026-10-25 (`src/lib`, `src/app` nicht in der Diff).
- [x] Stichprobe in diesem Lauf: `POST /sign-out` → 303 `/login`. Das alte Cookie führt danach bei `/licenses` zu 307.
- [!] NOT VERIFIED: „Zurück“ im Browser (bfcache) und ein echter Neustart des Browsers. Es gab keinen Browser.

#### AC-11: Datentrennung zwischen Bildungsträgern
- [=] Unverändert seit 2026-10-25. RLS, Policies, Grants und Migrationen sind nicht in der Diff.

#### AC-12: Löschen eines Kontos durch den Anbieter
- [x] Beide Testkonten per `delete from auth.users` gelöscht. Danach gibt es 0 Konten, 0 Träger, 0 Mitgliedschaften, 0 Sitzungen, 0 Identities, 0 Login-Versuche und 0 Sperren der Adressen. Das Audit-Log hat 0 Zeilen.
- [x] Den Weg über die Admin-API deckt der Gegenbeweis unter BUG-1 ab: `auth.admin.deleteUser` im Test erzeugt keine Zeile.
- [x] **BUG-1 geschlossen** (Belege unter BUG-1).

#### AC-13: Daten der Bremsen sind nach 24 Stunden gelöscht
- [=] Unverändert seit 2026-10-25. Der Aufräumjob und die Migration sind nicht in der Diff.

## Edge Cases

#### EC-1: Mehrfaches Absenden
- [x] 4 gleichzeitige Registrierungen mit derselben neuen Adresse ergeben 1 Konto, 1 Träger und 1 Mitgliedschaft (DB). 3 Antworten tragen die Meldung aus AC-3.
- [!] NOT VERIFIED: der gesperrte Knopf während des Sendens im Browser. Belegt nur durch den Code (`register-form.tsx:37,148`) und die Komponententests.

#### EC-2: Zwei Besucher gleichzeitig mit derselben Adresse
- [x] Derselbe Lauf, mit 4 verschiedenen gefälschten IPs: genau 1 Erfolg (ID 224, `success`), 3× `duplicate` mit Login-Link.

#### EC-3: Fehler mitten in der Registrierung
- [x] Ein Name mit `\u0000` liefert „Die Registrierung ist fehlgeschlagen. Bitte versuchen Sie es erneut.“. Es entsteht 0 Konto, der Versuch steht als `error`, verwaiste Konten mit `qa-%` gibt es 0.
- [=] Die Garantie „alles oder nichts“ über den Trigger ist unverändert seit 2026-10-25 (Migrationen nicht in der Diff).
- [!] NOT VERIFIED: dass die Felder im Browser stehen bleiben.

#### EC-4: Großbuchstaben und Leerzeichen in der E-Mail-Adresse
- [x] Registrierung und Login mit Großbuchstaben und Leerzeichen am Rand klappen und werden als dieselbe Adresse erkannt.
- [x] Ein Fehlversuch mit „QA-R1-…“ zählt in der klein geschriebenen Kontosperre mit (AC-6, 6. Versuch).
- [x] Passwörter werden nicht verändert: Ein falsches Passwort zählt als falsch (AC-5).

#### EC-5: Konto ohne Bildungsträger
- [=] Unverändert seit 2026-10-25 (`src/app/(app)/layout.tsx` und `session.data.ts` nicht in der Diff).

#### EC-6: Abmelden in einem anderen Tab
- [=] Unverändert seit 2026-10-25 (`src/proxy.ts`, `src/app` nicht in der Diff).

#### EC-7: Erfolgreicher Login setzt den Zähler zurück
- [x] 3 Fehlversuche, Erfolg, 2 Fehlversuche, Erfolg: keine Sperre (Login-Versuche IDs 901–907). In der DB wird `count_from` neu gesetzt.

#### EC-8: Bot-Prüfung lädt nicht
- [x] Ohne Token kommt nichts durch (AC-7).
- [x] Fehlt das Secret oder antwortet Cloudflare fehlerhaft, ist das Ergebnis `'error'` (`src/features/account/turnstile.integration.ts:19,31,34,37,39`).
- [x] Im Server-HTML von `/login` und `/register` trägt der Knopf `disabled=""` (`login-form.tsx:110`, `register-form.tsx:148`).
- [!] NOT VERIFIED: Meldung und gesperrter Knopf im Browser.

#### EC-9: Keine Verbindung
- [!] NOT VERIFIED: Ein Verbindungsabbruch braucht einen Browser. Die Formulare sind nicht in der Diff. Belegt durch die Komponententests und `form-feedback.test.tsx` im Suite-Lauf.

#### EC-10: Langer Trägername mit HTML
- [=] Unverändert seit 2026-10-25 (`src/components/app-header.tsx` nicht in der Diff).
- [!] NOT VERIFIED: wie die Kürzung mit „…“ tatsächlich aussieht. Es gab keinen Browser.

#### Zusätzlich gefundene Edge Cases
- [x] **Proxy-Schalter nur bei genau `true`:** Der Code vergleicht mit `process.env.TRUSTED_PROXY === 'true'` (`account.actions.ts:74`). Zur Laufzeit landen alle Kopfvarianten unter `0.0.0.0`, der Schalter ist im laufenden Server also nicht `true`. Die Werte `TRUE`, ` true ` und `""` sind jetzt durch Unit-Tests aus diesem Lauf abgedeckt (siehe unten).
- [=] Nicht-String-Typen, Weiterleitung `/licenses/` → 308, fremder `Origin`, keine Passwörter im Server-Protokoll. Unverändert seit 2026-10-25.
- BUG-5, BUG-6 und BUG-7 sind Deferred, siehe unten.

#### Technische Anforderungen: App-Rahmen und Browser
- [=] `lang="de"`, eigene Schrift, Fokus, Tippflächen, Hinweisboxen mit `role="alert"`, Viewport-Meta. Unverändert seit 2026-10-25 (`src/app`, `src/components` nicht in der Diff).
- BUG-3 und BUG-4 sind Deferred, siehe unten.
- [!] NOT VERIFIED: Kontrast in beiden Themes, Darstellung bei 375/768/1440 px, Chrome/Firefox/Safari/Edge. Dafür braucht es einen Browser.

## Security-Audit

- [x] **Authentication:** Stichprobe in diesem Lauf, anonym und mit dem alten Cookie nach dem Abmelden jeweils 307 (siehe AC-9, AC-10). Den Rest (gefälschtes JWT, `x-middleware-subrequest`) übernimmt der Lauf vom 2026-10-25, `src/proxy.ts` ist unverändert.
- [=] **Authorization:** unverändert seit 2026-10-25 (RLS und Migrationen nicht in der Diff).
- [x] **Input validation:** In diesem Lauf am Formular vorbei geprüft: falsche Typen, `{"$ne":null}`, Längen und Bytes (siehe AC-2). XSS, SQL-artige Eingaben und CRLF sind übernommen vom 2026-10-25, `account.schema.ts` ist unverändert.
- [!] **Rate limiting auf gewöhnlichen Endpunkten** (`/sign-out`, Seiten): NOT VERIFIED, nicht implementiert (für das MVP optional).
- [x] **Brute force pro Konto:** ab dem 6. Versuch gesperrt, auch mit richtigem Passwort, anderer Schreibweise und gefälschtem Kopf (AC-6).
- [ ] **Brute force pro IP bzw. Passwort-Spraying:**
  - Getestet mit 8 Adressen und demselben Passwort, dazu Fehlversuche bis 20. Danach ist der Login gesperrt.
  - Die Umgehung per Kopf ist geschlossen (BUG-2).
  - Offen ist **BUG-9:** Die Sperre wirkt für alle Clients gemeinsam.
- [x] **IP-Spoofing in allen Varianten:** Geprüft wurden XFF einzeln, mit mehreren Einträgen, mit einer privaten IP vorn, mit IPv6, mit `unknown` und kleingeschrieben, außerdem `X-Real-IP`, `Forwarded`, `CF-Connecting-IP` und `True-Client-IP`. Alles landet unter `0.0.0.0` (`count(distinct ip_address)=1`).
- [x] **Keine Kontenaufzählung beim Login:** gleicher Text, Zeiten 1.015–1.045 ms für unbekannt, falsch und gesperrt (AC-5). Ein Erfolg antwortet ohne Wartezeit (532–943 ms), so legt es `design.md` fest. Über die Existenz einer Adresse verrät das nichts.
- [ ] **Massen-Registrierung:**
  - 5 pro Stunde, nicht per Kopf umgehbar (AC-8).
  - Die Grenze gilt aber für alle gemeinsam (BUG-9).
  - Lokal lässt die Bot-Prüfung mit den Testschlüsseln alles durch.
- [=] **Direkter Weg zu Supabase gesperrt** (`captcha_failed`): unverändert seit 2026-10-25, Dashboard-Einstellung T18.
- [x] **Keine Zugangsdaten in der URL:** Beide Formulare stehen im Server-HTML mit `method="post"`.
- [x] **Keine Geheimnisse im Client-Bundle:**
  - Durchsucht wurden `.next/static` (23 Dateien, neuer als die Code-Änderung) und 26 live geladene Dev-Chunks von `/login` und `/register`.
  - Gesucht nach `sb_secret_`, `service_role`, `SERVICE_ROLE`, `TURNSTILE_SECRET`, `TRUSTED_PROXY`, `eyJhbGciOi` und den Test-Secrets `1x0…0AA` und `2x0…0AA`: 0 Treffer.
  - Im Bundle steht nur der öffentliche Site-Key, wie vorgesehen.
- [x] **Keine Geheimnisse in den neuen Commits:** `git log -p ec65f07..HEAD | grep -cE 'sb_secret_[A-Za-z0-9]|eyJhbGciOi|sb_publishable_[A-Za-z0-9]'` = 0.
- [x] **Keine sensiblen Daten in Antworten:** Die Antwort auf einen erfolgreichen Login enthält 0 Treffer für `access_token`, `refresh_token`, `eyJ`, E-Mail, Passwort, `license_quota`, `training_provider_id`, `"sub"`, `user_id` und die Konto-ID. Fehlerantworten enthalten nur `formError` bzw. `fieldErrors`.
- [x] **Sicherheitsheader:** `X-Frame-Options: DENY`, `nosniff`, `origin-when-cross-origin` und HSTS mit `includeSubDomains`, gemessen auf `/login` (Dev-Server). `next.config.ts` ist unverändert.
- [=] **CSRF:** Eine Server Action mit fremdem `Origin` wird abgelehnt. Unverändert seit 2026-10-25.
- [x] **`[user]`-Einstellungen:**
  - T4 wirkt jetzt (BUG-1).
  - T17 prüft jetzt `auth.data.test.ts` → „Mindestlänge Passwort in Supabase“, grün im Suite-Lauf.
  - T1–T3, T8, T16 und T18 sind abgehakt und wirken über die Integrationstests bzw. AC-1 und AC-7.
  - T31 ist nicht abgehakt, der Platzhalter ist aber angelegt (siehe Hinweise). Kein Bug: Fehlt die Variable, bleibt der sichere Standard aktiv, und das ist zur Laufzeit belegt.
  - T29, T30 und T32 sind `[user go-live]` und damit kein Bug.

## Regression

- [x] **Suite:** 17 Dateien, 440 Tests bestanden, 0 fehlgeschlagen (`npm test`, einmal vor dem Prüfer). Die Zahl passt zur Diff: 416 aus dem ersten Lauf, 20 aus `form-feedback.test.tsx` (ec65f07) und 4 neue Fälle (2 in `account.actions.test.ts`, 2 in `auth.data.test.ts`).
- [x] **Prüfdefinitionen intakt:**
  - `grep -rnE "\.(skip|only|todo)\(|\bxit\(|\bfit\(|skipIf|runIf" src --include='*.test.ts*'`: 0 Treffer.
  - `package.json` und `vitest.config.mts` sind in der Diff unverändert.
  - `account.actions.test.ts`: `beforeEach` setzt jetzt `TRUSTED_PROXY=true`, damit die bisherigen Kopf-Tests den Weg hinter einem Proxy prüfen. Die Erwartungen sind unverändert, nur der Testname ist neu. `afterEach` ruft `vi.unstubAllEnvs()` auf, es leckt also nichts zwischen den Tests.
  - Der neue Block erwartet `0.0.0.0` an beiden Bremsen und keine IP an Cloudflare.
  - `auth.data.test.ts`, T4-Test: Gegenbeweis rot (siehe BUG-1).
- [x] **Statische Prüfungen:** `npm run build` exit 0 (inkl. TypeScript), `npm run lint` exit 0, `npm run check:structure` „106 modules scanned, 0 errors“.
- [x] **Deployte Features:** In `features/INDEX.md` hat keines den Status „Deployed“. Rückwärts ist also nichts zu prüfen.
- [x] **Gemeinsame Teile:** Tor-Weiterleitungen, `/sign-out` (303) und das Kopfzeilen-HTML von `/licenses` per `curl` abgerufen.
- [!] NOT VERIFIED: Optik und Responsive-Verhalten der gemeinsamen Teile. Es gab keinen Browser.
- [!] NOT VERIFIED: der Produktions-Server (`next start`). Geprüft sind das Build-Artefakt und der Dev-Server.

## Unit-Tests

- [x] **In diesem Lauf ergänzt:** `src/features/account/account.actions.test.ts` → Block „IP-Adresse ohne vertrauenswürdigen Proxy“ mit 3 neuen Fällen: `TRUSTED_PROXY` = `TRUE`, ` true ` und `""`. `design.md` legt fest: „Jeder andere Wert als genau `true` gilt als ‚kein Proxy‘“. Ein Tippfehler im Wert darf den Kopf also nicht für den Client öffnen.
  - Lauf: `npx vitest run src/features/account/account.actions.test.ts -t "ohne vertrauenswürdigen Proxy"` → 5 bestanden.
  - **Gegenbeweis:** Der Vergleich in `visitorIp` wurde kurz auf `trim().toLowerCase() === 'true'` gelockert und auch für den leeren Wert geöffnet. Danach schlugen genau die 3 neuen Fälle fehl (3 failed, 39 passed). Mit dem wiederhergestellten Code (`git checkout`) laufen alle 42 grün.
- [=] **Aus dem ersten Lauf:** `src/features/account/components/form-feedback.test.tsx` (20 Tests), grün im Suite-Lauf.

## E2E-Tests
_Optionale Ebene, geschrieben von `/e2e-tests` nur für kritische Kernabläufe._

- Status: **nicht gelaufen** (`/e2e-tests` für kritische Abläufe ausführen). `tests/` existiert noch nicht.

## Nicht verifiziert in diesem Lauf

- [!] **Darstellung in verschiedenen Browsern** (Chrome, Firefox, Safari, Edge): `/qa` läuft ohne Browser, das deckt nur `/e2e-tests` ab.
- [!] **Responsive Layout bei 375/768/1440 px**, Kürzung des Trägernamens (EC-10), Kontrast: Dafür braucht es einen echten Viewport.
- [!] **Verhalten im Browser:** Belegt sind diese Punkte nur durch Code und Komponententests.
  - Felder bleiben ausgefüllt (AC-2, EC-3)
  - Knopf gesperrt während des Sendens (EC-1)
  - Meldung, wenn das Widget nicht lädt (EC-8)
  - Verbindungsabbruch (EC-9)
  - „Zurück“ und Neustart des Browsers (AC-10)
- [!] **Echtes Ablaufen der 15-Minuten-Sperre (AC-6):** In diesem Lauf simuliert, real geprüft am 2026-10-25.
- [!] **Ein von Cloudflare abgelehntes Token (AC-7):** Das Test-Secret nimmt jedes Token an.
- [!] **Weg hinter einem echten Proxy mit `TRUSTED_PROXY=true` (BUG-2):** go-live (T32). Abgedeckt nur durch die Unit-Tests in `account.actions.test.ts`.
- [!] **Eigenes Turnstile-Widget (T29), Auftragsverarbeitungsverträge (T30), Proxy-Schalter beim Host (T32):** go-live, werden in `/deploy` gemacht und geprüft.
- [!] **Dashboard-Einstellung T4 selbst:** nicht einsehbar. Belegt ist ihre Wirkung (0 neue Zeilen).
- [!] **Rate limiting auf gewöhnlichen Endpunkten:** nicht implementiert, für das MVP optional.
- [!] **Produktions-Server (`next start`):** nicht gestartet.
- Die mit `[=]` markierten Punkte sind in diesem Lauf nicht erneut geprüft. Sie bestanden am 2026-10-25, und ihr Code ist seitdem unverändert.

## Bugs

#### BUG-1: Supabase schreibt das Auth-Audit-Log in die Datenbank, Reste gelöschter Konten bleiben
- **Severity:** High. Verletzte AC-12.
- **Status:** Fixed (2026-10-25, re-verified)
- **Class:** Eine abgehakte `[user]`-Einstellung im Anbieter-Dashboard wirkt nicht, und keine Prüfung bestätigt ihre Wirkung. Hier T4: „Write audit logs to the database“ → aus.
- **Sweep:** `env -u SUPABASE_ACCESS_TOKEN supabase db query --linked "select count(*) from auth.audit_log_entries a where payload->>'actor_id' is not null and not exists (select 1 from auth.users u where u.id::text = a.payload->>'actor_id')"` → **0** (vorher 887). `select count(*) from auth.audit_log_entries` → 0.
- **Re-Verifikation:**
  - In diesem Lauf gab es 3 Registrierungen, über 12 erfolgreiche Logins, `POST /sign-out` und die Löschung von 2 Konten. Neue Zeilen im Audit-Log: 0.
  - Gegenbeweis zum neuen Test: Eine Platzhalter-Zeile ins Audit-Log eingefügt, dann `npx vitest run src/features/account/auth.data.test.ts -t "Audit-Log nicht in der Datenbank"` ausgeführt. Ergebnis: 1 failed, „expected 0, received 1“ (`auth.data.test.ts:267`). Die Zeile ist wieder gelöscht.
  - Der Test liest also die echte Tabelle. Signup, Abmelden und `auth.admin.deleteUser` im Test erzeugten keine Zeile.
  - Die Fehlerart ist über alle `[user]`-Aufgaben gesucht: T17 hat jetzt ebenfalls einen Test.

#### BUG-2: IP-Sperren von Login und Registrierung über `X-Forwarded-For` umgehbar
- **Severity:** High. Verletzte AC-6 und AC-8.
- **Status:** Fixed (2026-10-25, re-verified für den lokalen Betrieb ohne Proxy). Der Weg hinter einem Proxy ist go-live (T32).
- **Class:** Die Client-IP für Sicherheitsentscheidungen kommt aus einem Kopf, den der Client selbst setzt, ohne vertrauenswürdigen Proxy davor.
- **Sweep:** `grep -rni "x-forwarded-for\|x-real-ip" src | grep -v '\.test\.'` → 5 Treffer, davon 1 Codestelle. Die Codestelle `account.actions.ts:75` liest den Kopf nur bei `TRUSTED_PROXY === 'true'`. Die anderen 4 sind Kommentare (`account.actions.ts:69`, `account.rules.ts:3,60,64`). Eine erweiterte Suche nach `cf-connecting-ip|true-client-ip|forwarded|remoteAddress` fand keine weitere IP-Quelle.
- **Re-Verifikation:**
  - **Login:** 20 Fehlversuche mit allen Kopfvarianten stehen alle unter `0.0.0.0` (`count(distinct ip_address)=1`). Danach gesperrt:
    - 8 Kopfvarianten
    - ein Versuch ohne Kopf
    - ein Versuch über 127.0.0.1
    - ein Versuch über die LAN-Adresse 192.168.178.81
  - **Registrierung:** siehe AC-8.
- **Neue Folge des Fixes:** BUG-9.

#### BUG-3: Turnstile-Widget breiter als die Karte bei schmalen Smartphones
- **Severity:** Low. Betrifft die Technische Anforderung „nutzbar ab Smartphone-Breite“. Aus dem Code berechnet, nicht gerendert.
- **Status:** Deferred (vom Nutzer entschieden am 2026-10-25). Unverändert seit 2026-10-25, nicht erneut geprüft (`bot-check.tsx` nicht in der Diff).
- **Class:** Element mit fester Mindestbreite in einem schmaleren Container.
- **Sweep:** `grep -rn "size: 'flexible'" src --include='*.tsx' | grep -v test` → 1 Treffer (`src/features/account/components/bot-check.tsx:17`). Die Bibliothek setzt `minWidth: 300`.
- **Steps to Reproduce:**
  1. `/login` bei 360 px Breite öffnen.
  2. Die Inhaltsbreite der Karte ist 360 − 2×16 − 2×1 − 2×16 = 294 px.
  3. Erwartet: Das Widget passt in die Karte.
  4. Tatsächlich: Es ragt 6 px über die Karte hinaus, bei 320 px sind es 46 px, und die Seite scrollt waagerecht. Ab 364 px passt es.

#### BUG-4: Keine eigene Fehler- und 404-Seite
- **Severity:** Low
- **Status:** Deferred (vom Nutzer entschieden am 2026-10-25). Unverändert seit 2026-10-25, nicht erneut geprüft (`src/app` nicht in der Diff).
- **Class:** Systemseiten fehlen im App-Rahmen.
  - `docs/app-shell.md` → Seitenmuster verlangt bei einem Ladefehler eine Hinweisbox mit „Erneut versuchen“.
  - Laut PRD ist die Oberfläche nur auf Deutsch.
- **Sweep:** `find src/app -name 'error.tsx' -o -name 'global-error.tsx' -o -name 'not-found.tsx' | wc -l` → 0.
- **Steps to Reproduce:**
  1. Anmelden, dann `GET /does-not-exist` aufrufen.
  2. Erwartet: eine deutsche Seite im App-Rahmen.
  3. Tatsächlich: 404 mit Next.js' englischer Standardseite „404: This page could not be found.“ und zwei `<title>`-Tags.
  4. Kann die Mitgliedschaft nicht gelesen werden, wirft der Wächter (`src/features/account/session.data.ts:45`), und Next.js zeigt seine Standard-Fehlerseite statt der Hinweisbox. Das ist aus dem Code abgeleitet.

#### BUG-5: Trägername mit Steuerzeichen besteht das Schema
- **Severity:** Low
- **Status:** Deferred (vom Nutzer entschieden am 2026-10-25). Besteht weiter: In diesem Lauf führte ein Name mit `\u0000` wieder zur allgemeinen Meldung statt zu einer Feldmeldung (EC-3). `account.schema.ts` ist nicht in der Diff.
- **Class:** Die Freitext-Eingaberegel schließt Steuerzeichen nicht aus.
- **Sweep:** `grep -rnE 'p\{Cc\}|x00|u0000|control' src --include='*.schema.ts'` → 0 Treffer. Betroffen ist das einzige gespeicherte Freitextfeld, `src/features/account/account.schema.ts:59`.
- **Steps to Reproduce:**
  1. `register` am Formular vorbei mit `trainingProviderName: "QA\u0000A1"` und sonst gültigen Werten aufrufen.
  2. Erwartet: eine Feldmeldung am Trägernamen.
  3. Tatsächlich: die allgemeine Meldung „Die Registrierung ist fehlgeschlagen…“. Es entsteht nichts.
  4. Andere Steuer- und Bidi-Zeichen würden gespeichert und in der Kopfzeile ausgegeben (nicht ausgelöst).

#### BUG-6: Nach erfolgreicher Registrierung erscheint „bereits registriert“, wenn die Sitzung nicht übernommen wird
- **Severity:** Low. Nur im Code gefunden, nicht ausgelöst.
- **Status:** Deferred (vom Nutzer entschieden am 2026-10-25). Besteht weiter: Die Fallback-Logik `account.actions.ts:113-118` ist unverändert, die Diff berührt nur die Zeilen 68–76.
- **Class:** Der Fehler-Fallback hält den eigenen Erfolg für ein fremdes Duplikat.
- **Sweep:** `grep -rn "isEmailRegistered(" src --include='*.ts' | grep -v test` → 2 Treffer: die Definition (`throttle.data.ts:89`) und 1 Aufruf (`src/features/account/account.actions.ts:115`).
- **Steps to Reproduce:**
  1. `signUp` gelingt, aber das anschließende `setSession` (`src/features/account/auth.data.ts:64`) scheitert, z. B. bei einem kurzen Netzausfall zu Supabase.
  2. Erwartet: sofort angemeldet (AC-1) oder die Meldung aus EC-3.
  3. Tatsächlich: Die Nachfrage findet das gerade angelegte Konto. Der Nutzer sieht „bereits registriert, bitte anmelden“, und der Versuch zählt als `duplicate`. Die Anmeldung klappt danach.

#### BUG-7: Zugriffstoken liest nach dem Abmelden weiter über die Datenbank-Schnittstelle
- **Severity:** Low. Die App selbst ist dicht, und das Cookie ist HttpOnly.
- **Status:** Deferred (vom Nutzer entschieden am 2026-10-25). Unverändert seit 2026-10-25, nicht erneut geprüft (Migrationen nicht in der Diff).
- **Class:** Ein zustandsloses JWT bleibt nach dem Abmelden bis zu seinem Ablauf gültig, weil die Leseregeln nicht prüfen, ob die Sitzung noch besteht.
- **Sweep:** `grep -rn "session_id\|auth.sessions" supabase/migrations | wc -l` → 0.
- **Steps to Reproduce:**
  1. Das Token aus dem Sitzungs-Cookie nehmen.
  2. `POST /sign-out`.
  3. `GET /rest/v1/training_providers` mit diesem Token aufrufen.
  4. Erwartet: keine Zeilen.
  5. Tatsächlich: 200 mit der eigenen Zeile, bis das Token abläuft (höchstens etwa 1 Stunde).

#### BUG-8: Sperrmeldung nennt „16 Minuten“ bei gleichzeitigen Versuchen
- **Severity:** Low
- **Status:** Deferred (vom Nutzer entschieden am 2026-10-25). Besteht weiter, nicht erneut provoziert: Die Gegenwart kommt weiter aus `new Date()` auf dem Server (`account.actions.ts:151`).
- **Class:** Die Restzeit wird aus zwei Uhren berechnet: das Sperrende aus `now()` der Datenbank, die Gegenwart aus der Uhr des Servers. Aufgerundet (`src/features/account/account.rules.ts:48`) ergibt ein winziger Uhrenversatz eine Minute mehr.
- **Sweep:** `grep -rn "remainingMinutes(" src --include='*.ts' | grep -v test` → 2 Treffer: die Definition (`account.rules.ts:44`) und 1 Aufruf (`account.rules.ts:198`).
- **Steps to Reproduce:**
  1. 12 gleichzeitige Fehlversuche auf eine frische Adresse schicken.
  2. Erwartet laut `design.md` → Login-Bremse im Detail: „Die Meldung nennt also 15 Minuten“.
  3. Tatsächlich (Lauf vom 2026-10-25): 7 von 12 Antworten nannten „in 16 Minuten“.

#### BUG-9: IP-Bremsen zählen alle Clients gemeinsam statt pro IP-Adresse (neu, Folge des Fixes von BUG-2)
- **Severity:** Medium. Widerspricht AC-6 („20 fehlgeschlagene Versuche von derselben IP-Adresse“) und AC-8 („von derselben IP-Adresse“). Unter Missbrauch beschränkt das AC-4 und AC-1 für alle Verwalter.
- **Status:** Deferred (vom Nutzer entschieden am 2026-10-25)
- **Class:** Eine Sicherheitsbremse schlüsselt alle Clients auf denselben Ersatzwert. Aus dem Zähler pro Client wird ein globaler Zähler, und der wird zum Hebel gegen alle.
- **Sweep:** `grep -rn "clientIpFrom(\|visitorIp()" src --include='*.ts' | grep -v '\.test\.'` → 5 Treffer, beide Bremsen sind betroffen:
  - Definition `visitorIp` (`account.actions.ts:73`)
  - `clientIpFrom(null)` ohne Proxy (`:75`)
  - die Aufrufe in `register` (`:88`) und `login` (`:144`)
  - die Definition von `clientIpFrom` (`account.rules.ts:69`)
- **Steps to Reproduce:**
  1. **Login:** 20 Fehlversuche mit beliebigen Adressen über `http://localhost:3001` schicken.
  2. Dann ein anderes, ungesperrtes Konto mit dem richtigen Passwort über `http://192.168.178.81:3001` anmelden. Die Verbindung läuft dabei nicht über Loopback.
  3. Erwartet laut AC-6: Anmeldung klappt, denn von dieser IP gab es keine Fehlversuche.
  4. Tatsächlich: „Zu viele Anmeldeversuche. Bitte versuchen Sie es in 15 Minuten erneut.“
  5. **Registrierung:** 5 gezählte Registrierungen (Erfolg oder Duplikat) von irgendwem. Danach bekommt auch eine Registrierung über 192.168.178.81 eine Stunde lang „Zu viele Registrierungen…“.
- **Hinweis:**
  - `next dev` lauscht auf allen Schnittstellen (`*:3001`). Jeder im lokalen Netz kann also mit 20 Fehlversuchen alle 15 Minuten den Login aller Verwalter sperren. Mit 5 Duplikaten pro Stunde blockiert er jede neue Registrierung. Mit den Testschlüsseln kostet das kein CAPTCHA.
  - `design.md` → Technische Entscheidungen (2026-10-25, „Entscheidung des Betreibers“) nimmt das bewusst in Kauf. `spec.md` ist nicht nachgezogen: AC-6 und AC-8 sagen weiter „von derselben IP-Adresse“, und der Decision Log der Spec nennt nur die Kontosperre als Hebel.
  - Auflösen lässt sich das auf zwei Wegen:
    - `/refine PROJ-1`: AC-6 und AC-8 an die Entscheidung anpassen, z. B. „ohne vertrauenswürdigen Proxy zählen alle Anfragen als eine Adresse“.
    - ein anderer Fix in `/build`, z. B. ein eigener Node-Server, der den Kopf mit der Adresse der Verbindung überschreibt.
  - Medium statt High: Laut PRD läuft die App nur lokal, und dort kommen echte Anfragen ohnehin alle von einer Adresse. Die Sperre pro Adresse wirkt unabhängig davon. Workarounds: abwarten, die Bremszeilen löschen oder `next dev -H 127.0.0.1` starten.

## Hinweise ohne Bug (zur Kenntnis)

- **T31 nicht abgehakt:** `tasks.md:154` steht noch auf `- [ ] T31 [user]`. Laut Commit `c926e20` ist der Platzhalter angelegt (`git show --stat c926e20` → `.env.local.example | 1 +`), den Inhalt hat die QA nicht gelesen. Den Haken setzt der Nutzer.
- **Alte Integrationstest-Konten:** In `auth.users` liegen 3 Konten von 2026-10-25, 10:28 UTC, jeweils mit Träger und Sitzung: `lizenzzentrale-test-signup-74ea847f…`, `lizenzzentrale-test-signup-d8f00437…` und `lizenzzentrale-test-account-97e7bc3a…@example.com`. Ein früherer Testlauf hat sie nicht aufgeräumt, vermutlich ein abgebrochener Lauf. Sie lassen sich in Supabase → Authentication → Users löschen. Die QA hat sie nicht angefasst.
- **Secure-Flag aus einem Client-Kopf:** `src/lib/supabase/server.ts:16` nimmt das Secure-Flag der Cookies aus `x-forwarded-proto`, und den Kopf kann der Client setzen. Das ist dieselbe Vertrauensfrage wie bei BUG-2. Es betrifft aber nur die eigenen Cookies des Clients, ein Angriff ist nicht erkennbar.
- **Kein Anmeldeprotokoll in der Datenbank:** Seit T4 wirkt, entsteht auch für Login und Logout kein Eintrag im Audit-Log. Das ist so gewollt (AC-12), wer Anmeldungen nachvollziehen will, hat dafür aber kein Protokoll mehr.
- **Aus dem ersten Lauf, weiter gültig, nicht erneut geprüft:**
  - `/sign-out` prüft den `Origin` nicht und verlässt sich auf `SameSite=Lax`.
  - Die Registrierung ist auch mit bestehender Sitzung aufrufbar.
  - Jeder kann eine bekannte Adresse mit 5 Fehlversuchen für 15 Minuten sperren (so entschieden in der Spec).
  - Es gibt keinen `Content-Security-Policy`-Kopf.
  - Bei einem Konto ohne Träger lautet der Seitentitel weiterhin „Lizenzübersicht – Lizenzzentrale“.
  - Außerhalb von PROJ-1: Beispielzeile unter INDEX → Deployments, `/favicon.ico` liefert 404, `passWithNoTests`.

## Zusammenfassung
- **Akzeptanzkriterien:** 9 in diesem Lauf geprüft, 4 übernommen.
  - Ohne Befund: AC-1, AC-2, AC-3, AC-4, AC-5, AC-7, AC-12.
  - AC-6 und AC-8 bestehen in ihrem Kern (Sperre pro Adresse, Sperre nach 20 bzw. 5, nicht per Kopf umgehbar). Beide tragen BUG-9 (Medium, nicht blockierend).
  - Übernommen und am 2026-10-25 bestanden: AC-9, AC-10, AC-11, AC-13. Der Code dafür ist unverändert, AC-9 und AC-10 sind zusätzlich stichprobenartig geprüft.
  - Die Browser-Teile von AC-2 und AC-10 sowie ein abgelehntes Token (AC-7) sind NOT VERIFIED.
- **Edge Cases:**
  - In diesem Lauf bestanden: EC-1, EC-2, EC-3, EC-4, EC-7 und EC-8 (jeweils der Server-Teil, die Browser-Teile von EC-1, EC-3 und EC-8 sind NOT VERIFIED).
  - Übernommen: EC-5, EC-6, EC-10.
  - EC-9 ist NOT VERIFIED.
- **Bugs:** 9 insgesamt, davon 0 Critical und 0 High offen.
  - Fixed und re-verifiziert: BUG-1, BUG-2 (beide High).
  - Deferred: BUG-3 bis BUG-8 (Low, vom Nutzer entschieden).
  - Neu: BUG-9 (Medium), Deferred (vom Nutzer entschieden).
- **Security:** 17 Prüfpunkte.
  - 13 in diesem Lauf geprüft. 11 davon bestanden, 2 mit BUG-9: Brute force pro IP und Massen-Registrierung.
  - 3 übernommen vom 2026-10-25: Authorization, direkter Weg zu Supabase, CSRF.
  - 1 NOT VERIFIED: Rate limiting auf gewöhnlichen Endpunkten, nicht implementiert.
  - Nicht prüfbar waren außerdem ein abgelehntes Turnstile-Token, die go-live-Einstellungen, der Weg hinter einem echten Proxy und die Dashboard-Einstellung T4 selbst (nur ihre Wirkung).
- **Production Ready:** JA. Es gibt keinen offenen Critical- oder High-Bug, und die Laufzeit-Kriterien wurden gegen die laufende App geprüft.
- **Empfehlung:**
  - BUG-9 auflösen, am saubersten per `/refine PROJ-1`, damit Spec und Entscheidung wieder übereinstimmen.
  - T31 abhaken.

> „Production Ready: JA“ heißt nur, dass es keine Critical- oder High-Bugs gibt, nicht, dass alles geprüft wurde. Jeder NOT-VERIFIED-Punkt oben bleibt offen und braucht einen Menschen oder `/e2e-tests`.
