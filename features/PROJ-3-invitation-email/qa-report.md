# QA-Testergebnisse: PROJ-3 Einladungs-E-Mail

**Getestet:** 2026-11-01, Stand `77f1544` auf `feat/PROJ-3-invitation-email`
**App-URL:** http://localhost:3000 (`probe.baseUrl`), gestartet von der `/qa`-Sitzung. Der Server lief nacheinander in vier Fassungen:
1. **Mailversand aus:** `MAILJET_API_KEY` und `MAILJET_SECRET_KEY` in der Shell leer gesetzt. `@next/env` übernimmt Werte aus `.env.local` nur für Variablen, die vorher `undefined` sind (`node_modules/@next/env/dist/index.js`). Gegen diese Fassung liefen die drei Prüfer, damit keine Mail an `example.com` hinausging.
2. **Ungültiges Linkziel:** zusätzlich `LEARNING_PLATFORM_URL=javascript:alert(1)` (EC-9).
3. **Ungültiger Schlüssel:** `MAILJET_API_KEY=qa-invalid-key`, sonst die echten Werte (EC-9).
4. **Echte Werte** aus `.env.local`, ohne Überschreibung: echte Mails an eine Adresse des Nutzers.

**Tester:** QA Engineer (KI). Drei unabhängige `qa-engineer`-Prüfer ohne Build-Kontext, parallel und mit getrennten Bereichen:
- Abnahme (Step 2)
- Security (Step 3)
- Regression (Step 4 und 5)

Zusammengeführt hat die `/qa`-Sitzung. Sie hat außerdem die Server-Fassungen 2 bis 4 geprüft, die echte Mail mit dem Nutzer abgenommen und die Unit-Tests ergänzt (Step 6).

**Umfang:** voll. Das ist der erste `/qa`-Lauf von PROJ-3, einen früheren Bericht gibt es nicht.

> Legende:
> - `[x]` in diesem Lauf geprüft (mit Beleg)
> - `[ ] BUG` als fehlerhaft geprüft
> - `[!] NOT VERIFIED` in diesem Lauf nicht prüfbar (mit Grund)

**So wurde geprüft:**
- **Server Actions** per HTTP direkt aufgerufen, am Formular vorbei: `POST` mit dem Kopf `Next-Action`. Die IDs stammen aus dem Client-Bundle bzw. `.next/dev/server/server-reference-manifest.json`.
- **Seite:** Das server-gerenderte HTML von `/licenses` wurde ausgewertet. Antworten der Actions enthalten den neu gerenderten Baum.
- **Datenbank-Schnittstelle (PostgREST)** mit dem Zugriffstoken eines Verwalters und mit dem öffentlichen Schlüssel allein.
- **Datenbank** direkt per `env -u SUPABASE_ACCESS_TOKEN supabase db query --linked`. Rechte-Tests liefen mit `set_config('role', …)` und JWT-Claims, jeweils zurückgerollt. Die Grenztests legten Versendungen per SQL an und räumten sie danach wieder weg.
- **Mailtexte:** `buildInvitationMail` per `node --experimental-strip-types` gerendert, aus einer Kopie im Scratchpad.
- **Echte Mail (aufgezeichneter Test durch den Nutzer, 2026-11-01, Gmail):**
  - Zwei Einladungen gingen an eine eigene Gmail-Adresse des Nutzers mit `+`-Zusatz: Zuweisen und einmal „Erneut senden“, über den Server mit den echten Werten.
  - Der Nutzer hat Kopf, Inhalt und Quelltext der angekommenen Mails geprüft (zwölf Punkte, siehe AC-1, AC-2, AC-10, AC-11, EC-8).
  - Die Adresse steht in keiner Datei und in diesem Bericht nicht.
- **Testkonten:** Präfixe `qa5-acc-`, `qa5-sec-`, `qa5-reg-` (die Prüfer) und `qa5-own-` (die `/qa`-Sitzung), alle mit eigenem Träger. Teilnehmer-Adressen stammten aus `example.com`, außer der einen echten Adresse in Fassung 4.
- **Aufräumen**, Endstand per SQL von der `/qa`-Sitzung, gleich dem Ausgangsstand vor dem Lauf:
  - 4 Konten, 4 Träger, 4 Mitgliedschaften
  - 0 Lizenzen, 0 Versandstände, 0 Versendungen
  - 0 Konten `qa5-%`, 0 Träger `QA5%`
  - 0 Login-Versuche, Sperren und Registrierungsversuche außer denen der Suite (siehe O-3)
  - Ein Volltext-Scan aller 8 Tabellen in `public` und `private` nach der echten Adresse (`t::text ilike`) ergab 0 Treffer.
  - Cookie- und Sitzungsdateien im Scratchpad sind gelöscht, der Server ist beendet.

**Suite-Lauf** (einmal vor den Prüfern, `npm test`): 37 Dateien, 855 Tests bestanden, 0 fehlgeschlagen, exit 0. Alle drei Prüfer haben diesen Lauf zitiert, keiner hat die Suite erneut gestartet.

**Weitere Läufe:**
- **Produktions-Build:** `npm run build` → exit 0, Build `s4m-NiRwhtJKLBd1S3Iyt`.
- **Migrationen:** `supabase migration list --linked` zeigt lokal und remote dieselben 6 Versionen bis `20261026150000` (PROJ-3).
  - Ein Round-Trip (`db reset`) ist [!] NOT VERIFIED: Die Strategie ist `single`, ein Reset des gehosteten Projekts würde alle Daten löschen.
  - Das Live-Schema wurde stattdessen geprüft (Spalten, Regeln, Rechte, Funktionen, Cron-Job; siehe AC-9 und AC-12).
- **Nach der Teständerung von `/qa`:** `npx eslint src/features/invitations/invitation-mail.rules.test.ts` → exit 0, `npx tsc --noEmit` → exit 0.

## Akzeptanzkriterien

#### AC-1: Zuweisen löst genau eine Einladung aus, Toast mit Zusatz, „Versendet am“
- [x] **Echte Zuweisung** (Fassung 4) → `{"status":"assigned","invitation":{"status":"sent"}}` nach 2,7 s.
  - Danach steht in `license_invitations` `sent`, dazu genau eine angenommene Versendung.
  - Nach „Erneut senden“ sind es zwei; der Nutzer hat genau zwei angekommene Mails bestätigt.
