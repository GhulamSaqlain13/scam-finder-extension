import Link from "next/link";
import { Icon } from "./icon";
import { RunProtection } from "./run-protection";
import styles from "./home.module.css";

export function Home() {
  return (
    <main className={styles.stage}>
      <div className={styles.panel}>
        <header className={styles.header}>
          <div className={styles.brand}><span className={styles.brandMark}><Icon name="shield" size={20} /></span><span>Scam Finder</span></div>
          <span className={styles.preview}>Preview</span>
          <Link href="/scam-finder/options" className={styles.iconButton} aria-label="Open settings"><Icon name="settings" /></Link>
        </header>

        <div className={styles.context}><Icon name="link" size={14} /><span>No conversation connected</span><span className={styles.statusDot} /></div>

        <div className={styles.body}>
          <section className={styles.check}>
            <div className={styles.sectionLabel}><span>MESSAGE CHECK</span><span className={styles.local}><Icon name="lock" size={11} /> Private by default</span></div>
            <div className={styles.emptyIcon}><Icon name="message" size={25} /></div>
            <h1>Check before you reply.</h1>
            <p>Review a suspicious message for payment requests, unsafe links, and other warning signs.</p>
            <RunProtection />
            <Link href="/scam-finder/tester" className="fsd-btn fsd-btn--sm" style={{ marginTop: 10 }}>Open message tester</Link>
          </section>

          <section className={styles.activity} aria-labelledby="activity-heading">
            <div className={styles.sectionHeading}><h2 id="activity-heading">Report preview</h2><span>Example</span></div>
            <Link href="/scam-finder/popup" className={styles.report}>
              <div className={styles.reportTop}><span className={styles.risk}><span />High-risk message</span><span className={styles.score}>94<span>/100</span></span></div>
              <h3>Payment verification request</h3>
              <p>A request for card details on an external page.</p>
              <div className={styles.tags}><span>Payment request</span><span>External link</span></div>
              <div className={styles.reportFooter}><span>Review warning signs</span><Icon name="arrow" size={15} /></div>
            </Link>
          </section>

          <Link href="/scam-finder/history" className={styles.history}><span className={styles.historyIcon}><Icon name="history" /></span><span><strong>Scan history</strong><small>Browse example reports</small></span><Icon name="chevron" size={15} /></Link>
          <div className={styles.privacy}><Icon name="lock" size={12} /><span>No messages are sent or stored in this preview.</span></div>
        </div>

        <nav className={styles.navigation} aria-label="Extension navigation">
          <Link href="/scam-finder" aria-current="page"><Icon name="home" size={17} /><span>Home</span></Link>
          <Link href="/scam-finder/history"><Icon name="history" size={17} /><span>History</span></Link>
          <Link href="/scam-finder/options"><Icon name="settings" size={17} /><span>Settings</span></Link>
        </nav>
      </div>
    </main>
  );
}
