# Datenschutz-Übersicht — was dieses Produkt mit personenbezogenen Daten tut

> Die ehrliche Übersicht, welche personenbezogenen Daten dieses Produkt verarbeitet, warum und wie lange.
>
> - Erstellt und aktuell gehalten von `/dsgvo`, ein Eintrag pro Verarbeitungszweck.
> - Wächst mit dem Produkt: Ändert ein Feature, was gespeichert wird, ändert sich auch sein Eintrag.
> - **Ebene:** Zwecke, Rechtsgrundlagen, Aufbewahrung und wer die Daten sonst sieht. Details auf Feldebene stehen in `docs/data-model.md` und den Feature-Designs.
>
> Das entspricht weitgehend dem Verzeichnis von Verarbeitungstätigkeiten (*Verarbeitungsverzeichnis*, Art. 30 DSGVO) — ist aber ein technisches Dokument, keine rechtliche Erklärung. Ob es für den konkreten Fall vollständig ist, entscheidet ein Anwalt oder Datenschutzbeauftragter.

**Anwendbares Recht:** DSGVO (EU/DE) — Regeln in `docs/law/gdpr.md`
**Datenschutz-Haltung:** lean (`docs/PRD.md` → Rahmenbedingungen)
**Verantwortlicher:** _offen — wird vor dem Live-Gang festgelegt (siehe Offene Punkte)_
**Zuletzt geprüft:** 2026-10-21 (`/dsgvo PROJ-1`)

---

## Verarbeitungen

| Zweck | Daten | Wessen | Rechtsgrundlage | Aufbewahrung | Beteiligte Auftragsverarbeiter |
|-------|-------|--------|-----------------|--------------|-------------------------------|
| Verwalter-Konten führen (PROJ-1) | E-Mail-Adresse, Passwort-Hash, Anmeldezeitpunkte und IP-Adressen (Supabase Auth), Zuordnung zum Bildungsträger, Trägername (nur bei Einzelunternehmern personenbezogen) | Verwalter der Bildungsträger | Art. 6 Abs. 1 lit. b DSGVO (Nutzung der Lizenzzentrale); der Verwalter handelt als Ansprechpartner seines Trägers, ergänzend Art. 6 Abs. 1 lit. f | bis zur Löschung auf Anfrage beim Anbieter | Supabase (eu-central-1) |
| Login vor Raten schützen (PROJ-1) | E-Mail-Adresse, IP-Adresse, Zeitpunkt fehlgeschlagener Anmeldeversuche | alle, die sich anmelden wollen | Art. 6 Abs. 1 lit. f DSGVO (Sicherheit, Art. 32) | höchstens 24 Stunden (PROJ-1 AC-13) | Supabase oder der Speicher, den `/architecture` wählt |
| Bots abwehren (PROJ-1) | IP-Adresse, Browser-Merkmale | alle Besucher von Login und Registrierung | Art. 6 Abs. 1 lit. f DSGVO (Sicherheit) | laut Angaben des Dienstes | Bot-Prüfdienst — wird bei `/architecture` gewählt |

## Sensible Daten

- keine

## Auftragsverarbeiter

| Dienst | Was er verarbeitet | Region | AVV abgeschlossen | Außerhalb der angemessenen Länder? |
|--------|--------------------|--------|-------------------|------------------------------------|
| Supabase | Konten, Bildungsträger, Mitgliedschaften, Anmeldeversuche | eu-central-1 (Frankfurt) | ☐ | US-Firma, Hosting in der EU |
| Bot-Prüfdienst | IP-Adresse, Browser-Merkmale der Besucher von Login und Registrierung | nicht bestimmt — Dienst noch nicht gewählt | ☐ | nicht bestimmt |

## Betroffenenrechte — wie sie bedient werden

| Recht | DSGVO | Wie das Produkt es erfüllt |
|-------|-------|----------------------------|
| Auskunft / Kopie | Art. 15 | auf Anfrage beim Anbieter, der die Daten aus Supabase zusammenstellt |
| Berichtigung | Art. 16 | auf Anfrage beim Anbieter, der in Supabase ändert |
| Löschung | Art. 17 | auf Anfrage beim Anbieter: Das Löschen des Kontos entfernt Mitgliedschaft und Bildungsträger (PROJ-1 AC-12) |
| Datenübertragbarkeit | Art. 20 | auf Anfrage beim Anbieter, als Export aus Supabase (CSV/JSON) |
| Widerspruch | Art. 21 | auf Anfrage beim Anbieter (betrifft Login-Bremse und Bot-Prüfung, berechtigtes Interesse) |

> Frist: **ein Kalendermonat** (Art. 12 Abs. 3 DSGVO), um zwei Monate verlängerbar bei komplexen Fällen, wenn die Person im ersten Monat informiert wird.

## Offene Punkte

- [ ] Verantwortlichen (Name, Anschrift) festlegen — vor dem Live-Gang
- [ ] AVV mit Supabase akzeptieren (Organization Settings → Legal Documents), bevor echte personenbezogene Daten verarbeitet werden
- [ ] Bot-Prüfdienst wählen (`/architecture` PROJ-1), Region bestimmen und AVV abschließen
- [ ] Aufbewahrung des Supabase-Auth-Audit-Logs (enthält IP-Adressen) — nicht bestimmt
- [ ] Kontaktweg für Betroffenenanfragen, Datenschutzerklärung und Impressum — beim Live-Gang (`docs/PRD.md` → Später)

## Für einen Anwalt / Datenschutzbeauftragten

- Die Login- und Registrierungsseite lädt ein Skript eines Bot-Prüfdienstes (Drittanbieter), das IP-Adresse und Browser-Merkmale verarbeitet, um automatisierte Kontoanlagen und Passwort-Raten abzuwehren. Darf es ohne Einwilligung laden, weil es für den sicheren Betrieb unbedingt erforderlich ist (§ 25 Abs. 2 TDDDG)?
- Mit PROJ-2 speichert die Lizenzzentrale E-Mail-Adressen von Teilnehmern, die ein Bildungsträger eingibt. Verarbeitet der Anbieter diese Adressen im Auftrag des Trägers (Auftragsverarbeitung, dann AVV mit jedem Träger) oder als eigener Verantwortlicher? Klären, sobald PROJ-2 spezifiziert ist.

---

_`/dsgvo` erneut ausführen, sobald ein Feature ändert, welche personenbezogenen Daten das Produkt hält._
