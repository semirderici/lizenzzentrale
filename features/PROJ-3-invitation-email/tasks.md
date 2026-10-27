# PROJ-3 Aufgaben: Einladungs-E-Mail

> Erstellt von `/tasks` aus `spec.md` und `design.md`. Das ist der geordnete, nachvollziehbare Bauplan, die Brücke zwischen dem Vertrag (WAS) und dem Bauen (WIE).
> `[P]` = parallel ausführbar: Die Dateien der Aufgabe überschneiden sich mit keiner anderen `[P]`-Aufgabe derselben Stufe. `/build` kann sie deshalb einem eigenen Subagenten geben.
> Die Stufen laufen **nacheinander**, jede ist eine Schranke. Aufgaben **innerhalb** einer Stufe laufen parallel, wo `[P]` steht. Jede Aufgabe nennt die AC-IDs aus `spec.md`, die sie erfüllt. Das ist die Kette AC → Task → Test.
> `[user]` = eine Einstellung, die nur der Nutzer machen kann, im Dashboard eines Anbieters oder in seiner eigenen Umgebungsdatei. Sie hat `where:` statt `files:`, ist nie `[P]` und wird vom Nutzer abgehakt. `/build` übergibt sie, `/deploy` liefert nicht aus, solange eine offen ist.
> `[user go-live]` = dasselbe, braucht aber die Produktions-URL oder den Host. Vor `/deploy` kann sie niemand machen, deshalb blockiert sie weder `/qa` noch „Approved“. `/deploy` macht sie in Schritt 2 und hakt sie in Schritt 4 ab, sobald sie nachweislich wirkt. Das Test-Gegenstück steht in design.md → Einstellungen durch den Nutzer: ein kostenloses Mailjet-Konto mit bestätigter eigener Absenderadresse, eigene Empfänger und ein selbst gewähltes Linkziel (T1–T6).
> Zuständig: `/tasks` legt diese Datei an, `/build` hakt die Kästchen ab. Ausnahme sind die `[user]`-Aufgaben, die hakt der Nutzer ab.
> Kein Statusfeld: Die abgehakten Kästchen unten sind der Fortschritt dieser Datei. Der Status des Features steht NUR in `features/INDEX.md`.

## Stufe 1 — Mailjet-Zugang und Datenbank

<!-- T1–T6 braucht erst der Probeversand am Ende von Stufe 2. /build übergibt sie schon hier, damit der Nutzer sie erledigen kann, während die Datenbank entsteht.
     T7 ohne [P]: `supabase db push` und die Datenbanktests brauchen die verbundene CLI und `.env.local`, beides gibt es nur im Hauptverzeichnis, nicht in einer Arbeitskopie.
     Die Zeile „Migration einspielen“ aus design.md → Einstellungen durch den Nutzer ist keine [user]-Aufgabe: Die Migration liegt im Repository, und /build spielt sie wie in PROJ-1 und PROJ-2 selbst ein (T7). -->

