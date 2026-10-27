# PROJ-3: Einladungs-E-Mail — Technisches Design

> Das technische Design (das WIE) für dieses Feature. Es hat zwei Leser: den Betreiber, der es freigibt, und `/build`, das danach baut. Es enthält keinen Code, ist aber so genau, dass beim Bauen niemand raten muss.
> Zuständig: `/architecture`. Der Vertrag (das WAS) steht in `spec.md`, die Aufgabenliste in `tasks.md`.
> Kein Status- oder Datumsfeld: Der Status steht nur in `features/INDEX.md`.

## Überblick

- **E-Mail-Dienst ist Mailjet** (Send API v3.1). Mailjet ist im kostenlosen Tarif ohne Kreditkarte nutzbar und verschickt an beliebige Empfänger, wenn eine einzelne Absenderadresse bestätigt ist; eine eigene Domain braucht es nicht. Die Daten liegen laut Mailjet in Frankfurt und Belgien. Öffnungs- und Klickverfolgung lassen sich pro Mail abschalten (AC-11). Der Server ruft Mailjet direkt per `fetch` auf, ohne neues Paket.
- **Versendet wird nur in Server Actions, synchron, mit höchstens 10 Sekunden Wartezeit.** Nach dem Zuweisen startet `assignLicense` (PROJ-2) den Versand selbst. „Erneut senden“ und „Einladung senden“ rufen die neue Action `sendInvitation` auf. Es gibt keinen Hintergrundjob und keine automatischen Neuversuche.
- **Versandstand und Versandgrenze liegen in Postgres.** `public.license_invitations` hält pro Lizenz Zustand und Zeitpunkt des letzten Versuchs. `private.license_center_invitation_sends` hält pro Versendung Träger, Lizenz und Zeitpunkt, ohne Adresse. Beide schreibt nur der Server über zwei Datenbankfunktionen, die allein der Server-Schlüssel aufrufen darf. Verwalter lesen ihre Versandstände über RLS und schreiben nichts (AC-9).
- **Vor dem Mailversand wird reserviert.** Eine Datenbankfunktion prüft unter einer Sperre pro Träger, ob gerade versendet wird und ob eine Grenze erreicht ist, und trägt den Versuch dann ein. Von zwei gleichzeitigen Anfragen kommt so genau eine durch (EC-1, EC-2). Erst danach geht die Mail raus. Eine zweite Funktion trägt das Ergebnis ein.
- **Die Adresse kommt immer aus der gespeicherten Lizenz**, gelesen von der Datenbankfunktion. Sie steht in keiner URL, keinem Fehlertext und keinem Protokoll der App.

## Komponentenstruktur (Component Structure)

### Lizenzübersicht (Erweiterung von PROJ-2)

```
/licenses — Lizenzübersicht (PROJ-2, unverändert bis auf die Liste)
+-- Abschnitt „Vergebene Lizenzen“
    +-- ab md: Tabelle
    |   E-Mail-Adresse · Zugewiesen am · Einladung (neu) · Aktion
    |   Zelle „Einladung“:
    |   +-- Versandstand (Badge mit Symbol und Text)
    |   +-- Knopf „Erneut senden“ / „Einladung senden“ / kein Knopf  (klein gezeichnet, 44 × 44 px Tippfläche)
    +-- unter md: Karte pro Lizenz
        Adresse
        „Zugewiesen am TT.MM.JJJJ“
        „Einladung:“ Versandstand (Badge)          (neu)
        Knopf „Erneut senden“ / „Einladung senden“ (neu, volle Breite, 44 px, outline)
        Knopf „Entziehen“                           (wie bisher, volle Breite)
```

Der Dialog „Lizenz zuweisen“ bleibt, wie er ist. Neu ist nur, was nach der Antwort im Toast steht (siehe „Darstellung der Ergebnisse“). Er wartet bis zu 10 Sekunden länger, das Sperren der Knöpfe während des Sendens gibt es schon (PROJ-2).

### Versandstand in der Liste (AC-4, AC-6, EC-3)

Genau einer von vier Zuständen, berechnet beim Rendern aus der Zeile von `license_invitations` und der aktuellen Zeit des Servers:

| Zeile in `license_invitations` | Angezeigter Zustand | Badge | Symbol (lucide) | Aktion daneben |
|---|---|---|---|---|
| keine | „Noch nicht eingeladen“ | neutral: `--muted-foreground` auf `--muted` | `Mail` | „Einladung senden“ |
| `sending`, letzter Versuch jünger als 2 Minuten | „Wird versendet“ | neutral | `Clock` | keine |
| `sending`, letzter Versuch 2 Minuten alt oder älter | „Fehlgeschlagen“ | `--destructive` auf `--destructive-subtle` | `CircleAlert` | „Erneut senden“ |
| `sent` | „Versendet am TT.MM.JJJJ“ | `--success` auf `--success-subtle` | `CircleCheck` | „Erneut senden“ |
| `failed` | „Fehlgeschlagen“ | `--destructive` auf `--destructive-subtle` | `CircleAlert` | „Erneut senden“ |

- Das Wort trägt den Zustand, Farbe und Symbol unterstützen nur (`docs/design-system.md`). Symbole sind `aria-hidden`.
- Das Datum bei „Versendet am“ ist der Zeitpunkt des letzten Versuchs, „TT.MM.JJJJ“ in Europe/Berlin, in einem `time`-Element mit dem vollen Zeitpunkt.
- Die Liste fragt nicht von selbst nach. Der Zustand wird bei jedem Rendern neu berechnet, also nach jeder Aktion und jedem Neuladen.

### Knopf „Erneut senden“ / „Einladung senden“ (AC-5, AC-6, EC-1, EC-10)

- Ein einfacher Knopf ohne Dialog und ohne Formular: Der Klick ruft die Action `sendInvitation` mit der Lizenz-ID auf (Server Actions senden per POST). Es gibt nichts, was der Browser nativ absenden könnte.
- Sichtbarer Text „Erneut senden“ bzw. „Einladung senden“. Für Screenreader „Einladung an <Adresse> erneut senden“ bzw. „Einladung an <Adresse> senden“.
- Tabelle: Variante `outline`, 36 px hoch gezeichnet, Tippfläche 44 × 44 px. Karte: Variante `outline`, 44 px hoch, volle Breite.
- **Während des Sendens** ist der Knopf gesperrt und trägt `aria-busy`, mit einem drehenden Symbol (`Loader2`, steht still bei `prefers-reduced-motion`). Ein zweiter Klick im selben Tab ist so nicht möglich (EC-1).
- **Antwort auswerten** wie in PROJ-2: Eine Weiterleitung nach `redirect()` ist kein Fehler (`isRedirectError` aus `src/components/form-feedback.tsx`). Scheitert der Aufruf mit `TypeError`, gilt „Keine Verbindung“ (EC-10). Jeder andere Fehler gilt als „Das hat nicht geklappt“.

## Code-Struktur (Code Structure)

Nach dem Next.js-Pack (`docs/stacks/framework-nextjs.md` → Code structure). Die Umsetzung liegt in `src/features/invitations/`. Die Lizenzverwaltung (`src/features/licenses/`) importiert von dort; **`invitations` importiert nie aus `licenses`**, sonst entstünde ein Kreis.

| Modul / Pfad | Aufgabe und Schnittstelle | Erlaubte Abhängigkeiten |
| --- | --- | --- |
| `src/features/invitations/invitations.rules.ts` (pure) | Alle Texte von PROJ-3 außer der Mail. Anzeigezustand aus (Zeile oder keine, jetzt) nach der Tabelle oben. „Versendet am TT.MM.JJJJ“. Zeitpunkt „TT.MM.JJJJ, HH:MM Uhr“ in Europe/Berlin, **aufgerundet auf die nächste volle Minute**. Ergebnis von `sendInvitation` → Rückmeldung. Versandausgang beim Zuweisen → Zusatztext und Art des Toasts. | `src/features/account/account.rules.ts` (nur „Keine Verbindung“ und „nicht zugeordnet“) |
| `src/features/invitations/invitation-mail.rules.ts` (pure) | Baut die Mail aus (Trägername, Linkziel): Betreff, Textfassung, HTML-Fassung (siehe „Inhalt der Einladung“). Prüft das Linkziel (siehe „Einstellungen der App“). Maskiert den Trägernamen für HTML und entschärft ihn gegen automatische Verlinkung. | keine |
| `src/features/invitations/invitations.schema.ts` (pure) | Eingabe von „Senden“: nur die Lizenz-ID, Pflicht, UUID. Weitere Felder werden verworfen. | Zod |
| `src/features/invitations/invitations.data.ts` (server-only) | `isLicenseVisible(Träger-ID, Lizenz-ID)` → sichtbar / nicht sichtbar / Fehler, **mit der Sitzung des Verwalters** (RLS). `beginInvitation(Träger-ID, Lizenz-ID)` und `finishInvitation(Versand-ID, Ausgang)` rufen die beiden Datenbankfunktionen **mit dem Admin-Client** auf und übersetzen die Antwort in feste Ergebnisse. Sonst nutzt dieses Modul den Admin-Client für nichts. | `src/lib/supabase/server.ts`, `src/lib/supabase/admin.ts` |
| `src/features/invitations/mailjet.integration.ts` (server-only) | `sendMail({ Empfänger, Betreff, Text, HTML })` → „angenommen“ oder „fehlgeschlagen“. Liest Schlüssel und Absender aus der Umgebung, beim Aufruf, nie beim Laden des Moduls. | `server-only`, `fetch` |
| `src/features/invitations/invitations.delivery.ts` (server-only) | `deliverInvitation(Träger { ID, Name }, Lizenz-ID)` → Versandausgang (siehe „Versand einer Einladung“). **Wirft nie**, jeder Fehler wird zu „fehlgeschlagen“. Das ist die Schnittstelle für `assignLicense`. Liegt bewusst nicht in einer `'use server'`-Datei, denn jeder Export dort wäre vom Browser aus aufrufbar und würde der mitgeschickten Träger-ID trauen. | Daten-, Integrations- und Mail-Modul, `invitations.rules.ts` |
| `src/features/invitations/invitations.actions.ts` (`'use server'`) | `sendInvitation(Eingabe)`: Wächter, Schema, Sichtbarkeit, Versand, `refresh()`, Ergebnis | Wächter `src/features/account/session.data.ts`, Schema, Daten, `invitations.delivery.ts`, Regeln, `next/cache` |
| `src/features/invitations/components/invitation-status.tsx` | Badge mit Symbol und Text, bei „Versendet am“ mit `time`. Bekommt den Anzeigezustand als Wert. | Regeln, shadcn `badge`, `lucide-react` |
| `src/features/invitations/components/send-invitation-button.tsx` (Client) | Knopf aus dem Abschnitt oben. Werte: Lizenz-ID, Adresse (nur für den Screenreader-Text), Art (senden / erneut senden), Darstellung (klein / volle Breite). Zeigt das Ergebnis als Toast. | Action, Regeln, `src/components/form-feedback.tsx` (`isRedirectError`), shadcn `button`, `sonner` |

