# PROJ-1: Konto & Login

<!-- Diese Datei (spec.md) ist der stabile VERTRAG — sie legt fest WAS, nicht WIE.
     Eigentümer: /write-spec (erstellt), /refine (aktualisiert). Während /build ist diese Datei SCHREIBGESCHÜTZT.
     Das technische Design steht in design.md, die QA-Ergebnisse in qa-report.md.
     Kein Status- oder Datumsfeld hier: Der Status eines Features steht NUR in features/INDEX.md. -->

## Abhängigkeiten
- Keine — erstes Feature.
- Wird gebraucht von: PROJ-2 Lizenzverwaltung (Anmeldung, Bildungsträger, Kontingent, App-Rahmen), mittelbar PROJ-3 Einladungs-E-Mail.

## User Stories
- Als Verwalter eines Bildungsträgers möchte ich meinen Träger mit E-Mail-Adresse und Passwort selbst registrieren, damit ich ohne Umweg über den Anbieter loslegen kann.
- Als Verwalter möchte ich nach der Registrierung sofort ein Startkontingent von 5 Lizenzen haben, damit ich ohne Wartezeit Teilnehmer freischalten kann.
- Als Verwalter möchte ich mich an- und abmelden, damit nur ich an die Lizenzverwaltung meines Trägers komme.
- Als Verwalter möchte ich sicher sein, dass kein anderer Bildungsträger unsere Daten sieht, damit die Daten unserer Teilnehmer geschützt sind.
- Als Verwalter möchte ich, dass niemand mein Passwort durch Ausprobieren erraten kann, damit mein Zugang geschützt bleibt.
- Als Anbieter möchte ich, dass das Kontingent nur von mir geändert werden kann, damit kein Träger mehr Lizenzen vergibt, als er gekauft hat.
- Als Anbieter möchte ich ein Konto auf Anfrage vollständig löschen können, ohne dass Reste bleiben, damit ich Löschwünsche erfüllen kann.

## Out of Scope
- Bestätigungsmail bei der Registrierung — beim Live-Gang (`docs/PRD.md` → Später)
- „Passwort vergessen“ / Passwort zurücksetzen — beim Live-Gang (`docs/PRD.md` → Später)
- Passwort, E-Mail-Adresse oder Trägername in der App ändern — auf Anfrage beim Anbieter
- Konto in der App löschen — auf Anfrage beim Anbieter (siehe AC-12)
- Mehrere Verwalter pro Bildungsträger, weitere Verwalter einladen — Nicht-Ziel des MVP
- Rollen über „Verwalter“ hinaus
- Anmeldung über Google/Microsoft, Magic Link, Zwei-Faktor-Anmeldung
- Automatische Abmeldung nach Inaktivität
- Prüfung gegen bekannte geleakte Passwörter (bei Supabase nur im Bezahltarif)
- Name des Verwalters (Vor-/Nachname) — wird nicht erfasst
- Kontingent anzeigen, Lizenzen zuweisen und entziehen — PROJ-2
- Einladungs-E-Mails an Teilnehmer — PROJ-3
- Verwaltungsoberfläche für den Anbieter (Kontingent ändern, Träger sperren)
- Impressum und Datenschutzerklärung — beim Live-Gang
- Theme-Schalter, Mehrsprachigkeit

## Akzeptanzkriterien