- [x] T1 [user]  Mailjet-Konto anlegen  · where: [mailjet.com](https://www.mailjet.com) → Sign up, Tarif „Free“, ohne Kreditkarte  · → AC-1
- [x] T2 [user]  Absenderadresse bestätigen  · where: Mailjet → Account settings → Senders & domains → Add a sender address, dann den Link in der Bestätigungsmail öffnen. Eine eigene Adresse, am besten von einer eigenen Domain. Gmail geht, die Einladungen landen damit aber eher im Spam. **Keine** Adresse von Yahoo, AOL oder anderen Anbietern mit strenger DMARC-Regel.  · → AC-2
- [x] T3 [user]  Tracking im Konto aus  · where: Mailjet → Account settings → Tracking-Einstellungen → Öffnungs- und Klickverfolgung **aus** (zweite Linie, die App schaltet beides pro Mail ohnehin ab)  · → AC-11
- [x] T4 [user]  Schlüssel erzeugen  · where: Mailjet → Account settings → REST API → API key management → API-Key und Secret-Key des Hauptschlüssels  · → AC-1
- [x] T5 [user]  Platzhalter der neuen Variablen dokumentieren  · where: `.env.local.example` (der Agent darf die Datei nicht bearbeiten) → `MAILJET_API_KEY=your-mailjet-api-key`, `MAILJET_SECRET_KEY=your-mailjet-secret-key`, `INVITATION_SENDER_EMAIL=you@example.org`, `LEARNING_PLATFORM_URL=https://lernplattform.example.org`  · → EC-9
- [x] T6 [user]  Echte Werte eintragen  · where: `.env.local` → `MAILJET_API_KEY` und `MAILJET_SECRET_KEY` aus T4, `INVITATION_SENDER_EMAIL` = die bestätigte Adresse aus T2, `LEARNING_PLATFORM_URL` = eine selbst gewählte Adresse mit `https:` (bis zum Live-Gang, `spec.md` → Offene Fragen). Alle nur für den Server, keine mit `NEXT_PUBLIC_`. Danach `npm run dev` neu starten.  · → AC-1, AC-2
- [x] T7  Migration Versandstand und Versandgrenze mit Datenbanktests  · files: supabase/migrations/20261026150000_proj3_license_invitations.sql, src/test/db/invitations.test.ts  · → AC-6, AC-7, AC-8, AC-9, AC-12, EC-1, EC-2, EC-3, EC-4, EC-5, EC-6, EC-8, EC-12
  - Migration (Details: design.md → Datenmodell, Datenbankfunktionen, Aufräumjob, Zugriffsregeln in der Datenbank):
    - `public.license_invitations` mit genau vier Spalten: `license_id` (Primärschlüssel, Löschkaskade zu `licenses`), `training_provider_id` (Pflicht, Löschkaskade zu `training_providers`, ein Index), `status` (`sending` / `sent` / `failed`), `last_attempt_at` (Pflicht, setzt die Datenbank).
    - Rechte nach der Regel aus PROJ-1: erst alle entziehen, dann für `authenticated` nur Lesen. Keine Rechte für `anon`. RLS ausdrücklich einschalten. Eine Leseregel für `authenticated`, gleich gebaut wie die von `licenses` (Mitgliedschaft mit der Rolle `admin`, Konto-ID einmal pro Abfrage ausgewertet).
    - `private.license_center_invitation_sends`: `id` (fortlaufend, Primärschlüssel), `training_provider_id` (Pflicht, Löschkaskade), `license_id` (leer erlaubt, beim Löschen der Lizenz **auf leer gesetzt**), `outcome` (`pending` / `sent`), `started_at` (Standard jetzt). Keine Adresse, kein Inhalt, keine IP. Drei Indizes: Träger und Zeit, Lizenz, Zeit. RLS an, keine Rechte für die Rollen der App.
    - `public.license_center_begin_invitation(Träger-ID, Lizenz-ID)`: security definer, leerer Suchpfad, eine Transaktion. Reihenfolge: Transaktionssperre auf den Träger (Schlüssel aus `license_invitations:` und der Träger-ID), Lizenz mit dieser ID **und** dieser Träger-ID (`license_not_found`), läuft schon (`already_sending`), Grenze der Lizenz (`license_limit` mit `available_from`), Grenze des Trägers (`provider_limit` mit `available_from`), dann reservieren (`allowed` mit `send_id` und `email`). Bei einer Ablehnung ändert sich nichts. Die Funktion bricht nur bei fehlenden Parametern ab, und kein Fehlertext enthält eine Adresse. Details: design.md → Datenbankfunktion `license_center_begin_invitation`.
    - `public.license_center_finish_invitation(Versand-ID, angenommen ja/nein)`: security definer, leerer Suchpfad. Nur eine `pending`-Versendung wird abgeschlossen: angenommen → `sent`, sonst gelöscht. Den Versandstand ändert sie nur, wenn er noch `sending` ist und `last_attempt_at` gleich `started_at` der Versendung.
    - Ausführen beider Funktionen für `public`, `anon` und `authenticated` entziehen, für `service_role` erlauben.
    - `private.license_center_invitation_cleanup` löscht Versendungen mit `started_at` älter als 24 Stunden. Ausführen nur für den Eigentümer. Der `pg_cron`-Job `license-center-invitation-cleanup` läuft alle 5 Minuten. Den Job `license-center-cleanup` aus PROJ-1 nicht anfassen.
    - `/build` spielt die Migration per `supabase db push` in das gehostete Projekt ein (Strategie `single`).
  - Tests am gehosteten Projekt, mit dem Testgerüst aus PROJ-1 (`src/test/supabase.ts`). Jeder Test legt eigene Testkonten an und räumt sie weg. Die Tests verschicken keine Mail. Teilnehmer-Adressen deshalb nur aus `example.com`, wie in PROJ-2. Geprüft wird:
    - **Rechte (AC-9):** Mit dem Token von A liest A nur Versandstände von A. Anlegen, Ändern und Löschen in `license_invitations` werden abgelehnt. Beide Funktionen sind mit dem Token von A und mit dem öffentlichen Schlüssel nicht aufrufbar. `anon` bekommt keine Zeilen.
    - **Beginn** (per `service_role`): Eine Lizenz von B mit der Träger-ID von A und eine unbekannte ID enden beide mit `license_not_found`. `allowed` liefert die Adresse genau so, wie sie gespeichert ist, auch mit `+` und Subdomain (EC-8). Ein zweiter Beginn, während der erste weniger als 2 Minuten läuft, endet mit `already_sending`, der Stand bleibt (EC-1). Mit `last_attempt_at` per `service_role` 3 Minuten zurückdatiert ist ein neuer Beginn erlaubt (EC-3).
    - **Grenze der Lizenz (AC-7):** dreimal Beginn und Abschluss „angenommen“, der vierte Beginn endet mit `license_limit`, und `available_from` ist die älteste dieser Versendungen plus 24 Stunden. Abschlüsse mit „nicht angenommen“ zählen nicht.
    - **Grenze des Trägers (AC-8, EC-6):** Kontingent per `service_role` heben, 30 angenommene Versendungen über mehrere Lizenzen verteilt (höchstens 3 pro Lizenz). Der nächste Beginn endet mit `provider_limit` und dem passenden `available_from`. Bei einer neuen Lizenz entsteht dabei kein Versandstand. Versendungen entzogener Lizenzen zählen weiter. Eine neue Lizenz mit derselben Adresse beginnt bei der Grenze der Lizenz bei null.
    - **Kontingent (EC-12):** Ist das Kontingent ausgeschöpft oder unter die Zahl der Lizenzen gesenkt, ist ein Beginn trotzdem erlaubt.
    - **Gleichzeitig:** Zwei gleichzeitige Beginn-Aufrufe für dieselbe Lizenz ergeben genau ein `allowed` (EC-1). Bei 29 angenommenen Versendungen ergeben zwei gleichzeitige Aufrufe für verschiedene Lizenzen genau ein `allowed`, der andere endet mit `provider_limit` (EC-2).
    - **Abschluss:** „angenommen“ setzt den Versandstand auf `sent`, „nicht angenommen“ auf `failed`. Der späte Abschluss eines älteren Versuchs überschreibt den Stand eines neueren nicht (EC-3, EC-4). Ein Abschluss nach dem Entziehen läuft ohne Fehler und ändert nichts (EC-5).
    - **Löschen (AC-12, EC-5):** A entzieht eine Lizenz mit eigenem Token, und ihr Versandstand ist weg, obwohl `authenticated` kein Recht auf die Tabelle hat. Wird das Konto von A gelöscht, sind auch dessen Versandstände weg, die von B bleiben.
    - **Felder (AC-12):** Eine Zeile in `license_invitations` hat genau die vier Spalten.
    - **Einbetten (für T13):** Mit dem Token von A liefert `licenses` mit `license_invitations(status, last_attempt_at)` pro Lizenz ein Objekt oder nichts, nie ein Objekt von B.
    - Kein Fehlertext enthält eine Teilnehmer-Adresse (PROJ-2 QA, O-1).
  - Was die Daten-API nicht erreicht (Schema `private`), prüft `/build` per SQL am gehosteten Projekt (`supabase db query --linked`, wie bei der QA von PROJ-2) und schreibt das Ergebnis in die Commit-Nachricht: Der Verweis auf die Lizenz wird beim Entziehen geleert. Eine `pending`-Versendung, die 2 Minuten alt ist, zählt nicht mehr. Zurückdatierte Versendungen fallen nach 24 Stunden aus dem Fenster. Die Aufräumfunktion löscht Zeilen älter als 24 Stunden, und der Job ist mit `*/5 * * * *` eingetragen.

## Stufe 2 — Bausteine

<!-- Bausteine ohne Abhängigkeit untereinander. Alle Dateisätze sind disjunkt, deshalb sind alle Aufgaben [P].
     Am Ende der Stufe der Probeversand (siehe unten). Er braucht T1–T6 und läuft im Hauptverzeichnis, weil nur dort `.env.local` liegt. -->

- [ ] T8 [P]  Regeln und Eingaberegel  · files: src/features/invitations/invitations.rules.ts, src/features/invitations/invitations.rules.test.ts, src/features/invitations/invitations.schema.ts, src/features/invitations/invitations.schema.test.ts  · → AC-1, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9, EC-1, EC-3, EC-5, EC-9, EC-10, EC-11
  - Regeln (pure):
    - Alle Texte aus design.md → Meldungstexte außer der Mail, dazu die Screenreader-Texte der Knöpfe mit der Adresse. „Keine Verbindung“ und „nicht zugeordnet“ kommen aus `src/features/account/account.rules.ts`.
    - Die zwei Texte von PROJ-2 („Diese Lizenz wurde bereits entzogen.“ und „Das hat nicht geklappt. Bitte versuchen Sie es erneut.“) sind eigene Konstanten. `invitations.rules.ts` importiert `licenses.rules.ts` nie, sonst entstünde ein Kreis. Ein Test vergleicht beide Texte mit denen aus `licenses.rules.ts`.
    - Typen, auf die die späteren Stufen bauen:
      - Versandstand: Zustand und letzter Versuch, oder keiner.
      - Versandausgang: versendet, fehlgeschlagen, nicht gefunden, läuft schon, Grenze der Lizenz mit Zeitpunkt, Grenze des Trägers mit Zeitpunkt.
      - Ergebnis von `sendInvitation`: jeder Versandausgang, dazu „bereits entzogen“, „nicht zugeordnet“ und „Fehler“.
    - Anzeigezustand aus (Versandstand oder keiner, jetzt) nach der Tabelle in design.md → Versandstand in der Liste, mit der Aktion daneben. Grenzfall: `sending` genau 2 Minuten alt ist „Fehlgeschlagen“, 1 Minute 59 ist „Wird versendet“.
    - „Versendet am TT.MM.JJJJ“ in Europe/Berlin. Test: 23:30 Uhr UTC am 31.12. ergibt den 01.01. des Folgejahres.
    - „TT.MM.JJJJ, HH:MM Uhr“ in Europe/Berlin, aufgerundet auf die nächste volle Minute. Tests: eine volle Minute bleibt, eine Millisekunde danach ergibt die nächste Minute, 23:59:30 ergibt 00:00 des Folgetags, Sommer- und Winterzeit.
    - Ergebnis von `sendInvitation` → Rückmeldung (Erfolg oder Fehler mit Text), für alle Zeilen „Senden“ in design.md → Darstellung der Ergebnisse.
    - Versandausgang beim Zuweisen → Zusatztext und Art: versendet → Erfolg mit „Die Einladung ist versendet.“. Grenze des Trägers → Warnung mit der Begründung aus AC-8 und dem Zeitpunkt. Jeder andere Ausgang → Warnung mit dem Text aus AC-3.
  - Schema (pure): Eingabe von „Senden“ ist nur die Lizenz-ID, Pflicht, UUID. Mitgeschickte Felder wie Adresse oder Träger werden verworfen (Test, AC-9).
- [ ] T9 [P]  Inhalt der Einladung  · files: src/features/invitations/invitation-mail.rules.ts, src/features/invitations/invitation-mail.rules.test.ts  · → AC-2, AC-10, AC-11, EC-7, EC-9
  - Pure. Baut aus (Trägername, Linkziel) den Betreff, die Textfassung und die HTML-Fassung, Absätze und Reihenfolge wie in design.md → Inhalt der Einladung. Der Datenschutzhinweis aus AC-10 steht wörtlich darin, mit dem Trägernamen an allen drei Stellen.
  - Betreff genau „Ihre Lizenz für den Kurs Geprüfter Technischer Betriebswirt (IHK)“, ohne Trägernamen. Die Empfängeradresse steht nirgends in der Mail.
  - Trägername: In beiden Fassungen steht nach jedem „.“, „@“, „:“ und „/“ ein U+200B. In der HTML-Fassung wird er zusätzlich maskiert (`&`, `<`, `>`, `"`, `'`), steht nie in einem Attribut und darf an jeder Stelle umbrechen.
  - HTML: `lang="de"`, nur Inline-Stile, eine Spalte von höchstens 600 px. Der Knopf „Zur Lernplattform“ ist ein Link direkt auf das Linkziel, mit Radius 8 px und mindestens 44 px hoch. Seine Farben sind feste Werte aus `--primary` und `--primary-foreground` des hellen Themes in `src/app/globals.css`. Darunter der Ersatzlink. Der Datenschutzhinweis steht abgesetzt und klein am Ende. Keine Bilder, keine externen Stylesheets, keine Schriften von außen.
  - Linkziel prüfen: absolut, `https:` oder `http:`, ohne Benutzername und Passwort, höchstens 2.048 Zeichen. Sonst ist es ungültig (EC-9). In der HTML-Fassung wird es für Attribut und Text maskiert.
  - Tests:
    - Betreff und AC-10-Hinweis wörtlich.
    - Trägernamen mit `<script>`, mit `https://evil.example`, mit `a@b.de` und mit 100 Zeichen erscheinen als reiner Text ohne Link (EC-7).
    - Kein `<img`, kein `<link`, kein `src=`. Das einzige `href` ist das Linkziel.
    - `javascript:`, ein relativer Pfad, ein Linkziel mit Zugangsdaten und eines mit 2.049 Zeichen sind ungültig.
- [ ] T10 [P]  Mailjet-Anbindung  · files: src/features/invitations/mailjet.integration.ts, src/features/invitations/mailjet.integration.test.ts  · → AC-2, AC-3, AC-11, EC-8, EC-9
  - `server-only`. `sendMail({ Empfänger, Betreff, Text, HTML })` → „angenommen“ oder „fehlgeschlagen“. Liest `MAILJET_API_KEY`, `MAILJET_SECRET_KEY` und `INVITATION_SENDER_EMAIL` erst beim Aufruf. Fehlt einer oder ist er leer → „fehlgeschlagen“ ohne Anfrage.
  - POST an `https://api.mailjet.com/v3.1/send`, HTTP Basic mit Schlüssel und Secret, genau eine Nachricht:
    - Absender: die Adresse `INVITATION_SENDER_EMAIL`, Name fest „Lizenzzentrale“
    - Empfänger: genau einer, nur die Adresse, unverändert (EC-8)
    - Betreff, `TextPart`, `HTMLPart`
    - `TrackOpens` und `TrackClicks` = `disabled`
    - nicht gesetzt: `ReplyTo`, `CustomID`, `CustomCampaign`, `EventPayload`, `URLTags`, Kopien, Anhänge, Vorlagen
  - Abbruch nach 10 Sekunden per `AbortSignal`, kein Wiederholen. „Angenommen“ heißt HTTP 200 **und** die eine Nachricht hat den Status `success`. Alles andere ist „fehlgeschlagen“: 401, 403 mit `send-0008`, Status `error`, Abbruch, Netzwerkfehler, unlesbare Antwort.
  - Bei „fehlgeschlagen“ eine Zeile auf der Server-Konsole: HTTP-Status bzw. „Zeitüberschreitung“ oder „nicht eingestellt“, dazu die `ErrorCode`s. Nie Schlüssel, Adresse, `ErrorMessage` oder Rumpf.
  - Die Tests bilden `fetch` nach. Sie prüfen den Rumpf als exaktes Objekt und den Anmeldekopf, mit Fake-Timern die Zeitgrenze, und jeden Fehlerfall. Die Konsolenzeile enthält weder Adresse noch Schlüssel noch `ErrorMessage`. Eine Adresse mit `+` geht unverändert hinaus.
- [ ] T11 [P]  Datenzugriff auf den Versand  · files: src/features/invitations/invitations.data.ts, src/features/invitations/invitations.data.test.ts  · → AC-7, AC-8, AC-9, EC-1, EC-2, EC-5
  - `server-only`.
  - `isLicenseVisible(Träger-ID, Lizenz-ID)` mit dem Server-Client `src/lib/supabase/server.ts` (Sitzung, RLS): eine Abfrage nach ID **und** Träger-ID, nur die ID. Ergebnis: sichtbar, nicht sichtbar oder Fehler.
  - `beginInvitation(Träger-ID, Lizenz-ID)` und `finishInvitation(Versand-ID, angenommen)` rufen die beiden Funktionen aus T7 mit dem Admin-Client `src/lib/supabase/admin.ts` auf. Die Antworten werden in feste Ergebnisse übersetzt: erlaubt mit Versand-ID und Adresse, nicht gefunden, läuft schon, Grenze der Lizenz mit Zeitpunkt, Grenze des Trägers mit Zeitpunkt. Ein Fehler, keine Antwort oder eine unbekannte Antwort ergibt „Fehler“.
  - Sonst nutzt das Modul den Admin-Client für nichts. Nie wird nach einer Adresse gefiltert, nie eine Adresse protokolliert oder in einen Fehler geschrieben.
  - Der Test bildet beide Clients nach und prüft Parameter, Filter und die Übersetzung jeder Antwort. Das echte Verhalten der Datenbank deckt T7 ab.

**Probeversand am Ende von Stufe 2** (Haupt-Agent, im Hauptverzeichnis, braucht T1–T6): eine echte Einladung mit dem Inhalt aus T9, über T10, an eine eigene Adresse, die der Nutzer im Chat nennt. Die Adresse landet in keiner Datei, das Skript liegt im Scratchpad und wird nicht eingecheckt. Prüfen:
- Absender „Lizenzzentrale“, keine Antwortadresse, kein Bild, Links direkt auf das Linkziel.
- **Kein Mailjet-Logo und kein Werbetext.** Fügt Mailjet etwas ein, hält `/build` hier an und meldet es: Dann ist AC-11 mit dem kostenlosen Mailjet nicht erfüllbar, und das Design geht zurück zu `/architecture` (design.md → Offene Fragen).
- Ob Mailjet ein neues Konto erst freischalten muss, bevor es an fremde Adressen versendet. Falls ja, kommt der Schritt in die README (T20).

## Stufe 3 — Versand, Anzeige und Rückmeldung

<!-- Braucht die Bausteine aus Stufe 2. Alle Dateisätze sind disjunkt, deshalb sind alle Aufgaben [P].
     T15 ändert `AssignResult`, die Action dazu folgt in T17 (Stufe 4), weil sie `deliverInvitation` aus T12 braucht. Zwischen den beiden Stufen meldet `npm run typecheck` deshalb das fehlende Feld in `licenses.actions.ts`. `npm test` an der Schranke bleibt grün, und nach Stufe 4 passt der Typ wieder. -->

- [ ] T12 [P]  Versand einer Einladung  · files: src/features/invitations/invitations.delivery.ts, src/features/invitations/invitations.delivery.test.ts  · → AC-1, AC-3, AC-5, AC-7, AC-8, EC-1, EC-3, EC-4, EC-5, EC-8, EC-9
  - `server-only`, **keine** `'use server'`-Datei: Jeder Export dort wäre vom Browser aus aufrufbar und würde der mitgeschickten Träger-ID trauen.
  - `deliverInvitation(Träger { ID, Name }, Lizenz-ID)` → Versandausgang aus T8. **Wirft nie**, jeder Fehler wird zu „fehlgeschlagen“.
  - Ablauf wie in design.md → Versand einer Einladung:
    1. Beginnen mit `beginInvitation`. Ein Fehler ergibt „fehlgeschlagen“ ohne Mail und ohne Abschluss.
    2. Eine Ablehnung ergibt den Ausgang der Funktion, ohne Mail.
    3. Bei „erlaubt“ die Mail mit T9 bauen, mit dem Trägernamen aus dem Argument und `LEARNING_PLATFORM_URL`, das erst beim Aufruf gelesen wird. Ist das Linkziel ungültig, wird Mailjet nicht aufgerufen, der Versuch mit „nicht angenommen“ abgeschlossen, und der Ausgang ist „fehlgeschlagen“ (EC-9).
    4. Senden an genau die Adresse, die `beginInvitation` geliefert hat.
    5. Abschließen mit `finishInvitation`.
    6. Ausgang „versendet“, wenn Mailjet angenommen hat, sonst „fehlgeschlagen“, gleich ob der Abschluss geklappt hat.
  - Die Tests bilden Datenmodul und Mailjet-Anbindung nach, das Mail-Modul ist echt. Sie decken jeden Schritt oben ab. Dazu: Eine Ausnahme aus Mailjet oder dem Mail-Modul ergibt „fehlgeschlagen“, und die Adresse erscheint in keiner Konsolenausgabe.
- [ ] T13 [P]  Lizenzliste liest den Versandstand mit  · files: src/features/licenses/licenses.data.ts, src/features/licenses/licenses.data.test.ts  · → AC-4, AC-6, AC-9
  - `listLicenses` liest `license_invitations` mit `status` und `last_attempt_at` eingebettet in derselben Anfrage, mit der Sitzung des Verwalters. Jede Lizenz bekommt „Versandstand oder keiner“ (Typ aus T8). Das Einbetten liefert ein Objekt oder nichts (T7 bestätigt das am gehosteten Projekt).
  - Filter, Sortierung, Ladefehler, `insertLicense` und `deleteLicense` bleiben unverändert. Die bestehenden Tests bleiben grün und werden um „mit“ und „ohne Versandstand“ ergänzt.
  - `license-list.tsx` hat einen eigenen Typ für die Lizenz. Das zusätzliche Feld ändert dort also nichts, bis T19.
- [ ] T14 [P]  Versandstand als Badge  · files: src/features/invitations/components/invitation-status.tsx, src/features/invitations/components/invitation-status.test.tsx  · → AC-4, AC-6, EC-3
  - Bekommt den Anzeigezustand aus T8 als Wert. shadcn `badge` mit Symbol und Text, Farben und Symbole nach der Tabelle in design.md → Versandstand in der Liste (`Mail`, `Clock`, `CircleAlert`, `CircleCheck`). Die Symbole sind `aria-hidden`, das Wort trägt den Zustand.
  - Bei „Versendet am“ steht das Datum in einem `time`-Element mit dem vollen Zeitpunkt.
  - Tests: die vier Zustände mit genauem Text, das `time`-Element, Symbole für Screenreader ausgeblendet.
- [ ] T15 [P]  Rückmeldung „Lizenz zugewiesen“ mit Zusatz  · files: src/features/licenses/licenses.rules.ts, src/features/licenses/licenses.rules.test.ts, src/features/licenses/components/assign-license-dialog.tsx, src/features/licenses/components/assign-license-dialog.test.tsx  · → AC-1, AC-3, AC-8, EC-9
  - `licenses.rules.ts`:
    - `AssignResult` „zugewiesen“ trägt den Versandausgang aus T8.
    - `Feedback` bekommt eine optionale Zusatzzeile und die neue Art „Warnung“, ein Toast, der den Dialog schließt.
    - `assignFeedback` holt Zusatztext und Art aus `invitations.rules.ts`.
    - Alle anderen Ergebnisse bleiben wie in PROJ-2.
  - `assign-license-dialog.tsx`: Erfolg mit `toast.success`, Warnung mit `toast.warning`, beide mit dem Titel „Lizenz zugewiesen“ und der Zusatzzeile als `description`. Sonst ändert sich nichts. Der Dialog wartet bis zu 10 Sekunden länger, das Sperren gibt es schon.
  - Tests: „zugewiesen“ mit „versendet“, mit „fehlgeschlagen“ und mit „Grenze des Trägers“, jeweils mit genauem Zusatztext und der Art des Toasts. Die Tests von PROJ-2 werden nur dort angepasst, wo das Ergebnis „zugewiesen“ den Versandausgang bekommt.

## Stufe 4 — Actions

<!-- Braucht den Versand aus T12 und die Regeln aus T15. Die beiden Dateisätze sind disjunkt, deshalb beide [P]. -->

- [ ] T16 [P]  Server Action „Senden“  · files: src/features/invitations/invitations.actions.ts, src/features/invitations/invitations.actions.test.ts  · → AC-5, AC-6, AC-7, AC-8, AC-9, EC-1, EC-5, EC-11, EC-12
  - `'use server'`. `sendInvitation(Eingabe)` wie in design.md → Senden und erneut senden:
    1. Wächter `requireTrainingProvider()` aus `src/features/account/session.data.ts`. Abgemeldet → Weiterleitung auf `/login?reason=session`. Nicht zugeordnet → „nicht zugeordnet“, ohne etwas zu lesen oder zu senden (EC-11).
    2. Schema aus T8. Ungültig → „Fehler“.
    3. `isLicenseVisible` mit der Träger-ID aus dem Wächter. Fehler → „Fehler“. Nicht sichtbar → `refresh()`, „bereits entzogen“ (EC-5, eine fremde Lizenz sieht genauso aus).
    4. `deliverInvitation` mit ID und Name des Trägers aus dem Wächter, dann `refresh()`, dann das Ergebnis nach dem Ausgang.
  - Das Kontingent spielt keine Rolle (EC-12).
  - Die Tests bilden Wächter, Datenmodul, Versand und `refresh` nach und decken jeden Schritt oben ab. Dazu: Eine mitgeschickte Adresse und ein mitgeschickter Träger werden ignoriert (AC-9). Eine Lizenz von B wird nie versendet. Mit Kontingent 0 oder überschrittenem Kontingent wird trotzdem versendet.
- [ ] T17 [P]  Zuweisen versendet die Einladung  · files: src/features/licenses/licenses.actions.ts, src/features/licenses/licenses.actions.test.ts  · → AC-1, AC-3, AC-8, EC-6, EC-9
  - `assignLicense`: Nach „angelegt“ zuerst `deliverInvitation` mit ID und Name des Trägers aus dem Wächter und der ID der neuen Lizenz, dann `refresh()`, dann „zugewiesen“ mit dem Versandausgang. Nach „angelegt“ ist das Ergebnis immer „zugewiesen“, nie „Fehler“.
  - Alle anderen Ergebnisse bleiben wie in PROJ-2, ohne Versand. `revokeLicense` bleibt unverändert.
  - Die Tests bilden den Versand nach. Geprüft wird: Jeder Ausgang geht unverändert ins Ergebnis. Der Versand läuft vor `refresh()`. Bei „schon vergeben“, „ausgeschöpft“, „Fehler“ und „nicht zugeordnet“ wird nicht versendet. Die übrigen Tests von PROJ-2 bleiben grün.

## Stufe 5 — Knopf

<!-- Braucht die Action aus T16. Nur eine Aufgabe. -->

- [ ] T18  Knopf „Erneut senden“ / „Einladung senden“  · files: src/features/invitations/components/send-invitation-button.tsx, src/features/invitations/components/send-invitation-button.test.tsx  · → AC-4, AC-5, AC-6, AC-9, EC-1, EC-10, EC-11
  - Client. Werte: Lizenz-ID, Adresse (nur für den Screenreader-Text), Art (senden / erneut senden), Darstellung (klein / volle Breite).
  - Variante `outline`. Klein ist 36 px hoch gezeichnet, mit einer Tippfläche von 44 × 44 px. Volle Breite ist 44 px hoch. Sichtbarer Text und Screenreader-Text kommen aus T8.
  - Der Klick ruft `sendInvitation` nur mit der Lizenz-ID auf, ohne Formular, das der Browser nativ absenden könnte.
  - Während des Sendens ist der Knopf gesperrt und trägt `aria-busy`, mit drehendem `Loader2`, das bei `prefers-reduced-motion` stillsteht.
  - Das Ergebnis erscheint als Toast mit Art und Text aus T8. Eine Weiterleitung (`isRedirectError` aus `src/components/form-feedback.tsx`) ist kein Fehler. `TypeError` gilt als „Keine Verbindung“ (EC-10), jeder andere Fehler als „Fehler“.
  - Die Tests bilden die Action nach und decken jede Zeile „Senden“ der Ergebnistabelle ab. Dazu: Ein Doppelklick ergibt nur einen Aufruf (EC-1), `TypeError` und Weiterleitung, und es geht nur die ID hinaus.

## Stufe 6 — Liste, Seite, README und Live-Gang

<!-- Braucht Badge (T14), Knopf (T18) und die Daten aus T13. T19 und T20 teilen sich keine Datei, deshalb beide [P].
     Die [user go-live]-Aufgaben macht /deploy. Sie blockieren weder /qa noch „Approved“. -->

- [ ] T19 [P]  Spalte „Einladung“ in der Lizenzliste  · files: src/features/licenses/components/license-list.tsx, src/features/licenses/components/license-list.test.tsx, src/app/(app)/licenses/page.tsx  · → AC-1, AC-3, AC-4, AC-5, AC-6, EC-3
  - `license-list.tsx` bekommt `now` von der Seite und berechnet pro Lizenz den Anzeigezustand mit T8. Sie importiert nie `*.data.ts`, `*.delivery.ts` oder `*.integration.ts`.
  - Tabelle: Spalte „Einladung“ vor „Aktion“, mit Badge aus T14 und Knopf aus T18 in der kleinen Darstellung. Bei „Wird versendet“ steht kein Knopf.
  - Karte: „Einladung:“ mit Badge, darunter der Knopf in voller Breite, darunter „Entziehen“ wie bisher.
  - Kein seitliches Scrollen bei Smartphone-Breite.
  - `page.tsx` gibt die aktuelle Zeit des Servers an die Liste weiter. Sonst ändert sich an der Seite nichts.
  - Tests: Spaltenkopf und Kartenbeschriftung, die vier Zustände mit dem passenden Knopf (erneut senden bei „Versendet“ und „Fehlgeschlagen“, senden bei „Noch nicht eingeladen“, keiner bei „Wird versendet“), beide Fassungen. Die Tests von PROJ-2 bleiben grün.
  - Nach dem Zusammenführen prüft der Haupt-Agent das Zusammenspiel im Browser gegen `http://localhost:3000/licenses`, mit einer eigenen Adresse mit `+`-Zusatz, die der Nutzer nennt:
    - Zuweisen: Toast mit Zusatz, „Versendet am“, die Mail kommt an.
    - „Erneut senden“, dann der Stand nach dem Neuladen.
    - Entziehen.
    - Smartphone-Breite.
    - **Nie** „Einladung senden“ bei den `example.com`-Lizenzen aus PROJ-2 klicken.
- [ ] T20 [P]  README: E-Mail-Dienst einrichten  · files: README.md  · → AC-1, AC-2, AC-11, EC-9 (PRD → Erfolgskriterien: nachvollziehbar für den Prüfer)
  - Neuer Abschnitt „E-Mail-Dienst einrichten (Mailjet)“:
    - Konto im Tarif Free, ohne Kreditkarte.
    - Absenderadresse bestätigen, und welche Adressen nicht gehen.
    - Tracking im Konto aus.
    - Schlüssel erzeugen.
    - Die vier Variablen in `.env.local`, mit Platzhaltern in `.env.local.example`. Linkziel selbst wählen. `npm run dev` neu starten.
    - Testen nur mit eigenen Adressen, z. B. mit `+`-Zusatz, **nie** an `example.com`.
    - Falls der Probeversand eine Freischaltung durch Mailjet gezeigt hat, auch diesen Schritt.
  - Die neue Migration kommt in die Liste unter „Datenbankschema einspielen“.
- [ ] T21 [user go-live]  Löschregel bei Mailjet  · where: Mailjet → Contacts (Kontakte löschen) bzw. die GDPR-Löschung von Mailjet → eine Regel festlegen und anwenden, z. B. Kontakte und Versandverlauf regelmäßig löschen, oder ein Folge-Feature, das beim Entziehen löscht (`spec.md` → Offene Fragen)  · → AC-12 (Aufbewahrung beim Dienst)
- [ ] T22 [user go-live]  Auftragsverarbeitungsvertrag mit Mailjet  · where: Mailjet-Konto → Data Processing Agreement → akzeptieren  · → keine AC (Art. 28 DSGVO, `docs/privacy.md`)
- [ ] T23 [user go-live]  Eigene Absender-Domain  · where: Mailjet → Senders & domains → Domain des Betreibers mit SPF und DKIM einrichten; `INVITATION_SENDER_EMAIL` in der Umgebung des Hosts auf eine Adresse dieser Domain  · → AC-1
- [ ] T24 [user go-live]  Linkziel der Lernplattform  · where: Umgebung des Hosts → `LEARNING_PLATFORM_URL` = die öffentliche Adresse der Plattform (`spec.md` → Offene Fragen)  · → AC-2

## Parallelisierung

- **Stufen sind Schranken.** Eine Stufe beginnt erst, wenn die vorige vollständig zusammengeführt und gegen ihre AC-IDs geprüft ist. So bleibt der Datenvertrag vor der Oberfläche: Datenbank (Stufe 1) → Bausteine (2) → Versand, Anzeige und Rückmeldung (3) → Actions (4) → Knopf (5) → Liste und Seite (6).
- **`[P]` verlangt disjunkte Dateien.** Zwei `[P]`-Aufgaben derselben Stufe nennen nie denselben Pfad unter `files:`. Würden sie dieselbe Datei berühren, sind sie **nicht** beide `[P]`: Dann wird eine davon nach hinten gestellt, oder beide werden zusammengelegt.
- **Schnittstellen über Stufen hinweg:** Die Typen aus T8 (Versandstand, Versandausgang, Ergebnis von `sendInvitation`) tragen T12, T13, T15, T16, T18 und T19. Die Antworten der Datenbankfunktionen aus T7 übersetzt T11. Die Einbettung, die T13 nutzt, bestätigt T7 am gehosteten Projekt. `AssignResult` mit Versandausgang (T15) füllt T17.
- **Abhängigkeit zwischen Features:** `src/features/licenses/` importiert von `src/features/invitations/`, nie umgekehrt. `npm run check:structure` lehnt einen Kreis ab. Die zwei geteilten Texte von PROJ-2 hält der Vergleichstest in T8 gleich.
- **Gemeinsame Ressourcen außerhalb der Dateien:** Die gehostete Datenbank ist für alle Arbeitskopien dieselbe. Nur T7 spielt eine Migration ein und testet gegen das gehostete Projekt, spätere Tests bilden die Datenbank nach. Echte Mails gehen nur beim Probeversand (Ende Stufe 2) und beim Browsertest (T19) hinaus, beide vom Haupt-Agenten und nur an eigene Adressen. Mailjet erlaubt im Free-Tarif 200 Mails am Tag für die ganze App.
- **Dateien von PROJ-2:** T13, T15, T17 und T19 berühren sie, nur additiv. Die Tests von PROJ-2 bleiben grün und werden nur dort angepasst, wo das Ergebnis „zugewiesen“ den Versandausgang bekommt.
- **Typprüfung:** Zwischen Stufe 3 und Stufe 4 passt `licenses.actions.ts` noch nicht zum neuen `AssignResult` (siehe Stufe 3). `npm run check` läuft deshalb erst am Ende vollständig grün, `npm test` an jeder Schranke.
- **Grob, nicht kleinteilig, aber nie größer als der Kontext eines Subagenten.** Aufgaben sind sinnvolle Zwischenstände, keine Einzeilen-Änderungen. Jede hat ein Anliegen und höchstens vier Dateien.
- **`[user]`-Aufgaben laufen nie parallel und werden nie gebaut.** Sie stehen in der Stufe, deren Code sie braucht, hier schon in Stufe 1, damit sie zum Probeversand fertig sind. Erreicht `/build` die Stufe, übergibt es sie (was, wo, welcher Wert) und arbeitet weiter. Das Kästchen bleibt offen, bis der Nutzer es abhakt. Ein `[user go-live]`-Kästchen bleibt offen, bis `/deploy` die Einstellung gemacht und ihre Wirkung gesehen hat.
- Während `/build` läuft jede `[P]`-Aufgabe der aktiven Stufe in einem eigenen Subagenten mit eigener Git-Arbeitskopie. Danach führt der Haupt-Agent zusammen, prüft gegen die AC-IDs der Stufe und hakt die Kästchen hier ab. Subagenten erklären sich nie selbst für fertig, es gibt einen einzigen Verantwortlichen für die Prüfung.