**Geänderte Module von PROJ-2** (nur additiv; die Tests von PROJ-2 müssen grün bleiben, angepasst nur dort, wo sich das Ergebnis von „Zuweisen“ erweitert):

| Modul | Änderung |
| --- | --- |
| `src/features/licenses/licenses.data.ts` | `listLicenses` liest den Versandstand in derselben Anfrage mit (eingebettet: `license_invitations` mit `status` und `last_attempt_at`). Jede Lizenz bekommt dazu „Versandstand oder keiner“. Ladefehler wie bisher. |
| `src/features/licenses/licenses.actions.ts` | `assignLicense`: nach „angelegt“ zuerst `deliverInvitation` mit dem Träger aus dem Wächter und der ID der neuen Lizenz, dann `refresh()`. Ergebnis „zugewiesen“ trägt den Versandausgang. Nach „angelegt“ ist das Ergebnis immer „zugewiesen“, nie „Fehler“. |
| `src/features/licenses/licenses.rules.ts` | `AssignResult` „zugewiesen“ mit Versandausgang. Die Rückmeldung bekommt eine optionale Zusatzzeile und die neue Art „Warnung“ (Toast schließt den Dialog). `assignFeedback` holt Zusatztext und Art aus `invitations.rules.ts`. |
| `src/features/licenses/components/assign-license-dialog.tsx` | zeigt Erfolg und Warnung mit Zusatzzeile (`toast.success` / `toast.warning` mit `description`) |
| `src/features/licenses/components/license-list.tsx` | Spalte „Einladung“ vor „Aktion“, Kartenzeile „Einladung:“ und der Knopf, wie im Baum oben. Bekommt `now` von der Seite. |
| `src/app/(app)/licenses/page.tsx` | gibt die aktuelle Zeit des Servers an die Liste weiter |

- Die Bauteile importieren nie `*.data.ts`, `*.delivery.ts` oder `*.integration.ts`.
- **Zwei Texte gehören PROJ-2** („Diese Lizenz wurde bereits entzogen.“ und „Das hat nicht geklappt. Bitte versuchen Sie es erneut.“). `invitations.rules.ts` darf `licenses.rules.ts` nicht importieren (Kreis). Es führt beide als eigene Konstanten, und ein Test vergleicht sie mit denen aus `licenses.rules.ts`. Tests zählen nicht zum Abhängigkeitsgraphen.
- Tests liegen neben dem Modul. Die Datenbanktests (Rechte, Funktionen, gleichzeitige Anfragen, Löschkaskade, Aufräumen) liegen in `src/test/db/invitations.test.ts`.

## Footprint

- **Code und Tests:** die Module der Tabellen oben, mit Tests daneben, dazu `src/test/db/invitations.test.ts`. In `README.md` ein Abschnitt „E-Mail-Dienst einrichten (Mailjet)“ (Konto, Absenderadresse bestätigen, Schlüssel, Linkziel, Tracking aus, Testen mit eigener Adresse) und die neue Migration in der Liste unter „Datenbankschema einspielen“.
- **Migrationen, Tabellen, Regeln:** `supabase/migrations/<Zeit>_proj3_license_invitations.sql` mit:
  - Tabelle `public.license_invitations` mit einem Index, RLS mit einer Leseregel, ausdrücklich gesetzten Rechten
  - Tabelle `private.license_center_invitation_sends` mit drei Indizes, RLS an, keine Rechte für die Rollen der App
  - Funktionen `public.license_center_begin_invitation` und `public.license_center_finish_invitation` (security definer, nur `service_role` darf sie ausführen)
  - Funktion `private.license_center_invitation_cleanup` und `pg_cron`-Job `license-center-invitation-cleanup` alle 5 Minuten
- **Umgebungsvariablen** (nur Namen, alle nur für den Server, keine mit `NEXT_PUBLIC_`): `MAILJET_API_KEY`, `MAILJET_SECRET_KEY`, `INVITATION_SENDER_EMAIL`, `LEARNING_PLATFORM_URL`. Vorhanden und mitgenutzt: `SUPABASE_SERVICE_ROLE_KEY`.
- **Pakete:** keine neuen.
- **Einhängepunkte:** Spalte und Kartenzeile in der Liste der Lizenzübersicht, Toast nach dem Zuweisen, `assignLicense`. Rahmen, Kopfzeile und Tor bleiben unverändert. Externer Dienst: Mailjet (`https://api.mailjet.com/v3.1/send`).

## Datenmodell (Data Model)

### Versandstand — `public.license_invitations`

Eine Zeile pro Lizenz, die schon einmal einen Versandversuch hatte. Keine Zeile heißt „Noch nicht eingeladen“.

| Feld | Typ und Regeln |
|---|---|
| `license_id` | UUID, Primärschlüssel. Verweis auf `licenses`. Wird die Lizenz gelöscht (Entziehen, Kaskade vom Träger), verschwindet die Zeile mit (Löschkaskade, AC-12). |
| `training_provider_id` | UUID, Pflicht. Verweis auf `training_providers`, Löschkaskade. Immer der Träger der Lizenz: Die Beginn-Funktion übernimmt ihn aus der Lizenz, und niemand sonst schreibt die Tabelle. Er steht hier, damit die Leseregel genauso aussieht wie bei `licenses`. |
| `status` | Text, Pflicht, einer von: `sending` (Versand läuft), `sent` (vom Dienst angenommen), `failed` (abgelehnt, nicht erreichbar, keine Antwort in 10 Sekunden oder nicht eingestellt) |
| `last_attempt_at` | Zeitpunkt, Pflicht: Beginn des letzten Versuchs. Setzt immer die Datenbank. Er ist zugleich die Kennung des Versuchs (siehe Abschluss-Funktion). |

- **Keine weiteren Felder (AC-12):** keine Adresse, kein Mailinhalt, keine Fehlermeldung des Dienstes, keine Message-ID von Mailjet, kein `created_at`, kein `updated_at`. Wie oft versendet wurde, zählen die Versendungen unten; ein eigener Zähler hier wäre eine zweite Wahrheit.
- **Indizes:** Der Primärschlüssel deckt den Verweis auf die Lizenz und das Einbetten in die Liste. Dazu kommt einer auf `training_provider_id` für die Löschkaskade vom Träger und die Leseregel.
- **Angelegt und geändert:** nur von den beiden Datenbankfunktionen. **Gelöscht:** nur per Kaskade mit der Lizenz oder dem Träger. Zurück auf „keine Zeile“ geht es nie (Statusfolge der Spec).
- **Gelesen:** von den Verwaltern des eigenen Trägers.
- **Aufbewahrung:** bis die Lizenz entzogen oder der Träger gelöscht wird, dann sofort (AC-12, EC-5).

### Versendungen für die Versandgrenze — `private.license_center_invitation_sends`

Nur für die eigenständige Lizenzzentrale (Vorsilbe `license_center_`, Schema `private`, wie die Bremsen aus PROJ-1). Über die Daten-API nicht erreichbar.

| Feld | Typ und Regeln |
|---|---|
| `id` | fortlaufende Zahl, Primärschlüssel. Die Kennung, mit der die App den Versuch abschließt. |
| `training_provider_id` | UUID, Pflicht. Verweis auf `training_providers`, Löschkaskade. |
| `license_id` | UUID, **leer erlaubt**. Verweis auf `licenses`, beim Löschen der Lizenz **auf leer gesetzt**. So zählt die Versendung nach dem Entziehen weiter für den Träger (AC-8, EC-6), verweist aber auf nichts mehr (EC-5). |
| `outcome` | Text, Pflicht, einer von: `pending` (reserviert, Versand läuft), `sent` (vom Dienst angenommen). Fehlgeschlagene Versuche werden gelöscht, nicht vermerkt. |
| `started_at` | Zeitpunkt, Pflicht, Standard: jetzt. Gleich dem `last_attempt_at` des Versuchs. |

