# PROJ-2: Lizenzverwaltung

<!-- Diese Datei (spec.md) ist der stabile VERTRAG — sie legt fest WAS, nicht WIE.
     Eigentümer: /write-spec (erstellt), /refine (aktualisiert). Während /build ist diese Datei SCHREIBGESCHÜTZT.
     Das technische Design steht in design.md, die QA-Ergebnisse in qa-report.md.
     Kein Status- oder Datumsfeld hier: Der Status eines Features steht NUR in features/INDEX.md. -->

## Abhängigkeiten
- Braucht: PROJ-1 Konto & Login — Anmeldung, Wächter, Bildungsträger mit Kontingent, App-Rahmen und die Seite `/licenses`.
- Wird gebraucht von: PROJ-3 Einladungs-E-Mail — eine Zuweisung löst die Einladung aus, der Versandstatus erscheint in der Liste dieser Seite.

## User Stories
- Als Verwalter eines Bildungsträgers möchte ich auf einen Blick sehen, wie viele Lizenzen vergeben und wie viele frei sind, damit ich weiß, wie viel vom gekauften Kontingent übrig ist.
- Als Verwalter möchte ich einem Teilnehmer selbst über seine E-Mail-Adresse eine Lizenz zuweisen, damit er ohne Umweg über den Anbieter freigeschaltet wird.
- Als Verwalter möchte ich einem Teilnehmer, der abbricht, die Lizenz wieder entziehen, damit sie sofort für jemand anderen frei ist.
- Als Verwalter möchte ich sehen, welche Adressen schon eine Lizenz haben, damit ich niemanden doppelt freischalte.
- Als Verwalter möchte ich nicht versehentlich mehr Lizenzen vergeben, als wir gekauft haben, damit es keinen Ärger mit dem Anbieter gibt.
- Als Anbieter möchte ich, dass kein Bildungsträger über sein Kontingent hinaus Lizenzen vergeben kann, auch nicht am Formular vorbei, damit die Kontingente verlässlich sind.
- Als Teilnehmer (indirekt) möchte ich, dass nur mein Bildungsträger meine Adresse sieht und dass sie gelöscht ist, sobald ich keine Lizenz mehr habe.

## Out of Scope
- Einladungs-E-Mail, Versandstatus, Einladung erneut senden — PROJ-3
- Begrenzung, wie oft zugewiesen oder eingeladen werden darf (Schleife aus Zuweisen und Entziehen als Spam-Weg) — PROJ-3 begrenzt beim Versand
- Benachrichtigung des Teilnehmers beim Entziehen — falls gewünscht, in PROJ-3
- Adresse einer vergebenen Lizenz bearbeiten — stattdessen entziehen und neu zuweisen
- Name oder weitere Angaben zum Teilnehmer
- Mehrere Adressen auf einmal zuweisen, CSV-Import, Export der Liste
- Suche, Filter, andere Sortierung, Seitenaufteilung
- Warnstufe „Kontingent fast voll“
- Entziehen rückgängig machen
- Kontingent in der App ändern oder kaufen — der Anbieter ändert es in Supabase (`docs/PRD.md` → Nicht-Ziele)
- Protokoll, wer wann welche Lizenz hatte; Regel gegen die Weitergabe von Lizenzen; zeitlich begrenzte Lizenzen — `docs/PRD.md` → Später
- Kopplung an ein Lernkonto, Anmeldung der Teilnehmer — Nicht-Ziele des MVP
- Kontingent pro Kurs statt pro Bildungsträger — später (`docs/data-model.md`)

## Akzeptanzkriterien

