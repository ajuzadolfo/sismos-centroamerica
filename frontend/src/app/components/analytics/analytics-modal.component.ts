import { Component, EventEmitter, OnInit, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { TranslationService } from '../../services/translation.service';
import { environment } from '../../../environments/environment';

export interface AnalyticsTop10Event {
  eventId: string;
  title?: string;
  place?: string;
  magnitude: number;
  magnitudeType?: string;
  depthKm: number;
  latitude: number;
  longitude: number;
  eventTime: string;
  usgsUrl?: string;
}

export interface AnalyticsYearlyItem {
  year: number;
  count: number;
}

export interface RegionalSummaryResponse {
  totalCount?: number;
  totalEventsAnalyzed?: number;
  maxMagnitude?: number;
  avgDepth?: number;
  dataSource?: string;
  fromYear?: number;
  toYear?: number;
  windowStart?: string;
  windowEnd?: string;
  queryLatencyMs?: number;
  countryDistribution?: Record<string, number>;
  magnitudeDistribution?: {
    menor?: number;
    moderado?: number;
    fuerte?: number;
    mayor?: number;
  };
  depthDistribution?: {
    shallowUnder30Km?: number;
    intermediate30to70Km?: number;
    deepOver70Km?: number;
  };
  eventsPerDay?: number;
}

export interface ForecastWindowData {
  expectedCountM4?: number;
  expectedCountM5?: number;
  probabilityM5Plus?: string;
  probabilityM6Plus?: string;
}

export interface AftershockForecastResponse {
  status?: string;
  mainshockTitle?: string;
  mainshockMagnitude?: number;
  mainshockPlace?: string;
  mainshockTime?: string;
  forecastWindow24h?: ForecastWindowData;
  forecastWindow48h?: ForecastWindowData;
  forecastWindow72h?: ForecastWindowData;
}

export interface AnomalyRatioItem {
  iso2: string;
  country: string;
  count30d: number;
  historicalMean30d: number;
  ratio: number;
  alertLevel: string;
}

export interface HistoricalInsightsResponse {
  completenessMagnitude?: number;
  completenessMc?: number;
  completenessNote?: string;
  bValue?: number;
  bValueStdErr?: number;
  aValue?: number;
  fromYear?: number;
  toYear?: number;
  queryLatencyMs?: number;
  top10?: AnalyticsTop10Event[];
  yearlySeries?: AnalyticsYearlyItem[];
  anomalyRatios?: AnomalyRatioItem[];
  countryAnomaly?: AnomalyRatioItem[];
}

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
                {{ getBadgeText() }}
                @if (summary()?.queryLatencyMs !== undefined && summary()?.queryLatencyMs !== null) {
                  <span class="latency-badge">({{ summary()?.queryLatencyMs }} ms)</span>
                }
              </span>
            </div>
          </div>
          <button class="close-btn" (click)="close.emit()">&times;</button>
        </div>

        <!-- Selector de Período Histórico (Presets + Rango de Años) -->
        <div class="timeframe-bar">
          <button 
            id="analytics-tf-30d"
            class="timeframe-btn" 
            [class.active]="activeTimeframe() === '30d'" 
            (click)="setTimeframe('30d')">
            ⏱️ {{ transService.currentLang() === 'en' ? '30 Days' : '30 Días' }}
          </button>
          <button 
            id="analytics-tf-5y"
            class="timeframe-btn" 
            [class.active]="activeTimeframe() === '5y'" 
            (click)="setTimeframe('5y')">
            ⚡ {{ transService.currentLang() === 'en' ? '5 Years' : '5 Años' }}
          </button>
          <button 
            id="analytics-tf-10y"
            class="timeframe-btn" 
            [class.active]="activeTimeframe() === '10y'" 
            (click)="setTimeframe('10y')">
            📈 {{ transService.currentLang() === 'en' ? '10 Years' : '10 Años' }}
          </button>
          <button 
            id="analytics-tf-40y"
            class="timeframe-btn" 
            [class.active]="activeTimeframe() === '40y'" 
            (click)="setTimeframe('40y')">
            🏛️ {{ transService.currentLang() === 'en' ? '40+ Years' : '40+ Años' }}
          </button>
          <button 
            id="analytics-tf-custom"
            class="timeframe-btn" 
            [class.active]="activeTimeframe() === 'custom'" 
            (click)="setTimeframe('custom')">
            📅 {{ transService.currentLang() === 'en' ? 'Year Range' : 'Rango' }}
          </button>
        </div>

        <!-- Barra de Filtro por País y Exportación de Datos Abiertos -->
        <div class="analytics-sub-toolbar">
          <div class="country-filter-box">
            <span class="sub-toolbar-lbl">{{ transService.currentLang() === 'en' ? 'Country Filter:' : 'Filtro por País:' }}</span>
            <select class="country-filter-select" id="analytics-country-select" [value]="selectedCountry()" (change)="onCountryChange($event)">
              <option value="ALL">{{ transService.currentLang() === 'en' ? '🌎 Central America (All)' : '🌎 Toda Centroamérica' }}</option>
              <option value="GT">🇬🇹 Guatemala (GT)</option>
              <option value="SV">🇸🇻 El Salvador (SV)</option>
              <option value="HN">🇭🇳 Honduras (HN)</option>
              <option value="NI">🇳🇮 Nicaragua (NI)</option>
              <option value="CR">🇨🇷 Costa Rica (CR)</option>
              <option value="PA">🇵🇦 Panamá (PA)</option>
            </select>
          </div>

          <div class="export-buttons-group">
            <button class="btn-data-export" id="analytics-export-csv" (click)="exportToCsv()" [title]="transService.currentLang() === 'en' ? 'Export current dataset to CSV' : 'Exportar catálogo actual a CSV'">
              <span>📥 CSV</span>
            </button>
            <button class="btn-data-export" id="analytics-export-geojson" (click)="exportToGeoJson()" [title]="transService.currentLang() === 'en' ? 'Export geospatial features to GeoJSON' : 'Exportar capa geoespacial a GeoJSON'">
              <span>🗺️ GeoJSON</span>
            </button>
          </div>
        </div>

        @if (activeTimeframe() === 'custom') {
          <div class="custom-range-bar" id="analytics-custom-range-bar">
            <div class="range-inputs">
              <label class="range-lbl">
                <span>{{ transService.currentLang() === 'en' ? 'From:' : 'Desde:' }}</span>
                <select class="year-select" id="analytics-from-year-select" [value]="fromYear()" (change)="onFromYearChange($event)">
                  @for (y of availableYears; track y) {
                    <option [value]="y" [disabled]="y > toYear()">{{ y }}</option>
                  }
                </select>
              </label>
              <span class="range-sep">—</span>
              <label class="range-lbl">
                <span>{{ transService.currentLang() === 'en' ? 'To:' : 'Hasta:' }}</span>
                <select class="year-select" id="analytics-to-year-select" [value]="toYear()" (change)="onToYearChange($event)">
                  @for (y of availableYears; track y) {
                    <option [value]="y" [disabled]="y < fromYear()">{{ y }}</option>
                  }
                </select>
              </label>
            </div>
            <button class="apply-range-btn" id="analytics-apply-range-btn" (click)="applyCustomRange()">
              🔍 {{ transService.currentLang() === 'en' ? 'Analyze Range' : 'Consultar Rango' }}
            </button>
          </div>
        }

        @if (loading()) {
          <div class="loading-state">
            <div class="spinner"></div>
            <p>{{ transService.currentLang() === 'en' ? 'Aggregating regional spatial statistics...' : 'Compilando estadísticas espaciales de la región...' }}</p>
          </div>
        } @else if (errorMessage()) {
          <div class="error-state">
            <span class="error-icon">⚠️</span>
            <p>{{ errorMessage() }}</p>
            <button id="analytics-retry-btn" class="retry-btn" (click)="loadData(activeTimeframe())">
              🔄 {{ transService.currentLang() === 'en' ? 'Retry' : 'Reintentar' }}
            </button>
          </div>
        } @else if (summary()) {
          <div class="modal-content">
            <!-- 1. Distribución por País -->
            <div class="section-card">
              <h4>
                {{ getSectionTitle() }}
                @if (summary()?.totalEventsAnalyzed; as totalEv) {
                  <span class="total-tag">({{ totalEv | number }} {{ transService.currentLang() === 'en' ? 'events' : 'sismos' }})</span>
                }
              </h4>
              <p class="section-subtitle-note" [title]="transService.currentLang() === 'en' ? 'Classified using official Natural Earth boundaries. Includes offshore events ≤ 100 km.' : 'Clasificación basada en fronteras oficiales Natural Earth. Incluye sismos costa afuera a ≤ 100 km.'">
                📍 {{ transService.currentLang() === 'en' ? 'Official boundaries (includes offshore ≤100 km)' : 'Fronteras oficiales (incluye sismos costa afuera a ≤100 km)' }}
              </p>
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
                  <div class="pill mag-low" [class.mag-dimmed]="activeTimeframe() === '40y'">
                    <span class="p-num">{{ summary()?.magnitudeDistribution?.menor || 0 }}</span>
                    <span class="p-lbl">&lt; 3.5</span>
                    @if (activeTimeframe() === '40y') {
                      <span class="p-incomplete-tag" [title]="transService.currentLang() === 'en' ? 'Below USGS catalog completeness threshold for the region' : 'Por debajo del umbral de completitud del catálogo USGS para la región'">
                        {{ transService.currentLang() === 'en' ? 'Incomplete' : 'Incompleto' }}
                      </span>
                    }
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

            <!-- 3. Modelo Predictivo de Réplicas (Reasenberg & Jones 1989) -->
            @if (forecast(); as fc) {
              <div class="section-card omori-card">
                <div class="omori-header">
                  <span class="omori-badge">REASENBERG &amp; JONES 1989 // AFTERSHOCK DECAY</span>
                  <h4>{{ transService.currentLang() === 'en' ? 'Aftershock Forecast (Reasenberg & Jones)' : 'Pronóstico Estadístico de Réplicas (Reasenberg & Jones)' }}</h4>
                </div>
                <p class="mainshock-ref">
                  {{ transService.currentLang() === 'en' ? 'Event analyzed:' : 'Evento analizado:' }}
                  <strong>{{ fc.mainshockTitle }}</strong> (M {{ fc.mainshockMagnitude }})
                </p>

                <div class="forecast-windows">
                  <div class="fc-box">
                    <span class="fc-time">{{ transService.currentLang() === 'en' ? '24 HOURS' : '24 HORAS' }}</span>
                    <span class="fc-count">~{{ fc.forecastWindow24h?.expectedCountM4 }} {{ transService.currentLang() === 'en' ? 'M≥4 aftershocks' : 'réplicas M≥4' }}</span>
                    <span class="fc-subcount">~{{ fc.forecastWindow24h?.expectedCountM5 }} {{ transService.currentLang() === 'en' ? 'M≥5' : 'M≥5' }}</span>
                    <span class="fc-prob">{{ transService.currentLang() === 'en' ? 'M≥5 Prob:' : 'Prob. M≥5:' }} {{ fc.forecastWindow24h?.probabilityM5Plus }}</span>
                    <span class="fc-prob-sub">{{ transService.currentLang() === 'en' ? 'M≥6 Prob:' : 'Prob. M≥6:' }} {{ fc.forecastWindow24h?.probabilityM6Plus }}</span>
                  </div>
                  <div class="fc-box">
                    <span class="fc-time">{{ transService.currentLang() === 'en' ? '48 HOURS' : '48 HORAS' }}</span>
                    <span class="fc-count">~{{ fc.forecastWindow48h?.expectedCountM4 }} {{ transService.currentLang() === 'en' ? 'M≥4 aftershocks' : 'réplicas M≥4' }}</span>
                    <span class="fc-subcount">~{{ fc.forecastWindow48h?.expectedCountM5 }} {{ transService.currentLang() === 'en' ? 'M≥5' : 'M≥5' }}</span>
                    <span class="fc-prob">{{ transService.currentLang() === 'en' ? 'M≥5 Prob:' : 'Prob. M≥5:' }} {{ fc.forecastWindow48h?.probabilityM5Plus }}</span>
                    <span class="fc-prob-sub">{{ transService.currentLang() === 'en' ? 'M≥6 Prob:' : 'Prob. M≥6:' }} {{ fc.forecastWindow48h?.probabilityM6Plus }}</span>
                  </div>
                  <div class="fc-box">
                    <span class="fc-time">{{ transService.currentLang() === 'en' ? '72 HOURS' : '72 HORAS' }}</span>
                    <span class="fc-count">~{{ fc.forecastWindow72h?.expectedCountM4 }} {{ transService.currentLang() === 'en' ? 'M≥4 aftershocks' : 'réplicas M≥4' }}</span>
                    <span class="fc-subcount">~{{ fc.forecastWindow72h?.expectedCountM5 }} {{ transService.currentLang() === 'en' ? 'M≥5' : 'M≥5' }}</span>
                    <span class="fc-prob">{{ transService.currentLang() === 'en' ? 'M≥5 Prob:' : 'Prob. M≥5:' }} {{ fc.forecastWindow72h?.probabilityM5Plus }}</span>
                    <span class="fc-prob-sub">{{ transService.currentLang() === 'en' ? 'M≥6 Prob:' : 'Prob. M≥6:' }} {{ fc.forecastWindow72h?.probabilityM6Plus }}</span>
                  </div>
                </div>

                <div class="forecast-disclaimer">
                  <span class="disclaimer-icon">ℹ️</span>
                  <span>
                    {{ transService.currentLang() === 'en' ? 
                      'Statistical model (Reasenberg & Jones 1989; a=-1.67, b=0.91, p=1.08, c=0.05 d). Not an official forecast; consult your national seismological agency.' : 
                      'Modelo estadístico genérico (Reasenberg & Jones 1989; a=-1.67, b=0.91, p=1.08, c=0.05 d). No es un pronóstico oficial; consulte a su agencia sismológica nacional.' }}
                  </span>
                </div>
              </div>
            }

            <!-- 4. Secciones de Analítica Histórica de Valor Añadido (BigQuery) -->
            @if (activeTimeframe() !== '30d' && insights(); as ins) {
              <!-- 4.1 Completitud y valor b -->
              <div class="section-card" id="analytics-completeness-card">
                <div class="insight-header">
                  <span class="insight-badge">GUTENBERG-RICHTER &amp; AKI-UTSU (1965)</span>
                  <h4>{{ transService.currentLang() === 'en' ? 'Catalog Completeness & b-Value' : 'Completitud y Valor b Sismotectónico' }}</h4>
                </div>
                <div class="completeness-banner">
                  <div class="mc-b-values">
                    <span class="mc-tag">M<sub>c</sub> ≈ {{ ins.completenessMc }}</span>
                    <span class="b-tag">b = {{ ins.bValue }} ± {{ ins.bValueStdErr }}</span>
                  </div>
                  <p class="completeness-note-txt">{{ ins.completenessNote }}</p>
                </div>
              </div>

              <!-- 4.2 Anomalía sísmica: 30d vs. media histórica -->
              <div class="section-card" id="analytics-anomaly-card">
                <h4>
                  {{ transService.currentLang() === 'en' ? 'Seismic Activity Anomaly (Last 30d vs Period Baseline)' : 'Anomalía Sísmica (Últimos 30d vs Media del Período)' }}
                  <span class="mag-threshold-tag">({{ ins.fromYear || 1980 }} - {{ ins.toYear || currentYear }} · M ≥ 4.5)</span>
                </h4>
                <p class="section-subtitle-note">
                  ℹ️ {{ transService.currentLang() === 'en' ? 'Ratios > 1.5× indicate elevated activity, commonly due to active aftershock sequences.' : 'Ratios > 1.5× indican actividad elevada, usualmente por secuencias de réplicas activas.' }}
                </p>
                <div class="anomaly-grid">
                  @for (anom of ins.anomalyRatios; track anom.iso2) {
                    <div class="anomaly-card" [id]="'analytics-anomaly-' + anom.iso2">
                      <div class="anomaly-info">
                        <span class="anomaly-country-name">{{ anom.country }}</span>
                        <span class="anomaly-count-sub">{{ anom.count30d }} / ~{{ anom.historicalMean30d }}</span>
                      </div>
                      <span class="anomaly-chip" [class]="getAnomalyChipClass(anom.alertLevel)">
                        {{ anom.ratio }}× {{ transService.currentLang() === 'en' ? 'norm' : 'normal' }}
                      </span>
                    </div>
                  }
                </div>
              </div>

              <!-- 4.3 Serie anual (M >= Mc) mini SVG inline -->
              <div class="section-card" id="analytics-yearly-card">
                <h4>
                  {{ transService.currentLang() === 'en' ? 'Annual Trend' : 'Tendencia Anual' }}
                  <span class="mag-threshold-tag">({{ ins.fromYear || 1980 }} - {{ ins.toYear || currentYear }} · M ≥ {{ ins.completenessMc }})</span>
                </h4>
                <div class="yearly-chart-box">
                  <svg id="analytics-yearly-chart" viewBox="0 0 540 100" class="yearly-svg">
                    @for (bar of getYearlyBars(); track bar.year) {
                      <rect 
                        [attr.x]="bar.x" 
                        [attr.y]="bar.y" 
                        [attr.width]="bar.width" 
                        [attr.height]="bar.height" 
                        class="yearly-bar"
                        rx="1">
                        <title>{{ bar.year }}: {{ bar.count }} {{ transService.currentLang() === 'en' ? 'events' : 'sismos' }} (M ≥ {{ ins.completenessMc }})</title>
                      </rect>
                    }
                    <line x1="5" y1="89" x2="535" y2="89" stroke="rgba(255, 255, 255, 0.08)" stroke-width="1" />
                    @for (lbl of getYearlyAxisLabels(); track lbl.text) {
                      <text 
                        [attr.x]="lbl.x" 
                        y="98" 
                        [attr.text-anchor]="lbl.anchor"
                        [class.current-year]="lbl.isCurrent"
                        class="chart-axis-lbl">
                        {{ lbl.text }}
                      </text>
                    }
                  </svg>
                </div>
              </div>

              <!-- 4.4 Top 10 sismos históricos -->
              <div class="section-card" id="analytics-top10-card">
                <h4>
                  {{ transService.currentLang() === 'en' ? 'Top 10 Strongest Earthquakes in Range' : 'Top 10 Sismos Más Fuertes del Rango' }}
                  <span class="mag-threshold-tag">(USGS {{ ins.fromYear || 1980 }} - {{ ins.toYear || currentYear }})</span>
                </h4>
                <div class="top10-list">
                  @for (ev of ins.top10; track ev.eventId; let idx = $index) {
                    <a 
                      [href]="ev.usgsUrl" 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      [id]="'analytics-top10-' + ev.eventId" 
                      class="top10-item">
                      <span class="top10-rank">#{{ idx + 1 }}</span>
                      <span class="top10-mag">M {{ ev.magnitude }}</span>
                      <div class="top10-info">
                        <span class="top10-place">{{ ev.place }}</span>
                        <div class="top10-meta">
                          <span class="meta-date">{{ formatTopDate(ev.eventTime) }}</span>
                          <span class="meta-sep">·</span>
                          <span class="time-badge local" [title]="transService.currentLang() === 'en' ? 'Local Time' : 'Hora Local'">
                            🕒 Local: {{ formatTopLocalTime(ev.eventTime) }}
                          </span>
                          <span class="time-badge utc" title="Tiempo Universal Coordinado (UTC)">
                            🌐 UTC: {{ formatTopUtcTime(ev.eventTime) }}
                          </span>
                          <span class="meta-sep">·</span>
                          <span class="meta-depth">{{ ev.depthKm }} km</span>
                        </div>
                      </div>
                      <span class="top10-link-arrow">↗</span>
                    </a>
                  }
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
      margin-bottom: 4px;
      text-transform: uppercase;
    }

    .section-subtitle-note {
      font-size: 0.68rem;
      color: #94a3b8;
      margin: 0 0 12px 0;
      cursor: help;
      display: inline-block;
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

    .fc-subcount {
      font-size: 0.72rem;
      font-weight: 700;
      color: #38bdf8;
      font-family: var(--font-mono);
      margin-top: 2px;
    }

    .fc-prob-sub {
      font-size: 0.62rem;
      color: #fbbf24;
      margin-top: 2px;
    }

    .forecast-disclaimer {
      margin-top: 12px;
      padding: 8px 12px;
      border-radius: 6px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.06);
      font-size: 0.68rem;
      color: #94a3b8;
      display: flex;
      gap: 6px;
      align-items: flex-start;
      line-height: 1.4;
    }

    .disclaimer-icon {
      font-size: 0.8rem;
      flex-shrink: 0;
    }

    .timeframe-bar {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-bottom: 14px;
      background: rgba(255, 255, 255, 0.04);
      padding: 5px;
      border-radius: 12px;
      border: 1px solid rgba(255, 255, 255, 0.08);
    }

    .timeframe-btn {
      flex: 1 1 auto;
      min-width: 80px;
      padding: 8px 10px;
      border-radius: 8px;
      border: 1px solid transparent;
      background: transparent;
      color: #94a3b8;
      font-size: 0.78rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.25s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
      white-space: nowrap;
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

    .analytics-sub-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 14px;
      padding: 8px 14px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 10px;
      flex-wrap: wrap;
    }

    .country-filter-box {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .sub-toolbar-lbl {
      font-size: 0.72rem;
      font-weight: 700;
      color: #94a3b8;
    }

    .country-filter-select {
      background: rgba(15, 23, 42, 0.9);
      border: 1px solid rgba(0, 240, 255, 0.35);
      border-radius: 6px;
      color: #ffffff;
      font-family: var(--font-sans);
      font-size: 0.74rem;
      font-weight: 600;
      padding: 4px 8px;
      cursor: pointer;
      outline: none;
    }

    .export-buttons-group {
      display: flex;
      gap: 6px;
    }

    .btn-data-export {
      display: flex;
      align-items: center;
      gap: 5px;
      padding: 4px 10px;
      background: rgba(0, 240, 255, 0.1);
      border: 1px solid rgba(0, 240, 255, 0.35);
      border-radius: 6px;
      color: #00f0ff;
      font-family: var(--font-mono);
      font-size: 0.7rem;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .btn-data-export:hover {
      background: rgba(0, 240, 255, 0.22);
      color: #ffffff;
      box-shadow: 0 0 10px rgba(0, 240, 255, 0.3);
    }

    .custom-range-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 8px 14px;
      margin-bottom: 16px;
      background: rgba(0, 240, 255, 0.05);
      border: 1px solid rgba(0, 240, 255, 0.25);
      border-radius: 10px;
      flex-wrap: wrap;
    }

    .range-inputs {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .range-lbl {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.76rem;
      color: #94a3b8;
      font-weight: 600;
    }

    .range-sep {
      color: #64748b;
      font-weight: 700;
    }

    .year-select {
      background: rgba(15, 23, 42, 0.9);
      border: 1px solid rgba(0, 240, 255, 0.35);
      color: #00f0ff;
      font-family: var(--font-mono);
      font-size: 0.82rem;
      font-weight: 700;
      border-radius: 6px;
      padding: 4px 8px;
      cursor: pointer;
      outline: none;
      transition: all 0.2s ease;
    }

    .year-select:focus {
      border-color: #00f0ff;
      box-shadow: 0 0 10px rgba(0, 240, 255, 0.35);
    }

    .apply-range-btn {
      background: rgba(0, 240, 255, 0.18);
      border: 1px solid rgba(0, 240, 255, 0.6);
      color: #00f0ff;
      font-size: 0.78rem;
      font-weight: 700;
      padding: 6px 14px;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      gap: 5px;
    }

    .apply-range-btn:hover {
      background: rgba(0, 240, 255, 0.3);
      box-shadow: 0 0 12px rgba(0, 240, 255, 0.4);
      color: #ffffff;
    }

    .total-tag {
      font-size: 0.8rem;
      font-weight: 600;
      color: #00f0ff;
      margin-left: 8px;
      font-family: var(--font-mono);
    }

    .error-state {
      padding: 48px 24px;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
    }

    .error-icon {
      font-size: 2.5rem;
    }

    .error-state p {
      color: #ef4444;
      font-weight: 500;
      font-size: 0.95rem;
      max-width: 400px;
      margin: 0;
    }

    .retry-btn {
      margin-top: 8px;
      padding: 8px 16px;
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid rgba(239, 68, 68, 0.4);
      color: #fca5a5;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 600;
      transition: all 0.2s ease;
    }

    .retry-btn:hover {
      background: rgba(239, 68, 68, 0.25);
      color: #ffffff;
    }

    .mag-dimmed {
      opacity: 0.45;
      border-style: dashed !important;
      position: relative;
    }

    .p-incomplete-tag {
      font-size: 0.55rem;
      color: #f59e0b;
      font-weight: 700;
      margin-top: 2px;
      letter-spacing: 0.03em;
    }

    .mag-threshold-tag {
      font-size: 0.65rem;
      color: #00f0ff;
      font-family: var(--font-mono);
      font-weight: 600;
      margin-left: 6px;
      text-transform: none;
    }

    .insight-header {
      margin-bottom: 8px;
    }

    .insight-badge {
      display: inline-block;
      font-size: 0.62rem;
      font-weight: 700;
      color: #38bdf8;
      background: rgba(56, 189, 248, 0.12);
      border: 1px solid rgba(56, 189, 248, 0.3);
      padding: 2px 8px;
      border-radius: 4px;
      font-family: var(--font-mono);
      letter-spacing: 0.05em;
      margin-bottom: 6px;
    }

    .completeness-banner {
      background: rgba(0, 240, 255, 0.04);
      border: 1px solid rgba(0, 240, 255, 0.18);
      border-radius: 8px;
      padding: 12px 14px;
    }

    .mc-b-values {
      display: flex;
      gap: 16px;
      margin-bottom: 6px;
    }

    .mc-tag, .b-tag {
      font-size: 0.95rem;
      font-weight: 800;
      color: #00f0ff;
      font-family: var(--font-mono);
    }

    .completeness-note-txt {
      font-size: 0.74rem;
      color: #94a3b8;
      margin: 0;
      line-height: 1.4;
    }

    .anomaly-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
    }

    @media (max-width: 600px) {
      .anomaly-grid { grid-template-columns: repeat(2, 1fr); }
    }

    .anomaly-card {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.07);
      border-radius: 8px;
      padding: 8px 10px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 6px;
    }

    .anomaly-info {
      display: flex;
      flex-direction: column;
    }

    .anomaly-country-name {
      font-size: 0.74rem;
      font-weight: 600;
      color: #e2e8f0;
    }

    .anomaly-count-sub {
      font-size: 0.62rem;
      color: #64748b;
      font-family: var(--font-mono);
    }

    .anomaly-chip {
      font-size: 0.65rem;
      font-weight: 700;
      padding: 3px 6px;
      border-radius: 6px;
      white-space: nowrap;
      font-family: var(--font-mono);
    }

    .chip-neutral {
      background: rgba(148, 163, 184, 0.14);
      color: #cbd5e1;
      border: 1px solid rgba(148, 163, 184, 0.25);
    }

    .chip-elevated {
      background: rgba(245, 158, 11, 0.18);
      color: #fbbf24;
      border: 1px solid rgba(245, 158, 11, 0.45);
    }

    .chip-critical {
      background: rgba(239, 68, 68, 0.22);
      color: #f87171;
      border: 1px solid rgba(239, 68, 68, 0.55);
    }

    .yearly-chart-box {
      background: rgba(0, 0, 0, 0.25);
      border-radius: 8px;
      padding: 8px 10px;
      border: 1px solid rgba(255, 255, 255, 0.05);
    }

    .yearly-svg {
      width: 100%;
      height: 95px;
      overflow: visible;
    }

    .yearly-bar {
      fill: #00f0ff;
      opacity: 0.72;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .yearly-bar:hover {
      fill: #38bdf8;
      opacity: 1;
      filter: drop-shadow(0 0 4px #00f0ff);
    }

    .chart-axis-lbl {
      fill: #64748b;
      font-size: 8px;
      font-family: var(--font-mono);
      user-select: none;
    }

    .chart-axis-lbl.current-year {
      fill: #00f0ff;
      font-weight: 700;
    }

    .top10-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .top10-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 12px;
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid rgba(255, 255, 255, 0.06);
      text-decoration: none;
      transition: all 0.2s ease;
      cursor: pointer;
    }

    .top10-item:hover {
      background: rgba(0, 240, 255, 0.06);
      border-color: rgba(0, 240, 255, 0.3);
      transform: translateX(2px);
    }

    .top10-rank {
      font-size: 0.75rem;
      font-weight: 700;
      color: #64748b;
      width: 24px;
      font-family: var(--font-mono);
    }

    .top10-mag {
      font-size: 0.88rem;
      font-weight: 800;
      color: #f43f5e;
      font-family: var(--font-mono);
      min-width: 48px;
    }

    .top10-info {
      display: flex;
      flex-direction: column;
      flex: 1;
    }

    .top10-place {
      font-size: 0.76rem;
      color: #e2e8f0;
      font-weight: 500;
    }

    .top10-meta {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 5px;
      font-size: 0.65rem;
      color: #94a3b8;
      font-family: var(--font-mono);
      margin-top: 3px;
    }

    .meta-date {
      color: #e2e8f0;
      font-weight: 600;
    }

    .meta-sep {
      color: #475569;
    }

    .time-badge {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      padding: 1px 5px;
      border-radius: 4px;
      font-size: 0.62rem;
      font-weight: 500;
      letter-spacing: 0.2px;
    }

    .time-badge.local {
      background: rgba(56, 189, 248, 0.1);
      border: 1px solid rgba(56, 189, 248, 0.25);
      color: #38bdf8;
    }

    .time-badge.utc {
      background: rgba(167, 139, 250, 0.1);
      border: 1px solid rgba(167, 139, 250, 0.25);
      color: #c4b5fd;
    }

    .meta-depth {
      color: #94a3b8;
    }

    .top10-link-arrow {
      color: #00f0ff;
      font-size: 0.85rem;
    }

    .latency-badge {
      color: #38bdf8;
      margin-left: 6px;
      font-size: 0.65rem;
    }
  `]
})
export class AnalyticsModalComponent implements OnInit {
  @Output() close = new EventEmitter<void>();

  private http = inject(HttpClient);
  transService = inject(TranslationService);

  readonly activeTimeframe = signal<'30d' | '5y' | '10y' | '40y' | 'custom'>('40y');
  readonly fromYear = signal<number>(1980);
  readonly toYear = signal<number>(new Date().getFullYear());
  readonly currentYear = new Date().getFullYear();
  readonly availableYears = Array.from({ length: new Date().getFullYear() - 1980 + 1 }, (_, i) => 1980 + i);
  readonly selectedCountry = signal<string>('ALL');

  readonly loading = signal<boolean>(true);
  readonly errorMessage = signal<string | null>(null);
  readonly summary = signal<RegionalSummaryResponse | null>(null);
  readonly forecast = signal<AftershockForecastResponse | null>(null);
  readonly insights = signal<HistoricalInsightsResponse | null>(null);

  ngOnInit() {
    this.loadData(this.activeTimeframe());
    this.loadForecast();
    this.loadInsights(this.activeTimeframe());
  }

  onCountryChange(event: Event) {
    const val = (event.target as HTMLSelectElement).value;
    this.selectedCountry.set(val);
    this.loadData(this.activeTimeframe());
    if (this.activeTimeframe() !== '30d') {
      this.loadInsights(this.activeTimeframe());
    }
  }

  exportToCsv() {
    const ins = this.insights();
    const top10 = ins?.top10 || [];
    const country = this.selectedCountry();
    const tf = this.activeTimeframe();

    let csv = 'rank,event_id,magnitude,magnitude_type,depth_km,latitude,longitude,place,event_time_utc,usgs_url\n';
    top10.forEach((ev: AnalyticsTop10Event, idx: number) => {
      csv += `${idx + 1},"${ev.eventId}",${ev.magnitude},"${ev.magnitudeType || ''}",${ev.depthKm},${ev.latitude},${ev.longitude},"${(ev.place || '').replace(/"/g, '""')}","${ev.eventTime}","${ev.usgsUrl}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const filename = `sismos-top10-${tf}-${country}.csv`;
    this.downloadFile(blob, filename);
  }

  exportToGeoJson() {
    const ins = this.insights();
    const top10 = ins?.top10 || [];
    const country = this.selectedCountry();
    const tf = this.activeTimeframe();

    const geojson = {
      type: 'FeatureCollection',
      features: top10.map((ev: AnalyticsTop10Event, idx: number) => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [ev.longitude, ev.latitude]
        },
        properties: {
          rank: idx + 1,
          id: ev.eventId,
          title: ev.title,
          magnitude: ev.magnitude,
          magnitudeType: ev.magnitudeType,
          depthKm: ev.depthKm,
          place: ev.place,
          time: ev.eventTime,
          url: ev.usgsUrl
        }
      }))
    };

    const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/geo+json;charset=utf-8;' });
    const filename = `sismos-top10-${tf}-${country}.geojson`;
    this.downloadFile(blob, filename);
  }

  private downloadFile(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  setTimeframe(tf: '30d' | '5y' | '10y' | '40y' | 'custom') {
    if (this.activeTimeframe() === tf && tf !== 'custom') return;
    this.activeTimeframe.set(tf);

    if (tf === '5y') {
      this.fromYear.set(this.currentYear - 5);
      this.toYear.set(this.currentYear);
    } else if (tf === '10y') {
      this.fromYear.set(this.currentYear - 10);
      this.toYear.set(this.currentYear);
    } else if (tf === '40y') {
      this.fromYear.set(1980);
      this.toYear.set(this.currentYear);
    }

    if (tf !== 'custom') {
      this.loadData(tf);
      if (tf !== '30d') {
        this.loadInsights(tf);
      } else {
        this.insights.set(null);
      }
    } else {
      this.applyCustomRange();
    }
  }

  applyCustomRange() {
    this.loadData('custom');
    this.loadInsights('custom');
  }

  onFromYearChange(event: Event) {
    const val = Number((event.target as HTMLSelectElement).value);
    this.fromYear.set(val);
    if (val > this.toYear()) {
      this.toYear.set(val);
    }
  }

  onToYearChange(event: Event) {
    const val = Number((event.target as HTMLSelectElement).value);
    this.toYear.set(val);
    if (val < this.fromYear()) {
      this.fromYear.set(val);
    }
  }

  loadData(tf: '30d' | '5y' | '10y' | '40y' | 'custom' = this.activeTimeframe()) {
    this.loading.set(true);
    this.errorMessage.set(null);

    let url = `${environment.apiUrl}/analytics/regional-summary?timeframe=${tf}`;
    if (tf === 'custom') {
      url = `${environment.apiUrl}/analytics/regional-summary?fromYear=${this.fromYear()}&toYear=${this.toYear()}`;
    }
    if (this.selectedCountry() !== 'ALL') {
      url += `&country=${this.selectedCountry()}`;
    }

    this.http.get<RegionalSummaryResponse>(url).subscribe({
      next: (data) => {
        this.summary.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.summary.set(null);
        this.loading.set(false);
        const isEn = this.transService.currentLang() === 'en';
        if (err.status === 503) {
          this.errorMessage.set(isEn ? 'The historical catalog in BigQuery is temporarily unavailable.' : 'El catálogo histórico en BigQuery no se encuentra disponible temporalmente.');
        } else {
          this.errorMessage.set(isEn ? 'Unable to load regional seismic analytics at this time.' : 'No se pudieron compilar las estadísticas regionales en este momento.');
        }
      }
    });
  }

  loadInsights(tf: '30d' | '5y' | '10y' | '40y' | 'custom' = this.activeTimeframe()) {
    if (tf === '30d') {
      this.insights.set(null);
      return;
    }
    let url = `${environment.apiUrl}/analytics/historical-insights?timeframe=${tf}`;
    if (tf === 'custom') {
      url = `${environment.apiUrl}/analytics/historical-insights?fromYear=${this.fromYear()}&toYear=${this.toYear()}`;
    }
    if (this.selectedCountry() !== 'ALL') {
      url += `&country=${this.selectedCountry()}`;
    }
    this.http.get<HistoricalInsightsResponse>(url).subscribe({
      next: (data) => this.insights.set(data),
      error: () => {
        this.insights.set(null);
      }
    });
  }

  getBadgeText(): string {
    const s = this.summary();
    const isEn = this.transService.currentLang() === 'en';
    if (!s) {
      return this.activeTimeframe() === '30d' ? 
        (isEn ? 'PostGIS Analytics (Real-time // 30 Days)' : 'PostGIS Analytics (Tiempo Real // 30 Días)') :
        (isEn ? 'BigQuery GIS Analytics (Historical Data Lake)' : 'BigQuery GIS Analytics (Data Lake Histórico)');
    }
    if (s.dataSource === 'BIGQUERY') {
      const startYear = s.fromYear || (s.windowStart ? new Date(s.windowStart).getFullYear() : 1980);
      const endYear = s.toYear || (s.windowEnd ? new Date(s.windowEnd).getFullYear() : this.currentYear);
      const span = (endYear - startYear) + 1;
      return isEn ? `BigQuery GIS Analytics (${startYear} - ${endYear} // ${span} Years)` : `BigQuery GIS Analytics (${startYear} - ${endYear} // ${span} Años)`;
    } else {
      return isEn ? 'PostGIS Analytics (Real-time // 30 Days)' : 'PostGIS Analytics (Tiempo Real // 30 Días)';
    }
  }

  getSectionTitle(): string {
    const s = this.summary();
    const isEn = this.transService.currentLang() === 'en';
    if (!s) return isEn ? 'Seismic Activity by Country' : 'Sismicidad por País';
    if (s.dataSource === 'BIGQUERY') {
      const startYear = s.fromYear || 1980;
      const endYear = s.toYear || this.currentYear;
      return isEn ? `Historical Activity by Country (${startYear} - ${endYear} // BigQuery GIS)` : `Sismicidad por País (${startYear} - ${endYear} // BigQuery GIS)`;
    } else {
      return isEn ? 'Recent Seismic Activity by Country (Last 30 Days - PostGIS)' : 'Sismicidad por País (Últimos 30 Días - PostGIS)';
    }
  }

  private loadForecast() {
    this.http.get<AftershockForecastResponse>(`${environment.apiUrl}/analytics/aftershock-forecast`).subscribe({
      next: (data) => {
        if (data.status !== 'NO_ACTIVE_MAJOR_EVENT') {
          this.forecast.set(data);
        }
      },
      error: () => {
        this.forecast.set(null);
      }
    });
  }

  getCountryList(): { name: string; count: number; percentage: number }[] {
    const dist = this.summary()?.countryDistribution as Record<string, number> | undefined;
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
          else if (k === 'Fuera de Centroamérica') displayName = 'Outside Central America';
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

  getYearlyBars(): { x: number; y: number; width: number; height: number; year: number; count: number }[] {
    const series = this.insights()?.yearlySeries;
    if (!series || !series.length) return [];
    const maxCount = Math.max(1, ...series.map((s: AnalyticsYearlyItem) => Number(s.count) || 0));
    const total = series.length;
    const chartW = 530;
    const chartH = 80;
    const barW = Math.max(3, Math.floor(chartW / total) - 2);

    return series.map((s: AnalyticsYearlyItem, i: number) => {
      const cnt = Number(s.count) || 0;
      const h = Math.max(2, Math.round((cnt / maxCount) * chartH));
      const x = 5 + i * (chartW / total);
      const y = 88 - h;
      return { x, y, width: barW, height: h, year: s.year, count: cnt };
    });
  }

  getYearlyAxisLabels(): { x: number; text: string; anchor: 'start' | 'middle' | 'end'; isCurrent: boolean }[] {
    const series = this.insights()?.yearlySeries;
    if (!series || !series.length) return [];

    const total = series.length;
    const chartW = 530;
    const startYear = Number(series[0].year);
    const endYear = Number(series[series.length - 1].year);
    const span = endYear - startYear;

    const labels: { x: number; text: string; anchor: 'start' | 'middle' | 'end'; isCurrent: boolean }[] = [];

    series.forEach((s: AnalyticsYearlyItem, i: number) => {
      const year = Number(s.year);
      const isStart = year === startYear;
      const isEnd = year === endYear;

      const barCenterX = 5 + i * (chartW / total) + Math.max(3, Math.floor(chartW / total) - 2) / 2;

      if (isStart) {
        labels.push({ x: 5, text: String(year), anchor: 'start', isCurrent: false });
      } else if (isEnd) {
        labels.push({ x: 535, text: String(year), anchor: 'end', isCurrent: year === this.currentYear });
      } else {
        const shouldShow = span <= 8 ? true : (span <= 16 ? year % 2 === 0 : year % 5 === 0);
        const minGap = span <= 8 ? 1 : 2;
        if (shouldShow && (endYear - year) >= minGap && (year - startYear) >= minGap) {
          labels.push({ x: barCenterX, text: String(year), anchor: 'middle', isCurrent: year === this.currentYear });
        }
      }
    });

    return labels;
  }

  getAnomalyChipClass(alert: string): string {
    if (alert === 'CRITICAL') return 'chip-critical';
    if (alert === 'ELEVATED') return 'chip-elevated';
    return 'chip-neutral';
  }

  parseTopDate(val: string | number | undefined): Date | null {
    if (!val) return null;
    if (typeof val === 'number') {
      const ms = val < 10_000_000_000 ? val * 1000 : val;
      const d = new Date(ms);
      return isNaN(d.getTime()) ? null : d;
    }
    const str = String(val).trim();
    if (str.includes('T') || str.includes(' ')) {
      const d = new Date(str.replace(' ', 'T'));
      if (!isNaN(d.getTime())) return d;
    }
    const num = Number(str);
    if (!isNaN(num) && num > 0) {
      const ms = num < 10_000_000_000 ? num * 1000 : num;
      const d = new Date(ms);
      if (!isNaN(d.getTime())) return d;
    }
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
  }

  formatTopDate(val: string | number | undefined): string {
    const d = this.parseTopDate(val);
    if (!d) return String(val || '').slice(0, 10);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  formatTopLocalTime(val: string | number | undefined): string {
    const d = this.parseTopDate(val);
    if (!d) return '--:--';
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }

  formatTopUtcTime(val: string | number | undefined): string {
    const d = this.parseTopDate(val);
    if (!d) return '--:--';
    const hh = String(d.getUTCHours()).padStart(2, '0');
    const mm = String(d.getUTCMinutes()).padStart(2, '0');
    const ss = String(d.getUTCSeconds()).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }
}
