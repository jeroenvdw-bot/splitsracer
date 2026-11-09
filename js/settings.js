(function () {
  "use strict";

  const NS = (window.Splitsracer = window.Splitsracer || {});
  const STORAGE_KEY = "splitsracer.settings.v1";

  const DEFAULTS = {
    maxNumber: 7,
    raceLength: "kort",
    sound: true,
    opponentWaits: true,
  };

  const RACE_LENGTHS = {
    kort: { label: "Kort", splits: 4 },
    middel: { label: "Middel", splits: 6 },
    lang: { label: "Lang", splits: 8 },
  };

  const MAX_CHOICES = [5, 6, 7, 8, 9, 10];

  function clampMaxNumber(value) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) return DEFAULTS.maxNumber;
    return Math.min(10, Math.max(5, parsed));
  }

  function normalize(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    return {
      maxNumber: clampMaxNumber(source.maxNumber),
      raceLength: RACE_LENGTHS[source.raceLength] ? source.raceLength : DEFAULTS.raceLength,
      sound: typeof source.sound === "boolean" ? source.sound : DEFAULTS.sound,
      opponentWaits:
        typeof source.opponentWaits === "boolean"
          ? source.opponentWaits
          : DEFAULTS.opponentWaits,
    };
  }

  function load() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return normalize(DEFAULTS);
      return normalize(JSON.parse(raw));
    } catch (error) {
      return normalize(DEFAULTS);
    }
  }

  function save(settings) {
    const normalized = normalize(settings);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    } catch (error) {
      /* localStorage kan uitstaan (privémodus); instellingen blijven dan tijdelijk. */
    }
    return normalized;
  }

  NS.Settings = {
    STORAGE_KEY,
    DEFAULTS,
    RACE_LENGTHS,
    MAX_CHOICES,
    clampMaxNumber,
    normalize,
    load,
    save,
  };
})();
