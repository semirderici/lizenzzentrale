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
**Zuletzt geprüft:** 2026-10-26 (`/dsgvo PROJ-3`)
**Ergänzt:** 2026-10-21 (`/architecture PROJ-1`: Bot-Prüfdienst, Speicher der Bremsen, Audit-Log; `/dsgvo PROJ-1` kann das nachprüfen)

---

## Verarbeitungen

| Zweck | Daten | Wessen | Rechtsgrundlage | Aufbewahrung | Beteiligte Auftragsverarbeiter |
|-------|-------|--------|-----------------|--------------|-------------------------------|
| Verwalter-Konten führen (PROJ-1) | E-Mail-Adresse, Passwort-Hash, Anmeldezeitpunkte und IP-Adressen (Supabase Auth), Zuordnung zum Bildungsträger, Trägername (nur bei Einzelunternehmern personenbezogen) | Verwalter der Bildungsträger | Art. 6 Abs. 1 lit. b DSGVO (Nutzung der Lizenzzentrale); der Verwalter handelt als Ansprechpartner seines Trägers, ergänzend Art. 6 Abs. 1 lit. f | bis zur Löschung auf Anfrage beim Anbieter | Supabase (eu-central-1) |
| Login vor Raten schützen (PROJ-1) | E-Mail-Adresse (auch ohne Konto), IP-Adresse, Zeitpunkt und Ergebnis von Anmeldeversuchen; Sperren pro Adresse und IP | alle, die sich anmelden wollen | Art. 6 Abs. 1 lit. f DSGVO (Sicherheit, Art. 32) | höchstens 24 Stunden (PROJ-1 AC-13): Ein stündlicher Job löscht alles, was älter als 23 Stunden ist; mit dem Konto sofort | Supabase (eu-central-1), Schema `private`, über die API nicht erreichbar |
| Registrierungen bremsen (PROJ-1) | IP-Adresse, Zeitpunkt und Ergebnis von Registrierungen (keine E-Mail-Adresse) | alle, die sich registrieren | Art. 6 Abs. 1 lit. f DSGVO (Sicherheit, Art. 32) | höchstens 24 Stunden (PROJ-1 AC-13), derselbe Job | Supabase (eu-central-1), Schema `private` |
| Bots abwehren (PROJ-1) | IP-Adresse, Browser-Merkmale | alle Besucher von `/login` und `/register` (das Skript lädt nur dort) | Art. 6 Abs. 1 lit. f DSGVO (Sicherheit) | die App speichert nichts davon; bei Cloudflare laut deren Angaben | Cloudflare Turnstile |
| Lizenzen für Teilnehmer führen (PROJ-2) | E-Mail-Adresse des Teilnehmers, Zeitpunkt der Zuweisung, Zuordnung zum Bildungsträger — kein Name, keine weiteren Angaben (PROJ-2 AC-12) | Teilnehmer der Bildungsträger, eingegeben vom Verwalter ihres Trägers | für den Bildungsträger Art. 6 Abs. 1 lit. b DSGVO (Durchführung des Lehrgangs); die Rolle des Anbieters (Auftragsverarbeiter oder eigener Verantwortlicher) ist offen, siehe „Für einen Anwalt“ | bis der Verwalter die Lizenz entzieht oder der Bildungsträger gelöscht wird, dann sofort und ohne Kopie, Vermerk oder Protokoll (PROJ-2 AC-11) | Supabase (eu-central-1) |
| Teilnehmer einladen (PROJ-3) | E-Mail-Adresse des Teilnehmers (aus der Lizenz, keine Kopie), Trägername im Mailtext, Versandstand der Einladung (Zustand, Zeitpunkt des letzten Versuchs, Zahl der Versendungen); dazu Zähler der Versandgrenze pro Bildungsträger ohne Teilnehmer-Adresse (PROJ-3 AC-12) | Teilnehmer der Bildungsträger | wie bei den Lizenzen: für den Bildungsträger Art. 6 Abs. 1 lit. b DSGVO, die Rolle des Anbieters ist offen (siehe „Für einen Anwalt“); die Einladung ist eine Servicemail ohne Werbung und ohne Verfolgung (PROJ-3 AC-11) | Versandstand bis die Lizenz entzogen oder der Bildungsträger gelöscht wird, dann sofort (PROJ-3 AC-12) · Zähler der Versandgrenze höchstens 24 Stunden · beim E-Mail-Dienst: dessen Frist für das Versandprotokoll, trägt `/architecture` PROJ-3 ein | Supabase (eu-central-1), E-Mail-Dienst (Wahl bei `/architecture` PROJ-3) |

