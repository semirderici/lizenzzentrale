# QA-Testergebnisse: PROJ-1 Konto & Login

**Getestet:** 2026-10-25
**App-URL:** http://localhost:3000 (`probe.kind: http`, `npm run dev`, einmal vom QA-Verantwortlichen gestartet)
**Tester:** QA Engineer (KI). Vier unabhängige `qa-engineer`-Prüfer ohne Build-Kontext: Abnahme Teil 1 (AC-1 bis AC-8, EC-1 bis EC-4, EC-7 bis EC-9), Abnahme Teil 2 (AC-9 bis AC-13, EC-5, EC-6, EC-10), Security, Regression. Zusammengeführt von der `/qa`-Sitzung.
**Umfang:** `full` (erster `/qa`-Lauf), Branch `feat/PROJ-1-account-login` auf Commit `9c23375`

> Legende: `[x]` in diesem Lauf geprüft (mit Beleg) · `[ ] BUG` als fehlerhaft geprüft · `[!] NOT VERIFIED` in diesem Lauf nicht prüfbar (mit Grund)

**So wurde geprüft:**
- **Server Actions:** per HTTP direkt aufgerufen, am Formular vorbei (`Next-Action`-Kopf, IDs aus `.next/dev/server/server-reference-manifest.json`).
- **Datenbank:** `env -u SUPABASE_ACCESS_TOKEN supabase db query --linked`.
- **Direkte Datenbank-Schnittstelle:** `/rest/v1/` und `/auth/v1/`, mit dem öffentlichen Schlüssel und dem Token eigener Testkonten.
- **Bot-Prüfung:** Cloudflares Turnstile-Testschlüssel (bestehen immer), Dummy-Token `XXXX.DUMMY.TOKEN.XXXX`.
- **Aufräumen:** Alle Testkonten (`qa-*@lizenzzentrale-test.de`) sind wieder gelöscht. Die Bremsdaten der Tests räumt der stündliche Job ab. Sie stammen aus den IP-Bereichen 192.0.2.0/24, 198.51.100.0/24, 198.18.0.0/24 und 203.0.113.0/24.

**Suite-Lauf** (einmal vor den Prüfern, `npm test`): 16 Dateien, 416 Tests bestanden, 0 fehlgeschlagen. **Build** (`npm run build`): exit 0.

## Akzeptanzkriterien

#### AC-1: Registrierung legt Konto, Träger mit 5 Lizenzen und Mitgliedschaft an, sofort angemeldet
- [x] Registrierung mit den mitgeschickten Zusatzfeldern `licenseQuota:999`, `license_quota:999` und `role:"owner"`:
  - Antwort: `x-action-redirect: /licenses;push` und 2 Sitzungs-Cookies.
  - Datenbank: `license_quota=5`, `role=admin`, Name getrimmt, in den Metadaten nur `training_provider_name`.
  - `GET /licenses` liefert 200.
  - Beleg: Action-Aufruf und `supabase db query`. Spaltenstandard in `supabase/migrations/20261021120000_proj1_training_providers.sql:18`, der Trigger liest nur den Namen (`:87-92`).
- [x] Sofort angemeldet, ohne Bestätigungsmail. Beleg: Sitzungs-Cookies in der Antwort; `/auth/v1/settings` meldet `mailer_autoconfirm:true` (Wirkung der `[user]`-Aufgabe T16).

#### AC-2: Ungültige Eingaben werden abgelehnt, mit Meldung am Feld
- [x] 12 ungültige Anfragen am Formular vorbei liefern jeweils die Feldmeldung aus `design.md`. Bei mehreren Fehlern stehen alle Felder gleichzeitig. Angelegt wird nichts: 0 Konten, 0 Bremszeilen. Beleg: Action-Aufrufe von IP 203.0.113.30, danach DB-Abfrage. Die 12 Fälle:
  - Name leer, nur aus Leerzeichen, nach dem Trimmen 1 Zeichen, 101 Zeichen
  - E-Mail ungültig
  - Passwort mit 7 Zeichen, mit 73 ASCII-Zeichen, mit 37×„ä“ (74 Bytes)
  - Wiederholung weicht ab
  - alle Felder falsch
  - Felder fehlen
  - Werte sind keine Zeichenketten
- [x] Diese Grenzwerte werden angenommen:
  - Name mit 2 und mit 100 Zeichen, 100 Emoji
  - Passwort mit 8 Zeichen, mit 72 ASCII-Zeichen, mit 36×„ä“ (= 72 Bytes)
  - E-Mail mit 254 Zeichen
  - Eine E-Mail mit 255 Zeichen wird abgelehnt. Beleg: Action-Aufrufe.
- [x] „Mindestens 8 Zeichen.“ steht schon vor der Eingabe unter dem Passwortfeld. Beleg: `curl /register`, Server-HTML direkt unter `name="password"`.
- [!] NOT VERIFIED: dass Trägername und E-Mail im Browser ausgefüllt bleiben. Es gab keinen Browser. Belegt nur durch den Code (`src/features/account/components/register-form.tsx:46-50`) und die Komponententests (`register-form.test.tsx:103,158`, grün im Suite-Lauf).

#### AC-3: Schon registrierte Adresse
- [x] Zweite Registrierung mit derselben Adresse in Großbuchstaben:
  - Meldung wortgleich, mit `loginLink:true`.
  - Weiterhin 1 Konto, kein neuer Träger, Versuch als `duplicate` gespeichert.
  - Beleg: Action-Aufruf und DB-Abfrage. Link „Zum Login“ in `register-form.tsx:134-141`.

#### AC-4: Anmelden und Lizenzübersicht
- [x] Login mit E-Mail in Großbuchstaben, Leerzeichen am Rand und richtigem Passwort führt zu `/licenses;push` und setzt Cookies. `GET /licenses` zeigt:
  - Seitentitel „Lizenzübersicht – Lizenzzentrale“
  - Kopfzeile mit „Lizenzzentrale“, dem Trägernamen als maskiertem Text und „Abmelden“ (`<form action="/sign-out" method="post">`)
  - `<h1>Lizenzübersicht</h1>` und den Platzhaltersatz
  - Beleg: Action-Aufruf, dann `curl -b … /licenses` (Abnahme Teil 1 und Regression).

