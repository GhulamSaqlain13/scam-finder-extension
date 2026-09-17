(() => {
  const urlPattern = /(?:https?:\/\/|www\.)[^\s<>'"]+/giu;
  const emailPattern = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}/gu;
  const trailingUrlPunctuation = /[.,!?;:]+$/u;

  function protect(text, pattern, tokens) {
    return text.replace(pattern, (match) => {
      let value = match;
      let trailing = "";
      if (pattern === urlPattern) {
        const punctuation = value.match(trailingUrlPunctuation)?.[0] || "";
        if (punctuation) {
          value = value.slice(0, -punctuation.length);
          trailing = punctuation;
        }
      }
      const marker = String.fromCodePoint(0xe000 + tokens.length);
      tokens.push(value);
      return marker + trailing;
    });
  }

  function normalizeText(originalText) {
    const original =
      typeof originalText === "string"
        ? originalText
        : String(originalText ?? "");
    const tokens = [];
    let value = original.normalize("NFKC");
    value = protect(value, urlPattern, tokens);
    value = protect(value, emailPattern, tokens);
    value = value
      .toLocaleLowerCase()
      .replace(/[^\p{L}\p{N}\s\uE000-\uF8FF'’]/gu, " ")
      .replace(/([\p{L}])\1{2,}/gu, "$1$1")
      .replace(/[’]/gu, "'")
      .replace(/\s+/gu, " ")
      .trim();
    value = value.replace(
      /[\uE000-\uF8FF]/gu,
      (marker) => tokens[marker.codePointAt(0) - 0xe000] || "",
    );
    return { originalText: original, normalizedText: value };
  }

  globalThis.fsdMessageNormalizer = { normalize: normalizeText, normalizeText };
})();
