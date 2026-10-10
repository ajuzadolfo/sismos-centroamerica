import { Component, EventEmitter, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { EarthquakeService } from '../../services/earthquake.service';
import { WebSocketService } from '../../services/websocket.service';
import { TranslationService } from '../../services/translation.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <header class="header glass-panel">
      <a routerLink="/" class="logo-group" [title]="transService.tr().header.home">
        <div class="pulse-indicator" [class.connected]="wsService.isConnected()">
          <span class="dot"></span>
        </div>
        <div class="title-container">
          <h1>{{ transService.tr().header.title }}</h1>
          <span class="subtitle">{{ transService.tr().header.subtitle }}</span>
        </div>
      </a>

      <div class="metrics-group">
        <div class="metric-chip">
          <span class="metric-label">{{ transService.tr().header.events }}</span>
          <span class="metric-value">{{ earthquakeService.totalVisibleCount() }}</span>
        </div>

        @if (earthquakeService.maxMagnitudeEvent(); as maxEvent) {
          <div class="metric-chip highlight">
            <span class="metric-label">{{ transService.tr().header.maxMag }}</span>
            <span class="metric-value mag-badge" [ngClass]="getMagClass(maxEvent.properties.magnitude)">
              M {{ maxEvent.properties.magnitude | number:'1.1-1' }}
            </span>
          </div>
        }
      </div>

      <div class="actions-group">
        <!-- Selector de Idioma ES / EN -->
        <button
          class="btn-lang-toggle"
          (click)="transService.toggleLanguage()"
          [title]="transService.currentLang() === 'es' ? 'Switch to English' : 'Cambiar a Español'">
          <span class="lang-opt" [class.active]="transService.currentLang() === 'es'">ES</span>
          <span class="lang-separator">/</span>
          <span class="lang-opt" [class.active]="transService.currentLang() === 'en'">EN</span>
        </button>

        <a routerLink="/" class="btn-toggle" [title]="transService.tr().header.home">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
          <span>{{ transService.tr().header.home }}</span>
        </a>

        <button
          class="btn-toggle"
          [class.active]="earthquakeService.isHeatmapActive()"
          (click)="earthquakeService.toggleHeatmap()"
          [title]="transService.tr().header.heatmap">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2a8 8 0 0 0-8 8c0 5 8 12 8 12s8-7 8-12a8 8 0 0 0-8-8z"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
          <span>{{ transService.tr().header.heatmap }}</span>
        </button>

        <button
          class="btn-icon"
          (click)="toggleFilterDrawer.emit()"
          [title]="transService.tr().header.filters">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
          </svg>
        </button>
      </div>
    </header>
  `,
  styles: [`
    .header {
      position: absolute;
      top: 16px;
      left: 16px;
      right: 16px;
      height: 64px;
      padding: 0 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      z-index: 100;
    }

    .logo-group {
      display: flex;
      align-items: center;
      gap: 14px;
      text-decoration: none;
      cursor: pointer;
    }

    .pulse-indicator {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: rgba(239, 68, 68, 0.2);
    }
    .pulse-indicator.connected {
      background: rgba(16, 185, 129, 0.2);
    }

    .pulse-indicator .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #ef4444;
      box-shadow: 0 0 8px #ef4444;
    }
    .pulse-indicator.connected .dot {
      background: #10b981;
      box-shadow: 0 0 8px #10b981;
      animation: pulse-glow 2s infinite;
    }

    @keyframes pulse-glow {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.6; transform: scale(1.2); }
    }

    .title-container h1 {
      font-size: 1rem;
      font-weight: 800;
      letter-spacing: 0.05em;
      color: #ffffff;
      line-height: 1.2;
    }

    .subtitle {
      font-size: 0.65rem;
      font-weight: 600;
      letter-spacing: 0.08em;
      color: var(--accent-cyan);
      display: block;
    }

    .metrics-group {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .metric-chip {
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid var(--border-subtle);
      border-radius: 8px;
      padding: 6px 14px;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .metric-label {
      font-size: 0.65rem;
      font-weight: 700;
      color: var(--text-muted);
      letter-spacing: 0.05em;
    }

    .metric-value {
      font-family: var(--font-mono);
      font-size: 0.95rem;
      font-weight: 700;
      color: var(--text-primary);
    }

    .mag-badge {
      padding: 2px 8px;
      border-radius: 6px;
      font-size: 0.85rem;
    }
    .mag-low { background: rgba(0, 230, 118, 0.15); color: var(--mag-low); }
    .mag-med { background: rgba(255, 234, 0, 0.15); color: var(--mag-moderate); }
    .mag-high { background: rgba(255, 145, 0, 0.15); color: var(--mag-strong); }
    .mag-major { background: rgba(255, 23, 68, 0.15); color: var(--mag-major); }

    .actions-group {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .btn-toggle {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 7px 14px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--border-subtle);
      border-radius: 8px;
      color: var(--text-secondary);
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .btn-toggle:hover {
      background: rgba(255, 255, 255, 0.1);
      color: #ffffff;
    }
    .btn-toggle.active {
      background: rgba(0, 240, 255, 0.15);
      border-color: var(--accent-cyan);
      color: var(--accent-cyan);
    }

    .btn-icon {
      width: 36px;
      height: 36px;
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--border-subtle);
      color: var(--text-secondary);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .btn-icon:hover {
      background: rgba(255, 255, 255, 0.1);
      color: #ffffff;
    }

    .btn-lang-toggle {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      padding: 6px 10px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--border-subtle);
      border-radius: 8px;
      cursor: pointer;
      font-size: 0.72rem;
      font-weight: 700;
      font-family: var(--font-mono);
      color: var(--text-muted);
      transition: all 0.2s ease;
    }
    .btn-lang-toggle:hover {
      background: rgba(255, 255, 255, 0.1);
      border-color: rgba(0, 240, 255, 0.35);
    }
    .lang-opt {
      transition: color 0.2s ease;
    }
    .lang-opt.active {
      color: var(--accent-cyan);
      text-shadow: 0 0 8px rgba(0, 240, 255, 0.5);
    }
    .lang-separator {
      color: rgba(255, 255, 255, 0.2);
      font-size: 0.65rem;
    }

    @media (max-width: 768px) {
      .header {
        top: 8px;
        left: 8px;
        right: 8px;
        height: 56px;
        padding: 0 12px;
      }

      .logo-group {
        gap: 8px;
      }

      .title-container h1 {
        font-size: 0.85rem;
      }

      .subtitle {
        font-size: 0.58rem;
      }

      .metrics-group .metric-chip:first-child {
        display: none;
      }

      .metric-chip {
        padding: 4px 8px;
        gap: 6px;
      }

      .metric-label {
        font-size: 0.58rem;
      }

      .metric-value {
        font-size: 0.8rem;
      }

      .btn-toggle {
        padding: 6px 10px;
        gap: 6px;
      }

      .btn-toggle span {
        display: none;
      }

      .btn-lang-toggle {
        padding: 5px 8px;
        font-size: 0.68rem;
      }

      .btn-icon {
        width: 32px;
        height: 32px;
      }
    }

    @media (max-width: 520px) {
      .subtitle {
        display: none;
      }

      .metrics-group {
        display: none;
      }

      .header {
        height: 52px;
      }
    }
  `]
})
export class HeaderComponent {
  earthquakeService = inject(EarthquakeService);
  wsService = inject(WebSocketService);
  transService = inject(TranslationService);

  @Output() toggleFilterDrawer = new EventEmitter<void>();

  getMagClass(mag: number): string {
    if (mag < 3.5) return 'mag-low';
    if (mag < 4.5) return 'mag-med';
    if (mag < 6.0) return 'mag-high';
    return 'mag-major';
  }
}
