# QA-Testergebnisse: PROJ-3 Einladungs-E-Mail

**Getestet:** 2026-11-01, dritter `/qa`-Lauf: Nachprüfung nach dem Fix der Deferred-Bugs BUG-1, BUG-3, BUG-4 und BUG-5. Stand `da63ae4` auf `feat/PROJ-3-invitation-email`. Frühere Läufe am selben Tag: der erste Lauf (Bericht in Commit `024a0a2`) und die Nachprüfung von BUG-2 (Bericht in Commit `17fa8a1`).

**App-URL:** http://localhost:3001, von der `/qa`-Sitzung gestartet, immer ohne Mailjet-Schlüssel. Es ging also keine Mail hinaus, auch nicht an `example.com`.
- **Für den Prüfer:** `MAILJET_API_KEY= MAILJET_SECRET_KEY= npx next dev -p 3001`. Das Linkziel kam gültig aus `.env.local`.
- **Für BUG-4 danach zweimal neu gestartet,** zusätzlich mit `LEARNING_PLATFORM_URL='javascript:alert(1)'` und mit `LEARNING_PLATFORM_URL=` (leer).
- Port 3000 aus `probe.baseUrl` war wieder von einem anderen Projekt belegt (`lsof -iTCP:3000` → `next-server` mit Arbeitsordner `…/Developer/speechwerk`). Dieser Server wurde nicht angefasst.

**Tester:** QA Engineer (KI). Ein unabhängiger `qa-engineer`-Prüfer ohne Build-Kontext, mit allen drei Bereichen nacheinander: Abnahme (Step 2) → Security (Step 3) → Regression (Step 4 und 5). Zusammengeführt hat die `/qa`-Sitzung. Sie hat außerdem:
- BUG-4 zur Laufzeit geprüft,
- alle Sweeps erneut laufen lassen,
- die beiden neuen Befunde unabhängig nachgerendert,
- den Produktions-Build gemacht,
- die Rotprobe gemacht (Step 6),
- und den Randfall „Trägername nur aus unsichtbaren Zeichen“ geprüft (siehe Hinweise).

**Umfang:** Nachprüfung in der Breite der Diff, `git diff --stat 17fa8a1..HEAD` (`17fa8a1` hat den vorigen Bericht geschrieben):
- **Produktionscode, 3 Dateien:**
  - `src/features/invitations/invitation-mail.rules.ts`: `atSentenceEnd` (`:50`) erkennt jetzt „.“, „!“, „?“ und „…“; `plainName` (`:71`) entfernt `\p{Cf}`.
  - `src/features/invitations/invitations.delivery.ts`: eine feste Konsolenzeile bei fehlendem oder ungültigem Linkziel (`:19`, `:48-50`).
  - `src/features/invitations/invitations.rules.ts`: der Screenreader-Name „Einladung senden an <Adresse>“ (`:162`).
- **Außerdem geändert:** 4 Testdateien, `design.md` (Abweichung 11 und der Hinweis zu WCAG 2.5.3) und `features/INDEX.md` (Status Approved → In Review).
- **Unverändert:** `supabase/`, `vitest.config.mts`, `package.json`, `next.config.ts`, `src/proxy.ts`. Beleg: `git diff --stat 17fa8a1..HEAD -- supabase/ vitest.config.mts package.json next.config.ts src/proxy.ts` ist leer.
- **Testdefinitionen:** Es kam kein Skip und keine Ausnahme dazu.
  - Die einzige geänderte Assertion ist `invitations.delivery.test.ts:165-167`. Sie verlangte vorher „keine Konsolenausgabe“ und verlangt jetzt genau die feste Zeile. Das ist eine Verschärfung für das neue Verhalten, keine Abschwächung.
  - Die beiden Tests zum Screenreader-Namen sind auf den neuen Text umgestellt und um die Prüfung „enthält den sichtbaren Text“ ergänzt.
- **Ein Prüfer statt drei:** Geändert sind 3 Produktionsdateien, alle in `src/features/invitations/`. Darunter ist kein Daten-, Rechte-, Auth- oder Shell-Code und keine Migration. Kein Feature ist deployt.

> Legende:
> - `[x]` in diesem Lauf geprüft (mit Beleg)
> - `[ ] BUG` als fehlerhaft geprüft
> - `[!] NOT VERIFIED` in diesem Lauf nicht prüfbar (mit Grund)
> - `[=]` übernommen aus einem früheren Lauf vom 2026-11-01 (Commits `024a0a2` und `17fa8a1`). In diesem Lauf nicht erneut geprüft, weil die Diff den Code dafür nicht berührt.

**So wurde geprüft:**
- **Server Actions** per HTTP direkt aufgerufen, am Formular vorbei: `POST` mit dem Kopf `Next-Action`.
- **Mailtexte vorher und nachher:** `buildInvitationMail` per `node --experimental-strip-types` gerendert, aus Kopien von `git show 17fa8a1:…/invitation-mail.rules.ts` und von HEAD im Scratchpad. Der Prüfer hat 25 Namen gerendert, die `/qa`-Sitzung hat die Befunde unabhängig nachgerendert.
- **Namensregel von PROJ-1:** `registerSchema` aus `src/features/account/account.schema.ts` direkt ausgeführt (`npx jiti`, Skript im Scratchpad).
- **Datenbank** direkt per `env -u SUPABASE_ACCESS_TOKEN supabase db query --linked`.
- **Testkonten:** `qa7-rev@example.com` (Prüfer) und `qa7-bug4@example.com` (`/qa`-Sitzung), angelegt über die Action `register`. Teilnehmer-Adressen nur aus `example.com`.
- **Keine echte Mail in diesem Lauf.** Die Zustellung samt Abnahme durch den Nutzer stammt aus dem ersten Lauf (Gmail, 2026-11-01). `mailjet.integration.ts` ist seitdem unverändert.
- **Aufräumen:** Ausgangsstand vor dem Lauf und Endstand danach sind per SQL gleich:
  - 4 Konten, 4 Träger, 4 Mitgliedschaften
  - 0 Lizenzen, 0 Versandstände, 0 Versendungen
  - 0 Konten `qa7-%`, 0 Träger `QA7%`
  - Registrierungsversuche 85 → 87, je einer vom Prüfer und von der `/qa`-Sitzung (der 24-Stunden-Job löscht sie). Login-Versuche (324) und Sperren (28) sind unverändert.
  - `git status` sauber, alle Server beendet, Cookie- und Antwortdateien im Scratchpad gelöscht.