- [x] **Liste:** Das HTML von `/licenses` zeigt in Tabelle und Karte „Versendet am“ mit `<time dateTime="2026-11-01T09:43:21.183293+00:00">01.11.2026</time>` und „Erneut senden“.
- [x] **Zeitzone:** Ein per SQL gesetzter Stand `2026-10-31T23:30Z` erscheint als „01.11.2026“ (Abnahme-Prüfer).
- [x] **Toast-Zuordnung im Code:** „Lizenz zugewiesen“ mit „Die Einladung ist versendet.“ als `toast.success` mit `description` (`licenses.rules.ts:131-134`, `invitations.rules.ts:208-209`, `assign-license-dialog.tsx:70-72`).
- [x] **Genau ein Versuch:** `deliverInvitation` wird einmal aufgerufen (`licenses.actions.ts:30-37`), Mailjet ohne Wiederholung (`mailjet.integration.ts:52-68`).
- [!] NOT VERIFIED: der sichtbare Toast. Dafür braucht es einen Browser; belegt sind die Komponententests im Suite-Lauf.

#### AC-2: Absender, Betreff, Inhalt der Einladung
- [x] **Echte Mail, vom Nutzer bestätigt:**
  - Absender „Lizenzzentrale“, Betreff exakt „Ihre Lizenz für den Kurs Geprüfter Technischer Betriebswirt (IHK)“
  - keine Zeile `Reply-To:` im Original
  - Trägername als reiner Text, kein Link
  - Knopf „Zur Lernplattform“ mit dem Hinweis, sich mit genau dieser Adresse anzumelden
- [x] **Code:** Absendername fest (`mailjet.integration.ts:7`), kein `ReplyTo`, `CustomID` oder `EventPayload` (`mailjet.integration.ts:29-41`), Betreff `invitation-mail.rules.ts:9`. Die Empfängeradresse steht nicht im Text (gerenderte Mail, Abnahme-Prüfer).
- [ ] BUG-2 (Low): Bei einem Trägernamen mit Schlusspunkt steht „Bei Fragen wenden Sie sich an QA5-OWN Bildungswerk e.V..“ mit zwei Punkten. Das hat der Nutzer in der echten Mail bestätigt.

#### AC-3: Versand scheitert → Lizenz bleibt, Warn-Toast, „Fehlgeschlagen“
- [x] **Mit leerem Schlüssel** (Fassung 1) → `{"status":"assigned","invitation":{"status":"failed"}}`.
  - Die Lizenz besteht und zählt („5 von 5“), der Versandstand steht auf `failed`.
  - Die fehlgeschlagene Versendung ist gelöscht, zählt also nicht.
- [x] **Mit ungültigem Schlüssel** (Fassung 3) → `{"status":"failed"}`, im Log nur „Mailjet: Einladung nicht versendet (HTTP 401)“.
- [x] **Warn-Toast:** Titel „Lizenz zugewiesen“, Zusatz wörtlich (`invitations.rules.ts:212-216`, `assign-license-dialog.tsx:73-75`).
- [x] **Zeitgrenze 10 s ohne Neuversuch:** `mailjet.integration.ts:6,46-47`, Test „bricht nach genau 10 Sekunden ab …“ (`mailjet.integration.test.ts:300`, im Suite-Lauf grün).
- [!] NOT VERIFIED: der sichtbare Toast (kein Browser) und eine echte Zeitüberschreitung von Mailjet (nicht auslösbar).

#### AC-4: Genau ein Zustand pro Lizenz, als Text, mit passender Aktion
- [x] **Alle vier Zustände** im HTML von `/licenses`, in Spalte „Einladung“ und Kartenzeile „Einladung:“:
  - „Fehlgeschlagen | Erneut senden“
  - „Wird versendet“ ohne Knopf
  - „Noch nicht eingeladen | Einladung senden“
  - „Versendet am 01.11.2026 | Erneut senden“
- [x] **Badge:** Symbol `aria-hidden`, das Wort trägt den Zustand (`invitation-status.tsx:27-39`). Regeln: `invitations.rules.ts:74-99`.
- [ ] BUG-3 (Low): Der zugängliche Name „Einladung an <Adresse> senden“ enthält den sichtbaren Text „Einladung senden“ nicht zusammenhängend (WCAG 2.5.3).
- [!] NOT VERIFIED: „ohne seitliches Scrollen“ auf dem Smartphone und die Tippflächen von 44 px. Dafür braucht es einen Viewport; im Markup stehen `flex-wrap` und `[overflow-wrap:anywhere]`.

#### AC-5: „Erneut senden“ schickt dieselbe Einladung, Rückmeldung, Liste ohne Neuladen
- [x] **Erfolgspfad** (Fassung 4) → `{"status":"sent"}` nach 1,3 s.
  - Versandstand `sent` mit neuem `last_attempt_at`, zwei angenommene Versendungen.
  - Die zweite Mail kam mit demselben Inhalt an (Nutzer).
- [x] **Fehlerpfad** (Fassung 1): für `sent`, `failed` und „hängend“ jeweils `{"status":"failed"}`, danach `failed` mit neuem Zeitstempel.
- [x] **Ohne Neuladen:** Die Antwort trägt `x-action-revalidated` und den neu gerenderten Baum (`invitations.actions.ts:40`, `refresh()`).
- [x] **Toast-Texte** wörtlich: `invitations.rules.ts:166-169`.
- [!] NOT VERIFIED: dass der Browser den Baum einspielt und den Toast zeigt (kein Browser).

#### AC-6: Altbestand → „Noch nicht eingeladen“, nichts automatisch, Klick versendet
- [x] Eine per SQL angelegte Lizenz ohne Versandstand zeigt „Noch nicht eingeladen“ mit „Einladung senden“ (`aria-label` „Einladung an … senden“). In `license_invitations` entsteht dabei nichts.
- [x] Der Klick läuft über dieselbe Action `sendInvitation`: `{"status":"failed"}` mit der Logzeile „nicht eingestellt“ (Fassung 1).

#### AC-7: Grenze 3 pro Lizenz in 24 Stunden, auch an der Oberfläche vorbei
- [x] **Aufbau:** 3 angenommene Versendungen in 24 h (−22 h, −10 h, −1 h) plus eine mit −25 h.
  - Ergebnis per POST: `{"status":"license_limit","availableFrom":"2026-11-01T11:00:30.000Z"}`. Das ist die älteste im Fenster plus 24 h; die Zeile mit −25 h zählt nicht.
  - Der Status bleibt unverändert.
  - Text: „… Sie können sie ab 01.11.2026, 12:01 Uhr erneut senden.“, aufgerundet und in Berlin-Zeit (Abnahme-Prüfer).
