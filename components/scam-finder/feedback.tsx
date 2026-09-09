"use client";

import { useId, useState, type FormEvent } from "react";

export type FeedbackValue = {
  scanId: string;
  feedbackType: "correct" | "incorrect";
  reason?: string;
};

type FeedbackProps = {
  scanId: string;
  embedded?: boolean;
  onFeedbackChange?: (feedback: FeedbackValue | null) => void;
};

function FeedbackReason({ onSubmit }: { onSubmit: (reason?: string) => void }) {
  const reasonId = useId();
  const [reason, setReason] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(reason.trim() || undefined);
  }

  return (
    <form className="fsd-card__body fsd-stack" onSubmit={submit}>
      <div className="fsd-field">
        <label className="fsd-label" htmlFor={reasonId}>What did we get wrong? (optional)</label>
        <input className="fsd-input" id={reasonId} type="text" value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="This client is a repeat buyer I already know" maxLength={500} autoFocus />
      </div>
      <div className="fsd-btn-row">
        <button className="fsd-btn" type="button" onClick={() => onSubmit()}>Skip</button>
        <button className="fsd-btn fsd-btn--primary" type="submit">Send feedback</button>
      </div>
    </form>
  );
}

function FeedbackControl({ scanId, onFeedbackChange, embedded = false }: FeedbackProps) {
  const [step, setStep] = useState<"question" | "reason" | "done">("question");

  function submit(feedbackType: FeedbackValue["feedbackType"], reason?: string) {
    onFeedbackChange?.({ scanId, feedbackType, ...(reason ? { reason } : {}) });
    setStep("done");
  }

  function undo() {
    onFeedbackChange?.(null);
    setStep("question");
  }

  return (
    <div className={embedded ? undefined : "fsd-card"}>
      {step === "reason" ? <FeedbackReason onSubmit={(reason) => submit("incorrect", reason)} /> : (
        <div className="fsd-card__foot">
          <div className="fsd-feedback">
            {step === "done" ? (
              <>
                <span className="fsd-feedback__done" role="status">Thanks for your feedback.</span>
                <button className="fsd-btn fsd-btn--ghost fsd-btn--sm" type="button" onClick={undo} autoFocus>Undo</button>
              </>
            ) : (
              <>
                <span className="fsd-feedback__q">Was this warning right?</span>
                <button className="fsd-btn fsd-btn--sm" type="button" data-fsd-feedback="correct" onClick={() => submit("correct")}>Yes</button>
                <button className="fsd-btn fsd-btn--sm" type="button" data-fsd-feedback="incorrect" onClick={() => setStep("reason")}>No</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Emits feedback changes to the parent; persistence belongs to the caller. */
export function Feedback(props: FeedbackProps) {
  return <FeedbackControl key={props.scanId} {...props} />;
}