**Suite-Lauf** (einmal vor dem Prüfer, `npm test`): 37 Dateien, 875 Tests bestanden, 0 fehlgeschlagen, exit 0. Keine Skip- oder Todo-Zeilen (`grep -ciE "skip|todo"` auf das Log → 0). Der Prüfer hat diesen Lauf zitiert und die Suite nicht erneut gestartet.
- Die Zahl ist erklärt: 864 im vorigen Lauf + 8 neue Fälle zu BUG-1 + 3 neue Fälle zu BUG-5 = 875. Die Tests zu BUG-3 und BUG-4 ändern bestehende Fälle.

**Weitere Läufe:**
- **Produktions-Build:** `npm run build` → exit 0, Build `yAq1dL60no2T7qgYEGRAH`. Er lief, weil die Diff App-Code berührt.
- **Migrationen:** übersprungen, unverändert seit 2026-11-01 (`git diff --stat 17fa8a1..HEAD -- supabase/` ist leer).
- **Einzeldateien:** die 4 geänderten Testdateien → 4 Dateien, 136 bestanden (Prüfer und `/qa`-Sitzung unabhängig).

## Akzeptanzkriterien

#### AC-1: Zuweisen löst genau eine Einladung aus, Toast mit Zusatz, „Versendet am“
- [=] Echte Zuweisung mit angenommener Mail, „Versendet am“ in Tabelle und Karte, Zeitzone, Toast-Zuordnung, genau ein Versuch. Unverändert seit 2026-11-01 (`licenses.actions.ts`, `mailjet.integration.ts` und die Komponenten sind nicht in der Diff). In `invitations.delivery.ts` hat sich nur der Zweig für ein fehlendes oder ungültiges Linkziel geändert.
- [!] NOT VERIFIED: der sichtbare Toast. Dafür braucht es einen Browser.

#### AC-2: Absender, Betreff, Inhalt der Einladung
- [x] **Sonst unverändert:** Der Betreff ist bei allen 25 gerenderten Namen gleich `INVITATION_SUBJECT`, ohne Trägernamen. Text und HTML haben weiter 7 bzw. 8 Absätze.
  - Für Namen ohne Formatzeichen und ohne „!“, „?“ oder „…“ am Ende sind Text und HTML bei HEAD und bei `17fa8a1` gleich. Beispiele: „Institut Nord“, „QA7 Bildungswerk e.V.“, „Bildungswerk e.V. Nord“, HTML mit Link, CRLF mit `Bcc:`, 100 Zeichen, „Müller & Söhne“, `Werk "e.V."`. Das hat der Prüfer per Vergleichsskript belegt.
- [x] **Satzende:** „Bei Fragen wenden Sie sich an <Name>.“ hat genau einen Schlusspunkt. Für „Lern!“, „Wer lernt?“ und „Akademie…“ folgt kein Punkt mehr (Render, Text und HTML, `invitation-mail.rules.ts:50,53`).
- [x] **Zur Laufzeit:** Mit dem Träger des Prüfers endet `assignLicense` mit `{"status":"assigned","invitation":{"status":"failed"}}`. Im Log steht nur „Mailjet: Einladung nicht versendet (nicht eingestellt)“, kein „unerwarteter Fehler“. `buildInvitationMail` lief also fehlerfrei bis zum Mailjet-Schritt.
- [=] Absender „Lizenzzentrale“, kein `Reply-To`, Trägername als reiner Text, Knopf „Zur Lernplattform“ mit dem Hinweis zur Adresse, alles in der echten Mail vom Nutzer bestätigt. Unverändert seit 2026-11-01 (`mailjet.integration.ts` nicht in der Diff).
- [x] BUG-5 ist behoben, siehe Bugs.

#### AC-3: Versand scheitert → Lizenz bleibt, Warn-Toast, „Fehlgeschlagen“
- [x] **Leerer Schlüssel** (Prüfer): Zuweisen → `assigned` mit `invitation.status = failed`, in der DB `license_invitations.status = failed` und 0 Versendungen.
- [x] **Ungültiges Linkziel** (`/qa`-Sitzung, Neustart mit `LEARNING_PLATFORM_URL='javascript:alert(1)'`): Zuweisen → `{"status":"assigned","invitation":{"status":"failed"}}`, in der DB `failed` mit `last_attempt_at` und 0 Versendungen.
- [=] Ungültiger Schlüssel (HTTP 401), Wortlaut des Warn-Toasts, Zeitgrenze 10 s ohne Neuversuch. Unverändert seit 2026-11-01.
- [!] NOT VERIFIED: der sichtbare Toast (kein Browser) und eine echte Zeitüberschreitung bei Mailjet (nicht auslösbar).

#### AC-4: Genau ein Zustand pro Lizenz, als Text, mit passender Aktion
- [x] **Screenreader-Namen im HTML von `/licenses`** (`curl` mit Sitzung):
  - Zustand „Noch nicht eingeladen“: `aria-label="Einladung senden an <Adresse>"`, sichtbar „Einladung senden“, `type="button"` (Prüfer).
  - Zustand „Fehlgeschlagen“: `aria-label="Einladung an <Adresse> erneut senden"`, sichtbar „Erneut senden“, je einmal in Tabelle und Karte (Prüfer und `/qa`-Sitzung).
- [x] BUG-3 ist behoben, siehe Bugs.
- [=] Alle vier Zustände im HTML, Badge mit Text. Unverändert seit 2026-11-01 (`invitation-status.tsx`, `license-list.tsx` nicht in der Diff).
- [!] NOT VERIFIED: „ohne seitliches Scrollen“ auf dem Smartphone und Tippflächen von 44 px. Dafür braucht es einen Viewport.

#### AC-5: „Erneut senden“ schickt dieselbe Einladung, Rückmeldung, Liste ohne Neuladen
- [x] **Fehlerpfad:** `sendInvitation` → `{"status":"failed"}` mit `x-action-revalidated: 2` (Prüfer, leerer Schlüssel) und `{"status":"failed"}` bei leerem Linkziel (`/qa`-Sitzung).
- [=] Erfolgspfad mit echter zweiter Mail, Neurendern ohne Neuladen, Toast-Texte. Unverändert seit 2026-11-01.
- [!] NOT VERIFIED: dass der Browser den Baum einspielt und den Toast zeigt (kein Browser).

#### AC-6: Altbestand → „Noch nicht eingeladen“, nichts automatisch, Klick versendet
- [x] **Nachgestellt** (Prüfer): Den Versandstand der eigenen Testlizenz per SQL gelöscht. Danach zeigt `/licenses` „Noch nicht eingeladen“ mit „Einladung senden“ und dem neuen Screenreader-Namen. Es ging nichts automatisch hinaus.
  - Ein Klick (`sendInvitation`) → `{"status":"failed"}`, in der DB eine neue Zeile mit `status = failed` und neuem `last_attempt_at`.

#### AC-7: Grenze 3 pro Lizenz in 24 Stunden, auch an der Oberfläche vorbei
- [=] Unverändert seit 2026-11-01 (Migration und Datenzugriff nicht in der Diff).

