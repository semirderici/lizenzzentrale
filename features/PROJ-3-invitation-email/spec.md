# PROJ-3: Einladungs-E-Mail

<!-- Diese Datei (spec.md) ist der stabile VERTRAG — sie legt fest WAS, nicht WIE.
     Eigentümer: /write-spec (erstellt), /refine (aktualisiert). Während /build ist diese Datei SCHREIBGESCHÜTZT.
     Das technische Design steht in design.md, die QA-Ergebnisse in qa-report.md.
     Kein Status- oder Datumsfeld hier: Der Status eines Features steht NUR in features/INDEX.md. -->

## Abhängigkeiten
- Braucht: PROJ-2 Lizenzverwaltung — die Zuweisung löst die Einladung aus, die Liste der Lizenzübersicht zeigt den Versandstatus, Entziehen löscht die Lizenz.
- Mittelbar: PROJ-1 Konto & Login — Wächter, Bildungsträger und sein Name, der in der Einladung steht.

## User Stories
- Als Verwalter eines Bildungsträgers möchte ich, dass jeder Teilnehmer beim Zuweisen automatisch eine Einladung bekommt, damit ich ihm nicht selbst schreiben muss.
- Als Verwalter möchte ich bei jeder Lizenz sehen, ob die Einladung versendet wurde, damit ich weiß, wer Bescheid hat und wo ich nachhaken muss.
- Als Verwalter möchte ich eine Einladung erneut senden, wenn sie fehlgeschlagen ist oder beim Teilnehmer nicht ankam, damit er trotzdem loslegen kann.
- Als Teilnehmer möchte ich in der Einladung lesen, wer mich freigeschaltet hat, wie es weitergeht und was über mich gespeichert ist.
- Als Anbieter möchte ich, dass sich die Lizenzzentrale nicht zum Verschicken von Spam missbrauchen lässt, auch nicht durch ständiges Zuweisen und Entziehen, damit der E-Mail-Dienst und mein Ruf keinen Schaden nehmen.
- Als Teilnehmer möchte ich, dass nach dem Entziehen meiner Lizenz auch nichts über meine Einladung zurückbleibt.

## Out of Scope
- Mitteilung an den Teilnehmer beim Entziehen der Lizenz — bewusst weggelassen (siehe Decision Log)
- Zustellstatus, Rückläufer (Bounces), Rückmeldungen des E-Mail-Dienstes — bräuchten eine öffentliche Adresse der App; „Versendet“ heißt „vom Dienst angenommen“
- Öffnungs- und Klickverfolgung — ausdrücklich ausgeschlossen (AC-11)
- Automatische Neuversuche im Hintergrund — der Verwalter sendet von Hand erneut
- Eigener Text, eigene Vorlage oder Logo des Bildungsträgers in der Einladung
- Trägername als Absender, Antwortadresse, Weitergabe der Adresse des Verwalters
- „Alle erneut senden“, Massenversand, Erinnerungsmails
- Einladung an eine andere Adresse als die der Lizenz — stattdessen entziehen und neu zuweisen (PROJ-2)
- Verlauf aller Versandversuche — es zählt nur der letzte Stand
- Versandgrenzen in der App ändern
- Anmeldelink mit Token, Kopplung an ein Lernkonto, Anmeldung der Teilnehmer — Nicht-Ziele des MVP (`docs/PRD.md`)
- Einladung in anderen Sprachen — die Oberfläche und die Mail sind nur auf Deutsch
- Vollständige Datenschutzerklärung und Impressum — beim Live-Gang (`docs/PRD.md` → Später)

## Akzeptanzkriterien

