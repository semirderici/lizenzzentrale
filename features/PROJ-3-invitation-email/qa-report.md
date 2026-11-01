# QA-Testergebnisse: PROJ-3 Einladungs-E-Mail

**Getestet:** 2026-11-01, zweiter `/qa`-Lauf: Nachprüfung nach dem Fix von BUG-2. Stand `e8ac80a` auf `feat/PROJ-3-invitation-email`. Der erste Lauf war am selben Tag (Bericht in Commit `024a0a2`).
**App-URL:** http://localhost:3001, einmal von der `/qa`-Sitzung gestartet:
- Befehl: `MAILJET_API_KEY= MAILJET_SECRET_KEY= npx next dev -p 3001`. Die Mailjet-Schlüssel waren also leer, und es ging keine Mail hinaus, auch nicht an `example.com`.
- Port 3000 aus `probe.baseUrl` war von einem anderen Projekt belegt (`lsof -iTCP:3000` → `next-server` aus `…/Developer/speechwerk`). Dieser Server wurde nicht angefasst.

**Tester:** QA Engineer (KI). Ein unabhängiger `qa-engineer`-Prüfer ohne Build-Kontext, mit allen drei Bereichen nacheinander: Abnahme (Step 2) → Security (Step 3) → Regression (Step 4 und 5). Zusammengeführt hat die `/qa`-Sitzung. Sie hat außerdem den Sweep, den neuen Befund BUG-5 und den Endstand der Datenbank gegengeprüft und die Rotprobe gemacht (Step 6).

**Umfang:** Nachprüfung in der Breite der Diff, `git diff --stat 024a0a2..HEAD` (`024a0a2` hat den vorigen Bericht geschrieben):
- **Produktionscode:** nur `src/features/invitations/invitation-mail.rules.ts` (+4/−2: Helfer `atSentenceEnd`, genutzt von `questionsText` und `privacyNote`).
- **Außerdem geändert:** `src/features/invitations/invitation-mail.rules.test.ts` (+27, nur Hinzufügungen) und `design.md` (Abweichung 10).
- **Unverändert ist alles andere.** Beleg: `git diff --stat 024a0a2..HEAD -- . ':(exclude)<die drei Dateien>'` ist leer. Auch `supabase/` ist unverändert.
- **Ein Prüfer statt drei:** Geändert ist eine einzige Produktionsdatei. Sie ist reine Textlogik ohne Daten-, Rechte- oder Auth-Code und gehört nicht zur App-Shell. Kein Feature ist deployt.

> Legende:
> - `[x]` in diesem Lauf geprüft (mit Beleg)
> - `[ ] BUG` als fehlerhaft geprüft
> - `[!] NOT VERIFIED` in diesem Lauf nicht prüfbar (mit Grund)
> - `[=]` übernommen aus dem Lauf vom 2026-11-01 (Commit `024a0a2`). In diesem Lauf nicht erneut geprüft, weil die Diff den Code dafür nicht berührt.

**So wurde geprüft:**
- **Server Actions** per HTTP direkt aufgerufen, am Formular vorbei: `POST /licenses` mit dem Kopf `Next-Action`.
- **Mailtexte vorher und nachher:** `buildInvitationMail` und `platformUrlFrom` per `node --experimental-strip-types` gerendert, aus Kopien von `git show 024a0a2:…/invitation-mail.rules.ts` und von HEAD im Scratchpad.
- **Datenbank** direkt per `env -u SUPABASE_ACCESS_TOKEN supabase db query --linked`.
- **Testkonto:** `qa6-rev@example.com` mit dem Träger „QA6 Bildungswerk e.V.“, angelegt über die Action `register`. Teilnehmer-Adressen nur aus `example.com`.
- **Keine echte Mail in diesem Lauf.** Die Zustellung samt Abnahme durch den Nutzer stammt aus dem ersten Lauf (Gmail, 2026-11-01). Der Versandweg ist seitdem unverändert: `mailjet.integration.ts` und `invitations.delivery.ts` sind nicht in der Diff.
- **Aufräumen**, Endstand per SQL von der `/qa`-Sitzung, gleich dem Ausgangsstand vor dem Lauf:
  - 4 Konten, 4 Träger, 4 Mitgliedschaften
  - 0 Lizenzen, 0 Versandstände, 0 Versendungen
  - 0 Konten `qa6-%`, 0 Träger `QA6%`
  - erzeugt: 1 Registrierungsversuch, 0 Login-Versuche, 0 Sperren (der 24-Stunden-Job löscht sie)
  - `git status` sauber, Cookie- und Antwortdateien im Scratchpad gelöscht, der Server ist beendet.

**Suite-Lauf** (einmal vor dem Prüfer, `npm test`): 37 Dateien, 864 Tests bestanden, 0 fehlgeschlagen, exit 0. Der Prüfer hat diesen Lauf zitiert und die Suite nicht erneut gestartet.
- Die Zahl ist erklärt: 855 im ersten Lauf + 7 Unit-Tests von `/qa` + 2 neue Tests aus dem Fix = 864.