#### AC-8: Grenze 30 pro Träger in 24 Stunden, entzogene zählen mit, auch beim Zuweisen
- [=] Unverändert seit 2026-11-01 (Migration und Datenzugriff nicht in der Diff).

#### AC-9: Datentrennung beim Lesen und Auslösen, Schreibschutz, Adresse nur aus der Lizenz
- [=] PostgREST mit Token und öffentlichem Schlüssel, SQL-Rollenprobe, Katalog, fremde Lizenz über die App. Unverändert seit 2026-11-01 (RLS, Funktionen, `invitations.data.ts`, `invitations.schema.ts` nicht in der Diff).
- [x] **Adresse nur aus der Lizenz, nebenbei erneut belegt:** `sendInvitation` mit mitgeschicktem `"email":"evil@example.com"` → `failed`, 0-mal `evil` in der Antwort. `invitations.delivery.ts:54` übergibt `to: begun.email`, also die Adresse aus der Datenbankfunktion.

#### AC-10: Datenschutzhinweis am Ende der Einladung
- [x] **Wortlaut** laut Spec, mit dem Trägernamen an allen drei Stellen, als letzter Absatz (Render HEAD, Text-Absatz 7, HTML-`<p>` 8).
- [x] **Satzende** korrekt in Text und HTML für Namen auf „.“, „!“, „?“ und „…“ (Render; Test `invitation-mail.rules.test.ts` → „Trägername am Satzende (AC-2, AC-10)“).
- [=] Hinweis am Ende der echten Mail (Nutzer). Unverändert seit 2026-11-01.

#### AC-11: Keine Werbung, kein Zählpixel, keine umgeleiteten Links
- [x] **Render HEAD:** kein `<img`, kein `<link`, kein `@import`, kein `url(`. Genau 2 `href`, beide direkt auf das Linkziel.
- [=] `TrackOpens`/`TrackClicks: 'disabled'` und die vom Nutzer geprüfte echte Mail. Unverändert seit 2026-11-01 (`mailjet.integration.ts` nicht in der Diff).

#### AC-12: Löschen mit Lizenz und Träger, Versandstand ohne Adresse, Zähler nach 24 h weg
- [=] Spalten, Kaskaden, Aufräumjob. Unverändert seit 2026-11-01 (`supabase/` nicht in der Diff).
- [x] **Nebenbei belegt:** Das Entziehen der Testlizenz des Prüfers hat Lizenz und Versandstand gelöscht (0/0). Das Löschen beider Testkonten hat Träger, Lizenzen und Versandstände mitgenommen (Endstand 0/0/0, siehe Aufräumen).
- [!] NOT VERIFIED — go-live: die Aufbewahrung bei Mailjet (Kontakte, Versandverlauf, T21).

## Edge Cases

#### EC-1 bis EC-4: laufender Versand, Gleichzeitigkeit an der Grenze, hängender Versand, Zeitüberschreitung
- [=] Unverändert seit 2026-11-01. Die Garantien liegen in der Migration und in `invitations.data.ts`, beide nicht in der Diff.
- [x] **Der geänderte Zweig hält die Garantie von EC-3:** Auch bei fehlendem oder ungültigem Linkziel wird der reservierte Versand genau einmal abgeschlossen, und zwar als „nicht angenommen“ (`invitations.delivery.ts:44-50,61-66`; Test `invitations.delivery.test.ts:152-168` → `finishInvitation.mock.calls` = `[[SEND_ID, false]]`). Zur Laufzeit stand danach `failed` in der DB, nicht `sending`.

#### EC-5: Entziehen während des Versands
- [x] **Nebenbei** (Prüfer): Nach `revokeLicense` → `{"status":"revoked"}` gibt `sendInvitation` → `{"status":"already_revoked"}`. Lizenz und Versandstand sind in der DB weg.
- [=] Der Fall mit laufendem Versand: unverändert seit 2026-11-01.

#### EC-6: Neuzuweisung derselben Adresse
- [=] Unverändert seit 2026-11-01.

#### EC-7: Trägername mit Sonderzeichen, HTML, Link, sehr lang → reiner Text
- [x] **Format- und Bidi-Zeichen entfernt:** U+202E/U+202C, U+2066–U+2069, U+200E/U+200F, U+200B, U+00AD und U+FEFF kommen in keiner Fassung mehr vor, außer den U+200B, die das Modul selbst hinter „.“, „@“, „:“ und „/“ setzt (Render des Prüfers; Test `invitation-mail.rules.test.ts`, 8 Fälle).
- [x] **Maskierung und Entschärfung unverändert:** `&lt;b&gt;x&lt;/·b&gt; www.·a.·de &amp; &quot;Co&quot;.`, CRLF wird zum Leerzeichen (Render). Das Entfernen läuft vor dem Entschärfen der Links (`:71` vor `:73`). Die eigenen U+200B des Moduls bleiben also stehen, und ein Link, den erst das Entfernen zusammenfügt, wird danach entschärft: „www“+U+200B+„.evil“+U+200B+„.com https“+U+2060+„://x“+U+00AD+„.de“ → „www.·evil.·com https:·/·/·x.·de“, kein `www.evil.com` und kein `https://x` ohne Trenner in Text oder HTML (Render der `/qa`-Sitzung).
- [x] **Kein ReDoS:** `/[.!?…]​?$/` (`:50`) und `/\p{Cf}/gu` (`:71`) sind linear, der Name hat höchstens 100 Zeichen.
- [x] BUG-1 ist behoben, siehe Bugs.
- [ ] BUG-6 (Low, Deferred, neu): Ein Steuerzeichen am Ende des Namens wird zum Leerzeichen, und am Satzende steht „e.V. .“ (siehe Bugs).
- [ ] BUG-7 (Low, Deferred, neu, durch den Fix von BUG-1): Auch ZWJ und ZWNJ werden entfernt, die Bedeutung tragen (siehe Bugs).

#### EC-8: Adresse mit `+`, Bindestrich, Subdomain → geht an genau diese Adresse
- [x] **Gespeichert und übergeben** (Prüfer): „Teilnehmer.Eins+kurs@Sub.Example.com“ steht als `teilnehmer.eins+kurs@sub.example.com` in der Lizenz. `invitations.delivery.ts:54` übergibt genau die Adresse der Datenbankfunktion.
- [!] NOT VERIFIED: die tatsächliche Zustellung. Die Mailjet-Schlüssel waren leer.

