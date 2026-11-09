(function () {
  "use strict";

  const NS = (window.Splitsracer = window.Splitsracer || {});
  const { Road, Splits, Settings } = NS;

  const BASE_SPEED = 260;
  const OPPONENT_SPEED = 262;
  const BOOST_SPEED = 800;
  const BOOST_TIME = 4.0;
  const BOOST_MAX = 8;
  const WRONG_FACTOR = 0.62;
  const PLAYER_START_Y = 180;
  const START_LINE_Y = 260;
  const FIRST_SPLIT_Y = 2100;
  const SPLIT_SPACING = 1650;
  const FINISH_MARGIN = 2300;
  const FONT = "'Trebuchet MS', 'Segoe UI', Arial, sans-serif";
  const COLORS = {
    player: "#1f7fbf",
    opponent: "#e05a1e",
    ink: "#173b46",
    cream: "#fff9ee",
    orange: "#e5672b",
    green: "#1f9d55",
    red: "#d9412b",
  };

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function approach(value, target, step) {
    if (value < target) return Math.min(target, value + step);
    return Math.max(target, value - step);
  }

  class Game {
    constructor(canvas, images, audio, ui) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.images = images || {};
      this.audio = audio;
      this.ui = ui || {};
      this.settings = Settings.load();
      this.mode = "demo";
      this.race = null;
      this.time = 0;
      this.demoY = 0;
      this.demoScenery = Road.buildScenery(16000, 0x51e57);
      this.particles = [];
      this.confetti = [];
      this.lastView = null;
      this.flameClock = 0;
      this.dustClock = 0;
      this.resize();

      window.addEventListener("resize", () => this.resize());
      this.canvas.addEventListener("pointerdown", (event) => {
        const rect = this.canvas.getBoundingClientRect();
        this.handlePointer(event.clientX - rect.left, event.clientY - rect.top);
      });
      window.addEventListener("keydown", (event) => this.handleKey(event));
      this.canvas.addEventListener("contextmenu", (event) => event.preventDefault());
    }

    resize() {
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.cssW = Math.max(320, window.innerWidth);
      this.cssH = Math.max(320, window.innerHeight);
      this.canvas.width = Math.round(this.cssW * this.dpr);
      this.canvas.height = Math.round(this.cssH * this.dpr);
      this.canvas.style.width = this.cssW + "px";
      this.canvas.style.height = this.cssH + "px";
      this.scale = Math.min(this.cssW / 900, this.cssH / 720);
      this.viewW = this.cssW / this.scale;
      this.viewH = this.cssH / this.scale;
    }

    setSettings(settings) {
      this.settings = Settings.normalize(settings);
    }

    viewFor(playerY, anchor) {
      const scale = this.scale;
      const cameraTopY = playerY + this.viewH * (anchor === undefined ? 0.72 : anchor);
      return {
        cssW: this.cssW,
        cssH: this.cssH,
        scale,
        viewW: this.viewW,
        viewH: this.viewH,
        cameraTopY,
        cameraBottomY: cameraTopY - this.viewH,
        sx: (x) => (x - 450) * scale + this.cssW / 2,
        sy: (y) => (cameraTopY - y) * scale,
        screenToWorldX: (x) => (x - this.cssW / 2) / scale + 450,
        screenToWorldY: (y) => cameraTopY - y / scale,
      };
    }

    startDemo() {
      this.mode = "demo";
      this.race = null;
      if (this.demoY < 1) this.demoY = 1;
      this.ui.hideCountdown && this.ui.hideCountdown();
      this.ui.setPrompt && this.ui.setPrompt(false);
    }

    createRace(settings) {
      const normalized = Settings.normalize(settings || this.settings);
      const length = Settings.RACE_LENGTHS[normalized.raceLength] || Settings.RACE_LENGTHS.kort;
      const splits = [];
      let previousTotal = null;
      for (let index = 0; index < length.splits; index += 1) {
        const data = Splits.createSplit(normalized.maxNumber, Math.random, previousTotal);
        previousTotal = data.total;
        splits.push({
          ...data,
          y: FIRST_SPLIT_Y + index * SPLIT_SPACING,
          resolved: false,
          chosenSide: null,
          correct: null,
          resolvedAt: 0,
        });
      }
      const finishY = splits[splits.length - 1].y + FINISH_MARGIN;
      return {
        settings: normalized,
        splits,
        finishY,
        startY: PLAYER_START_Y,
        startLineY: START_LINE_Y,
        scenery: Road.buildScenery(finishY, 0x5eed1234),
        player: {
          x: Road.PLAYER_CENTER,
          y: PLAYER_START_Y,
          speed: 0,
          boost: 0,
          branch: null,
          vx: 0,
          finishedAt: null,
        },
        opponent: {
          x: Road.OPPONENT_CENTER,
          y: PLAYER_START_Y,
          speed: OPPONENT_SPEED,
          vx: 0,
          finishedAt: null,
        },
        elapsed: 0,
        countdown: 3,
        lastCountdown: 3,
        goTimer: 0,
        currentSplit: null,
        nextSplitIndex: 0,
        correctCount: 0,
        wrongCount: 0,
        result: null,
        resultTimer: 0.8,
        resultShown: false,
        started: false,
      };
    }

    startRace(settings) {
      this.settings = Settings.normalize(settings || this.settings);
      this.race = this.createRace(this.settings);
      this.mode = "countdown";
      this.particles = [];
      this.confetti = [];
      this.flameClock = 0;
      this.dustClock = 0;
      this.ui.hideResult && this.ui.hideResult();
      this.ui.setPrompt && this.ui.setPrompt(false);
      this.ui.setCountdown && this.ui.setCountdown("3");
      this.audio.init();
      this.audio.setEnabled(this.settings.sound);
      this.audio.countdown(3);
    }

    enterChoosing(split) {
      const race = this.race;
      race.currentSplit = split;
      race.player.speed = 0;
      race.player.y = split.y - Road.STOP_OFFSET;
      race.player.x = Road.PLAYER_CENTER;
      race.player.vx = 0;
      this.ui.setPrompt && this.ui.setPrompt(true);
      this.audio.setEngine(true, 0.06);
    }

    choose(side) {
      const race = this.race;
      if (!race || !race.currentSplit) return false;
      const split = race.currentSplit;
      const number = side === "left" ? split.left : split.right;
      const correct = number === split.answer;

      split.resolved = true;
      split.chosenSide = side;
      split.correct = correct;
      split.resolvedAt = this.time;
      race.currentSplit = null;
      race.nextSplitIndex += 1;
      race.player.branch = { split, side, correct };
      race.player.speed = 90;
      race.player.boost = correct ? Math.min(BOOST_MAX, (race.player.boost || 0) + BOOST_TIME) : 0;

      this.ui.setPrompt && this.ui.setPrompt(false);

      if (correct) {
        race.correctCount += 1;
        this.audio.boost();
        this.audio.correct();
        this.ui.showToast &&
          this.ui.showToast("Goed zo! " + split.total + " = " + split.given + " + " + split.answer, "good");
        this.spawnBurst(race.player.x, race.player.y, "boost");
      } else {
        race.wrongCount += 1;
        this.audio.wrong();
        this.ui.showToast &&
          this.ui.showToast("Oei! " + split.total + " = " + split.given + " + " + split.answer, "bad");
        this.spawnBurst(race.player.x, race.player.y - 20, "dust");
      }
      return true;
    }

    handlePointer(x, y) {
      if (this.mode !== "race" || !this.race || !this.race.currentSplit || !this.lastView) {
        return false;
      }
      const view = this.lastView;
      const worldX = view.screenToWorldX(x);
      const worldY = view.screenToWorldY(y);
      const split = this.race.currentSplit;
      const pad = 34;
      for (const side of ["left", "right"]) {
        const rect = Road.cardRect(split, side);
        if (
          worldX >= rect.x - rect.w / 2 - pad &&
          worldX <= rect.x + rect.w / 2 + pad &&
          worldY >= rect.y - rect.h / 2 - pad &&
          worldY <= rect.y + rect.h / 2 + pad
        ) {
          this.choose(side);
          return true;
        }
      }

      // Extra vergevingsgezinde tikzone: de hele aftakking rond de kaarten.
      const geometry = Road.splitGeometry(split);
      if (
        worldY >= geometry.forkY + 140 &&
        worldY <= geometry.forkY + 420 &&
        worldX >= Road.PLAYER_ROAD.left &&
        worldX <= Road.PLAYER_ROAD.right
      ) {
        this.choose(worldX < Road.PLAYER_CENTER ? "left" : "right");
        return true;
      }
      return false;
    }

    handleKey(event) {
      if (this.mode !== "race" || !this.race || !this.race.currentSplit) return;
      const key = event.key;
      if (key === "ArrowLeft" || key === "a" || key === "A") {
        event.preventDefault();
        this.choose("left");
      } else if (key === "ArrowRight" || key === "d" || key === "D") {
        event.preventDefault();
        this.choose("right");
      }
    }

    finishRace() {
      const race = this.race;
      race.result = {
        win: race.opponent.finishedAt === null || race.player.finishedAt < race.opponent.finishedAt,
        correct: race.correctCount,
        wrong: race.wrongCount,
        total: race.splits.length,
      };
      this.mode = "finish";
      race.resultTimer = 0.8;
      race.resultShown = false;
      this.audio.stopEngine();
      this.audio.finish(race.result.win);
      this.ui.setPrompt && this.ui.setPrompt(false);
      if (race.result.win) this.spawnConfetti();
    }

    update(dt, now) {
      const step = Math.min(dt, 0.05);
      this.time += step;

      if (this.mode === "demo") {
        this.demoY += 115 * step;
        if (this.demoY > 13000) this.demoY = 1;
        return;
      }

      if (!this.race) return;

      if (this.mode === "countdown") {
        const race = this.race;
        race.countdown -= step;
        if (race.countdown > 0) {
          const number = Math.ceil(race.countdown);
          if (number !== race.lastCountdown) {
            race.lastCountdown = number;
            this.ui.setCountdown && this.ui.setCountdown(String(number));
            this.audio.countdown(number);
          }
        } else {
          this.mode = "race";
          race.started = true;
          race.goTimer = 0.75;
          this.audio.go();
          this.ui.setCountdown && this.ui.setCountdown("GO!");
        }
        this.updateParticles(step);
        this.updateConfetti(step);
        return;
      }

      if (this.mode === "race") {
        this.updateRace(step);
      } else if (this.mode === "finish") {
        this.updateFinish(step);
      }

      this.updateParticles(step);
      this.updateConfetti(step);
    }

    updateRace(dt) {
      const race = this.race;
      const player = race.player;
      race.elapsed += dt;

      if (race.goTimer > 0) {
        race.goTimer -= dt;
        if (race.goTimer <= 0) this.ui.hideCountdown && this.ui.hideCountdown();
      }

      if (race.opponent.finishedAt === null) {
        race.opponent.y += OPPONENT_SPEED * dt;
        if (race.opponent.y >= race.finishY) {
          race.opponent.y = race.finishY + 44;
          race.opponent.finishedAt = race.elapsed;
        }
      }

      if (race.currentSplit) {
        player.speed = 0;
        this.audio.setEngine(true, 0.07);
        return;
      }

      let target = BASE_SPEED;
      if (player.boost > 0) target = BOOST_SPEED;
      if (player.branch && !player.branch.correct) {
        target = Math.min(target, BASE_SPEED * WRONG_FACTOR);
      }

      const nextSplit = race.splits[race.nextSplitIndex];
      if (nextSplit && !nextSplit.resolved) {
        const stopY = nextSplit.y - Road.STOP_OFFSET;
        const distance = stopY - player.y;
        if (distance <= 2) {
          this.enterChoosing(nextSplit);
          return;
        }
        if (distance < 160) {
          target = Math.min(target, Math.max(55, distance * 4.8));
        }
      }

      const acceleration = target < player.speed ? 2100 : 950;
      player.speed = approach(player.speed, target, acceleration * dt);
      const previousX = player.x;
      player.y += player.speed * dt;

      if (player.boost > 0) player.boost = Math.max(0, player.boost - dt);

      if (player.branch) {
        const split = player.branch.split;
        player.x = Road.branchX(split, player.branch.side, player.y);
        const geometry = Road.splitGeometry(split);
        if (player.y >= geometry.mergeEndY) {
          player.branch = null;
          player.x = Road.PLAYER_CENTER;
        }
      } else {
        player.x = Road.PLAYER_CENTER;
      }
      player.vx = (player.x - previousX) / Math.max(dt, 0.001);

      this.spawnDriveParticles(dt);
      const ratio = player.boost > 0 ? 1 : player.speed / BASE_SPEED;
      this.audio.setEngine(true, clamp(ratio, 0, 1.25));

      if (player.y >= race.finishY) {
        player.y = race.finishY + 40;
        player.finishedAt = race.elapsed;
        this.finishRace();
      }
    }

    updateFinish(dt) {
      const race = this.race;
      if (!race) return;
      if (!race.resultShown) {
        race.resultTimer -= dt;
        if (race.resultTimer <= 0) {
          race.resultShown = true;
          this.ui.showResult && this.ui.showResult(race.result);
        }
      }
    }

    spawnDriveParticles(dt) {
      const race = this.race;
      const player = race.player;
      if (player.boost > 0) {
        this.flameClock -= dt;
        if (this.flameClock <= 0) {
          this.flameClock = 0.028;
          for (let i = 0; i < 2; i += 1) {
            this.particles.push({
              kind: "flame",
              x: player.x + (Math.random() - 0.5) * 34,
              y: player.y - 58,
              vx: (Math.random() - 0.5) * 50,
              vy: -90 - Math.random() * 100,
              life: 0.3 + Math.random() * 0.18,
              maxLife: 0.5,
              size: 7 + Math.random() * 8,
              color: Math.random() < 0.5 ? "#ffd15c" : "#ff7a1a",
            });
          }
        }
      }

      if (player.branch && !player.branch.correct) {
        this.dustClock -= dt;
        if (this.dustClock <= 0) {
          this.dustClock = 0.1;
          this.particles.push({
            kind: "dust",
            x: player.x + (Math.random() - 0.5) * 40,
            y: player.y - 54,
            vx: (Math.random() - 0.5) * 60,
            vy: -20 - Math.random() * 40,
            life: 0.45 + Math.random() * 0.3,
            maxLife: 0.75,
            size: 7 + Math.random() * 9,
            color: "rgba(214, 205, 186, 0.7)",
          });
        }
      }
    }

    spawnBurst(x, y, kind) {
      const count = kind === "boost" ? 26 : 18;
      for (let i = 0; i < count; i += 1) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 60 + Math.random() * 220;
        this.particles.push({
          kind: kind === "boost" ? "spark" : "dust",
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 0.35 + Math.random() * 0.5,
          maxLife: 0.85,
          size: 4 + Math.random() * 7,
          color:
            kind === "boost"
              ? Math.random() < 0.5
                ? "#ffd15c"
                : "#ff7a1a"
              : "rgba(214, 205, 186, 0.8)",
        });
      }
    }

    updateParticles(dt) {
      const next = [];
      for (const particle of this.particles) {
        particle.life -= dt;
        if (particle.life <= 0) continue;
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        particle.vx *= 1 - 1.8 * dt;
        particle.vy *= 1 - 1.8 * dt;
        if (particle.kind === "flame" || particle.kind === "spark") {
          particle.size *= 1 - 1.2 * dt;
        }
        next.push(particle);
      }
      this.particles = next.slice(-220);
    }

    spawnConfetti() {
      const colors = ["#ffd15c", "#e5672b", "#1f9d55", "#1f7fbf", "#f4f4ee", "#d9412b"];
      for (let i = 0; i < 180; i += 1) {
        this.confetti.push({
          x: Math.random() * this.cssW,
          y: -Math.random() * this.cssH * 0.6 - 20,
          vx: (Math.random() - 0.5) * 120,
          vy: 90 + Math.random() * 260,
          size: 6 + Math.random() * 9,
          color: colors[Math.floor(Math.random() * colors.length)],
          rot: Math.random() * Math.PI * 2,
          vr: (Math.random() - 0.5) * 10,
        });
      }
    }

    updateConfetti(dt) {
      if (!this.confetti.length) return;
      const next = [];
      for (const piece of this.confetti) {
        piece.vy += 190 * dt;
        piece.x += piece.vx * dt;
        piece.y += piece.vy * dt;
        piece.rot += piece.vr * dt;
        if (piece.y < this.cssH + 40) next.push(piece);
      }
      this.confetti = next;
    }

    draw() {
      const ctx = this.ctx;
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.clearRect(0, 0, this.cssW, this.cssH);

      if (this.mode === "demo" || !this.race) {
        this.drawDemo(ctx);
        return;
      }

      const race = this.race;
      const view = this.viewFor(race.player.y);
      this.lastView = view;

      Road.drawWorld(ctx, view, race, this.images, this.time);
      this.drawParticles(ctx, view);
      this.drawCar(ctx, view, race.opponent, this.images.car_opponent, false);
      this.drawCar(ctx, view, race.player, this.images.car_player, true);
      Road.drawOverlays(ctx, view, race, this.time);

      this.drawHud(ctx, view);
      if (this.mode === "finish") this.drawConfetti(ctx);
    }

    drawDemo(ctx) {
      const playerY = 500 + this.demoY;
      const view = this.viewFor(playerY, 0.9);
      this.lastView = view;
      const demoRace = {
        splits: [],
        scenery: this.demoScenery,
        startLineY: START_LINE_Y,
        finishY: null,
      };
      Road.drawWorld(ctx, view, demoRace, this.images, this.time);

      const opponent = { x: Road.OPPONENT_CENTER, y: playerY + 210, vx: 0, boost: 0 };
      const player = { x: Road.PLAYER_CENTER, y: playerY, vx: 0, boost: 0 };
      this.drawCar(ctx, view, opponent, this.images.car_opponent, false);
      this.drawCar(ctx, view, player, this.images.car_player, true);
    }

    drawCar(ctx, view, car, image, isPlayer) {
      const scale = view.scale;
      const carWidth = 71 * 0.94 * scale;
      const carHeight = 131 * 0.94 * scale;
      const x = view.sx(car.x);
      const y = view.sy(car.y);

      // Schaduw.
      ctx.save();
      ctx.fillStyle = "rgba(17, 45, 34, 0.28)";
      ctx.beginPath();
      ctx.ellipse(x, y + 5 * scale, carWidth * 0.58, carHeight * 0.47, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      const boosting = isPlayer && car.boost > 0 && !(this.race && this.race.currentSplit);
      if (boosting) {
        this.drawFlames(ctx, x, y, carWidth, carHeight, scale);
      }

      const rotation = isPlayer ? clamp((car.vx || 0) * 0.00055, -0.2, 0.2) : 0;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);
      if (image) {
        ctx.drawImage(image, -carWidth / 2, -carHeight / 2, carWidth, carHeight);
      } else {
        ctx.fillStyle = isPlayer ? COLORS.player : COLORS.opponent;
        ctx.beginPath();
        ctx.roundRect(-carWidth / 2, -carHeight / 2, carWidth, carHeight, 12 * scale);
        ctx.fill();
        ctx.fillStyle = "#f2f7f6";
        ctx.beginPath();
        ctx.roundRect(-carWidth * 0.32, -carHeight * 0.32, carWidth * 0.64, carHeight * 0.2, 6 * scale);
        ctx.fill();
      }
      ctx.restore();

      if (boosting) {
        ctx.save();
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.font = "900 " + Math.round(20 * scale) + "px " + FONT;
        ctx.lineWidth = 4 * scale;
        ctx.strokeStyle = "rgba(20, 50, 32, 0.65)";
        ctx.strokeText("BOOST!", x, y - carHeight * 0.64);
        ctx.fillStyle = "#ffd15c";
        ctx.fillText("BOOST!", x, y - carHeight * 0.64);
        ctx.restore();
      }
    }

    drawFlames(ctx, x, y, width, height, scale) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const baseY = y + height * 0.38;
      for (let i = -2; i <= 2; i += 1) {
        const flicker = 0.65 + 0.35 * Math.sin(this.time * 34 + i * 2.1);
        const flameWidth = (6 + Math.abs(i) * -0.6) * scale;
        const flameHeight = (18 + 24 * flicker) * scale;
        ctx.fillStyle = i % 2 === 0 ? "rgba(255, 122, 26, 0.9)" : "rgba(255, 209, 92, 0.95)";
        ctx.beginPath();
        ctx.moveTo(x + i * 10 * scale, baseY);
        ctx.lineTo(x + i * 10 * scale - flameWidth, baseY + flameHeight);
        ctx.lineTo(x + i * 10 * scale + flameWidth, baseY + flameHeight);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    drawParticles(ctx, view) {
      if (!this.particles.length) return;
      ctx.save();
      for (const particle of this.particles) {
        const alpha = clamp(particle.life / particle.maxLife, 0, 1);
        const x = view.sx(particle.x);
        const y = view.sy(particle.y);
        const size = Math.max(0.5, particle.size * view.scale);
        ctx.globalAlpha = alpha;
        ctx.globalCompositeOperation =
          particle.kind === "flame" || particle.kind === "spark" ? "lighter" : "source-over";
        ctx.fillStyle = particle.color;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    drawHud(ctx, view) {
      const race = this.race;
      if (!race) return;
      const barX = view.cssW - 30;
      const top = 92;
      const bottom = view.cssH - 84;
      const height = bottom - top;
      if (height < 120) return;

      ctx.save();
      ctx.fillStyle = "rgba(7, 42, 25, 0.5)";
      ctx.beginPath();
      ctx.roundRect(barX - 8, top - 44, 16, height + 58, 8);
      ctx.fill();

      ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
      ctx.beginPath();
      ctx.roundRect(barX - 4, top, 8, height, 4);
      ctx.fill();

      const progress = (value) =>
        clamp((value - race.startY) / (race.finishY - race.startY), 0, 1);
      const playerProgress = progress(race.player.y);
      const opponentProgress = progress(race.opponent.y);

      ctx.fillStyle = COLORS.player;
      ctx.beginPath();
      ctx.roundRect(barX - 4, bottom - height * playerProgress, 8, height * playerProgress, 4);
      ctx.fill();

      const playerY = bottom - height * playerProgress;
      const opponentY = bottom - height * opponentProgress;

      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.92)";
      ctx.fillStyle = COLORS.player;
      ctx.beginPath();
      ctx.arc(barX, playerY, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = COLORS.opponent;
      ctx.beginPath();
      ctx.moveTo(barX, opponentY - 9);
      ctx.lineTo(barX + 9, opponentY + 7);
      ctx.lineTo(barX - 9, opponentY + 7);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.92)";
      ctx.stroke();

      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.font = "800 14px " + FONT;

      ctx.fillStyle = COLORS.player;
      ctx.beginPath();
      ctx.arc(barX - 48, top + 10, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#d9f2e1";
      ctx.fillText("Jij", barX - 16, top + 10);

      ctx.fillStyle = COLORS.opponent;
      ctx.beginPath();
      ctx.arc(barX - 66, top + 30, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffd3b8";
      ctx.fillText("Tegen", barX - 16, top + 30);

      ctx.fillStyle = "#f4f4ee";
      ctx.fillRect(barX - 6, top - 2, 12, 12);
      ctx.fillStyle = "#243336";
      ctx.fillRect(barX - 6, top - 2, 6, 6);
      ctx.fillRect(barX, top + 4, 6, 6);

      ctx.restore();
    }

    drawConfetti(ctx) {
      ctx.save();
      for (const piece of this.confetti) {
        ctx.save();
        ctx.translate(piece.x, piece.y);
        ctx.rotate(piece.rot);
        ctx.fillStyle = piece.color;
        ctx.fillRect(-piece.size / 2, -piece.size / 2, piece.size, piece.size * 0.62);
        ctx.restore();
      }
      ctx.restore();
    }
  }

  NS.Game = Game;
})();