**Weitere Läufe:**
- **Produktions-Build:** `npm run build` → exit 0, Build `V075hyVj-9XjufeMUxdlJ`. Er lief, weil die Diff App-Code berührt.
- **Migrationen:** übersprungen, unverändert seit 2026-11-01 (`git diff --stat 024a0a2..HEAD -- supabase/` ist leer).
- **Einzeldatei:** `npx vitest run src/features/invitations/invitation-mail.rules.test.ts` → 46 bestanden (vorher 44, +2 aus dem Fix).

## Akzeptanzkriterien

#### AC-1: Zuweisen löst genau eine Einladung aus, Toast mit Zusatz, „Versendet am“
- [=] Echte Zuweisung mit angenommener Mail, „Versendet am“ in Tabelle und Karte, Zeitzone, Toast-Zuordnung, genau ein Versuch. Unverändert seit 2026-11-01 (`licenses.actions.ts`, `invitations.delivery.ts`, `mailjet.integration.ts` und die Komponenten sind nicht in der Diff).
- [!] NOT VERIFIED: der sichtbare Toast. Dafür braucht es einen Browser.

#### AC-2: Absender, Betreff, Inhalt der Einladung
- [x] **Satzende ohne doppelten Punkt** (Render HEAD): „Bei Fragen wenden Sie sich an <Name>.“ mit genau einem Schlusspunkt.
  - „Bildungswerk e.V.“ → „… an Bildungswerk e.V.“, „Bildungswerk e.V. Nord“ → „… an Bildungswerk e.V. Nord.“, „Institut Nord“ → „… an Institut Nord.“ (Prüfer und `/qa`-Sitzung unabhängig).
  - Umsetzung: `invitation-mail.rules.ts:47,50`.
- [x] **Sonst unverändert:** Für 6 Namen ohne Schlusspunkt sind Betreff, Text- und HTML-Fassung bei HEAD und bei `024a0a2` gleich (Prüfer, Vergleichsskript 6/6). Der Betreff ist weiter `INVITATION_SUBJECT` ohne Trägernamen.
- [x] **Zur Laufzeit:** Mit dem Träger „QA6 Bildungswerk e.V.“ endet `assignLicense` mit `{"status":"assigned","invitation":{"status":"failed"}}`.
  - Im Server-Log steht nur „Mailjet: Einladung nicht versendet (nicht eingestellt)“, kein „Einladung: unerwarteter Fehler beim Versand“.
  - `buildInvitationMail` lief für diesen Namen also fehlerfrei bis zum Mailjet-Schritt.
- [=] Absender „Lizenzzentrale“, kein `Reply-To`, Trägername als reiner Text, Knopf „Zur Lernplattform“ mit dem Hinweis zur Adresse, in der echten Mail vom Nutzer bestätigt. Unverändert seit 2026-11-01 (`mailjet.integration.ts` nicht in der Diff).
- [x] BUG-2 ist behoben, siehe Bugs.

#### AC-3: Versand scheitert → Lizenz bleibt, Warn-Toast, „Fehlgeschlagen“
- [x] **Mit leerem Schlüssel** (Regression des Laufzeitwegs): Zuweisen → `assigned` mit `invitation.status = failed`, in der DB `license_invitations.status = failed` und 0 Versendungen.
- [=] Ungültiger Schlüssel (HTTP 401), Warn-Toast-Text, Zeitgrenze 10 s ohne Neuversuch. Unverändert seit 2026-11-01.
- [!] NOT VERIFIED: der sichtbare Toast (kein Browser) und eine echte Zeitüberschreitung von Mailjet (nicht auslösbar).

#### AC-4: Genau ein Zustand pro Lizenz, als Text, mit passender Aktion
- [=] Alle vier Zustände im HTML von `/licenses`, Badge mit Text. Unverändert seit 2026-11-01 (`invitation-status.tsx`, `license-list.tsx`, `invitations.rules.ts` nicht in der Diff).
- [ ] BUG-3 (Low, Deferred): unverändert seit 2026-11-01, nicht erneut geprüft (`send-invitation-button.tsx` und `invitations.rules.ts` nicht in der Diff).
- [!] NOT VERIFIED: „ohne seitliches Scrollen“ auf dem Smartphone und Tippflächen von 44 px. Dafür braucht es einen Viewport.

#### AC-5: „Erneut senden“ schickt dieselbe Einladung, Rückmeldung, Liste ohne Neuladen
- [x] **Fehlerpfad** (Regression des Laufzeitwegs): `sendInvitation` → `{"status":"failed"}` mit neuem `last_attempt_at`.
- [=] Erfolgspfad mit echter zweiter Mail, Neurendern ohne Neuladen, Toast-Texte. Unverändert seit 2026-11-01.
- [!] NOT VERIFIED: dass der Browser den Baum einspielt und den Toast zeigt (kein Browser).