## Sensible Daten

- keine

## Datenschutz-Folgenabschätzung (Art. 35 DSGVO)

- voraussichtlich nicht erforderlich (Stand `/dsgvo PROJ-3`): kein Profiling, keine sensiblen Daten, keine systematische Überwachung, keine neue Technik in großem Umfang

## Auftragsverarbeiter

| Dienst | Was er verarbeitet | Region | AVV abgeschlossen | Außerhalb der angemessenen Länder? |
|--------|--------------------|--------|-------------------|------------------------------------|
| Supabase | Konten, Bildungsträger, Mitgliedschaften, Anmelde- und Registrierungsversuche, Lizenzen (E-Mail-Adressen von Teilnehmern), Versandstände der Einladungen, Zähler der Versandgrenze | eu-central-1 (Frankfurt) | ☐ | US-Firma, Hosting in der EU |
| Cloudflare Turnstile (Bot-Prüfung) | IP-Adresse, Browser-Merkmale der Besucher von Login und Registrierung | globales Netz von Cloudflare, im kostenlosen Tarif keine Beschränkung auf die EU | ☐ — bis zum Live-Gang laufen Cloudflares öffentliche Testschlüssel ohne eigenes Konto; der AVV kommt mit dem eigenen Turnstile-Konto | ja: US-Firma (Cloudflare, Inc.), nach eigener Angabe unter dem EU-U.S. Data Privacy Framework zertifiziert, vor dem Live-Gang prüfen |
| E-Mail-Dienst (Einladungen, PROJ-3) — Wahl bei `/architecture` PROJ-3 | Empfängeradresse und Inhalt der Einladung samt Trägername, im Versandprotokoll des Dienstes | offen — EU bevorzugt (`docs/PRD.md`) | ☐ | offen — wird mit der Wahl des Dienstes festgehalten |

## Betroffenenrechte — wie sie bedient werden

| Recht | DSGVO | Wie das Produkt es erfüllt |
|-------|-------|----------------------------|
| Auskunft / Kopie | Art. 15 | auf Anfrage beim Anbieter, der die Daten aus Supabase zusammenstellt · Teilnehmer: über ihren Bildungsträger, dessen Verwalter die Adresse in der Lizenzübersicht sieht, oder beim Anbieter |
| Berichtigung | Art. 16 | auf Anfrage beim Anbieter, der in Supabase ändert · Teilnehmer: Der Verwalter entzieht die Lizenz und weist die richtige Adresse neu zu |
| Löschung | Art. 17 | auf Anfrage beim Anbieter: Das Löschen des Kontos entfernt Mitgliedschaft und Bildungsträger (PROJ-1 AC-12) und mit dem Träger alle seine Lizenzen · Teilnehmer: Der Verwalter entzieht die Lizenz, die Adresse ist sofort gelöscht (PROJ-2 AC-11) und mit ihr der Versandstand der Einladung (PROJ-3 AC-12), oder der Anbieter löscht sie in Supabase; im Versandprotokoll des E-Mail-Dienstes bleibt die Adresse bis zu dessen Frist |
| Datenübertragbarkeit | Art. 20 | auf Anfrage beim Anbieter, als Export aus Supabase (CSV/JSON) |
| Widerspruch | Art. 21 | auf Anfrage beim Anbieter (betrifft Login-Bremse, Registrierungsbremse und Bot-Prüfung, berechtigtes Interesse) |