- [ ] **AC-1** — Angenommen ein Verwalter ist angemeldet und sein Bildungsträger hat ein Kontingent von 5 Lizenzen, von denen 2 vergeben sind, wenn er die Lizenzübersicht öffnet, dann sieht er „2 von 5 Lizenzen vergeben“ und „3 frei“ als Zahlen, dazu einen Balken mit dem vergebenen Anteil, und beide Zahlen stimmen nach jeder Zuweisung und jedem Entziehen, ohne dass er die Seite neu laden muss.
- [ ] **AC-2** — Angenommen der Bildungsträger hat vergebene Lizenzen, wenn der Verwalter die Lizenzübersicht öffnet, dann sieht er alle Lizenzen seines Trägers mit E-Mail-Adresse und Datum der Zuweisung, die zuletzt zugewiesene oben, alle auf einer Seite, jede mit der Aktion „Entziehen“.
- [ ] **AC-3** — Angenommen der Bildungsträger hat noch keine Lizenz vergeben und mindestens eine frei, wenn der Verwalter die Lizenzübersicht öffnet, dann sieht er „0 von 5 Lizenzen vergeben“ und statt der Liste „Noch keine Lizenz vergeben. Weisen Sie die erste zu.“ mit dem Weg zum Zuweisen.
- [ ] **AC-4** — Angenommen mindestens eine Lizenz ist frei, wenn der Verwalter auf „Lizenz zuweisen“ klickt, eine gültige E-Mail-Adresse eingibt und bestätigt, dann ist für diese Adresse eine Lizenz seines Bildungsträgers angelegt, sie steht oben in der Liste, die Anzeige zählt eine vergebene mehr und eine freie weniger, und er sieht „Lizenz zugewiesen“.
- [ ] **AC-5** — Angenommen der Verwalter gibt beim Zuweisen eine leere oder ungültige E-Mail-Adresse ein (leer nach Entfernen der Leerzeichen am Rand, kein gültiges Format oder länger als 254 Zeichen), wenn er bestätigt, dann wird nichts angelegt, am Feld steht eine verständliche Meldung, seine Eingabe bleibt stehen, und dieselben Regeln gelten für Anfragen, die das Formular umgehen.
- [ ] **AC-6** — Angenommen eine E-Mail-Adresse hat beim eigenen Bildungsträger bereits eine Lizenz, wenn der Verwalter sie noch einmal zuweist (auch mit anderer Groß- und Kleinschreibung oder mit Leerzeichen am Rand), dann entsteht keine zweite Lizenz, das Kontingent bleibt unverändert, und er sieht „Diese E-Mail-Adresse hat bereits eine Lizenz.“; hat die Adresse nur bei einem anderen Bildungsträger eine Lizenz, wird sie normal zugewiesen, und der Verwalter erfährt davon nichts.
- [ ] **AC-7** — Angenommen alle Lizenzen des Kontingents sind vergeben, wenn der Verwalter die Lizenzübersicht öffnet, dann ist „Lizenz zuweisen“ gesperrt und er sieht „Ihr Kontingent ist ausgeschöpft. Für weitere Lizenzen wenden Sie sich an den Anbieter.“; eine Zuweisung, die die Oberfläche umgeht, lehnt die Datenbank ab, und es entsteht nie eine Lizenz über das Kontingent hinaus.
- [ ] **AC-8** — Angenommen eine Lizenz ist vergeben, wenn der Verwalter bei ihr auf „Entziehen“ klickt, dann fragt ein Bestätigungsdialog „Lizenz von <Adresse> entziehen? Die Lizenz ist danach sofort wieder frei.“; bestätigt er, ist die Lizenz gelöscht und aus der Liste verschwunden, die Anzeige zählt eine freie Lizenz mehr, er sieht „Lizenz entzogen“, und die Lizenz lässt sich sofort neu zuweisen, auch an dieselbe Adresse; bricht er ab, bleibt alles unverändert.
- [ ] **AC-9** — Angenommen der Anbieter hat das Kontingent in Supabase unter die Zahl der vergebenen Lizenzen gesenkt (z. B. 5 vergeben, Kontingent 3), wenn der Verwalter die Lizenzübersicht öffnet, dann bleiben alle 5 Lizenzen bestehen, er sieht „5 von 3 Lizenzen vergeben“, „0 frei“ und den Hinweis „Ihr Kontingent ist überschritten. Bestehende Lizenzen bleiben gültig. Neue können Sie erst zuweisen, wenn weniger Lizenzen vergeben sind, als Ihr Kontingent erlaubt.“, und „Lizenz zuweisen“ bleibt gesperrt, bis er genug Lizenzen entzogen hat.
- [ ] **AC-10** — Angenommen es gibt zwei Bildungsträger A und B, wenn der Verwalter von A Lizenzen liest, zuweist oder entzieht — über die Oberfläche oder direkt über die Datenbank-Schnittstelle mit seiner eigenen Anmeldung —, dann sieht er nur die Lizenzen von A, und jeder Versuch wird abgelehnt, eine Lizenz von B zu lesen oder zu entziehen, eine Lizenz für B anzulegen, eine bestehende Lizenz zu ändern oder eine Lizenz über das Kontingent hinaus anzulegen; ein abgemeldeter Besucher bekommt gar keine Zeilen.
- [ ] **AC-11** — Angenommen eine Lizenz wird entzogen oder ihr Bildungsträger wird gelöscht (auch durch das Löschen des Kontos seines Verwalters, PROJ-1 AC-12), wenn der Vorgang abgeschlossen ist, dann ist die E-Mail-Adresse des Teilnehmers vollständig aus der Datenbank verschwunden: keine Kopie, kein „entzogen“-Vermerk, kein Protokoll. (Art. 5 Abs. 1 lit. e, Art. 17 DSGVO)
- [ ] **AC-12** — Angenommen eine Lizenz wird zugewiesen, wenn sie gespeichert wird, dann hält die Lizenzzentrale über den Teilnehmer nur seine E-Mail-Adresse und den Zeitpunkt der Zuweisung fest, zugeordnet zum Bildungsträger, und keinen Namen und keine weiteren Angaben. (Art. 5 Abs. 1 lit. c DSGVO)

