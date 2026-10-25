# PROJ-1 Aufgaben: Konto & Login

> Erstellt von `/tasks` aus `spec.md` und `design.md`. Das ist der geordnete, nachvollziehbare Bauplan, die Brücke zwischen dem Vertrag (WAS) und dem Bauen (WIE).
> `[P]` = parallel ausführbar: Die Dateien der Aufgabe überschneiden sich mit keiner anderen `[P]`-Aufgabe derselben Stufe. `/build` kann sie deshalb einem eigenen Subagenten geben.
> Die Stufen laufen **nacheinander**, jede ist eine Schranke. Aufgaben **innerhalb** einer Stufe laufen parallel, wo `[P]` steht. Jede Aufgabe nennt die AC-IDs aus `spec.md`, die sie erfüllt. Das ist die Kette AC → Task → Test.
> `[user]` = eine Einstellung, die nur der Nutzer machen kann, im Dashboard eines Anbieters oder in seiner eigenen Umgebungsdatei. Sie hat `where:` statt `files:`, ist nie `[P]` und wird vom Nutzer abgehakt. `/build` übergibt sie, `/deploy` liefert nicht aus, solange eine offen ist.
> `[user go-live]` = dasselbe, braucht aber die Produktions-URL oder den Host. Vor `/deploy` kann sie niemand machen, deshalb blockiert sie weder `/qa` noch „Approved“. `/deploy` macht sie in Schritt 2 und hakt sie in Schritt 4 ab, sobald sie nachweislich wirkt.
> Zuständig: `/tasks` legt diese Datei an, `/build` hakt die Kästchen ab. Ausnahme sind die `[user]`-Aufgaben, die hakt der Nutzer ab.
> Kein Statusfeld: Die abgehakten Kästchen unten sind der Fortschritt dieser Datei. Der Status des Features steht NUR in `features/INDEX.md`.

## Stufe 1 — Datenbank

<!-- Fundament: Migrationen, Zugriffsregeln, Trigger, Bremsen. Läuft zuerst, weil alles andere auf dem Datenvertrag aufbaut.
     Bewusst OHNE [P]: T5–T7 schreiben zwar verschiedene Dateien, spielen ihre Migration aber per `supabase db push` in dieselbe gehostete Datenbank (Strategie `single`), und die Reihenfolge der Migrationen zählt. T6 nutzt das Testgerüst aus T5, T7 die Tabellen aus T6. Aus getrennten Arbeitskopien würden sich Pushes und Migrationshistorie gegenseitig stören. -->

