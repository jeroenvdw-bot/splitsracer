(function () {
  "use strict";

  const NS = window.Splitsracer;
  const { Settings, AudioEngine, Game } = NS;

  // roundRect-polyfill voor oudere tabletbrowsers.
  if (
    typeof CanvasRenderingContext2D !== "undefined" &&
    typeof CanvasRenderingContext2D.prototype.roundRect !== "function"
  ) {
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, width, height, radius) {
      const r =
        typeof radius === "number"
          ? { tl: radius, tr: radius, br: radius, bl: radius }
          : {
              tl: (radius && radius[0]) || 0,
              tr: (radius && radius[1]) || 0,
              br: (radius && radius[2]) || 0,
              bl: (radius && radius[3]) || 0,
            };
      const max = Math.min(width / 2, height / 2);
      const tl = Math.min(r.tl, max);
      const tr = Math.min(r.tr, max);
      const br = Math.min(r.br, max);
      const bl = Math.min(r.bl, max);
      this.moveTo(x + tl, y);
      this.lineTo(x + width - tr, y);
      this.quadraticCurveTo(x + width, y, x + width, y + tr);
      this.lineTo(x + width, y + height - br);
      this.quadraticCurveTo(x + width, y + height, x + width - br, y + height);
      this.lineTo(x + bl, y + height);
      this.quadraticCurveTo(x, y + height, x, y + height - bl);
      this.lineTo(x, y + tl);
      this.quadraticCurveTo(x, y, x + tl, y);
      this.closePath();
      return this;
    };
  }

  const elements = {
    canvas: document.getElementById("game"),
    screenTitle: document.getElementById("screen-title"),
    screenSettings: document.getElementById("screen-settings"),
    screenResult: document.getElementById("screen-result"),
    btnPlay: document.getElementById("btn-play"),
    btnSettings: document.getElementById("btn-settings"),
    btnSettingsDone: document.getElementById("btn-settings-done"),
    btnAgain: document.getElementById("btn-again"),
    btnMenu: document.getElementById("btn-menu"),
    btnMute: document.getElementById("btn-mute"),
    maxNumber: document.getElementById("max-number"),
    raceLength: document.getElementById("race-length"),
    opponentWaitToggle: document.getElementById("opponent-wait-toggle"),
    soundToggle: document.getElementById("sound-toggle"),
    countdown: document.getElementById("countdown"),
    prompt: document.getElementById("prompt"),
    toast: document.getElementById("toast"),
    resultIcon: document.getElementById("result-icon"),
    resultTitle: document.getElementById("result-title"),
    resultMessage: document.getElementById("result-message"),
    resultScore: document.getElementById("result-score"),
  };

  const settings = Settings.load();
  const audio = new AudioEngine();
  audio.setEnabled(settings.sound);

  let game = null;
  let currentScreen = "title";
  let toastTimer = null;

  function hideScreens() {
    elements.screenTitle.classList.add("hidden");
    elements.screenSettings.classList.add("hidden");
    elements.screenResult.classList.add("hidden");
  }

  function showScreen(name) {
    hideScreens();
    currentScreen = name;
    if (name === "title") elements.screenTitle.classList.remove("hidden");
    else if (name === "settings") elements.screenSettings.classList.remove("hidden");
    else if (name === "result") elements.screenResult.classList.remove("hidden");
  }

  function updateMuteButton() {
    elements.btnMute.classList.toggle("muted", !settings.sound);
    elements.btnMute.setAttribute(
      "aria-label",
      settings.sound ? "Geluid uitzetten" : "Geluid aanzetten"
    );
  }

  function updateSettingsUI() {
    elements.maxNumber.querySelectorAll("button").forEach((button) => {
      button.classList.toggle("active", Number(button.dataset.max) === settings.maxNumber);
      button.setAttribute(
        "aria-pressed",
        Number(button.dataset.max) === settings.maxNumber ? "true" : "false"
      );
    });
    elements.raceLength.querySelectorAll("button").forEach((button) => {
      button.classList.toggle("active", button.dataset.length === settings.raceLength);
      button.setAttribute(
        "aria-pressed",
        button.dataset.length === settings.raceLength ? "true" : "false"
      );
    });
    elements.soundToggle.textContent = settings.sound ? "Aan" : "Uit";
    elements.soundToggle.setAttribute("aria-pressed", settings.sound ? "true" : "false");
    elements.opponentWaitToggle.textContent = settings.opponentWaits ? "Aan" : "Uit";
    elements.opponentWaitToggle.setAttribute(
      "aria-pressed",
      settings.opponentWaits ? "true" : "false"
    );
    updateMuteButton();
  }

  function persistSettings() {
    const saved = Settings.save(settings);
    settings.maxNumber = saved.maxNumber;
    settings.raceLength = saved.raceLength;
    settings.sound = saved.sound;
    settings.opponentWaits = saved.opponentWaits;
    if (game) game.setSettings(settings);
    updateSettingsUI();
  }

  function buildSettingsUI() {
    elements.maxNumber.innerHTML = "";
    Settings.MAX_CHOICES.forEach((number) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.max = String(number);
      button.textContent = String(number);
      button.addEventListener("click", () => {
        settings.maxNumber = number;
        persistSettings();
      });
      elements.maxNumber.appendChild(button);
    });

    elements.raceLength.innerHTML = "";
    Object.entries(Settings.RACE_LENGTHS).forEach(([key, value]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.length = key;
      button.textContent = value.label;
      button.title = value.splits + " splitsingen";
      button.setAttribute("aria-label", value.label + ", " + value.splits + " splitsingen");
      button.addEventListener("click", () => {
        settings.raceLength = key;
        persistSettings();
      });
      elements.raceLength.appendChild(button);
    });

    elements.opponentWaitToggle.addEventListener("click", () => {
      settings.opponentWaits = !settings.opponentWaits;
      persistSettings();
    });

    elements.soundToggle.addEventListener("click", () => {
      settings.sound = !settings.sound;
      audio.init();
      audio.setEnabled(settings.sound);
      if (settings.sound) audio.countdown(1);
      persistSettings();
    });

    updateSettingsUI();
  }

  const ui = {
    setCountdown(text) {
      elements.countdown.classList.remove("hidden");
      elements.countdown.textContent = text;
      elements.countdown.classList.toggle("go", text === "GO!");
      elements.countdown.style.animation = "none";
      void elements.countdown.offsetWidth;
      elements.countdown.style.animation = "";
    },
    hideCountdown() {
      elements.countdown.classList.add("hidden");
    },
    setPrompt(visible) {
      elements.prompt.classList.toggle("hidden", !visible);
    },
    showToast(text, kind) {
      if (toastTimer) window.clearTimeout(toastTimer);
      elements.toast.textContent = text;
      elements.toast.className = "toast " + (kind || "good");
      elements.toast.classList.remove("hidden");
      toastTimer = window.setTimeout(() => {
        elements.toast.classList.add("hidden");
      }, 1700);
    },
    showResult(result) {
      elements.resultIcon.className = "result-icon " + (result.win ? "win" : "lose");
      if (result.win) {
        elements.resultTitle.textContent = "Gewonnen!";
        elements.resultMessage.textContent = "Je was als eerste bij de finish. Knap gereden!";
      } else {
        elements.resultTitle.textContent = "Volgende keer beter!";
        elements.resultMessage.textContent =
          "De tegenstander was net sneller. Probeer het nog eens!";
      }
      elements.resultScore.textContent =
        result.correct === result.total
          ? "Alle " + result.total + " splitsingen goed!"
          : "Je had " + result.correct + " van " + result.total + " splitsingen goed.";
      showScreen("result");
      elements.btnMute.classList.remove("hidden");
    },
    hideResult() {
      elements.screenResult.classList.add("hidden");
    },
  };

  function showTitle() {
    if (game) game.startDemo();
    showScreen("title");
    elements.btnMute.classList.add("hidden");
    elements.countdown.classList.add("hidden");
    elements.prompt.classList.add("hidden");
    elements.toast.classList.add("hidden");
  }

  function showSettings() {
    if (game) game.startDemo();
    updateSettingsUI();
    showScreen("settings");
    elements.btnMute.classList.add("hidden");
    elements.countdown.classList.add("hidden");
    elements.prompt.classList.add("hidden");
    elements.toast.classList.add("hidden");
  }

  function startGame() {
    audio.init();
    audio.setEnabled(settings.sound);
    if (!game) return;
    game.setSettings(settings);
    game.startRace(settings);
    hideScreens();
    currentScreen = "game";
    elements.btnMute.classList.remove("hidden");
    elements.toast.classList.add("hidden");
  }

  function toggleMute() {
    settings.sound = !settings.sound;
    audio.init();
    audio.setEnabled(settings.sound);
    persistSettings();
  }

  elements.btnPlay.addEventListener("click", startGame);
  elements.btnSettings.addEventListener("click", showSettings);
  elements.btnSettingsDone.addEventListener("click", showTitle);
  elements.btnAgain.addEventListener("click", startGame);
  elements.btnMenu.addEventListener("click", showTitle);
  elements.btnMute.addEventListener("click", toggleMute);

  document.addEventListener(
    "pointerdown",
    () => {
      audio.init();
    },
    { once: true }
  );

  window.addEventListener("keydown", (event) => {
    if (event.key === "m" || event.key === "M") {
      toggleMute();
      return;
    }
    if (event.target && event.target.tagName === "BUTTON" && (event.key === "Enter" || event.key === " ")) {
      return;
    }
    if (currentScreen === "title" && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      startGame();
      return;
    }
    if (currentScreen === "result" && event.key === "Enter") {
      event.preventDefault();
      startGame();
      return;
    }
    if (currentScreen === "settings" && event.key === "Escape") {
      event.preventDefault();
      showTitle();
    }
  });

  let lastFrame = performance.now();
  function frame(now) {
    const dt = (now - lastFrame) / 1000;
    lastFrame = now;
    if (game) {
      game.update(dt, now / 1000);
      game.draw();
    }
    window.requestAnimationFrame(frame);
  }

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      lastFrame = performance.now();
      if (audio.ctx) audio.init();
    }
  });

  function loadImages() {
    const sources = {
      car_player: "./assets/car_player.png",
      car_opponent: "./assets/car_opponent.png",
      tree_large: "./assets/tree_large.png",
      tree_small: "./assets/tree_small.png",
      rock1: "./assets/rock1.png",
      rock2: "./assets/rock2.png",
      rock3: "./assets/rock3.png",
    };
    return Promise.all(
      Object.entries(sources).map(
        ([key, source]) =>
          new Promise((resolve) => {
            const image = new Image();
            image.onload = () => resolve([key, image]);
            image.onerror = () => {
              console.warn("Kon afbeelding niet laden:", source);
              resolve([key, null]);
            };
            image.src = source;
          })
      )
    ).then((entries) => Object.fromEntries(entries));
  }

  buildSettingsUI();

  loadImages().then((images) => {
    game = new Game(elements.canvas, images, audio, ui);
    game.setSettings(settings);
    // Handig voor debuggen en geautomatiseerde tests.
    window.Splitsracer.game = game;
    showTitle();
    window.requestAnimationFrame(frame);
  });

  if ("serviceWorker" in navigator && /^https?:$/.test(window.location.protocol)) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch((error) => {
        console.warn("Service worker niet geregistreerd:", error);
      });
    });
  }
})();
