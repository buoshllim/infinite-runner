

// Simple procedural audio synthesizer using Web Audio API
// No external files required.

class AudioService {
  ctx: AudioContext | null = null;
  masterGain: GainNode | null = null;
  noiseBuffer: AudioBuffer | null = null;
  
  // Persistent nodes for looping effects
  windSource: AudioBufferSourceNode | null = null;
  windGain: GainNode | null = null;

  // Siren nodes
  sirenOsc: OscillatorNode | null = null;
  sirenLfo: OscillatorNode | null = null;
  sirenGain: GainNode | null = null;

  // Magnet nodes
  magnetOsc: OscillatorNode | null = null;
  magnetLfo: OscillatorNode | null = null;
  magnetGain: GainNode | null = null;

  bgm: HTMLAudioElement | null = null;
  private _isMuted = false;
  private _visibilityListenerAdded = false;

  stepBuffer: AudioBuffer | null = null;
  landBuffer: AudioBuffer | null = null;
  crashBuffer: AudioBuffer | null = null;

  get isMuted() { return this._isMuted; }

  init() {
    if (!this.ctx) {
      const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
      this.ctx = new AudioContextClass();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.3; // Master volume
      this.masterGain.connect(this.ctx.destination);

      // Generate White Noise Buffer for Splash/Wind effects
      const bufferSize = this.ctx.sampleRate * 2; // 2 seconds buffer
      this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      this.bgm = new Audio('/bgm.mp3');
      this.bgm.loop = true;
      this.bgm.volume = 0.4;
      this.bgm.muted = this._isMuted;

      this.loadSfx('/step.mp3').then(b => { if (b) this.stepBuffer = b; });
      this.loadSfx('/land.mp3').then(b => { if (b) this.landBuffer = b; });
      this.loadSfx('/crash.mp3').then(b => { if (b) this.crashBuffer = b; });
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    if (!this._visibilityListenerAdded) {
      this._visibilityListenerAdded = true;
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          this.ctx?.suspend();
          this.bgm?.pause();
        } else {
          this.ctx?.resume();
          if (!this._isMuted && this.bgm && !this.bgm.ended && this.bgm.currentTime > 0 && this.bgm.paused) {
            this.bgm.play().catch(() => {});
          }
        }
      });
    }
  }

  private async loadSfx(path: string): Promise<AudioBuffer | null> {
    if (!this.ctx) return null;
    try {
      const res = await fetch(path);
      const arr = await res.arrayBuffer();
      return await this.ctx.decodeAudioData(arr);
    } catch {
      return null;
    }
  }

  private playBuffer(buffer: AudioBuffer, volume = 1) {
    if (!this.ctx || !this.masterGain) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const gain = this.ctx.createGain();
    gain.gain.value = volume;
    src.connect(gain);
    gain.connect(this.masterGain);
    src.start();
  }

  setMuted(muted: boolean) {
    this._isMuted = muted;
    if (this.masterGain) {
      this.masterGain.gain.value = muted ? 0 : 0.3;
    }
    if (this.bgm) {
      this.bgm.muted = muted;
    }
  }

  startBGM() {
    if (!this.bgm) return;
    this.bgm.currentTime = 0;
    this.bgm.play().catch(() => {});
  }

  stopBGM() {
    if (!this.bgm) return;
    this.bgm.pause();
    this.bgm.currentTime = 0;
  }

  private playTone(freq: number, type: OscillatorType, duration: number, startTime: number = 0, volume: number = 1) {
    if (!this.ctx || !this.masterGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime + startTime);

    gain.gain.setValueAtTime(volume, this.ctx.currentTime + startTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + startTime + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(this.ctx.currentTime + startTime);
    osc.stop(this.ctx.currentTime + startTime + duration);
  }

  playJump() {
    if (!this.ctx || !this.masterGain) return;
    // Rising "whoosh"
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(600, this.ctx.currentTime + 0.2);
    
    gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.2);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.2);
  }

  playLand() {
    if (this.landBuffer) { this.playBuffer(this.landBuffer, 1.2); return; }
    this.playTone(100, 'triangle', 0.1, 0, 0.8);
  }

  playCrash() {
    if (this.crashBuffer) { this.playBuffer(this.crashBuffer, 1.0); return; }
    if (!this.ctx || !this.masterGain) return;
    // Discordant noise-like sound using sawtooth
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(100, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(20, this.ctx.currentTime + 0.3);
    
    gain.gain.setValueAtTime(0.8, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.3);
  }

  playEagle() {
    if (!this.ctx || !this.masterGain) return;
    // High pitched screech (Sawtooth + Highpass)
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1500, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(1000, this.ctx.currentTime + 0.4);
    
    gain.gain.setValueAtTime(0.6, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.4);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.4);
  }

  playSplash() {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    
    const source = this.ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    
    // Lowpass filter to simulate water 'thump'
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, this.ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.4);
    
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.6, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.4);
    
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    
    source.start();
    source.stop(this.ctx.currentTime + 0.4);
  }

  playMilestone() {
    // High pitched "Ding"
    this.playTone(880, 'sine', 0.1, 0, 0.4);
    this.playTone(1760, 'sine', 0.3, 0.1, 0.2);
  }

  playCoin() {
    if (!this.ctx || !this.masterGain) return;
    // High pitched "Ping"
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1800, this.ctx.currentTime + 0.1);
    
    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.3);
  }

  playWoodStep() {
    if (this.stepBuffer) { this.playBuffer(this.stepBuffer, 0.8); return; }
    if (!this.ctx || !this.masterGain) return;

    // Simulate hollow wooden thud
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    // Triangle wave gives a slightly richer "thump" than sine
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(80, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.1);
    
    // Short burst - INCREASED VOLUME
    gain.gain.setValueAtTime(2.0, this.ctx.currentTime); // Was 0.4
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);

    // Optional: Filter to make it sound "wooden" (mid-range resonance)
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 200;
    filter.Q.value = 1;

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    
    osc.start();
    osc.stop(this.ctx.currentTime + 0.15);
  }

  startBoostWind() {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    
    // Ensure we don't layer sounds
    this.stopBoostWind();

    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;

    // Use a Lowpass filter that opens up to simulate high speed air rush
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(400, this.ctx.currentTime);
    filter.frequency.linearRampToValueAtTime(3000, this.ctx.currentTime + 1.5); // Open up filter
    filter.Q.value = 1;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(1.2, this.ctx.currentTime + 0.5); // Fade in

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    
    src.start();

    this.windSource = src;
    this.windGain = gain;
  }

  stopBoostWind() {
    if (this.windGain && this.ctx) {
        // Fade out
        this.windGain.gain.cancelScheduledValues(this.ctx.currentTime);
        this.windGain.gain.setValueAtTime(this.windGain.gain.value, this.ctx.currentTime);
        this.windGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 1.0);
        
        const src = this.windSource;
        setTimeout(() => { 
            if(src) {
                try { src.stop(); } catch(e) {} 
            }
        }, 1100);
    }
    this.windSource = null;
    this.windGain = null;
  }

  startSiren() {
    if (!this.ctx || !this.masterGain) return;
    this.stopSiren();

    // Main Oscillator
    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    
    // LFO for modulating frequency (Siren effect)
    const lfo = this.ctx.createOscillator();
    lfo.type = 'square'; 
    lfo.frequency.value = 0.6; 

    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 200; // Modulation depth

    const mainGain = this.ctx.createGain();
    mainGain.gain.value = 0.2;

    // Connect LFO -> LFO Gain -> Osc Frequency
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    
    osc.frequency.value = 800; // Base freq

    osc.connect(mainGain);
    mainGain.connect(this.masterGain);

    osc.start();
    lfo.start();

    this.sirenOsc = osc;
    this.sirenLfo = lfo;
    this.sirenGain = mainGain;
  }

  stopSiren() {
    if (this.sirenOsc) { try { this.sirenOsc.stop(); } catch(e){} }
    if (this.sirenLfo) { try { this.sirenLfo.stop(); } catch(e){} }
    if (this.sirenGain) { this.sirenGain.disconnect(); }
    
    this.sirenOsc = null;
    this.sirenLfo = null;
    this.sirenGain = null;
  }

  startMagnetSound() {
    if (!this.ctx || !this.masterGain) return;
    this.stopMagnetSound();

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 600;

    const lfo = this.ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 8; // Tremolo rate

    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 0.2; // Tremolo depth

    const mainGain = this.ctx.createGain();
    mainGain.gain.value = 0.4;

    // AM Synthesis: LFO modulates Main Gain
    // But easier: Connect LFO to Gain.gain
    // We need a base value.
    // Let's simple connect LFO to gainNode.
    // This effectively makes volume go up and down.
    
    // Setup: Osc -> MainGain -> Master
    // LFO -> MainGain.gain
    
    osc.connect(mainGain);
    mainGain.connect(this.masterGain);
    
    // LFO needs to oscillate around 0.4
    // Web Audio LFO output is -1 to 1.
    // If we connect directly, gain goes negative (inverted phase).
    // Better approach: Vibrato (Frequency Modulation) for Sci-fi feel
    
    // Let's switch to Vibrato: LFO -> Osc.frequency
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    lfoGain.gain.value = 20; // Vibrato depth
    
    osc.start();
    lfo.start();

    this.magnetOsc = osc;
    this.magnetLfo = lfo;
    this.magnetGain = mainGain;
  }

  stopMagnetSound() {
    if (this.magnetGain && this.ctx) {
        this.magnetGain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.5);
    }
    const osc = this.magnetOsc;
    const lfo = this.magnetLfo;
    setTimeout(() => {
        if(osc) try { osc.stop(); } catch(e){}
        if(lfo) try { lfo.stop(); } catch(e){}
    }, 500);
    
    this.magnetOsc = null;
    this.magnetLfo = null;
    this.magnetGain = null;
  }
}

export const audioService = new AudioService();