- **Keine Adresse, kein Inhalt, keine IP** (AC-12).
- **Indizes** (Zweck, nicht Syntax): nach Träger und Zeit (Zählen pro Träger, Verweis auf den Träger); nach Lizenz (Zählen pro Lizenz, Leeren beim Entziehen); nach Zeit (Aufräumen).
- **Was zählt** zur Grenze: `sent` in den letzten 24 Stunden, für den Träger zusätzlich `pending`, das jünger als 2 Minuten ist (EC-1, EC-2). Ein `pending`, das 2 Minuten alt ist, zählt nicht mehr: Es gilt wie in der Liste als fehlgeschlagen (EC-3).
- **Aufbewahrung:** Der Aufräumjob löscht alle fünf Minuten jede Zeile, die älter als 24 Stunden ist (AC-12). Mit dem Träger sofort.

### Was Mailjet speichert

- Pro Versendung: Empfängeradresse, Absender, Betreff, Inhalt und Zustellereignisse im Versandverlauf des Kontos.
- **Mailjet legt jeden Empfänger automatisch als Kontakt an** (laut Mailjet-Doku zur Send API). Eine Frist, nach der Mailjet beides von selbst löscht, nennt Mailjet nicht; das Löschen liegt beim Kontoinhaber. Für den Prüfbetrieb mit eigenen Adressen ist das hinnehmbar. Vor dem Live-Gang braucht es eine Löschregel (siehe „Einstellungen durch den Nutzer“ und `spec.md` → Offene Fragen). Eingetragen in `docs/privacy.md`.

## Abläufe und Zugriff (Behaviors & Access)

### Grundsätze

1. Der Träger kommt immer aus dem Wächter `requireTrainingProvider()`. Das Schema von „Senden“ hat nur die Lizenz-ID; mitgeschickte Felder (Adresse, Träger) werden verworfen (AC-9).
2. **Die Empfängeradresse liest nur die Beginn-Funktion aus der gespeicherten Lizenz.** Die App nimmt nie eine Adresse aus einer Eingabe (AC-9, EC-8).
3. **Datentrennung zweifach:** Die App gibt die Träger-ID aus dem Wächter an die Datenbankfunktion, und die prüft, dass die Lizenz zu diesem Träger gehört. Bei „Senden“ liest die App die Lizenz vorher mit der Sitzung des Verwalters, also durch RLS. Beim Zuweisen ist das Anlegen der Lizenz mit der Sitzung (RLS beim Anlegen) dieser Nachweis.
4. **Verwalter schreiben keine Versandstände und keine Versendungen**, weder über die App noch direkt über die Daten-API. Das dürfen nur die beiden Funktionen, und die darf nur der Server-Schlüssel ausführen (AC-9).
5. **Keine Teilnehmer-Adresse in einer URL, einem Fehlertext oder einem Protokoll der App.** Die Funktionen werden per POST aufgerufen, ihre Parameter sind nur IDs. Die Adresse steht nur im Rumpf ihrer Antwort und im Rumpf der Anfrage an Mailjet. Keine Funktion schreibt eine Zeile mit Adresse, also kann auch bei einem Regelverstoß keine Adresse in die Fehlerdetails von Postgres geraten (PROJ-2 QA, Beobachtung O-1). Antworten von Mailjet werden nie ausgegeben oder protokolliert, nur HTTP-Status und Mailjets `ErrorCode` (ohne `ErrorMessage`, die die Adresse enthalten kann).
6. Das Kontingent spielt beim Senden keine Rolle (EC-12).

### Eingaberegeln

| Feld | Regel | Meldung |
|---|---|---|
| Lizenz (bei „Senden“) | Pflicht, eine UUID | sonst Ergebnis „Fehler“. Das kommt nur bei einer manipulierten Anfrage vor. |

### Versand einer Einladung — `deliverInvitation` (AC-1 bis AC-3, AC-5, AC-7, AC-8, EC-1 bis EC-5, EC-9)

1. **Beginnen:** `license_center_begin_invitation(Träger-ID, Lizenz-ID)` über den Admin-Client. Antwortet Supabase nicht oder mit Fehler → Ausgang „fehlgeschlagen“, ohne Mail (es wurde nichts eingetragen).
2. **Nicht erlaubt** → Ausgang wie von der Funktion gemeldet: „nicht gefunden“, „läuft schon“, „Grenze der Lizenz“ mit Zeitpunkt, „Grenze des Trägers“ mit Zeitpunkt. Keine Mail.
3. **Erlaubt** → die Funktion liefert Versand-ID und Adresse.
4. **Mail bauen** mit dem Trägernamen aus dem Wächter und dem Linkziel `LEARNING_PLATFORM_URL`. Ist das Linkziel nicht gesetzt oder ungültig → ohne Aufruf von Mailjet weiter mit „fehlgeschlagen“ (EC-9).
5. **Senden** über `mailjet.integration.ts` (siehe unten), höchstens 10 Sekunden.
6. **Abschließen:** `license_center_finish_invitation(Versand-ID, angenommen ja/nein)` über den Admin-Client. Scheitert das, bleibt der Versandstand auf `sending` und zeigt nach 2 Minuten „Fehlgeschlagen“ (EC-3).
7. **Ausgang:** „versendet“, wenn Mailjet angenommen hat, sonst „fehlgeschlagen“, unabhängig davon, ob Schritt 6 geklappt hat.

### Mailjet aufrufen — `mailjet.integration.ts`

- **Anfrage:** POST an `https://api.mailjet.com/v3.1/send`, Anmeldung per HTTP Basic mit `MAILJET_API_KEY` als Benutzer und `MAILJET_SECRET_KEY` als Passwort, Rumpf als JSON mit genau einer Nachricht:
  - Absender: Adresse `INVITATION_SENDER_EMAIL`, Name immer „Lizenzzentrale“ (fest im Code, AC-2)
  - Empfänger: genau einer, nur die Adresse, ohne Namen
  - Betreff, Textfassung, HTML-Fassung aus `invitation-mail.rules.ts`
  - `TrackOpens` und `TrackClicks`: `disabled` (AC-11)
  - **nicht gesetzt:** Antwortadresse (`ReplyTo`), `CustomID`, `CustomCampaign`, `EventPayload`, `URLTags`, Kopien, Anhänge, Vorlagen (AC-2, AC-11, AC-12)
- **Zeitgrenze:** Abbruch nach 10 Sekunden (AC-3). Kein Wiederholen.
- **Angenommen** heißt: HTTP 200 **und** die eine Nachricht hat den Status `success`. Alles andere ist „fehlgeschlagen“: anderer HTTP-Status (z. B. 401 bei falschem Schlüssel, 403 `send-0008` bei unbestätigtem Absender), Status `error`, Abbruch, Netzwerkfehler, unlesbare Antwort.
- **Fehlt** einer der drei Werte `MAILJET_API_KEY`, `MAILJET_SECRET_KEY` oder `INVITATION_SENDER_EMAIL` oder ist er leer → „fehlgeschlagen“ ohne Anfrage (EC-9). Die App startet trotzdem, weil die Werte erst beim Senden gelesen werden.
- **Protokoll:** bei „fehlgeschlagen“ eine Zeile auf der Server-Konsole mit HTTP-Status oder „Zeitüberschreitung“ / „nicht eingestellt“ und den `ErrorCode`s, nie Schlüssel, Adresse, `ErrorMessage` oder Rumpf. Der Verwalter sieht davon nichts (EC-9).

### Datenbankfunktion `license_center_begin_invitation` (EC-1, EC-2, AC-7, AC-8)

Security definer, leerer Suchpfad, nur `service_role` darf sie ausführen. Parameter: Träger-ID, Lizenz-ID (beide Pflicht). Alles läuft in einer Transaktion:

1. **Sperre:** Transaktionssperre auf den Träger (advisory lock, Schlüssel aus `license_invitations:` und der Träger-ID). Alle Beginn-Aufrufe eines Trägers laufen nacheinander. Die Sperre gilt nur für diese kurze Transaktion, nicht für die Wartezeit auf Mailjet.
2. **Lizenz:** Lizenz mit dieser ID **und** dieser Träger-ID lesen. Keine → `{ status: license_not_found }` (EC-5; eine fremde Lizenz sieht genauso aus).
3. **Läuft schon?** Steht ihr Versandstand auf `sending` und ist `last_attempt_at` jünger als 2 Minuten → `{ status: already_sending }` (EC-1).
4. **Grenze der Lizenz:** Zahl der Versendungen dieser Lizenz mit `sent` in den letzten 24 Stunden. Ab 3 → `{ status: license_limit, available_from }` (AC-7). `available_from` ist der Zeitpunkt, ab dem weniger als 3 übrig sind: die (Anzahl − 2)-älteste dieser Versendungen plus 24 Stunden.
5. **Grenze des Trägers:** Zahl der Versendungen des Trägers mit `sent` in den letzten 24 Stunden plus `pending` jünger als 2 Minuten, gleich zu welcher Lizenz, auch ohne Lizenz (entzogen). Ab 30 → `{ status: provider_limit, available_from }` (AC-8, EC-2), mit der (Anzahl − 29)-ältesten plus 24 Stunden.
6. **Reservieren:** neue Versendung (`pending`, jetzt) anlegen; Versandstand anlegen oder ändern auf `sending` mit `last_attempt_at` = jetzt. → `{ status: allowed, send_id, email }`.