#### EC-9: Zugang oder Linkziel nicht eingestellt oder ungültig → App läuft, Versand „Fehlgeschlagen“
- [x] **Schlüssel leer** (Prüfer): Die App startet, Zuweisen funktioniert, der Versand endet `failed`. Der Client bekommt nur `{"status":"failed"}`.
- [x] **Linkziel `javascript:alert(1)`** (`/qa`-Sitzung): Zuweisen → `assigned`, Einladung `failed`. Im Log steht genau 1 Zeile „Einladung: Linkziel nicht eingestellt oder ungültig (LEARNING_PLATFORM_URL)“, 0 Mailjet-Zeilen, 0-mal `javascript`, `alert`, eine Adresse oder der Name.
- [x] **Linkziel leer** (`/qa`-Sitzung): „Erneut senden“ → `{"status":"failed"}`, im Log wieder genau diese eine Zeile, ohne Wert, Adresse oder Name.
- [x] **`platformUrlFrom`** ist nicht geändert (die Diff berührt `:17-33` nicht).
- [x] BUG-4 ist behoben, siehe Bugs.

#### EC-10 bis EC-12
- [=] Verbindungsabbruch, abgemeldet oder ohne Träger, Kontingent ausgeschöpft. Unverändert seit 2026-11-01.
- [!] NOT VERIFIED: ein echter Verbindungsabbruch (EC-10). Dafür braucht es einen Browser.

### Weitere Edge Cases (nicht in der Spec)
- [=] Ungültige Eingaben an `sendInvitation`, UUID in Großbuchstaben, „Versendet am“ an Tagesgrenze und Sommerzeit, die Satzende-Fälle aus dem vorigen Lauf („Akademie...“, „A.“, „info@werk.de.“, Klammern und Anführungszeichen). Unverändert bzw. vom Prüfer im Render bestätigt.
- [x] **`sendInvitation` mit `licenseId: "x<script>"`** → `{"status":"error"}` (Prüfer).
- [x] **Trägername nur aus unsichtbaren Zeichen:** ergibt seit dem Fix einen leeren Namen in der Mail. Das ist kein Bug von PROJ-3, siehe Hinweise.
- [x] **Seltene Satzschlusszeichen** „‼“, „⁇“, „⁈“, „⁉“, „‽“ bekommen weiter einen Punkt („Lern‼.“). Siehe Beobachtung O-11.
- [=] Name endet auf „.“ plus NBSP, Tabulator oder Zeilenumbruch → „e.V. .“. Über das Formular nicht erreichbar, weil JS `trim()` diese Zeichen entfernt (O-8). Die erreichbare Variante mit Steuerzeichen ist jetzt BUG-6.

## Security-Audit

Beschränkt auf die Diff und den Weg vom Trägernamen in die Mail. Die übrigen Punkte sind aus den früheren Läufen übernommen.

- [x] **Authentication:** `sendInvitation` ohne Cookie → `x-action-redirect: /login?reason=session` (Prüfer).
- [=] **Authorization über die App und an der Datenbank:** unverändert seit 2026-11-01 (kein Daten- oder Rechtecode in der Diff; in der DB gab es in diesem Lauf keine fremde Lizenz für eine neue Probe).
- [x] **Input validation von `sendInvitation`:** `licenseId: "x<script>"` → `error`; eine mitgeschickte Adresse wird ignoriert (siehe AC-9).
- [x] **Mail-Injection über den Trägernamen:** HTML maskiert, auch am Satzende; Links mit U+200B entschärft; CR/LF werden zum Leerzeichen; Format- und Bidi-Zeichen werden jetzt entfernt (siehe EC-7). BUG-7 betrifft nur die Darstellung, nicht die Sicherheit: ZWJ und ZWNJ ändern keine Schreibrichtung.
- [!] **Rate limiting auf `sendInvitation`:** NOT VERIFIED — nicht implementiert (optional für das MVP). 8 Aufrufe in Folge → 8 × `failed`, ungebremst (Prüfer). Fehlversuche zählen laut Spec nicht zur Versandgrenze, die Grenzen 3/30 sind vorhanden (AC-7, AC-8). Siehe O-1.
- [!] **Brute force:** NOT VERIFIED — nicht anwendbar. PROJ-3 hat keinen Credential-Pfad, und die Diff berührt keinen.
- [=] **Keine Account-Enumeration** (PROJ-1): unverändert seit 2026-11-01.
- [x] **Keine Zugangsdaten und Adressen in URLs:** Der Sendeknopf hat `type="button"` und kein Formular. Im Server-Log stehen die Actions nur als `POST /licenses` bzw. `POST /register` ohne Query.
- [x] **Keine Geheimnisse im Client-Bundle:** Produktions-Build `yAq1dL60no2T7qgYEGRAH`, `.next/static`: 0 Dateien mit `MAILJET`, `api.mailjet.com`, `INVITATION_SENDER`, `LEARNING_PLATFORM`, `SERVICE_ROLE`, `service_role`, `sb_secret_`, `TURNSTILE_SECRET`, `eyJhbGciOi`, `createAdminClient`, `deliverInvitation`, `buildInvitationMail`, `plainName`, `atSentenceEnd`, „Linkziel nicht eingestellt“, „unerwarteter Fehler beim Versand“, „Bei Fragen wenden Sie sich“, „Fragen dazu richten Sie“.
  - Positivkontrolle: „Einladung senden an“ steht in 1 Client-Datei, wie erwartet, denn der Knopf braucht den Text. Die Suche greift also.
  - Der Prüfer hat zusätzlich 27 Chunks des Dev-Servers durchsucht, mit demselben Ergebnis.
- [x] **Keine Geheimnisse in der Git-Historie:** Fix-Commit `git show da63ae4 | grep -cE "MAILJET_[A-Z_]*KEY=.+|sb_secret_|eyJhbGciOi|SERVICE_ROLE_KEY=.+"` → 0.
  - [=] Die Historie davor: unverändert seit 2026-11-01 (0 Treffer).
- [x] **Keine sensiblen Daten in Antworten:** `assignLicense` → `{"status":"assigned","invitation":{"status":"failed"}}`, `sendInvitation` → `{"status":"failed"}`, 0-mal `ErrorMessage`, `MAILJET`, `service_role`, `sb_secret`.
- [x] **Keine Personendaten und keine Werte im App-Protokoll:**
  - Prüfer, gültiges Linkziel: `grep -cE "example\.com|QA7|e\.V\.|@|teilnehmer|Linkziel|unerwarteter" dev-server.log` → 0. Einzige Versandzeilen: 4 × „Mailjet: Einladung nicht versendet (nicht eingestellt)“.
  - `/qa`-Sitzung, beide Neustarts: `grep -cE "javascript|alert|example\.com|QA7|e\.V\.|@"` → 0. Die neue Zeile ist eine Konstante ohne Wert (`invitations.delivery.ts:19,50`).