#### AC-5: Gleiche Fehlermeldung für unbekannte Adresse und falsches Passwort
- [x] Unbekannte Adresse (2×) und falsches Passwort zu einer bekannten Adresse (2×) liefern denselben Text „E-Mail-Adresse oder Passwort ist falsch.“. Beleg: Action-Aufrufe.
- [x] Die Antwortzeiten sind vergleichbar: bekannte Adresse 1.047–1.052 ms, unbekannte 1.043–1.052 ms, gesperrte 1.043–1.053 ms. Mindestantwortzeit in `src/features/account/account.actions.ts:43,118-123`.
- [x] Ein Passwort mit mehr als 72 Zeichen liefert dieselbe Meldung und erzeugt keinen Bremseintrag (0 Zeilen für IP 203.0.113.36).

#### AC-6: Login-Bremse (5 pro Adresse oder 20 pro IP in 15 Minuten, dann 15 Minuten Sperre)
- [x] Sperre pro Adresse, echter Ablauf ohne nachgestellte Zeit:
  - 5 Fehlversuche, danach das richtige Passwort von einer anderen IP → „… in 15 Minuten erneut.“
  - Um 11:25 UTC lautet die Meldung „in 3 Minuten“.
  - Um 11:27:25 UTC klappt die Anmeldung wieder.
  - Beleg: Action-Aufrufe, `locked_until` in der DB.
- [x] 22 falsche Passwörter gegen ein Konto: ab Versuch 6 gesperrt, auch mit dem richtigen Passwort, von einer anderen IP und in anderer Schreibweise.
- [x] Eine unbekannte Adresse wird genauso nach 5 Fehlversuchen gesperrt, mit demselben Text.
- [x] Gleichzeitige Versuche: Von 12 parallelen Fehlversuchen auf eine Adresse, abgeschickt von 12 IPs, kommen genau 5 durch. Garantie: Advisory Locks, und laufende Prüfungen (`pending`) zählen mit, `supabase/migrations/20261021120100_proj1_login_throttle.sql:96-136`.
- [x] Sperre pro IP: Nach 20 Fehlversuchen mit verschiedenen Adressen von einer IP wird der 21. Versuch abgelehnt, auch mit richtigem Passwort.
- [ ] **BUG-2:** Die Sperre pro IP lässt sich mit einem selbst gesetzten `X-Forwarded-For`-Kopf umgehen. Nach der Sperre von 192.0.2.30 kamen Versuche von .31, .32 und .33 wieder bis zur Passwortprüfung. In der DB stehen genau diese, vom Client gewählten IPs (vom QA-Verantwortlichen nachgezählt).
- [ ] **BUG-8 (Low):** Im Pfad mit gleichzeitigen Versuchen nannten 7 von 12 Antworten „in 16 Minuten“. `design.md` legt für diesen Pfad 15 Minuten fest.

#### AC-7: Ohne bestandene Bot-Prüfung keine Registrierung und kein Login
- [x] Fehlt das Token, ist es leer oder 2.049 Zeichen lang, kommt bei Login und Registrierung die Meldung der Bot-Prüfung. Es entsteht kein Cookie, kein Konto und keine Bremszeile (IP 203.0.113.38: 0/0/0).
- [x] Direkter Weg zu Supabase mit dem öffentlichen Schlüssel, am Formular vorbei: `/auth/v1/signup`, `/token?grant_type=password`, `/otp`, `/magiclink`, `/recover` und eine Telefon-Registrierung liefern 400 `captcha_failed`, ohne Token und mit Dummy-Token. Damit wirkt die `[user]`-Aufgabe T18.
- [!] NOT VERIFIED: ein Token, das Cloudflare ablehnt. Das Test-Secret nimmt jedes Token an, auch `garbage-token-123`. Prüfbar ist das nur, wenn kurz `TURNSTILE_SECRET_KEY=2x0000000000000000000000000000000AA` in `.env.local` steht, und das durften die Prüfer nicht ändern. Belegt nur durch den Code (`src/features/account/turnstile.integration.ts:40-42`, `account.actions.ts:85,140`) und `turnstile.integration.test.ts` (grün).
- [!] NOT VERIFIED (go-live): das eigene Turnstile-Widget (T29 `[user go-live]`). `/deploy` richtet es ein und prüft es. Das Test-Gegenstück ist oben geprüft.

#### AC-8: Registrierungsbremse (5 pro IP und Stunde)
- [x] Von einer IP:
  - Ein Eingabefehler und eine Anfrage ohne Token zählen nicht.
  - Nach 1 Erfolg und 4 Duplikaten bekommen der 6. Versuch (neue Adresse) und der 7. (Duplikat) „Zu viele Registrierungen. Bitte versuchen Sie es später erneut.“, und es entsteht nichts.
  - Ein Serverfehler wird als `error` gespeichert und zählt nicht.
  - Beleg: Action-Aufrufe von 203.0.113.20, DB-Abfrage.
- [ ] **BUG-2:** Nach der Sperre von 192.0.2.40 kam die nächste Registrierung mit `X-Forwarded-For: 192.0.2.41` wieder bis zu Supabase.

#### AC-9: Weiterleitungen je nach Sitzung
- [x] Abgemeldet:
  - `/` → 307 `/login`.
  - `/licenses`, `/LICENSES`, `/licenses%2F`, `/foo`, außerdem mit `HEAD`, mit `RSC: 1` und mit `x-middleware-subrequest` (CVE-2025-29927) → 307 `/login?reason=session`.
  - Der Platzhaltersatz kommt in keiner dieser Antworten vor.
  - Beleg: `curl -D -`. Tor in `src/proxy.ts:47-69`.
- [x] `POST /licenses` ohne Sitzung (das Tor lässt POST durch) wird vom Wächter umgeleitet, ohne Inhalt. Wächter in `src/app/(app)/layout.tsx:14` und `src/app/(app)/licenses/page.tsx:14`.
- [x] Angemeldet: `/`, `/login`, `/register` und `/login?reason=session` → 307 `/licenses`.
- [x] Ein gefälschtes Sitzungs-Cookie (unsigniertes JWT mit `alg: none`) → 307. Grund: Das Tor fragt `getUser` am Auth-Server.

