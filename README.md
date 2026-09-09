# Scam Finder

This repository contains both the Next.js app and the standalone Manifest V3
browser extension. Keep both sets of useful source files.

## Next.js app

    npm install
    npm run dev

Open http://localhost:3000/scam-finder. Run npm run build for a production build,
npm start to serve it, and npm run lint to check source files.

- app/ — pages, layout, and application CSS.
- components/scam-finder/ — reusable UI components and interactive previews.
- lib/scam-analyzer.ts — the recovered web tester analyzer.
- scam-finder/styles.css and public/scam-finder/styles.css — recovered reference styles.
- next.config.ts, tsconfig.json, postcss.config.mjs, eslint.config.mjs — app configuration.

The component gallery is development-only. Legacy HTML URLs redirect to their
Next.js routes. Unused legacy HTML copies remain removed; useful TSX, TS, CSS,
configuration, and extension source files are preserved.

## Standalone extension

1. Open chrome://extensions or edge://extensions and enable Developer mode.
2. Choose Load unpacked and select this repository folder.
3. Refresh an open Fiverr conversation, open the extension, and press Run protection.
4. Close the popup if desired. Press Stop protection when finished.

Run npm run build:extension to create dist/scam-finder, containing only extension
runtime files. npm run check:extension validates its manifest, scripts, and links.
npm test runs browser fixtures and an installed-extension integration test.
Tests require Playwright Chromium: npx playwright install chromium.

- manifest.json — popup, content scripts, service worker, permissions, and options.
- extension/home.* — Run/Stop popup.
- extension/analyzer.js — shared analyzer for the native tester and content script.
- extension/content-script.js — rendered-message monitoring and isolated alerts.
- extension/background.js — result persistence.
- extension/options.* — settings, optional history, export, and deletion.
- extension/tester.* — local message tester.

The extension checks rendered messages in open Fiverr tabs, not unopened
conversations. Selectors are heuristic and still need live Fiverr verification.
Risk percentages are keyword-pattern scores, not calibrated probabilities.
Message text and sender identities are not saved or transmitted. The web analyzer
and native analyzer are currently separate implementations.

## Recovery record

The Next.js source was recovered from session edit history and newer VS Code local
history after an overly broad cleanup. Recovery retained the working extension.
The recovery/ directory contains the reconstruction report and a source backup.
Only unused legacy HTML was intended for cleanup; do not remove source directories.
The synthetic dataset is retained for development and is not a trained model.
