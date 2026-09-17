(() => {
  const shorteners = new Set(["bit.ly", "tinyurl.com", "t.co", "is.gd", "buff.ly", "shorturl.at"]);
  function normalize(value, base) {
    try {
      const url = base ? new URL(value, base) : new URL(value);
      if (!/^https?:$/.test(url.protocol)) return null;
      url.hostname = url.hostname.toLowerCase().replace(/\.$/, "");
      return url;
    } catch { return null; }
  }
  function hostname(url) { return url.hostname.replace(/^www\./, ""); }
  function displayedUrl(label = "") {
    const value = label.trim();
    if (/\s|[\u2026]/.test(value) || value.includes("...")) return null;
    if (/^https?:\/\//i.test(value)) return normalize(value);
    if (/@/.test(value) || /\.(?:pdf|zip|png|jpe?g|gif|svg|docx?|xlsx?|txt|js|html?)$/i.test(value)) return null;
    if (/^(?:[a-z0-9-]+\.)+[a-z]{2,63}(?::\d+)?(?:[/?#].*)?$/i.test(value)) return normalize("https://" + value);
    return null;
  }
  function textLinks(text) {
    return (text.match(/https?:\/\/[^\s<>"']+/gi) || []).map(value => {
      let href = value.replace(/[.,;!?]+$/, "");
      // Remove sentence-closing parentheses, while preserving balanced URL paths.
      while (href.endsWith(")") && (href.match(/\)/g) || []).length > (href.match(/\(/g) || []).length) href = href.slice(0, -1);
      return { href, text: href };
    });
  }
  function scan(links, text = "", base) {
    const findings = new Map();
    const details = new Set();
    const inspected = [];
    const seen = new Set();
    for (const input of [...links, ...textLinks(text)]) {
      const link = typeof input === "string" ? { href: input, text: "" } : input;
      const destination = normalize(link.href, base);
      if (!destination) continue;
      const displayed = displayedUrl(link.text);
      const key = JSON.stringify([destination.href, displayed?.hostname]);
      if (seen.has(key)) continue;
      seen.add(key);
      const host = hostname(destination);
      const external = !(host === "fiverr.com" || host.endsWith(".fiverr.com"));
      const indicators = [];
      const add = (id, title, score) => {
        const finding = { id, category: "PHISHING", title, score };
        findings.set(id, finding); indicators.push(finding);
      };
      if (displayed && hostname(displayed) !== host) add("link_hostname_mismatch", "Displayed URL hostname differs from the link destination", 45);
      if (destination.username || destination.password) add("link_userinfo", "Link contains user information before @; the destination is the hostname after @", 50);
      if (external && host.split(".").some(part => /(?:^|-)(?:fiverr|f1verr|flverr|fiver)(?:$|-)/.test(part))) {
        add("link_fiverr_lookalike", "Destination uses a Fiverr-like name but is outside fiverr.com", 60);
      }
      if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(host) || host.startsWith("[")) add("link_ip_address", "Destination uses an IP address instead of a domain name", 20);
      if (shorteners.has(host)) add("link_shortener", "Known URL shortener hides the final destination", 15);
      if (destination.protocol === "http:") add("link_http", "Link uses unencrypted HTTP instead of HTTPS", 10);
      if (indicators.length) details.add("Link destination: " + destination.hostname + (displayed ? "; displayed hostname: " + displayed.hostname : "") + ".");
      inspected.push({ normalizedUrl: destination.href, hostname: destination.hostname, external, indicators,
        score: Math.min(100, indicators.reduce((sum, indicator) => sum + indicator.score, 0)) });
    }
    return { findings: [...findings.values()], details: [...details], links: inspected };
  }
  globalThis.fsdLinkScanner = { normalize, textLinks, scan };
})();