#### AC-10: Sitzung bleibt bestehen, Abmelden beendet sie
- [x] Die Sitzungs-Cookies sind dauerhaft: `Max-Age=34560000; HttpOnly; SameSite=lax`. Beleg: `Set-Cookie` nach Registrierung und Login, `src/lib/supabase/cookie-options.ts:13`.
- [x] Auffrischen ausgelöst über ein zurückdatiertes `expires_at`: `GET /licenses` → 200 mit neuem dauerhaftem Cookie.
- [x] Abmelden:
  - `POST /sign-out` → 303 `/login`, beide Cookie-Teile mit `Max-Age=0`.
  - Danach führt `/licenses` mit dem alten Cookie zu 307 `/login?reason=session`.
  - `/licenses` antwortet mit `Cache-Control: no-store`.
  - Beleg: `src/app/sign-out/route.ts:7-11`.
- [x] Scope `local`: Eine zweite Sitzung desselben Kontos bleibt gültig. GET, PUT, PATCH, DELETE und OPTIONS auf `/sign-out` melden nicht ab (405).
- [!] NOT VERIFIED: „Zurück“ im Browser (bfcache) und ein echter Neustart des Browsers. Es gab keinen Browser. Belegt sind nur `no-store` und dass ein neuer Abruf beim Login landet.

#### AC-11: Datentrennung zwischen Bildungsträgern
- [x] Lesen über `/rest/v1` mit dem eigenen Token:
  - A sieht genau 1 Träger und 1 Mitgliedschaft. Für die IDs von B kommt `[]`.
  - B sieht genauso nur B, auch über eingebettete Joins.
- [x] Schreibversuche als A enden alle mit 403 `42501`:
  - Kontingent oder Name ändern, beim eigenen und beim fremden Träger
  - einen Träger anlegen, Upsert des eigenen Trägers
  - eine Mitgliedschaft anlegen, auf B umhängen, ihre Rolle ändern oder löschen
  - die Bremsfunktionen per RPC aufrufen
- [x] Abgemeldet (`anon`): 401 `42501`, keine Zeilen.
- [x] In der Datenbank:
  - RLS ist an.
  - Policies gibt es nur für SELECT durch `authenticated`.
  - Grants: `authenticated` nur SELECT, `anon` gar nichts.
  - Das Schema `private` ist über die API nicht erreichbar (`PGRST106`), GraphQL ist aus.
  - Beleg: `pg_policies`, `information_schema.role_table_grants`, `supabase/migrations/20261021120000_proj1_training_providers.sql:43-70`.
- [x] Die eigenen `user_metadata` lassen sich über `PUT /auth/v1/user` ändern, haben aber keine Wirkung. Die Kopfzeile zeigt weiter den echten Namen, und `src` liest die Metadaten nirgends (`grep -rn "user_metadata\|raw_user_meta\|app_metadata" src` findet nur `src/test/supabase.ts`).

#### AC-12: Löschen eines Kontos durch den Anbieter
- [x] Konto über die Admin-API gelöscht. Danach 0 Zeilen in `auth.users`, `identities`, `sessions`, `refresh_tokens`, `training_provider_members`, `training_providers` sowie bei Login-Versuchen und Sperren der Adresse. Beleg:
  - Kaskade: `supabase/migrations/20261021120000_proj1_training_providers.sql:28,30`
  - Trigger für den letzten Verwalter: `:109-130`
  - Trigger beim Löschen eines Kontos: `supabase/migrations/20261021120100_proj1_login_throttle.sql:321-338`
- [ ] **BUG-1:** In `auth.audit_log_entries` bleiben Zeilen mit Konto-ID und E-Mail-Adresse des gelöschten Kontos (5 Zeilen für das Testkonto).

#### AC-13: Daten der Bremsen sind nach 24 Stunden gelöscht
- [x] Der Job `license-center-cleanup` (`0 * * * *`) ist aktiv. Die Läufe um 10:00 und 11:00 UTC stehen auf `succeeded`. Beleg: `cron.job`, `cron.job_run_details`.
- [x] Aufräumfunktion in `begin … rollback` mit zurückdatierten eigenen Zeilen:
  - gelöscht: Einträge mit 23h01, 24h und 25h; Sperren ohne Wirkung
  - behalten: Einträge mit 22h59; aktive Sperren
  - Beleg: `supabase/migrations/20261021120200_proj1_cleanup_job.sql:6-22,30-34`. Ausführen darf nur der Eigentümer (`proacl {postgres=X/postgres}`).

## Edge Cases

#### EC-1: Mehrfaches Absenden
- [x] 4 gleichzeitige Registrierungen mit derselben neuen Adresse ergeben genau 1 Konto, 1 Träger und 1 Mitgliedschaft. Die anderen 3 bekommen die Meldung aus AC-3. Garantie: Unique-Index `users_email_partial_key` auf `auth.users(email)` und die Nachfrage in `src/features/account/account.actions.ts:107-111`.
- [!] NOT VERIFIED: der gesperrte Knopf während des Sendens im Browser. Belegt nur durch den Code (`register-form.tsx:37,148`) und `register-form.test.tsx:134` (grün).

#### EC-2: Zwei Besucher gleichzeitig mit derselben Adresse
- [x] 4 gleichzeitige Registrierungen von 4 verschiedenen IPs: genau 1 Erfolg. Die anderen sehen die Meldung aus AC-3 mit Login-Link, gespeichert als `duplicate`.

#### EC-3: Fehler mitten in der Registrierung
- [x] Garantie „alles oder nichts“: `insert into auth.users` mit dem Namen `" x "` in einer zurückgerollten Transaktion bricht mit `23514 training_providers_name_check` aus dem Trigger ab, 0 Zeilen.
- [x] Laufzeit: Ein Name mit NUL-Zeichen führt zu einem Fehler bei Supabase. Die Meldung lautet „Die Registrierung ist fehlgeschlagen. Bitte versuchen Sie es erneut.“, es gibt 0 Konten, der Versuch steht auf `error`. Siehe aber BUG-5.
- [!] NOT VERIFIED: dass die Felder im Browser stehen bleiben. Belegt nur durch den Code (`register-form.tsx:46-50`) und die Tests (`register-form.test.tsx:158,200`).