## Edge Cases

> Zeitkritische Muster geprüft. Knappe Ressource: das Kontingent (EC-1, EC-2). Keine Statusfolge, denn eine Lizenz besteht oder nicht, und den Versandstatus bringt PROJ-3. Auslöser von außen: nur die Änderung des Kontingents durch den Anbieter (AC-9, EC-10).

- [ ] **EC-1** — Angenommen nur noch eine Lizenz ist frei und der Verwalter weist sie in zwei Tabs gleichzeitig zwei verschiedenen Adressen zu, wenn beide Anfragen ankommen, dann gelingt genau eine; die andere wird mit „Ihr Kontingent ist ausgeschöpft.“ abgelehnt, es entsteht nichts, und die Anzeige in diesem Tab zeigt danach den aktuellen Stand. Dasselbe gilt, wenn ein Tab noch eine freie Lizenz zeigt, die im anderen Tab schon vergeben wurde.
- [ ] **EC-2** — Angenommen der Verwalter klickt mehrfach schnell auf Bestätigen oder weist dieselbe Adresse in zwei Tabs gleichzeitig zu, wenn die Anfragen verarbeitet werden, dann entsteht genau eine Lizenz; der Knopf ist während des Absendens gesperrt, und eine zweite Anfrage endet mit der Meldung aus AC-6.
- [ ] **EC-3** — Angenommen der Verwalter entzieht dieselbe Lizenz in zwei Tabs, wenn er im zweiten Tab bestätigt, dann wird nichts weiter gelöscht, er sieht „Diese Lizenz wurde bereits entzogen.“, und Liste und Anzeige zeigen den aktuellen Stand.
- [ ] **EC-4** — Angenommen der Anbieter hat das Kontingent auf 0 gesetzt und es ist keine Lizenz vergeben, wenn der Verwalter die Lizenzübersicht öffnet, dann sieht er „0 von 0 Lizenzen vergeben“ und den Hinweis aus AC-7 statt der Aufforderung, die erste Lizenz zuzuweisen.
- [ ] **EC-5** — Angenommen die Verbindung bricht ab oder der Server meldet einen Fehler, wenn der Verwalter zuweist oder entzieht, dann sieht er „Keine Verbindung. Bitte versuchen Sie es erneut.“ bzw. „Das hat nicht geklappt. Bitte versuchen Sie es erneut.“, die eingegebene Adresse bleibt stehen, die Lizenz ist entweder ganz angelegt bzw. entzogen oder gar nicht, und nach dem Neuladen zeigen Liste und Anzeige den tatsächlichen Stand.
- [ ] **EC-6** — Angenommen die Lizenzen lassen sich beim Öffnen der Übersicht nicht laden, wenn die Seite erscheint, dann zeigt sie die Hinweisbox „Die Lizenzen konnten nicht geladen werden.“ mit „Erneut versuchen“, und nie eine leere Liste oder „0 von 5“, als wäre nichts vergeben.
- [ ] **EC-7** — Angenommen der Verwalter hat sich in einem anderen Tab abgemeldet, wenn er zuweist oder entzieht, dann passiert nichts, und er landet beim Login mit „Bitte melden Sie sich erneut an.“ (PROJ-1 EC-6); ist sein Konto keinem Bildungsträger zugeordnet, bricht die Aktion mit der Meldung aus PROJ-1 EC-5 ab, ohne etwas zu lesen oder zu schreiben.
- [ ] **EC-8** — Angenommen eine Adresse ist sehr lang oder enthält Sonderzeichen, wenn sie in der Liste oder im Bestätigungsdialog erscheint, dann wird sie als reiner Text gezeigt und auf schmalen Bildschirmen umbrochen oder gekürzt, „Entziehen“ bleibt erreichbar, und auf dem Smartphone steht jede Lizenz als eigene Karte ohne seitliches Scrollen.
- [ ] **EC-9** — Angenommen der Verwalter weist seiner eigenen E-Mail-Adresse eine Lizenz zu, wenn er bestätigt, dann wird sie wie jede andere Adresse behandelt und zählt ins Kontingent.
- [ ] **EC-10** — Angenommen der Anbieter ändert das Kontingent, während die Übersicht offen ist, wenn der Verwalter danach zuweist, dann gilt das neue Kontingent, und die Anzeige zeigt nach der Aktion den aktuellen Stand.

