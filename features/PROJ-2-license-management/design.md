# PROJ-2: Lizenzverwaltung — Technisches Design

> Das technische Design (das WIE) für dieses Feature. Es hat zwei Leser: den Betreiber, der es freigibt, und `/build`, das danach baut. Es enthält keinen Code, ist aber so genau, dass beim Bauen niemand raten muss.
> Zuständig: `/architecture`. Der Vertrag (das WAS) steht in `spec.md`, die Aufgabenliste in `tasks.md`.
> Kein Status- oder Datumsfeld: Der Status steht nur in `features/INDEX.md`.

## Überblick

- **Eine Seite, zwei Aktionen.** Die Lizenzübersicht `/licenses` liest Kontingent und Lizenzen auf dem Server und zeigt sie an. Zuweisen und Entziehen sind Server Actions, also POST. Nach jeder Aktion frischt die Action die Seite auf (`refresh()` aus `next/cache`). So stimmen Zahlen und Liste ohne Neuladen (AC-1).
- **Gelesen und geschrieben wird mit der Sitzung des Verwalters, nie mit dem Server-Schlüssel.** Damit gilt Row Level Security für jede Anfrage. Die Datentrennung sitzt zweimal: Die App nimmt den Träger aus dem Wächter und filtert danach, die Datenbank lässt nur Zeilen des eigenen Trägers zu (AC-10).
- **Kontingent und „eine Lizenz pro Adresse“ hält die Datenbank ein.** Ein Trigger prüft vor jedem Anlegen, pro Träger nacheinander. Von zwei gleichzeitigen Anfragen auf die letzte freie Lizenz kommt so genau eine durch (AC-7, EC-1, EC-2). Die Oberfläche sperrt nur den Knopf, entschieden wird in der Datenbank.
- **Entziehen löscht die Zeile.** Es bleibt kein Vermerk und keine Kopie. Lizenzen hängen per Löschkaskade am Träger (AC-11).
- **Neu ist nur die Tabelle `public.licenses` mit ihrem Trigger.** Es gibt keine neue Umgebungsvariable, kein neues Paket und keinen neuen Dienst.

## Komponentenstruktur (Component Structure)

### Seite

```
Rahmen angemeldet — (app)/layout (PROJ-1, unverändert: Kopfzeile, Wächter, Hinweis bei „nicht zugeordnet“)
+-- /licenses — Lizenzübersicht (Server-Seite, ruft den Wächter)
    +-- Seitenkopf
    |   +-- Titel „Lizenzübersicht“ (type-title)
    |   +-- Hauptaktion „Lizenz zuweisen“ (rechts; Smartphone: volle Breite darunter)
    |       → öffnet den Dialog „Lizenz zuweisen“
    |       gesperrt, solange keine Lizenz frei ist (AC-7, AC-9, EC-4)
    |
    +-- Kontingent-Anzeige (Karte)
    |   +-- „2 von 5 Lizenzen vergeben“ (type-section, tabular-nums) · „3 frei“ (type-body)
    |   +-- Balken (progress) mit dem vergebenen Anteil
    |
    +-- Hinweis zum Kontingent (shadcn alert, nur wenn keine Lizenz frei ist)
    |   +-- „ausgeschöpft“ (AC-7, EC-4)  oder  „überschritten“ (AC-9)
    |
    +-- Abschnitt „Vergebene Lizenzen“ (type-section)
    |   +-- ab md: Tabelle
    |   |   E-Mail-Adresse · Zugewiesen am · [Platz für PROJ-3: Einladung] · Entziehen
    |   +-- unter md: eine Karte pro Lizenz
    |   |   Adresse, darunter Datum (type-small), „Entziehen“ in voller Breite
    |   +-- leer (AC-3): gedämpftes Symbol, „Noch keine Lizenz vergeben. Weisen Sie die erste zu.“
    |       und ein Knopf „Lizenz zuweisen“ (outline), der denselben Dialog öffnet.
    |       Nur wenn mindestens eine Lizenz frei ist. Bei Kontingent 0 entfällt der Abschnitt ganz (EC-4).
    |
    +-- Ladefehler (EC-6): unter dem Titel nur die Hinweisbox
        „Die Lizenzen konnten nicht geladen werden.“ mit dem Knopf „Erneut versuchen“.
        Keine Hauptaktion, keine Anzeige, keine Liste.

/licenses lädt — loading.tsx
+-- Titel „Lizenzübersicht“, Skeleton der Hauptaktion, Skeleton der Anzeige, drei Skeleton-Zeilen der Liste
```

### Dialoge

```
Dialog „Lizenz zuweisen“ (shadcn dialog)
+-- Titel „Lizenz zuweisen“
+-- Text „Geben Sie die E-Mail-Adresse des Teilnehmers ein.“
+-- Feld „E-Mail-Adresse des Teilnehmers“, Feldfehler darunter mit Symbol
+-- Hinweisbox für Fehler vom Server (über den Knöpfen, role="alert")
+-- „Abbrechen“ (outline) · „Zuweisen“ (default)   — Smartphone: untereinander, volle Breite

Bestätigungsdialog „Entziehen“ (shadcn alert-dialog)
+-- Titel „Lizenz von <Adresse> entziehen?“
+-- Text „Die Lizenz ist danach sofort wieder frei.“
+-- Hinweisbox für Fehler vom Server
+-- „Abbrechen“ (hat beim Öffnen den Fokus) · „Entziehen“ (destructive)
```

### Regeln für Anzeige und Liste

- **Zahlen:** vergeben = Zahl der gelesenen Lizenzen, Kontingent = `license_quota` aus dem Wächter, frei = Kontingent minus vergeben, mindestens 0.
- **Text der Anzeige:** „X von Y Lizenzen vergeben“. Bei Y = 1 heißt es „Lizenz“ („0 von 1 Lizenz vergeben“). Daneben steht „Z frei“.
- **Zustand des Kontingents**, genau einer von drei:
  - **verfügbar:** frei > 0. Nur in diesem Zustand ist Zuweisen möglich.
  - **ausgeschöpft:** frei = 0 und vergeben ≤ Kontingent, auch bei 0 von 0 (EC-4). Hinweis aus AC-7.
  - **überschritten:** vergeben > Kontingent (AC-9). Hinweis aus AC-9.