#### EC-4: Großbuchstaben und Leerzeichen in der E-Mail-Adresse
- [x] Registriert wird klein und getrimmt. Das Duplikat in Großbuchstaben wird erkannt, die Anmeldung mit Großbuchstaben und Leerzeichen klappt.
- [x] Ein Fehlversuch steht kleingeschrieben in `license_center_login_attempts` und zählt mit.
- [x] Das Passwort `" Pass wort-A1 "` wird nie verändert: getrimmt kommt die Meldung aus AC-5, exakt eingegeben klappt der Login.

#### EC-5: Konto ohne Bildungsträger
- [x] Nur den eigenen Träger per SQL gelöscht: Konto bleibt, Mitgliedschaft 0. Danach zeigt `/licenses` (200):
  - die Kopfzeile ohne Namen, mit „Abmelden“
  - in `<main>` nur `role="alert"` mit dem Text aus EC-5, kein `h1`, kein Platzhalter
  - `POST /sign-out` → 303 `/login`
  - Beleg: `src/app/(app)/layout.tsx:19-23`, `src/features/account/session.data.ts:47-50`.

#### EC-6: Abmelden in einem anderen Tab
- [x] Mit dem alten Cookie nach dem Abmelden:
  - `GET /licenses` und der RSC-Abruf → 307 `/login?reason=session`, ohne Fehlerseite.
  - „Abmelden“ → 303 `/login?reason=session`.
  - `/login?reason=session` zeigt „Bitte melden Sie sich erneut an.“
- [x] Kein Hinweis bei `reason=SESSION`, `reason=<script>…` oder einem doppelten Parameter. Der Wert aus der Adresse erscheint nie. Beleg: `src/app/(auth)/login/page.tsx:15-20`.

#### EC-7: Erfolgreicher Login setzt den Zähler zurück
- [x] 3 Fehlversuche, Erfolg, 2 Fehlversuche, dann das richtige Passwort → Erfolg. Ohne Zurücksetzen hätte es nach 5 Fehlversuchen eine Sperre gegeben. In der DB wird `count_from` neu gesetzt.

#### EC-8: Bot-Prüfung lädt nicht
- [x] Server:
  - Ohne Token kommt nichts durch (siehe AC-7).
  - Fehlt das Secret oder ist Cloudflare nicht erreichbar, ist das Ergebnis „Fehler“, nie „bestanden“ (`src/features/account/turnstile.integration.ts:19,31-35`).
  - Beide Knöpfe tragen im Server-HTML `disabled=""`.
- [!] NOT VERIFIED: Meldung und gesperrter Knopf im Browser. Belegt nur durch den Code (`bot-check.tsx:63-71,103-110`) und die Tests (`bot-check.test.tsx:85-149`, `login-form.test.tsx:190`, `register-form.test.tsx:209`).

#### EC-9: Keine Verbindung
- [!] NOT VERIFIED: Ein Verbindungsabbruch braucht einen Browser. Belegt durch:
  - den Code: `src/features/account/components/form-feedback.tsx:45-47`, `login-form.tsx:52-55`, `register-form.tsx:56-62`
  - die Komponententests `login-form.test.tsx:168` und `register-form.test.tsx:190`
  - die neuen Unit-Tests `form-feedback.test.tsx` aus diesem Lauf (siehe unten)

#### EC-10: Langer Trägername mit HTML
- [x] Trägername mit 98 Zeichen, `<b>Träger & "Co"</b><script>alert(1)</script> …`:
  - Im HTML maskiert, 0 Treffer für rohes `<script>alert(1)`.
  - Die Kopfzeile hat `min-w-0 truncate` und `title` mit dem vollen Namen.
  - „Abmelden“ hat `shrink-0`, der Knopf `h-11 min-w-11`.
  - Beleg: `src/components/app-header.tsx:9,13-22`.
- [!] NOT VERIFIED: wie die Kürzung mit „…“ tatsächlich aussieht. Es gab keinen Browser.

#### Zusätzlich gefundene Edge Cases
- [x] Nicht-String-Typen, fehlende Felder und Objekte wie `{"$ne":null}` in beiden Actions ergeben Feldmeldungen, kein Absturz, nichts angelegt.
- [x] `/licenses/` und `//licenses` → 308 auf `/licenses`, dann greift das Tor. Ein Konto ohne Träger wird bei `/login` auf `/licenses` geleitet, ohne Schleife.
- [x] Eine Server Action mit fremdem `Origin` endet mit 500 „Invalid Server Actions request“.
- [x] Im Protokoll des Dev-Servers stehen keine Passwörter oder Tokens: `grep` nach den Testpasswörtern, `eyJ` und `sb_secret` findet 0 Treffer, weil `logging.serverFunctions` aus ist (`next.config.ts:6-8`).
- [ ] **BUG-5 (Low):** Steuerzeichen im Trägernamen.
- [ ] **BUG-6 (Low):** Registrierung angelegt, aber Meldung „bereits registriert“.
- [ ] **BUG-7 (Low):** Zugriffstoken nach dem Abmelden noch gültig.

#### Technische Anforderungen: App-Rahmen und Browser
- [x] Erfüllt laut Server-HTML und Quelltext:
  - `lang="de"`, Inter selbst ausgeliefert (0 Treffer für `fonts.googleapis`/`gstatic`), auf `/licenses` kein Turnstile-Skript
  - sichtbarer Fokus über `focus-visible:ring-2`
  - Tippflächen `h-11` bzw. `min-h-11`
  - Hinweisboxen als Text mit `role="alert"`
  - Viewport-Meta gesetzt
- [ ] **BUG-3 (Low):** Das Turnstile-Widget ist breiter als die Karte bei weniger als 364 px Bildschirmbreite.
- [ ] **BUG-4 (Low):** Es gibt kein `error.tsx` und kein `not-found.tsx`.
- [!] NOT VERIFIED: Kontrast in beiden Themes, Darstellung bei 375/768/1440 px, Chrome/Firefox/Safari/Edge. Dafür braucht es einen Browser.