- [=] **CSRF auf Server Actions:** unverändert seit 2026-11-01.
- [x] **Sicherheitsheader lokal** (Antwort der Registrierung, Prüfer): `x-frame-options: DENY`, `x-content-type-options: nosniff`, `referrer-policy: origin-when-cross-origin`, HSTS mit `includeSubDomains`.
- [!] **Postgres- und PostgREST-Protokoll von Supabase:** NOT VERIFIED, von hier nicht einsehbar.
- [!] **Sicherheitsheader gegen eine Live-URL:** NOT VERIFIED, es gibt kein Deployment.

## Regression

- [x] **Suite-Lauf:** 37 Dateien, 875 Tests bestanden, 0 fehlgeschlagen, keine Skip- oder Todo-Zeilen. Eine E2E-Suite gibt es nicht (`tests/` fehlt), also übersprungen; kein Browser-Runner installiert.
- [x] **Versandweg zur Laufzeit** (Prüfer): Registrieren → `/licenses` 200 mit dem Trägernamen → `assignLicense` (`assigned`, Einladung `failed`) → `sendInvitation` (`failed`) → Altbestand nachgestellt → `sendInvitation` (`failed`, neue Zeile) → `revokeLicense` (`revoked`, Kontingent „1 von 5“ → „0 von 5 … 5 frei“) → `sendInvitation` (`already_revoked`).
- [x] **Versandweg mit ungültigem und leerem Linkziel** (`/qa`-Sitzung): siehe EC-9.
- [x] **Kein Feature ist „Deployed“** (`features/INDEX.md`). Es gibt also keine deployten Nachbarn, die die Diff treffen könnte.
- [x] **PROJ-2** teilt `invitations.rules.ts` über die Liste. Seine Kernabläufe Zuweisen, Liste, Entziehen und Kontingent liefen im Lauf des Prüfers fehlerfrei. Die übrigen Teile von PROJ-1 und PROJ-2 berührt die Diff nicht, sie sind durch den Suite-Lauf abgedeckt.

## Unit-Tests (`/qa`, Step 6)

- **Bewertet:** Der Fix bringt für jede Klasse Tests mit:
  - BUG-1: 8 Fälle in `invitation-mail.rules.test.ts`
  - BUG-5: 3 Fälle in `invitation-mail.rules.test.ts`
  - BUG-4: 4 Fälle in `invitations.delivery.test.ts`, verschärft auf die feste Zeile
  - BUG-3: `invitations.rules.test.ts` und `send-invitation-button.test.tsx`
  - `/qa` hat deshalb keinen Test ergänzt. Für BUG-6 und BUG-7 kommen die Tests mit dem Fix in `/build`; heute wären sie rot. Der Randfall mit unsichtbaren Zeichen gehört zu PROJ-1.
- **Rotprobe auf die Tests aus dem Fix:** Die neuen Testdateien liefen gegen den Code vor dem Fix (`17fa8a1`), in einer getrennten Arbeitskopie im Scratchpad, damit der Arbeitsbaum unverändert bleibt.
  - `invitation-mail.rules.test.ts` → 11 fehlgeschlagen: die 8 Fälle zu BUG-1 und die 3 zu BUG-5.
  - `invitations.delivery.test.ts` → 4 fehlgeschlagen: alle 4 Linkziel-Fälle.
  - `invitations.rules.test.ts` → 1 fehlgeschlagen: der Test zum Screenreader-Namen.
  - `send-invitation-button.test.tsx` → 1 fehlgeschlagen: der Test zum Screenreader-Namen.
  - Zusammen 17 rot, jeder in seiner Klasse. Auf HEAD im Arbeitsbaum: 4 Dateien, 136 bestanden. Die Arbeitskopie ist entfernt (`git worktree list` zeigt nur den Arbeitsbaum), `git status` ist sauber.
- [=] Die 7 Fälle von `/qa` aus dem ersten Lauf (Steuer- und Trennzeichen im Namen) sind grün im Suite-Lauf.

## E2E-Tests
_Optionale Ebene, geschrieben von `/e2e-tests`, nur für kritische Kernabläufe._

- Status: **nicht gelaufen** (`/e2e-tests` für kritische Abläufe ausführen)

## `[user]`-Aufgaben

- [=] **T1–T4, T6** (Mailjet-Konto, bestätigter Absender, Tracking aus, Schlüssel, echte Werte): im ersten Lauf mit der echten Mail belegt, unverändert seit 2026-11-01.
- [!] **T5** (Platzhalter in `.env.local.example`): NOT VERIFIED. Die Datei ist für den Agenten gesperrt; der Nutzer hat die Aufgabe abgehakt.
- [!] **T21–T24** (Löschregel und Auftragsverarbeitungsvertrag bei Mailjet, eigene Absender-Domain, Linkziel der Plattform): NOT VERIFIED — go-live, wird in `/deploy` gemacht und geprüft. Keine davon liegt auf einem Credential-Pfad.

## Nicht geprüft in diesem Lauf

- [!] **Inhalt einer tatsächlich zugestellten Mail mit dem Fix** (AC-1, AC-2, AC-10, AC-11, Erfolgspfad von AC-5, EC-8). Grund: Mailjet-Schlüssel absichtlich leer. Belegt durch Render vorher/nachher und den fehlerfreien Lauf bis zum Mailjet-Schritt; die echte Zustellung stammt aus dem ersten Lauf.
- [!] **Darstellung in Mailprogrammen** (entfernte Formatzeichen, U+200B). Grund: kein Mailprogramm und kein Browser.
- [!] **Sprachsteuerung und Screenreader am echten Knopf** (WCAG 2.5.3, BUG-3). Grund: kein Browser und keine Hilfstechnik. Belegt sind `aria-label` im HTML und die Tests.
- [!] **Browser-Verhalten:** sichtbare Toasts, Sperre am Knopf, Einspielen des neu gerenderten Baums (AC-1, AC-3, AC-5, EC-1). Grund: kein Browser.
- [!] **Responsive Darstellung bei 375/768/1440 px**, Tippflächen von 44 px (AC-4). Grund: kein Viewport.
- [!] **Cross-Browser** (Chrome, Firefox, Safari, Edge). Grund: keine Browser-Engine.
- [!] **Echter Verbindungsabbruch** (EC-10), **Zeitüberschreitung bei Mailjet und doppelte Zustellung** (AC-3, EC-4). Grund: nicht auslösbar.
- [!] **Postgres- und PostgREST-Protokoll von Supabase** auf Teilnehmer-Adressen. Grund: von hier nicht einsehbar.
- [!] **Rate limiting auf `sendInvitation`.** Grund: nicht implementiert (optional für das MVP).
- [!] **Brute force.** Grund: PROJ-3 hat keinen Credential-Pfad.
- [!] **Sicherheitsheader gegen eine Live-URL.** Grund: Es gibt kein Deployment.
- [!] **T5** (Datei für den Agenten gesperrt) und **T21–T24** (go-live, `/deploy`).
- Die mit `[=]` markierten Punkte sind in diesem Lauf nicht erneut geprüft. Sie bestanden am 2026-11-01, und ihr Code ist seitdem unverändert.

