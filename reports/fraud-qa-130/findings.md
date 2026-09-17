# Findings and recommended rule changes

This review concerns the frozen runtime in `snapshot/`, evaluated against 130 synthetic messages with expectations authored before execution. See [all classifications](report.md) and [machine-readable evidence](results.json). No production rules or thresholds were changed during this QA evaluation. Synthetic fixtures contain invented messages, not captured user conversations.

## Results

The inline catalog scorer correctly classified 64/130 messages (49.2%): 37 green, 10 yellow, and 17 red. There were 17 false positives, 32 suspicious/high-risk messages incorrectly classified green, and another 17 high-risk messages classified yellow. Thus 29 of the 46 expected-red messages did not receive red.

The normalized legacy scoring path used for flag results classified 98/130 correctly (75.4%), with 5 false positives, 26 green misses, and one red-to-yellow downgrade. These are isolated message contributions, not a simulation of persisted conversation history. Inline and flag classifications disagreed on 49 messages. Raw preview scoring disagreed with normalized flag scoring on one message.

## Overly aggressive rules

- **Negated safety advice:** `legitimate-11`, “Never share your password or verification code with a buyer,” becomes red/100. Credential matching ignores “Never”; the generic word “verification” also activates fake-support evidence and a combination bonus. `emojis-03` and `mixedCase-03` exhibit the same problem. `legitimate-12` warns against AnyDesk but becomes yellow/35.
- **Quoted and design content:** `legitimate-16` quotes “send your password” as a line to remove from a fictional script, but becomes red/60. `legitimateExternalContact-04` requests a fictional WhatsApp button label and becomes yellow/50.
- **Generic keywords accumulate:** `legitimateExternalContact-09`, describing a newsletter's support email and unsubscribe link, becomes yellow/30. `multiSentence-02` explicitly says to avoid Telegram and stay on Fiverr, yet becomes red/75 through keyword categories and payment/contact combination bonuses.
- **Payment and URL context lacks intent:** `legitimatePayment-02`, asking to use the Fiverr order page for payment, becomes yellow/40. `links-02`, an official Fiverr payment-help URL, becomes yellow/50. `links-03`, GitHub login-security documentation, becomes yellow/55. Nearby payment/login words raise risk even when the text requests no payment or credentials.

## Weak rules and missing patterns

- **Recognized contact requests remain green:** `suspicious-04` requests a phone number and scores 25; `suspicious-09` asks to email the next draft and also scores 25. Both fall below the inline yellow boundary of 30. This is a mismatch between contextual evidence and the intended classification, not evidence that every threshold should be lowered.
- **Contact phrasing is incomplete:** requests to message an assistant on WhatsApp, join Discord, chat on Skype, or DM on Instagram remain green (`suspicious-05/06/07/10`). Existing keyword matches do not adequately recognize the requested action and destination.
- **Severe actions are underweighted or poorly composed:** explicit remote access (`highRisk-05`) scores yellow/35, verification fees (`highRisk-06`) yellow/35, and card/CVV collection to receive earnings (`highRisk-03`) yellow/40. Contextual credential, fee, gift-card, crypto-payment, and remote-control requests need stronger action-specific treatment.
- **Obfuscated tokens:** the unusual-spelling group has only 2/10 correct; its eight risky cases are green. Missing coverage includes `passw0rd`, spaced OTP letters, zero-width splitting, `Wh4tsApp`, misspelled verification, and bitcoin/wallet variants.
- **Evidence across sentences:** the multi-sentence group has only 2/10 correct. `multiSentence-05` mentions an OTP, then asks for “it” to unlock payment, but scores green/20. `multiSentence-06` separates password context from “share it” and also scores green/20. `multiSentence-07` separates a mandatory activation fee from the payment instruction and scores green/10.
- **Normalization removes relevant evidence:** `highRisk-13`, “Before I order, send $20 to prove you are a real freelancer. I will refund it later,” scores red/75 through raw preview analysis but green/0 through normalized flag analysis. Normalization strips `$`, defeating the legacy advance-fee currency pattern.
- **Case and emojis are not the main failure:** normalization already lowercases. Several failures in these groups reproduce negation and scoring problems rather than failures to process capitalization or emoji characters.

## Recommended implementation order

1. **Unify the scoring contract:** `content-script.js`, `analyzer.js`, `scorer.js`, and flag/alert consumers should use one canonical result and severity mapping. Review the 49 disagreements individually before choosing behavior. Preserve useful strong matches while removing unsupported matches; do not simply take the highest result from both engines, which would retain false positives.
2. **Preserve meaning during normalization:** in `normalizer.js`, retain currency, sentence boundaries, and offsets back to original text. Add bounded token normalization for sensitive terms and known obfuscations. Protect URL/email parsing; avoid unrestricted fuzzy matching over ordinary words.
3. **Match request intent and clause context:** in `patternMatcher.js` and the catalog, distinguish an actual request from a warning, quotation, or design example. Scope negation to the relevant clause rather than suppressing an entire message containing “do not.” A safety sentence must not hide a separate malicious request.
4. **Require substantive evidence for combinations:** in `scorer.js`, require contextual request evidence for contact/payment and support/credential bonuses. Generic “support,” “official,” or “verification” keywords alone should not establish impersonation. Define action-specific severity for credential collection, activation fees, redemption codes, and remote access; retain benign educational and design controls.
5. **Expand bounded context matching:** add action/destination variants and short, within-message references such as “OTP ... send it.” Require compatible clauses and account for negation/quotation. No AI is needed. Multi-message aggregation should be tested separately without persisting message text or sender identities.
6. **Refine URL intent:** in `urlDetector.js`/`link-scanner.js`, distinguish documentation about login/payment from a request to enter secrets or transfer money. Do not globally whitelist a trusted host. Add separate DOM tests for hidden anchor destinations and visible-text/destination mismatches.
7. **Adjudicate caution policy before tuning:** `links-05` (shortened brief URL) and `links-06` (HTTP form) are labeled yellow by this corpus's cautious policy, but are not inherently scams. Agree on these boundaries before altering their scores. Keep this corpus as regression coverage and add an independently labeled holdout set before claiming improved accuracy.

## Verification and limits

The runner validates all ten requested group counts, the three required fields, labels, and uniqueness. It records source/dataset SHA-256 hashes and checks for changes during evaluation. `node tests/fraud-qa-130.cjs --snapshot` replays the recorded runtime without modifying the baseline report.

This tests message-level classification after the catalog is available. It does not establish live Fiverr DOM extraction recall, loading-state behavior, deleted-message detection, cache correctness, or aggregate conversation risk. Those require separate browser integration tests. Expected indicators are minimum semantic expectations; additional categories are recorded for review and are not automatically false positives. The original root dataset was left intact because it contains multiple appended top-level JSON documents; the independent fixture is valid JSON.