## Technische Anforderungen
- **Sicherheit:** Jede Regel dieser Spec (Validierung, Kontingent, eine Lizenz pro Adresse und Träger, Datentrennung) gilt auf dem Server bzw. in der Datenbank, nicht nur in der Oberfläche. Kontingent und Eindeutigkeit hält die Datenbank auch bei gleichzeitigen Anfragen ein. Die Datentrennung wird zweifach durchgesetzt: in der Anwendung und mit Row Level Security.
- Der Bildungsträger einer Aktion kommt immer aus dem Wächter `requireTrainingProvider()` (`docs/app-shell.md`), nie aus Daten, die der Browser mitschickt. Das Kontingent bleibt für Verwalter schreibgeschützt (PROJ-1 AC-11).
- Teilnehmer-Adressen stehen nie in einer URL. Das Entziehen benennt die Lizenz, nicht die Adresse. Zuweisen und Entziehen laufen per POST.
- **Datenhaltung:** Supabase eu-central-1. Tabelle und Spalten englisch und kompatibel zur Plattform (`docs/data-model.md`), so angelegt, dass später ein Verweis auf ein Lernkonto dazukommen kann. Lizenzen hängen per Löschkaskade am Bildungsträger (Vorgabe aus PROJ-1).
- **Anschluss an PROJ-3:** Die Zuweisung ist der Auslöser der Einladung. Die Liste lässt Platz für den Versandstatus (`docs/app-shell.md`).
- **Gestaltung:** Seitenmuster aus `docs/app-shell.md` (Titel, Hauptaktion „Lizenz zuweisen“ rechts bzw. auf dem Smartphone in voller Breite, Skeletons, Toasts). Kontingent-Anzeige, „Entziehen“ als destruktiver Knopf mit Bestätigungsdialog und die Tabelle, die auf dem Smartphone zu Karten umbricht, laut `docs/design-system.md`.
- **Umfang:** ausgelegt für Kontingente bis zu einigen hundert Lizenzen auf einer Seite.
- **Browser:** aktuelle Versionen von Chrome, Firefox, Safari und Edge, nutzbar ab Smartphone-Breite.