## Bugs

#### BUG-1: Bidi- und Formatzeichen im Trägernamen gelangen unverändert in die Einladung
- **Severity:** Low
- **Status:** Fixed (2026-11-01, re-verified). Behoben in `da63ae4`: `plainName` entfernt `\p{Cf}` (`invitation-mail.rules.ts:71`), bevor Steuerzeichen ersetzt und Links entschärft werden.
- **Class:** Unicode-Format- und Bidi-Steuerzeichen (`\p{Cf}`, z. B. U+202E, U+2066–U+2069, U+200B) in Nutzertext werden vor der Ausgabe in ausgehende Inhalte nicht neutralisiert.
- **Sweep:**
  - Der alte Sweep `grep -rnE 'p\{Cf\}|u202[A-Ea-e]|u206[6-9]' src --include='*.ts' --include='*.tsx' | grep -v '\.test\.'` → 1 Treffer, `invitation-mail.rules.ts:71`: der Fix selbst. Der alte Sweep sucht nach der Neutralisierung und trifft die Klasse deshalb nicht mehr.
  - Neuer Sweep auf die Stellen, an denen Nutzertext in ausgehende Inhalte gelangt: `grep -rnE 'buildInvitationMail\(|sendMail\(' src --include='*.ts' --include='*.tsx' | grep -v '\.test\.'` → 4 Treffer. 2 sind Definitionen. `invitations.delivery.ts:52` führt den Namen über `plainName`, also neutralisiert. `:54` gibt die Adresse aus der DB weiter, kein freier Text. Keine Stelle ist offen.
- **Nachprüfung:** Render: „Bank“+U+202E+„moc.live“+U+202C → vorher mit U+202E, jetzt „Bankmoc.·live“. „Werk e.V.“+U+200B und „Werk e.V.“+U+202C → vorher „e.V..“, jetzt ohne zweiten Punkt. Tests und Rotprobe: siehe Unit-Tests.
- **Steps to Reproduce (ursprünglich):**
  1. Einen Träger registrieren, dessen Name U+202E enthält, z. B. „Bank“ + U+202E + „moc.live“ + U+202C.
  2. Eine Lizenz zuweisen.
  3. Vorher: U+202E stand unverändert in Text- und HTML-Fassung, Mailprogramme zeigten den Rest des Namens gespiegelt.

#### BUG-2: Trägername mit Schlusspunkt ergibt zwei Punkte am Satzende
- **Severity:** Low
- **Status:** Fixed (2026-11-01, re-verified im Lauf `17fa8a1`). Behoben in `e8ac80a` durch den Helfer `atSentenceEnd`.
- **Class:** Platzhalter am Satzende ohne Behandlung eines Schlusspunkts, den der eingesetzte Wert schon mitbringt.
- **Sweep:** `grep -rnE '\$\{[^}]+\}\.([^a-zA-Z0-9_$]|$)' src --include='*.ts' --include='*.tsx' | grep -v '\.test\.'` → in diesem Lauf erneut 1 Treffer, `invitation-mail.rules.ts:50`: der Rückfallzweig von `atSentenceEnd`, die erlaubte Ausnahme.
- **Steps to Reproduce (ursprünglich):** Träger „QA5-OWN Bildungswerk e.V.“, eine Lizenz zuweisen. Vorher: „… an QA5-OWN Bildungswerk e.V..“, ebenso am Ende des Datenschutzhinweises.

#### BUG-3: Zugänglicher Name „Einladung an <Adresse> senden“ enthält den sichtbaren Text nicht
- **Severity:** Low
- **Status:** Fixed (2026-11-01, re-verified). Behoben in `da63ae4`: „Einladung senden an <Adresse>“ (`invitations.rules.ts:162`, `design.md` → Abweichung 11).
- **Class:** Ein zugänglicher Name, der den sichtbaren Text nicht zusammenhängend enthält (WCAG 2.5.3 „Label in Name“).
- **Sweep:** `grep -rn 'aria-label={' src/features src/components | grep -v '\.test\.' | grep -v components/ui` → 3 Treffer, 0 betroffen:
  - `send-invitation-button.tsx:66` → `sendButtonAccessibleLabel`: „Einladung senden an <Adresse>“ bzw. „Einladung an <Adresse> erneut senden“. Beide enthalten den sichtbaren Text zusammenhängend, „Erneut senden“ bis auf die Großschreibung.
  - erlaubt: `revoke-license-dialog.tsx:82` („Lizenz von … entziehen“ enthält „entziehen“) und `quota-summary.tsx:32` (Fortschrittsbalken ohne sichtbaren Knopftext).
  - Zusatz: statische `aria-label="` in `src/features src/app src/components` ohne `components/ui` → 0.
- **Nachprüfung:** Das HTML von `/licenses` zeigt `aria-label="Einladung senden an …">Einladung senden</button>` (siehe AC-4).
- **Steps to Reproduce (ursprünglich):** Eine Lizenz ohne Versandstand, `/licenses` öffnen. Vorher: sichtbar „Einladung senden“, `aria-label="Einladung an <Adresse> senden"`.

#### BUG-4: Ungültiges oder fehlendes Linkziel scheitert ohne Hinweis auf der Server-Konsole
- **Severity:** Low
- **Status:** Fixed (2026-11-01, re-verified). Behoben in `da63ae4`: `deliverInvitation` schreibt bei fehlendem oder ungültigem Linkziel genau die feste Zeile „Einladung: Linkziel nicht eingestellt oder ungültig (LEARNING_PLATFORM_URL)“, ohne den Wert (`invitations.delivery.ts:19,48-50`).
- **Class:** Eine Fehlkonfiguration endet als „Fehlgeschlagen“ ohne Diagnosezeile.
- **Sweep:**
  - Der alte Sweep `grep -n "platformUrl !== null\|console\." src/features/invitations/invitations.delivery.ts` → 2 Treffer: `:50` (die neue Zeile) und `:74` (unerwarteter Fehler). Es gibt keine Prüfung ohne Diagnosezweig mehr.
  - Neuer Sweep auf alle Einstellungen des Versands: `grep -rn "process\.env\." src/features/invitations --include='*.ts' | grep -v '\.test\.'` → 4 Treffer, alle mit Diagnosezeile. `mailjet.integration.ts:23-25` führen zu `failed('nicht eingestellt')` (`:26`), `invitations.delivery.ts:47` zu `:50`.
