import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class AudioAlertService {
  private audioCtx: AudioContext | null = null;
  readonly isSoundEnabled = signal<boolean>(true);

  constructor() {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sismos_sound_enabled');
      if (saved !== null) {
        this.isSoundEnabled.set(saved === 'true');
      }
    }
  }

  toggleSound(): boolean {
    const newState = !this.isSoundEnabled();
    this.isSoundEnabled.set(newState);
    if (typeof window !== 'undefined') {
      localStorage.setItem('sismos_sound_enabled', String(newState));
    }
    if (newState) {
      this.playTestChime();
    }
    return newState;
  }

  private initAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  playEarthquakeAlert(magnitude: number) {
    if (!this.isSoundEnabled()) return;
    const ctx = this.initAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // 1. Pulso Sub-Bass (Onda sísmica de baja frecuencia que simula el retumbo)
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(55, now);
    subOsc.frequency.exponentialRampToValueAtTime(35, now + 0.8);

    const bassVol = Math.min(0.7, 0.2 + (magnitude / 10) * 0.5);
    subGain.gain.setValueAtTime(0.01, now);
    subGain.gain.linearRampToValueAtTime(bassVol, now + 0.08);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

    subOsc.connect(subGain);
    subGain.connect(ctx.destination);
    subOsc.start(now);
    subOsc.stop(now + 1.2);

    // 2. Chime Científico de Telemetría (Ping de detección)
    const chimeOsc = ctx.createOscillator();
    const chimeGain = ctx.createGain();
    chimeOsc.type = 'triangle';

    // Frecuencia más alta para magnitudes mayores
    const baseFreq = magnitude >= 5.0 ? 880 : 660;
    chimeOsc.frequency.setValueAtTime(baseFreq, now + 0.05);
    chimeOsc.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, now + 0.18);
    chimeOsc.frequency.exponentialRampToValueAtTime(baseFreq * 0.75, now + 0.6);

    chimeGain.gain.setValueAtTime(0.01, now + 0.05);
    chimeGain.gain.linearRampToValueAtTime(0.25, now + 0.12);
    chimeGain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);

    chimeOsc.connect(chimeGain);
    chimeGain.connect(ctx.destination);
    chimeOsc.start(now + 0.05);
    chimeOsc.stop(now + 0.9);
  }

  playTestChime() {
    const ctx = this.initAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, now); // D5
    osc.frequency.setValueAtTime(880, now + 0.1); // A5
    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.2, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.4);
  }
}