- **Balken:** vergeben geteilt durch Kontingent, in Prozent, höchstens 100. Bei Kontingent 0 steht er auf 100. Spur in `--muted`, Füllung in `--primary` (`docs/design-system.md`). Für Screenreader heißt er „Vergebene Lizenzen“, sein Wert wird als derselbe Text wie in der Anzeige vorgelesen.
- **Hinweis:** shadcn `alert` in der Standardvariante. „Ausgeschöpft“ trägt das Info-Symbol, „überschritten“ ein Warnsymbol. Das Wort trägt den Zustand, das Symbol unterstützt nur. Der gesperrte Knopf „Lizenz zuweisen“ verweist für Screenreader auf diesen Hinweis.
- **Reihenfolge:** die zuletzt zugewiesene oben, also nach `assigned_at` absteigend. Bei gleichem Zeitpunkt entscheidet die ID, damit die Reihenfolge stabil bleibt. Alle Lizenzen stehen auf einer Seite.
- **Datum:** „TT.MM.JJJJ“ in der Zeitzone Europe/Berlin, in einem `time`-Element mit dem vollen Zeitpunkt.
- **Adresse (EC-8):** immer als reiner Text, nie als HTML. Sie darf an jeder Stelle umbrechen (in Tabelle, Karte und Dialogtitel), damit nichts seitlich herausragt. Die Spalte und der Knopf „Entziehen“ schrumpfen nie.
- **Knopf „Entziehen“:** sichtbarer Text „Entziehen“, für Screenreader „Lizenz von <Adresse> entziehen“. In der Tabelle ist er klein gezeichnet (36 px), hat aber eine Tippfläche von 44 × 44 px. In der Karte ist er 44 px hoch und volle Breite. Variante `destructive`.
- **Tabelle:** Spaltenköpfe „E-Mail-Adresse“, „Zugewiesen am“ und „Aktion“. „Aktion“ ist nur für Screenreader sichtbar. Unter `md` ist die Tabelle ausgeblendet und die Kartenliste sichtbar, darüber umgekehrt. Ausgeblendet heißt `display: none`, damit Screenreader die Liste nur einmal lesen.

### Regeln für die Dialoge

- **Beim Öffnen von „Lizenz zuweisen“** ist das Feld leer, es steht kein Fehler da, und das Feld hat den Fokus.
- **Feld:** Typ E-Mail, Autovervollständigen aus (es ist nicht die Adresse des Verwalters), 44 px hoch, 16 px Schrift. Feldfehler darunter mit Symbol, nie nur als rote Rahmenfarbe.
- **Absenden** wie in PROJ-1: Das Formular trägt `method="post"`, der Handler verhindert das native Absenden und ruft die Action selbst auf. Vorher prüft der Browser mit demselben Schema wie der Server.
- **Während des Sendens** sind beide Knöpfe gesperrt, „Zuweisen“ bzw. „Entziehen“ trägt `aria-busy`. Escape und ein Klick daneben schließen den Dialog erst nach der Antwort (EC-2).
- **Der Bestätigungsdialog** schließt beim Klick auf „Entziehen“ nicht sofort, sondern erst nach der Antwort.
- **Antwort auswerten** wie in PROJ-1: Eine Weiterleitung nach `redirect()` ist kein Fehler. Kommt gar keine Antwort (`fetch` scheitert mit `TypeError`), gilt „Keine Verbindung“. Jeder andere Fehler gilt als „Das hat nicht geklappt“.
- **Was erscheint wo** steht unter „Darstellung der Ergebnisse“.

## Code-Struktur (Code Structure)

Nach dem Next.js-Pack (`docs/stacks/framework-nextjs.md` → Code structure). Die Umsetzung liegt in `src/features/licenses/`. Die Route `src/app/(app)/licenses/` hängt sie nur ein.

| Modul / Pfad | Aufgabe und Schnittstelle | Erlaubte Abhängigkeiten |
| --- | --- | --- |
| `src/features/licenses/licenses.rules.ts` (pure) | Alle Texte von PROJ-2 an einer Stelle. Zustand des Kontingents aus (vergeben, Kontingent): vergeben, Kontingent, frei, Anteil in Prozent, Zustand (verfügbar / ausgeschöpft / überschritten). Text der Anzeige mit Einzahl und Mehrzahl. Datum der Zuweisung als „TT.MM.JJJJ“ in Europe/Berlin. Ergebnis einer Aktion → Meldung. | `src/features/account/account.rules.ts` (nur die Texte „Keine Verbindung“ und „nicht zugeordnet“, damit es eine Quelle bleibt) |
| `src/features/licenses/licenses.schema.ts` (pure) | Eingaberegeln für Zuweisen (E-Mail-Adresse) und Entziehen (Lizenz-ID), eine Quelle für Browser und Server | Zod, `licenses.rules.ts` |
| `src/features/licenses/licenses.data.ts` (server-only) | `listLicenses(Träger-ID)` → Liste (ID, Adresse, Zeitpunkt) oder „Ladefehler“. `insertLicense(Träger-ID, Adresse)` → „angelegt“ mit ID, „schon vergeben“, „ausgeschöpft“ oder „Fehler“. `deleteLicense(Träger-ID, Lizenz-ID)` → „entzogen“, „nicht gefunden“ oder „Fehler“. Übersetzt die Fehlercodes der Datenbank in diese Ergebnisse (siehe „Abläufe und Zugriff“). | Server-Client `src/lib/supabase/server.ts`. **Nie** den Admin-Client. |
| `src/features/licenses/licenses.actions.ts` (`'use server'`) | `assignLicense(Eingabe)` und `revokeLicense(Eingabe)`: Wächter, Schema, Datenzugriff, `refresh()`, Ergebnis | `src/features/account/session.data.ts` (Wächter), Schema, Regeln, Datenmodul, `next/cache` |
| `src/features/licenses/components/quota-summary.tsx` | Kontingent-Anzeige mit Balken und Hinweis. Bekommt den Zustand als Wert. | Regeln, shadcn `card`, `progress`, `alert` |
| `src/features/licenses/components/license-list.tsx` | Tabelle, Kartenliste und leerer Zustand. Bekommt Liste und Zustand als Wert. | Regeln, die beiden Dialog-Bauteile, shadcn `table` |
| `src/features/licenses/components/assign-license-dialog.tsx` (Client) | Auslöseknopf und Dialog „Lizenz zuweisen“. Werte: gesperrt ja/nein, Art des Knopfs (Hauptaktion oder leerer Zustand). | Action, Schema, Regeln, `src/components/form-feedback.tsx`, shadcn `dialog`, `form`, `input`, `button`, `sonner` |
| `src/features/licenses/components/revoke-license-dialog.tsx` (Client) | Knopf „Entziehen“ und Bestätigungsdialog. Werte: Lizenz-ID, Adresse, Darstellung (klein oder volle Breite). | Action, Regeln, `form-feedback.tsx`, shadcn `alert-dialog`, `button`, `sonner` |
| `src/features/licenses/components/licenses-load-error.tsx` (Client) | Hinweisbox aus EC-6 mit „Erneut versuchen“. Der Knopf lädt die Seite über den Router neu, ohne den Browser neu zu laden, und ist dabei gesperrt. | Regeln, shadcn `alert`, `button`, `next/navigation` |
| `src/features/licenses/components/licenses-skeleton.tsx` | Skeletons in der Form der Seite | shadcn `skeleton` |
| `src/components/form-feedback.tsx` (verschoben aus `src/features/account/components/`) | Unverändert: Feldfehler mit Symbol, Formular-Hinweisbox, Erkennen der Weiterleitung und des Verbindungsfehlers. Die Hinweisbox bekommt nur noch die Meldung als Text, weil geteilter Code nichts aus einem Feature importiert. Login und Registrierung importieren von hier. | shadcn `alert`, `form`, `lucide-react` |
| `src/app/(app)/licenses/page.tsx` (ersetzen) | Wächter, `listLicenses`, Zustand berechnen, Bauteile zusammensetzen. Bleibt dynamisch (`no-store`), Titel „Lizenzübersicht“ bleibt. | Wächter, Datenmodul, Regeln, Bauteile |
| `src/app/(app)/licenses/loading.tsx` (neu) | zeigt die Skeletons, solange die Seite lädt | `licenses-skeleton.tsx` |