## Security-Audit

- [x] **Authentication:** Ohne Sitzung kommt man nicht hinein. Belege siehe AC-9:
  - `curl` auf 8 Varianten von `/licenses` → 307
  - gefälschtes JWT → 307
  - `x-middleware-subrequest` → 307
  - Code: `src/proxy.ts:47-68`, `src/features/account/session.data.ts:27-45`
- [x] **Authorization:** Kein Verwalter sieht oder ändert Daten eines anderen. Getestet mit zwei Konten direkt gegen `/rest/v1`, Ergebnisse siehe AC-11. Policies und Grants: `supabase/migrations/20261021120000_proj1_training_providers.sql:43-70`.
- [x] **Input validation:**
  - HTML/XSS im Trägernamen wird maskiert ausgegeben, auch im `title`.
  - SQL-artige Eingaben, NoSQL-Objekte, Arrays, `\r\nBcc:` und `__proto__` landen als Feldfehler.
  - 5.000 Zeichen pro Feld werden abgelehnt.
  - Mitgeschicktes `license_quota` wird ignoriert.
  - Beleg: Zod in `src/features/account/account.schema.ts:110-138`, `safeParse` in `account.actions.ts:73,125`.
- [!] **Rate limiting auf gewöhnlichen Endpunkten** (`/sign-out`, Seiten): NOT VERIFIED, nicht implementiert (für das MVP optional).
- [ ] **BUG-2, Brute force:** Sperre pro Konto ✓ (ab Versuch 6, auch für das richtige Passwort). Die Sperre pro IP greift nach 20 Versuchen, lässt sich aber über `X-Forwarded-For` umgehen. Damit ist Passwort-Spraying über viele Adressen unbegrenzt möglich.
- [x] **Keine Kontenaufzählung beim Login:** gleicher Text für unbekannte und bekannte Adressen, Antwortzeiten 1.043–1.053 ms in allen Fällen (siehe AC-5). Bei der Registrierung ist der Hinweis bewusst offen (Decision Log der Spec).
- [ ] **BUG-2, Massen-Registrierung:** Die Registrierungsbremse lässt sich über `X-Forwarded-For` umgehen (siehe AC-8). Mit den Testschlüsseln lässt die Bot-Prüfung lokal alles durch.
- [x] **Direkter Weg zu Supabase gesperrt:** Signup, Token, OTP, Magic Link, Recover und Telefon liefern mit dem öffentlichen Schlüssel `captcha_failed` (siehe AC-7).
- [x] **Keine Zugangsdaten in der URL:** Beide Formulare werden als `<form … method="post">` gerendert. Ein nativer POST mit urlencoded Body bleibt ohne Daten in der Adresse.
- [x] **Keine Geheimnisse im Client-Bundle:**
  - Ein Skript hat die echten Werte von `SUPABASE_SERVICE_ROLE_KEY` und `TURNSTILE_SECRET_KEY` geladen und nur Treffer gezählt. In `.next/static` (90 Dateien) und 26 live geladenen Dev-Chunks: 0 Treffer.
  - `grep 'sb_secret_|service_role|SERVICE_ROLE|TURNSTILE_SECRET'` in den Bundles: 0 Treffer.
  - Der Server-Schlüssel steckt nur in `src/lib/supabase/admin.ts:12` (`server-only`).
- [x] **Keine Geheimnisse in der Git-Historie:** `git log --all -p | grep -cE 'sb_secret_…|eyJhbGciOi…|sb_publishable_…'` = 0. Die einzige eingecheckte Env-Datei ist `.env.local.example`.
- [x] **Keine sensiblen Daten in Antworten:** Die Antwort auf einen erfolgreichen Login enthält kein Token, keine Konto-ID und keine E-Mail (0 Treffer für `access_token|refresh_token|eyJ|"sub"`). Das HTML von `/licenses` enthält keine IDs, kein Kontingent und kein Token.
- [x] **Sicherheitsheader:** `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: origin-when-cross-origin` und `Strict-Transport-Security: max-age=31536000; includeSubDomains`, kein `X-Powered-By`. Gemessen auf `/login`, `/register`, `/licenses`, einer unbekannten Adresse und einem statischen Chunk. Konfiguration: `next.config.ts:12-24`.
- [x] **CSRF:** Eine Server Action mit fremdem `Origin` wird abgelehnt (500 „Invalid Server Actions request“).
- [ ] **BUG-1, `[user]`-Einstellungen:** T1–T4, T8 und T16–T18 sind abgehakt. Bei T16, T17 und T18 ist die Wirkung beobachtet:
  - T16: `mailer_autoconfirm:true`
  - T17: `weak_password` bei 6 Zeichen
  - T18: `captcha_failed`
  - **T4 wirkt nicht:** Das Audit-Log wird weiter in die Datenbank geschrieben.
  - T29 und T30 sind `[user go-live]` und damit kein Bug.

## Regression

- [x] **Suite:** 16 Dateien, 416 Tests bestanden, 0 fehlgeschlagen (`npm test`, einmal vor den Prüfern). Alle 16 versionierten Testdateien liefen mit.
- [x] **Prüfdefinitionen intakt:**
  - `.skip`, `.only`, `.todo`, `xit`, `fit`: 0 Treffer.
  - Keine leeren Assertions. Der einzige Treffer der Suche, `login-form.test.tsx:127`, ist eine echte Prüfung.
  - `vitest.config.mts` schließt nur `tests/**` aus.
  - Die Integrationstests werfen, wenn eine Variable fehlt (`src/test/supabase.ts:14-18`).
  - Die Scripts in `package.json` sind gegenüber `main` unverändert.