- [x] **Gegenprobe der Security-Prüferin** mit −3/−2/−1 h: `availableFrom` = älteste + 24 h.
- [x] **Garantie in der Migration:** `supabase/migrations/20261026150000_proj3_license_invitations.sql:154-169`.

#### AC-8: Grenze 30 pro Träger in 24 Stunden, entzogene zählen mit, auch beim Zuweisen
- [x] **Senden** bei 30 gezählten Versendungen, davon 27 ohne Lizenz (entzogen): `{"status":"provider_limit","availableFrom":…}` = `min(started_at)` + 24 h. Der Status bleibt.
- [x] **Zuweisen** bei 30: `{"status":"assigned","invitation":{"status":"provider_limit",…}}`. Die Lizenz besteht, es entsteht kein Versandstand („Noch nicht eingeladen“).
  - Von beiden Prüfern unabhängig nachgestellt.
- [x] **Texte und Toast-Art:** `invitations.rules.ts:147-149,210-211`, `assign-license-dialog.tsx:73-75`. Garantie: Migration `:171-192`.

#### AC-9: Datentrennung beim Lesen und Auslösen, Schreibschutz, Adresse nur aus der Lizenz
- [x] **PostgREST mit dem Token von A:**
  - `GET license_invitations` liefert nur Zeilen von A; die Zeile von B ergibt `[]`.
  - INSERT, PATCH und DELETE → 403 `42501`.
  - `rpc/license_center_begin_invitation` (für A und B) und `rpc/license_center_finish_invitation` → 403.
  - Das Schema `private` antwortet mit 406 `PGRST106`.
- [x] **Nur der öffentliche Schlüssel:** SELECT, INSERT und RPC → 401 `42501`, keine Zeilen.
- [x] **SQL-Rollenprobe** (Security-Prüferin, zurückgerollt):
  - `authenticated` als A: Upsert, Update, Delete und die Versendungen lesen, anlegen, löschen → `42501`; begin, finish und cleanup → `42501`.
  - `anon`: alles `42501`.
  - Katalog: `proacl` beider Funktionen = `{postgres, service_role}`, `prosecdef`, `search_path=''`; RLS an; genau eine Leseregel für `authenticated`.
- [x] **Über die App:** A sendet für die Lizenz von B, auch mit mitgeschicktem `trainingProviderId` und `email` → `{"status":"already_revoked"}`. Bei B ändert sich nichts.
  - Fremde, nicht existierende und die Nil-UUID antworten gleich, es gibt also kein Orakel für Lizenz-IDs.
- [x] **Adresse nur aus der Lizenz:** Zod verwirft fremde Felder (`invitations.schema.ts:8`), die Adresse liest die Beginn-Funktion (Migration `:132-136`), `invitations.delivery.ts:50`.
  - Die echte Mail ging an die gespeicherte, normalisierte Adresse. Eingegeben war die Adresse mit Leerzeichen am Rand, Großbuchstaben und `+`-Zusatz; der Nutzer hat den Empfänger bestätigt.
- [x] **Abgemeldet:** keine Zeilen (siehe oben), die Action leitet auf `/login?reason=session` um.

#### AC-10: Datenschutzhinweis am Ende der Einladung
- [x] **Echte Mail:** Der Hinweis steht am Ende (Nutzer).
- [x] **Code und gerenderte Mail:** wörtlich laut Spec, mit dem Trägernamen an allen drei Stellen, in Text- und HTML-Fassung (`invitation-mail.rules.ts:50-51,150,176`).
- [ ] BUG-2 (Low): Bei einem Namen mit Schlusspunkt endet der Hinweis mit „…an <Name>..“.

#### AC-11: Keine Werbung, kein Zählpixel, keine umgeleiteten Links
- [x] **Echte Mail, vom Nutzer im Original geprüft:**
  - kein Bild, kein Mailjet-Logo, kein Werbetext
  - kein `<img` im Quelltext
  - der Knopf zeigt direkt auf das Linkziel, nicht auf eine Mailjet-Domain
- [x] **Code:** `TrackOpens`/`TrackClicks: 'disabled'` (`mailjet.integration.ts:38-39`). HTML ohne Bilder, externe Stile und Schriften (`invitation-mail.rules.ts:156-180`).

#### AC-12: Löschen mit Lizenz und Träger, Versandstand ohne Adresse, Zähler nach 24 h weg
- [x] **Spalten live:** `license_invitations` = `license_id, training_provider_id, status, last_attempt_at`; `license_center_invitation_sends` = `id, training_provider_id, license_id, outcome, started_at`. Keine Adresse, kein Inhalt.
- [x] **Entziehen der echten Lizenz** (Fassung 4) → `{"status":"revoked"}`.
  - Danach: Lizenz 0, Versandstand 0, Versendungen mit Verweis 0, 2 angenommene Versendungen ohne Verweis.
  - Die Adresse steht in keiner der 8 Tabellen in `public` und `private`.
- [x] **Träger gelöscht** (über die Mitgliedschaft bzw. das Konto): Lizenzen, Versandstände und Versendungen des Trägers jeweils 0. Unabhängig nachgestellt von allen drei Prüfern und der `/qa`-Sitzung.
- [x] **Aufräumjob** `license-center-invitation-cleanup`: `*/5 * * * *`, aktiv. Er hat eine Zeile mit −25 h gelöscht und eine mit −22 h stehen lassen (Abnahme-Prüfer).
- [!] NOT VERIFIED — go-live: die Aufbewahrung bei Mailjet (Kontakte, Versandverlauf, T21).

## Edge Cases

#### EC-1: Laufender Versand → keine zweite Mail, „wird gerade versendet“, Knopf gesperrt
- [x] **Laufzeit:** Ein Versandstand `sending`, jünger als 2 min → `{"status":"already_sending"}`, kein neuer Versand, Zeitstempel unverändert.
  - Drei gleichzeitige POSTs ergaben einmal `already_sending`. Die beiden `failed` liefen nacheinander, weil ohne Mailjet ein Versuch nur Millisekunden dauert.
- [x] **Garantie:** Advisory Lock pro Träger und Prüfung „läuft schon“ in derselben Transaktion (Migration `:124-127,141-150`). Bei einer Ablehnung entsteht keine Versendung.
- [x] **Knopf:** `disabled`, `aria-busy` und eine `inFlight`-Ref (`send-invitation-button.tsx:41-46,67-68`), Tests `send-invitation-button.test.tsx:112,125`.