- Die Bauteile importieren **nie** `licenses.data.ts`. Die Seite liest und gibt die Werte weiter.
- Tests liegen neben dem Modul, das sie prüfen. `form-feedback.test.tsx` wandert mit. Die Datenbanktests (Rechte, Trigger, gleichzeitige Anfragen, Löschkaskade) liegen wie in PROJ-1 in `src/test/db/licenses.test.ts`.

## Footprint

- **Code und Tests:** die Module der Tabelle oben, mit Tests daneben, dazu `src/test/db/licenses.test.ts`. Von PROJ-1 wird nur `form-feedback.tsx` verschoben, ohne Änderung im Verhalten. Login- und Registrierungsformular bekommen den neuen Importpfad.
- **Migrationen, Tabellen, Regeln:** `supabase/migrations/<Zeit>_proj2_licenses.sql` mit:
  - Tabelle `public.licenses` und ihren Regeln
  - drei RLS-Regeln (Lesen, Anlegen, Löschen)
  - ausdrücklich gesetzten Rechten
  - Prüffunktion `private.enforce_license_rules` und Trigger `enforce_license_rules`
- **Umgebungsvariablen:** keine neuen.
- **Pakete:** keine neuen.
- **Einhängepunkte:** Inhalt der Route `/licenses` und `loading.tsx` daneben. Rahmen, Kopfzeile und Tor bleiben unverändert. Kein externer Dienst (die Einladungs-E-Mail kommt mit PROJ-3).

## Datenmodell (Data Model)

### Lizenz — `public.licenses`

| Feld | Typ und Regeln |
|---|---|
| `id` | UUID, von der Datenbank erzeugt, Primärschlüssel |
| `training_provider_id` | Verweis auf `training_providers`, Pflicht. Wird der Träger gelöscht, verschwinden seine Lizenzen mit (Löschkaskade, AC-11). |
| `email` | Text, Pflicht, die Adresse des Teilnehmers. Gespeichert ohne Leerzeichen und kleingeschrieben. **Regel der Spalte:** höchstens 254 Zeichen, gleich ihrer kleingeschriebenen Form und im Format genau die Regel der App (das Muster von `z.email()`). Die Spalte nimmt also genau die Adressen an, die die App speichern würde (seit BUG-1, siehe Umsetzungsnotizen). |
| `assigned_at` | Zeitpunkt, Pflicht, Standard: jetzt. Setzt immer die Datenbank. |

- **Eindeutig:** (`training_provider_id`, `email`). Pro Träger hat eine Adresse höchstens eine Lizenz (AC-6). Weil die Adressen normalisiert gespeichert sind, gilt das unabhängig von Groß- und Kleinschreibung. Zwei Träger dürfen dieselbe Adresse haben. Der eindeutige Schlüssel dient zugleich als Index für das Lesen pro Träger, das Zählen im Trigger und den Fremdschlüssel. Einen weiteren Index gibt es nicht.
- **Keine weiteren Felder (AC-12):** kein Name, kein „entzogen“-Vermerk, kein `created_at` neben `assigned_at`, kein `updated_at`. Eine Lizenz ändert sich nie.
- **Angelegt:** nur über Zuweisen, mit der Sitzung des Verwalters. **Geändert:** nie. **Gelöscht:** beim Entziehen oder per Kaskade mit dem Träger.
- **Gelesen:** von den Verwaltern des eigenen Trägers.
- **Aufbewahrung:** bis die Lizenz entzogen oder der Träger gelöscht wird. Dann ist die Adresse sofort und ohne Rest weg (AC-11).
- **Später:** Für die Kopplung an ein Lernkonto kommt ein optionaler Verweis dazu, in der Plattform wie bei `enrollments` als `user_id` auf `profiles`. Dafür muss nichts umgebaut werden. PROJ-3 hängt `license_invitations` per Löschkaskade an die Lizenz (`docs/data-model.md`).

### Prüfung vor dem Anlegen — Trigger `enforce_license_rules`

Der Trigger läuft vor dem Anlegen jeder Zeile, mit der Funktion `private.enforce_license_rules`. Die Funktion läuft **mit den Rechten des Aufrufers** (security invoker) und mit festem, leerem Suchpfad. Sie sieht also nur, was RLS dem Aufrufer zeigt.

1. **Sperre:** Sie nimmt eine Transaktionssperre auf den Träger der neuen Lizenz (advisory lock, Schlüssel aus `licenses:` und der Träger-ID). Alle Anlagen eines Trägers laufen damit nacheinander, bis die jeweilige Transaktion endet.
2. **Träger sichtbar?** Sie liest das Kontingent des Trägers. Sieht der Aufrufer den Träger nicht, weil er fremd ist oder nicht existiert, bricht sie ab: Code `42501`, Meldung `training_provider_not_accessible`. Fremd und nicht vorhanden sehen gleich aus. Sie zählt nichts und prüft keine Adresse.
3. **Schon vergeben?** Hat der Träger schon eine Lizenz mit dieser Adresse, bricht sie ab: Code `23505`, Meldung `license_already_assigned`, ohne die Adresse im Text. Das steht **vor** der Kontingentprüfung. Bei vollem Kontingent bekommt die zweite Anfrage derselben Adresse so die Meldung aus AC-6 und nicht „ausgeschöpft“ (EC-2).
4. **Kontingent:** Sie zählt die Lizenzen des Trägers. Ist die Zahl so groß wie das Kontingent oder größer, bricht sie ab: Code `P0001`, Meldung `license_quota_exhausted`.
5. Sonst wird die Zeile angelegt.

