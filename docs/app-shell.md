# App-Rahmen & Navigation

> Die app-weite Karte **des Rahmens, in dem jedes Feature angezeigt wird**: Navigation, Bereiche des Layouts und die Muster, die jede Seite wiederholt.
>
> - Erstellt von `/init` als erster Gesamtentwurf (Bereiche und Layout).
> - Verfeinert von `/architecture`, wenn ein Feature entworfen wird.
> - **Ebene:** Struktur, nicht Gestaltung. Welche Bereiche es gibt, wo sie liegen, wer sie sieht, was jede Seite teilt. Farben, Schriften und Komponenten-Stil stehen in `docs/design-system.md`, die Innenseite einer einzelnen Seite in der `design.md` ihres Features.

## Zuständiges Feature

Owner: **PROJ-1 Konto & Login.** PROJ-1 verlangt ausdrücklich den geschützten Bereich mit Abmelden und wird zuerst gebaut. Deshalb baut PROJ-1 den Rahmen: Kopfzeile, Abmelden, Weiterleitungen nach Anmeldestatus. PROJ-2 füllt nur den Inhalt der Lizenzübersicht, PROJ-3 ergänzt darin den Versandstatus. Änderungen am Rahmen laufen über `/refine PROJ-1`, nie direkt über die `design.md` eines anderen Features.

## Bereiche

| Bereich | Was der Nutzer dort tut | Sichtbar für | Feature |
|---------|-------------------------|--------------|---------|
| Anmelden (`/login`) | sich mit E-Mail und Passwort anmelden | abgemeldet | PROJ-1 |
| Registrieren (`/register`) | Bildungsträger und Konto anlegen | abgemeldet | PROJ-1 |
| Lizenzübersicht (`/licenses`) | Kontingent sehen, Lizenzen zuweisen und entziehen, Versandstatus der Einladungen sehen | angemeldet | PROJ-2 (Inhalt), PROJ-3 (Versandstatus) |

- Die Startadresse `/` leitet weiter: angemeldet zur Lizenzübersicht, abgemeldet zum Login.
- Wer angemeldet `/login` oder `/register` aufruft, landet in der Lizenzübersicht. Wer abgemeldet `/licenses` oder eine andere geschützte Adresse aufruft, landet beim Login mit dem Hinweis „Bitte melden Sie sich erneut an.“ (`/login?reason=session`).
- Abmelden ist kein Bereich, sondern ein POST an `/sign-out`. Danach lädt der Browser `/login` komplett neu.
- Alle Weiterleitungen passieren auf dem Server, bevor eine Seite gerendert wird. Geschützte Inhalte erscheinen nie, auch nicht kurz.

## Layout-Bereiche

- **Seitenleiste:** keine. Es gibt nach dem Login nur einen Bildschirm.
- **Kopfzeile (angemeldet):** links „Lizenzzentrale“, rechts der Name des Bildungsträgers und „Abmelden“.
- **Inhalt:** die Seite des Features, mit begrenzter Breite und Seitenrand laut `docs/design-system.md`.
- **Smartphone:** dieselbe Kopfzeile. Ein langer Trägername wird gekürzt, „Abmelden“ bleibt immer sichtbar. Kein Burger-Menü, weil es nichts zu navigieren gibt.
- **Fußzeile:** keine. Impressum und Datenschutzerklärung kommen erst, wenn die App live geht (siehe `docs/PRD.md` → Später).

## Seitenmuster

Gilt für die Lizenzübersicht und jede spätere Seite im angemeldeten Bereich.

- **Seitenkopf:** Titel (`type-title`), optional eine Unterzeile, die Hauptaktion rechts. Auf dem Smartphone steht die Hauptaktion in voller Breite darunter.
- **Laden:** Skeletons nur im Inhaltsbereich, in der Form des späteren Inhalts, über eine `loading.tsx` neben der Seite. Die Kopfzeile bleibt stehen.
- **Leer:** gedämpftes Symbol, ein Satz und der nächste Schritt (z. B. „Noch keine Lizenz vergeben. Weisen Sie die erste zu.“).
- **Fehler beim Laden:** Hinweisbox (shadcn `alert`) im Inhalt mit „Erneut versuchen“, nie eine leere Seite. Die Seite fängt Ladefehler ihrer eigenen Daten selbst ab, „Erneut versuchen“ lädt über den Router neu, ohne den Browser neu zu laden (seit PROJ-2). Fehler im Wächter des Rahmens sind PROJ-1 BUG-4.
- **Rückmeldungen:** Toasts (`sonner`) für Erfolg und Fehler einer Aktion.
- **Aktionen mit Eingabe** öffnen einen Dialog (shadcn `dialog`). Was der Verwalter beheben oder wiederholen kann (Feldfehler, keine Verbindung), steht im Dialog, die Eingabe bleibt stehen. Ein Ergebnis (Erfolg oder endgültige Ablehnung) meldet ein Toast, und der Dialog schließt. Während des Sendens sind die Knöpfe gesperrt, und der Dialog schließt erst nach der Antwort (seit PROJ-2).
- **Destruktive Aktionen** nur mit Bestätigungsdialog (shadcn `alert-dialog`). Beim Öffnen hat „Abbrechen“ den Fokus (seit PROJ-2).
- **Listen** stehen ab `md` als Tabelle (shadcn `table`), darunter als eine Karte pro Eintrag, ohne seitliches Scrollen (seit PROJ-2).
- **Nach einer Aktion** zeigt die Seite ohne Neuladen den aktuellen Stand: Die Server Action frischt die Seite auf (`refresh()` aus `next/cache`), Zahlen und Listen kommen immer aus der Datenbank (seit PROJ-2).

