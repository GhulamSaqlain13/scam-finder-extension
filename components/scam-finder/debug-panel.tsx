export function DebugPanel({ title, source, output }: { title: string; source?: string; output: string }) {
  return <section className="fsd-card">
    <div className="fsd-card__head"><h2 className="fsd-h2">{title}</h2>{source && <span className="fsd-small fsd-muted">{source}</span>}</div>
    <div className="fsd-card__body"><pre className="fsd-debug">{output}</pre></div>
  </section>;
}
