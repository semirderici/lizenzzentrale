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
- Wer angemeldet `/login` oder `/register` aufruft, landet in der Lizenzübersicht. Wer abgemeldet `/licenses` aufruft, landet beim Login.

## Layout-Bereiche

- **Seitenleiste:** keine. Es gibt nach dem Login nur einen Bildschirm.
- **Kopfzeile (angemeldet):** links „Lizenzzentrale“, rechts der Name des Bildungsträgers und „Abmelden“.
- **Inhalt:** die Seite des Features, mit begrenzter Breite und Seitenrand laut `docs/design-system.md`.
- **Smartphone:** dieselbe Kopfzeile. Ein langer Trägername wird gekürzt, „Abmelden“ bleibt immer sichtbar. Kein Burger-Menü, weil es nichts zu navigieren gibt.
- **Fußzeile:** keine. Impressum und Datenschutzerklärung kommen erst, wenn die App live geht (siehe `docs/PRD.md` → Später).

## Seitenmuster

Gilt für die Lizenzübersicht und jede spätere Seite im angemeldeten Bereich.

- **Seitenkopf:** Titel (`type-title`), optional eine Unterzeile, die Hauptaktion rechts. Auf dem Smartphone steht die Hauptaktion in voller Breite darunter.
- **Laden:** Skeletons nur im Inhaltsbereich, in der Form des späteren Inhalts. Die Kopfzeile bleibt stehen.
- **Leer:** gedämpftes Symbol, ein Satz und der nächste Schritt (z. B. „Noch keine Lizenz vergeben. Weisen Sie die erste zu.“).
- **Fehler beim Laden:** Hinweisbox (shadcn `alert`) im Inhalt mit „Erneut versuchen“, nie eine leere Seite.
- **Rückmeldungen:** Toasts (`sonner`) für Erfolg und Fehler einer Aktion.

## Anmeldestatus

- **Abgemeldet:** nur Anmelden und Registrieren erreichbar. Keine Navigation, sondern eine zentrierte Karte mit dem Namen „Lizenzzentrale“, dem Formular und einem Link zum jeweils anderen Formular („Noch kein Konto? Registrieren“ / „Schon registriert? Anmelden“).
- **Angemeldet:** nur die Lizenzübersicht, im Rahmen mit Kopfzeile.
- **Rollen:** keine. Heute gibt es nur den Verwalter.

## Gemeinsame Bausteine

Vorschlag, `/architecture` für PROJ-1 legt sie fest.

| Baustein | Datei | Zweck |
|----------|-------|-------|
| Rahmen abgemeldet | `src/app/(auth)/layout.tsx` | zentrierte Karte für Login und Registrierung |
| Rahmen angemeldet | `src/app/(app)/layout.tsx` | geschützter Rahmen mit Anmelde-Prüfung und Kopfzeile |
| Kopfzeile | `src/components/app-header.tsx` | „Lizenzzentrale“, Name des Bildungsträgers, Abmelden |

---

_Dies ist ein lebendes Dokument. Wenn `/architecture` ein Feature entwirft, das einen Bereich, einen Layout-Bereich oder ein neues Seitenmuster hinzufügt, aktualisiert es zuerst diese Karte. Verhaltensänderungen am Rahmen laufen über `/refine` auf dem zuständigen Feature._