- Jede Abfrage nach der Sperre sieht den neuesten bestätigten Stand. Die zweite von zwei gleichzeitigen Anfragen wartet also und zählt dann die Lizenz der ersten mit (EC-1).
- Danach greifen die Regel der Spalte, die Eindeutigkeit und die RLS-Prüfung beim Anlegen als zweite Linie.
- Der Anbieter in der Tabellenansicht und `service_role` in den Tests sehen alle Träger. Für sie gelten die Schritte 1, 3 und 4.
- Senkt der Anbieter das Kontingent, prüft niemand etwas nach: Vorhandene Lizenzen bleiben (AC-9). Neue scheitern an Schritt 4, bis wieder eine frei ist.

## Abläufe und Zugriff (Behaviors & Access)

### Grundsätze

1. Der Träger kommt immer aus dem Wächter `requireTrainingProvider()`. Die Schemas haben kein Feld für einen Träger, mitgeschickte zusätzliche Felder werden verworfen.
2. Der Server prüft jede Eingabe selbst, mit demselben Schema wie der Browser (AC-5).
3. Jede Datenbank-Anfrage läuft mit der Sitzung des Verwalters (`src/lib/supabase/server.ts`). RLS gilt immer.
4. **Keine Teilnehmer-Adresse in einer URL**, auch nicht zwischen App und Supabase: Die App filtert nie nach einer Adresse, Duplikate meldet die Datenbank. Supabase protokolliert die URLs seiner Daten-API, so landet keine Adresse dort. Die Adresse einer neuen Lizenz steht im Rumpf der Anfrage, und die Fehlertexte des Triggers enthalten keine Adresse.
5. Jede Aktion ist genau eine Anweisung an die Datenbank, also ganz oder gar nicht (EC-5).

### Eingaberegeln (ein Schema für Browser und Server)

| Feld | Regel | Meldung |
|---|---|---|
| E-Mail-Adresse des Teilnehmers | Zuerst: mehr als 1.000 Zeichen gelten ohne weitere Prüfung als ungültig (wie in PROJ-1). Dann Leerzeichen am Rand entfernen und kleinschreiben. Danach höchstens 254 Zeichen und gültiges Format. Die Formatregel ist dieselbe wie bei der E-Mail-Adresse in PROJ-1 (`z.email()`). | leer: „Bitte geben Sie die E-Mail-Adresse des Teilnehmers ein.“ · ungültig oder zu lang: „Bitte geben Sie eine gültige E-Mail-Adresse ein.“ |
| Lizenz (beim Entziehen) | Pflicht, eine UUID | sonst Ergebnis „Fehler“. Das kommt nur bei einer manipulierten Anfrage vor. |

### Übersicht lesen (AC-1 bis AC-3, AC-7, AC-9, EC-4, EC-6)

1. **Wächter.** Bei „nicht zugeordnet“ zeigt die Seite nichts, die Hinweisbox kommt aus dem Rahmen.
2. **Lizenzen lesen:** ID, Adresse und Zeitpunkt, gefiltert auf die Träger-ID aus dem Wächter (RLS ist die zweite Sperre), sortiert wie oben. Das Ergebnis wird nicht zwischengespeichert, damit die Seite nach jeder Aktion frisch liest.
3. **Fehler** (Supabase meldet einen Fehler oder antwortet nicht) → Zustand „Ladefehler“. Nie eine leere Liste und nie „0 von 5“ (EC-6).
4. **Kontingent** aus dem Wächter, gelesen in derselben Anfrage.
5. **Zustand und Texte** aus `licenses.rules.ts`.

Grenze: Die Daten-API von Supabase liefert höchstens 1.000 Zeilen pro Anfrage. Für „einige hundert“ (Spec) reicht das. Darüber bräuchte die Liste eine Seitenaufteilung (Out of Scope).

Scheitert schon das Lesen der Mitgliedschaft im Rahmen, wirft der Wächter. Next.js zeigt dann seine Standardseite. Das ist PROJ-1 BUG-4 (zurückgestellt) und nicht Teil dieses Features.

### Zuweisen (AC-4 bis AC-7, EC-1, EC-2, EC-5, EC-7, EC-9, EC-10)

1. **Wächter:** abgemeldet → Weiterleitung auf `/login?reason=session`. Nicht zugeordnet → Ergebnis „nicht zugeordnet“, ohne etwas zu lesen oder zu schreiben (EC-7).
2. **Eingabe prüfen.** Fehler → Feldfehler, sonst passiert nichts.
3. **Anlegen:** Träger-ID aus dem Wächter und die normalisierte Adresse. Zurück kommt die ID der neuen Lizenz.
4. **Ergebnis:**
   - **angelegt** → `refresh()`, Ergebnis „zugewiesen“ (AC-4)
   - **Code `23505`** (vom Trigger oder von der Eindeutigkeit) → `refresh()`, Feldfehler „Diese E-Mail-Adresse hat bereits eine Lizenz.“ (AC-6, EC-2)
   - **Code `P0001` mit `license_quota_exhausted`** → `refresh()`, Ergebnis „ausgeschöpft“ (AC-7, EC-1, EC-10)
   - **alles andere**, auch `42501` und keine Antwort von Supabase → Ergebnis „Fehler“
- Die App prüft das Kontingent nicht vorher selbst. Die Datenbank entscheidet, so gibt es keine Lücke zwischen Prüfen und Anlegen.
- Die eigene Adresse des Verwalters ist kein Sonderfall (EC-9).
- **Anschluss an PROJ-3:** Hier, nach dem erfolgreichen Anlegen und mit der ID der neuen Lizenz, startet PROJ-3 den Versand der Einladung. Das Datenmodul liefert die ID deshalb schon jetzt mit zurück.

### Entziehen (AC-8, AC-10, AC-11, EC-3, EC-5, EC-7)

1. **Wächter** wie beim Zuweisen.
2. **Lizenz-ID prüfen.**
3. **Löschen:** die Lizenz mit dieser ID **und** der Träger-ID aus dem Wächter. Zurück kommen die IDs der gelöschten Zeilen.
4. **Ergebnis:**
   - **eine Zeile gelöscht** → `refresh()`, Ergebnis „entzogen“ (AC-8)
   - **keine Zeile gelöscht** → `refresh()`, Ergebnis „bereits entzogen“ (EC-3). Eine ID eines fremden Trägers sieht genauso aus, weil RLS sie verbirgt. So verrät die Antwort nichts über fremde Lizenzen.
   - **Fehler** → Ergebnis „Fehler“