- [ ] **AC-1** — Angenommen ein Verwalter weist eine Lizenz zu (PROJ-2 AC-4), wenn die Lizenz angelegt ist, dann bekommt die Adresse automatisch genau eine Einladung, der Toast heißt „Lizenz zugewiesen“ mit dem Zusatz „Die Einladung ist versendet.“, und in der Liste steht bei dieser Lizenz „Versendet am TT.MM.JJJJ“.
- [ ] **AC-2** — Angenommen eine Einladung wird versendet, wenn der Teilnehmer sie öffnet, dann kommt sie vom Absender „Lizenzzentrale“ ohne Antwortadresse, mit dem Betreff „Ihre Lizenz für den Kurs Geprüfter Technischer Betriebswirt (IHK)“, auf Deutsch in der Sie-Form, und sie sagt: welcher Bildungsträger (Name als reiner Text) ihm eine Lizenz für diesen Kurs freigeschaltet hat, einen Knopf „Zur Lernplattform“ mit dem Hinweis, sich dort mit genau dieser E-Mail-Adresse anzumelden, und „Bei Fragen wenden Sie sich an <Trägername>.“; sonst enthält sie nichts, was der Verwalter beeinflussen kann.
- [ ] **AC-3** — Angenommen der Versand scheitert (der E-Mail-Dienst lehnt ab, ist nicht erreichbar oder antwortet nicht innerhalb von 10 Sekunden), wenn der Verwalter zuweist, dann bleibt die Lizenz zugewiesen und zählt ins Kontingent, er sieht den Warn-Toast „Lizenz zugewiesen. Die Einladung konnte nicht versendet werden. Sie können sie in der Liste erneut senden.“, und in der Liste steht „Fehlgeschlagen“.
- [ ] **AC-4** — Angenommen der Bildungsträger hat Lizenzen, wenn der Verwalter die Lizenzübersicht öffnet, dann steht bei jeder Lizenz (Tabelle: Spalte „Einladung“; Smartphone: in der Karte, ohne seitliches Scrollen) genau einer der Zustände „Wird versendet“, „Versendet am TT.MM.JJJJ“, „Fehlgeschlagen“ oder „Noch nicht eingeladen“, als Text und nicht nur als Farbe; es gilt immer das Ergebnis des letzten Versuchs, und daneben steht „Erneut senden“ (bei „Versendet“ und „Fehlgeschlagen“), „Einladung senden“ (bei „Noch nicht eingeladen“) oder keine Aktion (bei „Wird versendet“).
- [ ] **AC-5** — Angenommen eine Einladung steht auf „Versendet“ oder „Fehlgeschlagen“ und keine Versandgrenze ist erreicht, wenn der Verwalter auf „Erneut senden“ klickt, dann geht genau eine Einladung mit demselben Inhalt an die gespeicherte Adresse der Lizenz, er sieht „Einladung versendet“ bzw. „Die Einladung konnte nicht versendet werden. Bitte versuchen Sie es später erneut.“, und die Liste zeigt ohne Neuladen das Ergebnis dieses Versuchs.
- [ ] **AC-6** — Angenommen eine Lizenz wurde vor PROJ-3 zugewiesen und hat noch nie eine Einladung bekommen, wenn der Verwalter die Lizenzübersicht öffnet, dann steht bei ihr „Noch nicht eingeladen“ mit „Einladung senden“, es geht nichts automatisch raus, und ein Klick versendet sie wie in AC-5.
- [ ] **AC-7** — Angenommen an eine Lizenz wurden in den letzten 24 Stunden bereits 3 Einladungen versendet (gezählt wird nur, was der E-Mail-Dienst angenommen hat), wenn der Verwalter erneut sendet — über die Oberfläche oder an ihr vorbei —, dann geht nichts raus, der Status bleibt unverändert, und er sieht „Diese Einladung wurde in den letzten 24 Stunden bereits dreimal versendet. Sie können sie ab TT.MM.JJJJ, HH:MM Uhr erneut senden.“
- [ ] **AC-8** — Angenommen der Bildungsträger hat in den letzten 24 Stunden bereits 30 Einladungen versendet (alle seine Lizenzen zusammen, auch inzwischen entzogene), wenn eine weitere Einladung ansteht, dann geht nichts raus: Beim Zuweisen bleibt die Lizenz bestehen, steht auf „Noch nicht eingeladen“, und der Toast heißt „Lizenz zugewiesen“ mit dem Zusatz „Die Einladung wurde nicht versendet, weil Ihr Bildungsträger in den letzten 24 Stunden bereits 30 Einladungen versendet hat. Sie können sie ab TT.MM.JJJJ, HH:MM Uhr senden.“; beim (erneuten) Senden bleibt der Status unverändert, und dieselbe Begründung erscheint als Fehler-Toast. Das gilt auch an der Oberfläche vorbei.
- [ ] **AC-9** — Angenommen es gibt zwei Bildungsträger A und B, wenn der Verwalter von A Versandstände liest oder Einladungen auslöst — über die Oberfläche oder direkt über die Datenbank-Schnittstelle mit seiner eigenen Anmeldung —, dann sieht er nur die Versandstände der Lizenzen von A, kann für Lizenzen von B keine Einladung auslösen, die Einladung geht immer an die gespeicherte Adresse der Lizenz und nie an eine mitgeschickte, und jeder Versuch, einen Versandstand oder einen Zähler der Versandgrenze direkt anzulegen, zu ändern oder zu löschen, wird abgelehnt; ein abgemeldeter Besucher bekommt gar keine Zeilen.
- [ ] **AC-10** — Angenommen eine Einladung wird versendet, wenn der Teilnehmer sie liest, dann steht am Ende der Hinweis „<Trägername> hat Ihre E-Mail-Adresse in der Lizenzzentrale eingetragen, um Ihnen diese Lizenz zuzuordnen. Gespeichert werden nur Ihre E-Mail-Adresse, der Zeitpunkt der Zuweisung und der Versandstand dieser Einladung, bis <Trägername> die Lizenz entzieht. Fragen dazu richten Sie bitte an <Trägername>.“ (Art. 14 DSGVO)
- [ ] **AC-11** — Angenommen eine Einladung wird versendet, wenn sie beim Teilnehmer ankommt, dann enthält sie keine Werbung, kein Zählpixel und keine über den E-Mail-Dienst umgeleiteten Links; der Knopf führt direkt zur Lernplattform. (Art. 5 Abs. 1 lit. c DSGVO, § 25 TDDDG)
- [ ] **AC-12** — Angenommen eine Lizenz wird entzogen oder ihr Bildungsträger wird gelöscht (auch über das Löschen des Kontos, PROJ-1 AC-12), wenn der Vorgang abgeschlossen ist, dann ist auch ihr Versandstand gelöscht; der Versandstand hält nie mehr fest als Zustand, Zeitpunkt des letzten Versuchs und Zahl der Versendungen — keine Kopie der Adresse, keinen Mailinhalt —, und die Zähler der Versandgrenze eines Trägers enthalten keine Teilnehmer-Adresse und sind nach 24 Stunden gelöscht. (Art. 5 Abs. 1 lit. c und e, Art. 17 DSGVO)

