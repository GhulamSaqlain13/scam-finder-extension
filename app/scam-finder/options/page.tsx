import { BackButton } from "@/components/scam-finder/back-button";
import type { Metadata } from "next";

import { Header } from "@/components/scam-finder/header";
import { OptionsForm } from "@/components/scam-finder/options-form";

export const metadata: Metadata = { title: "Settings | Fiverr Scam Detector" };

export default function OptionsPage() {
  return <>
    <Header isWatching={false} statusText="Local preview" showSettings={false} />
    <main className="fsd-page">
      <div className="fsd-page__head">
        <BackButton />
        <h1 className="fsd-h1">Settings</h1>
        <p className="fsd-p fsd-small fsd-prose">Choose how much the extension checks, and how much of it leaves your browser.</p>
        <p className="fsd-p fsd-small">Preferences save locally. Scanning, AI analysis, and account sync are not connected yet.</p>
      </div>
      <OptionsForm />
    </main>
  </>;
}
