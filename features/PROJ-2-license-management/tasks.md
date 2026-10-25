# PROJ-2 Aufgaben: Lizenzverwaltung

> Erstellt von `/tasks` aus `spec.md` und `design.md`. Das ist der geordnete, nachvollziehbare Bauplan, die Brücke zwischen dem Vertrag (WAS) und dem Bauen (WIE).
> `[P]` = parallel ausführbar: Die Dateien der Aufgabe überschneiden sich mit keiner anderen `[P]`-Aufgabe derselben Stufe. `/build` kann sie deshalb einem eigenen Subagenten geben.
> Die Stufen laufen **nacheinander**, jede ist eine Schranke. Aufgaben **innerhalb** einer Stufe laufen parallel, wo `[P]` steht. Jede Aufgabe nennt die AC-IDs aus `spec.md`, die sie erfüllt. Das ist die Kette AC → Task → Test.
> `[user]` = eine Einstellung, die nur der Nutzer machen kann, im Dashboard eines Anbieters oder in seiner eigenen Umgebungsdatei. Sie hat `where:` statt `files:`, ist nie `[P]` und wird vom Nutzer abgehakt. `/build` übergibt sie, `/deploy` liefert nicht aus, solange eine offen ist. **Dieses Feature hat keine** (design.md → Einstellungen durch den Nutzer).
> `[user go-live]` = dasselbe, braucht aber die Produktions-URL oder den Host. Vor `/deploy` kann sie niemand machen, deshalb blockiert sie weder `/qa` noch „Approved“. Dieses Feature hat keine.
> Zuständig: `/tasks` legt diese Datei an, `/build` hakt die Kästchen ab.
> Kein Statusfeld: Die abgehakten Kästchen unten sind der Fortschritt dieser Datei. Der Status des Features steht NUR in `features/INDEX.md`.

## Stufe 1 — Datenbank

<!-- Fundament: Tabelle, Zugriffsregeln, Trigger. Läuft zuerst, weil alles andere auf dem Datenvertrag aufbaut.
     Nur eine Aufgabe, also nur ein `supabase db push` in die gehostete Datenbank (Strategie `single`). -->

