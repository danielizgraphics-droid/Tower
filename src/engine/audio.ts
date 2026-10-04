/**
 * Procedural audio: every sound effect and the background music are synthesised
 * with WebAudio, so the game ships with zero audio assets.
 */
export type SfxName =
  | 'arrow'
  | 'bolt'
  | 'cannon'
  | 'magic'
  | 'zap'
  | 'fire'
  | 'frost'
  | 'holy'
  | 'shadow'
  | 'poison'
  | 'explosion'
  | 'kill'
  | 'coin'
  | 'build'
  | 'upgrade'
  | 'sell'
  | 'leak'
  | 'waveStart'
  | 'boss'
  | 'victory'
  | 'defeat'
  | 'click'
  | 'hover'
  | 'augment'
  | 'error'
  | 'spell'
  | 'shield';

const THROTTLE: Partial<Record<SfxName, number>> = {
  arrow: 0.05, bolt: 0.06, cannon: 0.08, magic: 0.06, zap: 0.07, fire: 0.12, frost: 0.07, holy: 0.08, shadow: 0.08,
  poison: 0.09, explosion: 0.07, kill: 0.04, coin: 0.05, hover: 0.04, shield: 0.1,
};

// D dorian-ish scale (MIDI)
const SCALE = [62, 64, 65, 67, 69, 71, 72, 74, 76, 77, 79];
const CHORDS = [
  [50, 57, 62, 65],
  [48, 55, 60, 64],
  [46, 53, 58, 62],
  [48, 55, 60, 67],
];
const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfx!: GainNode;
  private music!: GainNode;
  private noise!: AudioBuffer;
  private last = new Map<SfxName, number>();
  private sfxVol = 0.7;
  private musicVol = 0.4;
  private musicTimer: number | null = null;
  private nextNote = 0;
  private step = 0;
  private musicOn = false;
  /** 0 = calm (menu), 1 = battle. */
  intensity = 0;

  /** Must be called from a user gesture (browser autoplay policy). */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 6;
    this.master.connect(comp).connect(ctx.destination);
    this.sfx = ctx.createGain();
    this.sfx.gain.value = this.sfxVol;
    this.sfx.connect(this.master);
    this.music = ctx.createGain();
    this.music.gain.value = this.musicVol * 0.5;
    this.music.connect(this.master);
    const len = ctx.sampleRate;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    if (this.musicOn) this.startMusic();
  }

  setVolumes(sfx: number, music: number): void {
    this.sfxVol = sfx;
    this.musicVol = music;
    if (!this.ctx) return;
    this.sfx.gain.setTargetAtTime(sfx, this.ctx.currentTime, 0.05);
    this.music.gain.setTargetAtTime(music * 0.5, this.ctx.currentTime, 0.2);
  }

  // ------------------------------------------------------------ primitives

  private tone(type: OscillatorType, f0: number, f1: number, dur: number, vol: number, delay = 0, dest?: AudioNode): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest ?? this.sfx);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private hiss(dur: number, vol: number, filter: BiquadFilterType, f0: number, f1 = f0, q = 1, delay = 0): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const bq = ctx.createBiquadFilter();
    bq.type = filter;
    bq.Q.value = q;
    bq.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) bq.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bq).connect(g).connect(this.sfx);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  play(name: SfxName): void {
    if (!this.ctx || this.sfxVol <= 0) return;
    const now = this.ctx.currentTime;
    const th = THROTTLE[name];
    if (th) {
      const l = this.last.get(name) ?? -1;
      if (now - l < th) return;
      this.last.set(name, now);
    }
    const r = () => 0.92 + Math.random() * 0.16;
    switch (name) {
      case 'arrow':
        this.hiss(0.09, 0.18, 'bandpass', 2600 * r(), 900, 2);
        break;
      case 'bolt':
        this.hiss(0.12, 0.25, 'bandpass', 1400 * r(), 400, 1.5);
        this.tone('triangle', 180, 90, 0.1, 0.15);
        break;
      case 'cannon':
        this.tone('sine', 120 * r(), 45, 0.35, 0.5);
        this.hiss(0.3, 0.3, 'lowpass', 900, 150);
        break;
      case 'magic':
        this.tone('sine', 520 * r(), 980, 0.18, 0.12);
        this.tone('triangle', 1040 * r(), 1500, 0.14, 0.05, 0.02);
        break;
      case 'zap':
        this.tone('sawtooth', 900 * r(), 220, 0.12, 0.08);
        this.hiss(0.1, 0.18, 'highpass', 3000, 5000, 0.7);
        break;
      case 'fire':
        this.hiss(0.25, 0.12, 'bandpass', 700 * r(), 400, 0.8);
        break;
      case 'frost':
        this.tone('triangle', 1400 * r(), 1900, 0.15, 0.07);
        this.tone('sine', 2100 * r(), 2600, 0.12, 0.04, 0.03);
        break;
      case 'holy':
        this.tone('sine', 880 * r(), 880, 0.35, 0.08);
        this.tone('sine', 1320 * r(), 1320, 0.3, 0.05, 0.01);
        break;
      case 'shadow':
        this.tone('sawtooth', 300 * r(), 90, 0.25, 0.07);
        break;
      case 'poison':
        this.tone('sine', 300 * r(), 600, 0.08, 0.1);
        this.tone('sine', 420 * r(), 800, 0.07, 0.07, 0.07);
        break;
      case 'explosion':
        this.tone('sine', 90 * r(), 35, 0.45, 0.45);
        this.hiss(0.45, 0.35, 'lowpass', 1600, 120);
        break;
      case 'kill':
        this.tone('triangle', 520 * r(), 260, 0.08, 0.08);
        break;
      case 'coin':
        this.tone('square', 1320, 1320, 0.06, 0.04);
        this.tone('square', 1760, 1760, 0.12, 0.04, 0.06);
        break;
      case 'build':
        this.tone('sine', 140, 80, 0.18, 0.4);
        this.hiss(0.15, 0.2, 'lowpass', 1200, 300);
        this.tone('triangle', 660, 660, 0.12, 0.07, 0.12);
        break;
      case 'upgrade':
        [0, 4, 7, 12].forEach((s, i) => this.tone('triangle', midi(67 + s), midi(67 + s), 0.18, 0.09, i * 0.06));
        break;
      case 'sell':
        [12, 7, 0].forEach((s, i) => this.tone('triangle', midi(64 + s), midi(64 + s), 0.14, 0.08, i * 0.06));
        break;
      case 'leak':
        this.tone('sine', 110, 55, 0.4, 0.45);
        this.tone('square', 330, 330, 0.12, 0.05, 0.05);
        break;
      case 'waveStart':
        this.horn([62, 69], 0.32, 0.12);
        break;
      case 'boss':
        this.horn([50, 50, 53, 50], 0.4, 0.16);
        this.tone('sine', 55, 40, 1.4, 0.4);
        break;
      case 'victory':
        [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => this.tone('triangle', midi(60 + s), midi(60 + s), 0.4, 0.1, i * 0.09));
        break;
      case 'defeat':
        [12, 8, 5, 0].forEach((s, i) => this.tone('triangle', midi(57 + s), midi(57 + s), 0.5, 0.1, i * 0.22));
        break;
      case 'click':
        this.tone('triangle', 900, 700, 0.05, 0.06);
        break;
      case 'hover':
        this.tone('sine', 1200, 1200, 0.03, 0.025);
        break;
      case 'augment':
        [0, 4, 7, 11, 14].forEach((s, i) => this.tone('sine', midi(72 + s), midi(72 + s), 0.6, 0.06, i * 0.05));
        break;
      case 'error':
        this.tone('square', 200, 160, 0.12, 0.06);
        break;
      case 'spell':
        this.tone('sawtooth', 200, 800, 0.4, 0.06);
        this.hiss(0.5, 0.15, 'bandpass', 600, 3000, 1);
        break;
      case 'shield':
        this.tone('triangle', 1800, 600, 0.15, 0.06);
        break;
    }
  }

  private horn(notes: number[], len: number, vol: number): void {
    const ctx = this.ctx!;
    notes.forEach((n, i) => {
      const t = ctx.currentTime + i * len * 0.9;
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = midi(n);
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.setValueAtTime(400, t);
      f.frequency.linearRampToValueAtTime(1600, t + 0.08);
      f.frequency.linearRampToValueAtTime(700, t + len);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.05);
      g.gain.setValueAtTime(vol, t + len * 0.7);
      g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      o.connect(f).connect(g).connect(this.sfx);
      o.start(t);
      o.stop(t + len + 0.05);
    });
  }

  // ------------------------------------------------------------ music

  startMusic(): void {
    this.musicOn = true;
    if (!this.ctx || this.musicTimer !== null) return;
    this.nextNote = this.ctx.currentTime + 0.1;
    this.musicTimer = window.setInterval(() => this.schedule(), 120);
  }

  stopMusic(): void {
    this.musicOn = false;
    if (this.musicTimer !== null) clearInterval(this.musicTimer);
    this.musicTimer = null;
  }

  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx || this.musicVol <= 0) return;
    const beat = 60 / (78 + this.intensity * 18) / 2; // eighth notes
    while (this.nextNote < ctx.currentTime + 0.4) {
      const t = this.nextNote;
      const bar = Math.floor(this.step / 8) % CHORDS.length;
      const inBar = this.step % 8;
      if (inBar === 0) this.pad(CHORDS[bar], t, beat * 8);
      if (inBar === 0 || inBar === 4) this.pluck(midi(CHORDS[bar][0] - 12), t, 0.08, 'triangle', 0.9);
      // Sparse melody
      const density = 0.28 + this.intensity * 0.25;
      if (Math.random() < density && inBar % 2 === 0) {
        const n = SCALE[Math.floor(Math.random() * SCALE.length)];
        this.pluck(midi(n), t, 0.05, 'triangle', 0.6);
      }
      if (this.intensity > 0.5 && inBar % 2 === 0) this.drum(t, inBar === 0 || inBar === 4);
      this.nextNote += beat;
      this.step++;
    }
  }

  private pad(notes: number[], t: number, dur: number): void {
    const ctx = this.ctx!;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 900;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.05, t + 0.6);
    g.gain.setValueAtTime(0.05, t + dur - 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.3);
    f.connect(g).connect(this.music);
    for (const n of notes) {
      for (const det of [-6, 6]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = midi(n);
        o.detune.value = det;
        o.connect(f);
        o.start(t);
        o.stop(t + dur + 0.4);
      }
    }
  }

  private pluck(freq: number, t: number, vol: number, type: OscillatorType, dur: number): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.music);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private drum(t: number, accent: boolean): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(accent ? 110 : 160, t);
    o.frequency.exponentialRampToValueAtTime(50, t + 0.15);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(accent ? 0.18 : 0.08, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    o.connect(g).connect(this.music);
    o.start(t);
    o.stop(t + 0.25);
  }
}
