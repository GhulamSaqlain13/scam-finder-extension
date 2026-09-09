import { BackButton } from "@/components/scam-finder/back-button";
import type { Metadata } from "next";

import dataset from "@/fiverr_scam_detection_dataset.json";
import { Header } from "@/components/scam-finder/header";
import { MessageTester } from "@/components/scam-finder/message-tester";

export const metadata: Metadata = {
  title: "Message tester | Fiverr Scam Detector",
};

const sampleDefinitions = [
  { id: "msg_001", label: "Normal project" },
  { id: "msg_003", label: "Telegram request" },
  { id: "msg_005", label: "Fake payment" },
  { id: "msg_006", label: "OTP request" },
  { id: "msg_007", label: "OTP warning (safe)" },
  { id: "msg_013", label: "Remote access" },
  { id: "msg_028", label: "Phishing link" },
];

export default function TesterPage() {
  const samples = sampleDefinitions.map((sample) => {
    const example = dataset.examples.find((entry) => entry.id === sample.id);
    if (!example) throw new Error(`Missing tester sample: ${sample.id}`);
    return { ...sample, text: example.text };
  });
  return (
    <>
      <Header isWatching={false} statusText="Developer mode" />
      <main className="fsd-page" style={{ maxWidth: 1000 }}>
        <header className="fsd-page__head">
          <BackButton />
          <h1 className="fsd-h1">Message tester</h1>
          <p className="fsd-p fsd-small fsd-prose">
            Preview the message warning users see on Fiverr. Raw model and rule
            data stays hidden.
          </p>
        </header>
        <MessageTester samples={samples} />
      </main>
    </>
  );
}