- Die Reihenfolge ist Absicht: Erst „läuft schon“, dann die Grenze der Lizenz, dann die des Trägers. Bei 29 Versendungen des Trägers und zwei gleichzeitigen Anfragen für verschiedene Lizenzen reserviert die erste, die zweite wartet an der Sperre und zählt dann 30 (EC-2). Zwei gleichzeitige Anfragen für dieselbe Lizenz: Die zweite sieht `sending` (EC-1).
- Bei einer Ablehnung ändert sich nichts: kein Versandstand angelegt (AC-8 beim Zuweisen: „Noch nicht eingeladen“), kein Status geändert (AC-7, AC-8 beim Senden).
- Keine Fehlermeldung der Funktion enthält eine Adresse. Sie bricht nur bei fehlenden Parametern ab.

### Datenbankfunktion `license_center_finish_invitation`

Security definer, leerer Suchpfad, nur `service_role`. Parameter: Versand-ID, angenommen ja/nein.

1. Versendung mit dieser ID und `pending` lesen. Keine → nichts tun (schon abgeschlossen oder Träger gelöscht).
2. **Angenommen:** Versendung auf `sent`. **Nicht angenommen:** Versendung löschen (zählt nie, Produktentscheidung der Spec).
3. Versandstand ihrer Lizenz auf `sent` bzw. `failed` setzen, **nur wenn** er noch `sending` ist und `last_attempt_at` gleich `started_at` der Versendung. So überschreibt der späte Abschluss eines hängenden Versuchs nie einen neueren (EC-3, EC-4). Ist die Lizenz inzwischen entzogen, ist `license_id` leer, und es gibt nichts zu ändern (EC-5).

### Aufräumjob (AC-12)

- `pg_cron`, alle 5 Minuten, Job `license-center-invitation-cleanup`, Funktion `private.license_center_invitation_cleanup`, aufrufbar nur vom Eigentümer.
- Löscht jede Versendung mit `started_at` älter als 24 Stunden. Jede Zeile ist damit spätestens 24 Stunden und 5 Minuten nach ihrem Anlegen weg, und die Grenze sieht immer volle 24 Stunden.
- Den Job von PROJ-1 (`license-center-cleanup`, stündlich, 23 Stunden) fasst dieses Feature nicht an.

### Zuweisen (Erweiterung von PROJ-2 AC-4; PROJ-3 AC-1, AC-3, AC-8, EC-6)

1. bis 3. wie in PROJ-2 (Wächter, Schema, Anlegen mit der Sitzung).
4. **„angelegt“** → `deliverInvitation(Träger aus dem Wächter, ID der neuen Lizenz)` → `refresh()` → Ergebnis „zugewiesen“ mit Versandausgang.
5. Alle anderen Ergebnisse wie in PROJ-2, ohne Versand.

- Eine neu angelegte Lizenz hat keine Versendungen, also greift nur die Grenze des Trägers (EC-6).
- Eine Lizenz, die jemand direkt über die Daten-API anlegt, bekommt keine Einladung und steht auf „Noch nicht eingeladen“.

### Senden und erneut senden — `sendInvitation` (AC-5 bis AC-9, EC-1, EC-5, EC-10 bis EC-12)

1. **Wächter:** abgemeldet → Weiterleitung auf `/login?reason=session`. Nicht zugeordnet → Ergebnis „nicht zugeordnet“, ohne etwas zu lesen oder zu senden (EC-11).
2. **Schema:** ungültig → Ergebnis „Fehler“.
3. **Sichtbar?** `isLicenseVisible` mit der Sitzung: Lizenz mit dieser ID und der Träger-ID aus dem Wächter, nur die ID. Fehler → „Fehler“. Nicht sichtbar → `refresh()`, Ergebnis „bereits entzogen“ (EC-5; fremd sieht genauso aus).
4. **Versand:** `deliverInvitation` → `refresh()` → Ergebnis nach dem Ausgang.

„Einladung senden“ (Altbestand, AC-6) und „Erneut senden“ sind dieselbe Action. Was rausgeht, ist dieselbe Mail wie beim Zuweisen (AC-5).

### Übersicht lesen (Erweiterung von PROJ-2)

- `listLicenses` liest pro Lizenz `license_invitations` mit `status` und `last_attempt_at` in derselben Anfrage, mit der Sitzung des Verwalters. RLS gilt auch für die eingebettete Tabelle.
- Den Anzeigezustand berechnet `invitations.rules.ts` mit der Zeit, die die Seite beim Rendern übergibt.

### Darstellung der Ergebnisse

| Aktion | Ausgang / Ergebnis | Darstellung |
|---|---|---|
| Zuweisen | zugewiesen, versendet | Dialog schließt, Erfolgs-Toast „Lizenz zugewiesen“, Zusatz „Die Einladung ist versendet.“ (AC-1) |
| Zuweisen | zugewiesen, fehlgeschlagen | Dialog schließt, Warn-Toast „Lizenz zugewiesen“, Zusatz „Die Einladung konnte nicht versendet werden. Sie können sie in der Liste erneut senden.“ (AC-3, EC-9) |
| Zuweisen | zugewiesen, Grenze des Trägers | Dialog schließt, Warn-Toast „Lizenz zugewiesen“, Zusatz mit der Begründung aus AC-8 |
| Zuweisen | zugewiesen, anderer Ausgang (kommt bei einer neuen Lizenz nicht vor) | wie „fehlgeschlagen“ |
| Zuweisen | alle anderen Ergebnisse | wie in PROJ-2 |
| Senden | versendet | Erfolgs-Toast „Einladung versendet“ (AC-5) |
| Senden | fehlgeschlagen | Fehler-Toast „Die Einladung konnte nicht versendet werden. Bitte versuchen Sie es später erneut.“ (AC-5, EC-9) |
| Senden | läuft schon | Fehler-Toast „Die Einladung wird gerade versendet.“ (EC-1) |
| Senden | Grenze der Lizenz | Fehler-Toast mit dem Text aus AC-7 |
| Senden | Grenze des Trägers | Fehler-Toast mit der Begründung aus AC-8 |
| Senden | bereits entzogen | Fehler-Toast „Diese Lizenz wurde bereits entzogen.“ (EC-5) |
| Senden | nicht zugeordnet | Fehler-Toast mit der Meldung aus PROJ-1 EC-5 (EC-11) |
| Senden | Fehler | Fehler-Toast „Das hat nicht geklappt. Bitte versuchen Sie es erneut.“ |
| Senden | keine Verbindung | Fehler-Toast „Keine Verbindung. Bitte versuchen Sie es erneut.“ (EC-10) |
| beide | abgemeldet | Weiterleitung zum Login mit „Bitte melden Sie sich erneut an.“ (EC-11) |

Toasts (`sonner`) in drei Arten: Erfolg, Warnung (Aktion gelungen, Folgeschritt nicht) und Fehler. Nach jedem Ergebnis außer „Fehler“, „keine Verbindung“ und „nicht zugeordnet“ zeigt die Liste ohne Neuladen den Stand aus der Datenbank (`refresh()`, AC-5).

### Zugriffsregeln in der Datenbank (AC-9)

| Tabelle / Funktion | `anon` | `authenticated` | `service_role` |
|---|---|---|---|
| `license_invitations` | keine Rechte | nur **Lesen**, nur Zeilen eines Trägers, bei dem der Aufrufer Verwalter (`admin`) ist. Kein Anlegen, Ändern, Löschen. | Lesen, Anlegen, Ändern, Löschen (nur Tests, RLS gilt für diese Rolle nicht) |
| `private.license_center_invitation_sends` | keine Rechte | keine Rechte | keine Rechte, nur über die Funktionen |
| `license_center_begin_invitation`, `license_center_finish_invitation` | nicht ausführbar | nicht ausführbar | ausführbar |
| `private.license_center_invitation_cleanup` | nicht ausführbar | nicht ausführbar | nicht ausführbar (nur der Job) |

- **Die Rechte-Regel aus PROJ-1 gilt** (`features/PROJ-1-account-login/design.md` → Zugriffsregeln in der Datenbank): erst alle Rechte entziehen, dann nur geben, was die Tabelle nennt; RLS in beiden Tabellen ausdrücklich einschalten; Ausführen der Funktionen für `public`, `anon` und `authenticated` entziehen.
- **Eine RLS-Regel** auf `license_invitations`, zum Lesen, für `authenticated`, gleich gebaut wie die Leseregel von `licenses` (Mitgliedschaft mit der Konto-ID aus der Sitzung und der Rolle `admin`, Konto-ID einmal pro Abfrage ausgewertet).
- **Kaskaden ohne Rechte des Verwalters:** Ein Verwalter, der eine Lizenz entzieht, hat kein Recht auf die beiden Tabellen. Postgres führt Löschkaskade und Leeren des Verweises trotzdem aus, mit den Rechten des Tabelleneigentümers und ohne RLS. `/build` bestätigt das per Test.
- **Folge für AC-9:** Ein Verwalter von A liest nur Versandstände von A. Abgelehnt werden: Versandstand anlegen, ändern, löschen (kein Recht); Versendungen lesen oder schreiben (kein Recht, Schema nicht erreichbar); die Funktionen aufrufen (kein Ausführungsrecht); über die App für eine Lizenz von B senden (Schritt 3 von „Senden“ und Schritt 2 der Beginn-Funktion). Ein abgemeldeter Besucher bekommt keine Zeilen.

### Einstellungen der App (Umgebung)