- [ ] T1  Migration Lizenzen mit Trigger und Datenbanktests  · files: supabase/migrations/20261025120000_proj2_licenses.sql, src/test/db/licenses.test.ts  · → AC-4, AC-5, AC-6, AC-7, AC-8, AC-9, AC-10, AC-11, AC-12, EC-1, EC-2, EC-10
  - Migration:
    - Tabelle `public.licenses` mit genau vier Spalten (`id`, `training_provider_id`, `email`, `assigned_at`). Regel der Spalte `email`, Eindeutigkeit (`training_provider_id`, `email`), Löschkaskade zum Träger, kein weiterer Index. Details: design.md → Datenmodell.
    - Rechte nach der Regel aus PROJ-1: erst alle entziehen, dann für `authenticated` Lesen, Löschen und Anlegen nur mit den Spalten `training_provider_id` und `email`. Kein Ändern, keine Rechte für `anon`. RLS ausdrücklich einschalten.
    - Drei RLS-Regeln (Lesen, Anlegen, Löschen) für `authenticated`. Jede verlangt eine Mitgliedschaft mit der Rolle `admin`, die Konto-ID wird einmal pro Abfrage ausgewertet.
    - Prüffunktion `private.enforce_license_rules`: security invoker, leerer Suchpfad. Das Ausführen wird für `public`, `anon`, `authenticated` und `service_role` entzogen. Der Trigger `enforce_license_rules` läuft vor dem Anlegen.
    - Reihenfolge im Trigger: Sperre, Träger sichtbar (`42501`, `training_provider_not_accessible`), schon vergeben (`23505`, `license_already_assigned`), Kontingent (`P0001`, `license_quota_exhausted`). Keiner der Fehlertexte enthält die Adresse. Details: design.md → Prüfung vor dem Anlegen.
  - Tests am gehosteten Projekt, mit dem Testgerüst aus PROJ-1 (`src/test/supabase.ts`). Jeder Test legt eigene Testkonten mit eindeutigen Adressen an und räumt sie weg. Teilnehmer-Adressen nur aus `example.com`. Geprüft wird:
    - Der Trigger läuft für `authenticated`, obwohl das Ausführen der Prüffunktion entzogen ist, und `authenticated` darf die Transaktionssperre setzen.
    - Zwei gleichzeitige Anlagen mit zwei Adressen auf die letzte freie Lizenz: genau eine Lizenz entsteht, die andere Anlage endet mit `license_quota_exhausted` (EC-1).
    - Zwei gleichzeitige Anlagen mit derselben Adresse: genau eine Lizenz, die zweite endet mit `23505`, auch wenn damit das Kontingent voll wäre (EC-2).
    - Dieselbe Adresse in anderer Schreibweise wird abgelehnt (Großbuchstaben, Leerzeichen am Rand). Bei einem zweiten Träger wird dieselbe Adresse normal angelegt (AC-6).
    - Eine Anlage für einen fremden Träger endet immer mit `42501`, auch wenn die Adresse dort schon vergeben oder dessen Kontingent voll ist (AC-10).
    - Die Regel der Spalte nimmt diese Beispieladressen an: mit `+`, mit Punkt, mit Bindestrich, mit Subdomain, genau 254 Zeichen. Ohne @, mit Leerzeichen oder mit 255 Zeichen lehnt sie ab (AC-5). Dieselben Beispiele stehen als „gültig“ im Schema-Test von T2.
    - AC-10 mit dem Token von A: A liest nur eigene Zeilen. Eine Lizenz von B entziehen löscht 0 Zeilen. Ändern wird abgelehnt, `id` oder `assigned_at` selbst setzen wird abgelehnt. `anon` bekommt keine Zeilen und darf nichts anlegen.
    - Kontingent per `service_role` unter die Zahl der Lizenzen senken: Alle Lizenzen bleiben, eine neue endet mit `license_quota_exhausted`. Kontingent wieder heben: Die nächste Anlage gelingt (AC-9, EC-10).
    - Entziehen und danach dieselbe Adresse sofort neu zuweisen gelingt (AC-8).
    - Konto des Verwalters löschen: Träger und Lizenzen sind weg. Die Suche nach der Adresse per `service_role` ergibt 0 Zeilen, ebenso nach dem Entziehen (AC-11).
    - Eine neue Zeile hat genau die vier Spalten, und `assigned_at` setzt die Datenbank (AC-12).

## Stufe 2 — Grundlagen

<!-- Bausteine ohne Abhängigkeit untereinander. Alle Dateisätze sind disjunkt, deshalb sind alle Aufgaben [P].
     Schema und Regeln liegen in einer Aufgabe, weil das Schema seine Meldungen aus den Regeln nimmt. -->

- [ ] T2 [P]  Regeln und Eingaberegeln  · files: src/features/licenses/licenses.rules.ts, src/features/licenses/licenses.rules.test.ts, src/features/licenses/licenses.schema.ts, src/features/licenses/licenses.schema.test.ts  · → AC-1, AC-3, AC-5, AC-6, AC-7, AC-8, AC-9, EC-1, EC-3, EC-4, EC-5, EC-6, EC-7
  - Regeln (pure):
    - Alle Texte aus design.md → Meldungstexte, dazu der Seitentitel „Lizenzübersicht“. „Keine Verbindung“ und „nicht zugeordnet“ kommen aus `src/features/account/account.rules.ts` und werden nicht doppelt geschrieben.
    - Zustand des Kontingents aus (vergeben, Kontingent): vergeben, Kontingent, frei (mindestens 0), Anteil in Prozent (höchstens 100, bei Kontingent 0 genau 100), Zustand verfügbar / ausgeschöpft / überschritten. Grenzfälle: 0 von 0 ist ausgeschöpft, 5 von 3 ist überschritten.
    - Text der Anzeige „X von Y Lizenzen vergeben“, bei Y = 1 „Lizenz“, dazu „Z frei“.
    - Datum der Zuweisung als „TT.MM.JJJJ“ in Europe/Berlin. Test: 23:30 Uhr UTC am 31.12. ergibt den 01.01. des Folgejahres.
    - Ergebnis einer Aktion → Meldung, für alle Zeilen aus design.md → Darstellung der Ergebnisse.
    - Eine feste ID für den Kontingent-Hinweis als Konstante. T6 setzt sie am Hinweis, T8 verweist mit dem gesperrten Knopf darauf.
  - Schema (pure), eine Quelle für Browser und Server:
    - Zuweisen: E-Mail-Adresse. Mehr als 1.000 Zeichen gelten sofort als ungültig. Dann Leerzeichen am Rand entfernen und kleinschreiben, danach höchstens 254 Zeichen und `z.email()` wie in PROJ-1. Meldungen für leer und ungültig aus design.md → Eingaberegeln.
    - Entziehen: Lizenz-ID, Pflicht, UUID.
    - Kein Feld für einen Träger, mitgeschickte zusätzliche Felder werden verworfen.
    - Test: die Beispieladressen aus T1 werden angenommen, ebenso dieselbe Adresse mit Großbuchstaben und Rand-Leerzeichen (normalisiert).
