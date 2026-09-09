"use client";

import { useId, useState } from "react";
import { analyzeMessage, type ScamAnalysis } from "@/lib/scam-analyzer";
import { RiskMeter } from "./risk-meter";

export type TesterSample = { id: string; label: string; text: string };
const defaultMessage =
  "Enter your debit card information on this verification page so your Fiverr payment can be released.";

export function MessageTester({
  samples,
}: {
  samples: readonly TesterSample[];
}) {
  const inputId = useId();
  const [message, setMessage] = useState(defaultMessage);
  const [includeAI, setIncludeAI] = useState(true);
  const [analysis, setAnalysis] = useState<ScamAnalysis>(() =>
    analyzeMessage(defaultMessage),
  );

  function runAnalysis(nextMessage = message, nextIncludeAI = includeAI) {
    setAnalysis(analyzeMessage(nextMessage, nextIncludeAI));
  }

  return (
    <div className="fsd-tester">
      <section className="fsd-card">
        <div className="fsd-card__body fsd-stack">
          <div className="fsd-field">
            <label className="fsd-label" htmlFor={inputId}>
              Message
            </label>
            <textarea
              className="fsd-textarea"
              id={inputId}
              placeholder="Paste a Fiverr message here"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
            />
          </div>
          <div className="fsd-samples">
            {samples.map((sample) => (
              <button
                className="fsd-btn"
                key={sample.id}
                type="button"
                onClick={() => {
                  setMessage(sample.text);
                  runAnalysis(sample.text);
                }}
              >
                {sample.label}
              </button>
            ))}
          </div>
          <div className="fsd-row">
            <label className="fsd-row fsd-small fsd-muted" style={{ gap: 8 }}>
              <span className="fsd-switch">
                <input
                  type="checkbox"
                  name="includeAI"
                  checked={includeAI}
                  onChange={(event) => {
                    setIncludeAI(event.target.checked);
                    runAnalysis(message, event.target.checked);
                  }}
                />
                <span className="fsd-switch__track" />
              </span>
              Include AI analysis
            </label>
            <span className="fsd-grow" />
            <button
              className="fsd-btn fsd-btn--primary"
              type="button"
              disabled={!message.trim()}
              onClick={() => runAnalysis()}
            >
              Analyze
            </button>
          </div>
          <p className="fsd-p fsd-small">
            Analysis runs locally. Messages stay on this page and are not saved
            or sent.
          </p>
        </div>
      </section>

      <p className="fsd-p fsd-small">
        {analysis.signals.length
          ? "Review these signals before replying. The score is an estimate, not proof of fraud."
          : "No known scam patterns were found. Keep payments and communication on Fiverr."}
      </p>
      <RiskMeter score={analysis.score} risk={analysis.risk} />
      <div className="fsd-tester__grid">
        <section className="fsd-card">
          <div className="fsd-card__head">
            <h2 className="fsd-h2">Why this was flagged</h2>
            <span className="fsd-small fsd-muted">
              {analysis.signals.length} signals
            </span>
          </div>
          <div className="fsd-card__body">
            {analysis.signals.length ? (
              <ul className="fsd-signals">
                {analysis.signals.map((signal) => (
                  <li
                    className="fsd-signal"
                    data-severity={analysis.risk}
                    key={signal.title}
                  >
                    <div>
                      <strong className="fsd-signal__title">
                        {signal.title}
                      </strong>
                      <div className="fsd-signal__text">{signal.detail}</div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="fsd-p">
                This message does not match the common patterns checked by the
                local scanner.
              </p>
            )}
          </div>
        </section>
        <section className="fsd-card">
          <div className="fsd-card__head">
            <h2 className="fsd-h2">Recommended actions</h2>
          </div>
          <div className="fsd-card__body">
            <ul className="fsd-actions">
              <li>
                {analysis.signals.length
                  ? "Pause before clicking links or sharing information."
                  : "Keep payment and communication on Fiverr."}
              </li>
              <li>Verify important requests from your Fiverr dashboard.</li>
              <li>Report messages that ask for sensitive information.</li>
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}
