import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { EarthquakeService } from '../../services/earthquake.service';
import { TranslationService } from '../../services/translation.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-detail-panel',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (earthquakeService.selectedEarthquake(); as event) {
      <div class="detail-card glass-panel">
        <div class="card-header">
          <div class="magnitude-display" [ngClass]="getMagClass(event.magnitude)">
            <span class="mag-num">M {{ event.magnitude | number:'1.1-1' }}</span>
            <span class="mag-type">{{ event.magnitudeType || 'Mw' }}</span>
          </div>

          <button class="close-btn" (click)="earthquakeService.clearSelectedEarthquake()">&times;</button>
        </div>

        <div class="card-body">
          <h2 class="epicenter-title">{{ event.place || event.title }}</h2>
          <div class="timestamps-group">
            <div class="time-item">
              <span class="time-tag">CENTROAMÉRICA (UTC-6)</span>
              <span class="time-val">{{ event.time | date:'d MMM y, HH:mm:ss':'-0600' }}</span>
            </div>
            <div class="time-item utc">
              <span class="time-tag">UNIVERSAL (UTC)</span>
              <span class="time-val">{{ event.time | date:'d MMM y, HH:mm:ss':'UTC' }}</span>
            </div>
          </div>

          <div class="params-grid">
            <div class="param-box">
              <span class="param-label">{{ transService.tr().detail.depth }}</span>
              <span class="param-val">{{ event.depth | number:'1.1-1' }} km</span>
            </div>
            <div class="param-box">
              <span class="param-label">{{ transService.tr().detail.status }}</span>
              <span class="param-val status-val" [class.reviewed]="event.status === 'REVIEWED'">
                {{ event.status }}
              </span>
            </div>
            <div class="param-box">
              <span class="param-label">{{ transService.tr().detail.coords }}</span>
              <span class="param-val coords-val">{{ event.latitude | number:'1.2-2' }}°, {{ event.longitude | number:'1.2-2' }}°</span>
            </div>
            <div class="param-box">
              <span class="param-label">{{ transService.tr().detail.tsunami }}</span>
              <span class="param-val" [class.tsunami-alert]="event.tsunamiAlert">
                {{ event.tsunamiAlert ? transService.tr().detail.tsunamiAlert : transService.tr().detail.tsunamiNone }}
              </span>
            </div>
          </div>

          <!-- Módulo "¿Lo sentiste?" (Sismología Ciudadana) -->
          <div class="citizen-section">
            <div class="citizen-header">
              <div class="citizen-title">
                <span>{{ transService.tr().detail.citizenTitle }}</span>
                <span class="report-counter">{{ event.totalCitizenReports }} {{ transService.currentLang() === 'en' ? 'reports' : 'reportes' }}</span>
              </div>
              @if (event.averagePerceivedIntensity) {
                <div class="avg-intensity">
                  {{ transService.tr().detail.avgIntensity }} <strong>{{ event.averagePerceivedIntensity | number:'1.1-1' }} / 5</strong>
                </div>
              }
            </div>

            @if (reportStatus() === 'success') {
              <div class="reported-success">
                <span>✓ {{ reportMessage() || (transService.currentLang() === 'en' ? 'Thank you! Your report has been verified.' : '¡Gracias! Tu reporte de percepción ha sido verificado.') }}</span>
              </div>
            } @else if (reportStatus() === 'error') {
              <div class="reported-error">
                <span>⚠ {{ reportMessage() }}</span>
                <button class="retry-btn" (click)="resetReport()">{{ transService.tr().detail.retry }}</button>
              </div>
            } @else if (reportStatus() === 'submitting') {
              <div class="reporting-loader">
                <span class="spinner-small"></span>
                <span>{{ transService.tr().detail.sendingReport }}</span>
              </div>
            } @else {
              <p class="citizen-desc">{{ transService.tr().detail.citizenDesc }}</p>
              <div class="emoji-buttons">
                <button (click)="submitReport(event, 1, '😴')" title="1">
                  <span class="emoji">😴</span>
                  <span class="lbl">{{ transService.tr().detail.weak }}</span>
                </button>
                <button (click)="submitReport(event, 2, '😐')" title="2">
                  <span class="emoji">😐</span>
                  <span class="lbl">{{ transService.tr().detail.moderate }}</span>
                </button>
                <button (click)="submitReport(event, 3, '😨')" title="3">
                  <span class="emoji">😨</span>
                  <span class="lbl">{{ transService.tr().detail.strong }}</span>
                </button>
                <button (click)="submitReport(event, 4, '😱')" title="4">
                  <span class="emoji">😱</span>
                  <span class="lbl">{{ transService.currentLang() === 'en' ? 'Very Strong' : 'Muy Fuerte' }}</span>
                </button>
                <button (click)="submitReport(event, 5, '🏚️')" title="5">
                  <span class="emoji">🏚️</span>
                  <span class="lbl">{{ transService.currentLang() === 'en' ? 'Extreme' : 'Extremo' }}</span>
                </button>
              </div>
            }
          </div>
        </div>
      </div>
    }

  `,
  styles: [`
    .detail-card {
      position: absolute;
      top: 96px;
      left: 16px;
      width: 360px;
      max-height: calc(100vh - 200px);
      overflow-y: auto;
      padding: 20px;
      z-index: 60;
      animation: fade-up 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes fade-up {
      from { opacity: 0; transform: translateY(12px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
    }

    .magnitude-display {
      display: flex;
      align-items: baseline;
      gap: 6px;
      padding: 6px 14px;
      border-radius: 10px;
    }
    .mag-low { background: rgba(0, 230, 118, 0.15); color: var(--mag-low); }
    .mag-med { background: rgba(255, 234, 0, 0.15); color: var(--mag-moderate); }
    .mag-high { background: rgba(255, 145, 0, 0.15); color: var(--mag-strong); }
    .mag-major { background: rgba(255, 23, 68, 0.15); color: var(--mag-major); }

    .mag-num {
      font-size: 1.5rem;
      font-weight: 800;
      font-family: var(--font-mono);
    }
    .mag-type {
      font-size: 0.8rem;
      font-weight: 600;
      opacity: 0.8;
    }

    .close-btn {
      background: transparent;
      border: none;
      color: var(--text-muted);
      font-size: 1.6rem;
      cursor: pointer;
      line-height: 1;
    }
    .close-btn:hover { color: #ffffff; }

    .epicenter-title {
      font-size: 1.1rem;
      font-weight: 700;
      color: #ffffff;
      line-height: 1.3;
      margin-bottom: 8px;
    }

    .timestamps-group {
      display: flex;
      flex-direction: column;
      gap: 5px;
      margin-bottom: 16px;
      background: rgba(0, 0, 0, 0.28);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 8px;
      padding: 8px 12px;
    }

    .time-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 0.75rem;
    }

    .time-item .time-tag {
      font-size: 0.62rem;
      font-weight: 700;
      color: #64748b;
      letter-spacing: 0.06em;
    }

    .time-item.utc .time-tag {
      color: var(--accent-cyan);
    }

    .time-item .time-val {
      font-family: var(--font-mono);
      font-weight: 600;
      color: #e2e8f0;
      font-size: 0.75rem;
    }

    .params-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-bottom: 20px;
    }

    .param-box {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid var(--border-subtle);
      border-radius: 8px;
      padding: 8px 12px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .param-label {
      font-size: 0.65rem;
      font-weight: 600;
      color: var(--text-muted);
      letter-spacing: 0.05em;
    }

    .param-val {
      font-family: var(--font-mono);
      font-size: 0.9rem;
      font-weight: 700;
      color: var(--text-primary);
    }
    .coords-val { font-size: 0.75rem; }

    .status-val.reviewed { color: #00e676; }
    .tsunami-alert { color: #ff1744; font-weight: 800; }

    .citizen-section {
      background: rgba(0, 240, 255, 0.03);
      border: 1px solid rgba(0, 240, 255, 0.15);
      border-radius: 12px;
      padding: 14px;
    }

    .citizen-header {
      margin-bottom: 10px;
    }

    .citizen-title {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 0.8rem;
      font-weight: 800;
      letter-spacing: 0.05em;
      color: var(--accent-cyan);
    }

    .report-counter {
      font-size: 0.75rem;
      color: var(--text-secondary);
      font-family: var(--font-mono);
    }

    .citizen-desc {
      font-size: 0.75rem;
      color: var(--text-muted);
      margin-bottom: 10px;
    }

    .emoji-buttons {
      display: flex;
      justify-content: space-between;
      gap: 6px;
    }

    .emoji-buttons button {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      padding: 8px 4px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--border-subtle);
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .emoji-buttons button:hover {
      background: rgba(0, 240, 255, 0.15);
      border-color: var(--accent-cyan);
      transform: translateY(-2px);
    }

    .emoji { font-size: 1.3rem; }
    .lbl {
      font-size: 0.6rem;
      font-weight: 600;
      color: var(--text-secondary);
    }

    .avg-intensity {
      font-size: 0.75rem;
      color: var(--accent-cyan);
      margin-top: 4px;
    }

    .reported-success {
      font-size: 0.8rem;
      color: #00e676;
      font-weight: 600;
      text-align: center;
      padding: 12px 6px;
      background: rgba(0, 230, 118, 0.08);
      border: 1px solid rgba(0, 230, 118, 0.2);
      border-radius: 8px;
    }

    .reported-error {
      font-size: 0.75rem;
      color: #ff5252;
      text-align: center;
      padding: 10px 8px;
      background: rgba(255, 82, 82, 0.08);
      border: 1px solid rgba(255, 82, 82, 0.25);
      border-radius: 8px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .retry-btn {
      align-self: center;
      padding: 4px 12px;
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 4px;
      color: #ffffff;
      font-size: 0.7rem;
      cursor: pointer;
    }
    .retry-btn:hover { background: rgba(255, 255, 255, 0.2); }

    .reporting-loader {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      font-size: 0.75rem;
      color: var(--text-muted);
      padding: 12px 0;
    }

    .spinner-small {
      width: 14px;
      height: 14px;
      border: 2px solid rgba(0, 240, 255, 0.2);
      border-top-color: var(--accent-cyan);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @media (max-width: 768px) {
      .detail-card {
        position: fixed;
        top: auto;
        bottom: 0;
        left: 0;
        right: 0;
        width: 100%;
        max-height: 80vh;
        border-radius: 20px 20px 0 0;
        padding: 18px 16px;
        z-index: 150;
        box-shadow: 0 -12px 40px rgba(0, 0, 0, 0.85);
        border-left: none;
        border-right: none;
        border-bottom: none;
      }

      .params-grid {
        grid-template-columns: repeat(2, 1fr);
        gap: 8px;
      }

      .emoji-buttons {
        gap: 6px;
      }

      .emoji-buttons button {
        padding: 8px 4px;
      }
    }
  `]
})
export class DetailPanelComponent {
  earthquakeService = inject(EarthquakeService);
  transService = inject(TranslationService);
  private http = inject(HttpClient);

  reportStatus = signal<'idle' | 'submitting' | 'success' | 'error'>('idle');
  reportMessage = signal<string>('');

  getMagClass(mag: number): string {
    if (mag < 3.5) return 'mag-low';
    if (mag < 4.5) return 'mag-med';
    if (mag < 6.0) return 'mag-high';
    return 'mag-major';
  }

  resetReport() {
    this.reportStatus.set('idle');
    this.reportMessage.set('');
  }

  submitReport(event: any, intensity: number, emoji: string) {
    this.reportStatus.set('submitting');

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => this.sendReportPayload(event.id, intensity, emoji, pos.coords.latitude, pos.coords.longitude),
        () => {
          // Fallback a proximidad física del evento para demostración si no hay permiso de geolocalización
          const fallbackLat = event.latitude ? event.latitude + 0.05 : 12.0;
          const fallbackLon = event.longitude ? event.longitude + 0.05 : -86.0;
          this.sendReportPayload(event.id, intensity, emoji, fallbackLat, fallbackLon);
        },
        { timeout: 8000 }
      );
    } else {
      const fallbackLat = event.latitude ? event.latitude + 0.05 : 12.0;
      const fallbackLon = event.longitude ? event.longitude + 0.05 : -86.0;
      this.sendReportPayload(event.id, intensity, emoji, fallbackLat, fallbackLon);
    }
  }

  private sendReportPayload(eventId: string, intensity: number, emoji: string, lat: number, lon: number) {
    const payload = {
      perceivedIntensity: intensity,
      emojiTag: emoji,
      latitude: lat,
      longitude: lon,
      clientFingerprint: navigator.userAgent
    };

    this.http.post<any>(`${environment.apiUrl}/earthquakes/${eventId}/reports`, payload).subscribe({
      next: (res) => {
        const km = res.distanceToEpicenterMeters ? Math.round(res.distanceToEpicenterMeters / 1000) : 0;
        this.reportStatus.set('success');
        this.reportMessage.set(`¡Reporte verificado! Distancia calculada al epicentro: ${km} km.`);
      },
      error: (err) => {
        this.reportStatus.set('error');
        const errorText = err.error?.message || err.message || 'Error al validar reporte geoespacial.';
        this.reportMessage.set(errorText);
      }
    });
  }
}