#### EC-2: 29 Versendungen, zwei gleichzeitige für verschiedene Lizenzen → genau eine
- [x] **Live, per SQL:** Zwei parallel gestartete `license_center_begin_invitation` reservierten genau eine `pending`-Zeile (Abnahme-Prüfer).
- [x] **Live, über die App:** Zwei parallele POSTs endeten einmal mit `failed` (reserviert) und einmal mit `provider_limit` (Security-Prüferin).
- [x] **Garantie:** Sperre pro Träger (Migration `:124-127`) und Mitzählen von `pending` jünger als 2 min (`:173-192`) in derselben Transaktion wie die Reservierung (`:195-202`). DB-Test `src/test/db/invitations.test.ts:394` (im Suite-Lauf grün).

#### EC-3: Hängender Versand nach 2 Minuten → „Fehlgeschlagen“, erneut senden möglich
- [x] Ein Versandstand `sending`, älter als 2 min, wird als „Fehlgeschlagen | Erneut senden“ gerendert, obwohl in der DB `sending` steht (09:24:08 bei `last_attempt_at` 09:21:46). Erneut senden ist erlaubt.
- [x] Regeln: `invitations.rules.ts:79-85`, Beginn-Funktion Migration `:145-150`. Grenzfälle (genau 2 min, 1:59,999 min, unlesbarer Zeitpunkt) in `invitations.rules.test.ts:76-97`.

#### EC-4: Mail trotz Zeitüberschreitung raus → doppelt möglich, Liste zeigt den letzten Versuch
- [x] **Garantie:** kein Neuversuch (`mailjet.integration.ts:52-68`). Der Abschluss ändert den Stand nur, wenn `last_attempt_at = started_at` (Migration `:263-267`).
- [x] **Live:** `last_attempt_at` um 1 s vorgestellt, dann `finish_invitation(…, false)` → der Stand blieb `sending` mit dem neueren Zeitstempel.
- [!] NOT VERIFIED: die doppelte Zustellung selbst. Eine Zeitüberschreitung bei Mailjet lässt sich nicht auslösen.

#### EC-5: Entziehen während des Versands → nichts bleibt, danach „bereits entzogen“
- [x] Nach dem Entziehen bleiben weder Versandstand noch Versendung mit Verweis; auch bei der echten Lizenz (siehe AC-12).
- [x] Danach liefert `sendInvitation` für dieselbe ID `{"status":"already_revoked"}`, auch bei der echten Lizenz (Fassung 4).
- [x] **Garantie:** `for key share` (Migration `:132-136`), Kaskade bzw. `set null` (`:17,43`), ein Abschluss ohne Lizenz ändert nichts (`:259`, DB-Test `invitations.test.ts:306`).

#### EC-6: Entziehen und dieselbe Adresse neu zuweisen → neue Einladung, Lizenzgrenze bei null
- [x] Die neue Lizenz-ID löst beim Zuweisen den Versand aus. Er endete mit `provider_limit`, weil die alten Versendungen weiter für den Träger zählen.
- [x] Nach dem Absenken auf 29 liefert `sendInvitation` für die neue Lizenz `failed` statt `license_limit`: Die Grenze pro Lizenz beginnt bei null.

#### EC-7: Trägername mit Sonderzeichen, HTML, Link, sehr lang → reiner Text
- [x] **HTML und Links entschärft:** `<b>fett</b>`, `<img onerror>`, `</p><a href>`, `"'&` erscheinen maskiert. `www.…`, `https://…` und `a@b.de` bekommen U+200B nach `.`, `@`, `:` und `/`. `\r\nBcc:` wird zu einem Leerzeichen.
  - Live-Name „QA5-ACC A <b>fett</b> www.beispiel.de & Co“ gerendert (Abnahme-Prüfer).
  - In der echten Mail stand „QA5-OWN Bildungswerk e.V.“ als Text, nicht als Link (Nutzer).
- [x] Tests `invitation-mail.rules.test.ts` → „Trägername als reiner Text (EC-7)“, ergänzt von `/qa` um sieben Fälle (siehe Unit-Tests).
- [ ] BUG-1 (Low): Unicode-Formatzeichen wie U+202E (RIGHT-TO-LEFT OVERRIDE) bleiben im Namen und drehen die Leserichtung.

#### EC-8: Adresse mit `+`, Bindestrich, Subdomain → geht an genau diese Adresse
- [x] **Echte Mail:** Die eigene Adresse des Nutzers, eingegeben mit Leerzeichen am Rand, Großbuchstaben und `+`-Zusatz, wurde ohne Leerzeichen und kleingeschrieben gespeichert (SQL-Vergleich → `true`) und an genau diese Form mit `+`-Zusatz zugestellt (Nutzer).
- [x] `qa5-acc+tag-x@sub.example.com` wird so gespeichert und gelistet. Die Beginn-Funktion gibt die Adresse unverändert zurück (`:132,204`), sie geht unverändert an `To` (`mailjet.integration.ts:33`, Test `mailjet.integration.test.ts:159`).

#### EC-9: Zugang oder Linkziel nicht eingestellt oder ungültig → App läuft, Versand „Fehlgeschlagen“
- [x] **Schlüssel leer** (Fassung 1): Die App startet, Zuweisen funktioniert, jeder Versand endet `failed`. Der Client bekommt nur `{"status":"failed"}`, im Log steht nur „Mailjet: Einladung nicht versendet (nicht eingestellt)“.
- [x] **Schlüssel ungültig** (Fassung 3): `{"status":"failed"}`, im Log nur „(HTTP 401)“. Kein Schlüssel und keine Adresse im Log (`grep -E "@|qa-invalid-key"` → nur die npm-Kopfzeile).
- [x] **Linkziel ungültig** (Fassung 2): Zuweisen → `{"status":"assigned","invitation":{"status":"failed"}}`, Versandstand `failed`, 0 Versendungen.
  - Mailjet wurde nicht aufgerufen, im Log steht keine „Mailjet …“-Zeile.
  - `platformUrlFrom` lehnt `javascript:`, `data:`, `mailto:`, `ftp:`, relative Pfade, Zugangsdaten und mehr als 2.048 Zeichen ab (`invitation-mail.rules.test.ts`).
- [ ] BUG-4 (Low): Bei ungültigem oder fehlendem Linkziel nennt keine Zeile auf der Server-Konsole die Ursache. Das Design verspricht das.
- [!] NOT VERIFIED zur Laufzeit: fehlendes (statt ungültiges) `LEARNING_PLATFORM_URL`. Das ist derselbe Zweig (`platformUrlFrom(undefined)` → `null`, `invitations.delivery.ts:46-47`), per Test belegt.

