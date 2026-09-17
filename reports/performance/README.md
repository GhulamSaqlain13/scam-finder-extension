# Extension performance review

## Architecture before and after

Before: body MutationObserver (150 ms batching) and conversation MutationObserver (100 ms batching) both submitted added messages for scanning. Scanning extracted text/links, reused legacy analysis for unchanged elements, but always reran catalog matching. Matching constructed every keyword, phrase, and regex expression anew. Rendering green indicators could feed mutations back into scanning. Removal handling walked every remembered message for every removed subtree. History lookups each read chrome.storage. Popup polling recreated conversation summary elements every second.

After: the body detector owns added/edited message analysis, keeping its existing 150 ms deadline and selectors. The conversation observer retains removal tracking and history notifications. Repeated mutation targets are merged before DOM queries, and all extension alert hosts are excluded. Both legacy and catalog results are reused for unchanged message text, link metadata, message ID, and conversation ID. Catalog expressions compile once per matcher instance. Removal processing visits the removed subtree rather than the entire conversation. Concurrent history lookups share one read, and subsequent reads use an in-memory cache invalidated by storage events and writes. Popup rendering compares its displayed inputs before rebuilding DOM.

## Module changes

| Module | Optimization and behavior safeguards |
|---|---|
| `message-detector.js` | Deduplicate mutation targets before ancestor/descendant queries; ignore `data-fsd-alert` hosts including green indicators. Retain character-data and attribute observation, fallback selectors, removal scans, and the existing non-starving debounce deadline. |
| `content-script.js` | Remove the secondary observer's added-message scan callback; reuse `patternAlerts` for unchanged extracted inputs. Catalog-load refresh still replaces fallback results. Threshold and rendering refresh remain independent of detection. |
| `patternMatcher.js` | Compile literal and catalog regexes when creating the matcher. Preserve match order, matched text, categories, reasons, and combinations. Reset regex state before each execution. The catalog was already loaded once per content-script instance; compiled expressions now share that lifetime. |
| `message-observer.js` | Ignore owned alert mutations, look up remembered messages within removed subtrees, release disconnected elements on root rebind, and restore history methods only if the observer still owns their wrappers. Existing stop behavior disconnects observers, removes popstate listeners, cancels timers, and clears collections. |
| `messageHistory.js` | Share concurrent reads and cache metadata in memory. Invalidate on cross-context local-storage changes and successful writes; rejected reads release their pending promise for retry. Avoid unchanged expiry-cleanup writes. Without a storage event API, retain uncached reads. No new persistent message content is introduced. |
| `home.js` | Skip unchanged status writes and conversation-summary reconstruction. Retain status polling and its existing pagehide timer cleanup so updates remain visible. |

Message extraction still reads changed candidate text and links to detect edits; it does not assume a message ID implies immutable content. Broad fallback selectors and initial/manual full scans remain for Fiverr layout compatibility. AlertUI's existing shadow DOM and interaction listeners remain local to removable alert elements. Draft-guard input/focus listeners already have matching stop cleanup and were preserved. Deleted-message classification and notification semantics were not changed.

The worker's persistent metadata transactions and enabled-state reads were inspected and retained: this patch does not introduce an uncoordinated worker cache across suspension or alter cross-tab write ordering. History writes still use the existing serialized queue and cross-tab read-modify-write semantics; this is not a storage transaction redesign.

## Measured validation

`node tests/performance.cjs` compares the captured pre-change matcher with the optimized matcher using the same current catalog and normalizer. All 130 fixture cases have identical complete match objects and scorer outputs. No rules, weights, thresholds, or normalization behavior were edited.

| Check | Before | After |
|---|---:|---:|
| Regex constructions during 2,600 message matches | 509,600 | 0 |
| Matcher execution in the latest recorded local run | 1,730 ms | 123 ms |
| Storage reads for 100 concurrent history lookups | One per lookup in prior implementation | 1 measured |
| Scan batches for 100 injected green alerts | Previously eligible to trigger scanning | 0 measured |
| Scan batches for 100 message edits | Batched | 1 measured |

Timing is a local microbenchmark, not a claim about overall Fiverr CPU utilization. The zero-allocation assertion concerns regex construction after matcher initialization. Browser tests exercise real MutationObserver behavior in Chromium fixtures, not a production Fiverr session. Current classification weaknesses and different inline/flag severity policies remain outside this performance change.

Run the focused regression with `node tests/performance.cjs`. Standard validation uses `npm run build:extension`, `npm run check:extension`, and `npm test`. Raw measurements are in `measurements.json`; inspected pre-change files are in `before/` and are not extension runtime assets.