#### AC-6: Altbestand → „Noch nicht eingeladen“, nichts automatisch, Klick versendet
- [=] Unverändert seit 2026-11-01 (Liste, Regeln und `sendInvitation` nicht in der Diff).

#### AC-7: Grenze 3 pro Lizenz in 24 Stunden, auch an der Oberfläche vorbei
- [=] Unverändert seit 2026-11-01 (Migration und Datenzugriff nicht in der Diff).

#### AC-8: Grenze 30 pro Träger in 24 Stunden, entzogene zählen mit, auch beim Zuweisen
- [=] Unverändert seit 2026-11-01 (Migration und Datenzugriff nicht in der Diff).

#### AC-9: Datentrennung beim Lesen und Auslösen, Schreibschutz, Adresse nur aus der Lizenz
- [=] PostgREST mit Token und öffentlichem Schlüssel, SQL-Rollenprobe, Katalog, fremde Lizenz über die App, Adresse nur aus der Lizenz. Unverändert seit 2026-11-01 (RLS, Funktionen, `invitations.data.ts`, `invitations.schema.ts` nicht in der Diff).

#### AC-10: Datenschutzhinweis am Ende der Einladung
- [x] **Wortlaut** laut Spec, mit dem Trägernamen an allen drei Stellen, als letzter Absatz nach „--“ (Render HEAD, `invitation-mail.rules.ts:52-53`).
- [x] **Satzende:** endet mit „… richten Sie bitte an <Name>.“ und bei „Bildungswerk e.V.“ ohne zweiten Punkt, in Text- und HTML-Fassung (Render; Test `invitation-mail.rules.test.ts` → „Trägername am Satzende (AC-2, AC-10)“).
- [=] Hinweis am Ende der echten Mail (Nutzer). Unverändert seit 2026-11-01.
- [x] BUG-2 ist behoben, siehe Bugs.

#### AC-11: Keine Werbung, kein Zählpixel, keine umgeleiteten Links
- [x] **Render HEAD:** kein `<img`, kein `<link`, kein `@import`, kein `url(`. Genau 2 `<a href>`, beide direkt auf das Linkziel.
- [=] `TrackOpens`/`TrackClicks: 'disabled'` und die vom Nutzer im Original geprüfte echte Mail. Unverändert seit 2026-11-01 (`mailjet.integration.ts` nicht in der Diff).

#### AC-12: Löschen mit Lizenz und Träger, Versandstand ohne Adresse, Zähler nach 24 h weg
- [=] Spalten, Kaskaden, Entziehen der echten Lizenz, Aufräumjob. Unverändert seit 2026-11-01 (`supabase/` nicht in der Diff).
- [x] **Nebenbei belegt:** Das Löschen des Testkontos `qa6-rev@example.com` hat Träger, Lizenz und Versandstand mitgenommen (Endstand 0/0/0, siehe Aufräumen).
- [!] NOT VERIFIED — go-live: die Aufbewahrung bei Mailjet (Kontakte, Versandverlauf, T21).

## Edge Cases

#### EC-1 bis EC-6
- [=] Laufender Versand, gleichzeitige Versendungen an der Grenze, hängender Versand, Zeitüberschreitung, Entziehen während des Versands, Neuzuweisung. Unverändert seit 2026-11-01. Garantien und Code liegen in der Migration, in `invitations.delivery.ts`, `invitations.rules.ts` und `send-invitation-button.tsx`, nichts davon ist in der Diff.

#### EC-7: Trägername mit Sonderzeichen, HTML, Link, sehr lang → reiner Text
- [x] **Maskierung und Entschärfung unverändert:** `plainName` und `escapeHtml` sind nicht geändert. Für `<b>x</b> www.a.de & "Co"`, einen Namen mit 100 Zeichen und `\r\nBcc:` sind Text und HTML bei HEAD und `024a0a2` gleich (Prüfer, Vergleichsskript).
- [x] **HTML am Satzende** bleibt maskiert („&lt;/·b&gt;.“). `atSentenceEnd` läuft nach dem Maskieren und hängt nur „.“ an, nie Nutzerinhalt.
- [x] **Kein ReDoS:** Die Regex `/\.​?$/` (`:47`) ist am Ende verankert und linear.
- [ ] BUG-1 (Low, Deferred): besteht unverändert. Neu beobachtet: Endet der Name auf „.“ und danach ein Formatzeichen, kommt der doppelte Punkt wieder (siehe Bugs).

#### EC-8: Adresse mit `+`, Bindestrich, Subdomain → geht an genau diese Adresse
- [=] Unverändert seit 2026-11-01 (Beginn-Funktion und `mailjet.integration.ts` nicht in der Diff).