- [ ] **AC-1** — Angenommen ein Besucher ist abgemeldet und hat Name des Bildungsträgers, E-Mail-Adresse, Passwort und Passwort-Wiederholung gültig ausgefüllt, wenn er die Bot-Prüfung besteht und auf „Registrieren“ klickt, dann sind sein Konto, sein Bildungsträger mit einem Kontingent von genau 5 Lizenzen (unabhängig davon, was die Anfrage mitschickt) und seine Mitgliedschaft als Verwalter angelegt, er ist ohne Bestätigungsmail sofort angemeldet und landet in der Lizenzübersicht.
- [ ] **AC-2** — Angenommen der Besucher füllt das Registrierungsformular unvollständig oder ungültig aus (Trägername nach Entfernen der Leerzeichen am Rand leer, kürzer als 2 oder länger als 100 Zeichen; E-Mail-Adresse ungültig; Passwort kürzer als 8 oder länger als 72 Zeichen; Wiederholung weicht ab), wenn er abschickt, dann wird nichts angelegt, an jedem betroffenen Feld steht eine verständliche Meldung, Trägername und E-Mail-Adresse bleiben ausgefüllt; die Passwortregel („mindestens 8 Zeichen“) steht schon vor der Eingabe unter dem Feld, und dieselben Regeln gelten auch für Anfragen, die das Formular umgehen.
- [ ] **AC-3** — Angenommen es gibt bereits ein Konto mit einer E-Mail-Adresse, wenn sich jemand mit derselben Adresse registriert (Groß-/Kleinschreibung egal), dann entsteht weder ein Konto noch ein Bildungsträger, und er sieht „Mit dieser E-Mail-Adresse ist bereits ein Konto registriert. Bitte melden Sie sich an.“ mit einem Link zum Login.
- [ ] **AC-4** — Angenommen ein registrierter Verwalter ist abgemeldet, wenn er E-Mail-Adresse und Passwort richtig eingibt, die Bot-Prüfung besteht und auf „Anmelden“ klickt, dann ist er angemeldet und landet in der Lizenzübersicht: Die Kopfzeile zeigt „Lizenzzentrale“, den Namen seines Bildungsträgers und „Abmelden“, der Inhalt den Titel „Lizenzübersicht“ und einen Platzhaltersatz, bis PROJ-2 die Seite füllt.
- [ ] **AC-5** — Angenommen ein Login-Versuch schlägt fehl, wenn die Fehlermeldung erscheint, dann lautet sie für eine unbekannte E-Mail-Adresse und für ein falsches Passwort gleich („E-Mail-Adresse oder Passwort ist falsch.“) und verrät nicht, ob die Adresse registriert ist.
- [ ] **AC-6** — Angenommen es gab innerhalb von 15 Minuten 5 fehlgeschlagene Login-Versuche für dieselbe E-Mail-Adresse (egal ob sie registriert ist) oder 20 fehlgeschlagene Versuche von derselben IP-Adresse, wenn ein weiterer Versuch erfolgt, dann wird er für die folgenden 15 Minuten abgelehnt — auch mit richtigem Passwort —, der Nutzer sieht „Zu viele Anmeldeversuche. Bitte versuchen Sie es in X Minuten erneut.“ mit der verbleibenden Wartezeit, und danach ist die Anmeldung wieder möglich.
- [ ] **AC-7** — Angenommen ein automatisiertes Skript ruft die Registrierung oder den Login auf, wenn es abschickt, ohne die Bot-Prüfung bestanden zu haben, dann wird die Anfrage abgelehnt, und es entsteht weder ein Konto noch eine Sitzung.
- [ ] **AC-8** — Angenommen von derselben IP-Adresse wurden innerhalb der letzten Stunde bereits 5 Bildungsträger registriert, wenn von dort eine weitere Registrierung abgeschickt wird, dann wird sie abgelehnt, es entsteht nichts, und der Besucher sieht „Zu viele Registrierungen. Bitte versuchen Sie es später erneut.“
- [ ] **AC-9** — Angenommen ein Besucher ist abgemeldet, wenn er `/` oder `/licenses` aufruft, dann landet er beim Login und sieht keine geschützten Inhalte, auch nicht kurz; ist er angemeldet, führen `/`, `/login` und `/register` zur Lizenzübersicht.
- [ ] **AC-10** — Angenommen ein Verwalter ist angemeldet, wenn er den Browser schließt und die Lizenzzentrale später wieder öffnet, dann ist er weiterhin angemeldet; klickt er auf „Abmelden“, ist die Sitzung beendet, er landet beim Login, und weder über „Zurück“ im Browser noch über die direkte Adresse `/licenses` sieht er danach geschützte Inhalte.
- [ ] **AC-11** — Angenommen es gibt zwei Bildungsträger A und B, wenn der Verwalter von A Daten liest oder schreibt — über die Oberfläche oder direkt über die Datenbank-Schnittstelle mit seiner eigenen Anmeldung —, dann sieht er nur Bildungsträger und Mitgliedschaft von A und nie eine Zeile von B, und jeder Versuch, Kontingent oder Trägername zu ändern, eine Mitgliedschaft zu ändern, sich einem anderen Bildungsträger zuzuordnen oder einen weiteren Bildungsträger anzulegen, wird abgelehnt; ein abgemeldeter Besucher bekommt gar keine Zeilen.
- [ ] **AC-12** — Angenommen ein Verwalter hat beim Anbieter die Löschung verlangt, wenn der Anbieter sein Konto in Supabase löscht, dann sind auch seine Mitgliedschaft und — weil er der einzige Verwalter ist — sein Bildungsträger gelöscht, und keine Zeile verweist mehr auf ihn oder seinen Träger. (Art. 17 DSGVO)
- [ ] **AC-13** — Angenommen die Login-Bremse hat Daten zu einem Anmeldeversuch gespeichert (E-Mail-Adresse, IP-Adresse, Zeitpunkt), wenn seit dem Versuch 24 Stunden vergangen sind, dann sind diese Daten gelöscht. (Art. 5 Abs. 1 lit. e DSGVO)

