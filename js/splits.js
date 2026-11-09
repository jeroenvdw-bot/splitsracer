(function () {
  "use strict";

  const NS = (window.Splitsracer = window.Splitsracer || {});

  function randInt(min, max, rng) {
    const random = typeof rng === "function" ? rng : Math.random;
    return min + Math.floor(random() * (max - min + 1));
  }

  function wrongCandidates(answer, total, given) {
    const candidates = [];
    for (const delta of [1, -1, 2, -2, 3, -3]) {
      const candidate = answer + delta;
      if (
        candidate >= 0 &&
        candidate <= total &&
        candidate !== answer &&
        candidate !== given &&
        !candidates.includes(candidate)
      ) {
        candidates.push(candidate);
      }
    }
    if (!candidates.length) {
      for (let candidate = 0; candidate <= total; candidate += 1) {
        if (candidate !== answer && candidate !== given) candidates.push(candidate);
      }
    }
    return candidates;
  }

  /**
   * Maak één splitsing: totaal = gegeven + antwoord.
   * De twee getallen op de baan zijn het juiste antwoord en één nabij fout getal.
   */
  function createSplit(maxNumber, rng, previousTotal) {
    const max = Math.max(2, Math.min(10, Number(maxNumber) || 7));
    const random = typeof rng === "function" ? rng : Math.random;

    let total = randInt(2, max, random);
    if (previousTotal !== undefined && previousTotal !== null && max > 2) {
      for (let attempt = 0; attempt < 12 && total === previousTotal; attempt += 1) {
        total = randInt(2, max, random);
      }
    }

    const given = randInt(1, total - 1, random);
    const answer = total - given;
    const pool = wrongCandidates(answer, total, given);
    const wrong = pool.length ? pool[randInt(0, pool.length - 1, random)] : 0;
    const correctSide = random() < 0.5 ? "left" : "right";

    return {
      total,
      given,
      answer,
      wrong,
      correctSide,
      left: correctSide === "left" ? answer : wrong,
      right: correctSide === "right" ? answer : wrong,
      equation: total + " = " + given + " + " + answer,
    };
  }

  NS.Splits = {
    randInt,
    wrongCandidates,
    createSplit,
  };
})();
