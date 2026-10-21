# Produktbeschreibung (PRD)

## Vision
Die Lizenzzentrale ist ein Self-Service-Portal für Bildungsträger, die Lizenzkontingente für die E-Learning-Plattform zur IHK-Weiterbildung „Geprüfter Technischer Betriebswirt“ gekauft haben. Ein Verwalter des Trägers sieht dort jederzeit, wie viele Lizenzen vergeben und frei sind. Er weist Teilnehmern selbst eine Lizenz zu oder entzieht sie wieder, ohne Umweg über den Anbieter. Jeder Teilnehmer wird dabei automatisch per E-Mail eingeladen.

## Zielgruppe
- **Verwalter beim Bildungsträger** (z. B. Lehrgangsleitung oder Verwaltung eines Weiterbildungsinstituts):
  - Er will auf einen Blick sehen, wie viel vom gekauften Kontingent noch frei ist.
  - Er will neue Teilnehmer schnell freischalten und Abbrecher wieder herausnehmen, ohne dafür E-Mails mit dem Anbieter auszutauschen.
  - Er will nicht versehentlich mehr Lizenzen vergeben, als gekauft wurden.
- **Teilnehmer** (indirekt): Sie melden sich in der Lizenzzentrale nicht an. Sie bekommen nur die Einladungs-E-Mail.
- **Anbieter** (Betreiber der Plattform): Er hat keine eigene Oberfläche. Kontingente ändert er bei Bedarf direkt in der Supabase-Tabellenansicht.

## Kernfunktionen (Roadmap)
Das MVP besteht aus drei Features:
- **Registrierung und Login:** mit geschütztem Bereich und Datentrennung pro Bildungsträger
- **Einladungs-E-Mail:** Versand über einen externen Dienst
- **Lizenzverwaltung:** Kontingent sehen, Lizenzen zuweisen und entziehen

Jeder neue Bildungsträger startet mit einem Kontingent von 5 Lizenzen. Die Feature-Übersicht steht in `features/INDEX.md`.

### Später (nicht in diesem MVP)
- **Kopplung an ein Lernkonto:** Eine Lizenz wird an ein Lernkonto der Plattform gekoppelt statt nur an eine E-Mail-Adresse.
- **Verwaltung für den Anbieter:** Kontingente setzen und Bildungsträger sperren in einer eigenen Oberfläche.
- **Regel gegen die Weitergabe von Lizenzen:** Eine Lizenz, die ein Teilnehmer schon genutzt hat, fällt nicht mehr ins Kontingent zurück. Alternativ gelten Lizenzen zeitlich begrenzt. Dafür braucht es ein **Protokoll**, wer wann welche Lizenz bekommen und verloren hat. Bis dahin gilt: Entziehen löscht die Lizenz, und sie ist sofort wieder frei.
- **Sobald die App live geht:** Impressum, Datenschutzerklärung und „Passwort vergessen“.

## Erfolgskriterien
- **Prüfung bestanden:** Alle drei Features stehen auf „Approved“.
- **Nachvollziehbar für den Prüfer:** Er kann das Repository klonen, eigene Schlüssel eintragen und das Schema einspielen. Danach spielt er den Kernablauf in etwa 30 Minuten durch: registrieren, zuweisen, Mail kommt an, entziehen, Kontingent voll.
- **Datentrennung nachweisbar:** Ein zweiter Bildungsträger sieht keine Lizenzen oder Teilnehmer des ersten. Das prüft `/qa` gegen die Datenbank.
- **Keine Schlüssel im Repository:** auch nicht in der Git-Historie.
- **Übernehmbar:** Die Tabellen lassen sich ohne Umbau in die Datenbank der E-Learning-Plattform übertragen.

## Rahmenbedingungen
- **Abschlussprüfung:** AI Engineering Accelerator, genau drei Features, jedes mit etwa 8 bis 12 Akzeptanzkriterien und jedes durch den kompletten Workflow bis „Approved“.
- **Team:** eine Person mit KI-Agent, Budget 0 €. Alle Dienste laufen im kostenlosen Tarif.
- **Technik:** Next.js 16, Supabase in der Cloud (Free Plan), kein Docker.
- Environment strategy: single — ein gehostetes Supabase-Projekt, gegen das direkt entwickelt wird. Es gibt keine getrennten Live-Daten, weil nicht deployt wird.
- Data region: eu-central-1 (Frankfurt) — die Region lässt sich nicht nachträglich ändern.
- **Kein Deployment:** Die App läuft lokal (`npm run dev`).
- **Öffentliches GitHub-Repository:**
  - Echte Schlüssel stehen nur in `.env.local`, die nie eingecheckt wird.
  - Jede Variable ist mit einem Platzhalter in `.env.local.example` dokumentiert.
  - Geheime Server-Schlüssel erreichen nie den Browser.
- **Reproduzierbar:**
  - Das gesamte Datenbankschema liegt als Migrationsdateien im Repository.
  - Die README beschreibt, wie man ein eigenes Supabase-Projekt und einen eigenen Schlüssel für den E-Mail-Dienst anlegt.
- **E-Mail-Dienst:** Die Auswahl fällt bei `/architecture` des E-Mail-Features. Die Kriterien:
  - kostenloser Tarif
  - Schlüssel selbst erzeugbar, ohne Kreditkarte
  - Versand an beliebige Empfänger möglichst ohne eigene Domain
  - Verarbeitung in der EU bevorzugt
- **Bestätigungsmail bei der Registrierung:** Supabase verschickt im Free Plan selbst nur sehr wenige Mails. Wie die Registrierungs-Bestätigung gelöst wird, klärt die Spezifikation des Login-Features.
- **Kompatibel zur Plattform:**
  - Tabellen- und Spaltennamen sind englisch und folgen denselben Konventionen.
  - Eine Lizenz hängt heute an der E-Mail-Adresse des Teilnehmers und ist so angelegt, dass sie später an ein Lernkonto gekoppelt werden kann.
- **Kontingent:**
  - Bei der Registrierung bekommt jeder Bildungsträger automatisch 5 Lizenzen.
  - Änderungen macht der Anbieter direkt in Supabase, eine Oberfläche dafür gibt es nicht.
- Data protection law: GDPR (EU/DE)
- Data protection stance: lean
- **Qualitätsstufe:** standard, alle Prüfschritte vollständig.
- Design system: see `docs/design-system.md` — Übergangsdesign aus der Plattform, rein über Tokens.

## Nicht-Ziele
- mehrere Verwalter pro Bildungsträger
- Bezahlung, Rechnungen, Kauf von Kontingenten in der App
- Lernfortschritt oder Lerninhalte
- Anmeldung der Teilnehmer in der Lizenzzentrale
- Kopplung an ein Lernkonto der Plattform
- Verwaltungsoberfläche für den Anbieter (Kontingente setzen, Träger sperren)
- Deployment und Live-Betrieb
- Theme-Schalter und Mehrsprachigkeit: Die Oberfläche ist nur auf Deutsch.