Die Adresse ist danach sofort frei und lässt sich neu zuweisen, auch an dieselbe Adresse (AC-8).

### Darstellung der Ergebnisse

Was der Verwalter beheben oder wiederholen kann, steht im Dialog. Ein Ergebnis meldet ein Toast, und der Dialog schließt.

| Aktion | Ergebnis | Darstellung |
|---|---|---|
| Zuweisen | zugewiesen | Dialog schließt, Toast „Lizenz zugewiesen“ |
| Zuweisen | Feldfehler, schon vergeben | Meldung am Feld, Dialog und Eingabe bleiben |
| Zuweisen | ausgeschöpft | Dialog schließt, Fehler-Toast „Ihr Kontingent ist ausgeschöpft.“. Die aufgefrischte Seite zeigt den gesperrten Knopf und den Hinweis. |
| Zuweisen | Fehler / keine Verbindung | Hinweisbox im Dialog mit der Meldung aus EC-5, Eingabe bleibt |
| Entziehen | entzogen | Dialog schließt, Toast „Lizenz entzogen“ |
| Entziehen | bereits entzogen | Dialog schließt, Fehler-Toast „Diese Lizenz wurde bereits entzogen.“ |
| Entziehen | Fehler / keine Verbindung | Hinweisbox im Dialog mit der Meldung aus EC-5, „Entziehen“ lässt sich wieder klicken |
| beide | nicht zugeordnet | Dialog schließt, Fehler-Toast mit der Meldung aus PROJ-1 EC-5 |
| beide | abgemeldet | Weiterleitung zum Login mit „Bitte melden Sie sich erneut an.“ |

### Zugriffsregeln in der Datenbank (AC-10)

| Tabelle | `anon` | `authenticated` | `service_role` |
|---|---|---|---|
| `licenses` | keine Rechte | **Lesen** und **Löschen**: nur Zeilen eines Trägers, bei dem der Aufrufer Verwalter ist. **Anlegen**: ebenso, und nur mit den Spalten `training_provider_id` und `email`. **Ändern**: kein Recht. | Lesen, Anlegen, Ändern, Löschen (nur Tests, RLS gilt für diese Rolle nicht) |

- **Die Rechte-Regel aus PROJ-1 gilt** (`features/PROJ-1-account-login/design.md` → Zugriffsregeln in der Datenbank):
  - erst alle Rechte entziehen, dann nur geben, was die Tabelle nennt
  - RLS ausdrücklich einschalten
  - das Ausführen der Prüffunktion für `public`, `anon`, `authenticated` und `service_role` entziehen. Einen Trigger startet Postgres ohne Prüfung dieses Rechts.
- **Drei RLS-Regeln**, für Lesen, Anlegen und Löschen, alle für `authenticated`. Jede verlangt dasselbe: Für den Träger der Zeile gibt es eine Mitgliedschaft mit der Konto-ID aus der Sitzung und der Rolle `admin`. Die Konto-ID wird einmal pro Abfrage ausgewertet (Supabase-Best-Practice, wie in PROJ-1).
- **Das Kontingent bleibt für Verwalter schreibgeschützt.** An den Rechten von `training_providers` ändert sich nichts (PROJ-1 AC-11).
- **Folge für AC-10:** Ein Verwalter von A sieht nur die Lizenzen von A. Abgelehnt werden:
  - eine Lizenz von B lesen: keine Zeile
  - eine Lizenz von B entziehen: keine Zeile gelöscht
  - eine Lizenz für B anlegen: Trigger Schritt 2, danach RLS
  - eine Lizenz ändern: kein Recht
  - eine Lizenz über das Kontingent hinaus anlegen: Trigger Schritt 4
  - `id` oder `assigned_at` selbst setzen: kein Spaltenrecht
- Ein abgemeldeter Besucher bekommt keine Zeilen, weil `anon` kein Recht hat.

### Meldungstexte

Alle Texte stehen in `licenses.rules.ts`, in der Sie-Form. Zwei kommen aus `account.rules.ts` und werden nicht doppelt geschrieben.

| Anlass | Text | AC/EC |
|---|---|---|
| Anzeige | „X von Y Lizenzen vergeben“ (Y = 1: „Lizenz“) · „Z frei“ | AC-1, AC-9, EC-4 |
| Hauptaktion, Dialogtitel | „Lizenz zuweisen“ | AC-4 |
| Dialogtext | „Geben Sie die E-Mail-Adresse des Teilnehmers ein.“ | AC-4 |
| Feld | „E-Mail-Adresse des Teilnehmers“ | AC-4 |
| Knöpfe im Dialog | „Abbrechen“ · „Zuweisen“ | AC-4 |
| Leere Liste | „Noch keine Lizenz vergeben. Weisen Sie die erste zu.“, Knopf „Lizenz zuweisen“ | AC-3 |
| Abschnitt | „Vergebene Lizenzen“ | AC-2 |
| Spaltenköpfe | „E-Mail-Adresse“ · „Zugewiesen am“ · „Aktion“ (nur Screenreader) | AC-2 |
| Zugewiesen | „Lizenz zugewiesen“ | AC-4 |
| Feld leer | „Bitte geben Sie die E-Mail-Adresse des Teilnehmers ein.“ | AC-5 |
| Feld ungültig oder zu lang | „Bitte geben Sie eine gültige E-Mail-Adresse ein.“ | AC-5 |
| Schon vergeben | „Diese E-Mail-Adresse hat bereits eine Lizenz.“ | AC-6, EC-2 |
| Kontingent ausgeschöpft (Hinweis) | „Ihr Kontingent ist ausgeschöpft. Für weitere Lizenzen wenden Sie sich an den Anbieter.“ | AC-7, EC-4 |
| Kontingent ausgeschöpft (nach einer Zuweisung) | „Ihr Kontingent ist ausgeschöpft.“ | EC-1 |
| Kontingent überschritten | „Ihr Kontingent ist überschritten. Bestehende Lizenzen bleiben gültig. Neue können Sie erst zuweisen, wenn weniger Lizenzen vergeben sind, als Ihr Kontingent erlaubt.“ | AC-9 |
| Knopf in der Liste | „Entziehen“ (Screenreader: „Lizenz von <Adresse> entziehen“) | AC-2, AC-8 |
| Bestätigungsdialog | „Lizenz von <Adresse> entziehen?“ · „Die Lizenz ist danach sofort wieder frei.“ · „Abbrechen“ · „Entziehen“ | AC-8 |
| Entzogen | „Lizenz entzogen“ | AC-8 |
| Bereits entzogen | „Diese Lizenz wurde bereits entzogen.“ | EC-3 |
| Keine Antwort vom App-Server | „Keine Verbindung. Bitte versuchen Sie es erneut.“ (aus `account.rules.ts`) | EC-5 |
| Fehler auf dem Server | „Das hat nicht geklappt. Bitte versuchen Sie es erneut.“ | EC-5 |
| Ladefehler | „Die Lizenzen konnten nicht geladen werden.“, Knopf „Erneut versuchen“ | EC-6 |
| Konto ohne Bildungsträger | Meldung aus PROJ-1 EC-5 (aus `account.rules.ts`) | EC-7 |

