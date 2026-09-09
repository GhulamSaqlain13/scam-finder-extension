import Link from "next/link";

export function BackButton() {
  return <Link href="/scam-finder" className="fsd-btn fsd-btn--sm fsd-back-button">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m10 5-7 7 7 7M3 12h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
    Back to home
  </Link>;
}