#### EC-10: Verbindungsabbruch beim Senden → „Keine Verbindung“, nach Neuladen der echte Stand
- [x] **Code und Test:** `TypeError` → „Keine Verbindung. Bitte versuchen Sie es erneut.“ (`invitations.rules.ts:192-197`, `send-invitation-button.tsx:48-54`, Test `send-invitation-button.test.tsx:136`). Nach dem Neuladen rendert der Server den Stand aus der DB (siehe AC-4).
- [!] NOT VERIFIED: ein echter Verbindungsabbruch. Dafür braucht es einen Browser.

#### EC-11: In anderem Tab abgemeldet oder kein Träger → nichts geht raus
- [x] **Abgemeldet** bzw. mit dem Cookie einer beendeten Sitzung: `x-action-redirect: /login?reason=session`, kein Versuch eingetragen.
- [x] **Ohne Träger** (Mitgliedschaft entfernt): `{"status":"unassigned"}`, für eigene und fremde Lizenz-IDs. Es wird nichts gelesen oder gesendet (`invitations.actions.ts:18-19`).

#### EC-12: Kontingent ausgeschöpft oder überschritten → erneut senden trotzdem möglich
- [x] Bei 5 von 5 und nach `license_quota = 3` (5 von 3) ist `sendInvitation` für eine bestehende Lizenz erlaubt (`failed` nur wegen des abgeschalteten Versands, mit Logzeile).

### Weitere Edge Cases (nicht in der Spec)
- [x] Ungültige Eingaben an `sendInvitation`: keine UUID, `{}`, `[]`, String statt Objekt, `null`, `__proto__`, SQL- und XSS-Reste → jeweils `{"status":"error"}`, nichts geschrieben.
- [x] Die UUID in Großbuchstaben verhält sich wie die kleingeschriebene.
- [x] „Versendet am“ an der Tagesgrenze und beim Wechsel zur Sommerzeit: `2026-10-31T23:30Z` → „01.11.2026“, `2026-03-29T22:30Z` → „30.03.2026“.
- [ ] BUG-2 (Low): Trägername mit Schlusspunkt (siehe AC-2, AC-10).
- [ ] BUG-3 (Low): zugänglicher Name des Knopfs „Einladung senden“ (siehe AC-4).

## Security-Audit

- [x] **Authentication:**
  - `curl -i /licenses` ohne Cookie → 307 `/login?reason=session`.
  - `sendInvitation` ohne Cookie bzw. mit dem Cookie einer abgemeldeten Sitzung → Umleitung, `last_attempt_at` unverändert.
  - Der Wächter steht vor allem anderen (`invitations.actions.ts:18-19`), mit `getUser` (`session.data.ts:32-36`).
  - `deliverInvitation` liegt nicht in einer `'use server'`-Datei (`invitations.delivery.ts:1-5`).
- [x] **Authorization über die App:** Lizenz von B mit der Sitzung von A → `already_revoked`. Doppelt durchgesetzt: RLS-Lesecheck (`invitations.data.ts:38-52`) und Trägerprüfung in der DB-Funktion (Migration `:132-139`).
- [x] **Authorization an der Datenbank:** siehe AC-9. PostgREST mit Token und öffentlichem Schlüssel, SQL-Rollenprobe und Katalog.
- [x] **Input validation:** `z.object({ licenseId: z.uuid() })` (`invitations.schema.ts:8`). SQL-, XSS- und Prototyp-Nutzlasten → `{"status":"error"}`. Untergeschobene `email`, `trainingProviderId` und `to` werden verworfen.
- [x] **Mail-Injection über den Trägernamen:** HTML maskiert, Links entschärft, Zeilenumbrüche entfernt. Betreff und Absender enthalten den Namen nie (siehe EC-7).
  - [ ] BUG-1 (Low): Bidi- und Formatzeichen werden nicht neutralisiert.
- [!] **Rate limiting auf `sendInvitation`:** NOT VERIFIED — nicht implementiert (optional für das MVP). 20 Aufrufe hintereinander → 20 × `failed`, keine Drosselung. Die Versandgrenzen 3/30 sind vorhanden und belegt (AC-7, AC-8). Siehe O-1.
- [!] **Brute force:** NOT VERIFIED — nicht anwendbar. PROJ-3 hat keinen Login, keine Registrierung, kein Passwort-Zurücksetzen und keine eigene Prüfung von Zugangsdaten. `licenseId` ist kein Credential, und fremd sieht aus wie nicht vorhanden.
- [x] **Keine Account-Enumeration** (PROJ-1, als Regression): Falsches Passwort und unbekannte Adresse → beide `{"formError":{"message":"E-Mail-Adresse oder Passwort ist falsch."}}`, 1,02 s bzw. 1,01 s.
- [x] **Keine Zugangsdaten und Adressen in URLs:**
  - Der Sendeknopf ist `type="button"` ohne Formular (`send-invitation-button.tsx:63-69`).
  - Der Zuweisen-Dialog nutzt `<form method="post" … onSubmit>` (`assign-license-dialog.tsx:134`).
  - Im Server-Log stehen alle Actions als `POST /licenses` ohne Query.
  - Die Adresse steht nur im `aria-label`.
- [x] **Keine Geheimnisse im Client-Bundle:**
  - Produktions-Build `s4m-NiRwhtJKLBd1S3Iyt`, `.next/static` (1,2 MB): 0 Treffer für `MAILJET`, `api.mailjet.com`, `INVITATION_SENDER`, `LEARNING_PLATFORM`, `SERVICE_ROLE`, `service_role`, `sb_secret_`, `TURNSTILE_SECRET`, `eyJhbGciOi`, `createAdminClient`, `deliverInvitation`, `beginInvitation`, `license_center_begin_invitation`.
  - Ebenso 0 Treffer in den 30 ausgelieferten Dev-Chunks (Security-Prüferin).
  - `server-only` in `mailjet.integration.ts:3`, `invitations.delivery.ts:1`, `invitations.data.ts:8`.
  - In `src` gibt es nur `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` und `NEXT_PUBLIC_TURNSTILE_SITE_KEY`.
- [x] **Keine Geheimnisse in der Git-Historie:** `git log -p --all` mit Mustern für gesetzte `MAILJET_*_KEY=`, `sb_secret_` und service_role-JWTs → 0 Treffer.
- [x] **Keine sensiblen Daten in Antworten:**
  - `sendInvitation` antwortet nur mit `status` bzw. `availableFrom`, `assignLicense` mit `status` und `invitation.status`.
  - Die RSC-Antwort enthält 0-mal `send_id`, `training_provider_id`, Träger- oder Nutzer-ID, `ErrorMessage`, `MAILJET` oder Daten von B.
