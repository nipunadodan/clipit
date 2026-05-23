# Clipit°

A lightweight, self-hosted clipboard & link-sharing PWA. Save URLs and snippets from any device and access them instantly from anywhere.

## Features

- 📋 **Save & sync** — store links and text snippets via a simple PHP + MySQL backend
- 🔗 **Smart links** — detects URLs and renders a one-click open button
- 📌 **Pin items** — pin entries so they survive "Clear All" and the 5-item auto-prune limit
- 📤 **Web Share Target** — share URLs and text directly into Clipit from any app; a confirmation panel lets you pick exactly which fields (title / text / url) to save. Android Chrome's `"Title" https://…` format is parsed automatically.
- 🌙 **Dark / light theme** — toggle with a button; preference saved to `localStorage`
- 📱 **PWA** — installable on mobile and desktop, works offline (cached assets via Service Worker)
- ⚡ **Minimal footprint** — zero runtime dependencies, Vite-built

## Tech Stack

| Layer    | Technology                              |
|----------|-----------------------------------------|
| Frontend | Vanilla JS + Vite                       |
| Styles   | CSS (custom, no framework)              |
| Backend  | PHP + MySQLi (`api.php`)                |
| CI/CD    | GitHub Actions — build, version bump, FTP deploy |
| Font     | [Space Grotesk](https://fonts.google.com/specimen/Space+Grotesk) via Google Fonts |

## Getting Started

### Prerequisites

- Node.js ≥ 22
- A PHP-capable web server with MySQL

### Development

```bash
npm install
npm run dev
```


### Production Build

```bash
npm run build
```

Output is placed in `dist/`. Deploy the contents to your server. The table is created automatically on first request; the `pinned` column is added via a migration check if you're upgrading an existing install.

### Environment / Backend Config

Copy `public/env-sample.php` to `public/env.php` and fill in your database credentials. This file is gitignored and never deployed automatically.

## Project Structure

```
├── index.html              # App shell
├── public/
│   ├── api.php             # REST endpoint — GET / POST / DELETE / PATCH
│   ├── env.php             # Local environment config (gitignored)
│   ├── env-sample.php      # Config template
│   ├── sw.js               # Service Worker (caching + share-target navigation)
│   ├── manifest.json       # PWA manifest (icons, share_target, scope)
│   ├── icon.svg            # App icon (source)
│   ├── icon-192.png        # PWA icon 192 × 192
│   └── icon-512.png        # PWA icon 512 × 512
└── src/
    ├── main.js             # App logic
    └── style.css           # Styles
```

## API

| Method   | Body / Params              | Description                              |
|----------|----------------------------|------------------------------------------|
| `GET`    | —                          | Return all entries (pinned first)        |
| `POST`   | `{ passkey }`              | Authenticate                             |
| `POST`   | `{ text }`                 | Save a new entry; prunes unpinned to 5   |
| `DELETE` | `{ id }`                   | Delete a single entry                    |
| `DELETE` | —                          | Delete all **unpinned** entries          |
| `PATCH`  | `{ id, pinned }`           | Pin or unpin an entry                    |

Rate limiting is file-based (no extra DB table): 60 GET / 10 POST / 30 PATCH requests per IP per 60 s.

## Pinning

Pinned items are shown at the top of the list and are exempt from:
- the 5-item auto-prune that runs on every new save
- the "Clear All" action (which only deletes unpinned rows)

## Web Share Target

When installed as a PWA, Clipit registers as a share target. Sharing from any app opens Clipit and shows a confirmation panel where you can select which fields to save (title, text, url). If you aren't logged in, the share params are held in `sessionStorage` and the panel is shown immediately after login.

Android Chrome packs title and URL together as `"Title" https://…` in the `text` param — Clipit parses this automatically and surfaces them as separate selectable fields.

The share target is configured in `manifest.json`:

```json
"share_target": {
  "action": "./",
  "method": "GET",
  "params": {
    "title": "title",
    "text": "text",
    "url": "url"
  }
}
```

## License

MIT — made with ❤️ by [Nipuna Dodantenna](https://nipunadodan.com)