### Hinweise für `/qa`

- **Zugriffstoken für AC-10:** wie in PROJ-1 (Cookie `sb-<ref>-auth-token` nach einem Login über die App). Damit direkt gegen `/rest/v1/licenses` mit dem öffentlichen Schlüssel testen: lesen, anlegen für B, ändern (PATCH), löschen einer Lizenz von B, `assigned_at` mitschicken.
- **EC-1, EC-2:** zwei Anlagen gleichzeitig senden (zwei Clients mit demselben Token oder zwei Aufrufe der Action), einmal mit zwei Adressen auf die letzte freie Lizenz, einmal mit derselben Adresse. Erwartet wird genau eine Lizenz.
- **AC-9, EC-4, EC-10:** das Kontingent per `supabase db query` bzw. mit `service_role` ändern und danach zurücksetzen.
- **AC-11:** nach dem Entziehen und nach dem Löschen eines Testkontos mit `service_role` nach der Adresse suchen. Erwartet: 0 Zeilen.
- **Testadressen** für Teilnehmer aus der reservierten Domain `example.com`. So schickt PROJ-3 später nie eine Einladung an echte Personen.

### Für `/build`, am gehosteten Projekt per Test bestätigen

- Der Trigger läuft für `authenticated`, obwohl das Ausführen der Prüffunktion entzogen ist, und `authenticated` darf die Transaktionssperre setzen.
- Zwei gleichzeitige Anlagen auf die letzte freie Lizenz ergeben genau eine Lizenz.
- Eine Anlage für einen fremden Träger endet immer mit `42501`, gleich ob die Adresse dort schon vergeben ist oder dessen Kontingent voll ist.
- Das Schema der App und die Regel der Spalte urteilen über jede Adresse gleich: Sie nehmen die Beispiele mit `+`, Punkt, Bindestrich, Subdomain und 254 Zeichen an und lehnen alles ab, was die App ablehnt.

## Abhängigkeiten (Dependencies)

- **Neu:** keine.
- **Schon vorhanden und genutzt:**
  - shadcn/ui-Bausteine `dialog`, `alert-dialog`, `table`, `progress`, `skeleton`, `card`, `alert`, `form`, `input`, `button` und `sonner`
  - `zod`, `react-hook-form`, `@hookform/resolvers`, `@supabase/ssr`, `server-only`, `lucide-react`
  - `refresh` aus `next/cache` (Next.js 16)

## Einstellungen durch den Nutzer (Settings the user makes)

Keine. Dieses Feature braucht keine neue Variable und keine Einstellung im Dashboard.
- „Automatically expose new tables“ ist seit PROJ-1 aus. Die Migration setzt ihre Rechte ohnehin selbst.
- Die Supabase-CLI ist seit PROJ-1 verbunden, `/build` spielt die Migration mit `supabase db push` ein.

## Technische Entscheidungen (Technical Decisions)

Codebase-Karte: entfällt (`mode: new`, kein `docs/codebase/`).