#### EC-9: Zugang oder Linkziel nicht eingestellt oder ungültig → App läuft, Versand „Fehlgeschlagen“
- [x] **Schlüssel leer** (laufender Server): Die App startet, Zuweisen funktioniert, der Versand endet `failed`. Der Client bekommt nur `{"status":"failed"}`, im Log stehen nur 2 Zeilen „Mailjet: Einladung nicht versendet (nicht eingestellt)“.
- [x] **`platformUrlFrom`** liefert für 8 Eingaben dasselbe wie bei `024a0a2`: `https:`, `javascript:`, `data:`, Zugangsdaten, leer, `undefined`, relativ, `ftp:` (Prüfer, Vergleichsskript).
- [=] Ungültiger Schlüssel (HTTP 401) und ungültiges Linkziel zur Laufzeit. Unverändert seit 2026-11-01; ein Neustart mit anderer Umgebung war für diese Diff nicht nötig, weil `platformUrlFrom` und `invitations.delivery.ts` gleich geblieben sind.
- [ ] BUG-4 (Low, Deferred): unverändert seit 2026-11-01, nicht erneut geprüft (`invitations.delivery.ts` nicht in der Diff).

#### EC-10 bis EC-12
- [=] Verbindungsabbruch, abgemeldet oder ohne Träger, Kontingent ausgeschöpft. Unverändert seit 2026-11-01.
- [!] NOT VERIFIED: ein echter Verbindungsabbruch (EC-10). Dafür braucht es einen Browser.

### Weitere Edge Cases (nicht in der Spec)
- [=] Ungültige Eingaben an `sendInvitation`, UUID in Großbuchstaben, „Versendet am“ an Tagesgrenze und Sommerzeit. Unverändert seit 2026-11-01.
- [x] **Satzende, neu in diesem Lauf** (Render HEAD, Prüfer):
  - „Akademie...“ → kein vierter Punkt
  - „A.“ (Mindestlänge) → „A.“
  - „info@werk.de.“ → kein zweiter Punkt
  - „Werk (e.V.)“, „Werk e.V.)“, „Werk "e.V."“ → „).“ bzw. „".“, wie es die deutsche Zeichensetzung verlangt
  - „www.werk.de“ → „… de.“
- [ ] BUG-5 (Low, Deferred, neu): Name endet auf „!“, „?“ oder „…“ → „… an Lern!.“ (siehe Bugs).
- [ ] BUG-1 (Low, Deferred): Name endet auf „.“ plus U+200B oder U+202C → doppelter Punkt (siehe Bugs).
- [!] Name endet auf „.“ plus NBSP, Tabulator oder Zeilenumbruch → „e.V. .“. Über das Formular der App nicht erreichbar, weil JS `trim()` diese Zeichen entfernt. Ob ein anderer Weg dorthin führt, ist nicht geprüft und gehört zu PROJ-1 (siehe O-8).

## Security-Audit

Beschränkt auf die Diff und den Weg vom Trägernamen in die Mail. Die übrigen Punkte sind aus dem ersten Lauf übernommen.

- [x] **Authentication:** `sendInvitation` ohne Cookie → `x-action-redirect: /login?reason=session`, `last_attempt_at` per SQL unverändert.
- [=] **Authorization über die App und an der Datenbank:** unverändert seit 2026-11-01 (kein Daten- oder Rechtecode in der Diff).
- [=] **Input validation** von `sendInvitation`: unverändert seit 2026-11-01 (`invitations.schema.ts` nicht in der Diff).
- [x] **Mail-Injection über den Trägernamen:** HTML maskiert, auch am Satzende; Links mit U+200B entschärft; CR/LF werden zum Leerzeichen. Der neue Helfer fügt nur „.“ ein (Render, siehe EC-7).
  - [ ] BUG-1 (Low, Deferred): Bidi- und Formatzeichen werden weiter nicht neutralisiert.
- [!] **Rate limiting auf `sendInvitation`:** NOT VERIFIED — nicht implementiert (optional für das MVP), unverändert seit 2026-11-01. Die Versandgrenzen 3/30 sind vorhanden (AC-7, AC-8). Siehe O-1.
- [!] **Brute force:** NOT VERIFIED — nicht anwendbar. Die Diff ist reine Textlogik ohne Credential-Pfad, und PROJ-3 hat keinen.
- [=] **Keine Account-Enumeration** (PROJ-1): unverändert seit 2026-11-01.
- [x] **Keine Zugangsdaten und Adressen in URLs:** Im Server-Log stehen die Actions dieses Laufs als `POST /licenses` ohne Query.
  - [=] Formulare (`type="button"` am Sendeknopf, `method="post"` am Dialog): unverändert seit 2026-11-01.