## Anmeldestatus

- **Abgemeldet:** nur Anmelden und Registrieren erreichbar. Keine Navigation, sondern eine zentrierte Karte mit dem Namen „Lizenzzentrale“, dem Formular und einem Link zum jeweils anderen Formular („Noch kein Konto? Registrieren“ / „Schon registriert? Anmelden“). Beide Formulare enthalten die Bot-Prüfung (Turnstile). Ihr Skript lädt nur auf diesen zwei Seiten, nie im angemeldeten Bereich.
- **Angemeldet:** nur die Lizenzübersicht, im Rahmen mit Kopfzeile.
- **Angemeldet, aber keinem Bildungsträger zugeordnet** (PROJ-1 EC-5): Kopfzeile ohne Trägernamen, „Abmelden“ bleibt. Im Inhalt steht nur die Hinweisbox „Ihr Konto ist keinem Bildungsträger zugeordnet. Bitte wenden Sie sich an den Anbieter.“, keine Seite eines Features.
- **Rollen:** keine. Heute gibt es nur den Verwalter.

## Regeln für jedes Feature im angemeldeten Bereich

- **Jede Seite und jede Server Action** ruft den Wächter `requireTrainingProvider()` auf (`src/features/account/session.data.ts`). Das Tor (`src/proxy.ts`) allein reicht nie.
  - Ohne Sitzung leitet der Wächter auf `/login?reason=session` weiter.
  - Bei „nicht zugeordnet“ zeigt eine Seite nichts (die Hinweisbox kommt aus dem Rahmen), und eine Aktion bricht mit der Meldung aus EC-5 ab, ohne etwas zu lesen oder zu schreiben.
  - Bei „zugeordnet“ liefert er den Bildungsträger (ID, Name, Kontingent). Der Träger einer Aktion kommt immer von hier, nie aus Daten, die der Browser mitschickt.
- Seiten im angemeldeten Bereich werden immer dynamisch gerendert (kein Zwischenspeichern, `no-store`).
- Die Sitzung liegt in HttpOnly-Cookies. Der Supabase-Client im Browser sieht sie nicht, also lesen und schreiben Features über den Server.

## Gemeinsame Bausteine

Festgelegt von `/architecture` PROJ-1 (Details in `features/PROJ-1-account-login/design.md`).

| Baustein | Datei | Zweck |
|----------|-------|-------|
| Tor | `src/proxy.ts` | frischt die Sitzung auf, leitet nach Anmeldestatus weiter (nur bei GET/HEAD) |
| Rahmen abgemeldet | `src/app/(auth)/layout.tsx` | zentrierte Karte für Login und Registrierung |
| Rahmen angemeldet | `src/app/(app)/layout.tsx` | geschützter Rahmen mit Wächter und Kopfzeile, zeigt bei „nicht zugeordnet“ die Hinweisbox |
| Kopfzeile | `src/components/app-header.tsx` | „Lizenzzentrale“, Name des Bildungsträgers (als Text, gekürzt), Abmelden. Bekommt den Namen als Wert und importiert nichts aus einem Feature. |
| Abmelden | `src/app/sign-out/route.ts` | nur POST; beendet die Sitzung und leitet auf `/login` weiter (ohne Sitzung auf `/login?reason=session`) |
| Wächter | `src/features/account/session.data.ts` | `getCurrentAdmin()` und `requireTrainingProvider()` für Rahmen, Seiten und Aktionen |
| Rückmeldungen in Formularen | `src/components/form-feedback.tsx` | Feldfehler mit Symbol, Formular-Hinweisbox, Erkennen der Weiterleitung nach einer Action und des Verbindungsfehlers. Gebaut von PROJ-1, von PROJ-2 aus `src/features/account/components/` hierher verschoben, damit Login, Registrierung und die Dialoge von PROJ-2 dieselben Teile nutzen. Importiert nichts aus einem Feature. |

---

_Dies ist ein lebendes Dokument. Wenn `/architecture` ein Feature entwirft, das einen Bereich, einen Layout-Bereich oder ein neues Seitenmuster hinzufügt, aktualisiert es zuerst diese Karte. Verhaltensänderungen am Rahmen laufen über `/refine` auf dem zuständigen Feature._