## Edge Cases

> Zeitkritische Muster geprüft: Eine knappe Ressource (Kontingent) wird erst in PROJ-2 verbraucht — dort ist „letzte Lizenz gleichzeitig“ Pflicht. Keine Statusfolge, kein Auslöser von außen (keine Bestätigungsmail).

- [ ] **EC-1** — Angenommen ein Besucher klickt mehrfach schnell auf „Registrieren“ oder die Anfrage wird wiederholt, wenn die Anfragen verarbeitet werden, dann entstehen genau ein Konto, ein Bildungsträger und eine Mitgliedschaft, und der Knopf ist während des Absendens gesperrt.
- [ ] **EC-2** — Angenommen zwei Besucher registrieren sich gleichzeitig mit derselben E-Mail-Adresse, wenn beide abschicken, dann gelingt genau eine Registrierung, und der andere sieht die Meldung aus AC-3.
- [ ] **EC-3** — Angenommen bei der Registrierung tritt mittendrin ein Fehler auf (Netzwerk, Server), wenn der Vorgang abbricht, dann ist entweder alles angelegt (Konto, Bildungsträger, Mitgliedschaft) oder nichts — nie ein Konto ohne Bildungsträger —, der Besucher sieht „Die Registrierung ist fehlgeschlagen. Bitte versuchen Sie es erneut.“, und Trägername und E-Mail-Adresse bleiben ausgefüllt.
- [ ] **EC-4** — Angenommen ein Besucher gibt die E-Mail-Adresse mit Großbuchstaben oder Leerzeichen am Rand ein, wenn er sich registriert oder anmeldet, dann wird sie als dieselbe Adresse behandelt wie klein geschrieben ohne Leerzeichen, auch beim Zählen der Fehlversuche; Passwörter werden dagegen nie verändert oder gekürzt.
- [ ] **EC-5** — Angenommen ein Konto gehört keinem Bildungsträger mehr an (z. B. weil der Anbieter nur den Träger gelöscht hat), wenn sich der Verwalter anmeldet, dann sieht er „Ihr Konto ist keinem Bildungsträger zugeordnet. Bitte wenden Sie sich an den Anbieter.“, keine Daten, und kann sich abmelden.
- [ ] **EC-6** — Angenommen ein Verwalter ist in zwei Tabs angemeldet und meldet sich in einem ab, wenn er im anderen Tab neu lädt oder eine Aktion auslöst, dann landet er beim Login mit dem Hinweis „Bitte melden Sie sich erneut an.“ — ohne Fehlerseite und ohne dass geschützte Inhalte geladen werden.
- [ ] **EC-7** — Angenommen ein Verwalter hatte Fehlversuche, aber noch keine Sperre ausgelöst, wenn er sich danach erfolgreich anmeldet, dann beginnt der Zähler für seine Adresse wieder bei null.
- [ ] **EC-8** — Angenommen die Bot-Prüfung lässt sich nicht laden (Dienst nicht erreichbar, Werbeblocker), wenn der Besucher das Formular abschicken will, dann ist das nicht möglich, er sieht „Die Sicherheitsprüfung konnte nicht geladen werden. Bitte laden Sie die Seite neu.“, und eine Anfrage ohne Prüfung wird nie durchgelassen.
- [ ] **EC-9** — Angenommen die Verbindung bricht beim Anmelden oder Registrieren ab, wenn keine Antwort kommt, dann sieht der Nutzer „Keine Verbindung. Bitte versuchen Sie es erneut.“, und die E-Mail-Adresse bleibt ausgefüllt.
- [ ] **EC-10** — Angenommen ein Trägername ist sehr lang oder enthält Sonderzeichen oder HTML, wenn er in der Kopfzeile erscheint, dann wird er als reiner Text angezeigt, auf schmalen Bildschirmen gekürzt, und „Abmelden“ bleibt immer sichtbar.

