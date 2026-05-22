# Clipit°

A lightweight, self-hosted clipboard & link-sharing PWA. Save URLs and snippets from any device and access them instantly from anywhere.

## Features

- 📋 **Save & sync** — store links and text snippets via a simple PHP backend
- 🔗 **Smart links** — detects URLs and renders a one-click open button
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
│   ├── sw.js           # Service Worker
│   └── manifest.json   # PWA manifest
└── src/
    ├── main.js         # App logic
    ├── style.css       # Styles
    └── api/
        └── link.js     # API helper
```

## License

MIT — made with ❤️ by [Nipuna Dodantenna](https://nipunadodan.com)

