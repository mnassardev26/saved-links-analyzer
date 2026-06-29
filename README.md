# Saved Links Analyzer

Local-first Chrome extension for scanning and organizing Facebook saved links.

## Features

- Scan visible saved items from `facebook.com/saved`.
- Auto-scroll to collect larger saved-link lists.
- Filter, favorite, categorize, and search saved items locally.
- Export filtered or selected results to CSV.
- Remove saved items from Facebook when the item is visible on the current saved page.

## Development

Use Node 20+ and npm 10+.

```bash
npm install
npm run dev
```

Load the generated Plasmo development extension in Chrome, open `https://www.facebook.com/saved/`, then open the side panel.

## Verification

```bash
npm run typecheck
npm test
npm run build
```

## Production packaging

```bash
npm ci
npm run verify
```

The Chrome Web Store upload artifact is generated at `build/chrome-mv3-prod.zip`. Release logo and screenshot source files are kept in `going-live/`.

## Permissions

- `storage`: stores scanned saved-link metadata locally in Chrome.
- `sidePanel`: opens the organizer in Chrome's side panel.
- `https://www.facebook.com/*`: scans and updates saved items on Facebook Saved pages.

## Privacy

Version 0.1.0 stores saved-link data locally in Chrome extension storage. It does not send saved items to a backend or third-party AI service.