## Technische Anforderungen
- **Sicherheit:** Jede Regel dieser Spec (Validierung, beide Bremsen, Bot-Prüfung, Datentrennung, Schreibschutz für Kontingent und Mitgliedschaft) gilt auf dem Server bzw. in der Datenbank, nicht nur in der Oberfläche. Die Datentrennung wird zweifach durchgesetzt: in der Anwendung und in der Datenbank (Row Level Security).
- Rechte kommen aus der Mitgliedschaft, nie aus Daten, die der Nutzer mitschickt, und nie aus dem Anmelde-Token (`docs/data-model.md`).
- Anmelde- und Registrierungsformular senden per POST; Zugangsdaten stehen nie in einer URL.
- Die Antwortzeit beim Login ist für unbekannte und bekannte Adressen vergleichbar (ergänzt AC-5).
- Geheime Schlüssel (z. B. der Server-Schlüssel der Bot-Prüfung) erreichen nie den Browser; jede neue Variable bekommt einen Platzhalter in `.env.local.example`.
- **Bot-Prüfung:** Dienst wählt `/architecture` — Kriterien: kostenlos, ohne Kreditkarte, mit offiziellen Testschlüsseln (der Prüfer braucht kein eigenes Konto), EU-Verarbeitung bevorzugt. Er wird in `docs/privacy.md` als Auftragsverarbeiter geführt.
- **Datenhaltung:** Supabase eu-central-1 (Frankfurt). Tabellen- und Spaltennamen englisch und kompatibel zur Plattform (`docs/data-model.md`); kein eigenes `profiles`.
- **Vorgabe für PROJ-2 und PROJ-3:** Alles, was einem Bildungsträger gehört (Lizenzen, Einladungen), wird mit ihm gelöscht — erst damit ist AC-12 vollständig.
- **App-Rahmen:** PROJ-1 baut Kopfzeile, Abmelden und Weiterleitungen laut `docs/app-shell.md`; Gestaltung laut `docs/design-system.md` (Fehler als Text, nicht nur Farbe; sichtbarer Fokus; Tippflächen ≥ 44 × 44 px).
- **Browser:** aktuelle Chrome, Firefox, Safari, Edge; nutzbar ab Smartphone-Breite.