- [x] **Keine Teilnehmer-Adressen im App-Protokoll:**
  - Die Server-Logs aller vier Fassungen enthalten nur Zeilen der Form „Mailjet: Einladung nicht versendet (nicht eingestellt | HTTP 401)“.
  - Das einzige „@“ steht in der npm-Kopfzeile, `.next/dev/logs/next-development.log` enthält 0-mal `example.com`.
  - Aus der Mailjet-Antwort gelangen nur Fehlercodes der Form `^[a-z]+-\d{4}$` ins Log (`mailjet.integration.ts:9-11`, Test `:279`).
- [x] **CSRF auf Server Actions:** `sendInvitation` mit gültiger Sitzung und `Origin: https://evil.example` → abgebrochen (500, „x-forwarded-host … does not match origin“). Mit eigenem Origin → 200. Das Cookie ist `HttpOnly; SameSite=lax`.
- [x] **Sicherheitsheader lokal:** `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: origin-when-cross-origin`, HSTS mit `includeSubDomains`.

## Regression

- [x] **Suite-Lauf:** 37 Dateien, 855 Tests bestanden, 0 fehlgeschlagen. Eine E2E-Suite gibt es nicht (`tests/` fehlt), also übersprungen; kein Browser-Runner installiert.
- [x] **Kein Feature ist „Deployed“.** Geprüft wurden deshalb die verwandten Features PROJ-1 und PROJ-2 (beide „Approved“), die Code und Daten mit PROJ-3 teilen.
- [x] **PROJ-2 Lizenzverwaltung**, gegen die laufende App:
  - Zählung und Anzeige (AC-1, AC-3), Liste neueste oben (AC-2)
  - Normalisieren der Adresse und Zuweisen trotz fehlgeschlagener Einladung (AC-4)
  - Ablehnung leerer und ungültiger Adressen (AC-5), Doppelte im eigenen Träger (AC-6)
  - ausgeschöpftes und überschrittenes Kontingent (AC-7, AC-9, EC-4)
  - Entziehen samt Kaskade auf die neuen Tabellen mit der Verwaltersitzung (AC-8, EC-3)
  - Datentrennung (AC-10), Spurlosigkeit (AC-11), Spalten von `licenses` unverändert (AC-12)
  - Konto ohne Träger (EC-7), Adresse als reiner Text (EC-8)
  - Alles bestanden.
- [x] **PROJ-1 Konto & Login:**
  - Registrierung mit 5 Lizenzen (AC-1), Login mit normalisierter Adresse und Kopfzeile (AC-4, EC-4)
  - gleiche Meldung bei falschem Passwort und unbekannter Adresse (AC-5)
  - Umleitungen (AC-9), Abmelden und altes Cookie (AC-10), Lesen nur des eigenen Trägers (AC-11)
  - Kontolöschung räumt auch die neuen Tabellen ab (AC-12)
  - beide Cron-Jobs aktiv, 13 erfolgreiche Läufe in der letzten Stunde (AC-13)
  - Meldung ohne Träger (EC-5), Zählbeginn der Sperre (EC-7)
  - Alles bestanden.
- [x] **Gemeinsame Bauteile** im HTML:
  - Kopfzeile mit „Lizenzzentrale“, Trägername und „Abmelden“
  - Formulare auf `/login` und `/register` mit `method="post"`
  - Tabelle mit „E-Mail-Adresse | Zugewiesen am | Einladung | Aktion“ und Karten mit „Einladung:“
- [!] NOT VERIFIED: die PROJ-1- und PROJ-2-Kriterien, die PROJ-3 nicht berührt (Diff: `account/*`, `proxy` und die Migrationen von PROJ-1 und PROJ-2 sind unverändert). Belegt durch den Suite-Lauf; das Budget der gemeinsamen Login-Bremse erlaubte nicht mehr.

## Unit-Tests (`/qa`, Step 6)

- **Bewertet:** Alle Module von PROJ-3 haben schon Tests neben sich (Regeln 31, Mail 22, Mailjet 14, Daten 11, Versand 10, Actions 9, Knopf 10, Badge 8, Schema 3 Testblöcke).
  - Grenzfälle sind dort abgedeckt: genau 2 Minuten, unlesbarer Zeitpunkt, Sommerzeit, Aufrunden, HTML-Maskierung, Linkziel nach dem Normalisieren, Fehlercodes im Log, unlesbares `available_from`.
- **Ergänzt** in `src/features/invitations/invitation-mail.rules.test.ts`: sieben Fälle zur Regel „Steuerzeichen sowie Zeilen- und Absatztrenner im Trägernamen werden zu einem Leerzeichen“ (Design-Abweichung 2). Getestet war bisher nur `\r\n`.
  - Neu: U+2028, U+2029, NEL (U+0085), Tabulator, Seitenvorschub, NUL und mehrere hintereinander.
  - Geprüft wird jeweils: 7 Absätze, der Name an allen 5 Stellen als „Institut Nord“, keines der Zeichen in Text- oder HTML-Fassung.
- **Lauf der Datei:** `npx vitest run src/features/invitations/invitation-mail.rules.test.ts` → 44 bestanden.
- **Rotprobe** (einmal für die Datei): Die Regel in `invitation-mail.rules.ts:65` wurde vorübergehend auf `[\r\n]+` zurückgesetzt. Alle 7 neuen Fälle wurden rot, der bestehende `\r\n`-Fall blieb grün. Danach `git checkout` der Quelldatei (`git diff` leer), wieder 44 bestanden.
- Für BUG-1 bis BUG-4 hat `/qa` keine Tests geschrieben; sie wären heute rot. Die Tests dazu kommen mit dem Fix in `/build`.

## E2E-Tests
_Optionale Ebene, geschrieben von `/e2e-tests`, nur für kritische Kernabläufe._

- Status: **nicht gelaufen** (`/e2e-tests` für kritische Abläufe ausführen)

## `[user]`-Aufgaben