- [x] **Keine Geheimnisse im Client-Bundle:** Produktions-Build `V075hyVj-9XjufeMUxdlJ`, `.next/static`: 0 Dateien mit `MAILJET`, `api.mailjet.com`, `INVITATION_SENDER`, `LEARNING_PLATFORM`, `SERVICE_ROLE`, `service_role`, `sb_secret_`, `TURNSTILE_SECRET`, `eyJhbGciOi`, `createAdminClient`, `deliverInvitation`, `buildInvitationMail`. Die Mailtexte („Bei Fragen wenden Sie sich“, „Fragen dazu richten Sie“) stehen in 0 Client-Dateien.
- [x] **Keine Geheimnisse in der Git-Historie:** Fix-Commit `git show e8ac80a | grep -cE "MAILJET_[A-Z_]*KEY=.+|sb_secret_|eyJhbGciOi"` → 0.
  - [=] Die Historie davor: unverändert seit 2026-11-01 (0 Treffer).
- [x] **Keine sensiblen Daten in Antworten:** `assignLicense` → `{"status":"assigned","invitation":{"status":"failed"}}`, `sendInvitation` → `{"status":"failed"}`, 0-mal `ErrorMessage` oder `MAILJET`.
- [x] **Keine Personendaten im App-Protokoll:** `grep -cE "example\.com|QA6|e\.V\.|@" dev-server.log` → 0. Einzige Zeilen zum Versand: 2 × „Mailjet: Einladung nicht versendet (nicht eingestellt)“.
- [=] **CSRF auf Server Actions:** unverändert seit 2026-11-01.
- [=] **Sicherheitsheader lokal:** unverändert seit 2026-11-01 (`next.config.ts` nicht in der Diff).

## Regression

- [x] **Suite-Lauf:** 37 Dateien, 864 Tests bestanden, 0 fehlgeschlagen, keine Skip-Zeilen. Eine E2E-Suite gibt es nicht (`tests/` fehlt), also übersprungen; kein Browser-Runner installiert.
- [x] **Laufzeitweg der geänderten Datei** gegen die laufende App: Registrieren → `/licenses` 200 mit dem Trägernamen im HTML → `assignLicense` (`assigned`, Einladung `failed`) → `sendInvitation` (`failed`, neuer `last_attempt_at`). Kein unerwarteter Fehler im Log, in der DB `failed` und 0 Versendungen.
- [x] **Kein Feature ist „Deployed“** (`features/INDEX.md`). Es gibt also keine deployten Nachbarn, die die Diff treffen könnte.
- [=] **PROJ-1 und PROJ-2:** Die Diff berührt keinen ihrer Teile (`account/*`, `licenses/*`, `proxy`, Migrationen). Die Regression vom 2026-11-01 gilt weiter, belegt durch den Suite-Lauf.

## Unit-Tests (`/qa`, Step 6)

- **Bewertet:** Das neue Verhalten deckt `invitation-mail.rules.test.ts` → „Trägername am Satzende (AC-2, AC-10)“ ab. Zwei Fälle stammen aus dem Fix: Schlusspunkt im Namen (Text und HTML) und Punkt mitten im Namen (Text). Namen ohne Punkt deckt die bestehende Absatzliste in beiden Fassungen ab (`:10`, `:16`). `/qa` hat deshalb keinen Test ergänzt.
- **Rotprobe auf die Tests aus dem Fix** (einmal für die Datei, von der `/qa`-Sitzung):
  - `atSentenceEnd` auf „hängt immer einen Punkt an“ gesetzt → 1 fehlgeschlagen: „ein Schlusspunkt im Namen beendet den Satz …“.
  - `atSentenceEnd` auf „hängt nie einen Punkt an“ gesetzt → 11 fehlgeschlagen, darunter der Gegentest „ein Punkt mitten im Namen lässt den Schlusspunkt stehen“.
  - Danach `git checkout` der Quelldatei (`git diff` leer), wieder 46 bestanden.
- Für BUG-5 hat `/qa` keinen Test geschrieben; er wäre heute rot. Der Test dazu kommt mit dem Fix in `/build`.
- [=] Die 7 Fälle von `/qa` aus dem ersten Lauf (Steuer- und Trennzeichen im Namen) sind grün im Suite-Lauf.

## E2E-Tests
_Optionale Ebene, geschrieben von `/e2e-tests`, nur für kritische Kernabläufe._

- Status: **nicht gelaufen** (`/e2e-tests` für kritische Abläufe ausführen)

## `[user]`-Aufgaben

- [=] **T1–T4, T6** (Mailjet-Konto, bestätigter Absender, Tracking aus, Schlüssel, echte Werte): im ersten Lauf mit der echten Mail belegt, unverändert seit 2026-11-01.
- [!] **T5** (Platzhalter in `.env.local.example`): NOT VERIFIED. Die Datei ist für den Agenten gesperrt; der Nutzer hat die Aufgabe abgehakt.
- [!] **T21–T24** (Löschregel und Auftragsverarbeitungsvertrag bei Mailjet, eigene Absender-Domain, Linkziel der Plattform): NOT VERIFIED — go-live, wird in `/deploy` gemacht und geprüft. Keine davon liegt auf einem Credential-Pfad.