- [x] **Statische Prüfungen:** `npm run build` exit 0 inkl. TypeScript, `npm run lint` exit 0, `npm run check:structure` meldet „106 modules scanned, 0 errors“.
- [x] **Deployte Features:** In `features/INDEX.md` hat keines den Status „Deployed“, zu PROJ-2 und PROJ-3 gibt es noch keinen Code. Rückwärts ist also nichts zu prüfen.
- [x] **Gemeinsame Teile liefern ihren Inhalt** (geholtes HTML):
  - Wurzel-Layout (`lang="de"`, Seitentitel)
  - Design-Tokens im ausgelieferten CSS (`--primary`, `prefers-color-scheme: dark`, `.type-title`)
  - die Schrift-Datei (200 `font/woff2`)
  - der Rahmen für Abgemeldete mit Links zwischen Login und Registrierung
  - die statischen SVGs (200)
- [!] NOT VERIFIED: Optik und Responsive-Verhalten der gemeinsamen Teile. Es gab keinen Browser.
- [!] NOT VERIFIED: der Produktions-Server (`next start`). Geprüft ist der Dev-Server, den Build belegt `exit 0`.

## Unit-Tests (in diesem Lauf geschrieben)

- [x] `src/features/account/components/form-feedback.test.tsx`: 20 Tests zu `isRedirectError` und `isConnectionError`. Die beiden Funktionen entscheiden, ob ein abgefangener Fehler nach dem Absenden Erfolg ist (Weiterleitung, AC-1, AC-4), „Keine Verbindung“ (EC-9) oder ein Serverfehler (EC-3).
  - Lauf: `npx vitest run src/features/account/components/form-feedback.test.tsx` → 20 bestanden.
  - **Gegenbeweis:** Alle Erwartungen der Datei umgedreht → 20 von 20 rot. Wieder hergestellt → 20 von 20 grün.
- Geprüft und bewusst nicht ergänzt: `account.rules.ts`, `account.schema.ts` und `cookie-options.ts` haben schon dichte Tests mit Grenzwerten. Diese Tests lagen im Suite-Lauf grün.

## E2E-Tests
_Optionale Ebene, geschrieben von `/e2e-tests` nur für kritische Kernabläufe._

- Status: **nicht gelaufen** (`/e2e-tests` für kritische Abläufe ausführen). `tests/` existiert noch nicht.

## Nicht verifiziert in diesem Lauf

- [!] **Darstellung in verschiedenen Browsern** (Chrome, Firefox, Safari, Edge): `/qa` läuft ohne Browser, das deckt nur `/e2e-tests` ab.
- [!] **Responsive Layout bei 375/768/1440 px**, Kürzung des Trägernamens (EC-10), Kontrast: Dafür braucht es einen echten Viewport. BUG-3 ist aus dem Code berechnet, nicht gerendert.
- [!] **Verhalten im Browser:**
  - Felder bleiben ausgefüllt (AC-2, EC-3)
  - Knopf gesperrt während des Sendens (EC-1)
  - Meldung, wenn das Widget nicht lädt (EC-8)
  - Verbindungsabbruch (EC-9)
  - „Zurück“ und Browser-Neustart (AC-10)
  - Belegt sind diese Punkte nur durch Code und Komponententests.
- [!] **Ein von Cloudflare abgelehntes Token (AC-7):** Das Test-Secret nimmt jedes Token an. Zum Prüfen kurz `TURNSTILE_SECRET_KEY=2x0000000000000000000000000000000AA` in `.env.local` setzen.
- [!] **Eigenes Turnstile-Widget (T29) und Auftragsverarbeitungsverträge (T30):** go-live, werden in `/deploy` gemacht und geprüft.
- [!] **Wirkung von `X-Forwarded-For` hinter einem echten Host:** go-live, es gibt kein Deployment.
- [!] **Supabases eigene Grenzen** für Aufrufe mit dem Server-Schlüssel (Authentication → Rate Limits): nicht ausgereizt, damit sich die Prüfer nicht gegenseitig sperren.
- [!] **Rate limiting auf gewöhnlichen Endpunkten:** nicht implementiert, für das MVP optional.
- [!] **Produktions-Server (`next start`):** nicht gestartet.

## Bugs

#### BUG-1: Supabase schreibt das Auth-Audit-Log in die Datenbank, Reste gelöschter Konten bleiben
- **Severity:** High. Verletzt AC-12 („keine Zeile verweist mehr auf ihn“, Art. 17 DSGVO).
- **Status:** Open
- **Class:** Eine abgehakte `[user]`-Einstellung im Anbieter-Dashboard wirkt nicht, und keine Prüfung bestätigt ihre Wirkung. Konkret T4: „Write audit logs to the database“ → aus. `design.md`, `README.md:33` und `docs/privacy.md:57` versprechen dasselbe.
- **Sweep:** `env -u SUPABASE_ACCESS_TOKEN supabase db query --linked "select count(*) from auth.audit_log_entries a where payload->>'actor_id' is not null and not exists (select 1 from auth.users u where u.id::text = a.payload->>'actor_id')"` → **887 Zeilen zu 219 gelöschten Konten**. Insgesamt stehen 924 Zeilen in der Tabelle, 569 davon aus der letzten Stunde (Stand 2026-10-25, 11:13 UTC). Die anderen `[user]`-Einstellungen (T16, T17, T18) wirken nachweislich.
- **Steps to Reproduce:**
  1. Ein Konto über `/register` anlegen.
  2. Das Konto in Supabase → Authentication → Users löschen.
  3. `select payload->>'action' from auth.audit_log_entries where payload::text like '%<user-id>%'` ausführen.
  4. Erwartet: 0 Zeilen.
  5. Tatsächlich: Zeilen wie `user_signedup`, `login`, `logout` und `user_deleted`, mit Konto-ID und E-Mail-Adresse.
- **Hinweis:**
  - Die Einstellung im Dashboard prüfen (Authentication → Audit Logs).
  - Den Bestand bereinigen.
  - Lässt sich die Einstellung nicht wirksam abschalten, braucht AC-12 einen anderen Weg (`/build`, ggf. `/architecture`).
  - Ob die Spalte `ip_address` der Einträge gefüllt ist, wurde nicht geprüft. Das betrifft die Begründung von T4 zu AC-13.

