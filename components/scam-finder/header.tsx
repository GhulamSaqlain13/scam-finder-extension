import Link from "next/link";

export type HeaderProps = {
  brandName?: string;
  isWatching?: boolean;
  statusText?: string;
  settingsHref?: string;
  showSettings?: boolean;
};

export function Header({
  brandName = "Scam Detector",
  isWatching = true,
  statusText,
  settingsHref = "/scam-finder/options",
  showSettings = true,
}: HeaderProps) {
  return (
    <header className="fsd-topbar">
      <div className="fsd-brand">
        <svg className="fsd-brand__mark" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12 2.5 4.5 5.5v6c0 4.6 3.1 8.7 7.5 10 4.4-1.3 7.5-5.4 7.5-10v-6L12 2.5Z"
            stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"
          />
          <path
            d="M8.8 12.2l2.2 2.2 4.2-4.4"
            stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
          />
        </svg>
        <span className="fsd-brand__name">{brandName}</span>
      </div>

      <div className="fsd-topbar__right">
        <span className="fsd-status" role="status">
          <span className={`fsd-dot ${isWatching ? "fsd-dot--on" : "fsd-dot--off"}`} aria-hidden="true" />
          {statusText ?? (isWatching ? "Watching" : "Paused")}
        </span>
        {showSettings && (
          <Link className="fsd-btn fsd-btn--ghost fsd-btn--sm" href={settingsHref} aria-label="Open settings">
            <svg className="fsd-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
              <path
                d="M12 3.5v2M12 18.5v2M20.5 12h-2M5.5 12h-2M17.9 6.1l-1.4 1.4M7.5 16.5l-1.4 1.4M17.9 17.9l-1.4-1.4M7.5 7.5 6.1 6.1"
                stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"
              />
            </svg>
          </Link>
        )}
      </div>
    </header>
  );
}
