# Admin-Backend — Paititi Retreats

Kleines Admin-Panel, mit dem Texte und Bilder der Website ohne Code-Änderungen
gepflegt werden können.

## Wie es funktioniert

- Die Website bleibt statisches HTML (`index.html`, `booking.html`, `privacy-policy.html`).
  Ohne Server funktioniert sie weiterhin wie bisher, nur ohne die Admin-Änderungen.
- Ein kleiner Node.js-Server (`server/`) liefert die Seiten aus und setzt dabei die
  im Admin-Panel geänderten Texte und Bilder ein.
- Überschreibungen liegen in `data/content.json`, hochgeladene Bilder in `uploads/`.
  Diese beiden Orte sind die einzigen Daten, die gesichert werden müssen.
- Admin-Panel: `/admin` · Login: `/admin/login`

## Einrichten

```bash
npm install                      # einmalig
cp .env.example .env             # Windows: copy .env.example .env
npm run set-password             # fragt das Admin-Passwort ab und schreibt den Hash in .env
npm start                        # http://localhost:3000  bzw.  /admin
```

Passwort ändern: erneut `npm run set-password` ausführen und den Server neu starten.
Das Passwort selbst wird nirgends gespeichert, nur ein scrypt-Hash in `.env`.

## Texte ändern

1. Unter `/admin` anmelden → **Texte**.
2. Die Texte sind nach Website-Bereich gruppiert (Hero, Über uns, Programm, FAQ, …).
   Der Schlüssel neben jedem Feld (z. B. `program.day3.title`) sagt, wo der Text sitzt.
3. Text ändern → unten rechts **Speichern**. Die Änderung ist sofort live.
4. **Original wiederherstellen** setzt den Text auf den Stand aus der HTML-Datei zurück.

Erlaubte Formatierung (alles andere wird als Text angezeigt, HTML wird nie ausgeführt):

| Eingabe                      | Ergebnis         |
|------------------------------|------------------|
| Enter                        | Zeilenumbruch    |
| `*kursiv*`                   | *kursiv*         |
| `**fett**`                   | **fett**         |
| `~~durchgestrichen~~`        | ~~durchgestrichen~~ |
| `[Linktext](https://…)`      | Link             |

## Bilder ändern

1. `/admin` → **Bilder**. Jedes Bild zeigt, wo es auf der Website steht.
2. **Bild ersetzen** → Datei wählen (JPG, PNG, WEBP, GIF; max. 8 MB). Sofort live.
3. **Original** stellt das ursprüngliche Bild wieder her und löscht den Upload.

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

## Produktivbetrieb

Voraussetzung: ein Server mit Node.js ≥ 20 (kleiner VPS, Hetzner, Render, Railway,
Fly.io o. ä.). GitHub Pages reicht nicht, da dort kein Server läuft.

1. Repository auf den Server holen, `npm install --omit=dev`.
2. `.env` anlegen: `NODE_ENV=production`, `PORT=3000`, Passwort per `npm run set-password`.
   Bei Betrieb hinter einem Reverse-Proxy zusätzlich `TRUST_PROXY=1`.
3. HTTPS ist Pflicht: mit `NODE_ENV=production` bekommt das Session-Cookie das
   `Secure`-Flag und funktioniert nur über HTTPS. Empfohlen: Caddy oder nginx als
   Reverse-Proxy mit Let's-Encrypt-Zertifikat vor `localhost:3000`.
4. Prozess dauerhaft laufen lassen, z. B. als systemd-Dienst oder mit `pm2 start server/server.js`.
5. `data/content.json` und `uploads/` regelmäßig sichern. Bei Hostern mit flüchtigem
   Dateisystem (z. B. Render Free) muss dafür ein persistentes Volume eingebunden werden.

Minimales Caddyfile-Beispiel:

```
retreat.example.com {
    reverse_proxy localhost:3000
}
```

## Sicherheit (Kurzfassung)

- Nur `/`, die drei HTML-Seiten und die in `server/server.js` unter `PUBLIC_DIRS`
  gelisteten Ordner werden öffentlich ausgeliefert. `.env`, `server/`, `data/`,
  `node_modules/` sind nicht erreichbar.
- Ein Admin-Account, Passwort als scrypt-Hash, Session-Token nur im Server-Speicher,
  Cookie `HttpOnly` + `SameSite=Strict` (+ `Secure` in Produktion), 12 h Gültigkeit.
- Login-Sperre nach 8 Fehlversuchen pro IP für 15 Minuten.
- Alle Eingaben werden serverseitig geprüft; Texte werden beim Ausliefern HTML-escaped
  (kein XSS). Uploads werden anhand der Dateisignatur geprüft, nicht der Dateiendung,
  und unter einem vom Server vergebenen Namen gespeichert.
- Admin-Seiten mit strikter Content-Security-Policy, `noindex`, kein Framing.
- Neustart des Servers beendet alle Sessions (bewusst einfach gehalten).