## Offene Fragen
- [ ] Für einen Anwalt: Verarbeitet der Anbieter die Teilnehmer-Adressen im Auftrag des Bildungsträgers (Art. 28 DSGVO, dann ein AVV mit jedem Träger) oder als eigener Verantwortlicher? Vor dem Live-Gang klären (`docs/privacy.md`).
- [ ] Wer informiert die Teilnehmer, dass ihre Adresse in der Lizenzzentrale gespeichert ist (Art. 14 DSGVO): der Bildungsträger selbst oder ein Hinweis in der Einladungs-E-Mail? Das hängt an der Frage davor und wird in PROJ-3 geklärt.

## Decision Log

### Produktentscheidungen
| Entscheidung | Begründung | Datum |
|---|---|---|
| Beim Zuweisen wird nur die E-Mail-Adresse erfasst | Datensparsam und eindeutig, entspricht dem Datenmodell. Ein Name würde ein weiteres personenbezogenes Feld bringen, ohne dass das MVP es braucht. | 2026-10-25 |
| Letzte Lizenz gleichzeitig: genau eine Zuweisung gelingt | Das PRD verlangt, dass nie mehr vergeben wird, als gekauft wurde. Der Verwalter bekommt eine klare Meldung statt eines stillen Fehlers. | 2026-10-25 |
| Senkt der Anbieter das Kontingent unter die vergebene Zahl, bleiben die Lizenzen | Kein Teilnehmer verliert ohne Ankündigung seinen Zugang. Die Anzeige macht die Überschreitung sichtbar, und neue Zuweisungen sind gesperrt, bis der Stand wieder passt. | 2026-10-25 |
| Keine Begrenzung des Zuweisens in PROJ-2, die Spam-Grenze kommt in PROJ-3 | Das Kontingent ist die Schranke für Lizenzen. Schaden entsteht erst beim Mailversand, also begrenzt PROJ-3 dort. | 2026-10-25 |
| Eine vergebene Lizenz lässt sich nicht bearbeiten | Entziehen und neu zuweisen deckt Vertipper ab, ohne einen weiteren Ablauf. Ab PROJ-3 geht die Einladung dann sauber an die neue Adresse. | 2026-10-25 |
| Liste: alle Lizenzen, die neueste zuerst, ohne Suche und Seitenaufteilung | Kontingente sind klein (Startwert 5). Die zuletzt vergebenen sind die, die man meist sucht. Eine Suche lässt sich mit `/refine` nachrüsten. | 2026-10-25 |
| Entziehen löscht die Lizenz ohne Spur, mit Bestätigungsdialog | So legt es das PRD fest (sofort wieder frei, Datensparsamkeit). Der Dialog schützt vor dem Verklicken, weil sich nichts zurückholen lässt. | 2026-10-25 |
| Dieselbe Adresse darf bei mehreren Trägern eine Lizenz haben, ohne dass einer vom anderen erfährt | Das legt das Datenmodell fest. Ein Hinweis würde verraten, bei welchen anderen Instituten jemand Teilnehmer ist. | 2026-10-25 |
| Keine Warnstufe „fast voll“ | Die Anzeige „X von Y, Z frei“ reicht. Es gibt nur „voll“ und „überschritten“. | 2026-10-25 |
