import { PreviewLinks, type PreviewLink } from "./preview-links";
import { PreviewSection } from "./preview-section";
import { RiskBadge, type RiskLevel } from "./risk-badge";

const screens: PreviewLink[] = [
  { file: "popup.html", href: "/scam-finder/popup", description: "is the extension popup at 380px." },
  { file: "options.html", href: "/scam-finder/options", description: "is the settings page." },
  { file: "tester.html", href: "/scam-finder/tester", description: "is the message tester for developer mode." },
];

const components: PreviewLink[] = [
  { file: "header.html", href: "/scam-finder/header", description: "is the brand bar with protection status." },
  { file: "risk-meter.html", href: "/scam-finder/risk-meter", description: "is the score and segmented ramp in all four bands." },
  { file: "warning-inline.html", href: "/scam-finder/warning-inline", description: "is the warning block designed to appear next to a Fiverr message." },
  { file: "signal-list.html", href: "/scam-finder/signal-list", description: "lists the evidence with severity ticks." },
  { file: "recommended-actions.html", href: "/scam-finder/recommended-actions", description: "lists what to do next." },
  { file: "feedback.html", href: "/scam-finder/feedback", description: "is the interactive feedback component with an optional reason and Undo." },
  { file: "settings-toggle.html", href: "/scam-finder/settings-toggle", description: "holds the setting rows and switches." },
  { file: "history-item.html", href: "/scam-finder/history", description: "is the interactive scan history list." },
  { file: "states.html", href: "/scam-finder/states", description: "covers empty, loading, error and signed out." },
];

const riskBands: { risk: RiskLevel; label: string }[] = [
  { risk: "low", label: "Low risk 0 to 20" },
  { risk: "suspicious", label: "Suspicious 21 to 50" },
  { risk: "high", label: "High risk 51 to 75" },
  { risk: "critical", label: "Very high risk 76 to 100" },
];

export function ScamFinderPreview() {
  return (
    <main className="fsd-preview">
      <header className="fsd-page__head">
        <h1 className="fsd-h1">Fiverr Scam Detector UI kit</h1>
        <p className="fsd-p fsd-small fsd-prose">
          Explore the screens and components below. This preview is built with reusable
          React components in Next.js. The previews share the same stylesheet.
        </p>
      </header>
      <PreviewSection id="screens" title="Screens">
        <PreviewLinks items={screens} />
      </PreviewSection>
      <PreviewSection id="components" title="Components">
        <PreviewLinks items={components} />
      </PreviewSection>
      <PreviewSection id="risk-bands" title="Risk bands">
        <div className="fsd-chip-row">
          {riskBands.map(({ risk, label }) => <RiskBadge key={risk} risk={risk}>{label}</RiskBadge>)}
        </div>
        <p className="fsd-p fsd-small fsd-preview__note">
          Set data-risk on any wrapper and the badge, meter, buttons and action bullets
          inside it pick up that band automatically.
        </p>
      </PreviewSection>
    </main>
  );
}

