/* ============================================================
   NIRO CITY — Audio: موتور، لاستیک، باد، افکت‌ها (Web Audio)
   تمام صداها به‌صورت زنده سنتز می‌شوند؛ هیچ فایل صدایی لازم نیست.
   ============================================================ */
(function (root) {
  'use strict';

  function AudioEngine() {
    this.ctx = null;
    this.master = null;
    this.sfxBus = null;
    this.musicBus = null;
    this.muted = false;
    this.musicMuted = false;
    this.masterVol = 0.85;
    this.sfxVol = 0.90;
    this.musicVol = 0.55;
    this.carProfile = { baseFreq: 55, mult: 1.0, wave1: 'sawtooth', wave2: 'square' };
    this.engine = null;      // {osc1, osc2, noise, filter, gain, }
    this.screechGain = null;
    this.windGain = null;
    this.menuPad = null;
    this.raceMusicTimer = null;
    this._ready = false;
  }

  AudioEngine.prototype.init = function () {
    if (this._ready) return true;
    var AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return false;
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : this.masterVol;
      this.master.connect(this.ctx.destination);

      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.value = this.sfxVol;
      this.sfxBus.connect(this.master);

      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = this.musicMuted ? 0 : this.musicVol;
      this.musicBus.connect(this.master);

      this._buildNoiseBuffer();
      this._buildEngine();
      this._buildScreech();
      this._buildWind();
      this._ready = true;
      return true;
    } catch (e) {
      return false;
    }
  };

  AudioEngine.prototype.resume = function () {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  };

  AudioEngine.prototype.setMuted = function (m) {
    this.muted = !!m;
    if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : this.masterVol, this.ctx.currentTime, 0.05);
  };
  AudioEngine.prototype.setMasterVolume = function (v) {
    this.masterVol = Math.max(0, Math.min(1, v));
    if (this.master && !this.muted) this.master.gain.setTargetAtTime(this.masterVol, this.ctx.currentTime, 0.05);
  };
  AudioEngine.prototype.setSfxVolume = function (v) {
    this.sfxVol = Math.max(0, Math.min(1, v));
    if (this.sfxBus) this.sfxBus.gain.setTargetAtTime(this.sfxVol, this.ctx.currentTime, 0.05);
  };
  AudioEngine.prototype.setMusicVolume = function (v) {
    this.musicVol = Math.max(0, Math.min(1, v));
    if (this.musicBus && !this.musicMuted) this.musicBus.gain.setTargetAtTime(this.musicVol, this.ctx.currentTime, 0.05);
  };
  AudioEngine.prototype.setMusicMuted = function (m) {
    this.musicMuted = !!m;
    if (this.musicBus) this.musicBus.gain.setTargetAtTime(this.musicMuted ? 0 : this.musicVol, this.ctx.currentTime, 0.08);
  };
  AudioEngine.prototype.setCarProfile = function (cls) {
    var profiles = {
      muscle:  { baseFreq: 42, mult: 0.78, wave1: 'sawtooth', wave2: 'square' },
      classic: { baseFreq: 48, mult: 0.88, wave1: 'sawtooth', wave2: 'triangle' },
      luxury:  { baseFreq: 52, mult: 0.95, wave1: 'triangle', wave2: 'sawtooth' },
      sports:  { baseFreq: 58, mult: 1.05, wave1: 'sawtooth', wave2: 'square' },
      racing:  { baseFreq: 66, mult: 1.20, wave1: 'sawtooth', wave2: 'sawtooth' },
      super:   { baseFreq: 68, mult: 1.25, wave1: 'sawtooth', wave2: 'triangle' },
      hyper:   { baseFreq: 74, mult: 1.38, wave1: 'sawtooth', wave2: 'sawtooth' }
    };
    this.carProfile = profiles[cls] || profiles.sports;
    if (this.engine) {
      this.engine.o1.type = this.carProfile.wave1;
      this.engine.o2.type = this.carProfile.wave2;
    }
  };

  AudioEngine.prototype._buildNoiseBuffer = function () {
    var len = this.ctx.sampleRate * 1.5;
    this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    var data = this.noiseBuffer.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  };

  /* ---------- موتور: دو اسیلاتور دتیون + نویز اگزوز ---------- */
  AudioEngine.prototype._buildEngine = function () {
    var ctx = this.ctx;
    var gain = ctx.createGain(); gain.gain.value = 0.0;
    var filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 900; filter.Q.value = 8;
    var o1 = ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 70;
    var o2 = ctx.createOscillator(); o2.type = 'square';   o2.frequency.value = 35;
    var g2 = ctx.createGain(); g2.gain.value = 0.5;
    var noise = ctx.createBufferSource(); noise.buffer = this.noiseBuffer; noise.loop = true;
    var nFilter = ctx.createBiquadFilter(); nFilter.type = 'bandpass'; nFilter.frequency.value = 300; nFilter.Q.value = 0.8;
    var nGain = ctx.createGain(); nGain.gain.value = 0.35;
    o1.connect(filter); o2.connect(g2); g2.connect(filter);
    noise.connect(nFilter); nFilter.connect(nGain); nGain.connect(filter);
    filter.connect(gain); gain.connect(this.master);
    o1.start(); o2.start(); noise.start();
    this.engine = { o1: o1, o2: o2, filter: filter, gain: gain, noise: noise, nFilter: nFilter };
  };

  /* پارامترها: rpm01 (0..1), throttle (0..1), speed01 */
  AudioEngine.prototype.updateEngine = function (rpm01, throttle, speed01, drifting) {
    if (!this._ready) return;
    var t = this.ctx.currentTime;
    var e = this.engine;
    var p = this.carProfile || { baseFreq: 55, mult: 1.0 };
    var freq = p.baseFreq + Math.pow(rpm01, 1.55) * 640 * p.mult;
    e.o1.frequency.setTargetAtTime(freq, t, 0.06);
    e.o2.frequency.setTargetAtTime(freq * 0.5, t, 0.06);
    e.filter.frequency.setTargetAtTime(320 + rpm01 * 2600 + throttle * 900, t, 0.08);
    e.nFilter.frequency.setTargetAtTime(200 + rpm01 * 1400, t, 0.1);
    var vol = 0.10 + rpm01 * 0.16 + throttle * 0.22;
    if (drifting) vol += 0.03;
    e.gain.gain.setTargetAtTime(vol, t, 0.07);
  };

  AudioEngine.prototype.engineIdle = function () {
    if (this._ready) this.updateEngine(0.06, 0, 0, false);
  };

  /* ---------- جیغ لاستیک ---------- */
  AudioEngine.prototype._buildScreech = function () {
    var ctx = this.ctx;
    var src = ctx.createBufferSource(); src.buffer = this.noiseBuffer; src.loop = true;
    var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 950; bp.Q.value = 6;
    var g = ctx.createGain(); g.gain.value = 0;
    src.connect(bp); bp.connect(g); g.connect(this.master);
    src.start();
    this.screechGain = g; this.screechFilter = bp;
  };
  AudioEngine.prototype.setScreech = function (amount) {
    if (!this._ready) return;
    var t = this.ctx.currentTime;
    this.screechGain.gain.setTargetAtTime(Math.min(0.5, amount * 0.42), t, 0.05);
    this.screechFilter.frequency.setTargetAtTime(750 + amount * 750, t, 0.08);
  };

  /* ---------- باد ---------- */
  AudioEngine.prototype._buildWind = function () {
    var ctx = this.ctx;
    var src = ctx.createBufferSource(); src.buffer = this.noiseBuffer; src.loop = true;
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 400; lp.Q.value = 0.5;
    var g = ctx.createGain(); g.gain.value = 0;
    src.connect(lp); lp.connect(g); g.connect(this.master);
    src.start();
    this.windGain = g; this.windFilter = lp;
  };
  AudioEngine.prototype.setWind = function (speed01) {
    if (!this._ready) return;
    var t = this.ctx.currentTime;
    this.windGain.gain.setTargetAtTime(speed01 * speed01 * 0.34, t, 0.15);
    this.windFilter.frequency.setTargetAtTime(250 + speed01 * 900, t, 0.2);
  };

  /* ---------- افکت‌های تک‌ضربه‌ای ---------- */
  function blip(ctx, dest, type, freq, dur, vol, when) {
    var t = when || ctx.currentTime;
    var o = ctx.createOscillator(); o.type = type; o.frequency.value = freq;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest);
    o.start(t); o.stop(t + dur + 0.02);
  }

  AudioEngine.prototype.click = function () {
    if (!this._ready) return;
    blip(this.ctx, this.master, 'triangle', 1400, 0.06, 0.10);
  };
  AudioEngine.prototype.beep = function (final) {
    if (!this._ready) return;
    var t = this.ctx.currentTime;
    blip(this.ctx, this.master, 'square', final ? 880 : 440, final ? 0.5 : 0.28, 0.30, t);
  };
  AudioEngine.prototype.coin = function () {
    if (!this._ready) return;
    var t = this.ctx.currentTime;
    blip(this.ctx, this.master, 'sine', 880, 0.12, 0.22, t);
    blip(this.ctx, this.master, 'sine', 1320, 0.22, 0.22, t + 0.09);
  };
  AudioEngine.prototype.denied = function () {
    if (!this._ready) return;
    blip(this.ctx, this.master, 'sawtooth', 160, 0.25, 0.16);
  };
  AudioEngine.prototype.crash = function (strength) {
    if (!this._ready) return;
    strength = strength || 0.5;
    var ctx = this.ctx, t = ctx.currentTime;
    var src = ctx.createBufferSource(); src.buffer = this.noiseBuffer;
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(900, t); lp.frequency.exponentialRampToValueAtTime(80, t + 0.35);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.6 * strength, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    src.connect(lp); lp.connect(g); g.connect(this.master);
    src.start(t); src.stop(t + 0.45);
    var o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(38, t + 0.3);
    var og = ctx.createGain();
    og.gain.setValueAtTime(0.5 * strength, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    o.connect(og); og.connect(this.master); o.start(t); o.stop(t + 0.4);
  };
  AudioEngine.prototype.win = function () {
    if (!this._ready) return;
    var t = this.ctx.currentTime;
    var notes = [523, 659, 784, 1046];
    for (var i = 0; i < notes.length; i++) blip(this.ctx, this.master, 'triangle', notes[i], 0.4, 0.26, t + i * 0.17);
  };
  AudioEngine.prototype.countGo = function () { this.beep(true); };
  AudioEngine.prototype.gearShift = function () {
    if (!this._ready) return;
    var t = this.ctx.currentTime;
    blip(this.ctx, this.sfxBus || this.master, 'square', 280, 0.05, 0.09, t);
    // turbo blow-off hiss
    var src = this.ctx.createBufferSource(); src.buffer = this.noiseBuffer;
    var bp = this.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.setValueAtTime(2400, t); bp.frequency.exponentialRampToValueAtTime(900, t + 0.14);
    var g = this.ctx.createGain(); g.gain.setValueAtTime(0.08, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    src.connect(bp); bp.connect(g); g.connect(this.sfxBus || this.master);
    src.start(t); src.stop(t + 0.16);
  };

  AudioEngine.prototype.playCarSelect = function () {
    if (!this._ready) return;
    var t = this.ctx.currentTime;
    blip(this.ctx, this.sfxBus || this.master, 'sine', 520, 0.07, 0.08, t);
    blip(this.ctx, this.sfxBus || this.master, 'triangle', 780, 0.09, 0.11, t + 0.05);
  };

  AudioEngine.prototype.playEngineStart = function () {
    if (!this._ready) return;
    var ctx = this.ctx, t = ctx.currentTime, bus = this.sfxBus || this.master;
    var p = this.carProfile || { baseFreq: 55, mult: 1.0 };
    // Starter crank
    for (var i = 0; i < 3; i++) {
      blip(ctx, bus, 'sawtooth', 95, 0.06, 0.07, t + i * 0.09);
    }
    // Ignition roar
    var o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(p.baseFreq * 0.9, t + 0.28);
    o.frequency.exponentialRampToValueAtTime(p.baseFreq * 2.4 * p.mult, t + 0.55);
    o.frequency.exponentialRampToValueAtTime(p.baseFreq * 1.15, t + 1.05);
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 650;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.001, t + 0.26);
    g.gain.linearRampToValueAtTime(0.24, t + 0.42);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.15);
    o.connect(lp); lp.connect(g); g.connect(bus);
    o.start(t + 0.26); o.stop(t + 1.2);
  };

  /* ---------- پد محیطی منو (بسیار ملایم) ---------- */
  AudioEngine.prototype.startMenuPad = function () {
    if (!this._ready || this.menuPad) return;
    var ctx = this.ctx;
    var g = ctx.createGain(); g.gain.value = 0.08;
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 340; lp.Q.value = 4;
    var o1 = ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 55;
    var o2 = ctx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = 55 * 1.5 + 0.4;
    var lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
    var lfoGain = ctx.createGain(); lfoGain.gain.value = 180;
    lfo.connect(lfoGain); lfoGain.connect(lp.frequency);
    o1.connect(lp); o2.connect(lp); lp.connect(g); g.connect(this.musicBus || this.master);
    o1.start(); o2.start(); lfo.start();
    this.menuPad = { o1: o1, o2: o2, lfo: lfo, gain: g };
  };
  AudioEngine.prototype.stopMenuPad = function () {
    if (!this.menuPad) return;
    try {
      var p = this.menuPad, t = this.ctx.currentTime;
      p.gain.gain.setTargetAtTime(0, t, 0.4);
      setTimeout(function () { try { p.o1.stop(); p.o2.stop(); p.lfo.stop(); } catch (e) {} }, 1200);
    } catch (e) {}
    this.menuPad = null;
  };

  /* ---------- موسیقی هیجان‌انگیز مسابقه ---------- */
  AudioEngine.prototype.startRaceMusic = function () {
    if (!this._ready || this.raceMusicTimer) return;
    var self = this, step = 0;
    var bassNotes = [55, 55, 65.4, 55, 73.4, 55, 82.4, 65.4];
    var arpNotes  = [220, 261.6, 329.6, 392, 329.6, 261.6, 440, 392];
    this.raceMusicTimer = setInterval(function () {
      if (!self._ready || self.muted || self.musicMuted) return;
      var ctx = self.ctx, t = ctx.currentTime, bus = self.musicBus || self.master;
      var bn = bassNotes[step % bassNotes.length];
      var an = arpNotes[step % arpNotes.length];
      // Driving synth bass
      blip(ctx, bus, 'sawtooth', bn, 0.11, 0.14, t);
      // Arp lead
      if (step % 2 === 0) blip(ctx, bus, 'triangle', an, 0.05, 0.11, t);
      // Kick on 0, 4
      if (step % 4 === 0) {
        var ko = ctx.createOscillator(); ko.type = 'sine';
        ko.frequency.setValueAtTime(130, t); ko.frequency.exponentialRampToValueAtTime(38, t + 0.12);
        var kg = ctx.createGain(); kg.gain.setValueAtTime(0.22, t); kg.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
        ko.connect(kg); kg.connect(bus); ko.start(t); ko.stop(t + 0.15);
      }
      step++;
    }, 155);
  };
  AudioEngine.prototype.stopRaceMusic = function () {
    if (this.raceMusicTimer) { clearInterval(this.raceMusicTimer); this.raceMusicTimer = null; }
  };

  root.NitroAudio = { AudioEngine: AudioEngine };
})(typeof window !== 'undefined' ? window : globalThis);
