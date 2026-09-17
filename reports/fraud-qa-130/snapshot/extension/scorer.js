(() => {
  const levels = [
    { minimum: 60, level: "red", label: "High Risk" },
    { minimum: 30, level: "yellow", label: "Suspicious" },
    { minimum: 0, level: "green", label: "Safe" },
  ];

  function create(patternCatalog) {
    const weights = new Map(
      (patternCatalog?.categories || [])
        .filter((category) => Number.isFinite(category.weight))
        .map((category) => [category.id, Math.max(0, category.weight)]),
    );

    function classify(score) {
      return levels.find((level) => score >= level.minimum);
    }

    function score(patternResult = {}) {
      const categories = [...new Set(patternResult.categories || [])];
      const matched = [];
      const seenMatches = new Set();
      for (const match of patternResult.matches || []) {
        if (!match?.category || !match?.matchedText) continue;
        const key = `${match.category}\u001f${String(match.matchedText).toLocaleLowerCase()}`;
        if (seenMatches.has(key)) continue;
        seenMatches.add(key);
        matched.push(match);
      }

      const evidence = new Map();
      for (const match of matched) {
        const current = evidence.get(match.category) || { contextual: false };
        if (match.matchType !== "keyword") current.contextual = true;
        evidence.set(match.category, current);
      }
      let total = categories.reduce((sum, category) => {
        const weight = weights.get(category) || 0;
        const categoryEvidence = evidence.get(category);
        if (!categoryEvidence || categoryEvidence.contextual)
          return sum + weight;
        return sum + Math.min(weight, 10);
      }, 0);
      const urlIndicators = [];
      const seenUrlIndicators = new Set();
      for (const indicator of patternResult.urlDetection?.indicators || []) {
        if (!indicator?.id || seenUrlIndicators.has(indicator.id)) continue;
        const indicatorScore = Number(indicator.score);
        if (!Number.isFinite(indicatorScore) || indicatorScore <= 0) continue;
        seenUrlIndicators.add(indicator.id);
        urlIndicators.push(indicator);
        total += indicatorScore;
        if (!categories.includes(indicator.category)) categories.push(indicator.category);
      }
      const seenCombinations = new Set();
      const categorySet = new Set(categories);
      const combinations = [];
      for (const combination of patternResult.combinations || []) {
        if (!combination?.id || seenCombinations.has(combination.id)) continue;
        if (
          !(combination.categories || []).every((category) =>
            categorySet.has(category),
          )
        )
          continue;
        const bonus = Number(combination.bonusScore);
        if (!Number.isFinite(bonus) || bonus <= 0) continue;
        seenCombinations.add(combination.id);
        total += bonus;
        combinations.push(combination);
      }

      const scoreValue = Math.min(100, Math.max(0, Math.round(total)));
      const classification = classify(scoreValue);
      const reasons = matched.map(
        (match) =>
          `${match.reason || "Detection indicator"}: ${match.matchedText}`,
      );
      for (const combination of combinations)
        reasons.push(
          `Combination: ${combination.reason || `${combination.id} detected`}`,
        );
      for (const indicator of urlIndicators) {
        reasons.push(`${indicator.reason}: ${indicator.matchedText}`);
      }
      total = Math.min(100, total);

      return {
        score: scoreValue,
        level: classification.level,
        label: classification.label,
        categories,
        reasons: [...new Set(reasons)],
      };
    }

    return { score };
  }

  globalThis.fsdScorer = { create };
})();
