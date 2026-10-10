import {
  Component,
  ElementRef,
  Input,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { AudioAlertService } from '../../services/audio-alert.service';

@Component({
  selector: 'app-seismograph-hud',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="hud-container glass-panel" [class.collapsed]="isCollapsed()">
      <!-- Header de la estación sísmica -->
      <div class="hud-header" (click)="toggleCollapse()">
        <div class="station-meta">
          <span class="status-pulse"></span>
          <div class="station-info">
            <span class="station-name">CENTRO DE MANDO // RED TELEMÉTRICA</span>
            <span class="station-sub">BANDA ANCHA 100 Hz &bull; TIEMPO REAL</span>
          </div>
        </div>

        <div class="header-actions" (click)="$event.stopPropagation()">
          <button
            class="action-btn"
            [class.active]="audioService.isSoundEnabled()"
            (click)="audioService.toggleSound()"
            [title]="audioService.isSoundEnabled() ? 'Silenciar alertas acústicas' : 'Activar sonido de alerta sísmica'">
            @if (audioService.isSoundEnabled()) {
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
              </svg>
            } @else {
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                <line x1="23" y1="9" x2="17" y2="15"></line>
                <line x1="17" y1="9" x2="23" y2="15"></line>
              </svg>
            }
          </button>

          <button class="action-btn collapse-toggle" (click)="toggleCollapse()" [title]="isCollapsed() ? 'Expandir HUD' : 'Minimizar HUD'">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              @if (isCollapsed()) {
                <polyline points="18 15 12 9 6 15"></polyline>
              } @else {
                <polyline points="6 9 12 15 18 9"></polyline>
              }
            </svg>
          </button>
        </div>
      </div>

      <!-- Contenido del osciloscopio / sismograma -->
      @if (!isCollapsed()) {
        <div class="hud-body">
          <div class="oscilloscope-wrapper">
            <canvas #waveformCanvas class="waveform-canvas"></canvas>
            <div class="hud-grid-overlay"></div>
            <div class="live-tag">TRAZA SÍSMICA VIRTUAL</div>
          </div>

          <!-- Métricas de Telemetría Dinámica -->
          <div class="telemetry-bar">
            <div class="telem-item">
              <span class="label">COORDENADAS</span>
              <span class="val">{{ coordinatesText }}</span>
            </div>
            <div class="telem-item">
              <span class="label">PITCH / ÁNGULO</span>
              <span class="val">{{ pitchText }}</span>
            </div>
            <div class="telem-item">
              <span class="label">AMPLITUD PGA</span>
              <span class="val highlight" [class.alert]="amplitudeSpike() > 0.4">
                {{ (amplitudeSpike() * 100).toFixed(1) }} %
              </span>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .hud-container {
      position: absolute;
      bottom: 114px;
      left: 16px;
      width: 380px;
      z-index: 40;
      background: rgba(8, 14, 26, 0.88);
      backdrop-filter: blur(16px);
      border: 1px solid rgba(0, 240, 255, 0.25);
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 12px 36px rgba(0, 0, 0, 0.6), 0 0 20px rgba(0, 240, 255, 0.1);
      transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      font-family: var(--font-sans);
    }

    .hud-container.collapsed {
      width: 320px;
      background: rgba(8, 14, 26, 0.75);
    }

    .hud-header {
      padding: 10px 14px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      cursor: pointer;
      user-select: none;
    }

    .hud-container.collapsed .hud-header {
      border-bottom: none;
    }

    .station-meta {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .status-pulse {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #00f0ff;
      box-shadow: 0 0 10px #00f0ff;
      animation: pulse 1.8s infinite;
    }

    @keyframes pulse {
      0%, 100% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.3); opacity: 0.6; }
    }

    .station-info {
      display: flex;
      flex-direction: column;
    }

    .station-name {
      font-size: 0.7rem;
      font-weight: 800;
      letter-spacing: 0.06em;
      color: #f8fafc;
    }

    .station-sub {
      font-size: 0.58rem;
      color: #94a3b8;
      font-family: var(--font-mono);
      letter-spacing: 0.04em;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .action-btn {
      width: 26px;
      height: 26px;
      border-radius: 6px;
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.12);
      color: #94a3b8;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .action-btn:hover {
      background: rgba(255, 255, 255, 0.12);
      color: #ffffff;
    }

    .action-btn.active {
      color: #00f0ff;
      border-color: rgba(0, 240, 255, 0.4);
      background: rgba(0, 240, 255, 0.12);
    }

    .hud-body {
      padding: 10px 14px 12px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .oscilloscope-wrapper {
      position: relative;
      width: 100%;
      height: 74px;
      background: #030712;
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid rgba(0, 240, 255, 0.2);
    }

    .waveform-canvas {
      width: 100%;
      height: 100%;
      display: block;
    }

    .hud-grid-overlay {
      position: absolute;
      inset: 0;
      background:
        linear-gradient(rgba(0, 240, 255, 0.06) 1px, transparent 1px),
        linear-gradient(90deg, rgba(0, 240, 255, 0.06) 1px, transparent 1px);
      background-size: 16px 16px;
      pointer-events: none;
    }

    .live-tag {
      position: absolute;
      top: 6px;
      right: 8px;
      font-size: 0.55rem;
      font-family: var(--font-mono);
      font-weight: 700;
      color: rgba(0, 240, 255, 0.7);
      letter-spacing: 0.08em;
      pointer-events: none;
    }

    .telemetry-bar {
      display: grid;
      grid-template-columns: 1.4fr 1fr 1fr;
      gap: 8px;
      background: rgba(0, 0, 0, 0.35);
      border-radius: 6px;
      padding: 6px 10px;
      border: 1px solid rgba(255, 255, 255, 0.05);
    }

    .telem-item {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .telem-item .label {
      font-size: 0.55rem;
      font-weight: 700;
      color: #64748b;
      letter-spacing: 0.05em;
    }

    .telem-item .val {
      font-family: var(--font-mono);
      font-size: 0.7rem;
      font-weight: 600;
      color: #e2e8f0;
    }

    .telem-item .val.highlight {
      color: #00f0ff;
    }

    .telem-item .val.alert {
      color: #f43f5e;
      animation: flash 0.5s infinite alternate;
    }

    @keyframes flash {
      from { color: #f43f5e; }
      to { color: #ffea00; }
    }

    @media (max-width: 768px) {
      .hud-container {
        bottom: 96px;
        left: 8px;
        width: calc(100vw - 16px);
        max-width: 340px;
      }
      .hud-container.collapsed {
        width: auto;
      }
      .hud-header {
        padding: 6px 10px;
      }
      .station-sub {
        display: none;
      }
      .station-name {
        font-size: 0.62rem;
      }
    }
  `]
})
export class SeismographHudComponent implements OnInit, OnDestroy {
  @ViewChild('waveformCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  @Input() coordinatesText = '13.50° N, 86.50° W';
  @Input() pitchText = '0° [2D]';

  audioService = inject(AudioAlertService);
  isCollapsed = signal<boolean>(typeof window !== 'undefined' ? window.innerWidth <= 768 : false);
  amplitudeSpike = signal<number>(0.05);

  private animationFrameId: number | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private waveBuffer: number[] = [];
  private phase = 0;
  private currentAmplitude = 0.05;
  private targetAmplitude = 0.05;

  ngOnInit() {
    // Inicializar buffer
    for (let i = 0; i < 300; i++) {
      this.waveBuffer.push(0);
    }
    setTimeout(() => this.initCanvas(), 100);
  }

  ngOnDestroy() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }

  toggleCollapse() {
    this.isCollapsed.update(v => !v);
    if (!this.isCollapsed()) {
      setTimeout(() => this.initCanvas(), 100);
    }
  }

  triggerSeismicSpike(magnitude = 4.5) {
    this.targetAmplitude = Math.min(1.0, 0.3 + (magnitude / 8) * 0.7);
    this.amplitudeSpike.set(this.targetAmplitude);
  }

  private initCanvas() {
    if (!this.canvasRef) return;
    const canvas = this.canvasRef.nativeElement;
    this.ctx = canvas.getContext('2d');
    if (!this.ctx) return;

    canvas.width = canvas.clientWidth * window.devicePixelRatio || 350;
    canvas.height = canvas.clientHeight * window.devicePixelRatio || 74;

    this.startOscilloscope();
  }

  private startOscilloscope() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }

    const render = () => {
      this.drawWaveform();
      this.animationFrameId = requestAnimationFrame(render);
    };

    render();
  }

  private drawWaveform() {
    if (!this.ctx || !this.canvasRef) return;
    const canvas = this.canvasRef.nativeElement;
    const width = canvas.width;
    const height = canvas.height;
    const centerY = height / 2;

    // Suavizar transición de amplitud
    this.currentAmplitude += (this.targetAmplitude - this.currentAmplitude) * 0.05;
    if (this.targetAmplitude > 0.06) {
      this.targetAmplitude *= 0.985; // Decaimiento natural de la onda sísmica
    }
    this.amplitudeSpike.set(this.currentAmplitude);

    // Generar nuevo valor de muestra sísmica
    this.phase += 0.25;
    const noise = (Math.random() - 0.5) * 3;
    const harmonic1 = Math.sin(this.phase * 0.8) * 6;
    const harmonic2 = Math.sin(this.phase * 2.3) * 4;
    const pWave = (Math.sin(this.phase * 4.2) + Math.cos(this.phase * 1.7)) * 12;

    const newSample = (harmonic1 + harmonic2 + pWave * 2 + noise) * this.currentAmplitude;
    this.waveBuffer.push(newSample);
    if (this.waveBuffer.length > width) {
      this.waveBuffer.shift();
    }

    // Limpiar canvas
    this.ctx.fillStyle = '#030712';
    this.ctx.fillRect(0, 0, width, height);

    // Línea base central tenue
    this.ctx.strokeStyle = 'rgba(0, 240, 255, 0.15)';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(0, centerY);
    this.ctx.lineTo(width, centerY);
    this.ctx.stroke();

    // Dibujar traza del sismógrafo
    this.ctx.beginPath();
    this.ctx.lineWidth = 2;
    const strokeColor = this.currentAmplitude > 0.4 ? '#f43f5e' : (this.currentAmplitude > 0.2 ? '#ffea00' : '#00f0ff');
    this.ctx.strokeStyle = strokeColor;
    this.ctx.shadowColor = strokeColor;
    this.ctx.shadowBlur = this.currentAmplitude > 0.3 ? 10 : 4;

    const step = width / this.waveBuffer.length;
    for (let i = 0; i < this.waveBuffer.length; i++) {
      const x = i * step;
      const y = centerY + this.waveBuffer[i];
      if (i === 0) {
        this.ctx.moveTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }
    }
    this.ctx.stroke();
    this.ctx.shadowBlur = 0; // reset
  }
}