## Edge Cases

> Zeitkritische Muster geprüft. Knappe Ressource: die Versandgrenze (EC-2). Statusfolge: „Noch nicht eingeladen“ → „Wird versendet“ → „Versendet“ oder „Fehlgeschlagen“, jedes erneute Senden beginnt wieder bei „Wird versendet“, zurück zu „Noch nicht eingeladen“ geht es nie (AC-4, EC-1, EC-3). Auslöser von außen: die Antwort des E-Mail-Dienstes (AC-3, EC-4); Rückmeldungen über die Zustellung gibt es nicht (Out of Scope).

- [ ] **EC-1** — Angenommen für eine Lizenz läuft gerade ein Versand (nach dem Zuweisen oder aus einem anderen Tab), wenn der Verwalter für sie sendet, dann geht keine zweite Mail raus, er sieht „Die Einladung wird gerade versendet.“, und nur der laufende Versand zählt zur Grenze; während des Sendens ist der Knopf gesperrt.
- [ ] **EC-2** — Angenommen der Bildungsträger hat in 24 Stunden 29 Einladungen versendet und zwei Versendungen für verschiedene Lizenzen kommen gleichzeitig an, wenn beide verarbeitet werden, dann geht genau eine raus, und die andere endet mit der Meldung aus AC-8.
- [ ] **EC-3** — Angenommen ein Versand bleibt hängen (z. B. bricht der Server mittendrin ab), wenn seit seinem Start 2 Minuten vergangen sind, dann zeigt die Liste „Fehlgeschlagen“, und der Verwalter kann erneut senden.
- [ ] **EC-4** — Angenommen der E-Mail-Dienst antwortet nicht innerhalb von 10 Sekunden, die Mail geht aber trotzdem raus, wenn der Verwalter danach erneut sendet, dann bekommt der Teilnehmer die Einladung womöglich doppelt; das wird in Kauf genommen, und die Liste zeigt nach dem neuen Versuch dessen Ergebnis.
- [ ] **EC-5** — Angenommen der Verwalter entzieht eine Lizenz, während ihre Einladung unterwegs ist, wenn beides abgeschlossen ist, dann ist die Lizenz entzogen und von ihr und ihrer Einladung bleibt nichts in der Datenbank, auch wenn die Mail noch ankommt; sendet er danach in einem anderen Tab erneut, sieht er „Diese Lizenz wurde bereits entzogen.“ (PROJ-2 EC-3).
- [ ] **EC-6** — Angenommen der Verwalter entzieht eine Lizenz und weist dieselbe Adresse neu zu, wenn die neue Lizenz angelegt ist, dann geht automatisch eine neue Einladung raus; die Grenze pro Lizenz beginnt für die neue Lizenz bei null, die Versendungen der alten zählen aber weiter zur Grenze des Trägers (AC-8).
- [ ] **EC-7** — Angenommen der Trägername enthält Sonderzeichen, HTML oder etwas, das wie ein Link aussieht, oder ist sehr lang, wenn er in der Einladung erscheint, dann steht er dort als reiner Text, ohne Formatierung und ohne anklickbaren Link, und die Einladung ist auch in Mailprogrammen lesbar, die nur Text anzeigen.
- [ ] **EC-8** — Angenommen die Adresse des Teilnehmers enthält `+`, Bindestriche oder eine Subdomain, wenn die Einladung versendet wird, dann geht sie an genau die Adresse, die in der Liste steht.
- [ ] **EC-9** — Angenommen der Zugang zum E-Mail-Dienst oder das Linkziel der Lernplattform ist nicht eingestellt oder ungültig, wenn eine Einladung ansteht, dann startet die App trotzdem, Zuweisen funktioniert, jeder Versand endet als „Fehlgeschlagen“ wie in AC-3, und der Verwalter sieht keinen Schlüssel und keine technische Fehlermeldung des Dienstes.
- [ ] **EC-10** — Angenommen die Verbindung bricht ab, wenn der Verwalter erneut sendet, dann sieht er „Keine Verbindung. Bitte versuchen Sie es erneut.“, und nach dem Neuladen zeigt die Liste den tatsächlichen Stand.
- [ ] **EC-11** — Angenommen der Verwalter hat sich in einem anderen Tab abgemeldet oder sein Konto ist keinem Bildungsträger zugeordnet, wenn er sendet, dann geht nichts raus, und es gilt dasselbe wie in PROJ-2 EC-7.
- [ ] **EC-12** — Angenommen das Kontingent ist ausgeschöpft oder überschritten (PROJ-2 AC-7, AC-9), wenn der Verwalter für eine bestehende Lizenz erneut sendet, dann ist das wie sonst möglich; das Kontingent begrenzt Lizenzen, nicht Einladungen.