- [x] T1 [user]  Supabase-CLI mit dem gehosteten Projekt verbinden  · where: Terminal → `supabase login`, dann `supabase link --project-ref <ref>` (fragt nach dem Datenbank-Passwort)  · → AC-1 … AC-13 (Voraussetzung für `supabase db push`)
- [x] T2 [user]  Server-Schlüssel eintragen  · where: `.env.local` → `SUPABASE_SERVICE_ROLE_KEY` = Supabase → Project Settings → API Keys → Secret key (`sb_secret_…`) oder der ältere `service_role`-Schlüssel. Nur für den Server, nie mit `NEXT_PUBLIC_`.  · → AC-1, AC-4, AC-6, AC-8
- [x] T3 [user]  Platzhalter der neuen Variablen dokumentieren  · where: `.env.local.example` (der Agent darf die Datei nicht bearbeiten) → `SUPABASE_SERVICE_ROLE_KEY=your-supabase-secret-key`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA`, `TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA`  · → AC-1, AC-4, AC-7
- [x] T4 [user]  Audit-Log nicht in die Datenbank schreiben  · where: Supabase → Authentication → Audit Logs → „Write audit logs to the database“ → **aus**  · → AC-12, AC-13
- [x] T5  Migration Bildungsträger & Mitgliedschaft, Testgerüst und Datenbanktests  · files: supabase/migrations/20261021120000_proj1_training_providers.sql, vitest.config.mts, src/test/supabase.ts, src/test/db/training-providers.test.ts  · → AC-1, AC-11, AC-12, EC-3, EC-5
  - Migration: legt das Schema `private` an (über die Daten-API nicht erreichbar), weil die Trigger-Funktionen dort liegen. T6 nutzt es mit. Dazu `public.training_providers` (Kontingent Standard 5, mindestens 0; Name ohne Rand-Leerzeichen, 2 bis 100 Zeichen) und `public.training_provider_members` (`user_id` eindeutig, Rolle `admin`, Löschkaskaden zu Träger und Konto). RLS mit Leseregeln, alle Rechte für `anon` und `authenticated` entzogen und nur das Lesen zurückgegeben. Trigger `license_center_on_auth_user_created` (`private.license_center_handle_new_user`, übernimmt nur den Namen) und „letzter Verwalter weg“ (`private.delete_orphaned_training_provider`). Details: design.md → Datenmodell, Zugriffsregeln in der Datenbank, Trigger.
  - Testgerüst: `vitest.config.mts` lädt die Variablen aus `.env.local` für die Tests und macht `server-only` in Tests importierbar. `src/test/supabase.ts` legt Testkonten über den Admin-Client an und meldet sie auch über ihn an, weil das Supabase-CAPTCHA aus T18 den öffentlichen Schlüssel sperrt. Es liefert einen Client mit dem Zugriffstoken des Kontos und räumt danach alles weg. Datenbanktests laufen in der Umgebung `node`.
  - Tests:
    - Das Kontingent ist 5, auch wenn die Registrierungsdaten ein anderes mitschicken.
    - Ein ungültiger Name legt nichts an.
    - A sieht nur eigene Zeilen, jeder Schreibversuch scheitert, ein abgemeldeter Besucher bekommt keine Zeilen.
    - Wird das Konto gelöscht, sind Mitgliedschaft und Träger weg.
    - Wird nur der Träger gelöscht, bleibt das Konto, und der Trigger verträgt das.
- [x] T6  Migration Login- und Registrierungsbremse mit Datenbanktests  · files: supabase/migrations/20261021120100_proj1_login_throttle.sql, src/test/db/throttle.test.ts  · → AC-6, AC-8, AC-12, EC-2, EC-4, EC-7
  - Migration: die drei Tabellen in `private` (RLS an, keine Regeln) mit ihren Indizes. Die fünf Funktionen `license_center_begin_login`, `license_center_finish_login`, `license_center_begin_registration`, `license_center_finish_registration` und `license_center_email_registered`: security definer, leerer Suchpfad, aufrufbar nur von `service_role`. Dazu der Trigger `license_center_on_auth_user_deleted` (`private.license_center_forget_deleted_account`). Details: design.md → Login-Bremse im Detail, Registrierungsbremse.
  - Tests über den Admin-Client:
    - 5 Fehlversuche pro Adresse oder 20 pro IP sperren für 15 Minuten, auch für unbekannte Adressen.
    - Adressen werden normalisiert.
    - Ein Erfolg setzt „Zählen ab“ zurück.
    - Parallele Versuche rutschen nicht durch.
    - Die Registrierungsbremse zählt `pending`, `success` und `duplicate`, aber nicht `error`.
    - `anon` und `authenticated` dürfen keine der Funktionen aufrufen.
    - Wird das Konto gelöscht, ist auch die Kontosperre weg.
- [x] T7  Migration Aufräumjob  · files: supabase/migrations/20261021120200_proj1_cleanup_job.sql  · → AC-13
  - `pg_cron` einschalten. Die Funktion `private.license_center_cleanup` löscht Login-Versuche und Registrierungen, die älter als 23 Stunden sind, und Sperren ohne Wirkung. Der Job `license-center-cleanup` läuft stündlich, aufrufbar ist die Funktion nur vom Eigentümer. Details: design.md → Aufräumjob.
  - Kein automatischer Test, weil das Schema `private` über die API nicht erreichbar ist. Nachweis im SQL-Editor wie in design.md → Hinweise für `/qa`: zurückdatierte Einträge anlegen, Funktion aufrufen.

## Stufe 2 — Grundlagen

<!-- Bausteine ohne Abhängigkeit untereinander. Alle Dateisätze sind disjunkt, deshalb sind alle Aufgaben [P]. -->

- [x] T8 [user]  Turnstile-Testschlüssel eintragen  · where: `.env.local` → `NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA` und `TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA` (Cloudflares offizielle Testschlüssel, bestehen immer)  · → AC-1, AC-4, AC-7
- [x] T9 [P]  Eingaberegeln und Meldungstexte  · files: src/features/account/account.schema.ts, src/features/account/account.schema.test.ts, src/features/account/account.rules.ts, src/features/account/account.rules.test.ts  · → AC-2, AC-3, AC-5, AC-6, AC-8, EC-3, EC-4, EC-5, EC-6, EC-8, EC-9
  - Schema: ein Zod-Schema für Browser und Server, mit den Feldmeldungen aus design.md → Eingaberegeln.
    - Jedes Textfeld ist vorab auf 1.000 Zeichen begrenzt.
    - Trägername: Rand-Leerzeichen entfernen, dann 2 bis 100 Zeichen, gezählt wie `char_length`.
    - E-Mail: Rand-Leerzeichen entfernen, kleinschreiben, höchstens 254 Zeichen.
    - Passwort bei der Registrierung: nie verändert, 8 bis 72 Zeichen und höchstens 72 Bytes. Die Wiederholung muss gleich sein.
    - Passwort beim Login: nur Pflicht.
    - Turnstile-Token: Pflicht, höchstens 2.048 Zeichen.
  - Regeln:
    - alle Texte aus design.md → Meldungstexte
    - Restminuten aufgerundet, mindestens 1 („in 1 Minute“ / „in X Minuten“)
    - IP aus dem letzten gültigen Eintrag von `X-Forwarded-For`, sonst `0.0.0.0`, dazu die Angabe, ob die IP öffentlich ist
    - Ergebnis eines Ablaufs → Meldung
- [x] T10 [P]  Turnstile-Prüfung auf dem Server  · files: src/features/account/turnstile.integration.ts, src/features/account/turnstile.integration.test.ts  · → AC-7, EC-8
  - `server-only`. Schickt das Token an Cloudflare und, wenn übergeben, die IP. Ob die IP mitgeht, entscheidet die Action mit der Regel aus T9. Das Ergebnis ist „bestanden“, „abgelehnt“ oder „Fehler“. Ein fehlendes Secret, keine Antwort oder eine unlesbare Antwort gelten als Fehler, nie als bestanden. Der Test bildet `fetch` nach.
- [x] T11 [P]  Supabase-Clients für den Server  · files: src/lib/supabase/admin.ts, src/lib/supabase/cookie-options.ts, src/lib/supabase/cookie-options.test.ts, src/lib/supabase/server.ts  · → AC-1, AC-4, AC-10
  - Admin-Client: `server-only`, mit dem Server-Schlüssel. Er speichert keine Sitzung und setzt keine Cookies. Benutzt wird er nur für die Bremsfunktionen, das Registrieren und die Passwortprüfung.
  - Cookie-Regeln: HttpOnly, SameSite=Lax, Secure außer über `http`. Die Lebensdauer bleibt, wie Supabase sie setzt, also dauerhaft. Der Server-Client übernimmt die Regeln, das Tor aus T22 auch.
- [x] T12 [P]  Design-Tokens und Wurzel-Layout  · files: src/app/globals.css, src/app/layout.tsx  · → AC-4, EC-10
  - Die Werte aus `docs/design-system.md` nach `globals.css` übertragen (Auftrag dort unter „Umsetzung“): hell und dunkel nach der Einstellung des Geräts, Textrollen, die zusätzlichen Tokens im `@theme inline`-Block.
  - Wurzel-Layout: `lang="de"`, Inter über `next/font`, Titel „Lizenzzentrale“, Toaster (shadcn `sonner`). Kein Turnstile-Skript und keine Vorab-Verbindung zu Cloudflare.
- [x] T13 [P]  Next-Konfiguration  · files: next.config.ts  · → Technische Anforderungen (Sicherheit)
  - Protokoll der Server Functions aus, sonst schreibt `next dev` Passwörter in die Konsole. Dazu die vier Sicherheitsheader aus `.claude/rules/security.md`, kein `X-Powered-By` und `agentRules: false`. Details: design.md → Technische Entscheidungen.
- [x] T14 [P]  Bot-Prüfung im Browser  · files: package.json, package-lock.json, src/features/account/components/bot-check.tsx, src/features/account/components/bot-check.test.tsx  · → AC-7, EC-8
  - Paket `@marsidev/react-turnstile` installieren. Das Widget läuft im Modus Managed, auf Deutsch, im Farbschema des Geräts, in voller Breite und mit vorab reservierter Höhe. Ein abgelaufenes Token holt es selbst neu, und das Formular kann es zurücksetzen.
  - Token, Ablauf und Ladefehler meldet es an das Formular. Ladefehler sind: Das Skript lädt nicht, das Widget meldet einen Fehler, oder es ist nach 15 Sekunden nicht sichtbar. Den Text aus EC-8 setzt das Formular (T26, T27), damit das Bauteil nicht von T9 aus derselben Stufe abhängt.
- [x] T15 [P]  Kopfzeile  · files: src/components/app-header.tsx, src/components/app-header.test.tsx  · → AC-4, AC-10, EC-5, EC-10
  - Links steht „Lizenzzentrale“. Rechts steht der Trägername als reiner Text in einer Zeile, mit „…“ gekürzt, der volle Name als Hinweistext. Für EC-5 gibt es die Kopfzeile auch ohne Namen.
  - „Abmelden“ ist ein Knopf in einem eigenen Formular, das per POST an `/sign-out` sendet. Er schrumpft nie, die Tippfläche ist mindestens 44 × 44 px.
  - Die Kopfzeile bekommt den Namen als Wert und importiert nichts aus `src/features`.

## Stufe 3 — Datenzugriff auf dem Server

<!-- Braucht die Datenbank aus Stufe 1 und Admin-Client und Cookie-Regeln aus Stufe 2. Alle Dateisätze sind disjunkt, deshalb sind alle Aufgaben [P]. -->

- [x] T16 [user]  E-Mail-Bestätigung aus  · where: Supabase → Authentication → Sign In / Providers → Email → „Confirm email“ → **aus**  · → AC-1, AC-3
- [x] T17 [user]  Mindestlänge Passwort  · where: Supabase → Authentication → Sign In / Providers → Email → „Minimum password length“ (je nach Stand des Dashboards auch unter Attack Protection) → **8**, keine Pflicht zu Zeichenarten  · → AC-2
- [x] T18 [user]  CAPTCHA in Supabase mit dem immer scheiternden Test-Secret  · where: Supabase → Authentication → Attack Protection → „Enable Captcha protection“ → an, Anbieter Cloudflare Turnstile, Secret `2x0000000000000000000000000000000AA`  · → AC-6, AC-7, AC-8
- [x] T19 [P]  Bremsen-Datenzugriff  · files: src/features/account/throttle.data.ts, src/features/account/throttle.data.test.ts  · → AC-6, AC-8, EC-2, EC-7
  - `server-only`. Ruft die fünf Funktionen aus T6 über den Admin-Client auf und liefert typisierte Antworten: „erlaubt“ mit Versuchsnummer, „gesperrt bis“ mit Zeitpunkt, ja oder nein bei `license_center_email_registered`. Ein Datenbankfehler wird zu einem Fehlerergebnis, nie zu „erlaubt“.
- [x] T20 [P]  Auth-Datenzugriff  · files: src/features/account/auth.data.ts, src/features/account/auth.data.test.ts  · → AC-1, AC-3, AC-4, AC-7, AC-10
  - `server-only`. Registriert und prüft Passwörter über den Admin-Client. Beim Registrieren gehen die normalisierte Adresse, das unveränderte Passwort und `training_provider_name` in den Registrierungsdaten mit. Die gelieferte Sitzung kommt in die Cookies der Nutzersitzung. Abgemeldet wird mit Scope `local`.
  - Mögliche Ergebnisse: Erfolg, schon registriert, Supabases eigene Grenze, Passwort abgelehnt, falsche Zugangsdaten, sonstiger Fehler.
  - Tests am gehosteten Projekt (offene Frage aus design.md): Über den Admin-Schlüssel klappen Registrierung und Login. Direkt mit dem öffentlichen Schlüssel enden beide mit `captcha_failed`, das setzt T18 voraus.
- [x] T21 [P]  Wächter, die Schnittstelle für PROJ-2  · files: src/features/account/session.data.ts, src/features/account/session.data.test.ts  · → AC-4, AC-9, AC-11, EC-5, EC-6
  - `getCurrentAdmin()` liefert einen von drei Zuständen:
    - abgemeldet
    - nicht zugeordnet, mit Konto-ID
    - zugeordnet: Konto-ID, Rolle und Träger mit ID, Name und Kontingent
  - Gelesen wird immer mit der Nutzersitzung, also durch die Leseregeln, nie mit dem Admin-Client.
  - `requireTrainingProvider()` leitet bei „abgemeldet“ auf `/login?reason=session` weiter und liefert sonst das Ergebnis. Beide laufen pro Anfrage nur einmal.
- [x] T22 [P]  Tor  · files: src/proxy.ts, src/proxy.test.ts  · → AC-9, AC-10, EC-6
  - Läuft bei jeder Anfrage außer den statischen Dateien von Next.js und Bildern. Frischt die Sitzung mit den Cookie-Regeln aus T11 auf und fragt den Auth-Server (`getUser`).
  - Weiterleitungen nur bei GET und HEAD:
    - `/` → `/licenses` oder `/login`, je nach Sitzung
    - `/login` und `/register` mit Sitzung → `/licenses`
    - jede andere Adresse ohne Sitzung → `/login?reason=session`
  - POST-Anfragen (Server Actions, `/sign-out`) gehen ohne Weiterleitung durch.

## Stufe 4 — Abläufe und angemeldeter Bereich

<!-- Braucht die Server-Bausteine aus Stufe 2 und 3. Alle Dateisätze sind disjunkt, deshalb sind alle Aufgaben [P]. -->

- [x] T23 [P]  Server Actions `register` und `login`  · files: src/features/account/account.actions.ts, src/features/account/account.actions.test.ts  · → AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, EC-1, EC-2, EC-3, EC-4, EC-7
  - `register`: Eingaben → Bot-Prüfung → Registrierungsbremse → Supabase → Ergebnis. Bei einem unklaren Fehler fragt der Server `license_center_email_registered`, damit der Verlierer aus EC-2 die Meldung aus AC-3 sieht. Jeder Versuch wird mit seinem Ergebnis abgeschlossen. Keine Mindestantwortzeit.
  - `login`: Ist das Passwort länger als 72 Zeichen oder 72 Bytes, kommt die Meldung aus AC-5, ohne Bot-Prüfung, Bremse und Zählung. Sonst: Bot-Prüfung → Login-Bremse → Passwortprüfung → `license_center_finish_login`. Jede Antwort außer dem Erfolg kommt frühestens 1 Sekunde nach dem Eingang.
  - Bei Erfolg leiten beide auf `/licenses` weiter. Die IP kommt nach der Regel aus T9 und geht nur an Cloudflare, wenn sie öffentlich ist. Die Tests bilden die Bausteine nach und arbeiten mit künstlicher Zeit.
- [x] T24 [P]  Abmelden  · files: src/app/sign-out/route.ts, src/app/sign-out/route.test.ts  · → AC-10, EC-6
  - Nur POST, andere Methoden → 405.
  - Mit Sitzung: abmelden mit Scope `local`, Cookies löschen, 303 auf `/login`.
  - Ohne Sitzung: 303 auf `/login?reason=session`.
- [x] T25 [P]  Angemeldeter Bereich  · files: src/app/(app)/layout.tsx, src/app/(app)/licenses/page.tsx, src/features/account/components/unassigned-notice.tsx, src/app/page.tsx  · → AC-4, AC-9, AC-10, EC-5
  - Der Rahmen `(app)` ruft den Wächter auf und zeigt die Kopfzeile mit dem Trägernamen. Bei „nicht zugeordnet“ zeigt er die Kopfzeile ohne Namen und nur die Hinweisbox aus EC-5.
  - `/licenses` ruft den Wächter ebenfalls auf und zeigt den Titel „Lizenzübersicht“ (type-title) und den Platzhaltersatz. Seitentitel: „Lizenzübersicht – Lizenzzentrale“.
  - Alles wird dynamisch gerendert (`no-store`).
  - `src/app/page.tsx` ersetzt die Startseite durch eine Weiterleitung, als Rückfall hinter dem Tor.

## Stufe 5 — Formulare und Abschluss

<!-- Braucht die Actions aus Stufe 4 und das Widget aus Stufe 2. Die beiden Formulare teilen sich keine Datei, der Rahmen (auth) gehört zu T26. Die go-live-Aufgaben stehen am Ende, weil sie erst mit /deploy möglich sind. -->

- [x] T26 [P]  Login  · files: src/app/(auth)/layout.tsx, src/app/(auth)/login/page.tsx, src/features/account/components/login-form.tsx, src/features/account/components/login-form.test.tsx  · → AC-4, AC-5, AC-6, AC-7, EC-6, EC-8, EC-9
  - Rahmen `(auth)`: zentrierte Karte mit dem Produktnamen „Lizenzzentrale“. Auf dem Smartphone volle Breite mit Seitenrand, ab md etwa 400 px.
  - `/login` zeigt die Hinweisbox „Bitte melden Sie sich erneut an.“ nur, wenn `reason` genau `session` ist, und dann immer denselben festen Text. Seitentitel: „Anmelden – Lizenzzentrale“.
  - Formular:
    - Felder: E-Mail (`email`), Passwort (`current-password`), Bot-Prüfung.
    - Formularfehler stehen in einer shadcn-`alert` mit `role="alert"` über dem Knopf.
    - Der Knopf ist gesperrt ohne Token und während des Sendens (`aria-busy`).
    - Gesendet wird per POST an die Action, zusätzlich mit `method="post"`.
    - Nach einem Fehler wird das Passwort geleert und das Widget zurückgesetzt, die E-Mail bleibt.
    - Die Weiterleitung nach dem Erfolg gilt nie als Fehler.
    - Kommt keine Antwort, erscheint die Meldung aus EC-9. Lädt das Widget nicht, erscheint die aus EC-8.
- [x] T27 [P]  Registrierung  · files: src/app/(auth)/register/page.tsx, src/features/account/components/register-form.tsx, src/features/account/components/register-form.test.tsx  · → AC-1, AC-2, AC-3, AC-7, AC-8, EC-1, EC-3, EC-8, EC-9
  - `/register` mit dem Seitentitel „Registrieren – Lizenzzentrale“.
  - Felder: Trägername (`organization`), E-Mail (`email`), Passwort und Wiederholung (`new-password`), Bot-Prüfung. Unter dem Passwort steht schon vor der Eingabe „Mindestens 8 Zeichen.“
  - Feldfehler erscheinen schon im Browser, mit dem Schema aus T9. Formularfehler stehen über dem Knopf, bei AC-3 mit dem Link „Zum Login“.
  - Knopf, Absenden, Fehler, Weiterleitung und Widget verhalten sich wie in T26. Nach einem Fehler werden beide Passwortfelder geleert, Trägername und E-Mail bleiben.
- [x] T28 [P]  README: Einrichtung für den Prüfer  · files: README.md  · → AC-1, AC-7 (PRD → Erfolgskriterien: nachvollziehbar für den Prüfer)
  - Abschnitt „Supabase und Bot-Prüfung einrichten“. Er beschreibt:
    - das Projekt in eu-central-1 anlegen
    - die Dashboard-Einstellungen aus T4 und T16 bis T18
    - die Variablen und die Testschlüssel
    - `supabase link` und `supabase db push`
  - Grundlage: design.md → Footprint.
- [ ] T29 [user go-live]  Eigenes Turnstile-Widget  · where: Cloudflare-Dashboard → Turnstile → Add widget (Domain der App, Modus Managed); Site-Key und Secret in die Umgebung des Hosts. **Das Secret in Supabase bleibt das immer scheiternde Test-Secret.**  · → AC-7
- [ ] T30 [user go-live]  Auftragsverarbeitungsverträge akzeptieren  · where: Supabase → Organization Settings → Legal Documents; Cloudflare-Konto  · → keine AC (Art. 28 DSGVO, `docs/privacy.md`)
- [x] T31 [user]  Platzhalter für den Proxy-Schalter dokumentieren (aus dem Bugfix BUG-2)  · where: `.env.local.example` (der Agent darf die Datei nicht bearbeiten) → `TRUSTED_PROXY=false`  · → AC-6, AC-8
- [ ] T32 [user go-live]  Proxy-Schalter setzen (aus dem Bugfix BUG-2)  · where: Umgebung des Hosts → `TRUSTED_PROXY=true`, **nur** wenn der Host `X-Forwarded-For` selbst setzt bzw. überschreibt (design.md → Einstellungen durch den Nutzer)  · → AC-6, AC-8

## Parallelisierung

- **Stufen sind Schranken.** Eine Stufe beginnt erst, wenn die vorige vollständig zusammengeführt und gegen ihre AC-IDs geprüft ist. So bleibt der Datenvertrag vor der Oberfläche: Datenbank (Stufe 1) → Grundlagen (2) → Datenzugriff (3) → Abläufe (4) → Formulare (5).
- **`[P]` verlangt disjunkte Dateien.** Zwei `[P]`-Aufgaben derselben Stufe nennen nie denselben Pfad unter `files:`. Würden sie dieselbe Datei berühren, sind sie **nicht** beide `[P]`: Dann wird eine davon nach hinten gestellt, oder beide werden zusammengelegt.
- **Gemeinsame Ressource außerhalb der Dateien:** Die gehostete Datenbank ist für alle Arbeitskopien dieselbe. Deshalb laufen die Migrationen in Stufe 1 nacheinander. Spätere Tests, die das gehostete Projekt berühren (T19, T20, T21), legen nur eigene Testkonten mit eindeutigen Adressen an und räumen sie wieder weg.
- **Grob, nicht kleinteilig, aber nie größer als der Kontext eines Subagenten.** Aufgaben sind sinnvolle Zwischenstände, keine Einzeilen-Änderungen. Jede hat ein Anliegen und höchstens vier Dateien.
- **`[user]`-Aufgaben laufen nie parallel und werden nie gebaut.** Sie stehen in der Stufe, deren Code sie braucht. Erreicht `/build` die Stufe, übergibt es sie (was, wo, welcher Wert) und arbeitet weiter. Das Kästchen bleibt offen, bis der Nutzer es abhakt. Ein `[user go-live]`-Kästchen bleibt offen, bis `/deploy` die Einstellung gemacht und ihre Wirkung gesehen hat.
- Während `/build` läuft jede `[P]`-Aufgabe der aktiven Stufe in einem eigenen Subagenten mit eigener Git-Arbeitskopie. Danach führt der Haupt-Agent zusammen, prüft gegen die AC-IDs der Stufe und hakt die Kästchen hier ab. Subagenten erklären sich nie selbst für fertig, es gibt einen einzigen Verantwortlichen für die Prüfung.