- [x] **T1, T2, T4, T6** (Mailjet-Konto, bestätigter Absender, Schlüssel, echte Werte in `.env.local`): Mit den echten Werten hat Mailjet zwei Einladungen angenommen, und sie kamen an (Fassung 4). Ein unbestätigter Absender hätte 403 `send-0008` ergeben.
- [x] **T3** (Tracking im Konto aus): Die angekommene Mail hat keinen umgeleiteten Link und kein Bild (Nutzer). Die App schaltet die Verfolgung zusätzlich pro Mail ab. Die Konto-Einstellung selbst ist im Dashboard nicht eingesehen.
- [!] **T5** (Platzhalter in `.env.local.example`): NOT VERIFIED. Die Datei ist für den Agenten gesperrt; der Nutzer hat die Aufgabe abgehakt.
- [!] **T21–T24** (Löschregel und Auftragsverarbeitungsvertrag bei Mailjet, eigene Absender-Domain, Linkziel der Plattform): NOT VERIFIED — go-live, wird in `/deploy` gemacht und geprüft. Das Test-Gegenstück ist geprüft: kostenloses Konto, eigener bestätigter Absender, eigene Empfänger, selbst gewähltes Linkziel. Keine dieser Aufgaben liegt auf einem Credential-Pfad.

## Nicht geprüft in diesem Lauf

- [!] **Browser-Verhalten:** sichtbare Toasts (Erfolg, Warnung, Fehler, mit Zusatzzeile), Sperre und Drehsymbol am Knopf, das Einspielen des neu gerenderten Baums (AC-1, AC-3, AC-5, EC-1). Grund: kein Browser; belegt durch die Komponententests im Suite-Lauf.
- [!] **Responsive Darstellung bei 375/768/1440 px**, Karten ohne seitliches Scrollen, Tippflächen von 44 px (AC-4). Grund: kein Viewport.
- [!] **Cross-Browser** (Chrome, Firefox, Safari, Edge). Grund: keine Browser-Engine.
- [!] **Echter Verbindungsabbruch** (EC-10), **Zeitüberschreitung bei Mailjet und doppelte Zustellung** (AC-3, EC-4). Grund: nicht auslösbar; belegt durch Garantie, Code und Tests.
- [!] **Fehlendes `LEARNING_PLATFORM_URL` zur Laufzeit** (EC-9). Grund: derselbe Zweig wie das geprüfte ungültige Linkziel, per Test belegt.
- [!] **Migration als Round-Trip.** Grund: Strategie `single`, kein lokales Supabase. Stattdessen Migrationsliste und Live-Schema geprüft.
- [!] **Postgres- und PostgREST-Protokoll von Supabase** auf Teilnehmer-Adressen (Technische Anforderungen, PROJ-2 O-1). Grund: von hier nicht einsehbar. Im Code bekommen die Funktionen nur IDs per POST, und keine schreibt eine Zeile mit Adresse (Migration `:195-202`).
- [!] **Rate limiting auf `sendInvitation`.** Grund: nicht implementiert (optional für das MVP).
- [!] **Brute force.** Grund: PROJ-3 hat keinen Credential-Pfad.
- [!] **Sicherheitsheader gegen eine Live-URL.** Grund: Es gibt kein Deployment.
- [!] **T5** (Datei für den Agenten gesperrt) und **T21–T24** (go-live, `/deploy`).
- [!] **PROJ-1/PROJ-2-Kriterien, die PROJ-3 nicht berührt** (siehe Regression).

## Bugs

#### BUG-1: Bidi- und Formatzeichen im Trägernamen gelangen unverändert in die Einladung
- **Severity:** Low
- **Status:** Deferred (Entscheidung des Nutzers, 2026-11-01)
- **Class:** Unicode-Format- und Bidi-Steuerzeichen (`\p{Cf}`, z. B. U+202E, U+2066–U+2069) in Nutzertext werden vor der Ausgabe in ausgehende Inhalte nicht neutralisiert.
  - EC-7 verlangt den Namen „als reiner Text, ohne Formatierung“; eine Richtungsumkehr ist Formatierung.
  - Der Name bleibt dabei unanklickbar und steht weder im Betreff noch im Absender. Die Wirkung ist eine verdrehte Anzeige im Mailtext, die der Verwalter selbst steuert.
- **Sweep:** `grep -rnE 'p\{Cf\}|u202[A-Ea-e]|u206[6-9]' src --include='*.ts' --include='*.tsx' | grep -v '\.test\.'` → 0 Treffer, es fehlt also überall. Die einzige Stelle, an der freier Nutzertext in ausgehende Inhalte gelangt, ist `plainName` in `src/features/invitations/invitation-mail.rules.ts:63-67`; sie ersetzt nur `\p{Cc}\p{Zl}\p{Zp}`.
- **Steps to Reproduce:**
  1. Einen Träger registrieren, dessen Name U+202E (RIGHT-TO-LEFT OVERRIDE) enthält, z. B. „Bank“ + U+202E + „moc.live“ + U+202C. Die Namensregel prüft nur 2–100 Zeichen (`account.schema.ts:59-64`, `proj1_training_providers.sql:20-21`).
  2. Eine Lizenz zuweisen.
  3. Erwartet: Der Name steht als reiner Text in der Mail.
  4. Tatsächlich: U+202E steht unverändert in Text- und HTML-Fassung (`buildInvitationMail`, per Skript geprüft), Mailprogramme zeigen den Rest des Namens gespiegelt.

#### BUG-2: Trägername mit Schlusspunkt ergibt zwei Punkte am Satzende
- **Severity:** Low
- **Status:** Open (Entscheidung des Nutzers, 2026-11-01: jetzt beheben)
- **Class:** Platzhalter am Satzende ohne Behandlung eines Schlusspunkts, den der eingesetzte Wert schon mitbringt.
- **Sweep:** `grep -n '\${name}\.' src/features/invitations/invitation-mail.rules.ts` → 2 Treffer: `:48` („Bei Fragen wenden Sie sich an ${name}.“) und `:51` (Ende des Datenschutzhinweises).
- **Steps to Reproduce:**
  1. Einen Träger „QA5-OWN Bildungswerk e.V.“ registrieren und eine Lizenz an eine eigene Adresse zuweisen.
  2. Erwartet: „Bei Fragen wenden Sie sich an QA5-OWN Bildungswerk e.V.“
  3. Tatsächlich: „… an QA5-OWN Bildungswerk e.V..“, ebenso am Ende des Datenschutzhinweises. Vom Nutzer in der echten Mail bestätigt (2026-11-01).

#### BUG-3: Zugänglicher Name „Einladung an <Adresse> senden“ enthält den sichtbaren Text nicht
- **Severity:** Low
- **Status:** Deferred (Entscheidung des Nutzers, 2026-11-01)
- **Class:** Ein zugänglicher Name, der den sichtbaren Text nicht zusammenhängend enthält (WCAG 2.5.3 „Label in Name“). Wer per Sprachsteuerung „Einladung senden“ sagt, trifft den Knopf eventuell nicht. „Erneut senden“ und „Entziehen“ sind im jeweiligen Namen enthalten und damit unkritisch.
  - Der Text stammt so aus dem Design; `/build` hat ihn in `design.md` → Hinweise für `/qa` zur Entscheidung vorgelegt.