| Entscheidung | Begründung | Erwogene Alternative | Trade-off | Datum |
|---|---|---|---|---|
| Zuweisen und Entziehen als Server Actions mit der Sitzung des Verwalters. RLS gilt für jede Anfrage. | Die Sitzung liegt in HttpOnly-Cookies (PROJ-1), also läuft alles über den Server. Mit der Nutzersitzung ist RLS die zweite, unabhängige Sperre hinter dem Filter der App (Sicherheitsregeln). Server Actions senden per POST. | Admin-Client in der Action (RLS ohne Wirkung, nur eine Sperre); Supabase-Client im Browser (sieht keine Sitzung) | Ein Verwalter kann mit seinem Token auch direkt über die Daten-API Lizenzen seines eigenen Trägers anlegen und löschen. Dafür gelten dieselben Regeln der Datenbank. | 2026-10-25 |
| Kontingent und Eindeutigkeit prüft ein Trigger vor jedem Anlegen, pro Träger nacheinander (Transaktionssperre) | **Garantie für AC-7, EC-1 und EC-10:** Prüfen und Anlegen liegen in derselben Transaktion. Die zweite Anfrage wartet und sieht dann die Lizenz der ersten. Das greift auch am Formular vorbei und wandert mit der Tabelle in die Plattform. | Prüfung in der App vor dem Anlegen (Lücke zwischen Zählen und Anlegen); eigene Datenbankfunktion zum Zuweisen; Zählspalte am Träger; Isolationsstufe SERIALIZABLE (braucht Wiederholungen) | Anlagen eines Trägers laufen nacheinander. Bei einigen hundert Lizenzen und einem Verwalter merkt das niemand. | 2026-10-25 |
| Der Trigger läuft mit den Rechten des Aufrufers und sperrt über eine Transaktionssperre (advisory lock) statt über die Zeile des Trägers | Er sieht nur, was RLS dem Verwalter zeigt. Eine Anlage für einen fremden Träger scheitert, bevor er dessen Lizenzen zählt, und nichts über fremde Teilnehmer dringt nach außen (AC-6, AC-10). Eine Sperre auf die Zeile des Trägers verlangt ein Schreibrecht, das Verwalter nicht haben. | Trigger mit Eigentümerrechten und Zeilensperre. Postgres prüft RLS erst nach dem Trigger. Ohne eigene Mitgliedschaftsprüfung würde „schon vergeben“ also verraten, wen ein fremder Träger angemeldet hat. | Eine zweite Art von Sperre. `/build` bestätigt per Test, dass Verwalter sie setzen dürfen. | 2026-10-25 |
| „Schon vergeben“ prüft der Trigger vor dem Kontingent. Die Eindeutigkeit bleibt als harte Regel. | **Garantie für EC-2:** Bei der letzten freien Lizenz bekommt die zweite Anfrage derselben Adresse die Meldung aus AC-6, nicht „ausgeschöpft“. Der Fehlertext des Triggers enthält keine Adresse. Postgres würde sie bei einem Verstoß gegen die Eindeutigkeit in die Fehlerdetails und damit ins Datenbank-Protokoll schreiben (AC-11). | Nur die Eindeutigkeit | Zwei Stellen prüfen dasselbe. Die Eindeutigkeit greift nur, wenn der Trigger fehlt. | 2026-10-25 |
| Adressen werden normalisiert gespeichert (ohne Leerzeichen, kleingeschrieben). Die Regel der Spalte erzwingt das, eindeutig ist (Träger, Adresse). | AC-6 gilt unabhängig von der Schreibweise, mit einem schlichten eindeutigen Schlüssel, der zugleich der Index ist | Spaltentyp `citext`; eindeutiger Index auf der kleingeschriebenen Adresse | Eine direkte Anfrage mit Großbuchstaben wird abgelehnt statt angepasst | 2026-10-25 |
| Die Formatregel der Spalte ist genau die der App: das Muster von `z.email()` (wie in PROJ-1), angewandt auf die gespeicherte Form. Ein Datenbanktest prüft beide Regeln an derselben Liste von Adressen. | AC-5 verlangt dieselben Regeln auch am Formular vorbei, und AC-10 nennt die Datenbank-Schnittstelle ausdrücklich als solchen Weg (BUG-1). PROJ-3 schickt an diese Adressen Mails. Dass die beiden Regeln auseinanderlaufen, fängt der gemeinsame Test ab. | Die ursprüngliche Entscheidung vom 2026-10-25: eine bewusst weitere Regel der Spalte. Am Formular vorbei ließ sie Adressen zu, die die App ablehnt. | Ändert Zod sein Muster, schlägt der gemeinsame Test fehl, und die Regel der Spalte braucht eine neue Migration | 2026-10-26 |
| Verwalter dürfen beim Anlegen nur Träger und Adresse setzen. ID und Zeitpunkt setzt die Datenbank. Ändern ist gar nicht erlaubt. | AC-10 (keine Änderung) und AC-12 (echter Zeitpunkt der Zuweisung) sichern schon die Rechte, ohne Code | Mitgeschickte Werte im Trigger überschreiben | Eine spätere Bearbeitung bräuchte eine neue Freigabe. Das ist gewollt, Bearbeiten ist Out of Scope. | 2026-10-25 |
| Entziehen löscht nach Lizenz-ID und Träger-ID. Die Zahl der gelöschten Zeilen entscheidet. | **Garantie für EC-3:** Ein zweites Entziehen löscht nichts und meldet „bereits entzogen“. Eine fremde ID sieht genauso aus, also gibt es keine Auskunft über fremde Lizenzen. | Erst lesen, dann löschen (zwei Schritte, dazwischen eine Lücke) | Ein manipulierter Aufruf mit fremder ID bekommt „bereits entzogen“ statt „verboten“ | 2026-10-25 |
| Nach jeder Aktion `refresh()` aus `next/cache` | Seit Next.js 16 frischt `refresh()` den Router aus einer Server Action auf, und die Antwort bringt die neu gerenderte Seite mit (Next.js-Doku, über Context7 geprüft). Zahlen und Liste kommen so immer aus der Datenbank, nie aus einer Rechnung im Browser (AC-1, EC-1, EC-10). | `revalidatePath` (für zwischengespeicherte Daten gedacht, die Seite ist ohnehin dynamisch); die Liste im Browser fortschreiben (`useOptimistic`, mehr Code und Zahlen, die falsch sein können) | Pro Aktion rendert der Server die Seite einmal neu | 2026-10-25 |
| Den Ladefehler fängt die Seite selbst und zeigt die Hinweisbox. „Erneut versuchen“ lädt über den Router neu. | EC-6 verlangt die Hinweisbox statt einer leeren Liste. Eine eigene `error.tsx` würde auch Fehler des Wächters fangen, und das ist PROJ-1 BUG-4 (vom Nutzer zurückgestellt). | `error.tsx` im Abschnitt `/licenses` | Scheitert schon das Lesen der Mitgliedschaft im Rahmen, bleibt die Standardseite von Next.js (PROJ-1 BUG-4) | 2026-10-25 |
| Keine Adresse in einer URL, auch nicht zwischen App und Supabase. Die App filtert nie nach einer Adresse, Duplikate meldet die Datenbank. | Supabase protokolliert die URLs der Daten-API. So landen keine Teilnehmer-Adressen in Protokollen (Spec: nie in einer URL; AC-11: kein Protokoll). | Vor dem Anlegen nach der Adresse suchen | keiner: Die Meldung aus AC-6 kommt trotzdem, aus der Antwort der Datenbank | 2026-10-25 |
| Zuweisen im Dialog. Was man beheben kann, bleibt im Dialog, Ergebnisse kommen als Toast. | Bei behebbaren Fehlern bleibt die Eingabe stehen (AC-5, EC-5). Ergebnisse folgen dem Seitenmuster (Toasts). Das Muster steht jetzt in `docs/app-shell.md`, damit PROJ-3 gleich arbeitet. | Formular fest auf der Seite | Ein Klick mehr bis zum Feld | 2026-10-25 |
| Liste ab `md` als Tabelle, darunter als Karten | EC-8 und `docs/design-system.md` → Tabellen | Tabelle mit seitlichem Scrollen | Die Liste steht zweimal im HTML. Die jeweils andere Fassung ist ausgeblendet. | 2026-10-25 |
| Spalten `email` und `assigned_at`, kein `created_at` | AC-12 verlangt genau einen Zeitpunkt, ein zweiter wäre bei jeder Lizenz derselbe. Die Namen folgen der Plattform: englisch, snake_case, `*_at` für Zeitpunkte wie dort `activated_at`. Das Lernkonto kommt später als `user_id` wie bei `enrollments`. | `created_at` als einziger Zeitpunkt | Weicht vom Muster „jede Tabelle hat `created_at`“ ab | 2026-10-25 |
| Die RLS-Regeln verlangen die Rolle `admin`, nicht nur eine Mitgliedschaft | Die Spec spricht von Verwaltern. Kommt später eine Rolle ohne Schreibrecht dazu, bekommt sie es nicht aus Versehen. | Nur die Mitgliedschaft (wie bei `training_providers`) | Eine neue Rolle braucht eine bewusste Freigabe | 2026-10-25 |
| `form-feedback.tsx` zieht nach `src/components/`, ohne Änderung im Verhalten | Login, Registrierung und jetzt beide Dialoge brauchen dieselben Teile (Pack: teilen, sobald ein zweiter Aufrufer da ist). Geteilter Code importiert nichts aus Features, deshalb bekommt die Hinweisbox nur noch die Meldung als Text. | Aus `src/features/account/components/` importieren (Feature hängt am Bauteil eines anderen Features) | Eine Datei von PROJ-1 wird bewegt, und dessen Tests müssen grün bleiben | 2026-10-25 |
| Keine Seitenaufteilung. Die Daten-API liefert höchstens 1.000 Zeilen pro Anfrage. | Die Spec verlangt alle Lizenzen auf einer Seite, ausgelegt für einige hundert | Seitenaufteilung | Ab 1.000 Lizenzen eines Trägers wäre die Liste unvollständig. Dann braucht es `/refine`. | 2026-10-25 |
| Datum der Zuweisung als „TT.MM.JJJJ“ in Europe/Berlin | Der Server rendert und läuft womöglich in UTC. Ohne feste Zeitzone stünde eine Lizenz von 0:30 Uhr am Vortag. | Zeitzone des Servers | Wer außerhalb Deutschlands arbeitet, sieht deutsche Zeit. Die Oberfläche ist ohnehin nur deutsch. | 2026-10-25 |

