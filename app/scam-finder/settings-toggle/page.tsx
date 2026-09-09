import { BackButton } from "@/components/scam-finder/back-button";
import type { Metadata } from "next";
import Link from "next/link";
import { SettingsTogglePreview } from "@/components/scam-finder/settings-toggle-preview";

export const metadata: Metadata = { title: "Settings toggles | Fiverr Scam Detector" };

export default function SettingsTogglePage() {
  return (
    <main className="fsd-page" style={{ maxWidth: 668 }}>
      <header className="fsd-page__head">
        <BackButton />
        <h1 className="fsd-h1">Settings toggles</h1>
        <p className="fsd-p fsd-small">Try the switches and context counter (0–20). This preview does not save preferences or send data.</p>
        <Link href="/scam-finder/options" className="fsd-btn fsd-btn--sm" style={{ width: "fit-content" }}>Open settings to save preferences</Link>
      </header>
      <SettingsTogglePreview />
    </main>
  );
}