## Technische Anforderungen
- **E-Mail-Dienst:** Wahl bei `/architecture`. Kriterien aus `docs/PRD.md`: kostenloser Tarif, Schlüssel ohne Kreditkarte selbst erzeugbar, Versand an beliebige Empfänger möglichst ohne eigene Domain, Verarbeitung in der EU bevorzugt. Dazu aus dieser Spec: Öffnungs- und Klickverfolgung lassen sich abschalten (AC-11), das Versandprotokoll des Dienstes wird so kurz wie möglich aufbewahrt. Er wird in `docs/privacy.md` als Auftragsverarbeiter geführt.
- **Sicherheit:** Versandgrenzen, Datentrennung und Schreibschutz der Versandstände gelten auf dem Server bzw. in der Datenbank, nicht nur in der Oberfläche, auch bei gleichzeitigen Anfragen. Der Bildungsträger kommt immer aus dem Wächter `requireTrainingProvider()`, die Empfängeradresse immer aus der gespeicherten Lizenz. Die Datentrennung wird zweifach durchgesetzt: in der Anwendung und mit Row Level Security.
- **Geheimnisse:** Versendet wird nur vom Server. Der Schlüssel des E-Mail-Dienstes erreicht nie den Browser. Jede neue Variable (Schlüssel, Absender, Linkziel) bekommt einen Platzhalter in `.env.local.example`.
- **Keine Teilnehmer-Adressen in URLs oder Protokollen der App.** „Erneut senden“ benennt die Lizenz, nicht die Adresse, und läuft per POST. Fehlermeldungen des Dienstes werden nicht wörtlich angezeigt. Für `/architecture`: PROJ-2 QA, Beobachtung O-1 (Adressen im Datenbank-Protokoll bei Zugriffen mit `service_role`).
- **Datenhaltung:** Supabase eu-central-1. Versandstände hängen per Löschkaskade an der Lizenz (`docs/data-model.md`). Tabellen und Spalten englisch und kompatibel zur Plattform.
- **Nachvollziehbar für den Prüfer:** Die README beschreibt, wie man einen eigenen Zugang zum E-Mail-Dienst anlegt und Absender und Linkziel einstellt (`docs/PRD.md` → Rahmenbedingungen). Geprüft wird mit einer echten eigenen Adresse. Adressen unter `example.com` sind nicht zustellbar.
- **Gestaltung:** Spalte „Einladung“ in der Tabelle der Lizenzübersicht, auf dem Smartphone in der Karte (`docs/app-shell.md`). Status als Text mit Symbol, Knöpfe mit Tippfläche ≥ 44 × 44 px, Rückmeldungen als Toasts (`docs/design-system.md`). Datum „TT.MM.JJJJ“, Uhrzeiten in Europe/Berlin.
- **Browser:** aktuelle Versionen von Chrome, Firefox, Safari und Edge, nutzbar ab Smartphone-Breite.