- [ ] T3 [P]  Datenzugriff auf Lizenzen  · files: src/features/licenses/licenses.data.ts, src/features/licenses/licenses.data.test.ts  · → AC-2, AC-4, AC-6, AC-7, AC-8, AC-10, AC-11, EC-1, EC-2, EC-3, EC-6
  - `server-only`, immer mit dem Server-Client `src/lib/supabase/server.ts`, **nie** mit dem Admin-Client.
  - `listLicenses(Träger-ID)`: ID, Adresse und Zeitpunkt, gefiltert auf die Träger-ID, nach `assigned_at` absteigend und bei Gleichstand nach ID, nicht zwischengespeichert. Jeder Fehler und keine Antwort ergeben „Ladefehler“, nie eine leere Liste.
  - `insertLicense(Träger-ID, Adresse)`: Ergebnis „angelegt“ mit der ID der neuen Lizenz (für PROJ-3), `23505` → „schon vergeben“, `P0001` mit `license_quota_exhausted` → „ausgeschöpft“, alles andere (auch `42501`) → „Fehler“.
  - `deleteLicense(Träger-ID, Lizenz-ID)`: löscht nach Lizenz-ID **und** Träger-ID und gibt die gelöschten IDs zurück. Eine Zeile → „entzogen“, keine → „nicht gefunden“, Fehler → „Fehler“.
  - Jede Funktion ist genau eine Anweisung an die Datenbank. Nie wird nach einer Adresse gefiltert, damit keine Adresse in einer URL der Daten-API landet.
  - Der Test bildet den Server-Client nach und prüft Filter, Sortierung und die Übersetzung aller Codes. Das echte Verhalten der Datenbank deckt T1 ab.
- [ ] T4 [P]  Formular-Rückmeldungen als geteilter Baustein  · files: src/components/form-feedback.tsx, src/components/form-feedback.test.tsx, src/features/account/components/login-form.tsx, src/features/account/components/register-form.tsx  · → AC-5, EC-5
  - `form-feedback.tsx` und `form-feedback.test.tsx` mit `git mv` aus `src/features/account/components/` nach `src/components/` verschieben.
  - `FormAlert` bekommt nur noch die Meldung als Text statt `FormError`. Geteilter Code importiert nichts aus `src/features/`, auch keine Typen (Regel `shared-does-not-import-features` in `.dependency-cruiser.cjs`).
  - Login- und Registrierungsformular importieren von `@/components/form-feedback` und geben den Text weiter. Sonst ändert sich nichts.
  - PROJ-1 ändert sich im Verhalten nicht: `login-form.test.tsx` und `register-form.test.tsx` bleiben unverändert grün, ebenso `npm run check:structure`.

## Stufe 3 — Actions und Anzeige

<!-- Braucht Regeln, Schema und Datenzugriff aus Stufe 2. Alle Dateisätze sind disjunkt, deshalb sind alle Aufgaben [P]. -->

