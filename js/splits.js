(function () {
  "use strict";

  const NS = (window.Splitsracer = window.Splitsracer || {});
  const EXERCISE_TYPE_KEYS = ["splitsen", "optellen", "aftrekken"];

  function randInt(min, max, rng) {
    const random = typeof rng === "function" ? rng : Math.random;
    return min + Math.floor(random() * (max - min + 1));
  }

  function wrongCandidates(answer, maxCandidate, excluded) {
    const max = Number.isFinite(maxCandidate) ? maxCandidate : answer;
    const blocked = new Set([answer]);
    if (Array.isArray(excluded)) {
      for (const value of excluded) blocked.add(value);
    } else if (excluded !== undefined && excluded !== null) {
      blocked.add(excluded);
    }

    const candidates = [];
    for (const delta of [1, -1, 2, -2, 3, -3]) {
      const candidate = answer + delta;
      if (
        candidate >= 0 &&
        candidate <= max &&
        !blocked.has(candidate) &&
        !candidates.includes(candidate)
      ) {
        candidates.push(candidate);
      }
    }
    if (!candidates.length) {
      for (let candidate = 0; candidate <= max; candidate += 1) {
        if (!blocked.has(candidate)) candidates.push(candidate);
      }
    }
    return candidates;
  }

  function chooseWrong(answer, maxCandidate, excluded, random) {
    const pool = wrongCandidates(answer, maxCandidate, excluded);
    return pool.length ? pool[randInt(0, pool.length - 1, random)] : 0;
  }

  function buildExercise(type, total, a, b, answer, wrong, random) {
    const correctSide = random() < 0.5 ? "left" : "right";
    let equation;
    if (type === "optellen") {
      equation = a + " + " + b + " = " + answer;
    } else if (type === "aftrekken") {
      equation = a + " − " + b + " = " + answer;
    } else {
      equation = total + " = " + a + " + " + b;
    }
    return {
      type,
      total,
      a,
      b,
      answer,
      wrong,
      correctSide,
      left: correctSide === "left" ? answer : wrong,
      right: correctSide === "right" ? answer : wrong,
      equation,
    };
  }

  /**
   * Maak één opgave. De twee getallen op de baan zijn het juiste antwoord en
   * één nabij fout getal. Het grootste getal in de opgave blijft binnen maxNumber.
   */
  function createExercise(maxNumber, rng, previousTotal, exerciseType) {
    const max = Math.max(2, Math.min(10, Number(maxNumber) || 7));
    const random = typeof rng === "function" ? rng : Math.random;
    const type = EXERCISE_TYPE_KEYS.includes(exerciseType) ? exerciseType : "splitsen";

    const nextTotal = () => {
      let total = randInt(2, max, random);
      if (previousTotal !== undefined && previousTotal !== null && max > 2) {
        for (let attempt = 0; attempt < 12 && total === previousTotal; attempt += 1) {
          total = randInt(2, max, random);
        }
      }
      return total;
    };

    if (type === "optellen") {
      const total = nextTotal();
      const a = randInt(1, total - 1, random);
      const b = total - a;
      const wrong = chooseWrong(total, max, [a, b], random);
      return buildExercise(type, total, a, b, total, wrong, random);
    }

    if (type === "aftrekken") {
      const total = nextTotal();
      const a = total;
      const b = randInt(1, total - 1, random);
      const answer = a - b;
      const wrong = chooseWrong(answer, max, [a, b], random);
      return buildExercise(type, total, a, b, answer, wrong, random);
    }

    const total = nextTotal();
    const a = randInt(1, total - 1, random);
    const b = total - a;
    const wrong = chooseWrong(b, total, [a, total], random);
    return buildExercise(type, total, a, b, b, wrong, random);
  }

  /** Compatibiliteitsalias voor de oorspronkelijke splitsingsgenerator. */
  function createSplit(maxNumber, rng, previousTotal) {
    return createExercise(maxNumber, rng, previousTotal, "splitsen");
  }

  NS.Splits = {
    randInt,
    wrongCandidates,
    createExercise,
    createSplit,
  };
})();
