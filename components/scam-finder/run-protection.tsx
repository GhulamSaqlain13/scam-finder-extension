"use client";

import { useState } from "react";

export function RunProtection() {
  const [notice, setNotice] = useState("");
  return <div>
    <button className="fsd-btn fsd-btn--primary fsd-btn--block" type="button" onClick={() => setNotice("Open Scam Finder from your browser’s extensions toolbar, open a Fiverr conversation, and press Run protection there. This website cannot read other browser tabs.")}>Run protection</button>
    <p className="fsd-p fsd-small" role="status" style={{ marginTop: 10 }}>{notice || "Monitoring runs from the installed extension."}</p>
  </div>;
}