## Offene Fragen
- [ ] Für einen Anwalt: Reicht der kurze Hinweis aus AC-10 für Art. 14 DSGVO, oder braucht die Einladung mehr Angaben (Verantwortlicher, Rechtsgrundlage, Empfänger wie der E-Mail-Dienst, Betroffenenrechte)? Das hängt an der offenen Rollenfrage aus PROJ-2 (Auftragsverarbeitung oder eigener Verantwortlicher). Vor dem Live-Gang klären (`docs/privacy.md`).
- [ ] Welche Adresse hat die Lernplattform beim Live-Gang? Bis dahin stellt der Betreiber bzw. Prüfer das Linkziel selbst ein.
- [ ] Vor dem Live-Gang (aus `/architecture`): Mailjet legt jeden Empfänger automatisch als Kontakt an und löscht Kontakte und Versandverlauf nicht von selbst. Reicht ein regelmäßiges Löschen durch den Betreiber, oder soll das Entziehen einer Lizenz den Kontakt bei Mailjet gleich mitlöschen (Folge-Feature über Mailjets GDPR-Löschung)? Die Spec verlangt eine möglichst kurze Aufbewahrung beim Dienst.

## Decision Log

### Produktentscheidungen
| Entscheidung | Begründung | Datum |
|---|---|---|
| Scheitert der Versand, bleibt die Lizenz; die Einladung steht auf „Fehlgeschlagen“ | Zuweisen und Einladen sind getrennte Dinge. Ein Ausfall des E-Mail-Dienstes soll keine Zuweisung kosten, und der Verwalter kann von Hand nachsenden. | 2026-10-26 |
| Kein automatischer Neuversuch im Hintergrund | Die App läuft nur lokal, einen dauerhaft laufenden Hintergrundjob gibt es nicht. „Erneut senden“ reicht für das MVP. | 2026-10-26 |
| „Erneut senden“ auch bei „Versendet“ | „Versendet“ heißt nur „vom Dienst angenommen“. Der häufigste Fall ist eine Mail im Spam-Ordner, ohne Nachsenden bliebe nur Entziehen und neu Zuweisen. | 2026-10-26 |
| Versandgrenze: 3 pro Lizenz und 30 pro Bildungsträger in 24 Stunden | Ohne Bestätigungsmail bei der Registrierung kann jeder einen Träger anlegen und über Zuweisen und Entziehen Mails an fremde Adressen schicken. 30 am Tag reichen für 5 Startlizenzen samt Nachsenden und begrenzen die Schleife. Die Grenze des Trägers überlebt das Entziehen, sonst wäre sie wirkungslos. | 2026-10-26 |
| Es zählen nur Mails, die der Dienst angenommen hat; abgelehnte Versuche und Grenz-Ablehnungen zählen nie | Spam entsteht nur durch Mails, die rausgehen. Bei einem Ausfall des Dienstes sperrt sich der Verwalter so nicht selbst aus. | 2026-10-26 |
| Grenze beim Zuweisen erreicht: Lizenz bleibt, Einladung „Noch nicht eingeladen“ | Konsistent mit „Lizenz bleibt“. Es wurde kein Versuch gemacht, also ist es auch kein Fehlschlag. Der Verwalter sendet später. | 2026-10-26 |
| Inhalt: Infotext und ein Knopf zur Lernplattform mit dem Hinweis, sich mit genau dieser Adresse anzumelden; Linkziel einstellbar | Der Teilnehmer soll wissen, was er als Nächstes tut. Die Lizenz hängt an der Adresse, bis die Kopplung an ein Lernkonto kommt. Einstellbar, weil die Plattform noch keine öffentliche Adresse hat. | 2026-10-26 |
| Absender immer „Lizenzzentrale“, keine Antwortadresse, Trägername nur im Text und nicht im Betreff | Den Trägernamen wählt jeder frei und ungeprüft. Im Absender oder Betreff wäre er ein Werkzeug für Phishing („Sparkasse“). Die Adresse des Verwalters ist nie bestätigt worden und wird nicht weitergegeben. | 2026-10-26 |
| Kein eigener Text des Verwalters in der Einladung | Ein freies Feld würde die Lizenzzentrale zum Spam- und Phishing-Kanal machen. | 2026-10-26 |
| Kurzer Datenschutzhinweis in der Einladung | Die Einladung ist der erste Kontakt der Lizenzzentrale mit dem Teilnehmer. Art. 14 Abs. 3 lit. b DSGVO verlangt die Information spätestens dann. Ob der Umfang reicht, klärt ein Anwalt. | 2026-10-26 |
| Der Status zeigt immer den letzten Versuch | Ein Zustand pro Lizenz, einfach zu lesen und zu testen. So legt es auch das Datenmodell fest. | 2026-10-26 |
| Das Ergebnis des Versands steht gleich im Toast nach dem Zuweisen | Ein Fehlschlag soll nicht in der Liste übersehen werden. Der Titel bleibt „Lizenz zugewiesen“ wie in PROJ-2 AC-4. Dafür wartet der Dialog bis zu 10 Sekunden länger. | 2026-10-26 |
| Keine Mail beim Entziehen | Hält das Feature schmal und schafft keinen zweiten Spam-Weg. Mit Abbrechern spricht der Träger selbst. | 2026-10-26 |
| Gleichzeitiges Senden für dieselbe Lizenz: genau eine Mail | Der Teilnehmer soll dieselbe Einladung nicht doppelt bekommen, und nur echte Versendungen zählen zur Grenze. | 2026-10-26 |
| Altbestand: „Noch nicht eingeladen“ mit „Einladung senden“, nichts automatisch | Keine Massenmail, die der Verwalter nicht ausgelöst hat. | 2026-10-26 |
| Keine Zustellverfolgung, keine Öffnungs- oder Klickverfolgung | Zustellmeldungen bräuchten eine öffentliche Adresse der App. Zählpixel und umgeleitete Links wären zusätzliche Daten über den Teilnehmer ohne Einwilligung. | 2026-10-26 |
