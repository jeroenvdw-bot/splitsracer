(function () {
  "use strict";

  const NS = (window.Splitsracer = window.Splitsracer || {});

  class AudioEngine {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.enabled = true;
      this.engine = null;
      this.engineActive = false;
    }

    init() {
      if (this.ctx) {
        if (this.ctx.state === "suspended") this.ctx.resume();
        return true;
      }
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return false;

      try {
        this.ctx = new AudioContextClass();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.enabled ? 0.65 : 0;
        this.master.connect(this.ctx.destination);

        const oscillator = this.ctx.createOscillator();
        oscillator.type = "sawtooth";
        oscillator.frequency.value = 52;

        const filter = this.ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = 320;
        filter.Q.value = 2.5;

        const gain = this.ctx.createGain();
        gain.gain.value = 0;

        oscillator.connect(filter);
        filter.connect(gain);
        gain.connect(this.master);
        oscillator.start();

        this.engine = { oscillator, filter, gain };
      } catch (error) {
        this.ctx = null;
        this.master = null;
        this.engine = null;
        return false;
      }
      return true;
    }

    setEnabled(enabled) {
      this.enabled = Boolean(enabled);
      if (this.master && this.ctx) {
        this.master.gain.setTargetAtTime(this.enabled ? 0.65 : 0, this.ctx.currentTime, 0.04);
      }
    }

    setEngine(active, ratio) {
      if (!this.ctx || !this.engine) return;
      if (!active) {
        if (this.engineActive) {
          this.engine.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.08);
          this.engineActive = false;
        }
        return;
      }
      const value = Math.max(0, Math.min(1, ratio || 0));
      this.engineActive = true;
      this.engine.oscillator.frequency.setTargetAtTime(46 + 92 * value, this.ctx.currentTime, 0.09);
      this.engine.filter.frequency.setTargetAtTime(240 + 900 * value, this.ctx.currentTime, 0.09);
      this.engine.gain.gain.setTargetAtTime(this.enabled ? 0.055 : 0, this.ctx.currentTime, 0.07);
    }

    tone(frequency, duration, options) {
      if (!this.ctx || !this.master) return;
      const config = options || {};
      const type = config.type || "sine";
      const volume = config.volume === undefined ? 0.18 : config.volume;
      const delay = config.delay || 0;
      const endFrequency = config.endFrequency;
      const attack = config.attack === undefined ? 0.012 : config.attack;

      const start = this.ctx.currentTime + delay;
      const oscillator = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      oscillator.type = type;
      oscillator.frequency.setValueAtTime(Math.max(20, frequency), start);
      if (endFrequency) {
        oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), start + duration);
      }

      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), start + attack);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

      oscillator.connect(gain);
      gain.connect(this.master);
      oscillator.start(start);
      oscillator.stop(start + duration + 0.03);
    }

    countdown(n) {
      if (!this.ctx) return;
      this.tone(n > 1 ? 520 : 660, 0.11, { type: "square", volume: 0.12 });
    }

    go() {
      if (!this.ctx) return;
      this.tone(880, 0.32, { type: "square", volume: 0.14 });
    }

    boost() {
      if (!this.ctx) return;
      this.tone(180, 0.42, { type: "sawtooth", volume: 0.14, endFrequency: 980 });
      this.tone(360, 0.3, { type: "triangle", volume: 0.09, endFrequency: 1400, delay: 0.04 });
    }

    correct() {
      if (!this.ctx) return;
      this.tone(523.25, 0.22, { type: "triangle", volume: 0.18 });
      this.tone(659.25, 0.22, { type: "triangle", volume: 0.18, delay: 0.09 });
      this.tone(783.99, 0.32, { type: "triangle", volume: 0.2, delay: 0.18 });
    }

    wrong() {
      if (!this.ctx) return;
      this.tone(220, 0.18, { type: "square", volume: 0.12, endFrequency: 150 });
      this.tone(196, 0.26, { type: "square", volume: 0.12, delay: 0.17, endFrequency: 120 });
    }

    finish(win) {
      if (!this.ctx) return;
      if (win) {
        const notes = [523.25, 659.25, 783.99, 1046.5];
        notes.forEach((frequency, index) => {
          this.tone(frequency, 0.42, { type: "triangle", volume: 0.2, delay: index * 0.13 });
        });
        this.tone(1318.5, 0.65, { type: "sine", volume: 0.12, delay: 0.56 });
      } else {
        const notes = [392, 329.63, 261.63];
        notes.forEach((frequency, index) => {
          this.tone(frequency, 0.34, {
            type: "triangle",
            volume: 0.16,
            delay: index * 0.22,
            endFrequency: frequency * 0.92,
          });
        });
      }
    }

    stopEngine() {
      this.setEngine(false);
    }
  }

  NS.AudioEngine = AudioEngine;
})();