| Variable | Regel | Wenn sie fehlt oder ungültig ist |
|---|---|---|
| `MAILJET_API_KEY`, `MAILJET_SECRET_KEY` | aus Mailjet → Account settings → REST API → API key management | jeder Versand „fehlgeschlagen“ (EC-9) |
| `INVITATION_SENDER_EMAIL` | eine in Mailjet bestätigte Absenderadresse | fehlt: „fehlgeschlagen“ ohne Anfrage; unbestätigt: Mailjet lehnt ab (403), „fehlgeschlagen“ |
| `LEARNING_PLATFORM_URL` | absolute Adresse mit `https:` oder `http:`, ohne Benutzername und Passwort, höchstens 2.048 Zeichen. Alles andere (z. B. `javascript:`, relative Pfade) ist ungültig. | „fehlgeschlagen“ ohne Anfrage (EC-9) |

Keine davon trägt `NEXT_PUBLIC_`. Die App liest sie erst beim Senden, also startet sie auch ohne sie (EC-9).

### Inhalt der Einladung (AC-2, AC-10, AC-11, EC-7)

- **Absender:** „Lizenzzentrale“ <`INVITATION_SENDER_EMAIL`>. Keine Antwortadresse.
- **Betreff:** „Ihre Lizenz für den Kurs Geprüfter Technischer Betriebswirt (IHK)“ — ohne Trägernamen.
- **Textfassung** (für Mailprogramme, die nur Text zeigen, EC-7), Absätze in dieser Reihenfolge:
  1. „Guten Tag,“
  2. „<Trägername> hat Ihnen eine Lizenz für den Kurs „Geprüfter Technischer Betriebswirt (IHK)“ auf der Lernplattform freigeschaltet.“
  3. „Zur Lernplattform: <Linkziel>“
  4. „Bitte melden Sie sich dort mit genau der E-Mail-Adresse an, an die diese Nachricht gesendet wurde.“
  5. „Bei Fragen wenden Sie sich an <Trägername>.“
  6. „Freundliche Grüße“, Zeilenumbruch, „Ihre Lizenzzentrale“
  7. eine Trennlinie „--“, dann der Datenschutzhinweis aus AC-10 wörtlich, mit dem Trägernamen an allen drei Stellen
- **HTML-Fassung:** dieselben Absätze in derselben Reihenfolge. `lang="de"`, nur Inline-Stile, schlichte Spalte von höchstens 600 px.
  - Absatz 3 ist ein Knopf: ein Link „Zur Lernplattform“ direkt auf das Linkziel, als Fläche gestaltet (Farben als feste Werte aus `--primary` und `--primary-foreground` des hellen Themes, Radius 8 px, mindestens 44 px hoch). Darunter klein: „Falls der Knopf nicht funktioniert, öffnen Sie diese Adresse:“ und das Linkziel als Link.
  - Der Datenschutzhinweis steht abgesetzt am Ende in kleinerer Schrift.
  - **Keine Bilder, keine externen Stylesheets, keine Schriften von außen** (AC-11).
- **Die Empfängeradresse steht nicht im Text.** Absatz 4 umschreibt sie. So enthält die Mail außer dem Trägernamen nichts, was der Verwalter beeinflussen kann (AC-2).
- **Trägername (EC-7):** In beiden Fassungen wird nach jedem „.“, „@“, „:“ und „/“ im Namen ein unsichtbares Leerzeichen der Breite null (U+200B) eingefügt. Mailprogramme machen daraus dann keinen Link. In der HTML-Fassung wird der Name zusätzlich maskiert (`&`, `<`, `>`, `"`, `'`), steht nie in einem Attribut und darf an jeder Stelle umbrechen. Die Namensregel aus PROJ-1 (2 bis 100 Zeichen) begrenzt die Länge.
- **Linkziel:** in der HTML-Fassung für Attribut und Text maskiert. Es kommt aus der Umgebung, nie vom Verwalter.

### Meldungstexte

Alle Texte stehen in `invitations.rules.ts` bzw. `invitation-mail.rules.ts`, in der Sie-Form. „Keine Verbindung“ und „nicht zugeordnet“ kommen aus `account.rules.ts`.

| Anlass | Text | AC/EC |
|---|---|---|
| Spaltenkopf, Kartenbeschriftung | „Einladung“ · „Einladung:“ | AC-4 |
| Zustände | „Wird versendet“ · „Versendet am TT.MM.JJJJ“ · „Fehlgeschlagen“ · „Noch nicht eingeladen“ | AC-4, AC-6, EC-3 |
| Knöpfe | „Erneut senden“ · „Einladung senden“ (Screenreader: „Einladung an <Adresse> erneut senden“ · „Einladung an <Adresse> senden“) | AC-4, AC-6 |
| Zusatz nach Zuweisen, versendet | „Die Einladung ist versendet.“ | AC-1 |
| Zusatz nach Zuweisen, fehlgeschlagen | „Die Einladung konnte nicht versendet werden. Sie können sie in der Liste erneut senden.“ | AC-3 |
| Grenze des Trägers (Zusatz beim Zuweisen und Fehler-Toast beim Senden) | „Die Einladung wurde nicht versendet, weil Ihr Bildungsträger in den letzten 24 Stunden bereits 30 Einladungen versendet hat. Sie können sie ab TT.MM.JJJJ, HH:MM Uhr senden.“ | AC-8, EC-2 |
| Versendet | „Einladung versendet“ | AC-5 |
| Fehlgeschlagen beim Senden | „Die Einladung konnte nicht versendet werden. Bitte versuchen Sie es später erneut.“ | AC-5 |
| Grenze der Lizenz | „Diese Einladung wurde in den letzten 24 Stunden bereits dreimal versendet. Sie können sie ab TT.MM.JJJJ, HH:MM Uhr erneut senden.“ | AC-7 |
| Läuft schon | „Die Einladung wird gerade versendet.“ | EC-1 |
| Bereits entzogen | „Diese Lizenz wurde bereits entzogen.“ (gleich PROJ-2) | EC-5 |
| Fehler | „Das hat nicht geklappt. Bitte versuchen Sie es erneut.“ (gleich PROJ-2) | — |
| Keine Verbindung | „Keine Verbindung. Bitte versuchen Sie es erneut.“ (aus `account.rules.ts`) | EC-10 |
| Konto ohne Bildungsträger | Meldung aus PROJ-1 EC-5 (aus `account.rules.ts`) | EC-11 |

„TT.MM.JJJJ, HH:MM Uhr“ ist Europe/Berlin und auf die nächste volle Minute aufgerundet, damit der genannte Zeitpunkt nie zu früh ist.

### Hinweise für `/qa`

- **Echte eigene Adressen:** Versand nur an Adressen, die ankommen, z. B. die eigene mit `+`-Zusatz (`name+test1@…`, deckt EC-8 ab). **Nie an `example.com`:** Diese Adressen sind nicht zustellbar, Mailjet zählt sie als Rückläufer, und zu viele gefährden das Konto. Die Lizenzen aus den Tests von PROJ-2 tragen `example.com`-Adressen. Bei ihnen nicht auf „Einladung senden“ klicken.
- **Grenzen (AC-7, AC-8, EC-2, EC-6):** Statt 30 echter Mails die Versendungen per `supabase db query` in `private.license_center_invitation_sends` anlegen (`sent`, passende Zeitpunkte) und danach wieder löschen. Für EC-2 29 anlegen und dann zwei Aufrufe gleichzeitig starten.
- **EC-3:** einen Versandstand per SQL auf `sending` mit `last_attempt_at` vor 3 Minuten setzen und die Seite neu laden.
- **EC-9:** `npm run dev` einmal mit falschem Schlüssel, einmal ohne `LEARNING_PLATFORM_URL` starten.
- **AC-9:** mit dem Zugriffstoken eines Verwalters (wie in PROJ-2) direkt gegen `/rest/v1/license_invitations` lesen, anlegen, ändern, löschen und die beiden Funktionen über `/rest/v1/rpc/…` aufrufen; mit dem öffentlichen Schlüssel allein ebenso.
- **AC-11:** in der angekommenen Mail die Quelle ansehen (z. B. Gmail → „Original anzeigen“): kein `<img>`, Links zeigen direkt auf das Linkziel, keine Mailjet-Domain in Links, kein Mailjet-Logo, kein Werbetext.
- **AC-12:** nach dem Entziehen mit `service_role` bzw. per `supabase db query` nach der Lizenz-ID suchen: kein Versandstand, Versendungen nur noch ohne Lizenz.

### Für `/build`, am gehosteten Projekt per Test bestätigen

- Entzieht ein Verwalter eine Lizenz, verschwindet ihr Versandstand, und der Verweis ihrer Versendungen wird leer, obwohl `authenticated` auf beide Tabellen kein Recht hat.
- Das Einbetten von `license_invitations` in die Abfrage von `listLicenses` liefert pro Lizenz ein Objekt oder nichts, unter RLS.
- Die beiden Funktionen sind mit dem öffentlichen Schlüssel und mit dem Token eines Verwalters nicht aufrufbar.
- Von zwei gleichzeitigen Beginn-Aufrufen für dieselbe Lizenz reserviert genau einer (EC-1). Bei 29 Versendungen reserviert von zwei gleichzeitigen Aufrufen für verschiedene Lizenzen genau einer (EC-2).
- Der Job `license-center-invitation-cleanup` läuft und löscht Zeilen älter als 24 Stunden.
- **Eine echte Testmail über Mailjet** an eine eigene Adresse: Absender „Lizenzzentrale“, keine Antwortadresse, kein Bild, keine umgeleiteten Links, **kein Mailjet-Logo und kein Werbetext** (siehe Offene Fragen). Fügt Mailjet im kostenlosen Tarif etwas ein, hält `/build` an und meldet es, denn dann ist AC-11 mit Mailjet nicht erfüllbar.