- [ ] T5 [P]  Server Actions Zuweisen und Entziehen  · files: src/features/licenses/licenses.actions.ts, src/features/licenses/licenses.actions.test.ts  · → AC-4, AC-5, AC-6, AC-7, AC-8, AC-10, EC-1, EC-2, EC-3, EC-5, EC-7, EC-9, EC-10
  - `'use server'`. Der Träger kommt immer aus `requireTrainingProvider()` (`src/features/account/session.data.ts`), nie aus der Eingabe.
  - Beide Actions: abgemeldet → Weiterleitung auf `/login?reason=session`. Nicht zugeordnet → Ergebnis „nicht zugeordnet“, ohne etwas zu lesen oder zu schreiben (EC-7).
  - `assignLicense`: Schema auf dem Server (Feldfehler), dann `insertLicense`. Danach:
    - angelegt → `refresh()`, Ergebnis „zugewiesen“
    - schon vergeben → `refresh()`, Feldfehler aus AC-6
    - ausgeschöpft → `refresh()`, Ergebnis „ausgeschöpft“
    - sonst → „Fehler“
    - Kein eigenes Prüfen des Kontingents vorher. Die eigene Adresse des Verwalters ist kein Sonderfall (EC-9).
  - `revokeLicense`: Schema (ungültige ID → „Fehler“), dann `deleteLicense`. Danach:
    - entzogen → `refresh()`, Ergebnis „entzogen“
    - nicht gefunden → `refresh()`, Ergebnis „bereits entzogen“
    - Fehler → „Fehler“
  - Die Tests bilden Wächter, Datenmodul und `refresh` nach. Geprüft wird: jede Zeile oben, ein mitgeschickter Träger wird ignoriert, eine Eingabe am Formular vorbei mit ungültiger Adresse legt nichts an (AC-5).
- [ ] T6 [P]  Kontingent-Anzeige  · files: src/features/licenses/components/quota-summary.tsx, src/features/licenses/components/quota-summary.test.tsx  · → AC-1, AC-7, AC-9, EC-4
  - Bekommt den Zustand aus T2 als Wert. Karte (shadcn `card`) mit „X von Y Lizenzen vergeben“ (type-section, tabular-nums) und „Z frei“ (type-body).
  - Balken (shadcn `progress`): Anteil aus T2, Spur `--muted`, Füllung `--primary`. Für Screenreader heißt er „Vergebene Lizenzen“, und als Wert wird derselbe Text wie in der Anzeige vorgelesen.
  - Hinweis (shadcn `alert`, Standardvariante) nur, wenn keine Lizenz frei ist: „ausgeschöpft“ mit Info-Symbol, „überschritten“ mit Warnsymbol, mit der Hinweis-ID aus T2.
  - Tests: 2 von 5, 0 von 1 (Einzahl), 5 von 5, 0 von 0, 5 von 3.
- [ ] T7 [P]  Lade- und Fehlerzustand der Seite  · files: src/features/licenses/components/licenses-load-error.tsx, src/features/licenses/components/licenses-load-error.test.tsx, src/features/licenses/components/licenses-skeleton.tsx, src/app/(app)/licenses/loading.tsx  · → EC-6, AC-1, AC-2
  - Ladefehler (Client): Hinweisbox „Die Lizenzen konnten nicht geladen werden.“ mit dem Knopf „Erneut versuchen“. Der Knopf lädt über den Router neu (`router.refresh()` in einer Transition), ohne den Browser neu zu laden, und ist dabei gesperrt.
  - Skeletons in der Form der Seite: Titel „Lizenzübersicht“, Skeleton der Hauptaktion, der Anzeige und drei Zeilen der Liste.
  - `loading.tsx` zeigt die Skeletons, solange `/licenses` lädt.

## Stufe 4 — Dialoge

<!-- Braucht die Actions aus Stufe 3 und den geteilten Baustein aus T4. Die beiden Dialoge teilen sich keine Datei, deshalb beide [P]. -->