## Offene Fragen
- [ ] Verantwortlicher (Name, Anschrift) für `docs/privacy.md` — vor dem Live-Gang festlegen.
- [ ] Über welchen Kontaktweg verlangen Verwalter Auskunft, Änderung oder Löschung beim Anbieter? Kommt mit Datenschutzerklärung und Impressum beim Live-Gang.
- [ ] Für einen Anwalt: Darf die Bot-Prüfung (Skript eines Drittanbieters) ohne Einwilligung laden, weil sie für die Sicherheit unbedingt erforderlich ist (§ 25 Abs. 2 TDDDG)? Vor dem Live-Gang klären.

## Decision Log

### Produktentscheidungen
| Entscheidung | Begründung | Datum |
|---|---|---|
| Keine Bestätigungsmail, Konto sofort aktiv | Supabase-Standardversand nur 2 Mails/Std. und nur an Team-Adressen; kein Deployment; der Prüfer soll ohne Mail-Einrichtung durchkommen. Bestätigung kommt mit dem Live-Gang. | 2026-10-21 |
| Klarer Hinweis bei bereits registrierter Adresse | Ohne Bestätigungsmail lässt sich bei der Registrierung kaum verbergen, dass eine Adresse existiert. Bewusst in Kauf genommen, abgefedert durch Bot-Prüfung und Registrierungsbremse; der Login bleibt neutral. Neu bewerten mit der Bestätigungsmail. | 2026-10-21 |
| Felder: Trägername, E-Mail, Passwort, Passwort-Wiederholung | Ohne „Passwort vergessen“ wäre ein vertipptes Passwort ein verlorenes Konto. Kein Name des Verwalters (Datensparsamkeit). | 2026-10-21 |
| Passwort 8–72 Zeichen, ohne Zeichenzwang | Heutige Empfehlung: Länge statt Zeichenklassen. 72 ist die Obergrenze, die das Anmeldesystem verarbeitet. Prüfung gegen geleakte Passwörter nur im Bezahltarif. | 2026-10-21 |
| Login-Bremse: 5 Fehlversuche pro Adresse oder 20 pro IP in 15 Min. → 15 Min. Sperre | Reicht für Vertipper, macht Raten unattraktiv. Unbekannte Adressen zählen mit, damit die Sperre keine Adressen verrät; die Sperre gilt auch für das richtige Passwort, sonst wäre sie wirkungslos. | 2026-10-21 |
| Bot-Prüfung bei Registrierung und Login, max. 5 Registrierungen pro IP und Stunde | Sicherheitsregel des Projekts (CAPTCHA auf öffentlichen Formularen); 5/Std. reichen für Prüfer und QA mit mehreren Testkonten. Lädt die Prüfung nicht, geht nichts durch. | 2026-10-21 |
| Sitzung bis zum Abmelden | Bei Verwaltungstools üblich; Zeitlimits sind bei Supabase erst ab dem Pro-Tarif eingebaut. | 2026-10-21 |
| Lizenzübersicht in PROJ-1 nur Rahmen + Platzhalter | Klare Grenze zu PROJ-2, das die Seite füllt, ohne PROJ-1 umzubauen. Das Startkontingent prüft `/qa` in der Datenbank. | 2026-10-21 |
| Trägername nicht eindeutig | Sonst ließe sich ausspähen, welche Institute Kunden sind, und ein Trittbrettfahrer könnte den Namen eines echten Instituts blockieren. | 2026-10-21 |
| Anmeldeversuche höchstens 24 Stunden aufbewahren | Deutlich länger als das 15-Minuten-Fenster der Bremse, damit sie zuverlässig zählt, aber kurz genug für Datensparsamkeit (Art. 5 Abs. 1 lit. e DSGVO). | 2026-10-21 |
| Löschen und Ändern nur auf Anfrage beim Anbieter | Passt zu Haltung „lean“ und zum PRD (Anbieter verwaltet in Supabase); kein riskanter Löschknopf, der auch alle Teilnehmer-Lizenzen entfernt. | 2026-10-21 |
