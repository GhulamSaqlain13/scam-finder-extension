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
- The rule engine returns deduplicated `categories` and `matches` with stable
  `ruleId`, `category`, `score`, `explanation`, and `action` fields, alongside
  existing scores and signals. Categories cover PAYMENT_SCAM, PHISHING,
  ACCOUNT_VERIFICATION, EXTERNAL_COMMUNICATION, PERSONAL_INFORMATION, MALWARE,
  FAKE_SUPPORT, and the supporting COERCION signal. These are warning categories,
  not verified accusations. Matching uses local patterns, not AI.
- extension/content-script.js — rendered-message monitoring and isolated alerts.
- extension/message-detector.js — message extraction and targeted MutationObserver batches.
- extension/message-extractor.js — standard in-memory message objects for analysis.
- extension/link-scanner.js — local URL normalization and structural risk checks.
- extension/sensitive-information.js — type-specific request and draft indicators.
- extension/draft-guard.js — local warnings for recognizable secrets in inbox editors.
- extension/background.js — result persistence.
- extension/options.* — settings, optional history, export, and deletion.
- extension/tester.* — local message tester.

The extension checks rendered messages in open Fiverr tabs, not unopened
conversations. The detector discovers existing messages on start, then processes
affected subtrees and message ancestors in 150 ms batches. It handles delayed
insertion, text and link edits, nested bubbles, visibility changes, and removal.
It ignores its own warning elements and clears pending work when stopped.
Message extraction is local. HIGH and CRITICAL incoming messages are now retained
in the evidence vault, as explicitly requested in Module 10.
The extractor returns `id`, `sender`, `text`, `links` (absolute URL strings),
`timestamp`, `detectedAt`, and `conversationId`. Extra `linkMetadata` retains
displayed link text for destination checks. Missing metadata is null; timestamps
are ISO dates with explicit timezones. Native Fiverr IDs are preferred. When
Fiverr does not expose an ID, the extractor creates a deterministic `msg_...`
fingerprint from conversation ID, sender, message text, timestamp, and links.
Without native metadata, edited text becomes a new fingerprint. Risk summaries remain
metadata-only; qualifying evidence is sent to the extension worker for IndexedDB.
Selectors are heuristic and still need live Fiverr verification.
The popup reports the active tab's detected incoming messages separately from
the global protection setting. Empty inboxes show "No messages detected";
other pages show "Open a Fiverr conversation", and connection failures are
reported explicitly. Counts are transient and are not saved.
Authenticated live selector validation remains pending: the public inbox URL
redirects to login. Browser tests use synthetic layouts, not captured Fiverr DOM.
Risk bands are SAFE (0-20), LOW (21-40), SUSPICIOUS (41-60), HIGH (61-80),
and CRITICAL (81-100). SAFE does not guarantee safety; scores are rule points,
not probabilities. `fsdScoreIndicators` sums unique rule IDs and returns `score`
(capped at 100), `rawScore`, `risk`, and an `indicators` breakdown with each
rule's `points`. The existing rule weights are retained. Ordinary external URLs
alone add no points. The message tester shows each indicator's contribution.
Alerts include actions for each detected signal.
Warnings start compact with category and signal summaries. View details expands
the explanations and actions; Dismiss hides the warning until its message or
threshold changes (or monitoring restarts). Conversation rows show a small
risk-colored dot with an accessible label and tooltip. The popup
and inline warnings, tester, and history also show plain-language category
explanations (for example, "Possible payment scam" or "Sensitive data request").
Labels are derived from fixed signals, including existing saved results, and
do not claim that a scam has been proven. The popup
separates the latest checked message from the highest-risk result seen across
tabs since results were cleared. Both retain metadata only, even without history;
Delete saved results clears both. Numeric rule points remain in settings and exports.
Conversation flags retain risk in tab memory for 30 minutes after equally strong
evidence was last visible. Weaker or missing evidence does not renew that risk;
expiration rechecks current previews and messages even without a page update.
Reused inbox rows use the new conversation's state. Rows without an identifiable
conversation use only current evidence, with no retained score.
Message text and sender identities in HIGH/CRITICAL evidence are saved locally,
never sent to a server. This supersedes the earlier metadata-only policy. The web analyzer
and native analyzer are currently separate implementations.

