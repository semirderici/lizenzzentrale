# Datenmodell

> Die app-weite Karte **welche Daten das Produkt speichert und wie sie zusammenhängen**. Sie ist die gemeinsame Vorlage, an die sich die Tabellen jedes Features halten.
>
> - Erstellt von `/init` als erster Gesamtentwurf mit Entitäten und Beziehungen.
> - Verfeinert von `/architecture`, wenn ein Feature entworfen wird.
> - **Ebene:** Hier stehen Entitäten, Beziehungen und Eigentum auf Produktebene. Spaltentypen, Indizes und exakte Fremdschlüssel entscheidet jedes Feature in seiner `design.md`, nicht hier. Die englischen Bezeichner in Klammern sind Vorschläge für den Code.
> - **Übernahme in die Plattform:** Die Tabellen sollen später ohne Umbau in die Datenbank der E-Learning-Plattform wandern. Abgeglichen mit deren `docs/data-model.md` bei `/init` am 2026-10-21: Die Plattform hat bereits `profiles` (Lernende und Redakteure). Die Lizenzzentrale legt deshalb **kein eigenes `profiles`** an, und ihre Tabellennamen kollidieren nicht mit denen der Plattform.

## Entitäten

| Entität | Was sie darstellt | Gehört / sichtbar für |
|---------|-------------------|-----------------------|
| Konto (Supabase Auth) | E-Mail-Adresse, Passwort und Sitzungen des Verwalters. Supabase Auth verwaltet das, nicht die App. | der Nutzer selbst |
| Bildungsträger (`training_providers`) | ein Weiterbildungsinstitut mit Namen und **Kontingent** (Startwert 5 Lizenzen) | seine Verwalter lesen · den Namen setzt die Registrierung · das Kontingent ändert **nur der Anbieter** außerhalb der App (Supabase-Tabellenansicht), nie ein Verwalter |
| Mitgliedschaft (`training_provider_members`) | welches Konto zu welchem Bildungsträger gehört, mit Rolle (heute nur „Verwalter“, im Code `admin`) | das Konto selbst liest seine eigene Zeile · angelegt nur bei der Registrierung, nie über die App geändert |
| Lizenz (`licenses`) | eine vergebene Lizenz: E-Mail-Adresse des Teilnehmers (ohne Leerzeichen, kleingeschrieben) und Zeitpunkt der Zuweisung, sonst nichts. Sie wird nie geändert, nur angelegt und gelöscht. Später kommt der Verweis auf ein Lernkonto der Plattform dazu. Festgelegt von `/architecture` PROJ-2. | die Verwalter des eigenen Bildungsträgers: sehen, zuweisen, entziehen |
| Einladung (`license_invitations`) | der Stand des letzten Einladungsversands zu einer Lizenz: wird versendet, versendet oder fehlgeschlagen, und wann zuletzt versucht, sonst nichts (keine Adresse, kein Inhalt). Keine Einladung heißt „noch nicht eingeladen“. Wie oft versendet wurde, zählt der Versandzähler. Festgelegt von `/architecture` PROJ-3. | die Verwalter des eigenen Bildungsträgers lesen · geschrieben wird nur vom Server beim Versand, über Datenbankfunktionen, die nur der Server-Schlüssel aufrufen darf |

### Nur für die eigenständige Lizenzzentrale (wandert nicht in die Plattform)

Diese Entitäten gehören zum eigenen Login und zu den Bremsen der Lizenzzentrale. In der Plattform übernehmen deren Login und deren eigene Schutzmaßnahmen diese Aufgabe. Sie liegen im Schema `private`, das über die Daten-API nicht erreichbar ist, und tragen im Namen `license_center_`, damit sie dort nicht mit gleichartigen Objekten kollidieren (die Plattform hat z. B. schon `private.login_attempts`). Festgelegt von `/architecture` PROJ-1.

| Entität | Was sie darstellt | Gehört / sichtbar für |
|---------|-------------------|-----------------------|
| Login-Versuch (`license_center_login_attempts`) | ein Anmeldeversuch, der bis zur Passwortprüfung kam: E-Mail-Adresse (auch ohne Konto), IP-Adresse, Zeitpunkt, Ergebnis | niemand über die App · nur der Server über eigene Datenbankfunktionen · gelöscht nach spätestens 24 Stunden oder mit dem Konto |
| Login-Sperre (`license_center_login_lockouts`) | aktuelle oder letzte Sperre und Zählbeginn pro E-Mail-Adresse bzw. IP-Adresse | wie oben · gelöscht, sobald sie keine Wirkung mehr hat |
| Registrierungsversuch (`license_center_registration_attempts`) | eine Registrierung, die bis zu Supabase kam: IP-Adresse, Zeitpunkt, Ergebnis (keine E-Mail-Adresse) | wie oben · gelöscht nach spätestens 24 Stunden |
| Versandzähler (`license_center_invitation_sends`) | eine laufende oder vom E-Mail-Dienst angenommene Versendung einer Einladung: Bildungsträger, Lizenz (wird beim Entziehen geleert), Zeitpunkt, Stand (keine Adresse). Grundlage der Versandgrenzen (3 pro Lizenz, 30 pro Träger in 24 Stunden). Festgelegt von `/architecture` PROJ-3. | wie oben · gelöscht nach 24 Stunden oder mit dem Träger |

