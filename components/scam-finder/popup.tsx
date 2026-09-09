"use client";

import Link from "next/link";
import { Header } from "./header";
import { Feedback, type FeedbackValue } from "./feedback";
import type { RiskLevel } from "./risk-badge";
import { RiskMeter } from "./risk-meter";
import { SignalList, type RiskSignal } from "./signal-list";
import { RecommendedActions } from "./recommended-actions";

export type PopupResult = {
  scanId: string;
  score: number;
  risk: RiskLevel;
  summary: string;
  signals: readonly RiskSignal[];
  categories: readonly string[];
  recommendations: readonly string[];
};

export function Popup({ result, pageUrl, messageCount, onAnalyze, isAnalyzing = false,
  isWatching = false, onFeedbackChange,
}: {
  result: PopupResult;
  pageUrl: string;
  messageCount: number;
  onAnalyze?: () => void;
  isAnalyzing?: boolean;
  isWatching?: boolean;
  onFeedbackChange?: (feedback: FeedbackValue | null) => void;
}) {
  return (
    <div className="fsd-popup" style={{ maxWidth: "100%" }}>
      <Header isWatching={isWatching} statusText={isWatching ? "Watching" : "Preview"} />
      <div className="fsd-popup__body">
        <div className="fsd-context">
          <span className={`fsd-dot ${isWatching ? "fsd-dot--on" : "fsd-dot--off"}`} aria-hidden="true" />
          <span className="fsd-context__url fsd-grow" title={pageUrl}>{pageUrl}</span>
          <span>{messageCount} {messageCount === 1 ? "message" : "messages"}</span>
        </div>
        {!onAnalyze && <p className="fsd-p fsd-small">Sample result. Live conversation analysis is not connected. Feedback is not saved in this preview.</p>}
        <RiskMeter score={result.score} risk={result.risk} summary={result.summary} />
        <SignalList signals={result.signals} categories={result.categories} />
        <RecommendedActions risk={result.risk} actions={result.recommendations}>
          <Feedback embedded scanId={result.scanId} onFeedbackChange={onFeedbackChange} />
        </RecommendedActions>
      </div>
      <footer className="fsd-popup__foot">
        <button className="fsd-btn fsd-btn--primary fsd-grow" type="button" disabled={!onAnalyze || isAnalyzing} onClick={onAnalyze}>
          {isAnalyzing ? "Analyzing…" : "Analyze conversation"}
        </button>
        <Link className="fsd-btn" style={{ textDecoration: "none" }} href="/scam-finder/history">History</Link>
      </footer>
    </div>
  );
}