The extension also checks rendered link destinations locally for displayed-host
mismatches, Fiverr-like hostnames outside fiverr.com, and URL user information.
External links alone do not trigger a warning. Redirects are not followed and
no reputation service is contacted. Hostname details appear only in live inline
warnings; risk summaries contain fixed signals, while evidence retains message links.
The standalone link scanner accepts URL strings or link metadata plus plain text.
It returns normalized destinations, an external-host flag, per-link indicators
and scores. Fiverr-like labels in outside domains score 60; IP addresses add 20,
known shorteners add 15, and HTTP adds 10. Ordinary external HTTPS links add zero.
Shorteners use a small bundled list, not reputation intelligence. No redirects,
DNS lookups, or backend calls occur. HIGH/CRITICAL evidence retains extracted URLs.
Sensitive request explanations distinguish OTPs, passwords, cards, CVVs, bank
accounts, API keys, GitHub tokens, AWS keys, and private keys. Inbox textareas
and contenteditable fields also show local warnings for labeled secret values
and private-key blocks while protection runs. Drafts never enter result storage
or runtime messages. Warnings do not block sending, and unlabeled secrets or
unsupported editor layouts may not be detected.

## Local conversation history

The worker owns IndexedDB `fsd-evidence`; `chrome.storage.local` is used only for
small settings and popup summaries. The database contains `conversations`,
`messages`, `riskEvents`, and `evidence`. Observed Fiverr messages are recorded
in `messages` with messageId, conversationId, sender, senderType, text, links,
capturedAt, lastSeenAt, riskScore, riskLevel, and categories. Conversation
summaries track participants, message IDs, firstObservedAt, lastObservedAt, the
highest risk score, and categories. Risk events store message-level security
events for LOW or higher detections. The `evidence` store keeps the HIGH/CRITICAL
records shown in Settings.

The evidence store has a capturedAt index and pages of 25 records in Settings.
Fields are id, conversationId, sender, message, links, riskScore, categories,
and capturedAt. Evidence captures occur at scores 61-100 while protection runs,
independently of the optional metadata history setting.
Identical snapshots are deduplicated; edited messages can produce new snapshots.
Without native IDs, identical text from the same sender/conversation is collapsed.
Records remain until deleted or browser storage is cleared; there is no automatic
expiry or cloud backup. IndexedDB remains subject to browser storage limits.
Use Delete evidence, Delete all evidence, or Delete saved results to remove data.
Content scripts may submit evidence but cannot read or delete the vault.
Drafts and outgoing messages are excluded. The database is local, not encrypted
by the extension. Failed captures are reported in the vault's status area.
When a previously captured HIGH or CRITICAL message is no longer visible in the
same open inbox conversation, the content script asks the worker for a count-only
vault check and shows "Previous suspicious message detected." This does not prove
Fiverr deleted the message; virtualized history, loading, filtering, or navigation
can also remove DOM nodes. The extension cannot recover messages it never saw.
Native message IDs and generated `msg_...` fingerprints can be checked across
page reloads. Legacy `local_...` IDs from older builds are only reliable within
the current tab session after that message was observed.
This is the conversation monitoring engine: capture observed message state,
analyze risk, remember it locally, then compare the current visible conversation
against remembered suspicious messages.

## Recovery record

The Next.js source was recovered from session edit history and newer VS Code local
history after an overly broad cleanup. Recovery retained the working extension.
The recovery/ directory contains the reconstruction report and a source backup.
Only unused legacy HTML was intended for cleanup; do not remove source directories.
The synthetic dataset is retained for development and is not a trained model.