## Nicht geprüft in diesem Lauf

- [!] **Inhalt einer tatsächlich zugestellten Mail mit dem Fix** (AC-2, AC-10, AC-11). Grund: Mailjet-Schlüssel absichtlich leer. Belegt durch Render vorher/nachher und den fehlerfreien Lauf bis zum Mailjet-Schritt; die echte Zustellung stammt aus dem ersten Lauf.
- [!] **Darstellung in Mailprogrammen** (U+200B, Bidi-Zeichen). Grund: kein Mailprogramm und kein Browser.
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
- **Status:** Deferred (Entscheidung des Nutzers, 2026-11-01)
- **Class:** Unicode-Format- und Bidi-Steuerzeichen (`\p{Cf}`, z. B. U+202E, U+2066–U+2069, U+200B) in Nutzertext werden vor der Ausgabe in ausgehende Inhalte nicht neutralisiert.
  - EC-7 verlangt den Namen „als reiner Text, ohne Formatierung“; eine Richtungsumkehr ist Formatierung.
  - Der Name bleibt dabei unanklickbar und steht weder im Betreff noch im Absender. Die Wirkung ist eine verdrehte Anzeige im Mailtext, die der Verwalter selbst steuert.
  - **Neu beobachtet (2026-11-01, Nachprüfung):** Endet der Name auf „.“ und danach ein Formatzeichen, erkennt `atSentenceEnd` den Schlusspunkt nicht, und es folgt wieder ein zweiter Punkt. Beispiele: „Werk e.V.“+U+200B → sichtbar „e.V..“, „Werk e.V.“+U+202C ebenso. U+200B kommt durch das Formular, weil JS `trim()` es nicht entfernt und die DB-Regel `name = btrim(name)` (`20261021120000_proj1_training_providers.sql:21`) nur Leerzeichen prüft. Wer die Klasse behebt, behebt das mit.
- **Sweep:** `grep -rnE 'p\{Cf\}|u202[A-Ea-e]|u206[6-9]' src --include='*.ts' --include='*.tsx' | grep -v '\.test\.'` → 0 Treffer (erneut gelaufen am 2026-11-01, Nachprüfung). Die einzige Stelle, an der freier Nutzertext in ausgehende Inhalte gelangt, ist `plainName` in `src/features/invitations/invitation-mail.rules.ts:65-69`; sie ersetzt nur `\p{Cc}\p{Zl}\p{Zp}`.
- **Steps to Reproduce:**
  1. Einen Träger registrieren, dessen Name U+202E (RIGHT-TO-LEFT OVERRIDE) enthält, z. B. „Bank“ + U+202E + „moc.live“ + U+202C. Die Namensregel prüft nur 2–100 Zeichen (`account.schema.ts:59-64`, `proj1_training_providers.sql:20-21`).
  2. Eine Lizenz zuweisen.
  3. Erwartet: Der Name steht als reiner Text in der Mail.
  4. Tatsächlich: U+202E steht unverändert in Text- und HTML-Fassung (`buildInvitationMail`, per Skript geprüft), Mailprogramme zeigen den Rest des Namens gespiegelt.

#### BUG-2: Trägername mit Schlusspunkt ergibt zwei Punkte am Satzende
- **Severity:** Low
- **Status:** Fixed (2026-11-01, re-verified). Behoben in `e8ac80a` durch den Helfer `atSentenceEnd` (`invitation-mail.rules.ts:47`).
- **Class:** Platzhalter am Satzende ohne Behandlung eines Schlusspunkts, den der eingesetzte Wert schon mitbringt.
- **Sweep:** `grep -n '\${name}\.' src/features/invitations/invitation-mail.rules.ts` → erneut gelaufen: 1 Treffer (vorher 2), und zwar `:47`, der Rückfallzweig von `atSentenceEnd` selbst. Er hängt den Punkt nur an, wenn der Name nicht schon auf „.“ endet. Das ist die erlaubte Ausnahme.
  - Über ganz `src`: `grep -rnE '\$\{[^}]+\}\.([^a-zA-Z0-9_$]|$)' src --include='*.ts' --include='*.tsx' | grep -v '\.test\.'` → 1 Treffer, wieder nur `:47`. Kein anderer Wert steht vor einem Satzschlusspunkt.
- **Nachprüfung:** Für „QA6 Bildungswerk e.V.“ hat der Render von `024a0a2` 2 × „..“ in Text und HTML, der von HEAD 0 ×. Der Name steht weiter an allen 5 Stellen. Tests und Rotprobe: siehe Unit-Tests.
- **Steps to Reproduce (ursprünglich):**
  1. Einen Träger „QA5-OWN Bildungswerk e.V.“ registrieren und eine Lizenz an eine eigene Adresse zuweisen.
  2. Erwartet: „Bei Fragen wenden Sie sich an QA5-OWN Bildungswerk e.V.“
  3. Vorher: „… an QA5-OWN Bildungswerk e.V..“, ebenso am Ende des Datenschutzhinweises.

