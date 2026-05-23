# Clipit°

A lightweight, self-hosted clipboard & link-sharing PWA. Save URLs and snippets from any device and access them instantly from anywhere.

## Features

- 📋 **Save & sync** — store links and text snippets via a simple PHP backend
- 🔗 **Smart links** — detects URLs and renders a one-click open button
- 🔐 **Passkey auth** — simple passkey login; session persists in `localStorage` for one week
- 📤 **Web Share Target** — share URLs and text directly into Clipit from any app on your device
- 🌙 **Dark / light theme** — toggle with a button; preference saved to `localStorage`
- 📱 **PWA** — installable on mobile and desktop, works offline (cached assets)
- ⚡ **Minimal footprint** — zero runtime dependencies, Vite-built

## Tech Stack

| Layer    | Technology            |
|----------|-----------------------|
| Frontend | Vanilla JS + Vite     |
| Styles   | CSS (custom, no framework) |
| Backend  | PHP (`api.php`)       |
| Hosting  | Vercel (with `vercel.json` rewrites) |
| Font     | [Space Grotesk](https://fonts.google.com/specimen/Space+Grotesk) via Google Fonts |

## Getting Started

### Prerequisites

- Node.js ≥ 22
- A PHP-capable server (for the backend API)

### Development

```bash
npm install
npm run dev
```

The Vite dev server proxies `/api.php` requests to the backend configured in `vite.config.js`.

### Production Build

```bash
npm run build
```

Output is placed in `dist/`. Deploy the contents along with `public/api.php` and `public/env.php` to your server.

### Environment / Backend Config

Copy `public/env-sample.php` to `public/env.php` and fill in your database or storage credentials.

## Project Structure

```
├── index.html          # App shell
├── public/
│   ├── api.php         # REST endpoint (GET list / POST save / DELETE)
│   ├── env.php         # Local environment config (gitignored)
│   ├── env-sample.php  # Config template
│   ├── sw.js           # Service Worker (caching + share target routing)
│   └── manifest.json   # PWA manifest (includes share_target)
└── src/
    ├── main.js         # App logic
    ├── style.css       # Styles
    └── api/
        └── link.js     # API helper
```

## Web Share Target

When installed as a PWA, Clipit registers as a share target. Sharing a URL or text from any app will open Clipit and automatically save the shared content. If you aren't logged in yet, the shared text is held in `sessionStorage` and saved immediately after a successful login.

The share target is configured in `manifest.json`:

```json
"share_target": {
  "action": "/",
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