- **Sweep:** `grep -rn 'aria-label={' src/features src/components | grep -v '\.test\.' | grep -v components/ui` → 3 Treffer, 1 betroffen: `send-invitation-button.tsx:66` mit `sendButtonAccessibleLabel` (`invitations.rules.ts:157-158`). Erlaubt: `revoke-license-dialog.tsx:82` („Lizenz von … entziehen“ enthält „entziehen“), `quota-summary.tsx:32` (Fortschrittsbalken ohne sichtbaren Knopftext).
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
- **Sweep:** `grep -n "platformUrl !== null\|console\." src/features/invitations/invitations.delivery.ts` → 2 Treffer: `:47` (Prüfung ohne `else`-Zweig) und `:70` (nur die Zeile für unerwartete Fehler). Keine weitere Einstellung wird beim Senden ohne Logzeile geprüft.
- **Steps to Reproduce:**
  1. `MAILJET_API_KEY= MAILJET_SECRET_KEY= LEARNING_PLATFORM_URL='javascript:alert(1)' npm run dev`
  2. Eine Lizenz zuweisen → `{"status":"assigned","invitation":{"status":"failed"}}`.
  3. Erwartet: eine Zeile auf der Konsole, die das ungültige Linkziel nennt (ohne Wert).
  4. Tatsächlich: keine Zeile, nur die Request-Zeilen von Next.js.

## Beobachtungen (kein Bug, zur Kenntnis)

- **O-1, Fehlversuche ungebremst:** Fehlgeschlagene Versuche zählen für keine Grenze (Spec-Entscheidung), und `sendInvitation` hat keine eigene Drossel.
  - Lehnt Mailjet ab (401/403) oder antwortet nicht in 10 s, geht jeder Klick ungebremst als API-Aufruf an Mailjet.
  - Antwortet Mailjet zu spät, nimmt aber an (EC-4), gehen Mails hinaus, die nicht zählen.
  - Das ist durch Spec und Design so gewollt; als Risiko vor dem Live-Gang notiert.
- **O-2, Turnstile mit Testschlüsseln (PROJ-1, Umgebung):** Die lokale Umgebung nutzt Cloudflares „always pass“-Schlüssel (`1x0000…`), der Dummy-Token wird angenommen. Damit bremst nur die IP-Registrierungsbremse neue Träger, und jeder neue Träger darf 30 Einladungen am Tag senden. Für den lokalen Prüfbetrieb vertretbar; echte Schlüssel sind Teil der go-live-Aufgaben von PROJ-1.
- **O-3, Bremszeilen aus dem Suite-Lauf:** Die Datenbanktests lassen wie in PROJ-2 (O-7) ihre Login- und Registrierungsversuche liegen (`lizenzzentrale-test-*@example.com`, IPs `2001:db8:*`). Der 24-Stunden-Job löscht sie. Nur Test-Hygiene.
- **O-4, Zeitpunkt „ab“ mit laufender Reservierung:** Ist die älteste gezählte Versendung eine laufende `pending`, nennt `available_from` deren Start plus 24 h. Scheitert dieser Versuch, wäre die Grenze früher frei. Der genannte Zeitpunkt ist nie zu früh, höchstens zu spät.
- **O-5, Abschluss scheitert nach Annahme:** Dann zählt die Mail für keine Grenze. Das nimmt das Design in Kauf; von außen ist es nicht auslösbar.
- **O-6, Hinweis bei frischem Besuch (PROJ-1, nicht geprüft):** Anonym leitet `/licenses` auf `/login?reason=session` um, vermutlich mit „Bitte melden Sie sich erneut an.“, obwohl nie eine Sitzung bestand. Das ist kein Verhalten aus dem PROJ-3-Diff; den Text hat niemand abgerufen.
- **O-7, Aufbewahrung bei Mailjet:** Mailjet legt jeden Empfänger als Kontakt an und löscht nicht von selbst. Der Datenschutzhinweis (AC-10) sagt nur, was die Lizenzzentrale speichert. Die Löschregel ist T21 (go-live) und eine offene Frage in `spec.md`.

## Zusammenfassung
- **Akzeptanzkriterien:** 12 von 12 erfüllt, alle gegen die laufende App ausgeübt; AC-1, AC-2, AC-5, AC-10 und AC-11 zusätzlich mit echter Mail, die der Nutzer abgenommen hat.
  - An AC-2 und AC-10 hängt der kosmetische BUG-2, an AC-4 BUG-3.
  - Nicht geprüft: die Browser-Teile von AC-1, AC-3, AC-4 und AC-5.
- **Edge Cases:** 11 von 12 ohne Befund. An EC-7 hängt BUG-1 (Low), an EC-9 BUG-4 (Low).
  - Nicht geprüft: die Laufzeit-Teile von EC-4 und EC-10 und das fehlende Linkziel bei EC-9.
- **Bugs:** 4 insgesamt (0 Critical, 0 High, 0 Medium, 4 Low). Open: 1 (BUG-2, auf Wunsch des Nutzers jetzt zu beheben), Deferred: 3 (BUG-1, BUG-3, BUG-4).
- **Security:** 13 von 17 Prüfpunkten geprüft, davon einer mit Low-Bug (BUG-1). 4 sind NOT VERIFIED: Rate limiting (nicht implementiert), Brute Force (nicht anwendbar), Supabase-Protokolle (nicht einsehbar), Header gegen eine Live-URL (kein Deployment).
- **Regression:** PROJ-1 und PROJ-2 ohne Regression, Suite 855/855.
- **Production Ready:** JA. Es gibt keinen Critical- oder High-Bug, und alle Akzeptanzkriterien wurden gegen die laufende App ausgeübt, die Einladung auch als echte Mail.
- **Status:** bleibt **In Review**, weil BUG-2 offen ist.
- **Empfehlung:** BUG-2 mit `/build PROJ-3` beheben, nach seiner Klasse, also an beiden Stellen aus dem Sweep. Danach `/qa` als Nachprüfung in der Breite der Diff. BUG-1, BUG-3 und BUG-4 später gesammelt mit `/build PROJ-3 deferred`.

> „Production Ready: JA“ heißt *keine Critical/High-Bugs*. Es heißt **nicht**, dass alles geprüft wurde. Die Punkte unter „Nicht geprüft in diesem Lauf“ sind offen und brauchen einen Menschen oder `/e2e-tests`.