#### BUG-3: Zugänglicher Name „Einladung an <Adresse> senden“ enthält den sichtbaren Text nicht
- **Severity:** Low
- **Status:** Deferred (Entscheidung des Nutzers, 2026-11-01)
- **Class:** Ein zugänglicher Name, der den sichtbaren Text nicht zusammenhängend enthält (WCAG 2.5.3 „Label in Name“). Wer per Sprachsteuerung „Einladung senden“ sagt, trifft den Knopf eventuell nicht. „Erneut senden“ und „Entziehen“ sind im jeweiligen Namen enthalten und damit unkritisch.
  - Der Text stammt so aus dem Design; `/build` hat ihn in `design.md` → Hinweise für `/qa` zur Entscheidung vorgelegt.
- **Sweep:** `grep -rn 'aria-label={' src/features src/components | grep -v '\.test\.' | grep -v components/ui` → 3 Treffer, 1 betroffen: `send-invitation-button.tsx:66` mit `sendButtonAccessibleLabel` (`invitations.rules.ts:157-158`). Erlaubt: `revoke-license-dialog.tsx:82` („Lizenz von … entziehen“ enthält „entziehen“), `quota-summary.tsx:32` (Fortschrittsbalken ohne sichtbaren Knopftext). Stand 2026-11-01, erster Lauf; die Diff berührt keine dieser Dateien.
- **Steps to Reproduce:**
  1. Eine Lizenz ohne Versandstand anlegen und `/licenses` öffnen.
  2. Erwartet: Der zugängliche Name enthält „Einladung senden“ zusammenhängend.
  3. Tatsächlich: sichtbar „Einladung senden“, `aria-label="Einladung an <Adresse> senden"`.

#### BUG-4: Ungültiges oder fehlendes Linkziel scheitert ohne Hinweis auf der Server-Konsole
- **Severity:** Low
- **Status:** Deferred (Entscheidung des Nutzers, 2026-11-01)
- **Class:** Eine Fehlkonfiguration endet als „Fehlgeschlagen“ ohne Diagnosezeile.
  - Das Design verspricht in den Technischen Entscheidungen („Einstellungen werden erst beim Senden gelesen …“): „Die Konsole nennt die Ursache ohne Geheimnisse.“ Für fehlende Mailjet-Werte gibt es diese Zeile („nicht eingestellt“), für das Linkziel nicht.
  - Wer die README nachbaut und sich beim Linkziel vertippt, sieht nur „Fehlgeschlagen“ und keinen Grund (PRD → Erfolgskriterien: nachvollziehbar für den Prüfer). Der Verwalter sieht korrekt keine technische Meldung (EC-9).
- **Sweep:** `grep -n "platformUrl !== null\|console\." src/features/invitations/invitations.delivery.ts` → 2 Treffer: `:47` (Prüfung ohne `else`-Zweig) und `:70` (nur die Zeile für unerwartete Fehler). Stand 2026-11-01, erster Lauf; `invitations.delivery.ts` ist nicht in der Diff.
- **Steps to Reproduce:**
  1. `MAILJET_API_KEY= MAILJET_SECRET_KEY= LEARNING_PLATFORM_URL='javascript:alert(1)' npm run dev`
  2. Eine Lizenz zuweisen → `{"status":"assigned","invitation":{"status":"failed"}}`.
  3. Erwartet: eine Zeile auf der Konsole, die das ungültige Linkziel nennt (ohne Wert).
  4. Tatsächlich: keine Zeile, nur die Request-Zeilen von Next.js.

#### BUG-5: Trägername mit „!“, „?“ oder „…“ am Ende bekommt am Satzende trotzdem einen Punkt
- **Severity:** Low
- **Status:** Deferred (neuer, nicht blockierender Befund einer Nachprüfung, 2026-11-01; er löst keine weitere Runde aus)
- **Class:** Ein Platzhalter am Satzende prüft nur den Abkürzungspunkt „.“, nicht andere Satzschlusszeichen, die der Wert schon mitbringt (`!`, `?`, U+2026 „…“). Steht ein solches Zeichen am Satzende, fällt der Schlusspunkt im Deutschen weg.
  - Das ist die Nachbarklasse von BUG-2, keine Regression: Bei `024a0a2` war die Ausgabe für diese Namen dieselbe (Prüfer, Vergleichsskript). BUG-2 bleibt geschlossen, weil seine Klasse ausdrücklich den Schlusspunkt nennt.