#### BUG-2: IP-Sperren von Login und Registrierung über `X-Forwarded-For` umgehbar
- **Severity:** High. Verletzt AC-6 (Teil „20 Fehlversuche von derselben IP-Adresse“), AC-8 und die Technische Anforderung „Jede Regel … gilt auf dem Server“. Damit greift auch die Abfederung nicht, mit der der Decision Log den offenen Hinweis aus AC-3 begründet.
- **Status:** Open
- **Class:** Die Client-IP für Sicherheitsentscheidungen kommt aus einem Kopf, den der Client selbst setzt, ohne vertrauenswürdigen Proxy davor.
  - `src/features/account/account.actions.ts:68-70` liest `x-forwarded-for`.
  - `src/features/account/account.rules.ts:69-79` übernimmt den letzten Eintrag.
  - Next.js setzt die Verbindungsadresse nur ein, wenn der Kopf fehlt. Lokal ist das `::1`.
- **Sweep:** `grep -rni "x-forwarded-for\|x-real-ip" src | grep -v '\.test\.'` → 4 Treffer, davon 1 Codestelle (`account.actions.ts:69`). Die anderen 3 sind Kommentare in `account.rules.ts`.
- **Steps to Reproduce:**
  1. 20 Logins mit `X-Forwarded-For: 192.0.2.30`, jeweils eine andere unbekannte Adresse und dasselbe Passwort. Der 21. Versuch bekommt „Zu viele Anmeldeversuche…“.
  2. Denselben Versuch mit `X-Forwarded-For: 192.0.2.31` wiederholen.
  3. Erwartet: weiterhin gesperrt, denn der Absender ist derselbe.
  4. Tatsächlich: „E-Mail-Adresse oder Passwort ist falsch.“, der Versuch erreicht also die Passwortprüfung.
  5. Registrierung: 5 Duplikate von 192.0.2.40, der 6. Versuch ist gesperrt. Der nächste Versuch mit 192.0.2.41 erreicht wieder Supabase.
- **Hinweis:**
  - `design.md` nennt das Risiko selbst (Technische Entscheidungen „IP aus dem letzten Eintrag“ und Offene Frage „Vor einem Live-Gang“).
  - Laut PRD wird nie deployt. Der lokale Betrieb ist also der Betrieb, und dort steht kein Proxy davor, der den Kopf setzt.
  - `next dev` lauscht außerdem im lokalen Netz.
  - Die Sperre pro Adresse wirkt unabhängig davon.

#### BUG-3: Turnstile-Widget breiter als die Karte bei schmalen Smartphones
- **Severity:** Low. Betrifft die Technische Anforderung „nutzbar ab Smartphone-Breite“. Aus dem Code berechnet, nicht gerendert.
- **Status:** Deferred (vom Nutzer entschieden am 2026-10-25)
- **Class:** Element mit fester Mindestbreite in einem schmaleren Container.
- **Sweep:** `grep -rn "size: 'flexible'" src --include='*.tsx' | grep -v test` → 1 Treffer (`src/features/account/components/bot-check.tsx:17`). Die Bibliothek setzt `minWidth: 300`.
- **Steps to Reproduce:**
  1. `/login` bei 360 px Breite öffnen.
  2. Die Inhaltsbreite der Karte ist 360 − 2×16 − 2×1 − 2×16 = 294 px.
  3. Erwartet: Das Widget passt in die Karte.
  4. Tatsächlich: Es ragt 6 px über die Karte hinaus, bei 320 px sind es 46 px, und die Seite scrollt waagerecht. Ab 364 px passt es.

#### BUG-4: Keine eigene Fehler- und 404-Seite
- **Severity:** Low
- **Status:** Deferred (vom Nutzer entschieden am 2026-10-25)
- **Class:** Systemseiten fehlen im App-Rahmen.
  - `docs/app-shell.md` → Seitenmuster verlangt bei einem Ladefehler eine Hinweisbox mit „Erneut versuchen“.
  - Laut PRD ist die Oberfläche nur auf Deutsch.
  - `design.md` → „Offen für /qa“ nennt den Punkt selbst.
- **Sweep:** `find src/app -name 'error.tsx' -o -name 'global-error.tsx' -o -name 'not-found.tsx' | wc -l` → 0.
- **Steps to Reproduce:**
  1. Anmelden, dann `GET /does-not-exist` aufrufen.
  2. Erwartet: eine deutsche Seite im App-Rahmen.
  3. Tatsächlich: 404 mit Next.js' englischer Standardseite „404: This page could not be found.“ und zwei `<title>`-Tags.
  4. Kann die Mitgliedschaft nicht gelesen werden, wirft der Wächter (`src/features/account/session.data.ts:45`), und Next.js zeigt seine Standard-Fehlerseite statt der Hinweisbox. Das ist aus dem Code abgeleitet, der Fehler wurde nicht ausgelöst.

#### BUG-5: Trägername mit Steuerzeichen besteht das Schema
- **Severity:** Low
- **Status:** Deferred (vom Nutzer entschieden am 2026-10-25)
- **Class:** Die Freitext-Eingaberegel schließt Steuerzeichen nicht aus.
- **Sweep:** `grep -rnE 'p\{Cc\}|x00|u0000|control' src --include='*.schema.ts'` → 0 Treffer. Betroffen ist das einzige gespeicherte Freitextfeld, `src/features/account/account.schema.ts:59`.
- **Steps to Reproduce:**
  1. `register` am Formular vorbei mit `trainingProviderName: "QA\u0000A1"` und sonst gültigen Werten aufrufen.
  2. Erwartet: eine Feldmeldung am Trägernamen.
  3. Tatsächlich: die allgemeine Meldung „Die Registrierung ist fehlgeschlagen…“. Es entsteht nichts.
  4. Andere Steuer- und Bidi-Zeichen würden gespeichert und in der Kopfzeile ausgegeben (nicht ausgelöst).
- **Ebenfalls beobachtet, nicht verifiziert:** Ein Name mit `'; drop table x;--` endete mit derselben allgemeinen Meldung, ohne diesen Teil klappte die Registrierung. Vermutlich ein Filter vor der Supabase-API.

