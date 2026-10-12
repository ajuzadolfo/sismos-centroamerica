import { Component, EventEmitter, OnInit, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { TranslationService } from '../../services/translation.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-analytics-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="modal-backdrop" (click)="close.emit()">
      <div class="analytics-card glass-panel" (click)="$event.stopPropagation()">
        <!-- Header -->
        <div class="modal-header">
          <div class="title-group">
            <span class="analytics-icon">📊</span>
            <div>
              <h3>{{ transService.currentLang() === 'en' ? 'Central America Geodynamic Analytics' : 'Analítica Geodinámica de Centroamérica' }}</h3>
              <span class="sub-badge">
                {{ activeTimeframe() === '40y' ? 
                    (transService.currentLang() === 'en' ? 'BigQuery GIS Analytics (1980 - 2026 // 40+ Years)' : 'BigQuery GIS Analytics (1980 - 2026 // 40+ Años)') : 
                    (transService.currentLang() === 'en' ? 'PostGIS Analytics (Real-time // 30 Days)' : 'PostGIS Analytics (Tiempo Real // 30 Días)') }}
              </span>
            </div>
          </div>
          <button class="close-btn" (click)="close.emit()">&times;</button>
        </div>

        <!-- Selector de Período Histórico (BigQuery GIS vs PostGIS) -->
        <div class="timeframe-bar">
          <button 
            class="timeframe-btn" 
            [class.active]="activeTimeframe() === '40y'" 
            (click)="setTimeframe('40y')">
            🏛️ {{ transService.currentLang() === 'en' ? '40+ Years (BigQuery GIS Data Lake)' : '40+ Años (Data Lake BigQuery GIS)' }}
          </button>
          <button 
            class="timeframe-btn" 
            [class.active]="activeTimeframe() === '30d'" 
            (click)="setTimeframe('30d')">
            ⏱️ {{ transService.currentLang() === 'en' ? 'Last 30 Days (PostGIS)' : 'Últimos 30 Días (PostGIS)' }}
          </button>
        </div>

        @if (loading()) {
          <div class="loading-state">
            <div class="spinner"></div>
            <p>{{ transService.currentLang() === 'en' ? 'Aggregating regional spatial statistics...' : 'Compilando estadísticas espaciales de la región...' }}</p>
          </div>
        } @else {
          <div class="modal-content">
            <!-- 1. Distribución por País -->
            <div class="section-card">
              <h4>
                {{ activeTimeframe() === '40y' ? 
                    (transService.currentLang() === 'en' ? 'Historical Seismic Activity by Country (40+ Years)' : 'Sismicidad Histórica por País (40+ Años - BigQuery GIS)') : 
                    (transService.currentLang() === 'en' ? 'Recent Seismic Activity by Country (Last 30 Days)' : 'Sismicidad por País (Últimos 30 Días)') }}
                @if (summary()?.totalEventsAnalyzed; as totalEv) {
                  <span class="total-tag">({{ totalEv | number }} {{ transService.currentLang() === 'en' ? 'events' : 'sismos' }})</span>
                }
              </h4>
              <div class="country-bars">
                @for (item of getCountryList(); track item.name) {
                  <div class="bar-row">
                    <span class="country-name">{{ item.name }}</span>
                    <div class="bar-track">
                      <div class="bar-fill" [style.width.%]="item.percentage"></div>
                    </div>
                    <span class="count-val">{{ item.count }}</span>
                  </div>
                }
              </div>
            </div>

            <!-- 2. Clasificación por Magnitud y Profundidad -->
            <div class="grid-two-col">
              <div class="section-card">
                <h4>{{ transService.currentLang() === 'en' ? 'Magnitude Breakdown' : 'Rango de Magnitud' }}</h4>
                <div class="metric-pills">
                  <div class="pill mag-low">
                    <span class="p-num">{{ summary()?.magnitudeDistribution?.menor || 0 }}</span>
                    <span class="p-lbl">&lt; 3.5</span>
                  </div>
                  <div class="pill mag-med">
                    <span class="p-num">{{ summary()?.magnitudeDistribution?.moderado || 0 }}</span>
                    <span class="p-lbl">3.5 - 4.4</span>
                  </div>
                  <div class="pill mag-high">
                    <span class="p-num">{{ summary()?.magnitudeDistribution?.fuerte || 0 }}</span>
                    <span class="p-lbl">4.5 - 5.9</span>
                  </div>
                  <div class="pill mag-major">
                    <span class="p-num">{{ summary()?.magnitudeDistribution?.mayor || 0 }}</span>
                    <span class="p-lbl">&ge; 6.0</span>
                  </div>
                </div>
              </div>

              <div class="section-card">
                <h4>{{ transService.currentLang() === 'en' ? 'Focal Depth Structure' : 'Estructura de Profundidad' }}</h4>
                <div class="depth-stats">
                  <div class="depth-row">
                    <span>{{ transService.currentLang() === 'en' ? 'Shallow (&lt; 30 km)' : 'Someros (&lt; 30 km)' }}</span>
                    <strong>{{ summary()?.depthDistribution?.shallowUnder30Km || 0 }}</strong>
                  </div>
                  <div class="depth-row">
                    <span>{{ transService.currentLang() === 'en' ? 'Intermediate (30 - 70 km)' : 'Intermedios (30 - 70 km)' }}</span>
                    <strong>{{ summary()?.depthDistribution?.intermediate30to70Km || 0 }}</strong>
                  </div>
                  <div class="depth-row">
                    <span>{{ transService.currentLang() === 'en' ? 'Deep (&gt; 70 km)' : 'Profundos (&gt; 70 km)' }}</span>
                    <strong>{{ summary()?.depthDistribution?.deepOver70Km || 0 }}</strong>
                  </div>
                </div>
              </div>
            </div>

            <!-- 3. Modelo Predictivo de Réplicas (Ley de Omori) -->
            @if (forecast(); as fc) {
              <div class="section-card omori-card">
                <div class="omori-header">
                  <span class="omori-badge">OMORI-UTSU // AFTERSHOCK DECAY</span>
                  <h4>{{ transService.currentLang() === 'en' ? 'Aftershock Forecast (Modified Omori Law)' : 'Pronóstico de Réplicas (Ley Modificada de Omori)' }}</h4>
                </div>
                <p class="mainshock-ref">
                  {{ transService.currentLang() === 'en' ? 'Event analyzed:' : 'Evento analizado:' }}
                  <strong>{{ fc.mainshockTitle }}</strong> (M {{ fc.mainshockMagnitude }})
                </p>

                <div class="forecast-windows">
                  <div class="fc-box">
                    <span class="fc-time">{{ transService.currentLang() === 'en' ? '24 HOURS' : '24 HORAS' }}</span>
                    <span class="fc-count">~{{ fc.forecastWindow24h?.estimatedAftershockCount }} {{ transService.currentLang() === 'en' ? 'aftershocks' : 'réplicas' }}</span>
                    <span class="fc-prob">{{ transService.currentLang() === 'en' ? 'M≥5 Prob:' : 'Prob. M≥5:' }} {{ fc.forecastWindow24h?.probabilityM5Plus }}</span>
                  </div>
                  <div class="fc-box">
                    <span class="fc-time">{{ transService.currentLang() === 'en' ? '48 HOURS' : '48 HORAS' }}</span>
                    <span class="fc-count">~{{ fc.forecastWindow48h?.estimatedAftershockCount }} {{ transService.currentLang() === 'en' ? 'aftershocks' : 'réplicas' }}</span>
                  </div>
                  <div class="fc-box">
                    <span class="fc-time">{{ transService.currentLang() === 'en' ? '72 HOURS' : '72 HORAS' }}</span>
                    <span class="fc-count">~{{ fc.forecastWindow72h?.estimatedAftershockCount }} {{ transService.currentLang() === 'en' ? 'aftershocks' : 'réplicas' }}</span>
                  </div>
                </div>
              </div>
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(3, 7, 18, 0.78);
      backdrop-filter: blur(8px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 180;
      padding: 16px;
    }

    .analytics-card {
      width: 100%;
      max-width: 660px;
      max-height: 88vh;
      overflow-y: auto;
      background: rgba(11, 15, 25, 0.96);
      border: 1px solid rgba(0, 240, 255, 0.3);
      border-radius: 16px;
      padding: 22px;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.8), 0 0 30px rgba(0, 240, 255, 0.12);
    }

    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 18px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      padding-bottom: 12px;
    }

    .title-group {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .analytics-icon {
      font-size: 1.6rem;
    }

    .title-group h3 {
      font-size: 1.05rem;
      font-weight: 700;
      color: #f8fafc;
      margin-bottom: 2px;
    }

    .sub-badge {
      font-size: 0.65rem;
      color: #00f0ff;
      font-family: var(--font-mono);
      letter-spacing: 0.05em;
    }

    .close-btn {
      background: transparent;
      border: none;
      color: #94a3b8;
      font-size: 1.6rem;
      cursor: pointer;
    }
    .close-btn:hover { color: #ffffff; }

    .loading-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 50px;
      gap: 16px;
      color: #94a3b8;
      font-size: 0.85rem;
    }

    .spinner {
      width: 36px;
      height: 36px;
      border: 3px solid rgba(0, 240, 255, 0.2);
      border-top-color: #00f0ff;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin { to { transform: rotate(360deg); } }

    .section-card {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.07);
      border-radius: 12px;
      padding: 14px;
      margin-bottom: 14px;
    }

    .section-card h4 {
      font-size: 0.78rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      color: #cbd5e1;
      margin-bottom: 12px;
      text-transform: uppercase;
    }

    .country-bars {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .bar-row {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 0.75rem;
    }

    .country-name {
      width: 95px;
      color: #94a3b8;
      font-weight: 500;
    }

    .bar-track {
      flex: 1;
      height: 8px;
      background: rgba(255, 255, 255, 0.06);
      border-radius: 4px;
      overflow: hidden;
    }

    .bar-fill {
      height: 100%;
      background: linear-gradient(90deg, #00f0ff, #8b5cf6);
      border-radius: 4px;
      transition: width 0.6s ease;
    }

    .count-val {
      width: 25px;
      text-align: right;
      color: #f8fafc;
      font-family: var(--font-mono);
      font-weight: 700;
    }

    .grid-two-col {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }

    @media (max-width: 600px) {
      .grid-two-col {
        grid-template-columns: 1fr;
      }
    }

    .metric-pills {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }

    .pill {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 8px;
      border-radius: 8px;
      border: 1px solid;
    }

    .pill.mag-low { background: rgba(0, 230, 118, 0.1); border-color: rgba(0, 230, 118, 0.3); color: #00e676; }
    .pill.mag-med { background: rgba(255, 234, 0, 0.1); border-color: rgba(255, 234, 0, 0.3); color: #ffea00; }
    .pill.mag-high { background: rgba(255, 145, 0, 0.1); border-color: rgba(255, 145, 0, 0.3); color: #ff9100; }
    .pill.mag-major { background: rgba(255, 23, 68, 0.1); border-color: rgba(255, 23, 68, 0.3); color: #ff1744; }

    .p-num {
      font-size: 1.1rem;
      font-weight: 800;
      font-family: var(--font-mono);
    }
    .p-lbl {
      font-size: 0.65rem;
      opacity: 0.8;
    }

    .depth-stats {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .depth-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 0.75rem;
      color: #94a3b8;
    }

    .depth-row strong {
      color: #00f0ff;
      font-family: var(--font-mono);
    }

    .omori-card {
      border: 1px solid rgba(139, 92, 246, 0.4);
      background: rgba(139, 92, 246, 0.05);
    }

    .omori-header {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 6px;
      margin-bottom: 8px;
    }

    .omori-header h4 {
      margin-bottom: 0;
    }

    .omori-badge {
      font-size: 0.62rem;
      font-weight: 800;
      padding: 2px 8px;
      border-radius: 4px;
      background: rgba(139, 92, 246, 0.2);
      border: 1px solid rgba(139, 92, 246, 0.4);
      color: #a78bfa;
      font-family: var(--font-mono);
    }

    .mainshock-ref {
      font-size: 0.75rem;
      color: #cbd5e1;
      margin-bottom: 12px;
    }

    .forecast-windows {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
    }

    @media (max-width: 500px) {
      .forecast-windows {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 480px) {
      .modal-backdrop {
        padding: 8px;
      }
      .analytics-card {
        padding: 16px 14px;
        max-height: 92dvh;
        border-radius: 14px;
      }
      .country-name {
        width: 75px;
      }
    }

    .fc-box {
      background: rgba(0, 0, 0, 0.35);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 8px;
      padding: 10px;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
    }

    .fc-time {
      font-size: 0.65rem;
      font-weight: 700;
      color: #94a3b8;
      font-family: var(--font-mono);
      margin-bottom: 4px;
    }

    .fc-count {
      font-size: 0.88rem;
      font-weight: 800;
      color: #00f0ff;
      font-family: var(--font-mono);
    }

    .fc-prob {
      font-size: 0.65rem;
      color: #ff9100;
      margin-top: 4px;
    }

    .timeframe-bar {
      display: flex;
      gap: 8px;
      margin-bottom: 18px;
      background: rgba(255, 255, 255, 0.04);
      padding: 5px;
      border-radius: 12px;
      border: 1px solid rgba(255, 255, 255, 0.08);
    }

    .timeframe-btn {
      flex: 1;
      padding: 9px 14px;
      border-radius: 8px;
      border: 1px solid transparent;
      background: transparent;
      color: #94a3b8;
      font-size: 0.82rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.25s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }

    .timeframe-btn:hover {
      color: #f1f5f9;
      background: rgba(255, 255, 255, 0.06);
    }

    .timeframe-btn.active {
      background: rgba(0, 240, 255, 0.16);
      border-color: rgba(0, 240, 255, 0.55);
      color: #00f0ff;
      box-shadow: 0 0 15px rgba(0, 240, 255, 0.22);
    }

    .total-tag {
      font-size: 0.8rem;
      font-weight: 600;
      color: #00f0ff;
      margin-left: 8px;
      font-family: var(--font-mono);
    }
  `]
})
export class AnalyticsModalComponent implements OnInit {
  @Output() close = new EventEmitter<void>();

  private http = inject(HttpClient);
  transService = inject(TranslationService);

  readonly activeTimeframe = signal<'40y' | '30d'>('40y');
  readonly loading = signal<boolean>(true);
  readonly summary = signal<any>(null);
  readonly forecast = signal<any>(null);

  ngOnInit() {
    this.loadData(this.activeTimeframe());
  }

  setTimeframe(tf: '40y' | '30d') {
    if (this.activeTimeframe() === tf) return;
    this.activeTimeframe.set(tf);
    this.loadData(tf);
  }

  loadData(tf: '40y' | '30d' = '40y') {
    this.loading.set(true);
    this.http.get<any>(`${environment.apiUrl}/analytics/regional-summary?timeframe=${tf}`).subscribe({
      next: (data) => {
        this.summary.set(data);
        this.loadForecast();
      },
      error: () => {
        this.loading.set(false);
      }
    });
  }

  private loadForecast() {
    this.http.get<any>(`${environment.apiUrl}/analytics/aftershock-forecast`).subscribe({
      next: (data) => {
        if (data.status !== 'NO_ACTIVE_MAJOR_EVENT') {
          this.forecast.set(data);
        }
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      }
    });
  }

  getCountryList(): { name: string; count: number; percentage: number }[] {
    const dist = this.summary()?.countryDistribution;
    if (!dist) return [];

    const isEn = this.transService.currentLang() === 'en';
    const counts = Object.values(dist).map(v => Number(v) || 0);
    const maxVal = Math.max(1, ...counts);

    return Object.keys(dist)
      .filter(k => k !== 'Otros / Océano' || dist[k] > 0)
      .map(k => {
        let displayName = k;
        if (isEn) {
          if (k === 'Panamá') displayName = 'Panama';
          else if (k === 'Otros / Océano') displayName = 'Other / Offshore';
        }
        const val = Number(dist[k]) || 0;
        return {
          name: displayName,
          count: val,
          percentage: Math.min(100, Math.round((val / maxVal) * 100))
        };
      })
      .sort((a, b) => b.count - a.count);
  }
}