## Abdeckung der Acceptance Criteria

| AC / EC | Wo es im Design gelöst ist |
|---|---|
| AC-1 | Regeln für Anzeige und Liste (Zahlen, Text, Balken), `refresh()` nach jeder Aktion |
| AC-2 | Übersicht lesen (alle, sortiert), Tabelle und Karten mit „Entziehen“ |
| AC-3 | leerer Zustand der Liste |
| AC-4 | Dialog „Lizenz zuweisen“, Zuweisen, Darstellung der Ergebnisse |
| AC-5 | Eingaberegeln (ein Schema), Feldfehler im Dialog, Regel der Spalte |
| AC-6 | Normalisierung, Trigger Schritt 3, Eindeutigkeit pro Träger. Fremde Träger: Eindeutigkeit nur pro Träger, der Trigger sieht nur den eigenen. |
| AC-7 | Zustand „ausgeschöpft“, gesperrter Knopf, Hinweis, Trigger Schritt 4 |
| AC-8 | Bestätigungsdialog, Entziehen, Darstellung der Ergebnisse |
| AC-9 | Zustand „überschritten“, keine Nachprüfung beim Senken des Kontingents |
| AC-10 | Zugriffsregeln, Spaltenrechte, kein Recht zum Ändern, Trigger Schritt 2, Träger aus dem Wächter |
| AC-11 | Entziehen löscht die Zeile, Löschkaskade am Träger, keine Adresse in URLs und Fehlertexten |
| AC-12 | Datenmodell (vier Felder), Spaltenrechte beim Anlegen |
| EC-1 | Trigger (Sperre, Zählen), Ergebnis „ausgeschöpft“ mit `refresh()` |
| EC-2 | gesperrte Knöpfe beim Senden, Trigger Schritt 3, Eindeutigkeit |
| EC-3 | Entziehen → Zahl der gelöschten Zeilen |
| EC-4 | Zustand „ausgeschöpft“ bei 0 von 0, kein leerer Zustand |
| EC-5 | eine Anweisung pro Aktion, Darstellung der Ergebnisse |
| EC-6 | Zustand „Ladefehler“ |
| EC-7 | Wächter in jeder Action, Weiterleitung, Meldung aus PROJ-1 EC-5 |
| EC-8 | Regeln für Anzeige und Liste (reiner Text, Umbruch, Karten) |
| EC-9 | kein Sonderfall beim Zuweisen |
| EC-10 | Trigger liest das Kontingent beim Anlegen, `refresh()` |

## Offene Fragen (Open Questions)

- Keine technischen. Die rechtlichen Fragen stehen in `spec.md`.

## Umsetzungsnotizen (`/build`, 2026-10-25)

- **Am gehosteten Projekt bestätigt** (`src/test/db/licenses.test.ts`, 23 Tests):
  - Der Trigger läuft für `authenticated`, obwohl das Ausführen der Prüffunktion entzogen ist, und `authenticated` darf die Transaktionssperre setzen.
  - Von fünf gleichzeitigen Anlagen auf die letzte freie Lizenz gelingt genau eine. Von drei gleichzeitigen Anlagen derselben Adresse gelingt genau eine, die anderen enden mit `23505`.
  - Eine Anlage für einen fremden Träger endet immer mit `42501`.
  - Die Beispieladressen werden von Schema und Spalte gleich angenommen.
- **Kontingent-Balken:** Das installierte `src/components/ui/progress.tsx` gibt `value` nicht an Radix weiter. `quota-summary.tsx` setzt `aria-valuenow` und `aria-valuetext` deshalb selbst. `progress.tsx` bleibt unverändert.
- **Antwort ohne Ergebnis:** `thrownFeedback()` in `licenses.rules.ts` erkennt „Keine Verbindung“ mit derselben Regel wie `isConnectionError()` (`TypeError`), damit die Zuordnung zur Meldung rein und testbar bleibt. Die Weiterleitung erkennen die Dialoge vorher mit `isRedirectError()`.
- **Karte auf dem Smartphone:** Unter der Adresse steht „Zugewiesen am TT.MM.JJJJ“, weil die Karte keinen Spaltenkopf hat.
- **Kontingent-Hinweis:** Die shadcn-`alert` trägt `role="alert"`, wie die Hinweisbox aus PROJ-1 EC-5.

## Umsetzungsnotizen (`/build`, 2026-10-26: BUG-1)

- **Regel der Spalte so eng wie die der App:** Die neue Migration `20261026120000_proj2_licenses_email_rule.sql` ersetzt `licenses_email_check`. Die Migration vom 2026-10-25 war schon im gehosteten Projekt eingespielt und bleibt deshalb unverändert.
- **Gleichwertigkeit geprüft:** Das Zod-Muster und dieselbe Regel in Postgres wurden an 15.861 erzeugten Adressen verglichen, davon 3.383 gültige, ohne eine einzige Abweichung. Der Vergleich lief einmal beim Bauen und ist nicht eingecheckt. Dauerhaft sichert der gemeinsame Test in `src/test/db/licenses.test.ts` → „Regel der Spalte“.
- **Unverändert:** Großbuchstaben und Leerzeichen am Rand lehnt die Spalte weiterhin ab, statt sie anzupassen. Beobachtung O-1 aus dem QA-Bericht (die Adresse im Postgres-Protokoll bei einem Regelverstoß am Formular vorbei) betrifft denselben direkten Weg. Sie ist nicht Teil dieses Fixes.