- **Nachprüfung zur Laufzeit:** siehe EC-9. Mit `javascript:alert(1)` und mit leerem Wert steht je genau diese eine Zeile im Log, ohne Wert, Adresse oder Name. Mit gültigem Linkziel steht sie nicht da (`grep -c "Linkziel"` im Log des Prüfers → 0).
- **Steps to Reproduce (ursprünglich):** `MAILJET_API_KEY= MAILJET_SECRET_KEY= LEARNING_PLATFORM_URL='javascript:alert(1)' npm run dev`, eine Lizenz zuweisen. Vorher: keine Zeile, nur die Request-Zeilen von Next.js.

#### BUG-5: Trägername mit „!“, „?“ oder „…“ am Ende bekommt am Satzende trotzdem einen Punkt
- **Severity:** Low
- **Status:** Fixed (2026-11-01, re-verified). Behoben in `da63ae4`: `atSentenceEnd` erkennt `[.!?…]`, auch mit U+200B dahinter (`invitation-mail.rules.ts:50`).
- **Class:** Ein Platzhalter am Satzende prüft nur den Abkürzungspunkt „.“, nicht andere Satzschlusszeichen, die der Wert schon mitbringt (`!`, `?`, U+2026 „…“).
- **Sweep:** `grep -rnE '\$\{[^}]+\}\.([^a-zA-Z0-9_$]|$)' src --include='*.ts' --include='*.tsx' | grep -v '\.test\.'` → 1 Treffer, `invitation-mail.rules.ts:50`: der Rückfallzweig des Helfers selbst, die erlaubte Ausnahme. Er wird nur von `:53` und `:56` genutzt.
- **Nachprüfung:** Render, Text und HTML, beide Satzenden: „Lern!“ → „… an Lern!“, „Wer lernt?“ → „… an Wer lernt?“, „Akademie…“ → „… an Akademie…“.
- **Steps to Reproduce (ursprünglich):** Träger „Lern!“, eine Lizenz zuweisen. Vorher: „Bei Fragen wenden Sie sich an Lern!.“ und „… richten Sie bitte an Lern!.“

#### BUG-6: Steuerzeichen am Ende des Trägernamens ergibt „e.V. .“ am Satzende
- **Severity:** Low
- **Status:** Deferred (neuer, nicht blockierender Befund einer Nachprüfung, 2026-11-01; er löst keine weitere Runde aus)
- **Class:** Die Normalisierung des Namens erzeugt Leerraum am Rand, der danach nicht mehr entfernt wird. `plainName` macht ein Steuerzeichen am Ende zu einem Leerzeichen am Ende (`invitation-mail.rules.ts:72`), und `atSentenceEnd` sieht den Schlusspunkt davor nicht mehr.
  - Keine Regression: Die Ausgabe bei `17fa8a1` ist dieselbe (Render der `/qa`-Sitzung).
  - Erreichbar über die App: JS `trim()` entfernt U+0085, U+0001, U+007F und U+009F nicht, und `btrim` in der DB entfernt nur Leerzeichen. Der Prüfer hat einen Träger mit „QA7 Bildungswerk e.V.“ + U+0085 über die Action `register` angelegt; die DB speicherte das Zeichen mit (hex `…2e562ec285`). Das Testkonto ist gelöscht.
  - Die Ursache auf Seite von PROJ-1 (die Namensregel lässt Steuerzeichen zu) ist O-8.
- **Sweep:** `grep -rnE 'p\{Cc\}' src --include='*.ts' --include='*.tsx' | grep -v '\.test\.'` → 1 Treffer, `invitation-mail.rules.ts:72`. Das ist die einzige Normalisierung von Nutzertext in ausgehende Inhalte.
- **Steps to Reproduce:**
  1. Einen Träger mit dem Namen „Werk e.V.“ + U+0085 registrieren (über die Action `register` oder durch Einfügen ins Formular).
  2. Eine Lizenz zuweisen.
  3. Erwartet: „Bei Fragen wenden Sie sich an Werk e.V.“
  4. Tatsächlich, per Render von HEAD in Text- und HTML-Fassung: „Bei Fragen wenden Sie sich an Werk e.V. .“, ebenso am Ende des Datenschutzhinweises. „Lern!“ + U+007F ergibt „Lern! .“.

#### BUG-7: Der Fix von BUG-1 entfernt auch ZWJ und ZWNJ, die Bedeutung tragen
- **Severity:** Low
- **Status:** Deferred (neuer, nicht blockierender Befund einer Nachprüfung, 2026-11-01; er löst keine weitere Runde aus)
- **Class:** Das pauschale Entfernen einer ganzen Unicode-Kategorie trifft auch Zeichen, die Bedeutung tragen statt Formatierung. In `\p{Cf}` liegen auch:
  - U+200D (ZWJ), das Emoji-Folgen verbindet,
  - U+200C (ZWNJ), das in persischer und indischer Schrift zur Rechtschreibung gehört,
  - die Emoji-Tag-Zeichen U+E0020–U+E007F, aus denen Flaggen von Teilgebieten bestehen.
  - Durch den Fix eingeführt: Bei `17fa8a1` blieben diese Zeichen erhalten. EC-7 verlangt den Namen „ohne Formatierung“; diese Zeichen sind keine Formatierung in diesem Sinn.
  - Wirkung nur auf die Darstellung, kein Sicherheitsthema: ZWJ und ZWNJ ändern keine Schreibrichtung.
- **Sweep:** `grep -rnE 'p\{Cf\}' src --include='*.ts' --include='*.tsx' | grep -v '\.test\.'` → 1 Treffer, `invitation-mail.rules.ts:71`. Ausnahmen für ZWJ oder ZWNJ: `grep -rnE 'u200[cdCD]|ZWJ|ZWNJ' src --include='*.ts' --include='*.tsx' | grep -v '\.test\.' | wc -l` → 0.
- **Steps to Reproduce:**
  1. Einen Träger „Familie 👨‍👩‍👧“ (mit ZWJ zwischen den Emoji) registrieren.
  2. Eine Lizenz zuweisen.
  3. Erwartet: der Name wie eingegeben, ein Familien-Emoji.
  4. Tatsächlich, per Render von HEAD: „Familie 👨👩👧“, drei einzelne Emoji (ZWJ in der Fassung: vorher 10, jetzt 0). Ebenso wird „Institut می‌خواهم“ zu „Institut میخواهم“ (Prüfer und `/qa`-Sitzung unabhängig).

## Beobachtungen und Hinweise (kein Bug, zur Kenntnis)

