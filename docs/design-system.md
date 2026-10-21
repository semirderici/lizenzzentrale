# Design-System (Übergangsdesign)

> **Status: Übergangsdesign.** Das finale Design-System entsteht später mit Claude Design. Bis dahin gilt diese Datei, und `/build` wendet sie bei jedem Feature an, ohne noch einmal nachzufragen.
>
> - **Quelle:** übernommen aus dem Übergangsdesign der E-Learning-Plattform (`ai-elearning-platform/docs/design-system.md` und `src/app/globals.css`), gelesen und abgestimmt bei `/init` am 2026-10-21. Weggelassen ist alles, was nur die Lernplattform braucht (Notenfarben, Lesetext, Kästen in Lerneinheiten, Player-Navigation, Theme-Schalter).
> - **Haltung:** schlicht, neutral, ruhig, aufgeräumt, seriös genug für Bildungsträger. Grundlage sind die shadcn/ui-Standardkomponenten ohne aufwendiges Branding. **Keine Zeit in optische Feinheiten:** Komponenten werden aus shadcn/ui zusammengesetzt und über Tokens gestaltet, nicht einzeln nachjustiert.
> - **Austauschbar:** Alle Designentscheidungen sind Tokens an **einer** Stelle (`src/app/globals.css`). Komponenten verwenden ausschließlich Tokens und nie feste Farb-, Schrift- oder Abstandswerte. Die Token-Namen sind **dieselben wie in der Plattform**: Wer das Design wechselt, tauscht in beiden Projekten nur die Werte aus und baut keine Komponente um.
> - **Umsetzung:** Der erste `/build` (PROJ-1) überträgt die Werte dieser Datei nach `src/app/globals.css`, ergänzt die zusätzlichen Tokens im `@theme inline`-Block und bindet Inter über `next/font` ein. Alle weiteren Features verwenden die Tokens nur noch.

## Grundregeln (gelten immer)

- **Hell und dunkel** sind von Anfang an definiert. Das Theme folgt der Einstellung des Geräts. Einen Schalter dafür gibt es nicht.
- **Nie reines `#000` oder `#fff`** für Hintergrund oder Text. Es gibt nur fast Weiß und fast Schwarz.
- **Kontrast:** Text hat mindestens **4,5:1** zu seinem eigenen Hintergrund, in beiden Themes. Bedienelemente haben mindestens **3:1** zur Fläche.
- **Status nie nur über Farbe:** immer als Wort (z. B. „Einladung versendet“), die Farbe kommt nur dazu.
- **Jedes klickbare Element** zeigt eine sichtbare Reaktion beim Überfahren **und** einen sichtbaren Fokus bei Bedienung mit der Tastatur.
- **Jede Tippfläche** ist mindestens 44 × 44 px groß, auch wenn das Element kleiner gezeichnet ist.
- **Ein Radius** für alles (siehe unten). Gemischte Ecken gibt es nicht.
- **Die Akzentfarbe** hat Varianten für Hover und für zarte Hintergründe. Sie liegt nie flach auf großen Flächen.

## Farben

Format wie in `src/app/globals.css`: HSL-Werte als `H S% L%`, eingebunden über `hsl(var(--token))`. Die Hex-Werte dienen nur zur Orientierung.

### Basis (shadcn-Tokens)

