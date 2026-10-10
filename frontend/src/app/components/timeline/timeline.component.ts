import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EarthquakeService } from '../../services/earthquake.service';

@Component({
  selector: 'app-timeline',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="timeline-bar glass-panel">
      <!-- Controles de Reproducción -->
      <div class="controls-left">
        <button
          class="play-btn"
          (click)="togglePlayback()"
          [title]="isPlaying() ? 'Pausar animación' : 'Reproducir cronología sísmica'">
          @if (isPlaying()) {
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16"/>
              <rect x="14" y="4" width="4" height="16"/>
            </svg>
          } @else {
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
          }
        </button>

        <div class="speed-selector">
          <button [class.active]="speed() === 1" (click)="setSpeed(1)">1x</button>
          <button [class.active]="speed() === 5" (click)="setSpeed(5)">5x</button>
          <button [class.active]="speed() === 20" (click)="setSpeed(20)">20x</button>
        </div>
      </div>

      <!-- Barra de Deslizamiento Temporal -->
      <div class="slider-container">
        <div class="slider-info">
          <span class="date-label">{{ minDateLabel() }}</span>
          <span class="current-date-badge">
            {{ currentDateLabel() }}
          </span>
          <span class="date-label">Ahora</span>
        </div>

        <input
          type="range"
          class="timeline-slider"
          [min]="minTime()"
          [max]="maxTime()"
          [value]="currentTime()"
          (input)="onSliderChange($event)"
        />
      </div>

      <!-- Botón de Reinicio -->
      <button class="reset-btn btn-secondary" (click)="resetTimeline()" title="Ver todos los sismos">
        Restablecer
      </button>
    </div>
  `,
  styles: [`
    .timeline-bar {
      position: absolute;
      bottom: 28px;
      left: 16px;
      right: 16px;
      height: 72px;
      padding: 0 20px;
      display: flex;
      align-items: center;
      gap: 20px;
      z-index: 50;
    }

    .controls-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .play-btn {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: linear-gradient(135deg, #00f0ff 0%, #0284c7 100%);
      color: #020617;
      border: none;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: 0 0 16px rgba(0, 240, 255, 0.35);
      transition: all 0.2s ease;
    }
    .play-btn:hover {
      transform: scale(1.06);
      box-shadow: 0 0 22px rgba(0, 240, 255, 0.5);
    }

    .speed-selector {
      display: flex;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--border-subtle);
      border-radius: 8px;
      overflow: hidden;
    }

    .speed-selector button {
      padding: 5px 10px;
      background: transparent;
      border: none;
      color: var(--text-muted);
      font-size: 0.75rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .speed-selector button.active {
      background: rgba(0, 240, 255, 0.2);
      color: var(--accent-cyan);
    }

    .slider-container {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .slider-info {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 0.75rem;
      color: var(--text-muted);
    }

    .current-date-badge {
      font-family: var(--font-mono);
      font-weight: 600;
      color: var(--accent-cyan);
      background: rgba(0, 240, 255, 0.1);
      padding: 2px 10px;
      border-radius: 4px;
      border: 1px solid rgba(0, 240, 255, 0.2);
    }

    .timeline-slider {
      width: 100%;
      height: 6px;
      -webkit-appearance: none;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 3px;
      outline: none;
      cursor: pointer;
    }

    .timeline-slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: #00f0ff;
      box-shadow: 0 0 10px #00f0ff;
      cursor: pointer;
      transition: transform 0.1s ease;
    }
    .timeline-slider::-webkit-slider-thumb:hover {
      transform: scale(1.2);
    }

    .reset-btn {
      white-space: nowrap;
      font-size: 0.75rem;
    }

    @media (max-width: 768px) {
      .timeline-bar {
        bottom: 28px;
        left: 8px;
        right: 8px;
        height: 58px;
        padding: 0 10px;
        gap: 8px;
      }

      .play-btn {
        width: 36px;
        height: 36px;
      }

      .current-date-badge {
        font-size: 0.65rem;
        padding: 2px 6px;
      }

      .reset-btn {
        font-size: 0.68rem;
        padding: 4px 8px;
      }
    }

    @media (max-width: 640px) {
      .speed-selector {
        display: none;
      }

      .date-label {
        display: none;
      }
    }
  `]
})
export class TimelineComponent implements OnDestroy {
  earthquakeService = inject(EarthquakeService);

  readonly isPlaying = signal<boolean>(false);
  readonly speed = signal<number>(1);
  private playbackInterval: any = null;

  readonly minTime = computed(() => {
    const list = this.earthquakeService.earthquakes();
    if (list.length === 0) return Date.now() - 7 * 86400000;
    const timestamps = list.map(e => new Date(e.properties.time).getTime());
    return Math.min(...timestamps);
  });

  readonly maxTime = computed(() => {
    return Date.now();
  });

  readonly currentTime = computed(() => {
    return this.earthquakeService.timelineCurrentTime() ?? this.maxTime();
  });

  readonly minDateLabel = computed(() => {
    return new Date(this.minTime()).toLocaleDateString('es', { day: 'numeric', month: 'short' });
  });

  readonly currentDateLabel = computed(() => {
    return new Date(this.currentTime()).toLocaleString('es-GT', {
      timeZone: 'America/Guatemala',
      dateStyle: 'medium',
      timeStyle: 'short'
    }) + ' (UTC-6)';
  });

  ngOnDestroy() {
    this.stopPlayback();
  }

  togglePlayback() {
    if (this.isPlaying()) {
      this.stopPlayback();
    } else {
      this.startPlayback();
    }
  }

  setSpeed(val: number) {
    this.speed.set(val);
    if (this.isPlaying()) {
      this.stopPlayback();
      this.startPlayback();
    }
  }

  onSliderChange(event: Event) {
    const target = event.target as HTMLInputElement;
    const val = Number(target.value);
    this.earthquakeService.timelineCurrentTime.set(val);
  }

  resetTimeline() {
    this.stopPlayback();
    this.earthquakeService.timelineCurrentTime.set(null);
  }

  private startPlayback() {
    this.isPlaying.set(true);

    // Si ya estamos al final, reiniciar desde el principio
    if (this.currentTime() >= this.maxTime() - 60000) {
      this.earthquakeService.timelineCurrentTime.set(this.minTime());
    }

    const stepMs = 3600000 * 2 * this.speed(); // 2 horas por fotograma x velocidad

    this.playbackInterval = setInterval(() => {
      const current = this.currentTime();
      const next = current + stepMs;

      if (next >= this.maxTime()) {
        this.earthquakeService.timelineCurrentTime.set(this.maxTime());
        this.stopPlayback();
      } else {
        this.earthquakeService.timelineCurrentTime.set(next);
      }
    }, 150);
  }

  private stopPlayback() {
    this.isPlaying.set(false);
    if (this.playbackInterval) {
      clearInterval(this.playbackInterval);
      this.playbackInterval = null;
    }
  }
}
