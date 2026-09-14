# Admin-Backend — Paititi Retreats (Cloudflare Pages)

Kleines Admin-Panel, mit dem Texte und Bilder der Website ohne Code-Änderungen
gepflegt werden können. Läuft komplett auf Cloudflare Pages, kein eigener Server.

- Admin-Panel: `https://deine-domain/admin` · Login: `/admin/login`
- Website bleibt statisches HTML. Die Pages Functions in `functions/` setzen beim
  Ausliefern die im Panel geänderten Texte und Bilder ein.
- Speicher: Texte in einem **KV Namespace** (`CONTENT`), Bilder in einem **R2 Bucket** (`UPLOADS`).
  Diese beiden sind die einzigen Daten, die gesichert werden müssen.

## Einmalige Einrichtung im Cloudflare-Dashboard

1. **KV Namespace anlegen:** Storage & Databases → KV → Create namespace, Name z. B. `paititi-content`.
2. **R2 Bucket anlegen:** Storage & Databases → R2 → Create bucket, Name z. B. `paititi-uploads`
   (R2 muss einmalig aktiviert werden, Free-Kontingent reicht).
3. **Bindings setzen:** Workers & Pages → dein Pages-Projekt → Settings → Bindings → Add:
   - Typ *KV namespace*, Variable name **`CONTENT`**, Namespace: der aus Schritt 1
   - Typ *R2 bucket*, Variable name **`UPLOADS`**, Bucket: der aus Schritt 2

   Die Variablennamen müssen exakt `CONTENT` und `UPLOADS` heißen. Für „Production“ setzen
   (und optional für „Preview“).
4. **Secrets setzen:** lokal ausführen

   ```bash
   npm install
   npm run set-password
   ```

   Das Skript fragt das Passwort ab und gibt zwei Zeilen aus:
   `ADMIN_PASSWORD_HASH=…` und `SESSION_SECRET=…`.
   Beide unter Settings → Variables and Secrets als **Secret** anlegen (Name = Teil vor dem `=`,
   Wert = Teil danach). Das Passwort selbst wird nirgends gespeichert.
5. **Build-Einstellungen prüfen:** Settings → Build: Build command leer, Build output directory `/`.
   Die Datei `.node-version` sorgt dafür, dass der Build Node 22 verwendet.
6. **Deployen:** Änderungen committen und pushen. Nach neuen Bindings oder Secrets einmal
   „Retry deployment“ klicken oder erneut pushen, damit sie wirksam werden.

Danach: `https://deine-domain/admin/login` öffnen und mit dem Passwort anmelden.

Passwort ändern: `npm run set-password` erneut ausführen, das neue `ADMIN_PASSWORD_HASH`
im Dashboard aktualisieren, Deployment neu auslösen.

## Texte ändern

1. Unter `/admin` anmelden → **Texte**.
2. Die Texte sind nach Website-Bereich gruppiert (Hero, Über uns, Programm, FAQ, …).
   Der Schlüssel neben jedem Feld (z. B. `program.day3.title`) sagt, wo der Text sitzt.
3. Text ändern → unten rechts **Speichern**. Für dich sofort sichtbar, weltweit innerhalb
   von etwa einer Minute (Cloudflare verteilt KV-Daten mit kurzer Verzögerung).
4. **Original wiederherstellen** setzt den Text auf den Stand aus der HTML-Datei zurück.

Erlaubte Formatierung (alles andere wird als Text angezeigt, HTML wird nie ausgeführt):

| Eingabe                      | Ergebnis            |
|------------------------------|---------------------|
| Enter                        | Zeilenumbruch       |
| `*kursiv*`                   | *kursiv*            |
| `**fett**`                   | **fett**            |
| `~~durchgestrichen~~`        | ~~durchgestrichen~~ |
| `[Linktext](https://…)`      | Link                |

## Bilder ändern

1. `/admin` → **Bilder**. Jedes Bild zeigt, wo es auf der Website steht.
2. **Bild ersetzen** → Datei wählen (JPG, PNG, WEBP, GIF; max. 8 MB). Sofort live.
3. **Original** stellt das ursprüngliche Bild wieder her und löscht den Upload aus R2.