| Token | Hell | Dunkel | Verwendung |
|-------|------|--------|------------|
| `--background` | `220 20% 97.5%` (#F7F8FA) | `222 30% 8%` (#0E121B) | Seitenhintergrund |
| `--foreground` | `222 47% 11%` (#0F1729) | `210 30% 95%` (#EEF2F6) | Text |
| `--card` | `220 20% 99.5%` (#FDFEFE) | `222 26% 11%` (#151923) | Karten, Flächen |
| `--card-foreground` | wie `--foreground` | wie `--foreground` | Text auf Karten |
| `--popover` | wie `--card` | wie `--card` | Menüs, Popover |
| `--popover-foreground` | wie `--foreground` | wie `--foreground` | |
| `--primary` | `217 64% 40%` (#2557A7) | `214 85% 68%` (#68A4F3) | Akzent: Hauptaktion, Links |
| `--primary-foreground` | `220 20% 98.5%` (#FAFBFC) | `222 47% 9%` (#0C1322) | Text auf Akzent |
| `--secondary` | `214 30% 93%` (#E8ECF3) | `220 20% 18%` (#252B37) | zweitrangige Knöpfe |
| `--secondary-foreground` | wie `--foreground` | wie `--foreground` | |
| `--muted` | `214 30% 94%` (#EBEFF4) | `220 20% 16%` (#212631) | gedämpfte Flächen, Skeletons |
| `--muted-foreground` | `215 19% 36%` (#4A596D) | `215 20% 70%` (#A3B0C2) | Nebentext, Unterzeilen |
| `--accent` | `214 30% 92%` (#E4EAF1) | `220 20% 20%` (#29303D) | Hover-Fläche für Ghost-, Outline- und Menüeinträge |
| `--accent-foreground` | wie `--foreground` | wie `--foreground` | |
| `--destructive` | `0 72% 42%` (#B81E1E) | `0 75% 65%` (#E96363) | Fehler, Entziehen |
| `--destructive-foreground` | `220 20% 98.5%` | `222 47% 9%` | Text auf Fehlerfläche |
| `--border` | `214 25% 87%` (#D6DDE6) | `220 18% 22%` | Rahmen von Karten und Trennlinien |
| `--input` | `215 14% 52%` (#738296) | `215 14% 48%` (#69788C) | Rahmen von Eingabefeldern (≥ 3:1) |
| `--ring` | wie `--primary` | wie `--primary` | Fokusrahmen |
| `--radius` | `0.5rem` | `0.5rem` | Basisradius (siehe unten) |

Die `--sidebar-*`-Tokens werden nicht verwendet, weil die Shell keine Seitenleiste hat. Sie zeigen auf `--card`, `--foreground`, `--primary`, `--accent`, `--border` und `--ring`, damit es nur eine Quelle gibt. Die `--chart-*`-Tokens werden ebenfalls nicht verwendet und übernehmen die Werte der Plattform.

### Ergänzende Tokens

| Token | Hell | Dunkel | Verwendung |
|-------|------|--------|------------|
| `--primary-hover` | `217 66% 33%` (#1D478C) | `214 88% 74%` (#82B5F7) | Hover und Aktiv-Zustand der Hauptaktion |
| `--primary-subtle` | `214 70% 94%` (#E5EEFA) | `217 45% 18%` (#192943) | Hinweisflächen, ausgewählter Zustand |
| `--success` | `142 72% 27%` (#137638) | `142 55% 55%` (#4DCB7B) | Bestätigungen (als Text oder Symbol) |
| `--success-subtle` | `140 50% 92%` (#E0F5E7) | `142 35% 15%` (#193423) | Fläche für Bestätigungen |
| `--destructive-subtle` | `0 80% 94%` (#FCE3E3) | `0 40% 17%` (#3D1A1A) | Fläche für Fehlermeldungen |
| `--warning` | `30 90% 32%` (#9B5208) | `38 90% 60%` (#F5B13D) | Warnungen, z. B. „Kontingent fast voll“ |
| `--warning-subtle` | `43 90% 90%` (#FCEFCF) | `35 45% 15%` (#372915) | Fläche für Warnungen |
| `--overlay` | `222 47% 5%` (#070A13) | `222 47% 5%` (#070A13) | Abdunklung hinter Dialogen, mit 80 % Deckkraft |

## Typografie

- **Schrift:** *Inter* für alles. Eingebunden über `next/font` und damit **selbst ausgeliefert**: Beim Laden der Seite gehen keine Anfragen an Google.
- **Gleich breite Ziffern** (`tabular-nums`) überall, wo Zahlen verglichen werden: Kontingent („18 von 25“), Zähler, Tabellen.
- **Textrollen** als Utility-Klassen `type-title`, `type-section`, `type-subsection`, `type-body`, `type-small`, gespeist aus Tokens (`--type-*`) wie in der Plattform:

| Rolle | Klasse | Smartphone | ab `md` | Gewicht | Zeilenhöhe |
|-------|--------|-----------|---------|---------|------------|
| Seitentitel (h1) | `type-title` | 24 px (1.5rem) | 30 px (1.875rem) | 600 | 1.25 |
| Abschnitt (h2) | `type-section` | 20 px (1.25rem) | 24 px (1.5rem) | 600 | 1.3 |
| Unterabschnitt (h3) | `type-subsection` | 18 px (1.125rem) | 20 px (1.25rem) | 600 | 1.4 |
| Text | `type-body` | 16 px (1rem) | 16 px | 400 | 1.6 |
| Klein (Unterzeilen, Hinweise) | `type-small` | 14 px (0.875rem) | 14 px | 400 | 1.5 |
| Hervorhebung im Text | – | – | – | 500 bis 600 | – |

- **Eingabefelder:** mindestens 16 px Schrift, damit das Smartphone beim Antippen nicht hineinzoomt.

## Radius, Abstände, Flächen

- **Radius:** ein Basiswert **`--radius: 0.5rem` (8 px)**, abgeleitet `md` = 6 px und `sm` = 4 px für kleine Elemente in Komponenten. Das gilt für Badges, Karten, Knöpfe und Eingabefelder. Nur Avatare sind rund.
- **Abstandsraster:** alle Abstände in Schritten von 4 px (Tailwind-Skala).
  - Seitenrand: 16 px auf dem Smartphone, 24 px auf dem Tablet, 32 px auf dem Desktop
  - Innenabstand von Karten: 16 px auf dem Smartphone, 24 px ab `md`
  - Abstand zwischen Abschnitten: 32 px auf dem Smartphone, 48 px ab `md`
  - Abstand zwischen zusammengehörigen Elementen: 8 bis 12 px
- **Flächen:** Karten und Bereiche werden durch **feine Rahmen** (`--border`) getrennt, **nicht durch Schatten**. Schatten gibt es nur bei Elementen, die über der Seite liegen: Dialog, Menü, Popover, Toast.

## Komponenten

- **Knöpfe:**
  - Hauptaktion: Variante `default` (Akzent), **44 px hoch** (`h-11`). Auf dem Smartphone steht die Hauptaktion des Seitenkopfs in voller Breite.
  - Zweitrangiges: Variante `secondary`, `outline` oder `ghost`.
  - **Entziehen einer Lizenz:** Variante `destructive`, **nur mit Bestätigungsdialog** (shadcn `alert-dialog`).
  - Kleine Knöpfe sind 36 px hoch gezeichnet, ihre Tippfläche ist aber 44 × 44 px. Sie stehen nur in dichten Tabellen auf dem Desktop, nie als Hauptaktion.
- **Fokus:** 2 px Rahmen in `--ring` mit 2 px Abstand, nur bei Bedienung mit der Tastatur (`focus-visible`), in beiden Themes gut sichtbar.
- **Hover:** Hauptaktion wird zu `--primary-hover`, Outline- und Ghost-Elemente bekommen `--accent` als Fläche, Links werden unterstrichen.
- **Eingabefelder:** 44 px hoch, Beschriftung darüber, Fehlertext darunter in `--destructive` mit Symbol. Fehler stehen nie nur über die rote Rahmenfarbe da.
- **Kontingent-Anzeige:** Zahl als Text („18 von 25 Lizenzen vergeben“) mit `tabular-nums`, dazu ein Fortschrittsbalken (shadcn `progress`): Spur in `--muted`, Füllung in `--primary`. Der Wert steht immer als Zahl daneben, nie nur als Balken.
- **Status-Badges** (shadcn `badge`): Wort plus Farbe, Schrift in der Statusfarbe auf der zarten Fläche:
  - „Einladung versendet“: `--success` auf `--success-subtle`
  - „Versand fehlgeschlagen“: `--destructive` auf `--destructive-subtle`
  - neutrale Zustände: `--muted-foreground` auf `--muted`
- **Tabellen:** shadcn `table` für die Liste der Teilnehmer. Auf dem Smartphone darf die Tabelle in Karten pro Zeile umbrechen, statt seitlich zu scrollen.
- **Laden:** Skeletons (`--muted`) in der Form des späteren Inhalts, nur im Inhaltsbereich. Kein Spinner über die ganze Seite.
- **Leerer Zustand:** ein gedämpftes Symbol, ein Satz in `--muted-foreground` und der nächste sinnvolle Schritt als Link oder Knopf.
- **Toasts:** shadcn `sonner` für Rückmeldungen wie „Lizenz zugewiesen“ oder „Lizenz entzogen“.

---

_Wird das finale Design-System eingeführt, ersetzt es die Werte in dieser Datei und in `src/app/globals.css`. Die Token-Namen bleiben gleich, damit keine Komponente angefasst werden muss._
