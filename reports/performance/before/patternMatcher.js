(() => {
  function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function normalizedInput(message) {
    const text = typeof message === "string" ? message : (message?.text ?? "");
    if (typeof message?.normalizedText === "string")
      return message.normalizedText;
    return (
      globalThis.fsdMessageNormalizer?.normalize?.(text)?.normalizedText ||
      String(text)
        .normalize("NFKC")
        .toLocaleLowerCase()
        .replace(/\s+/gu, " ")
        .trim()
    );
  }

  function findLiteral(text, literal) {
    const value = String(literal || "")
      .trim()
      .toLocaleLowerCase();
    if (!value) return null;
    const expression = new RegExp(
      "(?<![\\p{L}\\p{N}_])" + escapeRegex(value) + "(?![\\p{L}\\p{N}_])",
      "iu",
    );
    const match = expression.exec(text);
    return match ? match[0] : null;
  }

  function compilePattern(pattern) {
    if (typeof pattern === "string") return new RegExp(pattern, "iu");
    if (!pattern || typeof pattern.pattern !== "string") return null;
    const flags = String(pattern.flags || "iu").replace(/g/gi, "");
    try {
      return new RegExp(pattern.pattern, flags);
    } catch {
      return null;
    }
  }

  function reason(category, kind) {
    return `${category.name || category.id} ${kind} indicator detected`;
  }

  function create(patternCatalog) {
    const categories = Array.isArray(patternCatalog?.categories)
      ? patternCatalog.categories
      : [];
    const combinations = Array.isArray(patternCatalog?.combinations)
      ? patternCatalog.combinations
      : [];

    function match(message) {
      const text = normalizedInput(message);
      const matches = [];
      const seen = new Set();
      const categoryIds = new Set();
      const addMatch = (category, matchedText, kind) => {
        if (!matchedText) return;
        const normalizedMatch = matchedText.toLocaleLowerCase();
        const key = `${category.id}\u001f${normalizedMatch}`;
        if (seen.has(key)) return;
        seen.add(key);
        categoryIds.add(category.id);
        matches.push({
          category: category.id,
          matchedText,
          matchType: kind,
          reason: reason(category, kind),
        });
      };

      for (const category of categories) {
        for (const keyword of category.keywords || [])
          addMatch(category, findLiteral(text, keyword), "keyword");
        for (const phrase of category.phrases || [])
          addMatch(category, findLiteral(text, phrase), "phrase");
        for (const definition of category.regexPatterns || []) {
          const pattern = compilePattern(definition);
          if (!pattern) continue;
          const result = pattern.exec(text);
          addMatch(category, result?.[0], "regex");
        }
      }

      const combinationMatches = combinations
        .filter((combination) =>
          (combination.requires || []).every((id) => categoryIds.has(id)),
        )
        .map((combination) => ({
          id: combination.id,
          categories: [...combination.requires],
          bonusScore: combination.bonusScore,
          reason:
            combination.description ||
            `${combination.name || combination.id} combination detected`,
        }));

      return {
        matched: matches.length > 0,
        categories: [...categoryIds],
        matches,
        combinations: combinationMatches,
      };
    }

    return { match, catalog: patternCatalog };
  }

  async function load(patternCatalog) {
    if (patternCatalog && typeof patternCatalog === "object")
      return create(patternCatalog);
    const resource = globalThis.chrome?.runtime?.getURL?.(
      "data/scamPatterns.json",
    );
    if (!resource) throw new Error("A local scam pattern catalog is required");
    const response = await fetch(resource);
    if (!response.ok)
      throw new Error(`Unable to load scam patterns: ${response.status}`);
    return create(await response.json());
  }

  globalThis.fsdPatternMatcher = { create, load };
})();