- [ ] T8 [P]  Dialog „Lizenz zuweisen“  · files: src/features/licenses/components/assign-license-dialog.tsx, src/features/licenses/components/assign-license-dialog.test.tsx  · → AC-3, AC-4, AC-5, AC-6, AC-7, AC-9, EC-1, EC-2, EC-4, EC-5, EC-7
  - Client. Werte: gesperrt ja/nein, Art des Knopfs. Als Hauptaktion steht er rechts, auf dem Smartphone in voller Breite. Im leeren Zustand ist er `outline`. Ist er gesperrt, verweist er für Screenreader auf die Hinweis-ID aus T2.
  - Beim Öffnen: Feld leer, kein Fehler, Fokus im Feld. Feld „E-Mail-Adresse des Teilnehmers“: Typ E-Mail, Autovervollständigen aus, 44 px hoch, 16 px Schrift. Feldfehler darunter mit Symbol (`FieldMessage` aus T4).
  - Absenden wie in PROJ-1: `method="post"`, der Handler verhindert das native Absenden, prüft mit dem Schema aus T2 und ruft `assignLicense` auf.
  - Während des Sendens: beide Knöpfe gesperrt, „Zuweisen“ mit `aria-busy`. Escape und ein Klick daneben schließen erst nach der Antwort (EC-2).
  - Ergebnisse nach design.md → Darstellung der Ergebnisse:
    - zugewiesen → Dialog zu, Toast „Lizenz zugewiesen“
    - schon vergeben → Meldung am Feld, Eingabe bleibt
    - ausgeschöpft → Dialog zu, Fehler-Toast
    - nicht zugeordnet → Dialog zu, Fehler-Toast
    - Fehler oder keine Verbindung → Hinweisbox im Dialog (`FormAlert` aus T4), Eingabe bleibt
    - Weiterleitung (`isRedirectError`) ist kein Fehler, `TypeError` gilt als „Keine Verbindung“.
  - Auf dem Smartphone stehen „Abbrechen“ und „Zuweisen“ untereinander in voller Breite.
  - Die Tests bilden die Action nach und decken jede Zeile der Ergebnistabelle ab, dazu Doppelklick (nur ein Aufruf) und Fokus beim Öffnen.
- [ ] T9 [P]  Entziehen mit Bestätigungsdialog  · files: src/features/licenses/components/revoke-license-dialog.tsx, src/features/licenses/components/revoke-license-dialog.test.tsx  · → AC-8, EC-3, EC-5, EC-7, EC-8
  - Client. Werte: Lizenz-ID, Adresse, Darstellung (klein oder volle Breite).
  - Knopf `destructive`, sichtbarer Text „Entziehen“, für Screenreader „Lizenz von <Adresse> entziehen“. Klein: 36 px gezeichnet, Tippfläche 44 × 44 px. Volle Breite: 44 px hoch.
  - Bestätigungsdialog (shadcn `alert-dialog`): Titel „Lizenz von <Adresse> entziehen?“ als reiner Text, der an jeder Stelle umbrechen darf, dazu der Text „Die Lizenz ist danach sofort wieder frei.“. „Abbrechen“ hat beim Öffnen den Fokus.
  - „Entziehen“ schließt nicht sofort. Während des Sendens sind beide Knöpfe gesperrt, und „Entziehen“ trägt `aria-busy`.
  - Ergebnisse:
    - entzogen → Dialog zu, Toast „Lizenz entzogen“
    - bereits entzogen → Dialog zu, Fehler-Toast
    - nicht zugeordnet → Dialog zu, Fehler-Toast
    - Fehler oder keine Verbindung → Hinweisbox im Dialog, „Entziehen“ lässt sich wieder klicken
    - Abbrechen → nichts passiert
  - Die Tests bilden die Action nach. Geprüft werden alle Zeilen oben und eine Adresse mit `<script>`, die als Text erscheint (EC-8).

## Stufe 5 — Liste und Seite

<!-- Braucht die Dialoge aus Stufe 4. Ohne [P]: T11 baut die Liste aus T10 ein, deshalb laufen die beiden nacheinander. -->

- [ ] T10  Lizenzliste  · files: src/features/licenses/components/license-list.tsx, src/features/licenses/components/license-list.test.tsx  · → AC-2, AC-3, AC-8, EC-4, EC-8
  - Bekommt Liste und Zustand als Wert und importiert nie `licenses.data.ts`.
  - Abschnitt „Vergebene Lizenzen“ (type-section).
  - Ab `md` Tabelle (shadcn `table`) mit den Spaltenköpfen „E-Mail-Adresse“, „Zugewiesen am“ und „Aktion“ (nur Screenreader). Die Spalte für die Einladung kommt mit PROJ-3 vor „Aktion“. In jeder Zeile steht `revoke-license-dialog` in der kleinen Darstellung.
  - Unter `md` eine Karte pro Lizenz: Adresse, darunter das Datum (type-small), „Entziehen“ in voller Breite. Die jeweils andere Fassung ist per `display: none` ausgeblendet.
  - Das Datum steht in einem `time`-Element mit dem vollen Zeitpunkt. Die Adresse ist reiner Text und darf an jeder Stelle umbrechen. Spalte und Knopf „Entziehen“ schrumpfen nie, es gibt kein seitliches Scrollen.
  - Leer und mindestens eine Lizenz frei: gedämpftes Symbol, „Noch keine Lizenz vergeben. Weisen Sie die erste zu.“ und `assign-license-dialog` in der Art „leerer Zustand“ (AC-3). Bei Kontingent 0 entfällt der Abschnitt ganz (EC-4).
  - Tests: Reihenfolge wie übergeben, beide Fassungen vorhanden, leerer Zustand, kein Abschnitt bei 0 von 0, lange Adresse als Text.