## Abhängigkeiten (Dependencies)

- **Neu:** keine. Mailjet wird per `fetch` angesprochen, ohne SDK.
- **Schon vorhanden und genutzt:**
  - shadcn/ui-Bausteine `badge`, `button`, `sonner`, `table`, `card`
  - `zod`, `@supabase/ssr`, `@supabase/supabase-js` (Admin-Client), `server-only`, `lucide-react`
  - `refresh` aus `next/cache` (Next.js 16)
  - Datenbank-Erweiterung `pg_cron` (seit PROJ-1 eingeschaltet)

## Einstellungen durch den Nutzer (Settings the user makes)

| Einstellung | Wo | Wann | Wert | Warum | → AC |
| --- | --- | --- | --- | --- | --- |
| Mailjet-Konto | [mailjet.com](https://www.mailjet.com) → Sign up, Tarif „Free“ | now | kostenloses Konto, ohne Kreditkarte | E-Mail-Dienst der Einladungen | AC-1 |
| Absenderadresse bestätigen | Mailjet → Account settings → Senders & domains → Add a sender address, dann den Link in der Bestätigungsmail öffnen | now | eine eigene Adresse. Am besten eine Adresse einer eigenen Domain. Eine Gmail-Adresse geht, die Einladungen landen damit aber eher im Spam. Adressen von Yahoo, AOL und anderen Anbietern mit strenger DMARC-Regel nicht verwenden, deren Mails werden abgewiesen. | Mailjet versendet nur von bestätigten Absendern (sonst 403 `send-0008`) | AC-2 |
| Tracking im Konto aus | Mailjet → Account settings → Tracking-Einstellungen | now | Öffnungs- und Klickverfolgung **aus** | zweite Linie: Die App schaltet beides pro Mail ohnehin ab | AC-11 |
| Schlüssel erzeugen | Mailjet → Account settings → REST API → API key management | now | API-Key und Secret-Key des Hauptschlüssels | Anmeldung der App bei Mailjet | AC-1 |
| Platzhalter der neuen Variablen | `.env.local.example` (der Agent darf sie nicht bearbeiten) | now | `MAILJET_API_KEY=your-mailjet-api-key`, `MAILJET_SECRET_KEY=your-mailjet-secret-key`, `INVITATION_SENDER_EMAIL=you@example.org`, `LEARNING_PLATFORM_URL=https://lernplattform.example.org` | dokumentiert jede Variable für den Prüfer | EC-9 |
| Echte Werte | `.env.local` → die vier Variablen | now | Schlüssel aus Mailjet, die bestätigte Absenderadresse, die Adresse der Lernplattform (bis zum Live-Gang eine selbst gewählte, siehe `spec.md` → Offene Fragen). Danach `npm run dev` neu starten. | Versand mit echten Mails | AC-1, AC-2 |
| Migration einspielen | Terminal: `supabase db push` (die CLI ist seit PROJ-1 verbunden) | now | — | Tabellen, Funktionen, Job | alle |
| Löschregel bei Mailjet | Mailjet → Contacts (Kontakte löschen) bzw. die GDPR-Löschung von Mailjet | go-live | festlegen und anwenden, z. B. Kontakte und Versandverlauf regelmäßig löschen, oder ein Folge-Feature, das beim Entziehen löscht | Mailjet löscht Empfänger nicht von selbst; die Spec verlangt eine möglichst kurze Aufbewahrung beim Dienst | AC-12 (beim Dienst) |
| Auftragsverarbeitungsvertrag | Mailjet-Konto (Mailjets Data Processing Agreement) | go-live | akzeptiert | `docs/privacy.md` | — |
| Eigene Absender-Domain | Mailjet → Senders & domains → Domain mit SPF und DKIM | go-live | Domain des Betreibers | bessere Zustellung, nicht im Spam | AC-1 |
| Linkziel der Lernplattform | Umgebung des Hosts → `LEARNING_PLATFORM_URL` | go-live | die öffentliche Adresse der Plattform | `spec.md` → Offene Fragen | AC-2 |

**Test-Gegenstück der go-live-Zeilen:** ein kostenloses Mailjet-Konto mit einer bestätigten eigenen Adresse als Absender, eigene Adressen als Empfänger und ein selbst gewähltes Linkziel. Damit läuft `/qa` vollständig, ohne Domain und ohne Live-Gang.

## Technische Entscheidungen (Technical Decisions)

Codebase-Karte: entfällt (`mode: new`, kein `docs/codebase/`).

| Entscheidung | Begründung | Erwogene Alternative | Trade-off | Datum |
|---|---|---|---|---|
| **Mailjet** als E-Mail-Dienst | Einziger geprüfter Dienst, der alle Kriterien erfüllt: kostenlos ohne Kreditkarte (6.000 Mails im Monat, 200 am Tag), Versand an beliebige Empfänger mit einer einzeln bestätigten Absenderadresse, Daten laut Mailjet in Frankfurt und Saint-Ghislain (Belgien), Öffnungs- und Klickverfolgung pro Mail abschaltbar (Mailjet-Doku, über Context7 geprüft) | Brevo (Verfolgung bei Transaktionsmails nur für Enterprise abschaltbar, verletzt AC-11); Resend (ohne eigene Domain nur an die eigene Adresse); SMTP2GO (keine Freemail-Absender); Mailgun (Sandbox nur an freigegebene Empfänger); Gmail per SMTP (kein Auftragsverarbeitungsvertrag, US, Kopie im Gesendet-Ordner) | Mailjet legt Empfänger als Kontakte an und löscht nicht von selbst (Löschregel vor dem Live-Gang). Im kostenlosen Tarif kann Mailjet-Branding erscheinen, das prüft `/build` mit einer echten Mail (Offene Fragen). Mit Freemail-Absender landen Mails eher im Spam. 200 Mails am Tag gelten für die ganze App. | 2026-10-26 |
| Mailjet per `fetch` an die Send API v3.1, ohne SDK | Ein einziger Aufruf mit festem Rumpf. Kein Paket, keine Abhängigkeit, Zeitgrenze direkt mit `AbortSignal`. Wie die Turnstile-Prüfung in PROJ-1. | `node-mailjet`; SMTP mit `nodemailer` | Die Antwort von Mailjet wertet die App selbst aus, mit Tests | 2026-10-26 |
| Verfolgung pro Mail aus (`TrackOpens`, `TrackClicks` = `disabled`), keine Bilder, keine Antwortadresse, keine Kennungen für Mailjet | **Garantie für AC-11 und AC-2:** Die Einstellung pro Mail überschreibt die des Kontos. Ohne Bilder gibt es nichts, woran ein Zählpixel hängen könnte. | Nur die Konto-Einstellung | Keine Statistik über Öffnungen. Das ist gewollt. | 2026-10-26 |
| Versand synchron in der Server Action mit 10 Sekunden Zeitgrenze, kein Hintergrundjob | Die App läuft nur lokal, einen dauerhaften Hintergrundprozess gibt es nicht (Spec: kein automatischer Neuversuch). Das Ergebnis steht so gleich im Toast (Produktentscheidung). | Warteschlange mit Job; Supabase Edge Function | Der Dialog „Lizenz zuweisen“ wartet bis zu 10 Sekunden länger | 2026-10-26 |
| Reservieren vor dem Versand: eine Datenbankfunktion prüft unter einer Transaktionssperre pro Träger „läuft schon“, die Grenze der Lizenz und die des Trägers und trägt den Versuch ein; erst dann geht die Mail raus | **Garantie für EC-1, EC-2, AC-7 und AC-8:** Prüfen und Eintragen liegen in einer Transaktion, laufende Versuche zählen mit. Die zweite von zwei gleichzeitigen Anfragen wartet und sieht die Reservierung der ersten (Pack: „Count before the check“, wie die Login-Bremse). | Nach dem Versand zählen (Lücke, durch die gleichzeitige Anfragen rutschen); Upstash Redis | Beginn-Aufrufe eines Trägers laufen nacheinander, nur für Millisekunden; die Wartezeit auf Mailjet liegt außerhalb der Sperre | 2026-10-26 |
| Versandstände und Versendungen schreiben nur zwei Funktionen, die allein der Server-Schlüssel ausführen darf; Verwalter lesen nur über RLS | **Garantie für AC-9:** Was die App mit dem Token des Verwalters darf, darf er auch direkt über die Daten-API. Dürfte er die Funktionen aufrufen, könnte er Versandstände setzen oder einen angenommenen Versand als fehlgeschlagen abschließen und so an der Grenze vorbeisenden. | Funktionen für `authenticated` mit Prüfung der Mitgliedschaft; Schreibrechte mit RLS | Der Server-Schlüssel steckt im Versandweg und liest die Teilnehmer-Adresse. Abgesichert: Die Funktionen prüfen den Träger, schreiben keine Adresse, und ihre Fehlertexte enthalten keine (PROJ-2 O-1). | 2026-10-26 |
| Vor „Senden“ liest die App die Lizenz mit der Sitzung des Verwalters | Zweite, unabhängige Sperre per RLS hinter der Prüfung in der Funktion (Sicherheitsregeln, Spec: Datentrennung zweifach) | Nur die Prüfung in der Funktion mit der Träger-ID aus dem Wächter | Eine Abfrage mehr pro Klick | 2026-10-26 |
| Versandstand mit genau `status` und `last_attempt_at`, eine Zeile pro Lizenz mit der Lizenz-ID als Schlüssel | AC-12 setzt die Obergrenze, und mehr braucht die Anzeige nicht. Die Lizenz-ID als Schlüssel macht „höchstens eine Einladung pro Lizenz“ zur Regel der Datenbank. | Zusätzlich `sent_count`; eigene ID | `docs/data-model.md` sagte „wie oft versucht“. Das zählen jetzt die Versendungen. | 2026-10-26 |
| Versendungen in einer eigenen Tabelle in `private`, mit Verweis auf die Lizenz, der beim Entziehen geleert wird | **Garantie für EC-6, AC-8 und EC-5:** Die Grenze der neuen Lizenz beginnt bei null, die des Trägers überlebt das Entziehen, und nichts verweist mehr auf die entzogene Lizenz. Ein Eintrag pro Versendung erlaubt ein echtes gleitendes 24-Stunden-Fenster und den Zeitpunkt „ab“. | Zähler mit Fensterbeginn (lässt im Grenzfall bis zu 6 Mails in 24 Stunden zu); Löschkaskade an der Lizenz (Grenze des Trägers wäre nach dem Entziehen weg) | Bis zu 24 Stunden bleibt eine Zeile mit Träger und Zeitpunkt, ohne Adresse und ohne Verweis | 2026-10-26 |
| Es zählen nur angenommene Versendungen; die Reservierung zählt, solange sie läuft, ein Fehlschlag löscht sie; eine Reservierung, die 2 Minuten alt ist, zählt nicht mehr | Produktentscheidung der Spec („nur was rausgeht“) und EC-1 („nur der laufende Versand zählt“). Ein hängender Versuch gilt in der Liste als fehlgeschlagen und deshalb auch bei der Grenze. | Hängende Versuche weiter zählen | Stürzt der Server nach der Annahme durch Mailjet ab, zählt diese Mail nicht. Selten und nicht von außen auslösbar. | 2026-10-26 |
| „Wird versendet“ nach 2 Minuten wird beim Lesen als „Fehlgeschlagen“ angezeigt und von der Beginn-Funktion als beendet behandelt | **Garantie für EC-3** ohne Job und ohne Schreibzugriff beim Lesen | Job, der hängende Versuche umschreibt | In der Datenbank steht bis zum nächsten Versuch weiter `sending`. Das steht in den Hinweisen für `/qa`. | 2026-10-26 |
| Der Abschluss ändert den Versandstand nur, wenn `last_attempt_at` noch zum Versuch passt | Ein später Abschluss eines hängenden Versuchs überschreibt nie das Ergebnis eines neueren (EC-3, EC-4). Unter der Sperre hat jeder Versuch einer Lizenz einen eigenen Zeitpunkt. | Eigene Versuchs-ID am Versandstand (ein Feld mehr, gegen AC-12) | keiner | 2026-10-26 |
| Aufräumen alle 5 Minuten, Grenze 24 Stunden, eigener Job | AC-12 verlangt das Löschen nach 24 Stunden, und die Grenzen zählen volle 24 Stunden. Der stündliche Job aus PROJ-1 mit 23 Stunden würde die Grenze verkürzen, stündlich mit 24 Stunden blieben Zeilen bis zu 25 Stunden. | Job von PROJ-1 erweitern; Löschen nur beim nächsten Versand | Zeilen leben bis zu 24 Stunden und 5 Minuten. 288 Läufe am Tag in der Laufliste von `pg_cron`. | 2026-10-26 |
| Der Versand nach dem Zuweisen startet in `assignLicense`, nicht per Datenbank-Trigger | Eine Mail kann nur der Server schicken. Ein Trigger würde für direkt über die API angelegte Lizenzen einen Versandstand „Wird versendet“ ohne Mail erzeugen. | Trigger auf `licenses` | Eine direkt über die Daten-API angelegte Lizenz steht auf „Noch nicht eingeladen“. Das ist gewollt (keine Mail, die die App nicht auslöst). | 2026-10-26 |
| Mailinhalt im Code (pures Modul), als Text- und HTML-Fassung, Trägername maskiert und mit U+200B nach „.“, „@“, „:“ und „/“ | **Garantie für EC-7 und AC-2:** Der Name wird nie zu HTML und nie zu einem Link, auch nicht durch die automatische Verlinkung der Mailprogramme. Der Inhalt liegt im Repository und ist testbar. | Vorlagen bei Mailjet (außerhalb des Repositorys, eigene Vorlagensprache); Name nur maskieren | Wer den Namen aus der Mail kopiert, kopiert unsichtbare Zeichen mit | 2026-10-26 |
| Die Empfängeradresse steht nicht im Mailtext | AC-2: außer dem Trägernamen nichts, was der Verwalter beeinflussen kann. Die Adresse hat er eingegeben. | „Melden Sie sich mit <Adresse> an“ | Der Teilnehmer muss selbst wissen, an welche Adresse die Mail ging. Absatz 4 sagt es ihm. | 2026-10-26 |
| Einstellungen werden erst beim Senden gelesen und geprüft; das Linkziel muss `https:` oder `http:` sein | **Garantie für EC-9:** Die App startet ohne sie, Zuweisen klappt, jeder Versand endet als „Fehlgeschlagen“. Ein `javascript:`-Link kann nie in eine Mail geraten. | Prüfung beim Start (App startet nicht) | Ein Tippfehler fällt erst beim ersten Versand auf. Die Konsole nennt die Ursache ohne Geheimnisse. | 2026-10-26 |
| Eigener Ordner `src/features/invitations/`; `licenses` importiert von dort, nie umgekehrt; zwei Texte von PROJ-2 doppelt mit Vergleichstest | Ein Feature pro Ordner (Pack). Der Strukturprüfer lehnt Kreise ab. | Alles in `src/features/licenses/` | Zwei Texte stehen zweimal im Code, ein Test hält sie gleich | 2026-10-26 |
| Die Liste liest den Versandstand in derselben Anfrage wie die Lizenzen | Ein Stand, eine Fehlerbehandlung: Scheitert das Lesen, gilt der Ladefehler aus PROJ-2 EC-6 wie bisher. | Zweite Abfrage in der Seite | Das Datenmodul von PROJ-2 kennt jetzt die Tabelle von PROJ-3 | 2026-10-26 |
| Toasts in drei Arten; das Ergebnis des Versands steht als Zusatzzeile im Toast „Lizenz zugewiesen“ | AC-1, AC-3 und AC-8 verlangen „Lizenz zugewiesen“ mit Zusatz. Eine Warnung zeigt, dass die Zuweisung gelungen ist, der Folgeschritt aber nicht. | Zwei Toasts nacheinander | Die Rückmeldung von PROJ-2 bekommt eine dritte Art | 2026-10-26 |
| Die Uhrzeit „ab“ wird auf die volle Minute aufgerundet | Abgerundet wäre der Knopf zur genannten Minute noch gesperrt | Sekundengenau | Der Verwalter wartet bis zu einer Minute länger als nötig | 2026-10-26 |

## Abdeckung der Acceptance Criteria

| AC / EC | Wo es im Design gelöst ist |
|---|---|
| AC-1 | Zuweisen → `deliverInvitation`, Darstellung der Ergebnisse, Versandstand „Versendet am“ |
| AC-2 | Mailjet aufrufen (Absender, keine Antwortadresse), Inhalt der Einladung, Betreff ohne Trägernamen |
| AC-3 | Mailjet aufrufen (Zeitgrenze, „angenommen“), Abschluss-Funktion, Warn-Toast |
| AC-4 | Versandstand in der Liste, Übersicht lesen, Knopf |
| AC-5 | `sendInvitation`, dieselbe Mail, `refresh()`, Darstellung der Ergebnisse |
| AC-6 | keine Zeile = „Noch nicht eingeladen“, keine Migration der Altbestände, „Einladung senden“ |
| AC-7 | Beginn-Funktion Schritt 4, Meldungstexte, Zeitpunkt „ab“ |
| AC-8 | Beginn-Funktion Schritt 5, Versendungen überleben das Entziehen, Warn-Toast beim Zuweisen |
| AC-9 | Zugriffsregeln, Funktionen nur für `service_role`, Sichtbarkeitsprüfung, Adresse nur aus der Lizenz |
| AC-10 | Inhalt der Einladung, Absatz 7 |
| AC-11 | `TrackOpens`/`TrackClicks` aus, keine Bilder, Konto-Einstellung, Prüfung der echten Mail in `/build` |
| AC-12 | Datenmodell (zwei Felder bzw. keine Adresse), Löschkaskade, Leeren des Verweises, Aufräumjob |
| EC-1 | Sperre + „läuft schon“ in der Beginn-Funktion, gesperrter Knopf |
| EC-2 | Sperre + Reservierung zählt bei der Grenze des Trägers |
| EC-3 | Anzeigezustand nach 2 Minuten, Beginn-Funktion Schritt 3, Abschluss nur für den passenden Versuch |
| EC-4 | kein Wiederholen, neuer Versuch überschreibt den Stand |
| EC-5 | Löschkaskade, Leeren des Verweises, Sichtbarkeitsprüfung → „bereits entzogen“ |
| EC-6 | neue Lizenz-ID, Versendungen der alten ohne Verweis zählen für den Träger |
| EC-7 | Trägername maskiert und entschärft, Textfassung |
| EC-8 | Adresse unverändert aus der Lizenz an Mailjet |
| EC-9 | Einstellungen beim Senden geprüft, „fehlgeschlagen“ ohne technische Meldung |
| EC-10 | Antwort auswerten (`TypeError`), Toast „Keine Verbindung“ |
| EC-11 | Wächter in `sendInvitation` |
| EC-12 | kein Kontingent im Versandweg |

## Offene Fragen (Open Questions)

- [x] **Für `/build`, mit einer echten Testmail klären:** Fügt Mailjet im kostenlosen Tarif ein Logo oder einen Hinweis in Mails ein, die über die Send API gehen? Drittquellen sagen „Mailjet-Logo im Free-Tarif“, ohne zwischen Kampagnen und Transaktionsmails zu unterscheiden. Wenn ja, ist AC-11 („keine Werbung“) mit dem kostenlosen Mailjet nicht erfüllbar, und das Design muss zurück zu `/architecture`.
  - **Geklärt am 2026-10-27 (Probeversand):** Nein. Die Mail kam ohne Logo, ohne Werbetext und ohne Bild an. Details unter „Umsetzungsnotizen“.
- [x] **Für `/build`:** Muss ein neues Mailjet-Konto vor dem ersten Versand an fremde Adressen erst von Mailjet freigeschaltet werden? Falls ja, gehört der Schritt in die README.
  - **Geklärt am 2026-10-27:** Nein. Die erste Mail kam ohne Freischaltung bei einer anderen Adresse als der Absenderadresse an. Die README nennt deshalb keinen solchen Schritt.
- Die rechtlichen und produktseitigen Fragen (Umfang des Datenschutzhinweises, Adresse der Plattform, Löschregel bei Mailjet) stehen in `spec.md`.

## Umsetzungsnotizen (`/build`)

Gebaut in sechs Stufen auf `feat/PROJ-3-invitation-email` (Commits `cf1e19f` bis `181c9f1`). Am Ende lief `npm run check` einmal vollständig grün: Lint, Typen, Struktur, 855 Tests und der Produktions-Build.

### Am gehosteten Projekt bestätigt

Alle Punkte aus „Für `/build`, am gehosteten Projekt per Test bestätigen“ sind belegt:

- **`src/test/db/invitations.test.ts`** (19 Tests) prüft:
  - die Löschkaskade und das Leeren des Verweises beim Entziehen, ohne Rechte des Verwalters;
  - das Einbetten in `listLicenses` (ein Objekt oder `null`);
  - die Funktionen, die mit dem öffentlichen Schlüssel und mit dem Token eines Verwalters nicht aufrufbar sind;
  - EC-1 und EC-2 bei gleichzeitigen Aufrufen.
- **Schema `private`, per SQL in einer zurückgerollten Transaktion:**
  - Der Aufräumjob ist alle 5 Minuten eingeplant. Seine Funktion löscht Zeilen, die älter als 24 Stunden sind, und lässt jüngere stehen.
  - Ein `pending`-Versand zählt nur 2 Minuten.
- **Gegenprobe:** Für jede Testdatei waren alle Tests mindestens einmal rot. Bei der Datenbank wurden dafür die Schutzregeln im gehosteten Projekt kaputt gemacht und danach aus der Migration wiederhergestellt, mit Prüfsumme über Funktionen, Regeln, Rechte und Spalten.

### Probeversand (2026-10-27)

- Eine echte Einladung ging über `mailjet.integration.ts` an eine eigene Gmail-Adresse. Mailjet antwortete mit **HTTP 200** und `Status: success`.
- **In der Mail:** kein Logo, kein Werbetext, kein Bild, der Datenschutzhinweis ist vollständig. Der Trägername (`Probe-Akademie <b>fett</b> www.beispiel.de`) stand als reiner Text da, ohne Fettdruck und ohne Link (EC-7).
- **Zustellung:** Die Mail landete im **Spam-Ordner**, Gmail zeigte sie als „Lizenzzentrale über bnc3.mailjet.com“. Das ist bei einer Gmail-Absenderadresse ohne eigene Domain zu erwarten. Abhilfe schafft T23 (eigene Domain mit SPF und DKIM) vor dem Live-Gang. Die README weist auf den Spam-Ordner hin.
- **Nicht ausdrücklich geprüft:** das Linkziel des Knopfs (Mauszeiger oder Quelltext) und dass keine Antwortadresse gesetzt ist. Der Code setzt Klick- und Öffnungsverfolgung pro Mail aus und keine Antwortadresse. Der Hinweis zu AC-11 unter „Hinweise für `/qa`“ deckt beides ab.

### Browsertest (T19, 2026-10-27)

- **Ablauf:** Gegen `http://localhost:3000` mit einem vorübergehend registrierten Träger. Zuweisen an eine eigene Gmail-Adresse mit `+`-Zusatz, Erneut senden, Neuladen, Smartphone-Breite, Entziehen. Danach wurden Konto und Träger wieder gelöscht.
- **Zuweisen:** Erfolgs-Toast „Lizenz zugewiesen“ mit „Die Einladung ist versendet.“ nach etwa 1 Sekunde, in der Liste „Versendet am 27.10.2026“.
- **Erneut senden:** Direkt nach dem Klick steht `aria-busy` auf `true`, danach kommt „Einladung versendet“. Nach dem Neuladen steht derselbe Stand da.
- **Smartphone-Breite (375 px):** Die Karte zeigt „Einladung:“ mit dem Badge, der Knopf ist 44 px hoch und volle Breite. Die Seite scrollt nicht seitlich. In der Tabelle ist der Knopf 36 px hoch gezeichnet.
- **Konsole:** Einzige Meldung ist ein 404 auf `/favicon.ico`. Das Projekt hat kein Favicon, das hat nichts mit PROJ-3 zu tun.

### Abweichungen vom Design

1. **„Angenommen“ heißt jede 2xx-Antwort** von Mailjet, zusammen mit `Status: success` der einen Nachricht. Das Design nannte nur HTTP 200. Mailjets API-Beschreibung nennt 201 als Erfolgscode, die Probe bekam 200. Mit „nur 200“ wäre bei 201 jede Mail als fehlgeschlagen gezählt worden.
2. **Steuerzeichen und Zeilen- oder Absatztrenner im Trägernamen werden zu einem Leerzeichen.** Das gilt zusätzlich zur Regel mit U+200B. So beginnt der Name nie einen eigenen Absatz (AC-2).
3. **`buildInvitationMail` wirft bei einem Linkziel, das nicht aus `platformUrlFrom` stammt.** Damit gelangt ein ungeprüfter Link nie in eine Mail. `deliverInvitation` fängt das ab und meldet „fehlgeschlagen“.
4. **Die Mailjet-Werte aus der Umgebung werden vor der Prüfung auf „leer“ getrimmt.**
5. **Texte mit Platzhaltern sind Funktionen** in `invitations.rules.ts`, keine Konstanten: die Grenzen mit Zeitpunkt und die Namen der Knöpfe für Screenreader.
6. **„Nicht gefunden“ aus der Beginn-Funktion zeigt beim Senden „Diese Lizenz wurde bereits entzogen.“** Das passiert, wenn die Lizenz zwischen Sichtprüfung und Versand entzogen wurde.
7. **`deliverInvitation` schließt einen reservierten Versand immer ab, auch nach einer Ausnahme**, dann mit „nicht angenommen“. Im Design stand das nur für ein ungültiges Linkziel. Bei einer unerwarteten Ausnahme schreibt es genau eine feste Zeile auf die Server-Konsole: „Einladung: unerwarteter Fehler beim Versand“, ohne Fehlerdetails, ohne Adresse und ohne Namen.
8. **Das Badge hat `rounded-md` statt `rounded-full`.** Grund ist `docs/design-system.md` → Radius: Das gilt auch für Badges, nur Avatare sind rund. Geändert ist es nur hier, nicht in `src/components/ui/badge.tsx`.
9. **Die Kartenzeile „Einladung:“ ist ein `div`, kein `p`.** Das Badge rendert ein `div`, und ein `div` in einem `p` bricht die Hydration. Ein Test schließt diese Verschachtelung aus.

### Entscheidungen in der Datenbank, die das Design offen ließ

- **Die Beginn-Funktion nimmt die Zeit erst nach der Sperre**, mit `clock_timestamp()`, nicht mit `now()`. `now()` wäre der Start der Transaktion. Nach dem Warten an der Sperre läge er vor der Reservierung des vorigen Aufrufs.
- **Die Lizenz wird mit `for key share` gelesen.** Ein gleichzeitiges Entziehen wartet so, bis Versandstand und Versendung angelegt sind, und der Fremdschlüssel kann nicht scheitern.
- **Die Abschluss-Funktion nimmt dieselbe Sperre pro Träger wie die Beginn-Funktion.** Abschluss und ein neuer Beginn laufen dadurch nicht gegeneinander.
- **`available_from` geht als ISO-Zeitpunkt (UTC) an die App.** `invitations.data.ts` normalisiert ihn.

### Hinweise für `/qa`

- **WCAG 2.5.3 („Label in Name“):** Der Screenreader-Name „Einladung an <Adresse> senden“ enthält den sichtbaren Text „Einladung senden“ nicht zusammenhängend. Bei „Erneut senden“ ist der sichtbare Text bis auf die Großschreibung enthalten. Die Texte stammen so aus dem Design. Ob das ein Befund ist, entscheidet `/qa`.
- **Arbeitskopien der Subagenten:** Solange sie unter `.claude/worktrees/` liegen, sammelt Vitest deren Testdateien mit ein. Einzelläufe deshalb mit `--exclude '.claude/**'` starten. Beim Abschluss von `/build` waren alle Arbeitskopien entfernt.