## Beziehungen

- Ein Konto gehört über seine Mitgliedschaft zu **genau einem** Bildungsträger. Ein Bildungsträger hat heute genau einen Verwalter. Die Mitgliedschaft erlaubt später mehrere, ohne Umbau.
- Bei der Registrierung entstehen Bildungsträger und Mitgliedschaft gemeinsam. **Das Kontingent setzt die Datenbank** (Startwert 5), nie Daten, die der Nutzer bei der Registrierung mitschickt. Rechte kommen aus der Mitgliedschaft, nie aus dem Anmelde-Token.
- Ein Bildungsträger hat viele Lizenzen, aber **höchstens so viele, wie sein Kontingent erlaubt**. Das prüft die Datenbank beim Anlegen, auch bei gleichzeitigen Anfragen, nicht nur die Oberfläche. Senkt der Anbieter das Kontingent unter die Zahl der vergebenen Lizenzen, bleiben diese bestehen; neue gibt es erst wieder, wenn eine frei ist (PROJ-2).
- „Frei“ ist keine eigene Zeile, sondern wird berechnet: Kontingent minus vergebene Lizenzen, mindestens 0.
- Dieselbe E-Mail-Adresse hat **pro Bildungsträger höchstens eine** Lizenz, unabhängig von Groß- und Kleinschreibung. Zwei verschiedene Bildungsträger dürfen dieselbe Person einladen, und keiner erfährt vom anderen.
- Eine Lizenz hat höchstens eine Einladung, die den Stand des letzten Versands zeigt.
- **Entziehen löscht die Lizenz samt Einladung.** Damit ist sie sofort wieder frei, und es bleiben keine Teilnehmer-Adressen liegen, die niemand mehr braucht (Datensparsamkeit).
- Jede Zeile in `training_provider_members`, `licenses` und `license_invitations` gehört zu genau einem Bildungsträger. Row Level Security gibt Verwaltern nur die Zeilen ihres eigenen Trägers.
- **Löschen hängt an Konto und Träger (PROJ-1 AC-12):** Wird ein Konto gelöscht, fällt seine Mitgliedschaft weg. Geht dabei der letzte Verwalter eines Trägers, wird der Träger mitgelöscht, und mit ihm alles, was ihm gehört. Deshalb hängen `licenses` und `license_invitations` per Löschkaskade am Bildungsträger. Löscht der Anbieter nur den Träger, bleibt das Konto ohne Zuordnung.
- Login-Versuche und Login-Sperren einer E-Mail-Adresse werden mit dem Konto dieser Adresse gelöscht. Einen Verweis von ihnen auf das Konto gibt es nicht, sie hängen nur an der Adresse.
- **Versandzähler überleben das Entziehen (PROJ-3 AC-8, EC-6):** Wird eine Lizenz entzogen, verliert ihr Versandzähler nur den Verweis auf sie und zählt bis zu 24 Stunden weiter für die Grenze des Trägers. Die Grenze pro Lizenz beginnt bei einer neuen Lizenz bei null. Mit dem Träger werden die Zähler sofort gelöscht.

### Später (Andockpunkte, nicht jetzt)

- Lizenz → Lernkonto (`profiles`) und Kursbelegung (`enrollments`) der Plattform. Der Verweis kommt als zusätzliches, optionales Feld an die Lizenz, in der Plattform wie bei `enrollments` als `user_id`. Am Rest der Lizenz ändert sich dafür nichts.
- Kontingent pro Kurs statt pro Bildungsträger, sobald es mehr als einen Kurs gibt.
- **Lizenzprotokoll:** wer wann welche Lizenz bekommen und verloren hat. Es wird gebraucht, sobald die Regel gegen die Weitergabe von Lizenzen kommt (siehe `docs/PRD.md` → Später). Dann ändert sich auch „Entziehen löscht die Lizenz“: Eine genutzte Lizenz fällt nicht mehr ins Kontingent zurück, oder Lizenzen gelten zeitlich begrenzt.

## Diagramm

```
Konto (Supabase Auth)
 └─ Mitgliedschaft (Rolle: Verwalter)
      └─ Bildungsträger (Name, Kontingent = 5)
           └─ Lizenz (Teilnehmer-E-Mail)  … höchstens Kontingent viele
                └─ Einladung (wird versendet / versendet / fehlgeschlagen, letzter Versuch)

Nur Lizenzzentrale, Schema private, ohne Verweis auf ein Konto:
 Login-Versuch · Login-Sperre · Registrierungsversuch   … höchstens 24 Stunden
 Versandzähler (Träger, Lizenz bis zum Entziehen)        … 24 Stunden
```

---

_Dies ist ein lebendes Dokument. Wenn `/architecture` ein Feature entwirft, das eine Entität einführt oder ändert, aktualisiert es zuerst diese Karte, damit spätere Features gegen ein genaues Bild bauen._