> Frist: **ein Kalendermonat** (Art. 12 Abs. 3 DSGVO), um zwei Monate verlängerbar bei komplexen Fällen, wenn die Person im ersten Monat informiert wird.

## Offene Punkte

- [ ] Verantwortlichen (Name, Anschrift) festlegen — vor dem Live-Gang
- [ ] AVV mit Supabase akzeptieren (Organization Settings → Legal Documents), bevor echte personenbezogene Daten verarbeitet werden
- [x] Bot-Prüfdienst gewählt: Cloudflare Turnstile, Region global (`/architecture` PROJ-1, 2026-10-21)
- [ ] AVV mit Cloudflare abschließen, sobald ein eigenes Turnstile-Konto angelegt wird — vor dem Live-Gang
- [x] Aufbewahrung des Supabase-Auth-Audit-Logs: Es wird nicht in die Datenbank geschrieben (Authentication → Audit Logs → „Write audit logs to the database“ aus) und liegt nur in Supabases Log-Speicher, so lange wie der Tarif Logs aufbewahrt (`/architecture` PROJ-1, 2026-10-21)
- [ ] Kontaktweg für Betroffenenanfragen, Datenschutzerklärung und Impressum — beim Live-Gang (`docs/PRD.md` → Später)
- [ ] Information der Teilnehmer (Art. 14 DSGVO): Die Einladung enthält einen kurzen Hinweis, wer die Adresse eingetragen hat, was gespeichert ist, wie lange und an wen man sich wendet (PROJ-3 AC-10, `/write-spec` 2026-10-26). Ob er reicht, klärt der Anwalt (siehe „Für einen Anwalt“)
- [ ] AVV mit dem E-Mail-Dienst abschließen — vor dem Live-Gang; der Dienst wird bei `/architecture` PROJ-3 gewählt

## Für einen Anwalt / Datenschutzbeauftragten

- Die Login- und Registrierungsseite lädt ein Skript eines Bot-Prüfdienstes (Drittanbieter), das IP-Adresse und Browser-Merkmale verarbeitet, um automatisierte Kontoanlagen und Passwort-Raten abzuwehren. Darf es ohne Einwilligung laden, weil es für den sicheren Betrieb unbedingt erforderlich ist (§ 25 Abs. 2 TDDDG)?
- Mit PROJ-2 speichert die Lizenzzentrale E-Mail-Adressen von Teilnehmern, die der Verwalter eines Bildungsträgers eingibt — nur Adresse und Zeitpunkt der Zuweisung, gelöscht beim Entziehen oder mit dem Träger. Der Anbieter betreibt die Lizenzzentrale, der Träger entscheidet, wessen Adresse er eingibt. Verarbeitet der Anbieter diese Adressen im Auftrag des Trägers (Auftragsverarbeitung nach Art. 28, dann AVV mit jedem Träger) oder als eigener Verantwortlicher? Davon hängt ab, wer die Teilnehmer nach Art. 14 informiert. Vor dem Live-Gang klären.
- Mit PROJ-3 bekommt jeder Teilnehmer eine Einladung mit einem kurzen Hinweis: Der Bildungsträger (mit Namen) hat die Adresse eingetragen, gespeichert sind nur Adresse, Zeitpunkt der Zuweisung und Versandstand, bis die Lizenz entzogen wird, Fragen gehen an den Träger. Reicht das für Art. 14 Abs. 3 lit. b, oder braucht die Einladung mehr Angaben (Verantwortlicher, Rechtsgrundlage, Empfänger wie der E-Mail-Dienst, Betroffenenrechte)? Hängt an der Rollenfrage davor.

---

_`/dsgvo` erneut ausführen, sobald ein Feature ändert, welche personenbezogenen Daten das Produkt hält._
