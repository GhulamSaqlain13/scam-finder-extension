(() => {
  const shorteners = new Set(["bit.ly", "tinyurl.com", "t.co", "is.gd", "buff.ly", "shorturl.at"]);
  const fiverrHosts = new Set(["fiverr.com", "www.fiverr.com"]);
  const urlPattern = /https?:\/\/[^\s<>'"]+/giu;
  const trailingPunctuation = /[.,;!?]+$/u;

  function normalize(value) {
    try {
      const url = new URL(value);
      if (!/^https?:$/.test(url.protocol)) return null;
      url.hostname = url.hostname.toLowerCase().replace(/\.$/u, "");
      return url;
    } catch {
      return null;
    }
  }

  function host(url) {
    return url.hostname.replace(/^www\./u, "");
  }

  function isExternal(url) {
    const hostname = host(url);
    return !fiverrHosts.has(hostname) && !hostname.endsWith(".fiverr.com");
  }

  function clean(value) {
    let result = value.replace(trailingPunctuation, "");
    while (result.endsWith(")") && (result.match(/\)/gu) || []).length > (result.match(/\(/gu) || []).length)
      result = result.slice(0, -1);
    return result;
  }

  function add(indicators, id, category, reason, matchedText, score) {
    if (indicators.some((indicator) => indicator.id === id)) return;
    indicators.push({ id, category, reason, matchedText, score });
  }

  function detect(message, links = []) {
    const text = typeof message === "string" ? message : message?.normalizedText || message?.text || "";
    const inputs = [...(Array.isArray(links) ? links : [])];
    for (const value of text.match(urlPattern) || []) inputs.push({ href: clean(value), text: value });
    const urls = [];
    const indicators = [];
    const seen = new Set();
    for (const input of inputs) {
      const href = typeof input === "string" ? input : input?.href;
      const url = normalize(href || "");
      if (!url || seen.has(url.href)) continue;
      seen.add(url.href);
      const hostname = host(url);
      const external = isExternal(url);
      urls.push({ href: url.href, hostname: url.hostname, external });
      if (external && hostname.split(".").some((part) => /(?:^|-)(?:fiverr|f1verr|flverr|fiver)(?:$|-)/u.test(part)))
        add(indicators, "fake_fiverr_domain", "suspicious_link", "The URL uses a Fiverr-like domain outside fiverr.com", url.href, 60);
      if (shorteners.has(hostname))
        add(indicators, "url_shortener", "suspicious_link", "The URL uses a shortened destination", url.href, 15);
      if (url.username || url.password)
        add(indicators, "url_userinfo", "suspicious_link", "The URL contains misleading user information before its hostname", url.href, 50);
      if (url.protocol === "http:")
        add(indicators, "url_http", "suspicious_link", "The URL uses unencrypted HTTP", url.href, 10);
      const location = text.indexOf(href || url.href);
      const context = location < 0
        ? text
        : text.slice(Math.max(0, location - 90), location + String(href || url.href).length + 90);
      if (/\b(?:login|log in|verify|verification|confirm|security check|account suspended|unlock)\b/iu.test(context))
        add(indicators, "url_login_verification", "phishing", "The URL is presented with a login or account-verification request", url.href, 35);
      if (/\b(?:pay|payment|invoice|release|refund|fee|order)\b/iu.test(context))
        add(indicators, "url_payment_claim", "payment_request", "The URL is presented with a payment-related request or claim", url.href, 30);
      if (shorteners.has(hostname) && /\b(?:login|verify|pay|payment|account|password|code)\b/iu.test(context))
        add(indicators, "shortener_suspicious_context", "phishing", "A shortened URL is combined with a sensitive request", url.href, 35);
    }
    return {
      hasUrl: urls.length > 0,
      urls,
      indicators,
      score: Math.min(100, indicators.reduce((total, indicator) => total + indicator.score, 0)),
    };
  }

  globalThis.fsdUrlDetector = { detect, normalize };
})();