- [=] **O-1 bis O-7** aus dem ersten Lauf gelten unverändert: Fehlversuche ungebremst (O-1), Turnstile mit Testschlüsseln (O-2), Bremszeilen aus dem Suite-Lauf (O-3), Zeitpunkt „ab“ mit laufender Reservierung (O-4), Abschluss scheitert nach Annahme (O-5), Hinweis bei frischem Besuch (O-6), Aufbewahrung bei Mailjet (O-7). Ihr Code ist nicht in der Diff. Den Wortlaut enthält der Bericht in Commit `024a0a2`.
- **O-8, Trägername in App und Datenbank verschieden normalisiert (PROJ-1):** Die App entfernt Leerraum am Rand mit JS `trim()`, die Datenbank mit `btrim` nur Leerzeichen (`20261021120000_proj1_training_providers.sql:21,88`).
  - Ein Name mit NBSP, Tabulator oder Zeilenumbruch am Ende ist über das Formular nicht erreichbar.
  - **Neu in diesem Lauf:** C0- und C1-Steuerzeichen wie U+0085, U+0001 und U+007F entfernt `trim()` nicht, sie kommen also durch. In der Mail führt das zu BUG-6.
  - Ob es Wege am Formular vorbei gibt (direkte Registrierung bei Supabase Auth, die Tabellenansicht des Anbieters), hat niemand geprüft. Das gehört zu PROJ-1.
- **Hinweis: Trägername nur aus unsichtbaren Zeichen (gehört zur Namensregel in PROJ-1, kein Bug von PROJ-3).**
  - Die Namensregel zählt Zeichen nach `trim()` (`account.schema.ts:59-66`) bzw. `btrim` (`20261021120000_proj1_training_providers.sql:21`). `trim()` lässt Format-Zeichen stehen. `registerSchema` direkt ausgeführt: Namen aus 2 × U+200B, aus U+202E + U+202C, aus 3 × U+00AD und aus U+2066 + U+2069 werden angenommen. Nur 2 × U+FEFF lehnt die Regel ab, weil `trim()` U+FEFF entfernt.
  - PROJ-3 entfernt diese Zeichen seit dem Fix von BUG-1. Der Name ist in der Mail dann leer: „ hat Ihnen eine Lizenz für den Kurs …“, „Bei Fragen wenden Sie sich an .“ und „… richten Sie bitte an .“ (Render HEAD, Text und HTML).
  - Vor dem Fix standen die unsichtbaren Zeichen in der Mail, sichtbar war also auch damals kein Name (Render `17fa8a1`). Für den Leser ist das keine Regression.
  - PROJ-3 tut hier, was EC-7 verlangt. Die Lücke ist, dass die Namensregel einen Namen ohne ein einziges sichtbares Zeichen zulässt. Ein Fix gehört deshalb in die Namensregel (`/refine PROJ-1`), nicht in PROJ-3. Der Prüfer hat diesen Randfall unabhängig von der `/qa`-Sitzung ebenfalls gefunden.
- **O-10, `design.md` nur für BUG-3 nachgezogen:** Abweichung 11 beschreibt den neuen Screenreader-Namen.
  - Keine Abweichung beschreibt das Entfernen von `\p{Cf}` (BUG-1; Abweichung 2 nennt nur Steuer- und Trennzeichen) und „!“, „?“, „…“ am Satzende (BUG-5; Abweichung 10 nennt nur den Punkt). Beides steht im Commit `da63ae4`, was die Projektregeln erlauben.
  - Die neue Konsolenzeile von BUG-4 ist keine Abweichung. Sie löst das Versprechen der Technischen Entscheidungen ein („Die Konsole nennt die Ursache ohne Geheimnisse“).
  - `design.md:56` und `:311` nennen weiter den alten Screenreader-Namen, korrigiert nur durch Abweichung 11. Das lässt sich beim Fix von BUG-6/BUG-7 oder mit `/cleanup` angleichen.
- **O-11, seltene Satzschlusszeichen:** „‼“ (U+203C), „⁇“, „⁈“, „⁉“ und „‽“ (U+203D) bekommen am Satzende weiter einen Punkt („Lern‼.“). BUG-5 nennt in seiner Klasse ausdrücklich „!“, „?“ und „…“ und ist damit geschlossen. Diese Zeichen sind in deutschen Trägernamen kaum zu erwarten. Wer BUG-6 behebt, kann sie mitnehmen.

## Zusammenfassung
- **Art des Laufs:** Nachprüfung in der Breite der Diff `17fa8a1..HEAD`, drei Produktionsdateien. Ein unabhängiger Prüfer, die `/qa`-Sitzung hat zusammengeführt und gegengeprüft.
- **Akzeptanzkriterien:** 12 von 12 erfüllt.
  - In diesem Lauf erneut geprüft: AC-2, AC-4, AC-6, AC-10, AC-11, dazu Teile von AC-3, AC-5, AC-9 und AC-12 über den Laufzeitweg.
  - Die übrigen sind `[=]` vom 2026-11-01, ihr Code ist unverändert.
  - Nicht geprüft: die Browser-Teile von AC-1, AC-3, AC-4 und AC-5 und die echte Mail mit dem Fix.
- **Edge Cases:** EC-3 (geänderter Zweig), EC-5, EC-7, EC-8 und EC-9 erneut geprüft, die übrigen `[=]`. An EC-7 hängen die neuen BUG-6 und BUG-7, beide Low und Deferred.
- **Bugs:** 7 insgesamt (0 Critical, 0 High, 0 Medium, 7 Low).
  - Fixed: 5. BUG-1, BUG-3, BUG-4 und BUG-5 in diesem Lauf nachgeprüft und geschlossen, BUG-2 schon im vorigen.
  - Deferred: 2, beide neu: BUG-6 (besteht schon vor dem Fix) und BUG-7 (durch den Fix von BUG-1).
  - Open: 0.
- **Security:** 16 Prüfpunkte. 9 in diesem Lauf geprüft, ohne Befund. 3 übernommen (`[=]`). 4 NOT VERIFIED: Rate limiting (nicht implementiert), Brute Force (nicht anwendbar), Supabase-Protokolle (nicht einsehbar), Header gegen eine Live-URL (kein Deployment).
- **Regression:** Suite 875/875, Produktions-Build grün, Versandweg mit gültigem, ungültigem und leerem Linkziel ohne Fehler, kein deploytes Feature betroffen.
- **Production Ready:** JA. Es gibt keinen Critical- oder High-Bug und keinen offenen Bug. Die Akzeptanzkriterien wurden gegen die laufende App ausgeübt, die Einladung im ersten Lauf auch als echte Mail.
- **Status:** **Approved**.
- **Empfehlung:** BUG-6 und BUG-7 liegen beide in `plainName` und passen in einen Durchgang mit `/build PROJ-3 deferred`. Der Hinweis zu Namen nur aus unsichtbaren Zeichen und O-8 gehören zur Namensregel von PROJ-1 (`/refine PROJ-1`).

> „Production Ready: JA“ heißt *keine Critical/High-Bugs*. Es heißt **nicht**, dass alles geprüft wurde. Die Punkte unter „Nicht geprüft in diesem Lauf“ sind offen und brauchen einen Menschen oder `/e2e-tests`.