- [ ] T11  Seite Lizenzübersicht zusammensetzen  · files: src/app/(app)/licenses/page.tsx  · → AC-1, AC-2, AC-3, AC-7, AC-9, EC-4, EC-6
  - Ersetzt den Platzhalter aus PROJ-1. Seitentitel und `dynamic = 'force-dynamic'` bleiben.
  - Ablauf: Wächter → bei „nicht zugeordnet“ nichts (die Hinweisbox kommt aus dem Rahmen) → `listLicenses` mit der Träger-ID aus dem Wächter → Zustand aus T2 mit `license_quota` aus dem Wächter.
  - Ladefehler: unter dem Titel nur `licenses-load-error`, ohne Hauptaktion, Anzeige und Liste (EC-6).
  - Sonst: Seitenkopf mit Titel (type-title) und `assign-license-dialog` als Hauptaktion, gesperrt außer im Zustand „verfügbar“. Darunter `quota-summary` und `license-list`.
  - Kein eigener Unit-Test, wie bei der Seite in PROJ-1. `/build` prüft das Zusammenspiel im Browser gegen `http://localhost:3000/licenses`: zuweisen, schon vergeben, Kontingent voll, entziehen, Smartphone-Breite.

## Parallelisierung

- **Stufen sind Schranken.** Eine Stufe beginnt erst, wenn die vorige vollständig zusammengeführt und gegen ihre AC-IDs geprüft ist. So bleibt der Datenvertrag vor der Oberfläche: Datenbank (Stufe 1) → Grundlagen (2) → Actions und Anzeige (3) → Dialoge (4) → Liste und Seite (5).
- **`[P]` verlangt disjunkte Dateien.** Zwei `[P]`-Aufgaben derselben Stufe nennen nie denselben Pfad unter `files:`. Würden sie dieselbe Datei berühren, sind sie **nicht** beide `[P]`: Dann wird eine davon nach hinten gestellt, oder beide werden zusammengelegt.
- **Schnittstellen über Stufen hinweg:** Die Hinweis-ID (T2) verbindet die Anzeige (T6) mit dem gesperrten Knopf (T8). Die Beispieladressen stehen in T1 und T2 gleich. Die Werte der Dialoge (T8, T9) sind die, die design.md → Code-Struktur nennt. T10 und T11 bauen gegen genau diese.
- **Gemeinsame Ressource außerhalb der Dateien:** Die gehostete Datenbank ist für alle Arbeitskopien dieselbe. Nur T1 spielt eine Migration ein und testet gegen das gehostete Projekt. Spätere Tests bilden die Datenbank nach.
- **Dateien von PROJ-1:** Nur T4 (Verschieben von `form-feedback.tsx`) und T11 (Inhalt der Seite `/licenses`, die PROJ-1 als Platzhalter angelegt hat) berühren sie. Die Tests von PROJ-1 bleiben grün.
- **Grob, nicht kleinteilig, aber nie größer als der Kontext eines Subagenten.** Aufgaben sind sinnvolle Zwischenstände, keine Einzeilen-Änderungen. Jede hat ein Anliegen und höchstens vier Dateien.
- Während `/build` läuft jede `[P]`-Aufgabe der aktiven Stufe in einem eigenen Subagenten mit eigener Git-Arbeitskopie. Danach führt der Haupt-Agent zusammen, prüft gegen die AC-IDs der Stufe und hakt die Kästchen hier ab. Subagenten erklären sich nie selbst für fertig, es gibt einen einzigen Verantwortlichen für die Prüfung.