- **Sweep:** `grep -rnE '\$\{[^}]+\}\.([^a-zA-Z0-9_$]|$)' src --include='*.ts' --include='*.tsx' | grep -v '\.test\.'` → 1 Treffer, `src/features/invitations/invitation-mail.rules.ts:47`. Das ist die einzige Stelle, an der ein Wert einen Satz beendet. Ihre Regex `/\.​?$/` kennt nur „.“, und sie wirkt auf beide Sätze (`:50`, `:53`).
- **Steps to Reproduce:**
  1. Einen Träger „Lern!“ (oder „Wer lernt?“ bzw. „Akademie…“) registrieren; die Namensregel erlaubt das (2 bis 100 Zeichen).
  2. Eine Lizenz zuweisen.
  3. Erwartet: „Bei Fragen wenden Sie sich an Lern!“
  4. Tatsächlich, per Render von HEAD in Text- und HTML-Fassung: „Bei Fragen wenden Sie sich an Lern!.“ und am Ende des Datenschutzhinweises „… richten Sie bitte an Lern!.“ (Prüfer und `/qa`-Sitzung unabhängig).

## Beobachtungen (kein Bug, zur Kenntnis)

- [=] **O-1 bis O-7** aus dem ersten Lauf gelten unverändert: Fehlversuche ungebremst (O-1), Turnstile mit Testschlüsseln (O-2), Bremszeilen aus dem Suite-Lauf (O-3), Zeitpunkt „ab“ mit laufender Reservierung (O-4), Abschluss scheitert nach Annahme (O-5), Hinweis bei frischem Besuch (O-6), Aufbewahrung bei Mailjet (O-7). Ihr Code ist nicht in der Diff. Den Wortlaut enthält der Bericht in Commit `024a0a2`.
- **O-8, Trägername in App und Datenbank verschieden normalisiert (PROJ-1, nicht geprüft):** Die App entfernt Leerraum am Rand mit JS `trim()` (alle Leerräume, aber nicht U+200B). Regel und Trigger der Datenbank nutzen `btrim` und entfernen nur Leerzeichen (`20261021120000_proj1_training_providers.sql:21,88`). Ein Name mit NBSP, Tabulator oder Zeilenumbruch am Ende würde in der Mail „e.V. .“ ergeben. Über das Formular ist das nicht erreichbar. Ob es einen Weg am Formular vorbei gibt (direkte Registrierung bei Supabase Auth, die Tabellenansicht des Anbieters), hat niemand geprüft. Das gehört zu PROJ-1.

## Zusammenfassung
- **Art des Laufs:** Nachprüfung in der Breite der Diff `024a0a2..HEAD`, eine Produktionsdatei.
- **Akzeptanzkriterien:** 12 von 12 erfüllt.
  - In diesem Lauf erneut geprüft: AC-2, AC-10, AC-11 (Render und Laufzeitweg), dazu Teile von AC-3, AC-5 und AC-12 über die Regression.
  - Die übrigen sind `[=]` vom 2026-11-01, ihr Code ist unverändert.
  - Nicht geprüft: die Browser-Teile von AC-1, AC-3, AC-4 und AC-5 und die echte Mail mit dem Fix.
- **Edge Cases:** EC-7 und EC-9 erneut geprüft, die übrigen `[=]`. An EC-7 hängt weiter BUG-1, an EC-9 weiter BUG-4, beide Deferred.
- **Bugs:** 5 insgesamt (0 Critical, 0 High, 0 Medium, 5 Low).
  - Fixed: 1 (BUG-2, nachgeprüft).
  - Deferred: 4 (BUG-1, BUG-3, BUG-4 und neu BUG-5).
  - Open: 0.
- **Security:** 17 Prüfpunkte. 7 in diesem Lauf geprüft, davon einer mit dem bekannten BUG-1. 6 übernommen (`[=]`). 4 NOT VERIFIED: Rate limiting (nicht implementiert), Brute Force (nicht anwendbar), Supabase-Protokolle (nicht einsehbar), Header gegen eine Live-URL (kein Deployment).
- **Regression:** Suite 864/864, Laufzeitweg der geänderten Datei ohne Fehler, kein deploytes Feature betroffen.
- **Production Ready:** JA. Es gibt keinen Critical- oder High-Bug und keinen offenen Bug. Alle Akzeptanzkriterien wurden gegen die laufende App ausgeübt, die Einladung im ersten Lauf auch als echte Mail.
- **Status:** **Approved**.
- **Empfehlung:** BUG-1, BUG-3, BUG-4 und BUG-5 später gesammelt mit `/build PROJ-3 deferred` beheben. BUG-1 und BUG-5 liegen beide in `atSentenceEnd` bzw. `plainName` und passen in einen Durchgang.

> „Production Ready: JA“ heißt *keine Critical/High-Bugs*. Es heißt **nicht**, dass alles geprüft wurde. Die Punkte unter „Nicht geprüft in diesem Lauf“ sind offen und brauchen einen Menschen oder `/e2e-tests`.