Nicht über das Panel änderbar (bewusst einfach gehalten): die Bilderlisten der
Galerien/Lightbox und Zimmer-Karussells (`js/index.js`, `data-slides` in `index.html`)
sowie die Preise und Zimmerdaten der Buchungsseite in `js/booking.js`.

## Weitere Inhalte editierbar machen

Ein Attribut im HTML genügt, das Panel erkennt es automatisch:

```html
<p data-cms="location.hint">Neuer Text …</p>
<img data-cms-img="hero.background" src="…" alt="…">
```

Regeln:
- Schlüssel = `bereich.feld` (z. B. `faq.q7.question`). Der Bereich bestimmt die
  Gruppierung im Panel; Beschriftungen stehen in `admin/assets/admin.js`
  (`SECTION_LABELS`, `FIELD_WORDS`) und können ergänzt werden.
- Das markierte Element darf kein gleichnamiges Element enthalten
  (also kein `<div data-cms>` mit einem `<div>` darin). `<p>`, `<h1>`–`<h6>`,
  `<span>`, `<li>`, `<a>`, `<td>` sind unproblematisch.
- Enthält das Element HTML (Links, `<br>`, `<strong>`), wird das beim Bearbeiten in
  die Formatierung oben übersetzt. Andere Tags (Icons, verschachtelte Elemente)
  gehen beim Überschreiben verloren, solche Elemente also nicht markieren.
- Neue HTML-Seiten zusätzlich in `functions/_lib/cms.js` unter `PAGES` und in
  `_routes.json` eintragen.

## Lokal testen

```bash
npm install
npm run set-password      # schreibt .dev.vars (nur lokal, nicht im Git)
npm run dev               # http://localhost:3000  und  /admin
```

`npm run dev` startet Cloudflare's lokale Umgebung (wrangler) mit lokalem KV und R2.
Lokale Änderungen im Panel landen nur in `.wrangler/state`, nicht auf der Live-Seite.

## Dateien

```
functions/_middleware.js        setzt Überschreibungen in die HTML-Seiten ein, sperrt private Pfade
functions/_lib/cms.js           Inhaltslogik (Markierungen finden, Markup, Rendering)
functions/_lib/auth.js          Passwort-Hash (PBKDF2), Session-Cookie, Login-Sperre
functions/_lib/store.js         KV-Zugriff und Registry aus den HTML-Seiten
functions/_lib/admin.js         Admin-Seiten und API (/admin/*)
functions/uploads/[[path]].js   liefert hochgeladene Bilder aus R2 aus
admin/                          Oberfläche des Panels (HTML, CSS, JS)
_routes.json                    welche Pfade durch die Functions laufen (Rest = statisch)
scripts/set-password.js         erzeugt Passwort-Hash und Session-Secret
```

## Sicherheit (Kurzfassung)

- Ein Admin-Account. Passwort als PBKDF2-SHA256-Hash (100.000 Iterationen, Cloudflares
  Maximum) nur als Secret im Dashboard, nie im Code oder Git.
- Session: signiertes Cookie (HMAC mit `SESSION_SECRET`), `HttpOnly`, `SameSite=Strict`,
  `Secure`, 12 h gültig. Abmelden löscht das Cookie; ein Wechsel von `SESSION_SECRET`
  macht alle Sessions ungültig.
- Login-Sperre nach 8 Fehlversuchen pro IP für 15 Minuten (Zähler in KV).
- Alle Eingaben werden serverseitig geprüft; Texte werden beim Ausliefern HTML-escaped
  (kein XSS). Uploads werden anhand der Dateisignatur geprüft, nicht der Dateiendung,
  und unter einem vom Server vergebenen Namen in R2 gespeichert.
- Admin-Seiten mit strikter Content-Security-Policy, `noindex`, kein Framing.
- `package.json`, `ADMIN.md`, `CLAUDE.md`, `functions/`, `scripts/` und
  `Retreat structure/` werden nicht öffentlich ausgeliefert (siehe `_routes.json`
  und `functions/_middleware.js`).