#### BUG-6: Nach erfolgreicher Registrierung erscheint „bereits registriert“, wenn die Sitzung nicht übernommen wird
- **Severity:** Low. Nur im Code gefunden, nicht ausgelöst.
- **Status:** Deferred (vom Nutzer entschieden am 2026-10-25)
- **Class:** Der Fehler-Fallback hält den eigenen Erfolg für ein fremdes Duplikat.
- **Sweep:** `grep -rn "isEmailRegistered(" src --include='*.ts' | grep -v test` → 2 Treffer, davon 1 Aufruf (`src/features/account/account.actions.ts:107-111`).
- **Steps to Reproduce:**
  1. `signUp` gelingt, aber das anschließende `setSession` (`src/features/account/auth.data.ts:64`) scheitert, z. B. bei einem kurzen Netzausfall zu Supabase.
  2. Erwartet: sofort angemeldet (AC-1) oder die Meldung aus EC-3.
  3. Tatsächlich: Die Nachfrage findet das gerade angelegte Konto. Der Nutzer sieht „bereits registriert, bitte anmelden“, und der Versuch zählt als `duplicate`. Die Anmeldung klappt danach.

#### BUG-7: Zugriffstoken liest nach dem Abmelden weiter über die Datenbank-Schnittstelle
- **Severity:** Low. Die App selbst ist dicht, und das Cookie ist HttpOnly.
- **Status:** Deferred (vom Nutzer entschieden am 2026-10-25)
- **Class:** Ein zustandsloses JWT bleibt nach dem Abmelden bis zu seinem Ablauf gültig, weil die Leseregeln nicht prüfen, ob die Sitzung noch besteht.
- **Sweep:** `grep -rn "session_id\|auth.sessions" supabase/migrations | wc -l` → 0.
- **Steps to Reproduce:**
  1. Das Token aus dem Sitzungs-Cookie nehmen.
  2. `POST /sign-out`.
  3. `GET /rest/v1/training_providers` mit diesem Token aufrufen.
  4. Erwartet: keine Zeilen.
  5. Tatsächlich: 200 mit der eigenen Zeile, bis das Token abläuft (höchstens etwa 1 Stunde). `/auth/v1/user` meldet schon 403 `session_not_found`.

#### BUG-8: Sperrmeldung nennt „16 Minuten“ bei gleichzeitigen Versuchen
- **Severity:** Low
- **Status:** Deferred (vom Nutzer entschieden am 2026-10-25)
- **Class:** Die Restzeit wird aus zwei Uhren berechnet: das Sperrende aus `now()` der Datenbank, die Gegenwart aus `new Date()` auf dem Server (`src/features/account/account.actions.ts:145`). Aufgerundet (`src/features/account/account.rules.ts:48`) ergibt ein winziger Uhrenversatz eine Minute mehr.
- **Sweep:** `grep -rn "remainingMinutes(" src --include='*.ts' | grep -v test` → 2 Treffer: die Definition (`account.rules.ts:44`) und 1 Aufruf (`account.rules.ts:198`).
- **Steps to Reproduce:**
  1. 12 gleichzeitige Fehlversuche auf eine frische Adresse schicken.
  2. Erwartet laut `design.md` → Login-Bremse im Detail: „Die Meldung nennt also 15 Minuten“.
  3. Tatsächlich: 7 von 12 Antworten nannten „in 16 Minuten“. Das hat der Security-Prüfer beobachtet, die Ursache ist aus dem Code abgeleitet.

## Hinweise ohne Bug (zur Kenntnis)

- **Abmelden ohne Prüfung des `Origin`:** `/sign-out` verlässt sich auf `SameSite=Lax`. Mit curl ließ sich ein fremdes Abmelden auslösen, ein Browser schickt das Cookie dabei aber nicht mit.
- **Registrieren mit bestehender Sitzung:** Die Action ist auch für angemeldete Nutzer aufrufbar und würde die Sitzung ersetzen (nicht getestet).
- **Kontosperre als Hebel:** Jeder kann eine bekannte Adresse mit 5 Fehlversuchen für 15 Minuten sperren. So hat es die Spec entschieden, mit echter Bot-Prüfung kostet jeder Versuch ein gelöstes CAPTCHA.
- **Kein `Content-Security-Policy`-Kopf:** Die Sicherheitsregeln verlangen ihn nicht.
- **Seitentitel bei einem Konto ohne Träger:** weiterhin „Lizenzübersicht – Lizenzzentrale“.
- **Außerhalb von PROJ-1:**
  - In `features/INDEX.md` → Deployments steht noch die Beispielzeile des Kits.
  - `/favicon.ico` liefert 404, wie auf `main`.
  - `passWithNoTests` würde ein kaputtes Include-Muster grün durchlassen.

## Zusammenfassung
- **Akzeptanzkriterien:** 10 von 13 bestanden, 3 fehlgeschlagen (AC-6, AC-8 durch BUG-2; AC-12 durch BUG-1). Die Browser-Teile von AC-2, AC-7 und AC-10 sind NOT VERIFIED.
- **Edge Cases:** 9 von 10 bestanden (bei EC-1, EC-3, EC-8 und EC-10 ist der Browserteil NOT VERIFIED), EC-9 NOT VERIFIED.
- **Bugs:** 8 insgesamt (0 Critical, 2 High, 0 Medium, 6 Low). Open: 2 (BUG-1, BUG-2), Deferred: 6 (BUG-3 bis BUG-8, vom Nutzer entschieden).
- **Security:** 15 Prüfpunkte. 11 geprüft und bestanden, 3 geprüft mit Bug (Brute force und Massen-Registrierung durch BUG-2, `[user]`-Einstellung T4 durch BUG-1), 1 NOT VERIFIED (Rate limiting auf gewöhnlichen Endpunkten, nicht implementiert). Nicht prüfbar waren außerdem: ein abgelehntes Turnstile-Token, die go-live-Einstellungen, `X-Forwarded-For` hinter einem Host und Supabases eigene Grenzen.
- **Production Ready:** NEIN
- **Empfehlung:** Erst BUG-1 und BUG-2 beheben (`/build PROJ-1`), dann `/qa` erneut.

> „Production Ready: JA“ hieße nur, dass es keine Critical-/High-Bugs gibt, nicht, dass alles geprüft wurde. Jeder NOT-VERIFIED-Punkt oben bleibt offen und braucht einen Menschen oder `/e2e-tests`.
